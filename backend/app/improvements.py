"""Stored field checks and practical room guides derived from rules, not invented floorplans."""
from .db import connect
from .seed import CATALOG, ROOM_OBJECTS, OBJECT_LABELS, TARGET_LABELS, SPACE_LABELS
from .risk import ACCIDENT_LABELS, safety_score, combined_score, score_policy
from .safety_catalog import SOURCE_BY_OBJECT

CHILD_ONLY = {'blind_cord', 'small_parts', 'bath_water'}
ROOM_GUIDES = {
 'living_room': ('주로 머무는 위치에서 출입구까지', '자주 걷는 길을 기준으로 테이블과 의자를 정렬하고 바닥 수납을 줄여보세요.'),
 'bedroom': ('침대에서 문까지', '밤에 이동하는 경로를 먼저 비우고 자주 쓰는 물건을 안정적인 수납 위치로 옮겨보세요.'),
 'kitchen': ('입구에서 조리대까지', '조리 구역과 이동 경로를 나누고 날카로운 도구는 사용 후 닫힌 수납공간에 두세요.'),
 'bathroom': ('입구에서 변기·세면대까지', '바닥 물기를 정리하고 출입 및 몸을 돌리는 공간을 실제로 확인하세요.'),
 'entrance': ('출입문에서 실내까지', '신발과 택배를 이동 경로에서 치우고 문이 열리는 공간을 비워보세요.'),
 'hallway': ('방 사이를 오가는 길', '물건을 벽 쪽 수납공간으로 옮기고 통로 중간을 비워보세요.'),
 'stairs': ('계단 진입부와 이동 경로', '디딤판의 물건을 치우고 손잡이와 조명 상태를 직접 확인하세요.'),
}
SOURCES = [
 {'title':'CDC · 가정 내 낙상 예방 체크리스트', 'url':'https://www.cdc.gov/steadi/pdf/patient/customizable/checkforsafety-brochure-final-customizable-508.pdf'},
 {'title':'CPSC · 가정 내 어린이 안전', 'url':'https://www.cpsc.gov/safety-education/safety-guides/kids-and-babies/Childproofing-Your-Home'},
]


def available_checks(target_type, space_type):
    objects = [obj for obj in ROOM_OBJECTS[space_type] if obj not in CHILD_ONLY or target_type in ('newborn','toddler')]
    with connect() as connection:
        rows = connection.execute('SELECT * FROM risk_rules WHERE target_type=? AND space_type=?', (target_type,space_type)).fetchall()
    catalog = {item[0]:item for item in CATALOG}
    selected = {row['object_type']: dict(row) for row in rows if row['object_type'] in objects and row['condition'] == catalog[row['object_type']][1]}
    return [selected[obj] for obj in objects if obj in selected]


def enrich(scan):
    with connect() as connection:
        states = {row['object_type']:dict(row) for row in connection.execute('SELECT * FROM scan_checks WHERE scan_id=?',(scan['scan_id'],))}
        tasks = {row['task_key']:bool(row['completed']) for row in connection.execute('SELECT * FROM guide_tasks WHERE scan_id=?',(scan['scan_id'],))}
    checks = []
    for rule in available_checks(scan['target_type'], scan['space_type']):
        state = states.get(rule['object_type'], {})
        checks.append({
            'key':rule['object_type'], 'label':OBJECT_LABELS[rule['object_type']], 'condition':rule['condition'],
            'question':rule['reason'], 'risk_level':rule['risk_level'], 'risk_type':rule['risk_type'],
            'accident':ACCIDENT_LABELS[rule['risk_type']], 'recommendation':rule['recommendation'],
            'supplement':rule['supplement'], 'status':state.get('status','unknown'), 'note':state.get('note',''),
            'source':'user_confirmation', 'updated_at':state.get('updated_at'),
        })
    confirmed = [c for c in checks if c['status'] == 'risk']
    for check in checks:check['source_url']=SOURCE_BY_OBJECT.get(check['key'],SOURCES[0]['url'] if scan['target_type']=='elderly' else SOURCES[1]['url'])
    scan.setdefault('scoring',{'version':'v1','notice':'이 기록은 이전 기준(15·7·3점 차감)으로 계산되었습니다. 새로운 기준은 다시 촬영한 점검부터 적용됩니다.'})
    scan['field_checks'] = checks
    scan['field_check_summary'] = {
        'total':len(checks), 'checked':sum(c['status'] != 'unknown' for c in checks),
        'confirmed_risks':len(confirmed), 'unknown':sum(c['status'] == 'unknown' for c in checks),
        'combined_reference_score':combined_score(scan['hazards'],confirmed,scan['scoring']['version']),
        'notice':'사진 확인 항목과 직접 확인한 위험을 합친 참고값입니다. 같은 물건의 중복 확인은 이중 차감하지 않으며, 미확인은 안전으로 간주하지 않습니다.',
    }
    priorities = {'HIGH':0,'MEDIUM':1,'LOW':2}
    items = sorted(scan['hazards'], key=lambda h:priorities[h['risk_level']])
    guide = []
    seen = set()
    for hazard in items:
        key = f"photo:{hazard['object']}:{hazard['condition']}"
        if key in seen:
            continue
        seen.add(key)
        guide.append({'key':key,'title':f"{hazard['object_label']} 위치 확인", 'first':hazard['recommendation'],
                      'supplement':hazard['supplement'], 'source':'photo', 'risk_level':hazard['risk_level'],
                      'bbox':hazard['bbox'], 'completed':tasks.get(key,False), 'hazard_id':hazard['id']})
    for check in sorted(confirmed, key=lambda c:priorities[c['risk_level']]):
        key = f"check:{check['key']}"
        guide.append({'key':key,'title':f"{check['label']} 개선",'first':check['recommendation'],'supplement':check['supplement'],
                      'source':'user_confirmation','risk_level':check['risk_level'],'bbox':None,'completed':tasks.get(key,False)})
    guide.sort(key=lambda step:priorities[step['risk_level']])
    path, principle = ROOM_GUIDES[scan['space_type']]
    scan['interior_guide'] = {
        'title':f"{SPACE_LABELS[scan['space_type']]}, 더 편안하게", 'target_label':TARGET_LABELS[scan['target_type']],
        'path':path,'principle':principle,'steps':guide,
        'completed':sum(step['completed'] for step in guide),
        'measurement_tip':('실제 휠체어·보행보조기를 사용하는 상태에서 출입, 방향 전환, 가구 접근 공간을 직접 확인하세요.' if scan['target_type'] in ('wheelchair','limited_mobility') else '물건을 옮기기 전에 출입문, 실제 이동 경로와 고정 상태를 확인하세요.'),
        'target_tip': {'newborn':'신생아를 안고 이동하는 보호자의 동선을 먼저 비우고 창문 옆 발판과 늘어진 끈을 확인하세요.', 'toddler':'아이의 손이 닿는 수납 위치와 올라설 수 있는 가구를 직접 확인하세요.', 'elderly':'자주 쓰는 물건은 쉽게 꺼낼 수 있는 곳에 두고 밤에 이동하는 길을 먼저 비워보세요.', 'wheelchair':'출입문 여닫기와 방향 전환을 실제 휠체어로 확인한 뒤 배치를 조정하세요.', 'limited_mobility':'이동 보조기 사용과 지지할 수 있는 위치를 확인한 뒤 이동 경로를 비워보세요.'}[scan['target_type']],
        'notice':'사진 좌표는 평면도나 이동 가능한 공간의 측정값이 아닙니다. 가구의 크기·문 위치·출구를 확인한 후 배치를 바꾸세요. 완료 체크만으로 점수는 올라가지 않습니다.',
        'sources':SOURCES,
    }
    scan['zones'] = [{'hazard_id':h['id'], 'label':h['object_label'], 'bbox':h['bbox'],
                      'level':'danger' if h['risk_level'] == 'HIGH' else 'caution',
                      'basis':'mock' if scan['detection_mode'] == 'mock' else 'photo_rule'} for h in scan['hazards']]
    return scan


def render_report(scan):
    from html import escape
    esc=lambda value:escape(str(value))
    score='평가 보류' if scan['safety_score'] is None else f"{scan['safety_score']}점"
    hazards=''.join(f"<article><h3>{esc(h['object_label'])} · {esc(h['risk_level'])}</h3><p>{esc(h['description'])}</p><p>{esc(h['recommendation'])}</p><small>{esc(h['supplement'])}</small></article>" for h in scan['hazards'])
    statuses={'risk':'위험 있음','clear':'해당 조건 없음','unknown':'미확인'}
    checks=''.join(f"<tr><td>{esc(c['label'])}</td><td>{statuses[c['status']]}</td><td>{esc(c['note'])}</td></tr>" for c in scan['field_checks'])
    steps=''.join(f"<article><h3>{'☑' if s['completed'] else '☐'} {esc(s['title'])}</h3><p>{esc(s['first'])}</p><small>{esc(s['supplement'])}</small></article>" for s in scan['interior_guide']['steps'])
    return f'''<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>앗차차 점검 보고서</title>
<style>body{{font-family:system-ui,sans-serif;color:#1d1d1f;line-height:1.8;max-width:760px;margin:40px auto;padding:0 24px}}h1{{letter-spacing:-1px}}h2{{margin-top:32px}}article{{padding:15px 0;border-bottom:1px solid #eee;break-inside:avoid}}small{{color:#777}}table{{border-collapse:collapse;width:100%;font-size:13px}}td,th{{border-bottom:1px solid #ddd;text-align:left;padding:10px}}.score{{color:#0071e3;font-size:28px}}@media print{{body{{margin:0}}}}</style>
<h1>앗차차 · 공간 점검 보고서</h1><p>{esc(scan['space_name'])} · {esc(SPACE_LABELS[scan['space_type']])} · {esc(TARGET_LABELS[scan['target_type']])}</p><small>{esc(scan['created_at'])} · 점검 #{scan['scan_id']}</small>
<p class="score">사진 참고점수 {score}</p><p>{esc(scan['notice'])}</p><h2>사진 확인 항목</h2>{hazards or '<p>확인 항목 없음 · 안전 확정이 아닙니다.</p>'}
<h2>직접 점검 기록</h2><table><thead><tr><th>항목</th><th>확인 상태</th><th>메모</th></tr></thead><tbody>{checks}</tbody></table>
<h2>인테리어 개선 가이드</h2><p>{esc(scan['interior_guide']['principle'])}</p>{steps}<p>{esc(scan['interior_guide']['notice'])}</p><small>직접 점검의 미확인 상태는 개선 완료가 아닙니다. 생성된 가이드는 실제 치수나 평면도를 측정한 결과가 아닙니다.</small></html>'''
