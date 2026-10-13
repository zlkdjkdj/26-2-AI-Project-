#!/usr/bin/env python3
"""Bounded CPU training: <=540 crops, one thread, no PyTorch or GPU.

Fits a small linear classifier to public labels. Never retrains YOLO/DINO.
"""
import os
os.environ['OPENBLAS_NUM_THREADS']='1'
os.environ['OMP_NUM_THREADS']='1'
os.environ['MKL_NUM_THREADS']='1'
import hashlib
import json
import sqlite3
import sys
import time
from pathlib import Path
import cv2
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'backend'))
sys.path.insert(0,str(ROOT/'scripts'))
from app.reference_verifier import CLASSES,features,predict
from collect_reference_data import usage,LIMIT

MAX_CROPS=180
STEPS=250
MAX_SECONDS=60
SEED=20261001
MAPPING={'power socket':'socket','power strip':'power_strip','light switch':'light_switch'}

def split(group):
    value=int(hashlib.sha256(group.encode()).hexdigest()[:8],16)%10
    return 'test' if value==0 else 'validation' if value==1 else 'train'

def grouped_originals(rows):
    parent={row['original_group']:row['original_group'] for row in rows}
    def find(value):
        while parent[value]!=value:
            parent[value]=parent[parent[value]];value=parent[value]
        return value
    digest_group={}
    for row in rows:
        group=row['original_group'];digest=row['sha256']
        if digest in digest_group:
            a,b=find(group),find(digest_group[digest])
            parent[max(a,b)]=min(a,b)
        digest_group[digest]=group
    return {group:find(group) for group in parent}

def metrics(truth,score):
    pred=score.argmax(axis=1)
    confusion=np.zeros((3,3),dtype=int)
    for true,guessed in zip(truth,pred):confusion[true,guessed]+=1
    details={}
    for i,kind in enumerate(CLASSES):
        tp=int(confusion[i,i]);precision=tp/max(1,int(confusion[:,i].sum()));recall=tp/max(1,int(confusion[i].sum()))
        details[kind]={'precision':round(precision,4),'recall':round(recall,4),'support':int(confusion[i].sum()),
                       'f1':round(2*precision*recall/max(1e-9,precision+recall),4)}
    return {'accuracy':round(float((pred==truth).mean()),4),'macro_f1':round(sum(v['f1'] for v in details.values())/3,4),
            'classes':details,'confusion':confusion.tolist()}

def scores(vectors,model):
    logits=((vectors-model['mean'])/model['scale'])@model['weights']+model['bias']
    values=np.exp(logits-logits.max(axis=1,keepdims=True))
    return values/values.sum(axis=1,keepdims=True)

def main():
    started=time.monotonic();cv2.setNumThreads(1)
    if usage()+1_000_000>LIMIT:
        raise RuntimeError('Reference budget has insufficient space for verifier artifacts')
    db=ROOT/'datasets/reference/catalog.sqlite3'
    with sqlite3.connect(db) as con:
        con.row_factory=sqlite3.Row
        rows=con.execute('SELECT i.path,i.sha256,i.original_group,b.* FROM boxes b JOIN images i ON i.id=b.image_id ORDER BY i.path,b.class_id').fetchall()
    rng=np.random.default_rng(SEED)
    groups=grouped_originals(rows)
    rows=[rows[i] for i in rng.permutation(len(rows))]
    per_kind={c:0 for c in CLASSES};seen=set();records=[];sets={s:[] for s in ('train','validation','test')}
    for row in rows:
        kind=MAPPING.get(row['class_name'])
        if kind is None or per_kind[kind]>=MAX_CROPS:continue
        key=(row['sha256'],row['class_id'],row['cx'],row['cy'],row['width'],row['height'])
        if key in seen:continue
        if time.monotonic()-started>MAX_SECONDS:raise RuntimeError('CPU time budget exceeded; no serving model was changed')
        with Image.open(ROOT/row['path']) as opened:
            image=opened.convert('RGB');w,h=image.size
            cx,cy,bw,bh=row['cx'],row['cy'],row['width'],row['height']
            crop=image.crop((round((cx-bw/2)*w),round((cy-bh/2)*h),round((cx+bw/2)*w),round((cy+bh/2)*h)))
            try:vector=features(crop)
            except ValueError:continue
        group=groups[row['original_group']]
        partition=split(group)
        # All filename variants of an original go to the same partition.
        sets[partition].append((vector,CLASSES.index(kind)))
        records.append({'path':row['path'],'sha256':row['sha256'],'class':kind,'group':group,'partition':partition})
        per_kind[kind]+=1;seen.add(key)
    arrays={s:(np.stack([r[0] for r in v]),np.array([r[1] for r in v])) for s,v in sets.items()}
    for field in ('group','sha256'):
        membership={}
        for record in records:
            membership.setdefault(record[field],set()).add(record['partition'])
        if any(len(parts)>1 for parts in membership.values()):
            raise RuntimeError('Partition leakage detected')
    x,y=arrays['train'];mean=x.mean(axis=0);scale=np.maximum(x.std(axis=0),.05)
    x=(x-mean)/scale
    weights=np.zeros((x.shape[1],3),dtype=np.float32);bias=np.zeros(3,dtype=np.float32)
    target=np.eye(3,dtype=np.float32)[y]
    counts=np.bincount(y,minlength=3)
    if counts.min()<15:raise RuntimeError('Insufficient training examples for a class')
    sample_weight=len(y)/(3*counts[y]);sample_weight=sample_weight[:,None]
    for step in range(STEPS):
        if time.monotonic()-started>MAX_SECONDS:raise RuntimeError('CPU training budget exceeded')
        logits=x@weights+bias;p=np.exp(logits-logits.max(axis=1,keepdims=True));p/=p.sum(axis=1,keepdims=True)
        error=(p-target)*sample_weight/len(y)
        lr=.03/(1+step/100)
        weights-=lr*(x.T@error+.01*weights);bias-=lr*error.sum(axis=0)
    model={'mean':mean,'scale':scale,'weights':weights,'bias':bias}
    report={'classes':list(CLASSES),'seed':SEED,'max_crops_per_class':MAX_CROPS,'feature_pixels':[64,64],
            'cpu_threads':1,'optimizer_steps':STEPS,'source':'https://zenodo.org/records/18835199','license':'CC-BY-4.0',
            'filename_group_overlap':0,'exact_image_overlap':0,
            'partition_counts':{s:len(v) for s,v in sets.items()},'validation':metrics(arrays['validation'][1],scores(arrays['validation'][0],model)),
            'test':metrics(arrays['test'][1],scores(arrays['test'][0],model)),
            'disagreement_threshold':.9,'model_role':'uncertainty_only_no_bbox_or_risk_override'}
    # Gate uses validation only. Test is an untouched result, not a tuning target.
    val_scores=scores(arrays['validation'][0],model);strong=val_scores.max(axis=1)>=.9
    strong_count=int(strong.sum());strong_accuracy=float((val_scores[strong].argmax(axis=1)==arrays['validation'][1][strong]).mean()) if strong_count else 0
    report['validation_strong_count']=strong_count;report['validation_strong_accuracy']=round(strong_accuracy,4)
    report['uncertainty_gate_passed']=report['validation']['macro_f1']>=.75 and strong_count>=20 and strong_accuracy>=.9
    report['duration_seconds']=round(time.monotonic()-started,2)
    output=ROOT/'backend/models/reference_verifier.npz'
    candidate=ROOT/'datasets/reference/reference_verifier.npz'
    np.savez_compressed(candidate,**model,metadata=np.array(json.dumps(report)))
    report['model_bytes']=candidate.stat().st_size
    if report['uncertainty_gate_passed']:
        output.write_bytes(candidate.read_bytes())
    report['serving_enabled']=bool(report['uncertainty_gate_passed'])
    report['notice']='Crop classification on grouped public labels, not detector precision/recall or home safety accuracy. Filename grouping may over-group unrelated images. No private photos were used in training. Domain-shift validation is still required.'
    (ROOT/'docs/reference-verifier-evaluation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    (ROOT/'datasets/reference/verifier_samples.json').write_text(json.dumps(records,ensure_ascii=False,indent=2))
    with sqlite3.connect(db) as con:
        con.execute('CREATE TABLE IF NOT EXISTS verifier_runs (id INTEGER PRIMARY KEY, created_at TEXT DEFAULT CURRENT_TIMESTAMP, report_json TEXT NOT NULL)')
        con.execute('INSERT INTO verifier_runs(report_json) VALUES (?)',(json.dumps(report),))
    print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
