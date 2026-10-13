import io
import asyncio
import hashlib
import json
import logging
import sqlite3
import uuid
import warnings
from contextlib import asynccontextmanager
from typing import Annotated, Literal
from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image, ImageOps, UnidentifiedImageError
from starlette.concurrency import run_in_threadpool
from .config import CORS_ORIGINS, MAX_UPLOAD_BYTES, UPLOAD_DIR
from .db import connect, init_db
from .detection import detect_mock, detect_image, infer_space, mode, status as detector_status, DetectionUnavailable
from .explanation import explain, provider_status
from .models import CompareRequest, ResolutionRequest, SpaceCreate, SpaceType, TargetCreate, TargetType
from .risk import evaluate, safety_score, score_policy
from .improvements import enrich, available_checks
from .models import FieldChecksRequest, GuideTaskRequest
from .watch import router as care_router, check_alerts
from .electrical import detect as detect_electrical, status as electrical_status, ElectricalUnavailable
from .reference_verifier import status as reference_verifier_status
from .interior import InteriorPlan, get_plan, save_plan, generate_preview, provider_status as interior_provider_status
from .seed import SPACE_LABELS, TARGET_LABELS

logger = logging.getLogger(__name__)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

@asynccontextmanager
async def lifespan(app):
    init_db()
    async def watch_loop():
        while True:
            try:
                await run_in_threadpool(check_alerts)
            except sqlite3.Error:
                logger.warning('Care check deferred: database unavailable.')
            await asyncio.sleep(60)
    worker = asyncio.create_task(watch_loop())
    try:
        yield
    finally:
        worker.cancel()
        try:
            await worker
        except asyncio.CancelledError:
            pass

app = FastAPI(title='앗차차 생활안전 MVP', version='0.2.0', lifespan=lifespan)
app.include_router(care_router)
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_credentials=False, allow_methods=['GET', 'POST', 'PATCH'], allow_headers=['Content-Type','Authorization'])
app.mount('/uploads', StaticFiles(directory=UPLOAD_DIR), name='uploads')

@app.exception_handler(sqlite3.Error)
async def database_error(request, error):
    logger.exception('Database operation failed')
    return JSONResponse(status_code=503, content={'detail': '데이터 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.'})

@app.get('/api/health')
def health():
    with connect() as connection:
        count = connection.execute('SELECT COUNT(*) FROM risk_rules').fetchone()[0]
    detection, electrical = detector_status(), electrical_status()
    if detection['detection_mode'] == 'yolo' and electrical['enabled']:
        detection['model_ready'] = detection['model_ready'] and electrical['ready']
    return {'status': 'ok', **detection, 'risk_rule_count': count, 'explanation': provider_status(), 'electrical_detection': electrical, 'reference_verifier':reference_verifier_status(), 'interior_image':interior_provider_status()}

@app.get('/api/options')
def options():
    return {'targets': TARGET_LABELS, 'spaces': SPACE_LABELS, **detector_status(), 'explanation': provider_status(), 'electrical_detection': electrical_status()}

@app.get('/api/targets')
def list_targets():
    with connect() as connection:
        return [dict(row) for row in connection.execute('SELECT * FROM targets ORDER BY id DESC')]

@app.post('/api/targets', status_code=201)
def create_target(payload: TargetCreate):
    with connect() as connection:
        cursor = connection.execute('INSERT INTO targets(name,target_type,age,memo) VALUES (?,?,?,?)', (payload.name, payload.target_type, payload.age, payload.memo))
        return dict(connection.execute('SELECT * FROM targets WHERE id=?', (cursor.lastrowid,)).fetchone())

@app.get('/api/spaces')
def list_spaces():
    with connect() as connection:
        return [dict(row) for row in connection.execute('SELECT * FROM spaces ORDER BY id DESC')]

@app.post('/api/spaces', status_code=201)
def create_space(payload: SpaceCreate):
    with connect() as connection:
        cursor = connection.execute('INSERT INTO spaces(name,space_type) VALUES (?,?)', (payload.name, payload.space_type))
        return dict(connection.execute('SELECT * FROM spaces WHERE id=?', (cursor.lastrowid,)).fetchone())

def get_scan(scan_id: int):
    with connect() as connection:
        row = connection.execute('SELECT * FROM scans WHERE id=?', (scan_id,)).fetchone()
        if row is None:
            raise HTTPException(404, '점검 기록을 찾을 수 없습니다.')
        result = json.loads(row['result_json'])
        result.update(scan_id=row['id'], created_at=row['created_at'])
        states = {r['hazard_id']: bool(r['resolved']) for r in connection.execute('SELECT r.hazard_id,r.resolved FROM recommendations r JOIN hazards h ON h.id=r.hazard_id WHERE h.scan_id=?', (scan_id,))}
        for hazard in result['hazards']:
            hazard['resolved'] = states.get(hazard['id'], False)
        return enrich(result)

@app.get('/api/scans')
def history(limit: Annotated[int, Query(ge=1, le=100)] = 30):
    with connect() as connection:
        rows = connection.execute('SELECT id,created_at,result_json FROM scans ORDER BY id DESC LIMIT ?', (limit,)).fetchall()
    return [dict(scan_id=row['id'], created_at=row['created_at'], score_computable=json.loads(row['result_json']).get('score_computable', True), **{k: json.loads(row['result_json'])[k] for k in ('target_type', 'space_type', 'space_name', 'safety_score', 'counts', 'image_url', 'scenario', 'detection_mode')}) for row in rows]

@app.get('/api/scans/{scan_id}')
def scan_detail(scan_id: int):
    return get_scan(scan_id)

@app.get('/api/scans/{scan_id}/hazards')
def scan_hazards(scan_id: int):
    return get_scan(scan_id)['hazards']

@app.post('/api/scans/{scan_id}/rescore')
def rescore(scan_id:int):
    scan=get_scan(scan_id)
    if scan['scoring']['version']==score_policy()['version']:return scan
    with connect() as con:
        row=con.execute('SELECT result_json FROM scans WHERE id=?',(scan_id,)).fetchone()
        stored=json.loads(row[0])
        stored['original_scoring']={'score':stored['safety_score'],'policy':scan['scoring']}
        stored['scoring']=score_policy()
        stored['safety_score']=safety_score(stored['hazards']) if stored['hazards'] else None
        con.execute('UPDATE scans SET result_json=?,safety_score=? WHERE id=?',(json.dumps(stored,ensure_ascii=False),stored['safety_score'],scan_id))
    return get_scan(scan_id)

@app.get('/api/scans/{scan_id}/interior')
def interior_detail(scan_id:int):return get_plan(get_scan(scan_id))

@app.patch('/api/scans/{scan_id}/interior')
def interior_save(scan_id:int,payload:InteriorPlan):return save_plan(get_scan(scan_id),payload)

@app.post('/api/scans/{scan_id}/interior/preview')
async def interior_preview(scan_id:int, consent:Annotated[bool,Form()], file:Annotated[UploadFile | None,File()]=None):
    if not consent:raise HTTPException(422,'사진을 Gemini 이미지 생성 API로 전송하는 동의가 필요합니다.')
    scan=get_scan(scan_id);plan=get_plan(scan)
    if file is not None:
        try:content=await file.read(MAX_UPLOAD_BYTES+1)
        finally:await file.close()
    elif scan.get('image_url'):
        path=UPLOAD_DIR/scan['image_url'].rsplit('/',1)[-1]
        if not path.is_file():raise HTTPException(404,'저장한 원본 사진이 없습니다. 다시 선택하세요.')
        content=await run_in_threadpool(path.read_bytes)
    else:raise HTTPException(422,'원본 사진을 다시 선택하세요. 저장 동의가 없는 사진은 서버에 보관하지 않습니다.')
    if len(content)>MAX_UPLOAD_BYTES:raise HTTPException(413,'원본 사진은 8MB 이하로 선택하세요.')
    _,_,normalized=await run_in_threadpool(validate_image,content)
    if file is None:normalized=content
    raw=await generate_preview(scan,plan,normalized)
    _,_,edited=await run_in_threadpool(validate_image,raw)
    import base64
    return {'concept':plan['selected_concept'],'image_data_url':'data:image/jpeg;base64,'+base64.b64encode(edited).decode(),
            'generated':True,'persisted':False,'notice':'AI가 만든 예상 모습입니다. 치수·가구 고정·개선 완료를 증명하지 않으며 안전점수는 바뀌지 않습니다. 이미지는 서버에 저장하지 않습니다.'}

@app.patch('/api/hazards/{hazard_id}/resolution')
def resolve_hazard(hazard_id: int, payload: ResolutionRequest):
    with connect() as connection:
        cursor = connection.execute("UPDATE recommendations SET resolved=?, resolved_at=CASE WHEN ? THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE NULL END WHERE hazard_id=?", (payload.resolved, payload.resolved, hazard_id))
        if cursor.rowcount == 0:
            raise HTTPException(404, '위험요소를 찾을 수 없습니다.')
    return {'hazard_id': hazard_id, 'resolved': payload.resolved, 'notice': '완료 표시는 체크리스트이며 안전점수는 재점검 시 계산합니다.'}

@app.post('/api/scans/{scan_id}/compare')
def compare(scan_id: int, payload: CompareRequest):
    current, previous = get_scan(scan_id), get_scan(payload.previous_scan_id)
    if payload.previous_scan_id >= scan_id:
        raise HTTPException(400, '현재 점검보다 이전의 기록을 선택하세요.')
    if any(current[k] != previous[k] for k in ('target_type', 'space_type', 'space_id', 'target_id')) or current['space_name'] != previous['space_name']:
        raise HTTPException(400, '같은 대상자·공간의 기록만 비교할 수 있습니다.')
    if current['detection_mode'] != previous['detection_mode']:
        raise HTTPException(400, '실제 분석과 Mock 기록은 서로 비교할 수 없습니다.')
    same_policy=current['scoring']['version']==previous['scoring']['version']
    scores_available = same_policy and current['safety_score'] is not None and previous['safety_score'] is not None
    old_checks = {c['key'] for c in previous['field_checks'] if c['status'] == 'risk'}
    new_checks = {c['key'] for c in current['field_checks'] if c['status'] == 'risk'}
    old = {(h['object'], h['condition']) for h in previous['hazards']}
    new = {(h['object'], h['condition']) for h in current['hazards']}
    return {'previous_scan_id': payload.previous_scan_id, 'current_scan_id': scan_id,
            'field_check_comparison': {'before_confirmed':len(old_checks),'after_confirmed':len(new_checks),
              'removed':sorted(old_checks-new_checks),'added':sorted(new_checks-old_checks),
              'notice':'직접 점검 항목은 각 촬영 기록에서 다시 확인해야 합니다. 미확인은 개선 완료가 아닙니다.'},
            'same_image': current.get('image_digest') == previous.get('image_digest') if current.get('image_digest') else False,
            'before_score': previous['safety_score'], 'after_score': current['safety_score'],
            'score_comparable': scores_available,
            'score_notice': '' if same_policy else '점수 산정 기준이 달라 점수 변화는 비교하지 않습니다.',
            'score_change': current['safety_score'] - previous['safety_score'] if scores_available else None,
            'before_hazards': len(previous['hazards']), 'after_hazards': len(current['hazards']),
            'removed': [h['object_label'] for h in previous['hazards'] if (h['object'], h['condition']) in old - new],
            'added': [h['object_label'] for h in current['hazards'] if (h['object'], h['condition']) in new - old],
            'notice': ('Mock 시나리오의 변화입니다. 실제 개선 여부를 판정한 결과가 아닙니다.' if current['detection_mode'] == 'mock' else '서로 다른 사진에서 탐지된 항목을 비교합니다. 촬영 각도·가림·탐지 오차에 따라 달라질 수 있으며 실제 개선을 확정하지 않습니다.')}

def validate_image(content: bytes):
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(content)) as image:
                if image.format not in ('JPEG', 'PNG', 'WEBP'):
                    raise HTTPException(415, 'JPG, PNG, WebP 이미지를 사용하세요.')
                if image.width * image.height > 24_000_000:
                    raise HTTPException(413, '이미지는 2,400만 화소 이하로 올려 주세요.')
                image.load()
                normalized = ImageOps.exif_transpose(image).convert('RGB')
                output = io.BytesIO()
                normalized.save(output, format='JPEG', quality=90)
                return normalized.width, normalized.height, output.getvalue()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise HTTPException(415, '이미지를 읽을 수 없습니다. 정상적인 JPG, PNG, WebP 파일을 선택하세요.')

def persist_result(result: dict, target_id: int | None, space_id: int | None):
    with connect() as connection:
        cursor = connection.execute('''INSERT INTO scans(space_id,target_id,target_type,space_type,image_url,safety_score,detection_mode,scenario,result_json)
            VALUES (?,?,?,?,?,?,?,?,?)''', (space_id, target_id, result['target_type'], result['space_type'], result['image_url'], result['safety_score'], result['detection_mode'], result['scenario'], '{}'))
        scan_id = cursor.lastrowid
        for hazard in result['hazards']:
            x, y, width, height = hazard['bbox']
            cursor = connection.execute('''INSERT INTO hazards(scan_id,hazard_type,object_name,risk_level,confidence,bbox_x,bbox_y,bbox_width,bbox_height,description)
                VALUES (?,?,?,?,?,?,?,?,?,?)''', (scan_id, hazard['risk_type'], hazard['object'], hazard['risk_level'], hazard['confidence'], x, y, width, height, hazard['description']))
            hazard['id'] = cursor.lastrowid
            connection.execute('INSERT INTO recommendations(hazard_id,accident_type,recommendation_text) VALUES (?,?,?)', (hazard['id'], hazard['risk_type'], hazard['recommendation']))
        connection.execute('UPDATE scans SET result_json=? WHERE id=?', (json.dumps(result, ensure_ascii=False), scan_id))
    return get_scan(scan_id)

@app.post('/api/analyze/image', status_code=201)
@app.post('/api/scans', status_code=201)
async def analyze_image(
    file: Annotated[UploadFile, File()],
    target_type: Annotated[TargetType, Form()],
    space_type: Annotated[SpaceType | Literal['auto'], Form()],
    space_name: Annotated[str, Form(min_length=1, max_length=80)] = '우리집',
    scenario: Annotated[Literal['baseline', 'improved'], Form()] = 'baseline',
    save_image: Annotated[bool, Form()] = False,
    target_id: Annotated[int | None, Form(gt=0)] = None,
    space_id: Annotated[int | None, Form(gt=0)] = None,
):
    space_name = space_name.strip()
    if not space_name:
        await file.close()
        raise HTTPException(422, '공간 이름을 입력하세요.')
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    await file.close()
    if not content:
        raise HTTPException(400, '이미지 파일을 선택하세요.')
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, f'이미지는 {MAX_UPLOAD_BYTES // (1024 * 1024)}MB 이하로 올려 주세요.')
    width, height, normalized = await run_in_threadpool(validate_image, content)
    detection_mode = mode()
    if detection_mode == 'yolo':
        try:
            detections = await run_in_threadpool(detect_image, normalized)
            detections += await run_in_threadpool(detect_electrical, normalized)
        except (DetectionUnavailable, ElectricalUnavailable) as exc:
            raise HTTPException(503, str(exc))
        inferred_space, space_confidence = infer_space(detections)
    elif detection_mode == 'mock':
        if space_type == 'auto':
            raise HTTPException(422, 'Mock 점검에서는 공간 종류를 직접 선택하세요.')
        detections = detect_mock(space_type, scenario)
        inferred_space, space_confidence = None, None
    else:
        raise HTTPException(503, '지원하지 않는 탐지 설정입니다.')
    space_source = 'user_selected'
    if space_type == 'auto':
        if inferred_space is None:
            raise HTTPException(422, '사진에서 공간 종류를 추정하기 어렵습니다. 거실·침실 등 공간을 직접 선택해 다시 점검하세요.')
        space_type = inferred_space
        space_source = 'object_heuristic'
    with connect() as connection:
        for table, identity, field, expected in [('targets', target_id, 'target_type', target_type), ('spaces', space_id, 'space_type', space_type)]:
            if identity is not None:
                row = connection.execute(f'SELECT * FROM {table} WHERE id=?', (identity,)).fetchone()
                if row is None:
                    raise HTTPException(404, '대상자 또는 공간을 찾을 수 없습니다.')
                if row[field] != expected:
                    raise HTTPException(400, '선택한 유형이 저장된 대상자 또는 공간과 다릅니다.')
                if table == 'spaces':
                    space_name = row['name']
    hazards = evaluate(detections, target_type, space_type)
    hazards.sort(key=lambda h: {'HIGH':0, 'MEDIUM':1, 'LOW':2}[h['risk_level']])
    explanation = await explain(hazards, target_type, space_type, detection_mode)
    image_url = None
    stored_path = None
    if save_image:
        stored_path = UPLOAD_DIR / f'{uuid.uuid4().hex}.jpg'
        await run_in_threadpool(stored_path.write_bytes, normalized)
        image_url = f'/uploads/{stored_path.name}'
    result = {'target_type': target_type, 'target_id': target_id, 'space_type': space_type,
              'space_id': space_id, 'space_name': space_name, 'space_source': space_source,
              'space_confidence': space_confidence if space_source == 'object_heuristic' else None,
              'detection_mode': detection_mode, 'scenario': scenario if detection_mode == 'mock' else 'actual',
              'detected_objects': detections, 'detectors': ['yolo_coco'] + (['grounding_dino_electrical'] if electrical_status()['enabled'] and detection_mode == 'yolo' else []), 'score_computable': bool(hazards),
              'image_digest': hashlib.sha256(normalized).hexdigest(), 'image_url': image_url,
              'image_width': width, 'image_height': height, 'bbox_format': 'normalized_xywh',
              'safety_score': safety_score(hazards) if hazards else None, 'scoring':score_policy(), 'hazards': hazards,
              'counts': {level: sum(h['risk_level'] == level for h in hazards) for level in ('HIGH', 'MEDIUM', 'LOW')},
              'explanation': explanation,
              'notice': ('Mock 모드: 사진 내용은 인식하지 않습니다. 위치·조건·점수는 예시입니다.' if detection_mode == 'mock' else '일반 객체와 전선·콘센트·멀티탭을 로컬 탐지 모델로 분석합니다. 점수는 사진 확인 항목·DB 규칙에 한정한 참고값입니다. 물기·손상·과부하·실제 높이·통로 폭은 사진으로 확정할 수 없습니다. 탐지되지 않은 항목도 직접 확인하세요.')}
    try:
        return await run_in_threadpool(persist_result, result, target_id, space_id)
    except Exception:
        if stored_path is not None:
            stored_path.unlink(missing_ok=True)
        raise


@app.get('/api/risk-catalog')
def risk_catalog(target_type: TargetType, space_type: SpaceType):
    from .seed import OBJECT_LABELS
    return [{'key':rule['object_type'], 'label':OBJECT_LABELS[rule['object_type']], 'question':rule['reason'],
             'risk_level':rule['risk_level'], 'source':'user_confirmation'} for rule in available_checks(target_type,space_type)]

@app.patch('/api/scans/{scan_id}/field-checks')
def save_field_checks(scan_id: int, payload: FieldChecksRequest):
    scan = get_scan(scan_id)
    allowed = {item['key'] for item in scan['field_checks']}
    keys = [item.key for item in payload.items]
    if len(keys) != len(set(keys)) or not set(keys).issubset(allowed):
        raise HTTPException(422, '이 공간의 점검 항목을 중복 없이 선택하세요.')
    with connect() as connection:
        for item in payload.items:
            connection.execute("""INSERT INTO scan_checks(scan_id,object_type,status,note) VALUES(?,?,?,?)
              ON CONFLICT(scan_id,object_type) DO UPDATE SET status=excluded.status,note=excluded.note,
              updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')""", (scan_id,item.key,item.status,item.note))
    return get_scan(scan_id)

@app.patch('/api/scans/{scan_id}/guide-tasks')
def save_guide_task(scan_id: int, payload: GuideTaskRequest):
    scan = get_scan(scan_id)
    allowed = {step['key'] for step in scan['interior_guide']['steps']}
    if payload.key not in allowed:
        raise HTTPException(422, '현재 점검의 개선 항목을 선택하세요.')
    with connect() as connection:
        connection.execute('INSERT INTO guide_tasks(scan_id,task_key,completed) VALUES(?,?,?) ON CONFLICT(scan_id,task_key) DO UPDATE SET completed=excluded.completed', (scan_id,payload.key,payload.completed))
    return get_scan(scan_id)

@app.get('/api/scans/{scan_id}/report')
def scan_report(scan_id: int, format: Literal['json','html'] = 'json'):
    # Download only this scan. No API credentials, coordinates or other users' records.
    scan = get_scan(scan_id)
    if format == 'html':
        from .improvements import render_report
        from fastapi.responses import HTMLResponse
        return HTMLResponse(render_report(scan), headers={'Content-Disposition':f'attachment; filename="atchacha-scan-{scan_id}.html"'})
    payload = {k:scan[k] for k in ('scan_id','created_at','target_type','space_type','space_name','safety_score','counts','detection_mode','hazards','field_checks','field_check_summary','interior_guide','notice')}
    from fastapi.responses import Response
    return Response(json.dumps(payload,ensure_ascii=False,indent=2), media_type='application/json',
                    headers={'Content-Disposition':f'attachment; filename="atchacha-scan-{scan_id}.json"'})
