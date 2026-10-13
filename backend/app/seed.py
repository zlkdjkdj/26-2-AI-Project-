# 객체의 존재만으로 적용하지 않고 조건(evidence)이 일치하는 규칙만 적용합니다.
TARGETS = ('newborn', 'toddler', 'elderly', 'wheelchair', 'limited_mobility')
SPACES = ('living_room', 'bedroom', 'kitchen', 'bathroom', 'entrance', 'hallway', 'stairs')
CATALOG = [
    ('electric_wire', 'path_obstruction', 'fall', '이동 경로에 전선이 놓임', '전선을 벽면으로 옮기고 남는 길이를 묶으세요.', '필요하면 케이블 몰딩으로 고정하세요.'),
    ('socket', 'low_accessible', 'electric_shock', '낮은 위치의 콘센트에 접근 가능', '콘센트 주변 접근 경로를 정리하세요.', '사용하지 않는 콘센트에 안전커버를 설치하세요.'),
    ('furniture_corner', 'near_path', 'collision', '이동 경로 가까이에 날카로운 가구 모서리', '가구를 벽 쪽으로 이동해 통로를 확보하세요.', '노출된 모서리에 보호대를 붙이세요.'),
    ('rug', 'loose_edge', 'fall', '러그 끝이 들려 있음', '들뜬 러그를 펴거나 이동 경로에서 치우세요.', '러그 아래 미끄럼방지 패드를 보완하세요.'),
    ('obstacle', 'path_obstruction', 'fall', '바닥 물건이 이동 경로를 막음', '바닥 물건을 수납하고 이동 통로를 비우세요.', '자주 쓰는 물건을 손이 닿는 수납 위치에 두세요.'),
    ('knife', 'low_accessible', 'cut', '손이 닿는 곳에 칼이 노출됨', '칼을 사용 후 안전한 수납공간으로 옮기세요.', '영유아가 접근하는 서랍에 잠금장치를 보완하세요.'),
    ('stove', 'hot_accessible', 'burn', '화구 주변에 접근 가능한 물건이 있음', '화구 주변 물건을 치우고 냄비 손잡이를 안쪽으로 돌리세요.', '필요하면 화구 접근 방지 장치를 보완하세요.'),
    ('detergent', 'low_accessible', 'poisoning', '낮은 위치에 세제가 놓임', '세제를 음식과 분리해 닫힌 수납공간에 보관하세요.', '접근 가능한 수납장에 잠금장치를 설치하세요.'),
    ('floor', 'wet_surface', 'slip', '바닥에 물기가 있다는 조건', '물기를 제거하고 바닥을 건조하게 유지하세요.', '미끄럼방지 패드와 필요한 손잡이를 보완하세요.'),
    ('passage', 'narrow_passage', 'blocked_movement', '가구로 인해 통로가 좁음', '가구와 물건을 벽 쪽으로 재배치해 이동 통로를 확보하세요.', '실제 이동 보조기 폭과 회전 공간을 직접 확인하세요.'),
    ('stairs', 'unguarded_edge', 'fall', '계단 진입부에 안전장치가 없음', '계단 주변 물건을 치워 진입부를 확보하세요.', '대상자에 맞는 안전문 또는 손잡이를 보완하세요.'),
    ('window', 'accessible_opening', 'fall_from_height', '창문 가까이에 올라설 수 있는 가구가 있음', '창문 옆 가구와 발판이 될 물건을 옮기세요.', '창문 잠금장치와 열림 제한장치를 보완하세요.'),
    ('lighting', 'dim_path', 'fall', '이동 통로의 조명이 부족하다는 조건', '통로를 정리하고 기존 조명을 켜 두세요.', '이동 경로에 야간조명을 보완하세요.'),
    ('high_object', 'unstable_overhead', 'falling_object', '높은 위치의 물건이 불안정함', '무거운 물건을 낮은 수납 위치로 옮기세요.', '선반과 수납장의 고정 상태를 확인하세요.'),
]
ROOM_OBJECTS = {
    'living_room': ['electric_wire', 'socket', 'furniture_corner', 'rug', 'window'],
    'bedroom': ['electric_wire', 'socket', 'obstacle', 'window', 'high_object', 'lighting'],
    'kitchen': ['knife', 'stove', 'detergent', 'passage', 'high_object'],
    'bathroom': ['floor', 'detergent', 'rug', 'passage'],
    'entrance': ['obstacle', 'rug', 'passage', 'lighting'],
    'hallway': ['obstacle', 'passage', 'electric_wire', 'lighting'],
    'stairs': ['stairs', 'obstacle', 'lighting'],
}

TARGET_LABELS = {'newborn': '신생아', 'toddler': '영유아', 'elderly': '노약자', 'wheelchair': '휠체어 사용자', 'limited_mobility': '거동 불편자'}
SPACE_LABELS = {'living_room': '거실', 'bedroom': '침실', 'kitchen': '주방', 'bathroom': '욕실', 'entrance': '현관', 'hallway': '복도', 'stairs': '계단'}
OBJECT_LABELS = {'electric_wire': '전선', 'socket': '콘센트', 'furniture_corner': '가구 모서리', 'rug': '러그·매트', 'obstacle': '바닥 장애물', 'knife': '칼', 'stove': '화구', 'detergent': '세제', 'floor': '바닥 물기', 'passage': '좁은 통로', 'stairs': '계단', 'window': '창문', 'lighting': '조명 부족', 'high_object': '높은 위치의 물건'}

def seed_rules(connection):
    for target in TARGETS:
        for room, objects in ROOM_OBJECTS.items():
            for obj, condition, accident, reason, first, supplement in CATALOG:
                if obj in ('sleep_bedding','crib_cord','crib_gap','changing_surface','plastic_bag','button_battery','bedside_light','unstable_seat','unsupported_transfer','uneven_step','reaching_storage','bathroom_access'):
                    continue
                if obj not in objects:
                    continue
                risk_type = accident
                level = 'MEDIUM'
                if obj in ('electric_wire', 'rug', 'floor', 'obstacle', 'stairs', 'lighting'):
                    level = 'HIGH' if target in ('elderly', 'limited_mobility') else 'MEDIUM'
                if obj in ('socket', 'knife', 'stove', 'detergent', 'window'):
                    level = 'HIGH' if target == 'toddler' else 'LOW'
                if obj == 'stairs' and target == 'toddler':
                    level = 'HIGH'
                    risk_type = 'fall_from_height'
                if obj == 'obstacle' and target == 'wheelchair':
                    level = 'MEDIUM'
                    risk_type = 'blocked_movement'
                if obj == 'passage':
                    level = 'HIGH' if target in ('wheelchair', 'limited_mobility') else 'MEDIUM'
                if obj == 'high_object':
                    level = 'HIGH'
                if obj in ('cabinet','power_strip','grab_bar'):
                    level = 'HIGH'
                if obj in ('blind_cord','small_parts','bath_water'):
                    level = 'HIGH' if target in ('newborn','toddler') else 'LOW'
                # 신생아의 전선/콘센트 위험은 직접 보행 대신 보호자 이동 조건으로 안내합니다.
                specific_reason = reason
                if target == 'newborn' and obj in ('electric_wire', 'rug', 'obstacle', 'stairs'):
                    specific_reason += ' (신생아를 안고 이동하는 보호자 경로 기준)'
                    level = 'MEDIUM'
                connection.execute('''INSERT OR IGNORE INTO risk_rules
                    (target_type, space_type, object_type, condition, risk_type, risk_level, reason, recommendation, supplement)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                    (target, room, obj, condition, risk_type, level, specific_reason, first, supplement))

# Rules for observations that the general COCO model can actually support.
# Visibility/image position is distinguished from unmeasured physical accessibility.
REAL_LABELS = {'chair':'의자','couch':'소파','bed':'침대','dining_table':'테이블','scissors':'가위','backpack':'배낭','handbag':'가방','suitcase':'여행 가방'}
OBJECT_LABELS.update(REAL_LABELS)

def seed_real_rules(connection):
    for target in TARGETS:
        for room in SPACES:
            for obj in ('knife','scissors','chair','couch','bed','dining_table','backpack','handbag','suitcase'):
                rules = []
                if obj in ('knife','scissors'):
                    rules.append(('visible_sharp_object','cut','HIGH' if target == 'toddler' else 'MEDIUM',
                                  '사진에서 날카로운 도구가 탐지되었습니다. 대상자의 손이 닿는 위치인지 확인하세요',
                                  '사용하지 않는 날카로운 도구를 닫힌 수납공간으로 옮기세요.',
                                  '영유아가 접근하는 수납장에는 잠금장치를 보완하세요.'))
                if obj in ('chair','couch','bed','dining_table'):
                    rules.append(('visible_furniture','collision','LOW',
                                  '사진에서 가구가 탐지되었습니다. 실제 이동 통로와 모서리 접근 여부를 확인하세요',
                                  '실제 통로를 가리는 경우에만 가구 위치를 조정하고 주변 바닥을 정리하세요.',
                                  '노출된 모서리가 있다면 보호대를 보완하세요.'))
                if obj not in ('knife','scissors'):
                    rules.append(('image_lower_center','blocked_movement' if target == 'wheelchair' else 'fall',
                                  'MEDIUM' if target in ('elderly','wheelchair','limited_mobility','newborn') else 'LOW',
                                  '사진 하단 중앙에 물건이 탐지되었습니다. 이 부분이 실제 이동 경로인지 직접 확인하세요',
                                  '이동 경로에 놓인 물건이라면 벽 쪽이나 수납공간으로 옮겨 통로를 확보하세요.',
                                  '재배치 후 대상자가 직접 이동할 수 있는 공간이 확보되는지 확인하세요.'))
                for condition, risk, level, reason, first, supplement in rules:
                    connection.execute('''INSERT OR IGNORE INTO risk_rules
                       (target_type,space_type,object_type,condition,risk_type,risk_level,reason,recommendation,supplement)
                       VALUES (?,?,?,?,?,?,?,?,?)''', (target,room,obj,condition,risk,level,reason,first,supplement))

# 추가 조건은 사용자의 현장 확인으로만 적용합니다.
EXTRA_CATALOG = [
    ('grab_bar', 'missing_support', 'fall', '욕실 또는 계단에서 필요한 손잡이가 없음', '지지할 곳이 없는 이동 경로를 보호자와 함께 확인하세요.', '벽체와 설치 조건에 맞는 손잡이 보완을 검토하세요.'),
    ('threshold', 'raised_threshold', 'fall', '이동 경로에 걸리는 문턱이나 단차가 있음', '문턱 주변 물건을 치우고 단차 위치를 확인하세요.', '실제 이동 보조기에 맞는 단차 보완 방법을 검토하세요.'),
    ('cabinet', 'unanchored_furniture', 'tipping', '수납장이나 TV가 고정되지 않아 넘어질 수 있음', '무거운 물건을 아래로 옮기고 가구에 올라서지 않도록 주변을 정리하세요.', '제조사 안내와 벽체 조건에 맞는 가구 고정 장치를 보완하세요.'),
    ('blind_cord', 'accessible_cord', 'entanglement', '아이 손이 닿는 위치에 블라인드 끈이 늘어져 있음', '침대와 발판이 될 가구를 창문 및 끈에서 떨어뜨리세요.', '끈 고정 장치를 확인하고 위험을 없애기 어려우면 끈 없는 방식을 검토하세요.'),
    ('small_parts', 'accessible_small_parts', 'choking', '아이 손이 닿는 곳에 삼킬 수 있는 작은 부품이 있음', '작은 부품을 모아 닫힌 수납공간에 보관하세요.', '접근 가능한 서랍의 잠금장치를 확인하세요.'),
    ('medicine', 'unsecured_medicine', 'poisoning', '약품이 음식과 섞이거나 접근 가능한 곳에 노출됨', '약품을 원래 용기에 두고 음식과 분리해 보관하세요.', '대상자의 접근을 막는 수납장 잠금장치를 검토하세요.'),
    ('power_strip', 'overloaded_power', 'fire', '멀티탭 손상 또는 허용 용량을 넘는 연결이 있음', '손상된 제품은 사용을 중단하고 과도한 연결을 해소하세요.', '손상된 전기제품은 재배치로 해결할 수 없으므로 적합한 제품으로 교체하세요.'),
    ('door', 'pinch_point', 'trapping', '문이나 접이식 가구에 손이 끼일 수 있는 틈이 있음', '문 여닫는 경로의 물건을 치우고 사용 중 손 위치를 확인하세요.', '필요한 위치에 손 끼임 방지 장치를 보완하세요.'),
    ('hot_drink', 'accessible_hot_liquid', 'burn', '뜨거운 음료가 가장자리 또는 손이 닿는 곳에 있음', '뜨거운 음료를 테이블 가장자리에서 옮기고 주변을 비우세요.', '안정적인 받침과 보관 위치를 확인하세요.'),
    ('bath_water', 'unattended_water', 'drowning', '영유아가 접근할 수 있는 욕조나 용기에 물이 남아 있음', '사용 후 물을 비우고 영유아가 물에 접근하지 않도록 하세요.', '욕실 접근을 막을 수 있는 문 잠금장치를 검토하세요.'),
]
CATALOG.extend(EXTRA_CATALOG)
OBJECT_LABELS.update({'grab_bar':'손잡이 부족','threshold':'문턱·단차','cabinet':'가구 고정','blind_cord':'블라인드 끈','small_parts':'작은 부품','medicine':'약품 보관','power_strip':'멀티탭','door':'손 끼임 틈','hot_drink':'뜨거운 음료','bath_water':'남아 있는 물'})
EXTRA_ROOMS = {
    'grab_bar': ('bathroom','stairs'), 'threshold': ('entrance','hallway','bathroom'),
    'cabinet': ('living_room','bedroom','kitchen'), 'blind_cord': ('living_room','bedroom'),
    'small_parts': ('living_room','bedroom'), 'medicine': ('bedroom','kitchen','bathroom'),
    'power_strip': ('living_room','bedroom','kitchen'), 'door': ('living_room','bedroom','entrance'),
    'hot_drink': ('living_room','kitchen'), 'bath_water': ('bathroom',),
}
for extra_object, extra_rooms in EXTRA_ROOMS.items():
    for extra_room in extra_rooms:
        ROOM_OBJECTS[extra_room].append(extra_object)


def seed_extra_rules(connection):
    # 일반 객체의 존재를 조건부 확인 안내로 연결합니다. 열·내용물·실제 높이를 추정하지 않습니다.
    labels = {'potted_plant':'화분','vase':'꽃병','wine_glass':'유리잔','tv':'TV','oven':'오븐','microwave':'전자레인지','toaster':'토스터','skateboard':'스케이트보드','sports_ball':'공','umbrella':'우산'}
    OBJECT_LABELS.update(labels)
    for target in TARGETS:
        for room in SPACES:
            for obj in labels:
                thermal = obj in ('oven','microwave','toaster')
                condition = 'visible_appliance' if thermal else ('visible_heavy_object' if obj in ('tv','potted_plant','vase') else 'visible_household_object')
                reason = '사진에 가열기기가 보입니다. 작동 상태와 주변 접근·물건을 직접 확인하세요' if thermal else '사진에 물건이 보입니다. 실제 통로를 막거나 불안정하게 놓였는지 확인하세요'
                risk = 'burn' if thermal else 'collision'
                first = '작동 중인 경우 주변 물건을 치우고 사용 후 전원을 확인하세요.' if thermal else '이동 경로를 막는 경우에만 물건을 수납하거나 안정적인 위치로 옮기세요.'
                supplement = '대상자가 접근할 수 있는 위치라면 적절한 접근 방지 장치를 검토하세요.' if thermal else '필요하면 고정 장치와 안정적인 받침을 보완하세요.'
                connection.execute('''INSERT OR IGNORE INTO risk_rules (target_type,space_type,object_type,condition,risk_type,risk_level,reason,recommendation,supplement)
                    VALUES (?,?,?,?,?,?,?,?,?)''', (target,room,obj,condition,risk,'LOW',reason,first,supplement))


def seed_electrical_rules(connection):
    for target in TARGETS:
        for room in SPACES:
            rules = [
                ('electric_wire','visible_cable','fall','LOW','사진에서 전선이 탐지되었습니다. 늘어진 부분과 실제 이동 경로를 확인하세요','늘어진 전선을 벽 쪽으로 정리하고 남는 길이를 묶어 고정하세요.','필요하면 케이블 몰딩이나 고정 클립을 보완하세요.'),
                ('electric_wire','image_low_cable','blocked_movement' if target=='wheelchair' else 'fall','MEDIUM','사진 아래쪽까지 전선이 늘어져 있습니다. 바닥에 닿거나 실제 이동 경로를 가리는지 확인하세요','전선이 실제 이동 경로에 있으면 벽 쪽으로 옮기고 남는 길이를 정리하세요.','필요하면 케이블 몰딩이나 고정 클립을 보완하세요.'),
                ('socket','visible_socket','electric_shock','MEDIUM' if target=='toddler' else 'LOW','사진에서 콘센트가 탐지되었습니다. 대상자의 접근 가능성과 커버·손상 여부를 직접 확인하세요','콘센트 주변의 물건과 늘어진 전선을 정리하세요.','영유아가 접근하는 사용하지 않는 콘센트에는 적절한 안전커버를 보완하세요.'),
                ('power_strip','visible_power_strip','electric_shock','MEDIUM' if target=='toddler' else 'LOW','사진에서 멀티탭이 탐지되었습니다. 실제 통로·물기·손상·허용 용량을 직접 확인하세요','멀티탭과 연결선을 물기 및 이동 경로에서 떨어진 안정적인 위치로 옮기세요.','과부하나 손상은 사진으로 확정할 수 없습니다. 현장에서 점검하고 손상 제품은 사용을 중단하세요.'),
            ]
            for obj,condition,risk,level,reason,first,supplement in rules:
                connection.execute('''INSERT OR IGNORE INTO risk_rules (target_type,space_type,object_type,condition,risk_type,risk_level,reason,recommendation,supplement)
                    VALUES (?,?,?,?,?,?,?,?,?)''',(target,room,obj,condition,risk,level,reason,first,supplement))
