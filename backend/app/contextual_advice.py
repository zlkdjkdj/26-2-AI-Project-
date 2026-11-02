"""Object-specific, evidence-bounded advice. Never changes detections or scores."""
from .seed import TARGET_LABELS, SPACE_LABELS

PROFILES = {
    'chair': ('의자', '의자를 빼고 앉거나 일어날 때 뒤쪽 이동 공간과 다리의 걸림을 확인하세요.',
              '사용 후 테이블 아래로 넣을 수 있는 의자는 넣고, 자주 앉는 의자는 접근 방향을 비워 두세요.',
              '흔들림과 바퀴·미끄럼 여부를 확인하세요. 의자를 이동용 손잡이처럼 사용하지 마세요.'),
    'couch': ('소파', '소파에서 일어나 출입구로 이동하는 경로와 앞쪽 테이블 사이를 확인하세요.',
              '소파를 먼저 움직이기보다 앞의 작은 테이블·바닥 물건을 정리하고 앉고 일어나는 방향을 비워 보세요.',
              '낮거나 푹 꺼지는 좌석의 일어나기 어려움과 노출된 단단한 팔걸이를 직접 확인하세요.'),
    'bed': ('침대', '침대에서 내려오는 쪽과 문·욕실로 향하는 경로를 확인하세요.',
            '실제로 내려오는 쪽에 협탁·전선이 겹치지 않게 조정하고, 조명과 자주 쓰는 물건은 접근하기 쉬운 위치에 두세요.',
            '벽과 침대 사이의 끼임, 프레임 고정 상태와 이동 시 지지 수단을 확인하세요. 침대를 무조건 벽에 붙이지 마세요.'),
    'dining_table': ('테이블', '상판 모서리뿐 아니라 의자를 빼는 공간과 테이블 다리 위치를 함께 확인하세요.',
                     '의자를 뺐을 때도 출입 경로가 이어지도록 배치하고, 상판 가장자리의 뜨거운 물건·늘어진 선을 정리하세요.',
                     '실제로 단단하고 노출된 모서리에만 적합한 보호대를 검토하고, 테이블의 흔들림을 확인하세요.'),
    'tv': ('TV', 'TV의 받침·벽걸이 고정 상태와 전원선이 내려오는 경로를 확인하세요.',
           '화면 위치를 임의로 옮기기보다 주변 발판·바닥 물건을 정리하고 전원선을 정리하세요.',
           '벽걸이·전도 방지 고정은 제조사 안내와 벽체 조건에 맞게 확인하세요. 사진만으로 고정 여부를 판단할 수 없어요.'),
    'potted_plant': ('화분', '화분의 무게·받침 안정성과 잎·받침이 이동 경로로 나오는지 확인하세요.',
                     '문 여닫기와 이동에 방해되지 않는 안정적인 위치를 검토하고, 물받침 주변 물기를 직접 확인하세요.',
                     '높은 불안정한 받침이나 가장자리 배치를 피하고, 아이가 흙·잎에 접근하는지 확인하세요.'),
    'backpack': ('배낭', '배낭과 늘어진 어깨끈이 실제 발 디딤 위치에 놓였는지 확인하세요.',
                 '배낭을 출입구·침대 옆 바닥에서 닫힌 수납공간으로 옮기고 끈을 안쪽으로 정리하세요.', '자주 쓰는 배낭은 접근하기 쉬운 고정 수납 위치를 정하세요.'),
    'handbag': ('가방', '가방 손잡이·끈이 발에 걸리거나 아이가 당길 수 있는지 확인하세요.',
                '이동 경로에서 가방을 치우고 안의 약품·작은 물건은 별도로 보관하세요.', '높은 곳에 불안정하게 걸기보다 안정적인 수납 위치를 사용하세요.'),
    'suitcase': ('여행 가방', '여행 가방의 바퀴와 펼친 덮개가 실제 통로에 나와 있는지 확인하세요.',
                 '사용하지 않을 때 닫아서 수납하고, 굴러가거나 넘어지지 않는 위치를 직접 확인하세요.', '출입문이 열리는 범위와 비상시 이동 경로를 비워 두세요.'),
}

TARGET_NOTES = {
    'newborn': '신생아를 안고 이동하는 보호자의 발 디딤과 손이 닿는 위치를 기준으로 확인하세요. 수면 공간에는 베개·범퍼·장식 침구를 추가하지 마세요.',
    'toddler': '아이가 잡아당기거나 올라설 수 있는지, 창문·끈에 접근하는 발판이 되는지 직접 확인하세요.',
    'elderly': '앉고 일어나는 방향, 야간 이동과 필요한 지지 위치를 사용자와 함께 확인하세요.',
    'wheelchair': '실제 휠체어로 접근·방향 전환·옮겨 앉기를 확인하세요. 사진으로 통과 가능 여부를 확정하지 않아요.',
    'limited_mobility': '사용하는 보행보조기와 함께 이동·방향 전환·앉고 일어나는 공간을 확인하세요.',
}


def image_position(bbox):
    x, y, w, h = bbox
    horizontal = '왼쪽' if x+w/2 < .35 else '오른쪽' if x+w/2 > .65 else '중앙'
    vertical = '상단' if y+h/2 < .35 else '하단' if y+h/2 > .65 else '중간'
    return f'사진 {horizontal}·{vertical}'


def advice(kind, target, room):
    profile = PROFILES.get(kind)
    if not profile:
        return None
    label, check, action, supplement = profile
    if kind == 'bed' and target == 'newborn':
        action = '성인 침대와 아기 수면 공간을 구분하고, 아기 수면 공간의 부드러운 침구·주변 끈을 직접 확인하세요. 보호자가 접근하는 쪽은 비워 두세요.'
    if kind == 'chair' and room in ('entrance', 'hallway'):
        action = '의자 사용 중에도 문이 열리고 사람이 지나갈 수 있는지 확인하세요. 신발을 신는 용도라면 흔들리지 않는 위치를 먼저 확인하세요.'
    if kind == 'dining_table' and target == 'wheelchair':
        action = '상판 아래 무릎·발판 공간과 테이블 다리의 간섭을 실제 휠체어로 확인하고, 접근하는 쪽의 의자를 정리하세요.'
    return {'check': check, 'action': action, 'supplement': supplement, 'target_tip': TARGET_NOTES[target]}


def personalize(hazards, detections, target, room):
    """Also used when opening existing scans; stored scores remain unchanged."""
    for hazard in hazards:
        kind = hazard['object']
        profile = advice(kind, target, room)
        if not profile or hazard.get('evidence_source') == 'mock':
            continue
        bbox = hazard['bbox']
        position = image_position(bbox)
        peers = []
        x, y, w, h = bbox
        for obj in detections:
            if obj['object_type'] == kind or obj['object_type'] not in PROFILES:
                continue
            ox, oy, ow, oh = obj['bbox']
            gap_x = max(0, x-ox-ow, ox-x-w)
            gap_y = max(0, y-oy-oh, oy-y-h)
            if gap_x < .06 and gap_y < .06:
                peers.append(PROFILES[obj['object_type']][0])
        nearby = list(dict.fromkeys(peers))[:2]
        boxes = list(dict.fromkeys(tuple(obj['bbox']) for obj in detections if obj['object_type']==kind))
        identity = tuple(bbox)
        if identity not in boxes:
            boxes.append(identity)
        label = hazard['object_label'] + (f' {boxes.index(identity)+1}' if len(boxes)>1 else '')
        observation = f'{position}에 {hazard["object_label"]}가 탐지되었습니다.'
        if nearby:
            observation += f' 사진상 {", ".join(nearby)}와 인접해 보이지만 실제 간격은 확인이 필요해요.'
        action = profile['action']
        if hazard.get('condition') == 'image_lower_center':
            action = '사진 하단 중앙이 실제 이동 경로인지 먼저 확인한 뒤 적용하세요. ' + action
        if kind == 'couch' and '테이블' in nearby:
            action += ' 사진에서 인접한 테이블이 일어나는 동작을 막는다면 테이블 위치부터 조정하세요.'
        if kind == 'bed' and '의자' in nearby:
            action += ' 사진에서 인접한 의자를 침대 옆 지지대로 쓰지 말고, 내려오는 쪽을 막는지 확인하세요.'
        hazard.update(
            instance_label=f'{label} · {position}',
            observation=observation,
            description=f'{observation} {profile["check"]} {SPACE_LABELS[room]}·{TARGET_LABELS[target]} 기준의 확인 항목입니다.',
            recommendation=action, supplement=profile['supplement'],
            placement_advice=profile['target_tip'],
            verification_questions=[profile['check'], profile['target_tip']],
        )
        if hazard.get('classification_uncertain'):
            hazard['description'] += ' 물건 종류가 모호하므로 먼저 실제 물건을 확인하세요.'
    return hazards
