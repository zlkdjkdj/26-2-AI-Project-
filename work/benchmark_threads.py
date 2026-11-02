import os,sys,json,time
from pathlib import Path
sys.path.insert(0,str(Path.cwd()/'backend'))
os.environ['ELECTRICAL_CPU_THREADS']='4'
from app import electrical
from app.main import validate_image
cases=json.loads(Path('work/performance-baseline.json').read_text(encoding='utf-8'))
result=[]
for case in cases:
 _,_,raw=validate_image((Path('backend/tests/fixtures')/case['image']).read_bytes())
 t=time.perf_counter();items=electrical.detect(raw);elapsed=time.perf_counter()-t
 print(case['image'],round(elapsed,3),'equal',items==case['electrical'],flush=True)
 result.append(dict(image=case['image'],seconds=elapsed,equal=items==case['electrical'],items=items))
Path('work/threads4.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
