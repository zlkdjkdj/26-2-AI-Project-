import io
import json
import pytest
import httpx
from fastapi.testclient import TestClient
from PIL import Image
from app import db, main
from app.risk import evaluate, safety_score
from app.detection import detect_mock
from app import explanation

@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(db, 'DATABASE_PATH', tmp_path / 'test.db')
    monkeypatch.setattr(main, 'UPLOAD_DIR', tmp_path / 'uploads')
    main.UPLOAD_DIR.mkdir()
    monkeypatch.setenv('DETECTION_MODE', 'mock')
    monkeypatch.setenv('ELECTRICAL_DETECTION_ENABLED', 'false')
    monkeypatch.setenv('LLM_PROVIDER', 'openai')
    monkeypatch.delenv('GEMINI_API_KEY', raising=False)
    monkeypatch.delenv('OPENAI_API_KEY', raising=False)
    with TestClient(main.app) as client:
        yield client

@pytest.fixture
def image():
    stream = io.BytesIO()
    Image.new('RGB', (400, 300), 'white').save(stream, format='PNG')
    return stream.getvalue()

def analyze(client, image, **overrides):
    data = dict(target_type='elderly', space_type='living_room', space_name='우리집', scenario='baseline')
    data.update(overrides)
    return client.post('/api/analyze/image', data=data, files={'file': ('room.png', image, 'image/png')})

def test_seed_is_idempotent_and_pdf_rules(client):
    before = client.get('/api/health').json()['risk_rule_count']
    db.init_db()
    assert client.get('/api/health').json()['risk_rule_count'] == before
    assert before > 100
    with db.connect() as connection:
        stairs = connection.execute("SELECT risk_level,risk_type FROM risk_rules WHERE target_type='toddler' AND space_type='stairs' AND object_type='stairs'").fetchone()
        wheelchair = connection.execute("SELECT risk_level,risk_type FROM risk_rules WHERE target_type='wheelchair' AND space_type='hallway' AND object_type='obstacle'").fetchone()
    assert tuple(stairs) == ('HIGH', 'fall_from_height')
    assert tuple(wheelchair) == ('MEDIUM', 'blocked_movement')

def test_full_upload_history_resolution_and_compare(client, image):
    response = analyze(client, image)
    assert response.status_code == 201, response.text
    before = response.json()
    assert before['safety_score'] == 33
    assert before['counts'] == {'HIGH': 2, 'MEDIUM': 1, 'LOW': 1}
    assert before['image_url'] is None
    assert list(main.UPLOAD_DIR.iterdir()) == []
    assert before['detection_mode'] == 'mock'
    assert before['space_source'] == 'user_selected'
    assert before['explanation']['mode'] == 'rule_template'
    assert len(client.get(f"/api/scans/{before['scan_id']}/hazards").json()) == 4
    for hazard in before['hazards']:
        x, y, width, height = hazard['bbox']
        assert 0 <= x < x + width <= 1 and 0 <= y < y + height <= 1
    hazard_id = before['hazards'][0]['id']
    assert client.patch(f'/api/hazards/{hazard_id}/resolution', json={'resolved': True}).status_code == 200
    fetched = client.get(f"/api/scans/{before['scan_id']}").json()
    assert fetched['hazards'][0]['resolved'] is True
    assert fetched['safety_score'] == 33
    after = analyze(client, image, scenario='improved').json()
    comparison = client.post(f"/api/scans/{after['scan_id']}/compare", json={'previous_scan_id': before['scan_id']}).json()
    assert comparison['after_score'] == 60 and comparison['score_change'] == 27
    assert set(comparison['removed']) == {'전선', '콘센트', '가구 모서리'}
    assert len(client.get('/api/scans').json()) == 2

def test_user_specific_risk_and_condition_matching(client):
    detections = detect_mock('living_room', 'baseline')
    elderly = evaluate(detections, 'elderly', 'living_room')
    toddler = evaluate(detections, 'toddler', 'living_room')
    assert next(h for h in elderly if h['object'] == 'socket')['risk_level'] == 'LOW'
    assert next(h for h in toddler if h['object'] == 'socket')['risk_level'] == 'HIGH'
    for detection in detections:
        detection['evidence'] = []
    assert evaluate(detections, 'elderly', 'living_room') == []
    assert safety_score([{'risk_level': 'HIGH'}] * 10) == 0
    assert safety_score([]) == 100

@pytest.mark.parametrize('target', ['newborn', 'toddler', 'elderly', 'wheelchair', 'limited_mobility'])
@pytest.mark.parametrize('space', ['living_room', 'bedroom', 'kitchen', 'bathroom', 'entrance', 'hallway', 'stairs'])
def test_all_target_space_combinations(client, image, target, space):
    response = analyze(client, image, target_type=target, space_type=space)
    assert response.status_code == 201
    assert response.json()['hazards']
    assert 0 <= response.json()['safety_score'] <= 100

def test_upload_errors(client, image, monkeypatch):
    assert analyze(client, b'not an image').status_code == 415
    assert analyze(client, b'').status_code == 400
    assert analyze(client, image, target_type='invalid').status_code == 422
    assert analyze(client, image, scenario='invalid').status_code == 422
    monkeypatch.setattr(main, 'MAX_UPLOAD_BYTES', 32)
    assert analyze(client, image).status_code == 413
    assert client.get('/api/scans').json() == []

def test_saved_image_is_reencoded_and_exif_free(client, image):
    response = analyze(client, image, save_image='true')
    assert response.status_code == 201
    path = main.UPLOAD_DIR / response.json()['image_url'].split('/')[-1]
    with Image.open(path) as saved:
        assert saved.format == 'JPEG'
        assert not saved.getexif()

def test_profiles_spaces_and_compare_rejection(client, image):
    target = client.post('/api/targets', json={'name': '부모님', 'target_type': 'elderly', 'age': 75}).json()
    space = client.post('/api/spaces', json={'name': '부모님 댁', 'space_type': 'living_room'}).json()
    assert len(client.get('/api/targets').json()) == 1
    assert len(client.get('/api/spaces').json()) == 1
    before = analyze(client, image, target_id=target['id'], space_id=space['id']).json()
    other = analyze(client, image, target_type='toddler').json()
    assert client.post(f"/api/scans/{other['scan_id']}/compare", json={'previous_scan_id': before['scan_id']}).status_code == 400
    assert client.post(f"/api/scans/{before['scan_id']}/compare", json={'previous_scan_id': before['scan_id']}).status_code == 400
    assert analyze(client, image, target_id=target['id'], target_type='toddler').status_code == 400
    assert analyze(client, image, space_id=999).status_code == 404
    assert client.get('/api/scans/999').status_code == 404
    assert client.patch('/api/hazards/999/resolution', json={'resolved': True}).status_code == 404

def test_llm_failure_falls_back(client, image, monkeypatch):
    monkeypatch.setenv('OPENAI_API_KEY', 'test-key-not-real')
    async def fail(*args, **kwargs):
        raise httpx.ConnectError('simulated offline')
    monkeypatch.setattr(httpx.AsyncClient, 'post', fail)
    response = analyze(client, image)
    assert response.status_code == 201
    assert response.json()['explanation']['mode'] == 'rule_template'
    assert '실패' in response.json()['explanation']['notice']

def test_llm_only_receives_rule_facts(client, image, monkeypatch):
    monkeypatch.setenv('OPENAI_API_KEY', 'test-key-not-real')
    async def success(self, url, **kwargs):
        payload = kwargs['json']
        assert payload['store'] is False
        assert isinstance(payload['input'], str)
        facts = json.loads(payload['input'])
        assert 'bbox' not in facts['hazards'][0]
        return httpx.Response(200, request=httpx.Request('POST', url), json={'status': 'completed', 'output': [{'type': 'message', 'content': [{'type': 'output_text', 'text': '모의 점검 결과입니다. 먼저 전선을 정리하세요.'}]}]})
    monkeypatch.setattr(httpx.AsyncClient, 'post', success)
    response = analyze(client, image)
    assert response.json()['explanation']['mode'] == 'openai'
    assert response.json()['safety_score'] == 33

def test_blank_names_rejected(client, image):
    assert analyze(client, image, space_name='   ').status_code == 422
    assert client.post('/api/targets', json={'name': '  ', 'target_type': 'elderly'}).status_code == 422
    assert client.post('/api/spaces', json={'name': '  ', 'space_type': 'living_room'}).status_code == 422

def test_improved_mock_retains_remaining_object_position(client):
    before = detect_mock('living_room', 'baseline')
    after = detect_mock('living_room', 'improved')
    assert after == before[-1:]

# These tests run the downloaded ONNX model, not a replacement detector.
from pathlib import Path
from app.detection import detect_image, infer_space, evidence_for

REAL_IMAGE = Path(__file__).parent / 'fixtures/indoor.jpg'

def test_real_detection_changes_with_image_and_never_uses_scenario(client, image, monkeypatch):
    monkeypatch.setenv('DETECTION_MODE', 'yolo')
    photo = REAL_IMAGE.read_bytes()
    before = analyze(client, photo).json()
    assert before['detection_mode'] == 'yolo'
    assert before['scenario'] == 'actual'
    assert any(d['object_type'] == 'chair' for d in before['detected_objects'])
    assert any(h['object'] == 'chair' for h in before['hazards'])
    assert before['safety_score'] < 100
    after = analyze(client, photo, scenario='improved').json()
    assert after['detected_objects'] == before['detected_objects']
    assert after['safety_score'] == before['safety_score']
    blank = analyze(client, image).json()
    assert blank['detected_objects'] == []
    assert blank['hazards'] == []
    assert blank['safety_score'] is None
    assert blank['score_computable'] is False
    assert client.get(f"/api/scans/{blank['scan_id']}").json()['safety_score'] is None
    for detection in before['detected_objects']:
        x,y,width,height = detection['bbox']
        assert 0 <= x < x+width <= 1.000001
        assert 0 <= y < y+height <= 1.000001
        assert detection['evidence_source'] == 'yolo_image_geometry'
    comparison = client.post(f"/api/scans/{blank['scan_id']}/compare",json={'previous_scan_id':before['scan_id']}).json()
    assert comparison['score_comparable'] is False
    assert comparison['score_change'] is None

def test_real_auto_space_is_explicitly_heuristic(client, monkeypatch):
    monkeypatch.setenv('DETECTION_MODE','yolo')
    response = analyze(client,REAL_IMAGE.read_bytes(),space_type='auto')
    assert response.status_code == 201
    assert response.json()['space_source'] == 'object_heuristic'
    assert response.json()['space_type'] == 'living_room'
    assert response.json()['space_confidence'] < 1

def test_auto_space_unknown_does_not_invent_room(client,image,monkeypatch):
    monkeypatch.setenv('DETECTION_MODE','yolo')
    assert analyze(client,image,space_type='auto').status_code == 422
    assert client.get('/api/scans').json() == []

def test_missing_real_model_never_falls_back_to_mock(client,image,monkeypatch,tmp_path):
    monkeypatch.setenv('DETECTION_MODE','yolo')
    monkeypatch.setenv('YOLO_MODEL_PATH',str(tmp_path/'missing.onnx'))
    assert client.get('/api/health').json()['model_ready'] is False
    response = analyze(client,image)
    assert response.status_code == 503
    assert client.get('/api/scans').json() == []

def test_compare_real_and_mock_rejected(client,monkeypatch):
    photo = REAL_IMAGE.read_bytes()
    mock = analyze(client,photo).json()
    monkeypatch.setenv('DETECTION_MODE','yolo')
    actual = analyze(client,photo).json()
    response = client.post(f"/api/scans/{actual['scan_id']}/compare",json={'previous_scan_id':mock['scan_id']})
    assert response.status_code == 400

def test_image_geometry_does_not_claim_real_height_or_water():
    assert evidence_for('chair',[.3,.4,.3,.4]) == ['image_lower_center']
    assert evidence_for('knife',[.8,.1,.1,.1]) == ['visible_sharp_object']
    assert evidence_for('bottle',[.4,.7,.1,.1]) == []
    assert evidence_for('sink',[.1,.3,.5,.5]) == []
    assert infer_space([{'object_type':'refrigerator','confidence':.35}]) == (None,None)

def test_gemini_real_explanation_without_image_transmission(client,monkeypatch):
    monkeypatch.setenv('DETECTION_MODE','yolo')
    monkeypatch.setenv('LLM_PROVIDER','gemini')
    monkeypatch.setenv('GEMINI_API_KEY','test-key-not-real')
    monkeypatch.setenv('GEMINI_MODEL','gemini-3.1-flash-lite')
    async def success(self,url,**kwargs):
        assert url.endswith('/models/gemini-3.1-flash-lite:generateContent')
        assert kwargs['headers']['x-goog-api-key'] == 'test-key-not-real'
        payload = kwargs['json']
        assert 'inlineData' not in json.dumps(payload)
        assert 'image_url' not in json.dumps(payload)
        facts = json.loads(payload['contents'][0]['parts'][0]['text'])
        assert 'chair' not in [h['object_label'] for h in facts['hazards']]
        assert all('bbox' not in hazard for hazard in facts['hazards'])
        return httpx.Response(200,request=httpx.Request('POST',url),json={'candidates':[{'finishReason':'STOP','content':{'parts':[{'text':'사진 하단의 의자가 실제 이동 경로에 있다면 벽 쪽으로 옮겨주세요.'}]}}]})
    monkeypatch.setattr(httpx.AsyncClient,'post',success)
    result = analyze(client,REAL_IMAGE.read_bytes()).json()
    assert result['detection_mode'] == 'yolo'
    assert result['explanation']['mode'] == 'gemini'
    status = client.get('/api/health').json()
    assert status['explanation']['configured'] is True
    assert 'test-key-not-real' not in json.dumps(status)

@pytest.mark.parametrize('outcome',['quota','incomplete','blocked'])
def test_gemini_errors_fall_back_without_fake_response(client,image,monkeypatch,outcome):
    monkeypatch.setenv('LLM_PROVIDER','gemini')
    monkeypatch.setenv('GEMINI_API_KEY','test-key-not-real')
    async def response(self,url,**kwargs):
        if outcome == 'quota':
            return httpx.Response(429,request=httpx.Request('POST',url),json={'error':{'message':'quota'}})
        candidates = [] if outcome == 'blocked' else [{'finishReason':'MAX_TOKENS','content':{'parts':[{'text':'unfinished'}]}}]
        return httpx.Response(200,request=httpx.Request('POST',url),json={'candidates':candidates})
    monkeypatch.setattr(httpx.AsyncClient,'post',response)
    result = analyze(client,image).json()
    assert result['explanation']['mode'] == 'rule_template'
    assert '실패' in result['explanation']['notice']
    assert result['explanation']['summary'] != 'unfinished'

def test_sqlite_migration_preserves_existing_scan_and_foreign_keys(client,monkeypatch,tmp_path):
    import sqlite3
    old_path = tmp_path/'old.db'
    old = sqlite3.connect(old_path)
    old.executescript(db.SCHEMA.replace('safety_score INTEGER,','safety_score INTEGER NOT NULL,'))
    old.execute("INSERT INTO users(id,email,name) VALUES(1,'old@localhost','이전 사용자')")
    old.execute("INSERT INTO scans(id,target_type,space_type,safety_score,detection_mode,scenario,result_json) VALUES(1,'elderly','living_room',60,'mock','baseline','{}')")
    old.execute("INSERT INTO hazards(id,scan_id,hazard_type,object_name,risk_level,confidence,description) VALUES(1,1,'fall','electric_wire','HIGH',.9,'이전 위험')")
    old.execute("INSERT INTO recommendations(id,hazard_id,accident_type,recommendation_text) VALUES(1,1,'fall','이전 추천')")
    old.commit();old.close()
    monkeypatch.setattr(db,'DATABASE_PATH',old_path)
    db.init_db()
    with db.connect() as connection:
        assert connection.execute('SELECT safety_score FROM scans WHERE id=1').fetchone()[0] == 60
        assert connection.execute('SELECT scan_id FROM hazards WHERE id=1').fetchone()[0] == 1
        assert connection.execute('SELECT hazard_id FROM recommendations WHERE id=1').fetchone()[0] == 1
        assert connection.execute('PRAGMA foreign_key_check').fetchall() == []
        assert connection.execute('PRAGMA foreign_keys').fetchone()[0] == 1
        connection.execute('UPDATE scans SET safety_score=NULL WHERE id=1')


def test_field_checks_persist_and_guide_preserves_photo_score(client,image):
    scan = analyze(client,image).json()
    keys = {c['key'] for c in scan['field_checks']}
    assert {'cabinet','power_strip','electric_wire'} <= keys
    assert 'small_parts' not in keys
    response = client.patch(f"/api/scans/{scan['scan_id']}/field-checks",json={'items':[{'key':'cabinet','status':'risk','note':'벽 고정 없음'},{'key':'electric_wire','status':'clear'}]})
    assert response.status_code == 200
    updated = response.json()
    assert updated['safety_score'] == scan['safety_score']
    assert updated['field_check_summary']['combined_reference_score'] == scan['safety_score'] - 25
    assert updated['field_check_summary']['checked'] == 2
    step = next(s for s in updated['interior_guide']['steps'] if s['key']=='check:cabinet')
    assert step['bbox'] is None and step['source'] == 'user_confirmation'
    assert client.patch(f"/api/scans/{scan['scan_id']}/guide-tasks",json={'key':step['key'],'completed':True}).status_code == 200
    reopened = client.get(f"/api/scans/{scan['scan_id']}").json()
    assert next(s for s in reopened['interior_guide']['steps'] if s['key']==step['key'])['completed']
    assert reopened['safety_score'] == scan['safety_score']
    assert next(c for c in reopened['field_checks'] if c['key']=='cabinet')['note'] == '벽 고정 없음'
    cleared = client.patch(f"/api/scans/{scan['scan_id']}/field-checks",json={'items':[{'key':'cabinet','status':'unknown'}]}).json()
    assert not any(s['key']=='check:cabinet' for s in cleared['interior_guide']['steps'])


def test_checks_validate_atomic_update_and_room_scope(client,image):
    scan=analyze(client,image).json();url=f"/api/scans/{scan['scan_id']}/field-checks"
    assert client.patch(url,json={'items':[{'key':'electric_wire','status':'risk'},{'key':'bath_water','status':'risk'}]}).status_code==422
    assert client.get(f"/api/scans/{scan['scan_id']}").json()['field_check_summary']['checked']==0
    assert client.patch(url,json={'items':[{'key':'electric_wire','status':'safe'}]}).status_code==422
    assert client.patch(url,json={'items':[{'key':'electric_wire','status':'risk'},{'key':'electric_wire','status':'clear'}]}).status_code==422
    assert client.patch(url,json={'items':[{'key':'electric_wire','status':'risk','note':'x'*301}]}).status_code==422
    assert client.patch('/api/scans/999/field-checks',json={'items':[]}).status_code==404
    assert client.patch(f"/api/scans/{scan['scan_id']}/guide-tasks",json={'key':'invented','completed':True}).status_code==422


def test_new_rules_child_bathroom_and_coco_evidence(client):
    catalog=client.get('/api/risk-catalog?target_type=toddler&space_type=bathroom').json()
    assert next(c for c in catalog if c['key']=='bath_water')['risk_level']=='HIGH'
    assert next(c for c in catalog if c['key']=='grab_bar')['source']=='user_confirmation'
    assert client.get('/api/risk-catalog?target_type=invalid&space_type=bathroom').status_code==422
    for obj in ('tv','vase','oven','microwave','potted_plant'):
        detection={'object_type':obj,'evidence':evidence_for(obj,[.1,.1,.2,.2]),'bbox':[.1,.1,.2,.2],'confidence':.8,'evidence_source':'yolo_image_geometry'}
        hazards=evaluate([detection],'elderly','living_room')
        assert hazards and hazards[0]['risk_level']=='LOW'
        assert '확인' in hazards[0]['description']
    assert evidence_for('bottle',[.3,.7,.1,.1])==[]


def test_report_and_zones_do_not_invent_safe_areas(client,image):
    scan=analyze(client,image).json()
    assert len(scan['zones'])==len(scan['hazards'])
    assert all(zone['level'] in ('danger','caution') for zone in scan['zones'])
    report=client.get(f"/api/scans/{scan['scan_id']}/report")
    assert report.status_code==200 and 'attachment' in report.headers['content-disposition']
    body=report.json()
    assert body['scan_id']==scan['scan_id'] and 'field_checks' in body and 'interior_guide' in body
    assert 'API_KEY' not in report.text


def test_blank_photo_field_risk_without_fake_detection(client,image,monkeypatch):
    monkeypatch.setenv('DETECTION_MODE','yolo')
    scan=analyze(client,image).json()
    updated=client.patch(f"/api/scans/{scan['scan_id']}/field-checks",json={'items':[{'key':'cabinet','status':'risk'}]}).json()
    assert updated['safety_score'] is None and updated['detected_objects']==[]
    assert updated['field_check_summary']['combined_reference_score']==60
    assert updated['interior_guide']['steps'][0]['bbox'] is None
    second=analyze(client,image).json()
    comparison=client.post(f"/api/scans/{second['scan_id']}/compare",json={'previous_scan_id':scan['scan_id']}).json()
    assert comparison['field_check_comparison']['before_confirmed']==1
    assert comparison['field_check_comparison']['after_confirmed']==0
    assert '미확인' in comparison['field_check_comparison']['notice']


def test_care_consent_auth_roles_and_stop(client):
    payload={'name':'가족','consent':False,'start_hour':0,'end_hour':0}
    assert client.post('/api/care/sessions',json=payload).status_code==422
    payload['consent']=True
    session=client.post('/api/care/sessions',json=payload).json()
    owner={'Authorization':'Bearer '+session['owner_token']}
    guardian={'Authorization':'Bearer '+session['guardian_token']}
    assert client.get('/api/care/status').status_code==401
    assert client.get('/api/care/status',headers=guardian).status_code==401
    assert client.get('/api/care/guardian',headers=owner).status_code==401
    assert client.get('/api/care/guardian',headers=guardian).status_code==200
    assert client.post('/api/care/heartbeat',headers=guardian,json={}).status_code==401
    assert client.post('/api/care/heartbeat',headers=owner,json={'latitude':37,'longitude':127}).status_code==403
    assert client.post('/api/care/heartbeat',headers=owner,json={'latitude':37}).status_code==422
    import time
    assert client.post('/api/care/heartbeat',headers=owner,json={'last_activity':time.time()+100}).status_code==422
    body=client.get('/api/care/status',headers=owner).json()
    assert 'owner_token' not in body and 'guardian_token' not in body
    assert client.post('/api/care/stop',headers=owner).json()['enabled']==0
    assert client.post('/api/care/heartbeat',headers=owner,json={}).status_code==409
    assert client.get('/api/care/guardian',headers=guardian).json()['state']=='paused'


def test_care_inactivity_connection_loss_and_alert_dedup(client):
    import time
    from app.watch import check_alerts
    session=client.post('/api/care/sessions',json={'consent':True,'idle_hours':1,'start_hour':0,'end_hour':0}).json()
    owner={'Authorization':'Bearer '+session['owner_token']};guardian={'Authorization':'Bearer '+session['guardian_token']}
    now=time.time()
    with db.connect() as connection:
        connection.execute('UPDATE care_sessions SET last_activity=?,last_seen=?',(now-3700,now))
    updated=client.post('/api/care/heartbeat',json={},headers=owner).json()
    assert updated['state']=='inactive' # A heartbeat is not evidence of user activity.
    check_alerts();check_alerts()
    assert len(client.get('/api/care/guardian',headers=guardian).json()['alerts'])==1
    recovered=client.post('/api/care/heartbeat',json={'last_activity':time.time()},headers=owner).json()
    assert recovered['state']=='connected'
    with db.connect() as connection:
        connection.execute('UPDATE care_sessions SET last_seen=?',(now-400,))
    disconnected=client.get('/api/care/guardian',headers=guardian).json()
    assert disconnected['state']=='disconnected'
    assert len(disconnected['alerts'])==2
    assert '브라우저' in disconnected['message']


def test_care_location_owner_only_and_quiet_hours(client):
    import time
    from app.watch import in_window
    # Explicit timestamps at Seoul 23:00 and 12:00.
    from datetime import datetime
    from zoneinfo import ZoneInfo
    at=lambda hour:datetime(2026,10,1,hour,tzinfo=ZoneInfo('Asia/Seoul')).timestamp()
    assert in_window({'start_hour':22,'end_hour':6},at(23))
    assert not in_window({'start_hour':22,'end_hour':6},at(12))
    session=client.post('/api/care/sessions',json={'consent':True,'location_consent':True,'start_hour':0,'end_hour':0}).json()
    owner={'Authorization':'Bearer '+session['owner_token']};guardian={'Authorization':'Bearer '+session['guardian_token']}
    body=client.post('/api/care/heartbeat',headers=owner,json={'latitude':37.1,'longitude':127.2}).json()
    assert body['latitude']==37.1 and body['location_at']>0
    protected=client.get('/api/care/guardian',headers=guardian).json()
    assert not any(key in protected for key in ('latitude','longitude','location_at','owner_hash','owner_token'))
    stopped=client.post('/api/care/stop',headers=owner).json()
    assert stopped['latitude'] is None and stopped['longitude'] is None
    assert client.post('/api/care/heartbeat',headers=owner,json={'latitude':91,'longitude':127}).status_code==422



def test_html_report_escapes_user_content(client,image):
    scan=analyze(client,image,space_name='<script>alert(1)</script>').json()
    response=client.get(f"/api/scans/{scan['scan_id']}/report?format=html")
    assert response.status_code==200
    assert '<script>' not in response.text
    assert '&lt;script&gt;' in response.text
    assert '인테리어 개선 가이드' in response.text
    assert 'text/html' in response.headers['content-type']


def test_electrical_real_power_strip_and_blank(client,image,monkeypatch):
    from app.electrical import detect
    monkeypatch.setenv('ELECTRICAL_DETECTION_ENABLED','true')
    detections=detect((REAL_IMAGE.parent/'power-strip.jpg').read_bytes())
    assert any(d['object_type']=='power_strip' for d in detections)
    assert all(d['evidence_source']=='grounding_dino_image' for d in detections)
    assert not any('overloaded_power' in d['evidence'] for d in detections)
    for item in detections:
        x,y,w,h=item['bbox']
        assert 0<=x<x+w<=1.00001 and 0<=y<y+h<=1.00001
    assert detect(image)==[]


def test_electrical_missing_model_rejects_incomplete_scan(client,image,monkeypatch,tmp_path):
    monkeypatch.setenv('DETECTION_MODE','yolo')
    monkeypatch.setenv('ELECTRICAL_DETECTION_ENABLED','true')
    monkeypatch.setenv('ELECTRICAL_MODEL_DIR',str(tmp_path/'missing'))
    status=client.get('/api/health').json()
    assert not status['model_ready'] and not status['electrical_detection']['ready']
    assert analyze(client,image).status_code==503
    assert client.get('/api/scans').json()==[]


def test_electrical_overlapping_labels_choose_strongest_and_expose_ambiguity():
    from app.electrical import suppress
    box=[.2,.2,.2,.2]
    candidates=[{'object_type':'socket','object_label':'콘센트','confidence':.77,'bbox':box}, {'object_type':'power_strip','object_label':'멀티탭','confidence':.42,'bbox':box}]
    assert [d['object_type'] for d in suppress(candidates)]==['socket']
    candidates[1]['confidence']=.75
    result=suppress(candidates)
    assert result[0]['classification_uncertain'] and result[0]['alternative_labels']==['멀티탭']


def test_electrical_user_regression_when_photo_is_supplied(client,monkeypatch):
    import os
    path=os.getenv('ELECTRICAL_REGRESSION_IMAGE')
    if not path:
        pytest.skip('Private regression photo is provided only on the local machine.')
    from app.electrical import detect
    monkeypatch.setenv('ELECTRICAL_DETECTION_ENABLED','true')
    objects=detect(Path(path).read_bytes())
    assert sum(d['object_type']=='socket' for d in objects)==2
    wire=next(d for d in objects if d['object_type']=='electric_wire')
    assert wire['bbox'][1]>.6 and wire['bbox'][1]+wire['bbox'][3]>.9
    assert not any(d['object_type']=='power_strip' for d in objects)
    hazards=evaluate(objects,'elderly','living_room')
    assert len(hazards)==3
    assert next(h for h in hazards if h['object']=='electric_wire')['risk_level']=='MEDIUM'
    assert all('확인' in h['description'] for h in hazards)


def test_newborn_and_older_adult_field_checks_and_corner_molding(client):
    baby=client.get('/api/risk-catalog?target_type=newborn&space_type=bedroom').json()
    elder=client.get('/api/risk-catalog?target_type=elderly&space_type=bedroom').json()
    assert {'sleep_bedding','crib_cord','crib_gap','changing_surface','furniture_corner'}<={c['key'] for c in baby}
    assert {'bedside_light','unsupported_transfer','reaching_storage','furniture_corner'}<={c['key'] for c in elder}
    assert 'sleep_bedding' not in {c['key'] for c in elder}
    with db.connect() as con:
        rows=con.execute("SELECT supplement FROM risk_rules WHERE object_type='furniture_corner'").fetchall()
    assert all('몰딩' in row[0] for row in rows)


def test_score_caps_dedup_and_old_record_rescore(client,image):
    from app.risk import combined_score
    assert safety_score([{'risk_level':'HIGH'}])<=60
    assert safety_score([{'risk_level':'HIGH'}]*2)<=40
    assert safety_score([{'risk_level':'LOW'}])<=80
    photo=[{'object':'electric_wire','risk_level':'HIGH'}]
    assert combined_score(photo,[{'key':'electric_wire','risk_level':'HIGH'}])==safety_score(photo)
    scan=analyze(client,image).json()
    with db.connect() as con:
        old=json.loads(con.execute('SELECT result_json FROM scans WHERE id=?',(scan['scan_id'],)).fetchone()[0])
        old.pop('scoring');old['safety_score']=60
        con.execute('UPDATE scans SET result_json=?,safety_score=60 WHERE id=?',(json.dumps(old),scan['scan_id']))
    assert client.get(f"/api/scans/{scan['scan_id']}").json()['scoring']['version']=='v1'
    current=analyze(client,image).json()
    comparison=client.post(f"/api/scans/{current['scan_id']}/compare",json={'previous_scan_id':scan['scan_id']}).json()
    assert not comparison['score_comparable'] and comparison['score_change'] is None
    updated=client.post(f"/api/scans/{scan['scan_id']}/rescore").json()
    assert updated['safety_score']==33 and updated['original_scoring']['score']==60
    assert updated['image_digest']==scan['image_digest']
    assert client.post(f"/api/scans/{scan['scan_id']}/rescore").json()['original_scoring']==updated['original_scoring']


def test_interior_plan_stores_concept_and_validates_detected_furniture(client,image):
    scan=analyze(client,image).json()
    url=f"/api/scans/{scan['scan_id']}/interior"
    plan=client.get(url).json()
    assert len(plan['concepts'])==4 and plan['selected_concept'] is None
    assert plan['furniture']==[] # Mock hazard items aren't actual detected furniture.
    assert client.patch(url,json={'concept':'natural','placements':[{'id':'unknown','x':.5,'y':.5}]}).status_code==422
    saved=client.patch(url,json={'concept':'natural','placements':[],'room_width':4.2,'room_depth':3.5})
    assert saved.status_code==200 and saved.json()['selected_concept']=='natural'
    assert client.get(url).json()['room_width']==4.2
    assert client.get(f"/api/scans/{scan['scan_id']}").json()['safety_score']==scan['safety_score']
    assert client.patch(url,json={'concept':'unknown'}).status_code==422
    assert client.patch(url,json={'concept':'minimal','room_width':0}).status_code==422


def test_interior_generation_consent_configuration_identity_and_response(client,image,monkeypatch):
    import base64,hashlib
    from app import interior
    scan=analyze(client,image,save_image=True).json()
    # Exercise the real provider adapter with an isolated HTTP transport, no paid request.
    with db.connect() as con:
        stored=json.loads(con.execute('SELECT result_json FROM scans WHERE id=?',(scan['scan_id'],)).fetchone()[0])
        stored['detection_mode']='yolo'
        con.execute('UPDATE scans SET result_json=? WHERE id=?',(json.dumps(stored),scan['scan_id']))
    url=f"/api/scans/{scan['scan_id']}/interior"
    client.patch(url,json={'concept':'natural','placements':[]})
    monkeypatch.setenv('INTERIOR_IMAGE_ENABLED','true');monkeypatch.setenv('GEMINI_IMAGE_API_KEY','test-image-key')
    calls=[]
    async def upstream(self,url,**kwargs):
        calls.append(kwargs)
        assert kwargs['headers']['x-goog-api-key']=='test-image-key'
        parts=kwargs['json']['contents'][0]['parts']
        assert 'natural wood' in parts[0]['text'] and parts[1]['inlineData']['mimeType']=='image/jpeg'
        assert kwargs['json']['generationConfig']['candidateCount']==1
        return httpx.Response(200,request=httpx.Request('POST',url),json={'candidates':[{'finishReason':'STOP','content':{'parts':[{'inlineData':{'mimeType':'image/png','data':base64.b64encode(image).decode()}}]}}]})
    monkeypatch.setattr(httpx.AsyncClient,'post',upstream)
    assert client.post(url+'/preview',data={'consent':'false'},files={'file':('room.png',image,'image/png')}).status_code==422
    assert calls==[]
    response=client.post(url+'/preview',data={'consent':'true'}) # Stored original must not be recompressed before identity validation.
    assert response.status_code==200,response.text
    assert response.json()['generated'] and not response.json()['persisted']
    assert response.json()['image_data_url'].startswith('data:image/jpeg;base64,')
    assert len(list(main.UPLOAD_DIR.iterdir()))==1
    assert client.get(f"/api/scans/{scan['scan_id']}").json()['safety_score']==scan['safety_score']
    different=io.BytesIO();Image.new('RGB',(400,300),'black').save(different,format='PNG')
    assert client.post(url+'/preview',data={'consent':'true'},files={'file':('other.png',different.getvalue(),'image/png')}).status_code==422
    monkeypatch.setenv('INTERIOR_IMAGE_ENABLED','false')
    assert client.post(url+'/preview',data={'consent':'true'}).status_code==503


def test_interior_provider_quota_failure_is_explicit(client,image,monkeypatch):
    scan=analyze(client,image,save_image=True).json()
    with db.connect() as con:
        stored=json.loads(con.execute('SELECT result_json FROM scans WHERE id=?',(scan['scan_id'],)).fetchone()[0]);stored['detection_mode']='yolo'
        con.execute('UPDATE scans SET result_json=? WHERE id=?',(json.dumps(stored),scan['scan_id']))
    url=f"/api/scans/{scan['scan_id']}/interior";client.patch(url,json={'concept':'minimal','placements':[]})
    monkeypatch.setenv('INTERIOR_IMAGE_ENABLED','true');monkeypatch.setenv('GEMINI_IMAGE_API_KEY','test-key')
    async def quota(self,url,**kwargs):return httpx.Response(429,request=httpx.Request('POST',url),json={})
    monkeypatch.setattr(httpx.AsyncClient,'post',quota)
    response=client.post(url+'/preview',data={'consent':'true'})
    assert response.status_code==503 and '한도' in response.json()['detail']
    assert 'test-key' not in response.text
