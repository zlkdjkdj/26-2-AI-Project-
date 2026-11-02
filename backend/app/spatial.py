"""Geometry supplied by the user. No dimensions are inferred from a photograph."""
def opening_shapes(openings, width, depth):
    if not width or not depth:return []
    shapes=[]
    for opening in openings:
        wall=opening['wall'];horizontal=wall in ('north','south')
        along=width if horizontal else depth;across=depth if horizontal else width
        length=opening['width_m']/along;offset=opening['offset_m']/along
        clearance=(opening['width_m'] if opening.get('swing')=='inward' else .3)/across if opening['kind']=='door' else .025
        x,y,w,h=(offset,0,length,clearance) if horizontal else (0,offset,clearance,length)
        if wall=='south':y=1-h
        if wall=='east':x=1-w
        shapes.append({**opening,'x':x,'y':y,'width':w,'depth':h,'reserve':opening['kind']=='door'})
    return shapes

def overlap_area(a,b):
    return max(0,min(a['x']+a['width'],b['x']+b['width'])-max(a['x'],b['x']))*max(0,min(a['y']+a['depth'],b['y']+b['depth'])-max(a['y'],b['y']))

def footprint(item):
    w,h=(item['depth'],item['width']) if item['rotation']%180 else (item['width'],item['depth'])
    return {'x':item['x']-w/2,'y':item['y']-h/2,'width':w,'depth':h}

def measured_inventory(items,saved):
    width,depth=saved.get('room_width'),saved.get('room_depth')
    by_id={entry['id']:entry for entry in saved.get('furniture_measurements',[])}
    for item in items:
        item['diagram_width']=item['width'];item['diagram_depth']=item['depth']
        measurement=by_id.get(item['id'],{})
        item['fixed']=measurement.get('fixed',False)
        item['width_source']='example'
        if width and depth and measurement.get('width_m') and measurement.get('depth_m'):
            item.update(width=measurement['width_m']/width,depth=measurement['depth_m']/depth,
                        width_m=measurement['width_m'],depth_m=measurement['depth_m'],width_source='measured')
    return items

def spatial_warnings(items,zones):
    warnings=[]
    for item in items:
        for zone in zones:
            if zone['reserve'] and overlap_area(footprint(item),zone)>1e-6:
                basis='입력한 실측 크기' if item.get('width_source')=='measured' else '예시 가구 크기'
                warnings.append(f"{item['label']}: {zone['label']}의 출입·열림 확인 영역과 겹칩니다 ({basis} 기준).")
    return warnings
