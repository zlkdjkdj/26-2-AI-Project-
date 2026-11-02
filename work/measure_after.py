import json,time,sys
from pathlib import Path
sys.path.insert(0,str(Path.cwd()/'backend'))
from app import electrical
from app.main import validate_image
baseline=json.loads(Path('work/performance-baseline.json').read_text(encoding='utf-8'))
rows=[]
for case in baseline:
 _,_,raw=validate_image((Path('backend/tests/fixtures')/case['image']).read_bytes())
 t=time.perf_counter();items=electrical.detect(raw);seconds=time.perf_counter()-t
 row=dict(image=case['image'],before_seconds=case['electrical_seconds'],after_seconds=seconds,identical=items==case['electrical'],calls=len(items))
 rows.append(row);print(row,flush=True)
 assert row['identical']
Path('work/performance-after.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
