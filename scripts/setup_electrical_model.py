#!/usr/bin/env python3
"""Install pinned ONNX and tokenizer data with digest verification, no remote executable code."""
import hashlib
from pathlib import Path
import urllib.request

ROOT=Path(__file__).resolve().parent.parent/'backend/models/grounding-dino'
REVISION='ff690b0a8050566c290287545bd059350f3e9096'
BASE=f'https://huggingface.co/onnx-community/grounding-dino-tiny-ONNX/resolve/{REVISION}/'
FILES={
 'model_quantized.onnx':('onnx/model_quantized.onnx','70bf2d3310d1ae73769c96a71e00cbf2861eb33a1f4d97d84a108a7bf02c03c9',220_000_000),
 'tokenizer.json':('tokenizer.json','d241a60d5e8f04cc1b2b3e9ef7a4921b27bf526d9f6050ab90f9267a1f9e5c66',1_000_000),
}

def digest(path):
    result=hashlib.sha256()
    with path.open('rb') as source:
        while chunk:=source.read(1024*1024):result.update(chunk)
    return result.hexdigest()


def main():
    ROOT.mkdir(parents=True,exist_ok=True)
    for filename,(remote,expected,maximum) in FILES.items():
        destination=ROOT/filename
        if destination.exists() and digest(destination)==expected:
            print(filename,'already verified',flush=True);continue
        temp=ROOT/(filename+'.download')
        try:
            with urllib.request.urlopen(BASE+remote,timeout=60) as response,temp.open('wb') as output:
                total=0
                while chunk:=response.read(1024*1024):
                    total+=len(chunk)
                    if total>maximum:raise RuntimeError('Unexpected model data size')
                    output.write(chunk)
            if digest(temp)!=expected:raise RuntimeError('Checksum mismatch: existing model was preserved')
            temp.replace(destination)
            print(filename,'installed and verified',flush=True)
        finally:
            temp.unlink(missing_ok=True)

if __name__=='__main__':main()
