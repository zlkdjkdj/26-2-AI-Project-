"""Heuristic alternatives using detected inventory, not reconstructed floorplans."""
from .contextual_advice import advice
from .spatial import footprint,overlap_area,spatial_warnings


def dimensions(item):
    return (item['depth'], item['width']) if item['rotation'] % 180 else (item['width'], item['depth'])


def warnings_for(items):
    warnings = []
    for i, item in enumerate(items):
        w, h = dimensions(item)
        if item['x']-w/2 < 0 or item['x']+w/2 > 1 or item['y']-h/2 < 0 or item['y']+h/2 > 1:
            warnings.append(f"{item['label']}가 가상 배치도 경계와 겹쳐요.")
        if abs(item['x']-.5) < w/2+.07:
            warnings.append(f"{item['label']}가 가운데 동선 가이드와 겹쳐요. 실제 출입문과 통로를 확인하세요.")
        for other in items[:i]:
            ow, oh = dimensions(other)
            if abs(item['x']-other['x']) < (w+ow)/2 and abs(item['y']-other['y']) < (h+oh)/2:
                warnings.append(f"{item['label']}와 {other['label']}가 가상 배치도에서 겹쳐요.")
    return list(dict.fromkeys(warnings))


def recommend(scan, items, concept, zones=None):
    zones=zones or []
    if not items:
        return []
    alternatives = [
        ('open', '이동 여백형', '큰 가구는 양쪽으로 나누고 가운데 가상 이동 여백을 먼저 남기는 안입니다.',
         {'couch':(.23,.24), 'bed':(.23,.36), 'dining_table':(.77,.65), 'chair':(.77,.39), 'tv':(.77,.12), 'potted_plant':(.16,.85)}),
        ('together', '생활 구역형', '함께 사용하는 가구를 한 구역으로 모으고 반대쪽 이동 여백을 남기는 안입니다.',
         {'couch':(.23,.24), 'bed':(.23,.36), 'dining_table':(.23,.62), 'chair':(.74,.62), 'tv':(.75,.13), 'potted_plant':(.8,.85)}),
    ]
    if concept in ('natural','soft') and scan['target_type'] not in ('wheelchair','limited_mobility'):
        alternatives.reverse()
    results = []
    for key, title, description, preferred in alternatives:
        placed = [dict(item) for item in items if item.get('fixed')]
        # Place large furniture first. Duplicate kinds get separate, stable IDs.
        for item in sorted([item for item in items if not item.get('fixed')], key=lambda f: f['width']*f['depth'], reverse=True):
            desired = preferred[item['kind']]
            candidates = []
            for rotation in (0,90):
                candidate = {**item, 'rotation':rotation}
                w, h = dimensions(candidate)
                for ix in range(1,20):
                    for iy in range(1,20):
                        x,y=ix/20,iy/20
                        if x-w/2 < .025 or x+w/2 > .975 or y-h/2 < .025 or y+h/2 > .975:
                            continue
                        overlap = 0
                        for other in placed:
                            ow,oh=dimensions(other)
                            overlap += max(0,(w+ow)/2+.025-abs(x-other['x'])) * max(0,(h+oh)/2+.025-abs(y-other['y']))
                        path = max(0,w/2+.09-abs(x-.5))
                        door=sum(overlap_area(footprint({**candidate,'x':x,'y':y}),zone) for zone in zones if zone['reserve'])
                        score = (overlap+door)*10000 + path*35 + (x-desired[0])**2+(y-desired[1])**2 + (rotation!=0)*.008
                        candidates.append((score,x,y,rotation))
            if not candidates:
                placed.append(dict(item));continue
            _,x,y,rotation=min(candidates)
            placed.append({**item,'x':x,'y':y,'rotation':rotation})
        by_id={f['id']:f for f in placed}
        ordered=[by_id[f['id']] for f in items]
        results.append({'id':key,'name':title,'description':description,
                        'placements':[{k:f[k] for k in ('id','x','y','rotation')} for f in ordered],
                        'warnings':warnings_for(ordered)+spatial_warnings(ordered,zones),
                        'reasons':[{'id':f['id'],'label':f['label'],'action':advice(f['kind'],scan['target_type'],scan['space_type'])['action']} for f in ordered],
                        'notice':'입력한 실측·문 열림 영역·고정 설정을 반영합니다. 미입력 가구는 예시 크기이며 통로 접근성이나 구조 안전을 인증하지 않습니다. 창문 높이·실제 출입과 고정 상태를 현장에서 확인하세요. 벽걸이 TV는 임의로 옮기지 마세요.'})
    return results
