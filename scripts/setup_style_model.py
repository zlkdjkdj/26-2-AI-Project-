"""Install pinned CLIP ONNX weights for local, no-API style classification."""
import hashlib
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import urllib.request

REVISION='d15189d7028b43f1d3e65039190477f6af591c2a'
ROOT=Path(__file__).resolve().parent.parent/'backend/models/clip-style'
FILES={
 'vision_model_quantized.onnx':('onnx/vision_model_quantized.onnx','sha256','583fd1110a514667812fee7d684952aaf82a99b959760c8d7dca7e0ab9839299',95_000_000),
 'text_model_quantized.onnx':('onnx/text_model_quantized.onnx','sha256','73baab855d406190da9faa498cfedf65f15cf309f4cc7385b7b032e6d08e5c3a',70_000_000),
 'tokenizer.json':('tokenizer.json','git','bc1f77d20440541dd073ebae6f6c401087c7d34e',3_000_000),
 'preprocessor_config.json':('preprocessor_config.json','git','e0675735fd0052745f2f7b7291e4aa7859389998',10_000),
}

def matches(path,kind,expected):
    raw=path.read_bytes()
    digest=hashlib.sha256(raw).hexdigest() if kind=='sha256' else hashlib.sha1(f'blob {len(raw)}\0'.encode()+raw).hexdigest()
    return digest==expected

def install(entry):
    name,(remote,kind,expected,maximum)=entry
    path=ROOT/name
    if path.is_file() and matches(path,kind,expected):return name+' already verified'
    temp=path.with_suffix('.download')
    try:
        url=f'https://huggingface.co/Xenova/clip-vit-base-patch32/resolve/{REVISION}/{remote}'
        with urllib.request.urlopen(url,timeout=60) as response,temp.open('wb') as output:
            total=0
            while chunk:=response.read(1024*1024):
                total+=len(chunk)
                if total>maximum:raise RuntimeError('Unexpected model size')
                output.write(chunk)
        if not matches(temp,kind,expected):raise RuntimeError('Checksum mismatch')
        temp.replace(path)
        return name+' installed and verified'
    finally:temp.unlink(missing_ok=True)

if __name__=='__main__':
    ROOT.mkdir(parents=True,exist_ok=True)
    with ThreadPoolExecutor(max_workers=2) as pool:
        for result in pool.map(install,FILES.items()):print(result,flush=True)
