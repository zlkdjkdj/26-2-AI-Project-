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
from pydantic import BaseModel, Field, ConfigDict, model_validator
from typing import Literal
from .db import connect
from .contextual_advice import advice, image_position
from .layout_recommendations import recommend, warnings_for
from .spatial import measured_inventory, opening_shapes, spatial_warnings

CONCEPTS=[
 {'id':'minimal','name':'미니멀 화이트','tag':'정돈된 여백','description':'밝은 중립색과 간결한 배치. 기존 가구를 살리고 통로를 비워요.','wall':'#f2f0eb','floor':'#d8c6ac','fabric':'#ddd9d1','accent':'#656b70','prompt':'quiet modern minimal, warm white, uncluttered surfaces, existing furniture'},
 {'id':'natural','name':'내추럴 우드','tag':'따뜻한 자연색','description':'우드와 부드러운 베이지. 늘어진 선과 노출된 모서리를 먼저 정리해요.','wall':'#ebe5d8','floor':'#bd966e','fabric':'#c8bca4','accent':'#71806c','prompt':'natural wood and soft beige, restrained earthy palette, reuse existing furniture'},
 {'id':'soft','name':'소프트 모던','tag':'부드러운 포인트','description':'차분한 색상과 부담 없는 포인트. 모서리 보호와 접근성을 함께 고려해요.','wall':'#e8e9ed','floor':'#c9c0b6','fabric':'#c5cddd','accent':'#8584a1','prompt':'soft modern muted gray blue accents, gentle warm light, existing furniture'},
 {'id':'accessible','name':'편안한 동선','tag':'안전을 먼저','description':'색상 대비와 이동 공간을 우선해요. 사용자에게 필요한 지지 위치를 확인해요.','wall':'#f0ece3','floor':'#bfaa8b','fabric':'#c2b49b','accent':'#405b69','prompt':'accessible calm interior, visually clear furniture edges, unobstructed paths, reuse existing furniture'},
]
CONCEPTS.extend([
 {'id':'scandinavian','name':'스칸디나비안','tag':'밝은 빛과 실용성','description':'밝은 우드와 흰색, 실용적인 수납과 가벼운 색 포인트를 조합해요.','wall':'#f5f3ec','floor':'#d5bd98','fabric':'#c5d4d9','accent':'#58747c','prompt':'Scandinavian Nordic interior, light oak, white walls, functional furniture, daylight'},
 {'id':'japandi','name':'재팬디','tag':'차분한 자연 질감','description':'자연스러운 나무와 절제된 장식. 낮은 가구는 사용자의 앉고 일어남을 확인해요.','wall':'#e6dfd0','floor':'#b59a77','fabric':'#c2b7a1','accent':'#5c6252','prompt':'Japandi interior, Japanese Scandinavian fusion, warm neutral plaster, natural wood, restrained decor'},
 {'id':'industrial','name':'인더스트리얼','tag':'소재의 대비','description':'짙은 금속과 우드의 대비. 돌출된 모서리와 이동 경로는 별도로 점검해요.','wall':'#c7c4bf','floor':'#9b8068','fabric':'#a18b77','accent':'#41464a','prompt':'industrial loft interior, exposed brick and metal, dark steel, warm wood, existing furniture'},
 {'id':'classic','name':'클래식','tag':'정돈된 균형','description':'차분한 대칭과 우아한 포인트. 장식을 늘리기보다 기존 가구의 균형을 맞춰요.','wall':'#eee5d6','floor':'#b28c6b','fabric':'#d3c3ac','accent':'#76634e','prompt':'classic traditional interior, elegant symmetry, cream walls, walnut wood, restrained decorative details'},
])
GENERATION_LOCK=asyncio.Lock()

class Placement(BaseModel):
    model_config=ConfigDict(extra='forbid')
    id: str = Field(max_length=48)
    x: float=Field(ge=0,le=1)
    y: float=Field(ge=0,le=1)
    rotation: Literal[0,90,180,270]=0

class CustomFurniture(BaseModel):
    model_config=ConfigDict(extra='forbid')
    id: str=Field(pattern=r'^custom-[a-z0-9-]{1,36}$')
    kind: Literal['chair','couch','bed','dining_table','tv','potted_plant']
    label: str=Field(min_length=1,max_length=30)
    width: float=Field(ge=.04,le=.5)
    depth: float=Field(ge=.04,le=.5)

class RoomOpening(BaseModel):
    model_config=ConfigDict(extra='forbid')
    id: str=Field(min_length=1,max_length=48)
    label: str=Field(min_length=1,max_length=30)
    kind: Literal['door','window']='door'
    wall: Literal['north','south','east','west']='north'
    offset_m: float=Field(ge=0,le=20)
    width_m: float=Field(ge=.2,le=10)
    swing: Literal['inward','outward','sliding']='inward'

class FurnitureMeasurement(BaseModel):
    model_config=ConfigDict(extra='forbid')
    id: str=Field(min_length=1,max_length=48)
    width_m: float | None=Field(default=None,ge=.05,le=20)
    depth_m: float | None=Field(default=None,ge=.05,le=20)
    fixed: bool=False

    @model_validator(mode='after')
    def paired(self):
        if (self.width_m is None)!=(self.depth_m is None):raise ValueError('가구 가로·세로를 모두 입력하세요.')
        return self

class InteriorPlan(BaseModel):
    model_config=ConfigDict(extra='forbid')
    concept: Literal['minimal','natural','soft','accessible','scandinavian','japandi','industrial','classic']='minimal'
    placements: list[Placement]=Field(default_factory=list,max_length=24)
    custom_furniture: list[CustomFurniture]=Field(default_factory=list,max_length=12)
    wall_color: str | None=Field(default=None,pattern=r'^#[0-9a-fA-F]{6}$')
    floor_color: str | None=Field(default=None,pattern=r'^#[0-9a-fA-F]{6}$')
    floor_pattern: Literal['wood','tile','plain']='wood'
    room_width: float | None=Field(default=None,ge=1,le=20)
    room_depth: float | None=Field(default=None,ge=1,le=20)
    openings: list[RoomOpening]=Field(default_factory=list,max_length=12)
    furniture_measurements: list[FurnitureMeasurement]=Field(default_factory=list,max_length=24)

    @model_validator(mode='after')
    def spatial_consistency(self):
        if self.openings or any(m.width_m is not None for m in self.furniture_measurements):
            if not self.room_width or not self.room_depth:raise ValueError('문·창문과 가구 실측을 사용하려면 방 가로·세로를 모두 입력하세요.')
        if len({o.id for o in self.openings})!=len(self.openings):raise ValueError('문·창문 ID가 중복되었습니다.')
        for opening in self.openings:
            length=self.room_width if opening.wall in ('north','south') else self.room_depth
            if opening.offset_m+opening.width_m>length+1e-6:raise ValueError('문·창문의 시작 위치와 폭이 해당 벽 길이를 넘습니다.')
        return self

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
        number=sum(item['kind']==kind for item in items)+1
        items.append({'id':f'object-{index}','kind':kind,'label':f'{label} {number}','width':w,'depth':h,'x':min(.9,default[0]+.02*len(items)),
                      'y':min(.9,default[1]+.015*len(items)),'rotation':0,'source_bbox':obj['bbox'],
                      'photo_position':image_position(obj['bbox']), 'source':'detected', 'advice':advice(kind,scan['target_type'],scan['space_type'])})
        if len(items)==12:break
    return items

def get_plan(scan):
    items=furniture(scan)
    with connect() as con:row=con.execute('SELECT plan_json FROM interior_plans WHERE scan_id=?',(scan['scan_id'],)).fetchone()
    saved=json.loads(row[0]) if row else {'concept':None,'placements':[],'room_width':None,'room_depth':None}
    for custom in saved.get('custom_furniture',[]):
        items.append({**custom,'x':.3,'y':.7,'rotation':0,'source':'user_added','source_bbox':None,
                      'photo_position':'사용자 추가 · 가상 가구','advice':advice(custom['kind'],scan['target_type'],scan['space_type'])})
    positions={p['id']:p for p in saved['placements']}
    for item in items:item.update(positions.get(item['id'],{}))
    measured_inventory(items,saved)
    zones=opening_shapes(saved.get('openings',[]),saved.get('room_width'),saved.get('room_depth'))
    warnings=warnings_for(items)+spatial_warnings(items,zones)
    return {'scan_id':scan['scan_id'],'concepts':CONCEPTS,'selected_concept':saved['concept'],'furniture':items,
            'room_width':saved['room_width'],'room_depth':saved['room_depth'],'warnings':list(dict.fromkeys(warnings)),
            'image_generation':provider_status(),
            'wall_color':saved.get('wall_color'),'floor_color':saved.get('floor_color'), 'floor_pattern':saved.get('floor_pattern','wood'),
            'openings':saved.get('openings',[]),'opening_zones':zones,'furniture_measurements':saved.get('furniture_measurements',[]),
            'measurement_status':{'measured':sum(item['width_source']=='measured' for item in items),'total':len(items)},
            'layout_options':recommend(scan,items,saved['concept'] or 'minimal',zones),
            'notice':'목록은 사진 탐지 결과입니다. 초기 위치·크기는 가상 배치도 예시이며 평면도 복원이 아닙니다. 실측 치수·문 위치·고정 여부를 확인하세요. 저장한 배치나 생성 이미지로 안전점수는 바뀌지 않습니다.'}

def save_plan(scan,plan):
    custom_ids=[item.id for item in plan.custom_furniture]
    if len(custom_ids)!=len(set(custom_ids)):raise HTTPException(422,'사용자 추가 가구의 ID는 중복될 수 없습니다.')
    allowed={item['id'] for item in furniture(scan)} | set(custom_ids)
    measured_ids=[m.id for m in plan.furniture_measurements]
    if len(measured_ids)!=len(set(measured_ids)) or not set(measured_ids)<=allowed:raise HTTPException(422,'실측은 현재 가구를 중복 없이 선택하세요.')
    ids=[item.id for item in plan.placements]
    if len(ids)!=len(set(ids)) or not set(ids)<=allowed:raise HTTPException(422,'탐지된 가구 또는 직접 추가한 가구를 중복 없이 선택하세요.')
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
            +json.dumps({'target':scan['target_type'],'space':scan['space_type'],'conditional_safety_actions':actions,'approximate_layout':layout,
                         'wall_color':plan.get('wall_color'),'floor_color':plan.get('floor_color')},ensure_ascii=False))

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
