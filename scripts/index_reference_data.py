#!/usr/bin/env python3
"""Index public reference images/labels without training or model inference."""
import ast
import hashlib
import json
import math
import re
import sqlite3
from pathlib import Path
from PIL import Image
from collect_reference_data import DATA, ROOT, LIMIT, usage, RECORD

SCHEMA = '''
CREATE TABLE IF NOT EXISTS sources (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, url TEXT NOT NULL,
 license TEXT NOT NULL, attribution TEXT NOT NULL, purpose TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS images (
 id INTEGER PRIMARY KEY, source_id TEXT NOT NULL REFERENCES sources(id),
 path TEXT NOT NULL UNIQUE, sha256 TEXT NOT NULL, source_split TEXT NOT NULL,
 original_group TEXT NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL,
 bytes INTEGER NOT NULL, review_status TEXT NOT NULL DEFAULT 'unreviewed'
);
CREATE TABLE IF NOT EXISTS boxes (
 image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
 class_id INTEGER NOT NULL, class_name TEXT NOT NULL,
 cx REAL NOT NULL, cy REAL NOT NULL, width REAL NOT NULL, height REAL NOT NULL,
 UNIQUE(image_id,class_id,cx,cy,width,height)
);
CREATE INDEX IF NOT EXISTS idx_reference_boxes_class ON boxes(class_name);
CREATE INDEX IF NOT EXISTS idx_reference_images_digest ON images(sha256);
'''

def names_from_yaml(path):
    # This pinned source uses an inline list. Do not execute YAML constructors.
    text = path.read_text()
    match = re.search(r'^names:\s*(\[[^\n]*\])\s*$', text, re.M)
    if not match:
        raise ValueError('Unexpected source class-name format')
    names = ast.literal_eval(match[1])
    if not isinstance(names, list) or not all(isinstance(n, str) for n in names):
        raise ValueError('Invalid class names')
    return names

def read_boxes(path, names):
    if not path.exists():
        raise ValueError(f'Missing annotation: {path.name}')
    result = []
    for line in path.read_text().splitlines():
        if not line.strip():
            continue
        parts = line.split()
        if len(parts) != 5:
            raise ValueError('Expected YOLO object boxes, not polygons')
        class_id = int(parts[0])
        cx, cy, width, height = map(float, parts[1:])
        if not 0 <= class_id < len(names) or not all(math.isfinite(v) for v in (cx,cy,width,height)):
            raise ValueError('Invalid class or non-finite box')
        if not (0 <= cx <= 1 and 0 <= cy <= 1 and 0 < width <= 1 and 0 < height <= 1):
            raise ValueError('Invalid normalized bounding box')
        if min(cx-width/2,cy-height/2) < -.002 or max(cx+width/2,cy+height/2) > 1.002:
            raise ValueError('Box outside image')
        result.append((class_id, names[class_id], cx, cy, width, height))
    return result

def main():
    if usage() > LIMIT:
        raise RuntimeError('Reference data exceeds budget')
    metadata = json.loads((DATA/'source.json').read_text())['metadata']
    configs = list((DATA/f'zenodo-{RECORD}').rglob('data.yaml'))
    if len(configs) != 1:
        raise ValueError('Expected exactly one dataset config')
    dataset = configs[0].parent
    names = names_from_yaml(configs[0])
    db = DATA/'catalog.sqlite3'
    skipped = []
    with sqlite3.connect(db) as con:
        con.execute('PRAGMA foreign_keys=ON')
        con.executescript(SCHEMA)
        con.execute('INSERT OR REPLACE INTO sources VALUES (?,?,?,?,?,?)',
                    (RECORD,metadata['title'],f'https://zenodo.org/records/{RECORD}',
                     metadata['license']['id'],json.dumps(metadata['creators'],ensure_ascii=False),
                     'reference_library_bounded_crop_verifier'))
        for image in sorted(dataset.rglob('*')):
            if image.suffix.lower() not in {'.jpg','.jpeg','.png'} or image.parent.name != 'images':
                continue
            label = image.parent.parent/'labels'/(image.stem+'.txt')
            try:
                boxes = read_boxes(label, names)
                with Image.open(image) as opened:
                    width,height = opened.size
                digest = hashlib.sha256(image.read_bytes()).hexdigest()
                relative = str(image.relative_to(ROOT))
                group = image.name.split('.rf.')[0]
                con.execute('INSERT INTO images(source_id,path,sha256,source_split,original_group,width,height,bytes) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(path) DO UPDATE SET sha256=excluded.sha256,width=excluded.width,height=excluded.height,bytes=excluded.bytes',
                            (RECORD,relative,digest,image.parent.parent.name,group,width,height,image.stat().st_size))
                identity = con.execute('SELECT id FROM images WHERE path=?',(relative,)).fetchone()[0]
                con.execute('DELETE FROM boxes WHERE image_id=?',(identity,))
                con.executemany('INSERT OR IGNORE INTO boxes VALUES (?,?,?,?,?,?,?)',[(identity,*box) for box in boxes])
            except (ValueError,OSError) as exc:
                skipped.append({'path':str(image.relative_to(dataset)),'reason':str(exc)})
        summary = {
            'purpose':'reference_library','source_url':f'https://zenodo.org/records/{RECORD}',
            'license':metadata['license']['id'],'class_names':names,
            'indexed_images':con.execute('SELECT COUNT(*) FROM images').fetchone()[0],
            'image_bytes':con.execute('SELECT COALESCE(SUM(bytes),0) FROM images').fetchone()[0],
            'boxes_by_class':dict(con.execute('SELECT class_name,COUNT(*) FROM boxes GROUP BY class_name')),
            'source_split_counts':dict(con.execute('SELECT source_split,COUNT(*) FROM images GROUP BY source_split')),
            'exact_duplicate_groups':con.execute('SELECT COUNT(*) FROM (SELECT sha256 FROM images GROUP BY sha256 HAVING COUNT(*)>1)').fetchone()[0],
            'original_name_groups':con.execute('SELECT COUNT(DISTINCT original_group) FROM images').fetchone()[0],
            'skipped':skipped,'storage_limit_bytes':LIMIT,
            'notice':'Source labels are unreviewed references. Indexing performs no training or inference and does not create risk rules. A separate bounded crop classifier has its own evaluation report. Filename groups may include variants and naming collisions; source splits are not certified leakage-free.'
        }
    summary['all_reference_bytes']=usage()
    (ROOT/'docs/reference-data.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
    print(json.dumps(summary,ensure_ascii=False,indent=2))

if __name__ == '__main__':
    main()
