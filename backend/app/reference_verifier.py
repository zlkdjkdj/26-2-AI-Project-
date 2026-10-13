"""Small learned crop classifier. Supplements uncertainty; never invents boxes.

Uses 64x64 HOG/color features and a linear classifier, not another deep model.
Model scores are not calibrated probabilities. Private images are not stored.
"""
import json
import os
import zipfile
from functools import lru_cache
import cv2
import numpy as np
from .config import local_path

CLASSES = ('socket','power_strip','light_switch')

def features(crop):
    array = np.asarray(crop.convert('RGB'))
    height,width = array.shape[:2]
    if min(height,width)<3:
        raise ValueError('Crop has insufficient pixels')
    resized = cv2.resize(array,(64,64),interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(resized,cv2.COLOR_RGB2GRAY)
    hog = cv2.HOGDescriptor((64,64),(16,16),(16,16),(8,8),9)
    edges = hog.compute(gray).reshape(-1)
    hist = np.concatenate([np.histogram(resized[:,:,c],bins=8,range=(0,256))[0]/4096 for c in range(3)])
    return np.concatenate([edges,hist,[np.log(max(.05,min(20,width/height)))]]).astype(np.float32)

@lru_cache(maxsize=2)
def load_model(path,mtime):
    with np.load(path,allow_pickle=False) as archive:
        model={key:archive[key].copy() for key in ('mean','scale','weights','bias')}
        metadata=json.loads(str(archive['metadata']))
    if metadata.get('classes')!=list(CLASSES) or not metadata.get('uncertainty_gate_passed'):
        return None
    size=len(model['mean'])
    if size!=601 or model['scale'].shape!=(size,) or model['weights'].shape!=(size,3) or model['bias'].shape!=(3,):
        raise ValueError('Unexpected verifier dimensions')
    if not all(np.isfinite(array).all() for array in model.values()) or (model['scale']<=0).any():
        raise ValueError('Invalid verifier parameters')
    return model,metadata

def status():
    enabled=os.getenv('REFERENCE_VERIFIER_ENABLED','true').lower() in ('true','1','yes')
    path=local_path(os.getenv('REFERENCE_VERIFIER_PATH','models/reference_verifier.npz'))
    ready=False
    try:
        ready=enabled and path.is_file() and path.stat().st_size<1_000_000 and load_model(str(path),path.stat().st_mtime_ns) is not None
    except (ValueError,OSError,KeyError,zipfile.BadZipFile):
        pass
    return {'enabled':enabled,'ready':bool(ready),'role':'uncertainty_only','classes':list(CLASSES),
            'name':'HOG + linear reference classifier','training_source':'zenodo:18835199'}

def predict(crop,model):
    vector=(features(crop)-model['mean'])/model['scale']
    logits=vector@model['weights']+model['bias']
    score=np.exp(logits-logits.max());score/=score.sum()
    index=int(score.argmax())
    return CLASSES[index],float(score[index])

def annotate(image,detections):
    if os.getenv('REFERENCE_VERIFIER_ENABLED','true').lower() not in ('true','1','yes'):
        return detections
    path=local_path(os.getenv('REFERENCE_VERIFIER_PATH','models/reference_verifier.npz'))
    if not path.is_file() or path.stat().st_size>1_000_000:
        return detections
    try:
        loaded=load_model(str(path),path.stat().st_mtime_ns)
        if loaded is None:
            return detections
        model,metadata=loaded
        for item in detections:
            if item['object_type'] not in ('socket','power_strip'):
                continue
            x,y,w,h=item['bbox']
            crop=image.crop((round(x*image.width),round(y*image.height),round((x+w)*image.width),round((y+h)*image.height)))
            kind,score=predict(crop,model)
            item['reference_check']={'kind':kind,'match_score':round(score,4),
                                     'score_kind':'uncalibrated_classifier_score',
                                     'source':'zenodo_18835199_lite_classifier'}
            # Avoid suppressing a genuine hazard or replacing the detector's class.
            # A validated strong disagreement requires direct confirmation.
            if score>=metadata['disagreement_threshold'] and kind!=item['object_type']:
                item['classification_uncertain']=True
                labels={'socket':'콘센트','power_strip':'멀티탭','light_switch':'스위치'}
                alternatives=item.setdefault('alternative_labels',[])
                if labels[kind] not in alternatives:
                    alternatives.append(labels[kind])
                item['reference_check']['notice']='참고 자료 보조 분류와 결과가 달라 종류를 직접 확인하세요.'
    except (ValueError,OSError,KeyError,cv2.error,zipfile.BadZipFile):
        # Optional verifier must not stop the actual detector or mask its boxes.
        return detections
    return detections
