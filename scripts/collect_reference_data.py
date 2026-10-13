#!/usr/bin/env python3
"""Download reference data with an enforced 3 GB storage budget; never train.

Run with backend/.venv/bin/python. No user scans or private images are imported.
"""
import hashlib
import json
import shutil
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'datasets/reference'
LIMIT = 3_000_000_000
RECORD = '18835199'
FILE = 'combined_datasets_yolo_annotations.zip'
EXPECTED_MD5 = 'e6fb6abceec00a187f94bc1bbd601502'

def usage(root=DATA):
    return sum(p.stat().st_size for p in root.rglob('*') if p.is_file() and not p.is_symlink())

def reserve(size):
    if usage() + size > LIMIT:
        raise RuntimeError('Reference data storage would exceed the 3,000,000,000-byte cap')

def get_json(url):
    with urllib.request.urlopen(url, timeout=60) as response:
        return json.load(response)

def download(url, destination, expected_size):
    reserve(expected_size)
    temp = destination.with_suffix('.download')
    try:
        md5 = hashlib.md5()
        total = 0
        with urllib.request.urlopen(url, timeout=60) as response, temp.open('wb') as out:
            while chunk := response.read(1024 * 1024):
                total += len(chunk)
                if total > expected_size:
                    raise RuntimeError('Unexpected download size')
                out.write(chunk)
                md5.update(chunk)
        if total != expected_size or md5.hexdigest() != EXPECTED_MD5:
            raise RuntimeError('Dataset checksum or size mismatch')
        temp.replace(destination)
    finally:
        temp.unlink(missing_ok=True)

def checksum(path):
    md5=hashlib.md5()
    with path.open('rb') as source:
        while chunk:=source.read(1024*1024):md5.update(chunk)
    return md5.hexdigest()

def main():
    DATA.mkdir(parents=True, exist_ok=True)
    metadata = get_json(f'https://zenodo.org/api/records/{RECORD}')
    license_id = metadata['metadata']['license']['id']
    if license_id != 'cc-by-4.0':
        raise RuntimeError('Unexpected dataset license; collection stopped')
    file = next(f for f in metadata['files'] if f['key'] == FILE)
    if file['checksum'] != 'md5:' + EXPECTED_MD5:
        raise RuntimeError('Source archive changed')
    archive = DATA / FILE
    if archive.exists():
        if checksum(archive) != EXPECTED_MD5:
            raise RuntimeError('Existing archive failed checksum')
    else:
        download(file['links']['self'], archive, file['size'])
    destination = DATA / f'zenodo-{RECORD}'
    if not (destination / '.complete').exists():
        with zipfile.ZipFile(archive) as zipped:
            entries = zipped.infolist()
            reserve(sum(e.file_size for e in entries))
            for entry in entries:
                path = Path(entry.filename)
                if path.is_absolute() or '..' in path.parts:
                    raise RuntimeError('Unsafe archive path')
                if (entry.external_attr >> 16) & 0o170000 == 0o120000:
                    raise RuntimeError('Archive symlinks are not allowed')
            destination.mkdir(exist_ok=True)
            for entry in entries:
                target = destination / entry.filename
                if entry.is_dir():
                    target.mkdir(parents=True, exist_ok=True)
                else:
                    target.parent.mkdir(parents=True, exist_ok=True)
                    with zipped.open(entry) as src, target.open('wb') as out:
                        shutil.copyfileobj(src, out)
            (destination / '.complete').write_text(EXPECTED_MD5)
    (DATA / 'source.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2))
    print(json.dumps({'source': f'https://zenodo.org/records/{RECORD}', 'license': license_id,
                      'data_bytes': usage(), 'limit_bytes': LIMIT, 'path': str(destination)}, indent=2))

if __name__ == '__main__':
    main()
