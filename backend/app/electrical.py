"""Local Grounding DINO detector for electrical cable, wall outlet and power strip.

Each category gets a separate target-first query with related alternatives.
A text-conditioned detector is used; no photo is sent to a generative LLM.
"""
from contextlib import nullcontext
import io
import os
from threading import RLock
import numpy as np
import onnxruntime as ort
from PIL import Image
from tokenizers import Tokenizer
from .config import local_path
from .reference_verifier import annotate as annotate_reference

LOCK=RLock()
_CACHE=None
_CACHE_ID=None
QUERIES=(('electric_wire','전선','electrical cable. electrical outlet. power strip.'),('socket','콘센트','electrical outlet. electrical cable. power strip.'),('power_strip','멀티탭','power strip. electrical outlet. electrical cable.'))

class ElectricalUnavailable(Exception):
    pass


def enabled():
    return os.getenv('ELECTRICAL_DETECTION_ENABLED','true').lower() in ('true','1','yes')


def directory():
    return local_path(os.getenv('ELECTRICAL_MODEL_DIR','models/grounding-dino'))


def load():
    global _CACHE,_CACHE_ID
    root=directory();model=root/'model_quantized.onnx';tokenizer=root/'tokenizer.json'
    if not model.is_file() or not tokenizer.is_file():
        raise ElectricalUnavailable('전선·전기설비 모델이 없습니다. scripts/setup_electrical_model.py를 실행하세요.')
    try:threads=int((os.getenv('ELECTRICAL_CPU_THREADS') or str(min(6,max(1,(os.cpu_count() or 2)//2)))))
    except ValueError as exc:raise ElectricalUnavailable('전기설비 CPU 스레드 설정이 올바르지 않습니다.') from exc
    shared=os.getenv('ELECTRICAL_SHARED_VISION','true').lower() in ('true','1','yes')
    identity=(str(root),model.stat().st_mtime_ns,tokenizer.stat().st_mtime_ns,threads,shared)
    if identity==_CACHE_ID and _CACHE is not None:
        return _CACHE
    with LOCK:
        if identity!=_CACHE_ID:
            try:
                if not 1<=threads<=6:
                    raise ValueError('Electrical CPU threads must be between 1 and 6')
                options=ort.SessionOptions();options.intra_op_num_threads=threads;options.inter_op_num_threads=1;options.log_severity_level=3
                from .shared_vision import make_session
                session=make_session(model,options) if shared else ort.InferenceSession(str(model),sess_options=options,providers=['CPUExecutionProvider'])
                tokenizer_model=Tokenizer.from_file(str(tokenizer))
                queries=[]
                for kind,label,prompt in QUERIES:
                    encoding=tokenizer_model.encode(prompt)
                    indices=[i for i,(a,b) in enumerate(encoding.offsets) if b>a and b<=prompt.index('.')]
                    queries.append((kind,label,encoding,indices))
                _CACHE=(session,queries);_CACHE_ID=identity
            except Exception as exc:
                _CACHE=None;_CACHE_ID=None
                raise ElectricalUnavailable('전선·전기설비 모델을 읽지 못했습니다. 모델 파일을 확인하세요.') from exc
        return _CACHE


def status():
    if not enabled():
        return {'enabled':False,'ready':False,'name':None,'classes':[]}
    try:
        load();ready=True
    except ElectricalUnavailable:
        ready=False
    return {'enabled':True,'ready':ready,'name':'Grounding DINO tiny / ONNX','classes':['electric_wire','socket','power_strip']}


def image_tensor(image):
    array=np.asarray(image.resize((800,800),Image.Resampling.BILINEAR),dtype=np.float32)/255
    array=(array-np.array([.485,.456,.406],dtype=np.float32))/np.array([.229,.224,.225],dtype=np.float32)
    return np.ascontiguousarray(array.transpose(2,0,1)[None])


def normalized_box(box):
    cx,cy,width,height=map(float,box)
    x1,y1=max(0,cx-width/2),max(0,cy-height/2)
    x2,y2=min(1,cx+width/2),min(1,cy+height/2)
    return [x1,y1,max(0,x2-x1),max(0,y2-y1)]


def iou(a,b):
    x1,y1=max(a[0],b[0]),max(a[1],b[1]);x2,y2=min(a[0]+a[2],b[0]+b[2]),min(a[1]+a[3],b[1]+b[3])
    intersection=max(0,x2-x1)*max(0,y2-y1)
    return intersection/(a[2]*a[3]+b[2]*b[3]-intersection+1e-9)


def suppress(detections):
    kept=[]
    for item in sorted(detections,key=lambda d:d['confidence'],reverse=True):
        if any(item['object_type']==other['object_type'] and iou(item['bbox'],other['bbox'])>.45 for other in kept):
            continue
        kept.append(item)
    # Related categories may match the same body. Keep the strongest match, expose ambiguity.
    result=[]
    for item in kept:
        overlaps=[other for other in result if other['object_type']!=item['object_type'] and iou(item['bbox'],other['bbox'])>.75]
        if overlaps:
            winner=overlaps[0]
            if winner['confidence']-item['confidence']<.08:
                winner['classification_uncertain']=True
                winner.setdefault('alternative_labels',[]).append(item['object_label'])
            continue
        result.append(item)
    return result[:15]


def query(session,tensor,encoding,indices):
    inputs={'pixel_values':tensor,'input_ids':np.array([encoding.ids],dtype=np.int64),
            'token_type_ids':np.array([encoding.type_ids],dtype=np.int64),
            'attention_mask':np.array([encoding.attention_mask],dtype=np.int64),
            'pixel_mask':np.ones((1,800,800),dtype=np.int64)}
    outputs=dict(zip([o.name for o in session.get_outputs()],session.run(None,inputs)))
    logits=outputs['logits'][0]
    probabilities=1/(1+np.exp(-np.clip(logits,-40,40)))
    scores=probabilities[:,indices].max(axis=1)
    return scores,outputs['pred_boxes'][0]


def evidence(kind,bbox):
    if kind=='electric_wire':
        return ['image_low_cable' if bbox[1]+bbox[3]>=.85 else 'visible_cable']
    return ['visible_socket'] if kind=='socket' else ['visible_power_strip']

def map_crop_box(box,region):
    x1,y1,x2,y2=region
    return [x1+box[0]*(x2-x1),y1+box[1]*(y2-y1),box[2]*(x2-x1),box[3]*(y2-y1)]

def cable_proposals(scores,boxes,threshold):
    proposals=[]
    for index in np.argsort(scores)[::-1]:
        if not .12<=scores[index]<threshold:continue
        box=normalized_box(boxes[index])
        if box[2]*box[3]>.15 or min(box[2],box[3])<.003 or max(box[2],box[3])>.65:continue
        if any(iou(box,other)>.5 for other in proposals):continue
        proposals.append(box)
        if len(proposals)==2:break
    return proposals

def refine_cables(image,session,encoding,indices,scores,boxes,threshold):
    refined=[]
    for proposal in cable_proposals(scores,boxes,threshold):
        cx,cy=proposal[0]+proposal[2]/2,proposal[1]+proposal[3]/2
        w,h=max(.22,proposal[2]*1.8),max(.22,proposal[3]*1.8)
        region=(max(0,cx-w/2),max(0,cy-h/2),min(1,cx+w/2),min(1,cy+h/2))
        x1,y1,x2,y2=region
        crop=image.crop((round(x1*image.width),round(y1*image.height),round(x2*image.width),round(y2*image.height)))
        local_scores,local_boxes=query(session,image_tensor(crop),encoding,indices)
        for index in np.flatnonzero(local_scores>=threshold+.03):
            local=normalized_box(local_boxes[index]);mapped=map_crop_box(local,region)
            area=mapped[2]*mapped[3];proposal_area=proposal[2]*proposal[3]
            aspect=max(mapped[2],mapped[3])/max(min(mapped[2],mapped[3]),1e-9)
            # Weak proposals must remain spatially coherent after enlargement.
            # Reject expanded appliance bodies and tiny, almost square line/texture fragments.
            if local[2]*local[3]>.85 or iou(mapped,proposal)<.2 or area>proposal_area*1.8:continue
            if area<.004 and aspect<3:continue
            refined.append({'object_type':'electric_wire','object_label':'전선','confidence':round(float(local_scores[index]),4),
                'bbox':mapped,'evidence':evidence('electric_wire',mapped),'evidence_source':'grounding_dino_image',
                'detector':'grounding_dino','refined_crop':True,'refinement':'cable_candidate',
                'score_kind':'model_match_not_calibrated_probability'})
    return refined


def detect(content):
    if not enabled():
        return []
    session,queries=load()
    image=Image.open(io.BytesIO(content)).convert('RGB')
    # A near-uniform image has no usable visual detail; text-conditioned models can hallucinate a full-frame box.
    # This is an image-quality gate, not a declaration that an unrecognizable space is safe.
    grayscale=np.asarray(image.convert('L'),dtype=np.float32)
    if float(grayscale.std())<.5:
        return []
    tensor=image_tensor(image)
    threshold=float(os.getenv('ELECTRICAL_BOX_THRESHOLD','.35'))
    if not .2<=threshold<=.8:
        raise ElectricalUnavailable('전기설비 모델 기준값은 0.2~0.8 범위로 설정하세요.')
    detections=[]
    with LOCK, (session.request_scope() if hasattr(session,'request_scope') else nullcontext()):
        try:
            for kind,label,encoding,indices in queries:
                scores,boxes=query(session,tensor,encoding,indices)
                if kind=='electric_wire' and os.getenv('ELECTRICAL_CABLE_REFINEMENT','true').lower() in ('true','1','yes'):
                    detections.extend(refine_cables(image,session,encoding,indices,scores,boxes,threshold))
                if kind=='socket':
                    # Recheck one weak small outlet proposal in a larger local crop.
                    weak=[int(i) for i in np.argsort(scores)[::-1] if .18<=scores[i]<threshold and boxes[i][2]<.12 and boxes[i][3]<.12]
                    if weak:
                        proposal=normalized_box(boxes[weak[0]])
                        cx,cy=proposal[0]+proposal[2]/2,proposal[1]+proposal[3]/2
                        cw,ch=max(.2,proposal[2]*8),max(.2,proposal[3]*8)
                        x1,y1=max(0,cx-cw/2),max(0,cy-ch/2)
                        x2,y2=min(1,cx+cw/2),min(1,cy+ch/2)
                        crop=image.crop((round(x1*image.width),round(y1*image.height),round(x2*image.width),round(y2*image.height)))
                        local_scores,local_boxes=query(session,image_tensor(crop),encoding,indices)
                        for local_index in np.flatnonzero(local_scores>=threshold):
                            local=normalized_box(local_boxes[local_index])
                            mapped=[x1+local[0]*(x2-x1),y1+local[1]*(y2-y1),local[2]*(x2-x1),local[3]*(y2-y1)]
                            if iou(mapped,proposal)<.25:
                                continue
                            detections.append({'object_type':kind,'object_label':label,'confidence':round(float(local_scores[local_index]),4),
                                'bbox':mapped,'evidence':evidence(kind,mapped),'evidence_source':'grounding_dino_image',
                                'detector':'grounding_dino','refined_crop':True,'score_kind':'model_match_not_calibrated_probability'})
                for index in np.flatnonzero(scores>=threshold):
                    bbox=normalized_box(boxes[index])
                    if bbox[2]*image.width<3 or bbox[3]*image.height<3:
                        continue
                    detections.append({'object_type':kind,'object_label':label,'confidence':round(float(scores[index]),4),
                        'bbox':bbox,'evidence':evidence(kind,bbox),'evidence_source':'grounding_dino_image',
                        'detector':'grounding_dino','score_kind':'model_match_not_calibrated_probability'})
        except ElectricalUnavailable:
            raise
        except Exception as exc:
            raise ElectricalUnavailable('전선·전기설비 분석에 실패했습니다. 서버 로그와 모델을 확인하세요.') from exc
    return annotate_reference(image,suppress(detections))
