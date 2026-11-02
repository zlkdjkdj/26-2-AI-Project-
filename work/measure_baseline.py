import sys,time,json,os
from pathlib import Path
sys.path.insert(0,str(Path.cwd()/'backend'))
from app import electrical,detection
from app.main import validate_image
out=[]
for name in ('power-strip.jpg','indoor.jpg'):
 raw=(Path('backend/tests/fixtures')/name).read_bytes();_,_,raw=validate_image(raw)
 t=time.perf_counter();y=detection.detect_image(raw);yt=time.perf_counter()-t
 calls=[];original=electrical.query
 def timed(*args):
  start=time.perf_counter();r=original(*args);calls.append(round(time.perf_counter()-start,3));return r
 electrical.query=timed
 t=time.perf_counter();d=electrical.detect(raw);dt=time.perf_counter()-t
 electrical.query=original
 out.append(dict(image=name,yolo_seconds=yt,electrical_seconds=dt,query_seconds=calls,yolo=y,electrical=d))
 print(name,round(yt,3),round(dt,3),calls,flush=True)
Path('work/performance-baseline.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
