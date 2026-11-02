import onnx
from pathlib import Path
m=onnx.load('backend/models/grounding-dino/model_quantized.onnx')
print('nodes',len(m.graph.node),'values',len(m.graph.value_info))
print('inputs',[(i.name,[d.dim_value or d.dim_param for d in i.type.tensor_type.shape.dim]) for i in m.graph.input])
# propagate which runtime inputs each node depends on
roots={v.name:{v.name} for v in m.graph.input}; initial={i.name for i in m.graph.initializer}
for node in m.graph.node:
 deps=set().union(*(roots.get(i,set()) for i in node.input))
 for o in node.output:roots[o]=deps
cross=[]
for n in m.graph.node:
 deps=set().union(*(roots.get(i,set()) for i in n.input))
 if 'pixel_values' in deps and 'input_ids' in deps:
  for i in n.input:
   ds=roots.get(i,set())
   if 'pixel_values' in ds and 'input_ids' not in ds:cross.append(i)
cross=list(dict.fromkeys(cross))
print('image-only boundaries',len(cross));print('\n'.join(cross))
Path('work/vision-boundaries.json').write_text(__import__('json').dumps(cross))
print('typed',sum(v.name in cross for v in m.graph.value_info))
