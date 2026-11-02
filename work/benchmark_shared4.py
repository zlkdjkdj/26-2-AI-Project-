import sys,time,json
from pathlib import Path
import numpy as np,onnxruntime as ort
sys.path.insert(0,str(Path.cwd()/'backend'))
from app import electrical
from app.main import validate_image
from PIL import Image
import io
class Shared:
 def __init__(self):
  opt=ort.SessionOptions();opt.intra_op_num_threads=4;opt.inter_op_num_threads=1;opt.log_severity_level=3
  self.vision=ort.InferenceSession('work/vision.onnx',sess_options=opt,providers=['CPUExecutionProvider'])
  self.decoder=ort.InferenceSession('work/decoder.onnx',sess_options=opt,providers=['CPUExecutionProvider']);self.cache={};self.timings=[]
 def get_outputs(self):return self.decoder.get_outputs()
 def run(self,names,inputs):
  tensor=inputs['pixel_values'];key=id(tensor);t=time.perf_counter()
  if key not in self.cache:
   out=self.vision.run(None,{k:inputs[k] for k in ('pixel_values','pixel_mask')});self.cache[key]=(tensor,dict(zip([o.name for o in self.vision.get_outputs()],out)))
  feed={k:v for k,v in inputs.items() if k not in ('pixel_values','pixel_mask')};feed.update(self.cache[key][1]);r=self.decoder.run(names,feed);self.timings.append(round(time.perf_counter()-t,3));return r
baseline=json.loads(Path('work/performance-baseline.json').read_text(encoding='utf-8'))
session=Shared();_,queries=electrical.load()
electrical._CACHE=(session,queries)
for case in baseline:
 session.cache.clear();session.timings.clear()
 _,_,raw=validate_image((Path('backend/tests/fixtures')/case['image']).read_bytes())
 t=time.perf_counter();items=electrical.detect(raw);elapsed=time.perf_counter()-t
 print(case['image'],'seconds',round(elapsed,3),'calls',session.timings,'types',[i['object_type'] for i in items],flush=True)
 print('equal',items==case['electrical'],flush=True)
 Path('work/shared-'+case['image']+'.json').write_text(json.dumps({'seconds':elapsed,'items':items},ensure_ascii=False,indent=2),encoding='utf-8')

