import json
import logging
import os
import re
import httpx
from .seed import TARGET_LABELS, SPACE_LABELS

logger = logging.getLogger(__name__)

def provider_status():
    selected = os.getenv('LLM_PROVIDER', 'gemini').strip().lower()
    variable = 'GEMINI_API_KEY' if selected == 'gemini' else 'OPENAI_API_KEY'
    return {'provider':selected, 'configured':bool(os.getenv(variable, '').strip()),
            'model':os.getenv('GEMINI_MODEL', 'gemini-3.1-flash-lite') if selected == 'gemini' else os.getenv('OPENAI_MODEL','gpt-4.1-mini')}

async def explain(hazards: list[dict], target_type: str, space_type: str, detection_mode='mock') -> dict:
    is_mock = detection_mode == 'mock'
    count = len(hazards)
    if not count:
        fallback = '현재 모델과 위험규칙에서 확인할 항목을 찾지 못했습니다. 이는 공간이 안전하다는 뜻이 아닙니다. 전선·콘센트·바닥 물기와 실제 이동 경로는 직접 확인해 주세요.'
    else:
        prefix = '모의 점검' if is_mock else '사진 분석'
        first = hazards[0]['recommendation']
        fallback = f'{TARGET_LABELS[target_type]}의 {SPACE_LABELS[space_type]} {prefix}에서 확인할 항목 {count}개가 규칙과 일치했습니다. {first} 먼저 정리와 위치 조정부터 시작하고 필요한 안전용품을 보완하세요.'
    status = provider_status()
    provider = status['provider']
    key = os.getenv('GEMINI_API_KEY' if provider == 'gemini' else 'OPENAI_API_KEY', '').strip()
    fallback_response = {'mode':'rule_template', 'summary':fallback, 'notice':'설명 API 키가 없어 위험 DB 기반 안내를 제공합니다.'}
    if not key:
        return fallback_response
    facts = [{k:h[k] for k in ('object_label','risk_level','description','accident','recommendation','supplement')} for h in hazards]
    instructions = ('한국어로 생활안전 점검 결과를 4문장 이내로 안내하세요. 입력의 DB 위험 이유, 예상 사고, 개선방법만 사용하세요. '
                    '새로운 객체·위험·치수·조건·위험등급을 만들지 마세요. 정리→재배치→보완 순으로 안내하고 교체나 구매를 먼저 제안하지 마세요. '
                    '사진 속 2D 위치는 실제 높이·물기·통로 폭·이동 경로를 확정하지 못합니다. 조건부 확인 안내를 유지하세요. '
                    '항목이 없으면 안전하다고 단정하지 마세요. ' + ('입력은 Mock 예시입니다. 모의 점검이라고 명시하세요.' if is_mock else '객체탐지 결과를 설명하는 역할이며 당신이 사진을 직접 본 것이 아닙니다.'))
    user_input = json.dumps({'target':TARGET_LABELS[target_type], 'space':SPACE_LABELS[space_type], 'hazards':facts},ensure_ascii=False)
    try:
        async with httpx.AsyncClient(timeout=22) as client:
            if provider == 'gemini':
                model = status['model']
                if not re.fullmatch(r'[a-zA-Z0-9._-]+',model):
                    raise ValueError('Invalid model id')
                response = await client.post(f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
                    headers={'x-goog-api-key':key}, json={
                        'systemInstruction':{'parts':[{'text':instructions}]},
                        'contents':[{'role':'user','parts':[{'text':user_input}]}],
                        'generationConfig':{'maxOutputTokens':1400,'temperature':.2},
                    })
                response.raise_for_status()
                candidate = response.json().get('candidates',[])[0]
                if candidate.get('finishReason') != 'STOP':
                    raise ValueError('Incomplete explanation')
                summary = '\n'.join(part['text'] for part in candidate.get('content',{}).get('parts',[]) if 'text' in part and not part.get('thought')).strip()
            elif provider == 'openai':
                response = await client.post('https://api.openai.com/v1/responses',headers={'Authorization':f'Bearer {key}'},json={
                    'model':status['model'], 'store':False, 'instructions':instructions, 'input':user_input, 'max_output_tokens':600})
                response.raise_for_status()
                body = response.json()
                if body.get('status') != 'completed':
                    raise ValueError('Incomplete explanation')
                summary = '\n'.join(part['text'] for item in body.get('output',[]) for part in item.get('content',[]) if part.get('type') == 'output_text').strip()
            else:
                raise ValueError('Unknown provider')
            if not summary:
                raise ValueError('Empty explanation')
            return {'mode':provider,'summary':summary, 'notice':'서버의 객체탐지·위험 DB 결과에 근거한 설명입니다.'}
    except (httpx.HTTPError, ValueError, KeyError, TypeError, IndexError):
        # Do not log request headers, API keys or raw provider responses.
        logger.warning('Explanation provider unavailable; using rule template.')
        return {**fallback_response,'notice':'설명 API 연결에 실패하여 위험 DB 기반 안내를 제공합니다.'}
