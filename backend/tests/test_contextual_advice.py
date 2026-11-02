from copy import deepcopy
from app.contextual_advice import personalize, advice
from app.layout_recommendations import recommend, warnings_for


def hazard(kind, bbox):
    return {'object':kind,'object_label':kind,'bbox':bbox,'evidence_source':'yolo_image_geometry',
            'risk_level':'LOW','rule_id':10,'condition':'visible_furniture'}


def test_furniture_feedback_is_specific_and_does_not_change_risk():
    hazards=[hazard(kind,[.1,.6,.2,.2]) for kind in ('chair','couch','bed','dining_table')]
    before=deepcopy(hazards)
    personalize(hazards,[],'elderly','bedroom')
    assert len({h['recommendation'] for h in hazards})==4
    assert '테이블 아래' in hazards[0]['recommendation']
    assert '작은 테이블' in hazards[1]['recommendation']
    assert '내려오는 쪽' in hazards[2]['recommendation']
    assert '의자를 뺐을 때' in hazards[3]['recommendation']
    assert all((h['risk_level'],h['rule_id'],h['condition'],h['bbox']) ==
               (b['risk_level'],b['rule_id'],b['condition'],b['bbox']) for h,b in zip(hazards,before))
    personalized=deepcopy(hazards)
    personalize(hazards,[],'elderly','bedroom')
    assert personalized==hazards


def test_feedback_distinguishes_photo_location_neighbours_and_target():
    hazards=[hazard('chair',[.05,.6,.15,.2]),hazard('chair',[.75,.1,.15,.2])]
    detections=[{'object_type':'dining_table','bbox':[.2,.6,.2,.2]}]
    personalize(hazards,detections,'wheelchair','living_room')
    assert '왼쪽·하단' in hazards[0]['instance_label']
    assert '오른쪽·상단' in hazards[1]['instance_label']
    assert '인접해 보이지만 실제 간격' in hazards[0]['observation']
    assert '인접해' not in hazards[1]['observation']
    assert '무릎·발판' in advice('dining_table','wheelchair','living_room')['action']
    assert '성인 침대와 아기 수면 공간' in advice('bed','newborn','bedroom')['action']
    assert '문이 열리고' in advice('chair','elderly','entrance')['action']


def inventory():
    return [{'id':str(i),'kind':kind,'label':kind,'width':w,'depth':d,'x':.5,'y':.5,'rotation':0}
            for i,(kind,w,d) in enumerate([('couch',.28,.13),('bed',.25,.3),('dining_table',.22,.15),
                                           ('chair',.1,.1),('chair',.1,.1),('tv',.22,.06),('potted_plant',.07,.07)])]


def test_recommendations_preserve_inventory_and_find_nonoverlapping_alternatives():
    items=inventory();before=deepcopy(items)
    options=recommend({'target_type':'wheelchair','space_type':'living_room'},items,'accessible')
    assert len(options)==2 and options[0]['placements']!=options[1]['placements']
    assert items==before
    for option in options:
        assert {p['id'] for p in option['placements']}=={item['id'] for item in items}
        positions={p['id']:p for p in option['placements']}
        actual=[{**item,**positions[item['id']]} for item in items]
        assert not warnings_for(actual)
        assert len(option['reasons'])==len(items)
        assert '실측' in option['notice'] and '벽걸이' in option['notice']


def test_dense_inventory_is_not_dropped_and_empty_scan_does_not_invent_furniture():
    scan={'target_type':'elderly','space_type':'bedroom'}
    assert recommend(scan,[],'minimal')==[]
    items=[{**inventory()[3],'id':str(i)} for i in range(12)]
    for option in recommend(scan,items,'minimal'):
        assert len(option['placements'])==12
