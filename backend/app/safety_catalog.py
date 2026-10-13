"""Additional source-backed field checks; no fabricated image detections."""
from .seed import CATALOG, ROOM_OBJECTS, OBJECT_LABELS, TARGETS

CPSC='https://www.cpsc.gov/safety-education/safety-guides/kids-and-babies/Childproofing-Your-Home'
CRIB='https://www.cpsc.gov/safety-education/safety-guides/cribs/crib-safety-tips'
CDC='https://www.cdc.gov/steadi/patient-resources/index.html'
ITEMS=[
 ('sleep_bedding','수면공간의 푹신한 물건','soft_sleep_objects','suffocation',('newborn',),('bedroom','living_room'),'HIGH','신생아 수면공간에 베개·쿠션·인형·느슨한 침구가 있나요?','아기 수면공간에서 푹신한 물건과 느슨한 침구를 치우세요.','안전 기준에 맞는 아기 침대와 단단하고 평평한 매트리스를 제조사 안내에 맞춰 사용하세요.',CRIB),
 ('crib_cord','아기 침대 주변 끈','cord_near_crib','entanglement',('newborn','toddler'),('bedroom','living_room'),'HIGH','아기 침대에 닿는 전선·커튼·블라인드 끈이 있나요?','아기 침대를 끈과 전선이 닿지 않는 위치로 옮기세요.','끈이 늘어지지 않도록 고정하고 아기 접근을 차단하세요.',CRIB),
 ('crib_gap','아기 침대 틈·파손','unsafe_crib_gap','trapping',('newborn',),('bedroom','living_room'),'HIGH','침대와 매트리스 사이 틈 또는 침대 부품의 풀림·파손이 있나요?','제품 안내에 맞는 매트리스인지 확인하고 풀린 부품을 점검하세요.','파손되었거나 적합한 조합이 아니면 사용을 중단하고 제조사 안내에 따라 보완하세요.',CRIB),
 ('changing_surface','기저귀 교환대 가장자리','unsecured_changing_surface','fall_from_height',('newborn',),('bedroom','living_room','bathroom'),'HIGH','기저귀 교환대 주변에 떨어질 물건이 있거나 아기를 혼자 두게 되는 배치인가요?','필요한 물품을 손 닿는 곳에 정리하고 아기를 두고 자리를 비우지 마세요.','제품의 안전장치를 제조사 안내에 따라 사용하세요.',CPSC),
 ('plastic_bag','비닐·포장재','accessible_plastic_bag','suffocation',('newborn','toddler'),('living_room','bedroom','kitchen'),'HIGH','아기 주변에 비닐봉지나 포장 필름이 놓여 있나요?','비닐과 포장재를 즉시 치워 아기와 분리하세요.','닫힌 수납공간에 보관하고 수면공간에는 두지 마세요.',CPSC),
 ('button_battery','버튼전지·자석','accessible_battery','choking',('newborn','toddler'),('living_room','bedroom','kitchen'),'HIGH','버튼전지·작은 자석 또는 열리는 전지함이 아기 주변에 있나요?','작은 전지와 자석을 접근할 수 없는 닫힌 수납공간으로 옮기세요.','전지함의 잠금·나사 상태를 제품 안내에 따라 확인하세요.',CPSC),
 ('bedside_light','침대 옆 조명 접근','unreachable_bed_light','fall',('elderly','limited_mobility'),('bedroom',),'HIGH','침대에서 일어나기 전에 조명을 켜기 어렵나요?','조명 스위치를 침대에서 손이 닿는 위치로 옮기세요.','눈부심을 줄이는 야간조명을 침대에서 출입구까지 보완하세요.',CDC),
 ('unstable_seat','불안정한 의자','unstable_seat','fall',('elderly','limited_mobility'),('living_room','bedroom','kitchen'),'HIGH','의자가 흔들리거나 앉고 일어날 때 미끄러지나요?','안정적인 바닥에 의자를 두고 주변 물건을 치우세요.','파손된 의자는 사용을 중단하고 고정·수리가 가능한지 확인하세요.',CDC),
 ('unsupported_transfer','침대·좌석 이동 지지','unsupported_transfer','fall',('elderly','limited_mobility','wheelchair'),('bedroom','living_room','bathroom'),'HIGH','앉고 일어날 때 움직이는 가구를 잡아야 하거나 지지할 곳이 없나요?','불안정한 가구를 지지대로 사용하지 않고 이동 동선을 비우세요.','사용자의 이동 방식과 설치 조건에 맞는 고정 손잡이를 검토하세요.',CDC),
 ('uneven_step','계단 디딤판 손상','uneven_step','fall',('elderly','limited_mobility'),('stairs','entrance'),'HIGH','디딤판이 고르지 않거나 표면이 손상되어 걸릴 수 있나요?','손상된 디딤판 주변을 비우고 위치를 확인하세요.','재배치로 해결되지 않는 손상은 수리를 검토하세요.',CDC),
 ('reaching_storage','높은 수납 접근','unsafe_reaching','fall',('elderly','limited_mobility'),('kitchen','bedroom','living_room'),'HIGH','자주 쓰는 물건을 꺼내려면 의자에 올라가거나 몸을 크게 뻗어야 하나요?','자주 쓰는 물건을 손이 닿는 낮은 수납 위치로 옮기세요.','무거운 물건은 안정적인 아래쪽에 보관하세요.',CDC),
 ('bathroom_access','욕실 이동 동선','blocked_bathroom_transfer','fall',('elderly','limited_mobility','wheelchair'),('bathroom',),'HIGH','변기·세면대 이동 경로에 물건이 있거나 몸을 돌릴 공간이 부족한가요?','이동 경로의 물건을 치우고 실제 사용 동선을 확인하세요.','물기 제거와 필요한 고정 손잡이를 함께 점검하세요.',CDC),
]

for obj,label,condition,risk,targets,rooms,level,reason,first,supplement,source in ITEMS:
    CATALOG.append((obj,condition,risk,reason,first,supplement))
    OBJECT_LABELS[obj]=label
    for room in rooms:
        if obj not in ROOM_OBJECTS[room]:ROOM_OBJECTS[room].append(obj)
SOURCE_BY_OBJECT={item[0]:item[-1] for item in ITEMS}
SOURCE_BY_OBJECT['furniture_corner']=CPSC
for room in ('bedroom','kitchen','hallway','entrance'):
    if 'furniture_corner' not in ROOM_OBJECTS[room]:ROOM_OBJECTS[room].append('furniture_corner')

def seed_safety_rules(connection):
    # Add only relevant target rows. Keep these checks out of generic all-target seeds.
    for obj,label,condition,risk,targets,rooms,level,reason,first,supplement,source in ITEMS:
        for target in targets:
            for room in rooms:
                connection.execute('''INSERT INTO risk_rules(target_type,space_type,object_type,condition,risk_type,risk_level,reason,recommendation,supplement)
                    VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(target_type,space_type,object_type,condition) DO UPDATE SET reason=excluded.reason,recommendation=excluded.recommendation,supplement=excluded.supplement,risk_level=excluded.risk_level''',(target,room,obj,condition,risk,level,reason,first,supplement))
    connection.execute("UPDATE risk_rules SET supplement=? WHERE object_type='furniture_corner' OR (object_type IN ('chair','couch','bed','dining_table') AND condition='visible_furniture')",('날카로운 모서리가 노출된 경우 충격을 흡수하는 모서리 몰딩·보호대를 단단히 고정하세요. 분리된 작은 부품은 아기 접근을 막고, 아기 침대 내부에는 패딩·범퍼를 추가하지 마세요.',))
    for target in ('newborn','elderly','limited_mobility'):
        for room in ('living_room','bedroom','kitchen','hallway','entrance'):
            connection.execute('''INSERT INTO risk_rules(target_type,space_type,object_type,condition,risk_type,risk_level,reason,recommendation,supplement) VALUES (?,?,?,?,?,?,?,?,?)
                ON CONFLICT(target_type,space_type,object_type,condition) DO UPDATE SET recommendation=excluded.recommendation,supplement=excluded.supplement''',(target,room,'furniture_corner','near_path','collision','MEDIUM','보호자 또는 대상자의 이동 경로 가까이에 날카로운 모서리가 있나요?','가능하면 가구 위치를 조정하여 모서리와 이동 경로를 떨어뜨리세요.','충격 흡수 모서리 몰딩·보호대를 보완하고 고정 상태와 분리 가능성을 확인하세요.'))
