"""Conditional inspection prompts. No edge/material/friction inferred from pixels."""
from .contextual_advice import image_position

EDGES = {
 'dining_table': ('테이블', '상판 가장자리·모서리와 의자를 빼는 쪽', '앉고 일어나는 경로에서 노출된 상판 모서리를 피하도록 의자와 테이블 위치를 조정하세요.'),
 'bed': ('침대', '내려오는 쪽 프레임·발치와 협탁 방향', '침대에서 내려오는 쪽 프레임과 협탁 모서리에 부딪히지 않도록 주변 물건을 정리하세요.'),
 'couch': ('소파', '단단한 팔걸이·노출된 다리와 앞쪽 테이블', '소파에서 일어나는 쪽에 단단한 팔걸이나 테이블 모서리가 겹치는지 확인하세요.'),
 'chair': ('의자', '등받이 끝·좌판 가장자리·바닥으로 돌출된 다리', '의자를 뺐을 때 다리가 이동 경로에 나오지 않도록 정렬하고, 흔들리는 의자는 사용을 멈추고 점검하세요.'),
 'tv': ('TV', 'TV 자체 가장자리와 실제 받침 가구의 노출부', 'TV를 직접 옮기기 전에 받침 가구와 고정 상태를 확인하고, 주변 이동 경로를 비우세요.'),
}

def focus_checks(scan):
    items=[]
    seen=set()
    target=scan['target_type'];room=scan['space_type']
    for index,obj in enumerate(scan.get('detected_objects',[])):
        kind=obj['object_type'];identity=(kind,tuple(obj['bbox']))
        if kind not in EDGES or identity in seen:continue
        seen.add(identity);label,where,action=EDGES[kind]
        nearby=next((h for h in scan['hazards'] if h['object']==kind and tuple(h['bbox'])==tuple(obj['bbox'])),None)
        questions=[f'{where}에 실제로 단단하거나 날카로운 노출부가 있나요?', '자주 지나는 길이나 앉고 일어나는 동작에서 몸이 닿을 수 있나요?']
        if target=='toddler':questions.append('아이의 머리·얼굴 높이에서 닿거나 올라설 때 부딪힐 수 있나요? 높이는 현장에서 확인하세요.')
        elif target=='newborn':questions.append('아기를 안고 이동하는 보호자의 몸·팔이 닿는 위치인가요? 아기 침대 내부에는 범퍼·패딩을 추가하지 마세요.')
        elif target in ('wheelchair','limited_mobility'):questions.append('보조기·휠체어의 회전 또는 옮겨 앉는 방향에서 팔·무릎·발판과 간섭하나요?')
        else:questions.append('앉고 일어날 때 부딪히거나 움직이는 가구를 손잡이처럼 잡게 되나요?')
        items.append(dict(key=f'edge-{index}',title=f'{label} · {image_position(obj["bbox"])}',
            area=where,questions=questions,action=action,
            supplement='실제로 노출되고 접촉 가능한 단단한 모서리에만 제품·소재에 맞는 보호대를 검토하세요. 쉽게 분리되지 않게 고정하고 주기적으로 점검하세요.',
            hazard_id=nearby['id'] if nearby else None,bbox=obj['bbox']))
    if room=='bathroom':
        floor='샤워·욕조 출입부와 변기·세면대 사이'
        actions=['물기와 비누·세정제 잔여물을 제거하고 바닥을 건조하게 관리하세요.', '사용할 경우 욕실용 미끄럼방지 매트·스트립의 고정, 들뜸과 배수 상태를 확인하세요. 매트를 겹쳐 놓지 마세요.']
    elif room=='entrance':
        floor='젖은 신발·우산 주변과 현관 매트'
        actions=['빗물과 젖은 신발 주변을 정리하고 이동 경로를 건조하게 유지하세요.', '미끄러지거나 말린 매트는 먼저 치우세요. 유지할 경우 바닥·매트에 맞는 고정 방법과 문 여닫기 간섭을 확인하세요.']
    elif room=='stairs':
        floor='계단 디딤판·끝단과 고정된 덮개'
        actions=['디딤판의 물기와 물건을 치우고 들뜨거나 손상된 덮개는 수리를 검토하세요.', '미끄럼방지 보완재는 디딤판에 맞게 고정하고 끝단 들뜸을 점검하세요. 느슨한 매트를 추가하지 마세요.']
    else:
        floor='주요 이동 경로의 바닥과 러그·매트 가장자리'
        actions=['물·기름·청소제 잔여물을 제거하고 이동 경로의 바닥 물건을 치우세요.', '미끄러지거나 끝이 들린 러그·매트는 제거를 우선 검토하세요. 유지할 경우 적합한 미끄럼방지 받침·고정 방법과 가장자리 들뜸을 확인하세요.']
    return dict(edges=items,slip=dict(area=floor,questions=['물기·기름·비누 또는 청소제 잔여물이 있나요?', '러그·매트가 움직이거나 끝이 말려 발·보조기·바퀴가 걸리나요?', '안전한 위치에서 눈으로 확인하고, 미끄러운 곳을 일부러 밟아 시험하지 마세요.'],actions=actions),
        notice='가구 탐지를 바탕으로 확인할 위치를 제안합니다. 날카로움·재질·실제 높이·바닥 마찰력·물기를 자동 판정하거나 점수에 추가하지 않습니다.',
        sources=[dict(title='CDC · 가정 내 낙상 예방',url='https://www.cdc.gov/steadi/pdf/steadi-brochure-checkforsafety-508.pdf'),dict(title='CPSC · 가구 모서리 보호',url='https://www.cpsc.gov/safety-education/safety-guides/kids-and-babies/Childproofing-Your-Home')])
