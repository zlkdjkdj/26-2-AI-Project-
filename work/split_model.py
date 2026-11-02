import onnx,json
from pathlib import Path
m=onnx.load('backend/models/grounding-dino/model_quantized.onnx')
visual={'pixel_values','pixel_mask'};text={'input_ids','token_type_ids','attention_mask'}
roots={v.name:{v.name} for v in m.graph.input}
for n in m.graph.node:
 deps=set().union(*(roots.get(i,set()) for i in n.input))
 for o in n.output:roots[o]=deps
cut=[]
for n in m.graph.node:
 ds=set().union(*(roots.get(i,set()) for i in n.input))
 if ds&visual and ds&text:
  for i in n.input:
   d=roots.get(i,set())
   if d&visual and not d&text:cut.append(i)
cut=list(dict.fromkeys(cut));print('cut',len(cut),cut)
e=onnx.utils.Extractor(m)
vision=e.extract_model(list(visual),cut)
decoder=e.extract_model(list(text)+cut,[v.name for v in m.graph.output])
print('partition nodes',len(vision.graph.node),len(decoder.graph.node))
onnx.save(vision,'work/vision.onnx');onnx.save(decoder,'work/decoder.onnx');Path('work/split.json').write_text(json.dumps(cut))
