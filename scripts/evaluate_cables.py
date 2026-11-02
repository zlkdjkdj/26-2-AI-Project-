"""Compare the same detector with/without candidate crop refinement on labeled images."""
import argparse,json,os,sys,time
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'backend'))
from app.electrical import detect,iou

def metrics(predicted,truth,threshold):
    matched=set();tp=0
    for prediction in sorted(predicted,key=lambda p:p['confidence'],reverse=True):
        candidates=[(iou(prediction['bbox'],box),index) for index,box in enumerate(truth) if index not in matched]
        if candidates:
            value,index=max(candidates)
            if value>=threshold:matched.add(index);tp+=1
    fp=len(predicted)-tp;fn=len(truth)-tp
    return {'tp':tp,'fp':fp,'fn':fn,'precision':tp/(tp+fp) if tp+fp else None,'recall':tp/(tp+fn) if tp+fn else None}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--manifest',type=Path,default=ROOT/'backend/tests/fixtures/cable-evaluation.json');parser.add_argument('--output',type=Path,default=ROOT/'docs/electrical-cable-evaluation.json');parser.add_argument('--iou',type=float,default=.5);args=parser.parse_args()
    manifest=json.loads(args.manifest.read_text(encoding='utf-8'));result={'scope':manifest['scope'],'iou_threshold':args.iou,'cases':[]}
    previous=os.environ.get('ELECTRICAL_CABLE_REFINEMENT')
    try:
        for case in manifest['cases']:
            content=(args.manifest.parent/case['image']).read_bytes();row={'image':case['image'],'labels':len(case['wire_boxes'])}
            for mode,enabled in [('baseline','false'),('refined','true')]:
                os.environ['ELECTRICAL_CABLE_REFINEMENT']=enabled;start=time.monotonic()
                predicted=[d for d in detect(content) if d['object_type']=='electric_wire']
                row[mode]={**metrics(predicted,case['wire_boxes'],args.iou),'seconds':round(time.monotonic()-start,2),'predictions':[{'bbox':p['bbox'],'model_score':p['confidence']} for p in predicted]}
            result['cases'].append(row)
    finally:
        if previous is None:os.environ.pop('ELECTRICAL_CABLE_REFINEMENT',None)
        else:os.environ['ELECTRICAL_CABLE_REFINEMENT']=previous
    args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(result,indent=2,ensure_ascii=False),encoding='utf-8');print(json.dumps(result,ensure_ascii=False),flush=True)

if __name__=='__main__':main()
