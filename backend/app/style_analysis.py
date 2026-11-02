"""Local CLIP image/text similarity; candidates, not certified style labels."""
import io
import os
from threading import RLock
import numpy as np
import onnxruntime as ort
from PIL import Image,ImageOps
from tokenizers import Tokenizer
from fastapi import HTTPException
from .config import local_path

LOCK=RLock()
_CACHE=None

def root():return local_path(os.getenv('STYLE_MODEL_DIR','models/clip-style'))

def status():
    ready=all((root()/name).is_file() for name in ('vision_model_quantized.onnx','text_model_quantized.onnx','tokenizer.json','preprocessor_config.json'))
    return {'ready':ready,'mode':'local_clip','external_api':False,'model':'CLIP ViT-B/32 quantized ONNX',
            'notice':'사진은 서버 CPU에서 분석하며 외부 이미지 API로 전송하거나 원본을 저장하지 않습니다. 스타일 후보는 유사도이며 정답 확률이 아닙니다.'}

def unit(values):return values/np.maximum(np.linalg.norm(values,axis=-1,keepdims=True),1e-9)

def load():
    global _CACHE
    if not status()['ready']:raise HTTPException(503,'스타일 모델을 준비해 주세요: scripts/setup_style_model.py')
    with LOCK:
        if _CACHE is not None and _CACHE[0]==str(root()):return _CACHE[1:]
        from .interior import CONCEPTS
        options=ort.SessionOptions();options.intra_op_num_threads=2;options.inter_op_num_threads=1
        options.log_severity_level=3
        vision=ort.InferenceSession(str(root()/'vision_model_quantized.onnx'),sess_options=options,providers=['CPUExecutionProvider'])
        text=ort.InferenceSession(str(root()/'text_model_quantized.onnx'),sess_options=options,providers=['CPUExecutionProvider'])
        tokenizer=Tokenizer.from_file(str(root()/'tokenizer.json'))
        tokenizer.enable_truncation(max_length=77);tokenizer.enable_padding(length=77,pad_id=49407,pad_token='<|endoftext|>')
        concepts=[c for c in CONCEPTS if c['id']!='accessible']
        descriptions=[c['prompt'] for c in concepts]+['a photograph of a dog or cat animal','a photograph of food on a plate',
            'an outdoor landscape or street photograph','a document, screenshot, diagram or printed text',
            'a close up photograph of a single small object']
        embeddings=[]
        for description in descriptions:
            prompts=[f'a photograph of {description}',f'an interior designed in {description} style',f'a room with {description}'] if description in [c['prompt'] for c in concepts] else [description]*3
            ids=np.array([e.ids for e in tokenizer.encode_batch(prompts)],dtype=np.int64)
            embeddings.append(unit(unit(text.run(['text_embeds'],{'input_ids':ids})[0]).mean(axis=0)))
        _CACHE=(str(root()),vision,concepts,np.stack(embeddings))
        return _CACHE[1:]

def palette(image):
    small=image.resize((96,96)).quantize(colors=5)
    colors=small.getpalette();counts=sorted(small.getcolors(),reverse=True)
    return ['#' + ''.join(f'{v:02x}' for v in colors[index*3:index*3+3]) for _,index in counts]

def analyze(content):
    image=Image.open(io.BytesIO(content)).convert('RGB')
    base={'mode':'local_clip','stored':False,'external_api':False,'palette':palette(image),
          'notice':'학습된 CLIP 모델이 사진과 컨셉 설명의 유사도를 비교합니다. 실내 디자인 전용 정확도 검증 결과가 아니며 비슷한 스타일은 혼합되어 보일 수 있습니다. 사진의 대표색은 벽·바닥의 색을 구분한 결과가 아닙니다.'}
    if np.asarray(image.convert('L')).std()<3:
        return {**base,'status':'insufficient_detail','candidates':[],'ambiguous':True}
    with LOCK:
        vision,concepts,texts=load()
        cropped=ImageOps.fit(image,(224,224),method=Image.Resampling.BICUBIC)
        pixels=np.asarray(cropped,dtype=np.float32)/255
        pixels=(pixels-np.array([.48145466,.4578275,.40821073],np.float32))/np.array([.26862954,.26130258,.27577711],np.float32)
        values=np.ascontiguousarray(pixels.transpose(2,0,1)[None])
        try:embedding=unit(vision.run(['image_embeds'],{'pixel_values':values})[0])[0]
        except Exception as exc:raise HTTPException(503,'스타일 모델 추론에 실패했습니다. 모델 설치를 확인하세요.') from exc
        scores=texts@embedding
    ranked=np.argsort(scores[:len(concepts)])[::-1]
    margin=float(scores[ranked[0]]-scores[ranked[1]])
    if max(scores[len(concepts):])>scores[ranked[0]]+.02 or scores[ranked[0]]<.18:
        return {**base,'status':'not_clear_interior','candidates':[],'ambiguous':True}
    candidates=[{'id':concepts[i]['id'],'name':concepts[i]['name'],'similarity':round(float(scores[i]),4),
                 'description':concepts[i]['description']} for i in ranked[:3]]
    return {**base,'status':'analyzed','candidates':candidates,'ambiguous':margin<.025,'margin':round(margin,4)}
