"""Cross-scan candidates plus explicit user-confirmed identity links."""
from .db import connect
from .electrical import iou

KINDS={'chair','couch','bed','dining_table','tv','potted_plant'}

def inventory(scan):
    result=[]
    for i,obj in enumerate(scan.get('detected_objects',[])):
        if obj['object_type'] not in KINDS:continue
        count=sum(item['kind']==obj['object_type'] for item in result)+1
        result.append({'id':f'object-{i}','kind':obj['object_type'],'label':f"{obj.get('object_label',obj['object_type'])} {count}",'bbox':obj['bbox']})
    return result

def track(previous,current,confirmed=None):
    from fastapi import HTTPException
    before,after=inventory(previous),inventory(current)
    old={item['id']:item for item in before};new={item['id']:item for item in after}
    with connect() as con:
        if confirmed is not None:
            previous_ids=[p.previous_object_id for p in confirmed];current_ids=[p.current_object_id for p in confirmed]
            if len(previous_ids)!=len(set(previous_ids)) or len(current_ids)!=len(set(current_ids)):
                raise HTTPException(422,'동일 가구 연결은 한 가구당 하나씩 선택하세요.')
            for pair in confirmed:
                a,b=old.get(pair.previous_object_id),new.get(pair.current_object_id)
                if not a or not b or a['kind']!=b['kind']:raise HTTPException(422,'두 점검에서 탐지된 같은 종류의 가구를 선택하세요.')
            con.execute('DELETE FROM furniture_links WHERE previous_scan_id=? AND current_scan_id=?',(previous['scan_id'],current['scan_id']))
            con.executemany('INSERT INTO furniture_links(previous_scan_id,current_scan_id,previous_object_id,current_object_id) VALUES(?,?,?,?)',
                [(previous['scan_id'],current['scan_id'],p.previous_object_id,p.current_object_id) for p in confirmed])
        links=con.execute('SELECT previous_object_id,current_object_id FROM furniture_links WHERE previous_scan_id=? AND current_scan_id=?',
                          (previous['scan_id'],current['scan_id'])).fetchall()
    confirmed_map={row['current_object_id']:row['previous_object_id'] for row in links}
    used=set(confirmed_map.values());pairs=[]
    for item in after:
        matched=old.get(confirmed_map.get(item['id']))
        candidates=[other for other in before if other['kind']==item['kind'] and other['id'] not in used]
        if not matched and candidates:
            matched=max(candidates,key=lambda other:iou(other['bbox'],item['bbox']))
        if not matched:continue
        verified=item['id'] in confirmed_map
        if not verified:used.add(matched['id'])
        def hazards(scan,entry):
            return [h for h in scan['hazards'] if h['object']==entry['kind'] and iou(h['bbox'],entry['bbox'])>.5]
        a,b=hazards(previous,matched),hazards(current,item)
        pairs.append({'previous':matched,'current':item,'identity':'user_confirmed' if verified else 'candidate',
                      'before_checks':len(a),'after_checks':len(b),
                      'photo_position_changed':sum(abs(x-y) for x,y in zip(matched['bbox'],item['bbox']))>.08,
                      'notice':'사진상의 위치·확인 항목 변화이며 실제 이동이나 개선 완료를 확정하지 않습니다.'})
    return {'before':before,'after':after,'pairs':pairs,'confirmed_matches':len(links),
            'unmatched_before':[item for item in before if item['id'] not in {p['previous']['id'] for p in pairs}],
            'unmatched_after':[item for item in after if item['id'] not in {p['current']['id'] for p in pairs}],
            'notice':'자동 후보는 같은 종류와 사진 위치를 참고합니다. 촬영 각도가 다르면 틀릴 수 있으므로 사용자가 같은 가구인지 연결해 주세요. 미탐지는 제거·개선 완료를 뜻하지 않습니다.'}
