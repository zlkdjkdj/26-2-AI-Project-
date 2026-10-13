"""Opt-in foreground web activity checks. No claim of OS-wide/continuous phone monitoring."""
import hashlib
import secrets
import time
from datetime import datetime
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from .db import connect

router = APIRouter(prefix='/api/care', tags=['생활 확인'])

class CareCreate(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    name: str = Field(default='우리 가족', min_length=1, max_length=50)
    idle_hours: int = Field(default=3, ge=1, le=24)
    start_hour: int = Field(default=8, ge=0, le=23)
    end_hour: int = Field(default=22, ge=0, le=23)
    location_consent: bool = False
    consent: bool

class CareHeartbeat(BaseModel):
    model_config = ConfigDict(extra='forbid')
    last_activity: float | None = Field(default=None, ge=0)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)


def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


def authorize(authorization, guardian=False):
    if not authorization.startswith('Bearer ') or len(authorization)>200:
        raise HTTPException(401, '생활 확인 접근 권한이 필요합니다.')
    token_hash=digest(authorization[7:])
    with connect() as connection:
        row=connection.execute(f"SELECT * FROM care_sessions WHERE {'guardian_hash' if guardian else 'owner_hash'}=?", (token_hash,)).fetchone()
    if row is None:
        raise HTTPException(401, '생활 확인 접근 권한이 유효하지 않습니다.')
    return dict(row)


def in_window(row,now):
    hour=datetime.fromtimestamp(now,ZoneInfo('Asia/Seoul')).hour
    start,end=row['start_hour'],row['end_hour']
    return True if start==end else (start<=hour<end if start<end else hour>=start or hour<end)


def assess(row,now):
    if not row['enabled']:
        return 'paused', '생활 확인을 중지했습니다.'
    if not in_window(row,now):
        return 'quiet', '설정한 확인 시간 밖입니다.'
    if now-row['last_seen']>180:
        return 'disconnected', '웹 화면의 연결 기록이 끊겼습니다. 브라우저 종료·통신 상태를 먼저 확인해 주세요.'
    if now-row['last_activity']>=row['idle_hours']*3600:
        return 'inactive', '설정한 시간 동안 이 웹 화면에서 활동이 기록되지 않았습니다. 대상자에게 직접 확인해 주세요.'
    return 'connected', '웹 화면에서 최근 활동 또는 연결이 확인되었습니다.'


def check_alerts(now=None):
    now=now or time.time()
    with connect() as connection:
        rows=connection.execute('SELECT * FROM care_sessions WHERE enabled=1').fetchall()
        for record in rows:
            row=dict(record);state,message=assess(row,now)
            if state in ('inactive','disconnected') and state!=row['last_state']:
                connection.execute('INSERT INTO care_alerts(session_id,kind,message,created_at) VALUES(?,?,?,?)',(row['id'],state,message,now))
            connection.execute('UPDATE care_sessions SET last_state=? WHERE id=?',(state,row['id']))


def view(row,guardian=False):
    check_alerts()
    with connect() as connection:
        row=dict(connection.execute('SELECT * FROM care_sessions WHERE id=?',(row['id'],)).fetchone())
        alerts=[dict(r) for r in connection.execute('SELECT id,kind,message,created_at FROM care_alerts WHERE session_id=? ORDER BY id DESC LIMIT 20',(row['id'],))]
    state,message=assess(row,time.time())
    result={k:row[k] for k in ('name','idle_hours','start_hour','end_hour','enabled','last_seen','last_activity')}
    result.update(state=state,message=message,alerts=alerts,notice='웹 화면의 활동만 확인합니다. 화면 종료·절전 시 연결이 중단됩니다. 미활동이나 연결 끊김은 사고의 판정이 아닙니다. 위치는 보호자 화면에 제공하지 않습니다.')
    if not guardian:
        result.update(location_consent=bool(row['location_consent']),latitude=row['latitude'],longitude=row['longitude'],location_at=row['location_at'])
    return result


@router.post('/sessions',status_code=201)
def create(payload:CareCreate):
    if not payload.consent:
        raise HTTPException(422,'웹 활동 기록 동의가 필요합니다.')
    owner,guardian=secrets.token_urlsafe(32),secrets.token_urlsafe(32)
    now=time.time()
    with connect() as connection:
        cursor=connection.execute('''INSERT INTO care_sessions(name,owner_hash,guardian_hash,idle_hours,start_hour,end_hour,location_consent,last_seen,last_activity,last_state)
             VALUES(?,?,?,?,?,?,?,?,?,?)''',(payload.name,digest(owner),digest(guardian),payload.idle_hours,payload.start_hour,payload.end_hour,payload.location_consent,now,now,'connected'))
        row=dict(connection.execute('SELECT * FROM care_sessions WHERE id=?',(cursor.lastrowid,)).fetchone())
    return {'owner_token':owner,'guardian_token':guardian,**view(row)}

@router.get('/status')
def owner_status(authorization:str=Header(default='')):
    return view(authorize(authorization))

@router.get('/guardian')
def guardian_status(authorization:str=Header(default='')):
    return view(authorize(authorization,guardian=True),guardian=True)

@router.post('/heartbeat')
def heartbeat(payload:CareHeartbeat,authorization:str=Header(default='')):
    row=authorize(authorization);now=time.time()
    if not row['enabled']:
        raise HTTPException(409,'중지한 생활 확인입니다. 다시 시작하려면 새로 동의하세요.')
    if (payload.latitude is None)!=(payload.longitude is None):
        raise HTTPException(422,'위도와 경도를 함께 보내세요.')
    if payload.latitude is not None and not row['location_consent']:
        raise HTTPException(403,'위치 기록에 동의하지 않았습니다.')
    if payload.last_activity is not None and payload.last_activity>now+5:
        raise HTTPException(422,'활동 시간은 미래로 설정할 수 없습니다.')
    with connect() as connection:
        connection.execute('UPDATE care_sessions SET last_seen=?,last_activity=MAX(last_activity,?) WHERE id=?',(now,payload.last_activity or row['last_activity'],row['id']))
        if payload.latitude is not None:
            connection.execute('UPDATE care_sessions SET latitude=?,longitude=?,location_at=? WHERE id=?',(payload.latitude,payload.longitude,now,row['id']))
    return view(row)

@router.post('/stop')
def stop(authorization:str=Header(default='')):
    row=authorize(authorization)
    with connect() as connection:
        connection.execute("UPDATE care_sessions SET enabled=0,latitude=NULL,longitude=NULL,location_at=NULL,last_state='paused' WHERE id=?",(row['id'],))
    return view(row)
