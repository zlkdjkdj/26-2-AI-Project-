"""User-confirmed improvement workflow, independent of detection and scoring."""
import json
import uuid
from datetime import date, datetime
from zoneinfo import ZoneInfo
from typing import Literal
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from .db import connect

router = APIRouter(prefix='/api/scans/{scan_id}/safety', tags=['안전관리'])
STATES = Literal['observed', 'planned', 'in_progress', 'completed', 'verified', 'dismissed']
NOTICE = '사용자가 기록한 개선 상태입니다. 탐지·위험등급·기존 완료 표시·안전점수는 변경하지 않으며, 재확인은 안전 인증이 아닙니다.'

class Update(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    version: int = Field(ge=0)
    status: STATES = 'observed'
    assessment: Literal['unknown', 'risk', 'clear'] = 'unknown'
    action: str = Field(default='', max_length=600)
    assignee: str = Field(default='', max_length=60)
    due_date: date | None = None
    note: str = Field(default='', max_length=1000)
    confirm_recheck: bool = False

class Manual(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    title: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=1, max_length=600)
    risk_level: Literal['HIGH', 'MEDIUM', 'LOW'] = 'MEDIUM'

def load(con, scan_id):
    row = con.execute('SELECT result_json FROM scans WHERE id=?', (scan_id,)).fetchone()
    if not row:
        raise HTTPException(404, '점검 기록을 찾을 수 없습니다.')
    scan = json.loads(row[0])
    tasks = {}
    for h in scan['hazards']:
        key = f"hazard-{h['id']}"
        tasks[key] = dict(key=key, source='photo', hazard_id=h['id'], title=h.get('instance_label') or h['object_label'],
            description=h['description'], risk_level=h['risk_level'], status='observed', assessment='unknown',
            action=h.get('recommendation', ''), assignee='', due_date=None, note='', version=0, updated_at=None)
    for row in con.execute('SELECT * FROM safety_tasks WHERE scan_id=?', (scan_id,)):
        data = json.loads(row['data_json'])
        # Photo identity and severity are always derived from the original scan.
        if row['task_key'] in tasks:
            tasks[row['task_key']].update({k: data[k] for k in ('status','assessment','action','assignee','due_date','note')})
        elif data.get('source') == 'manual':
            tasks[row['task_key']] = data
        else:
            continue
        tasks[row['task_key']].update(version=row['version'], updated_at=row['updated_at'])
    return tasks

@router.get('')
def board(scan_id: int):
    today = datetime.now(ZoneInfo('Asia/Seoul')).date().isoformat()
    with connect() as con:
        tasks = list(load(con, scan_id).values())
        events = [dict(id=r['id'], key=r['task_key'], at=r['created_at'], **json.loads(r['snapshot_json']))
            for r in con.execute('SELECT * FROM safety_events WHERE scan_id=? ORDER BY id DESC LIMIT 100', (scan_id,))]
    rank = {'HIGH': 0, 'MEDIUM': 1, 'LOW': 2}
    for task in tasks:
        task['overdue'] = bool(task['due_date'] and task['due_date'] < today and task['status'] not in ('verified','dismissed'))
    tasks.sort(key=lambda t: (t['status'] in ('verified','dismissed'), not t['overdue'], rank[t['risk_level']], t['key']))
    return dict(tasks=tasks, events=events, today=today, notice=NOTICE)

def persist(con, scan_id, task, version, before):
    stamp = datetime.now(ZoneInfo('UTC')).isoformat()
    data = {k:v for k,v in task.items() if k not in ('version','updated_at','overdue')}
    con.execute('INSERT INTO safety_tasks(scan_id,task_key,data_json,version,updated_at) VALUES(?,?,?,?,?) '
        'ON CONFLICT(scan_id,task_key) DO UPDATE SET data_json=excluded.data_json,version=excluded.version,updated_at=excluded.updated_at',
        (scan_id, task['key'], json.dumps(data, ensure_ascii=False), version+1, stamp))
    snapshot = dict(title=task['title'], before=before, status=task['status'], assessment=task['assessment'],
        note=task['note'], action=task['action'], due_date=task['due_date'], assignee=task['assignee'])
    con.execute('INSERT INTO safety_events(scan_id,task_key,snapshot_json,created_at) VALUES(?,?,?,?)',
        (scan_id, task['key'], json.dumps(snapshot, ensure_ascii=False), stamp))

@router.post('', status_code=201)
def add(scan_id: int, payload: Manual):
    with connect() as con:
        con.execute('BEGIN IMMEDIATE')
        tasks = load(con, scan_id)
        if sum(t['source']=='manual' for t in tasks.values()) >= 50:
            raise HTTPException(400, '직접 등록 항목은 점검당 최대 50개입니다.')
        task = dict(key='manual-'+uuid.uuid4().hex, source='manual', hazard_id=None, **payload.model_dump(),
            status='observed', assessment='unknown', action='', assignee='', due_date=None, note='')
        persist(con, scan_id, task, 0, None)
    return board(scan_id)

@router.patch('/{task_key}')
def update(scan_id: int, task_key: str, payload: Update):
    with connect() as con:
        con.execute('BEGIN IMMEDIATE')
        task = load(con, scan_id).get(task_key)
        if not task:
            raise HTTPException(404, '이 점검의 관리 항목을 찾을 수 없습니다.')
        if task['version'] != payload.version:
            raise HTTPException(409, '다른 화면에서 변경된 항목입니다. 새로고침 후 다시 저장하세요.')
        if payload.status in ('planned','in_progress','completed','verified') and not payload.action:
            raise HTTPException(422, '실행할 개선 방법을 입력하세요.')
        if payload.status in ('completed','verified') and payload.assessment != 'risk':
            raise HTTPException(422, '현장에서 위험 조건을 확인한 항목만 조치 완료로 기록할 수 있습니다.')
        if payload.status == 'verified' and (task['status'] not in ('completed','verified') or not payload.confirm_recheck or not payload.note):
            raise HTTPException(422, '먼저 조치 완료를 저장한 뒤 현장을 다시 확인하고 재확인 메모와 확인 체크를 남겨 주세요.')
        if payload.status == 'dismissed' and (payload.assessment != 'clear' or not payload.note):
            raise HTTPException(422, '해당 없음은 현장 확인 결과와 이유를 메모해야 합니다.')
        before = task['status']
        task.update(payload.model_dump(mode='json', exclude={'version','confirm_recheck'}))
        persist(con, scan_id, task, payload.version, before)
    return board(scan_id)
