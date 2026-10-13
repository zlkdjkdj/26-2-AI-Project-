#!/usr/bin/env python3
"""Download the pinned YOLOv8n ONNX data file and verify its SHA-256 digest."""
import hashlib
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / 'backend/models/yolov8n.onnx'
URL = 'https://huggingface.co/webml/yolov8n/resolve/main/onnx/yolov8n.onnx'
EXPECTED = '190ba5f1e61411a001683e349d6b2cdb0804c0dc67a5e34cd8ff6fd00ee54b4d'

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    if DEST.exists() and digest(DEST) == EXPECTED:
        print('YOLOv8n is already installed and verified.')
        return
    DEST.parent.mkdir(parents=True, exist_ok=True)
    temp = DEST.with_suffix('.download')
    try:
        with urllib.request.urlopen(URL,timeout=60) as response, temp.open('wb') as output:
            total = 0
            while chunk := response.read(1024 * 1024):
                total += len(chunk)
                if total > 20 * 1024 * 1024:
                    raise RuntimeError('Unexpected model size')
                output.write(chunk)
        if digest(temp) != EXPECTED:
            raise RuntimeError('Model SHA-256 mismatch; existing model was not changed.')
        temp.replace(DEST)
        print('YOLOv8n ONNX installed and verified.')
    finally:
        temp.unlink(missing_ok=True)

if __name__ == '__main__':
    main()
