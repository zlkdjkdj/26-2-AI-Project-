from .db import connect
from .seed import OBJECT_LABELS, TARGET_LABELS, SPACE_LABELS

DEDUCTIONS = {'HIGH': 25, 'MEDIUM': 12, 'LOW': 5}
SCORE_VERSION='v2-conservative'
ACCIDENT_LABELS = {'fall': '걸림 또는 낙상', 'electric_shock': '감전', 'collision': '충돌·타박상', 'cut': '베임', 'burn': '화상', 'poisoning': '세제 오인 섭취', 'slip': '미끄러짐', 'blocked_movement': '이동 방해·충돌', 'fall_from_height': '추락', 'falling_object': '낙하물 충격', 'tipping':'가구 전도', 'entanglement':'끈 얽힘', 'choking':'이물질 삼킴·질식', 'fire':'전기 화재', 'trapping':'손 끼임', 'drowning':'물에 빠짐'}

ACCIDENT_LABELS['suffocation']='질식'

def score_policy():
    return {'version':SCORE_VERSION,'deductions':DEDUCTIONS,'photo_ceiling':80,'high_ceiling':60,'multiple_high_ceiling':40,
            'notice':'100점에서 고위험 25점·중위험 12점·저위험 5점을 차감합니다. 사진 점수 상한 80점, 고위험 1개 이상은 최대 60점, 2개 이상은 최대 40점입니다. 사진으로 확인하지 못한 조건은 안전으로 확정하지 않습니다. 검증된 사고 확률이 아닌 서비스의 보수적 참고 기준입니다.'}

def safety_score(hazards: list[dict], version=SCORE_VERSION) -> int:
    if version=='v1':
        return max(0,100-sum({'HIGH':15,'MEDIUM':7,'LOW':3}[h['risk_level']] for h in hazards))
    if not hazards:return 100
    high=sum(h['risk_level']=='HIGH' for h in hazards)
    cap=40 if high>=2 else 60 if high else 80
    return max(0,min(cap,100-sum(DEDUCTIONS[h['risk_level']] for h in hazards)))

def combined_score(photo,confirmed,version=SCORE_VERSION):
    # A manual confirmation of the same object group is not a second physical object.
    merged=list(photo)
    for check in confirmed:
        matches=[h for h in merged if h.get('object')==check['key']]
        if matches and any(h['risk_level']==check['risk_level'] for h in matches):continue
        if matches:
            weakest=min(matches,key=lambda h:DEDUCTIONS[h['risk_level']])
            if DEDUCTIONS[check['risk_level']]>DEDUCTIONS[weakest['risk_level']]:
                merged.remove(weakest);merged.append({**check,'object':check['key']})
        else:merged.append({**check,'object':check['key']})
    return safety_score(merged,version) if merged else None

def evaluate(detections: list[dict], target_type: str, space_type: str) -> list[dict]:
    hazards = []
    seen = set()
    with connect() as connection:
        for detection_index, detection in enumerate(detections):
            rows = connection.execute('SELECT * FROM risk_rules WHERE target_type=? AND space_type=? AND object_type=?',
                                      (target_type, space_type, detection['object_type'])).fetchall()
            for rule in rows:
                identity = (detection_index, rule['id'])
                if rule['condition'] not in detection['evidence'] or identity in seen:
                    continue
                seen.add(identity)
                accident = ACCIDENT_LABELS[rule['risk_type']]
                description = (f"{rule['reason']}. {TARGET_LABELS[target_type]} 기준의 확인 항목입니다." if detection['evidence_source'] != 'mock' else f"{SPACE_LABELS[space_type]}의 {rule['reason']} 조건은 {TARGET_LABELS[target_type]}에게 위험할 수 있습니다.")
                if detection.get('classification_uncertain'):
                    description += ' 유사한 물건과 분류가 모호하므로 종류를 직접 확인한 후 안내를 적용하세요.'
                hazards.append({
                    'rule_id': rule['id'], 'object': detection['object_type'],
                    'object_label': OBJECT_LABELS[detection['object_type']],
                    'risk_level': rule['risk_level'], 'risk_type': rule['risk_type'],
                    'confidence': detection['confidence'], 'bbox': detection['bbox'],
                    'classification_uncertain': detection.get('classification_uncertain', False),
                    'alternative_labels': detection.get('alternative_labels', []),
                    'reference_check': detection.get('reference_check'),
                    'condition': rule['condition'], 'evidence_source': detection['evidence_source'],
                    'description': description,
                    'accident': f'{accident} 사고가 발생할 수 있습니다.',
                    'recommendation': rule['recommendation'], 'supplement': rule['supplement'],
                    'recommendation_priority': ['정리·재배치', '안전용품 보완'],
                    'resolved': False,
                })
    return hazards
