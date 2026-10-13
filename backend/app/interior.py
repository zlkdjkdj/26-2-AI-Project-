"""Stored concept/layout drafts and explicit, server-side photo editing."""
import asyncio
import base64
import binascii
import hashlib
import io
import json
import os
import re
import httpx
from fastapi import HTTPException
from pydantic import BaseModel, Field, ConfigDict
from typing import Literal
from .db import connect

CONCEPTS=[
 {'id':'minimal','name':'미니멀 화이트','tag':'정돈된 여백','description':'밝은 중립색과 간결한 배치. 기존 가구를 살리고 통로를 비워요.','wall':'#f2f0eb','floor':'#d8c6ac','fabric':'#ddd9d1','accent':'#656b70','prompt':'quiet modern minimal, warm white, uncluttered surfaces, existing furniture'},
 {'id':'natural','name':'내추럴 우드','tag':'따뜻한 자연색','description':'우드와 부드러운 베이지. 늘어진 선과 노출된 모서리를 먼저 정리해요.','wall':'#ebe5d8','floor':'#bd966e','fabric':'#c8bca4','accent':'#71806c','prompt':'natural wood and soft beige, restrained earthy palette, reuse existing furniture'},
 {'id':'soft','name':'소프트 모던','tag':'부드러운 포인트','description':'차분한 색상과 부담 없는 포인트. 모서리 보호와 접근성을 함께 고려해요.','wall':'#e8e9ed','floor':'#c9c0b6','fabric':'#c5cddd','accent':'#8584a1','prompt':'soft modern muted gray blue accents, gentle warm light, existing furniture'},
 {'id':'accessible','name':'편안한 동선','tag':'안전을 먼저','description':'색상 대비와 이동 공간을 우선해요. 사용자에게 필요한 지지 위치를 확인해요.','wall':'#f0ece3','floor':'#bfaa8b','fabric':'#c2b49b','accent':'#405b69','prompt':'accessible calm interior, visually clear furniture edges, unobstructed paths, reuse existing furniture'},
]
GENERATION_LOCK=asyncio.Lock()

class Placement(BaseModel):
    model_config=ConfigDict(extra='forbid')
    id: str = Field(max_length=40)
    x: float=Field(ge=0,le=1)
    y: float=Field(ge=0,le=1)
    rotation: Literal[0,90,180,270]=0

class InteriorPlan(BaseModel):
    model_config=ConfigDict(extra='forbid')
    concept: Literal['minimal','natural','soft','accessible']='minimal'
    placements: list[Placement]=Field(default_factory=list,max_length=12)
    room_width: float | None=Field(default=None,ge=1,le=20)
    room_depth: float | None=Field(default=None,ge=1,le=20)

def provider_status():
    return {'provider':'gemini','enabled':os.getenv('INTERIOR_IMAGE_ENABLED','false').lower() in ('true','1','yes'),
            'configured':bool(os.getenv('GEMINI_IMAGE_API_KEY',os.getenv('GEMINI_API_KEY','')).strip()),
            'model':os.getenv('GEMINI_IMAGE_MODEL','gemini-3.1-flash-lite-image'),
            'notice':'실제 사진을 Gemini 이미지 생성 API로 전송합니다. 무료 등급이 없으며 이미지·텍스트 사용 요금이 발생할 수 있습니다. 서버에서 별도 활성화가 필요합니다.'}

def furniture(scan):
    allowed={'chair':('의자',.10,.10),'couch':('소파',.28,.13),'dining_table':('테이블',.22,.15),'bed':('침대',.25,.30),'tv':('TV',.22,.06),'potted_plant':('화분',.07,.07)}
    items=[]
    for index,obj in enumerate(scan.get('detected_objects',[])):
        if obj['object_type'] not in allowed:continue
        kind=obj['object_type'];label,w,h=allowed[kind]
        # Sizes/positions are diagram defaults, never inferred physical dimensions.
        default={'couch':(.25,.22),'bed':(.25,.30),'tv':(.72,.14),'dining_table':(.72,.70),'chair':(.75,.40),'potted_plant':(.13,.78)}[kind]
        items.append({'id':f'object-{index}','kind':kind,'label':label,'width':w,'depth':h,'x':min(.9,default[0]+.02*len(items)),
                      'y':min(.9,default[1]+.015*len(items)),'rotation':0,'source_bbox':obj['bbox']})
        if len(items)==12:break
    return items

def get_plan(scan):
    items=furniture(scan)
    with connect() as con:row=con.execute('SELECT plan_json FROM interior_plans WHERE scan_id=?',(scan['scan_id'],)).fetchone()
    saved=json.loads(row[0]) if row else {'concept':None,'placements':[],'room_width':None,'room_depth':None}
    positions={p['id']:p for p in saved['placements']}
    for item in items:item.update(positions.get(item['id'],{}))
    warnings=[]
    for i,item in enumerate(items):
        w,h=(item['depth'],item['width']) if item['rotation'] in (90,270) else (item['width'],item['depth'])
        if item['x']-w/2<0 or item['x']+w/2>1 or item['y']-h/2<0 or item['y']+h/2>1:warnings.append(f"{item['label']}가 가상 배치도 경계와 겹쳐요.")
        if abs(item['x']-.5)<w/2+.07:warnings.append(f"{item['label']}가 가운데 동선 가이드와 겹쳐요. 실제 출입문과 통로를 확인하세요.")
        for other in items[:i]:
            ow,oh=(other['depth'],other['width']) if other['rotation'] in (90,270) else (other['width'],other['depth'])
            if abs(item['x']-other['x'])<(w+ow)/2 and abs(item['y']-other['y'])<(h+oh)/2:warnings.append(f"{item['label']}와 {other['label']}가 가상 배치도에서 겹쳐요.")
    return {'scan_id':scan['scan_id'],'concepts':CONCEPTS,'selected_concept':saved['concept'],'furniture':items,
            'room_width':saved['room_width'],'room_depth':saved['room_depth'],'warnings':list(dict.fromkeys(warnings)),
            'image_generation':provider_status(),
            'notice':'목록은 사진 탐지 결과입니다. 초기 위치·크기는 가상 배치도 예시이며 평면도 복원이 아닙니다. 실측 치수·문 위치·고정 여부를 확인하세요. 저장한 배치나 생성 이미지로 안전점수는 바뀌지 않습니다.'}

def save_plan(scan,plan):
    allowed={item['id'] for item in furniture(scan)}
    ids=[item.id for item in plan.placements]
    if len(ids)!=len(set(ids)) or not set(ids)<=allowed:raise HTTPException(422,'이 사진에서 탐지된 가구를 중복 없이 선택하세요.')
    with connect() as con:
        con.execute('INSERT INTO interior_plans(scan_id,plan_json) VALUES(?,?) ON CONFLICT(scan_id) DO UPDATE SET plan_json=excluded.plan_json,updated_at=CURRENT_TIMESTAMP',
                    (scan['scan_id'],plan.model_dump_json()))
    return get_plan(scan)

def prompt(scan,plan):
    concept=next(c for c in CONCEPTS if c['id']==plan['selected_concept'])
    actions=[s['first']+' '+s['supplement'] for s in scan['interior_guide']['steps'][:8]]
    layout=[{'furniture':f['label'],'diagram_center':[f['x'],f['y']],'rotation':f['rotation']} for f in plan['furniture']]
    return ('Edit the provided actual room photograph into one realistic concept preview. Preserve the room architecture, camera perspective, windows, doors and identifiable existing furniture. '
            'Reuse furniture, minimize cost and structural changes. Do not add fictitious rooms, replace all furniture or move wall-mounted equipment. '
            'Style: '+concept['prompt']+'. Tidy visible cables with wall-side cable covers; add discreet impact-absorbing corner guards to exposed furniture corners only, never crib bumpers. '
            'Keep exit paths clear; no loose rugs or decorative clutter. For newborns keep a bare infant sleep space, no pillows/toys/soft bedding. '
            'An approximate layout draft is given; it is NOT measured geometry. Do not invent actual dimensions or guaranteed accessibility. '
            'This is a visual proposal, not evidence hazards were fixed. No safety score, guarantees or text overlays. '
            +json.dumps({'target':scan['target_type'],'space':scan['space_type'],'conditional_safety_actions':actions,'approximate_layout':layout},ensure_ascii=False))

async def generate_preview(scan,plan,normalized):
    status=provider_status()
    if not status['enabled'] or not status['configured']:
        raise HTTPException(503,'AI 사진 편집이 아직 활성화되지 않았습니다. 서버의 이미지 모델 설정과 Gemini 결제·사용 한도를 확인하세요. 무료 배치도는 계속 사용할 수 있습니다.')
    if scan['detection_mode']=='mock':raise HTTPException(422,'실제 사진 분석 기록에서만 AI 사진 편집을 사용할 수 있습니다.')
    if plan['selected_concept'] is None:raise HTTPException(422,'먼저 인테리어 컨셉을 선택하고 저장하세요.')
    if hashlib.sha256(normalized).hexdigest()!=scan.get('image_digest'):raise HTTPException(422,'이 점검에 사용한 원본 사진을 선택하세요.')
    if not re.fullmatch(r'[a-zA-Z0-9._-]+',status['model']):raise HTTPException(503,'이미지 생성 모델 설정이 올바르지 않습니다.')
    if GENERATION_LOCK.locked():raise HTTPException(409,'다른 이미지 생성이 진행 중입니다. 완료 후 다시 시도하세요.')
    # Downsize only the provider input, after validating identity and removing EXIF.
    from PIL import Image
    image=Image.open(io.BytesIO(normalized));image.thumbnail((1280,1280));buffer=io.BytesIO();image.save(buffer,format='JPEG',quality=85)
    payload={'contents':[{'role':'user','parts':[{'text':prompt(scan,plan)}, {'inlineData':{'mimeType':'image/jpeg','data':base64.b64encode(buffer.getvalue()).decode()}}]}],
             'generationConfig':{'responseModalities':['TEXT','IMAGE'],'candidateCount':1,'maxOutputTokens':4096}}
    try:
        async with GENERATION_LOCK:
            async with httpx.AsyncClient(timeout=75) as client:
                response=await client.post(f"https://generativelanguage.googleapis.com/v1beta/models/{status['model']}:generateContent",headers={'x-goog-api-key':os.getenv('GEMINI_IMAGE_API_KEY',os.getenv('GEMINI_API_KEY',''))},json=payload)
            if response.status_code in (401,403):raise HTTPException(503,'Gemini 이미지 모델의 키·권한·결제 설정을 확인하세요.')
            if response.status_code==429:raise HTTPException(503,'이미지 생성 한도에 도달했거나 무료 프로젝트에서 사용할 수 없는 모델입니다. 결제·사용 한도를 확인하세요.')
            if response.status_code==404:raise HTTPException(503,'설정한 이미지 생성 모델을 사용할 수 없습니다. 서버 모델명을 확인하세요.')
            response.raise_for_status()
            if len(response.content)>20_000_000:raise ValueError('Image response too large')
            candidates=response.json().get('candidates',[])
            for candidate in candidates:
                if candidate.get('finishReason') not in (None,'STOP'):continue
                for part in candidate.get('content',{}).get('parts',[]):
                    data=part.get('inlineData',part.get('inline_data',{}))
                    if data.get('mimeType',data.get('mime_type')) in ('image/png','image/jpeg','image/webp') and data.get('data'):
                        raw=base64.b64decode(data['data'],validate=True)
                        if len(raw)>8*1024*1024:raise ValueError('Generated image too large')
                        return raw
            raise ValueError('No completed image returned')
    except HTTPException:raise
    except httpx.TimeoutException:raise HTTPException(504,'이미지 생성 응답 시간이 초과되었습니다. 중복 비용을 피하려면 즉시 반복 요청하지 말고 사용 이력을 확인하세요.')
    except (httpx.HTTPError,ValueError,KeyError,TypeError,binascii.Error):
        raise HTTPException(502,'AI가 편집 이미지를 반환하지 못했습니다. 원본과 배치도는 유지됩니다.')
