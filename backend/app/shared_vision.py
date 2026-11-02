"""Partition an unchanged ONNX graph and reuse image-only nodes across prompts.

Request-local intermediates are discarded at the end of detection. Unsupported
graphs fall back to the original session; no model/query/threshold is replaced.
"""
import json
import logging
from collections import OrderedDict
from contextlib import contextmanager
from pathlib import Path
import onnxruntime as ort

logger = logging.getLogger(__name__)
REVISION = 1

def partitions(model):
    import onnx
    root=model.parent/'shared-vision-v1';manifest=root/'manifest.json'
    identity=dict(revision=REVISION,size=model.stat().st_size,mtime=model.stat().st_mtime_ns)
    try:
        saved=json.loads(manifest.read_text())
        if saved==identity and all((root/name).is_file() for name in ('vision.onnx','decoder.onnx')):
            return root
    except (OSError,ValueError):
        pass
    graph=onnx.load(str(model));visual={'pixel_values','pixel_mask'};text={'input_ids','token_type_ids','attention_mask'}
    if {i.name for i in graph.graph.input} != visual|text:
        raise ValueError('Unsupported graph inputs')
    dependencies={i.name:{i.name} for i in graph.graph.input}
    boundary=[]
    for node in graph.graph.node:
        deps=set().union(*(dependencies.get(i,set()) for i in node.input))
        for output in node.output:dependencies[output]=deps
        if deps&visual and deps&text:
            for name in node.input:
                source=dependencies.get(name,set())
                if source&visual and not source&text and name not in boundary:boundary.append(name)
    if not boundary:raise ValueError('No reusable visual graph')
    extractor=onnx.utils.Extractor(graph)
    vision=extractor.extract_model(sorted(visual),boundary)
    decoder=extractor.extract_model(sorted(text)+boundary,[i.name for i in graph.graph.output])
    root.mkdir(exist_ok=True)
    # The manifest is written last, after both complete graphs have been saved.
    for name,part in (('vision.onnx',vision),('decoder.onnx',decoder)):
        temp=root/(name+'.tmp');onnx.save(part,str(temp));temp.replace(root/name)
    temp=root/'manifest.tmp';temp.write_text(json.dumps(identity));temp.replace(manifest)
    return root

class SharedVisionSession:
    def __init__(self, model, options):
        root=partitions(Path(model))
        self.vision=ort.InferenceSession(str(root/'vision.onnx'),sess_options=options,providers=['CPUExecutionProvider'])
        self.decoder=ort.InferenceSession(str(root/'decoder.onnx'),sess_options=options,providers=['CPUExecutionProvider'])
        self.output_names=[i.name for i in self.vision.get_outputs()]
        self.cache=None

    def get_outputs(self):return self.decoder.get_outputs()

    @contextmanager
    def request_scope(self):
        self.cache=OrderedDict()
        try:yield
        finally:self.cache=None

    def run(self, names, inputs):
        tensor=inputs['pixel_values'];key=id(tensor)
        cached=self.cache.get(key) if self.cache is not None else None
        if cached is None:
            values=self.vision.run(None,{k:inputs[k] for k in ('pixel_values','pixel_mask')})
            cached=(tensor,dict(zip(self.output_names,values)))
            if self.cache is not None:
                self.cache[key]=cached
                while len(self.cache)>4:self.cache.popitem(last=False)
        feed={k:v for k,v in inputs.items() if k not in ('pixel_values','pixel_mask')}
        feed.update(cached[1])
        return self.decoder.run(names,feed)

def make_session(model,options):
    try:return SharedVisionSession(model,options)
    except Exception:
        logger.warning('Shared visual graph unavailable; using unchanged full model.')
        return ort.InferenceSession(str(model),sess_options=options,providers=['CPUExecutionProvider'])
