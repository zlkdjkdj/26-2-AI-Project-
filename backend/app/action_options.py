"""Work/cost categories, not product prices or promises of total cost."""
def options(step):
    text=step['first']+' '+step['supplement']
    heavy=any(word in text for word in ('침대','소파','가구 위치','옮겨 앉','고정 상태'))
    professional=any(word in step['supplement'] for word in ('벽체','제조사','전문','교체','고정 장치'))
    purchase=any(word in step['supplement'] for word in ('몰딩','클립','안전커버','보호대','패드','야간조명','안전문','잠금장치','설치','보완'))
    return [
        {'action':step['first'],'budget':'no_purchase','budget_label':'새 구매 없이 확인·정리','effort':'assistance' if heavy else 'quick',
         'effort_label':'함께 작업·확인 권장' if heavy else '간단한 확인·정리','kind':'first'},
        {'action':step['supplement'],'budget':'professional' if professional else 'accessories' if purchase else 'no_purchase',
         'budget_label':'설치·교체 견적 확인' if professional else '소품·보완용품 구매 검토' if purchase else '새 구매 없이 확인·정리',
         'effort':'assistance' if professional else 'moderate' if purchase else 'quick',
         'effort_label':'설치 조건·도움 확인' if professional else '보완 작업 필요' if purchase else '간단한 확인·정리','kind':'supplement'},
    ]
