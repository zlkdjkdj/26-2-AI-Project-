// Diagram geometry only: these dimensions do not represent measured furniture.
export function constrainPlacement(item, x=item.x, y=item.y) {
  const [w,h]=item.rotation%180 ? [item.depth,item.width] : [item.width,item.depth];
  return {...item,x:w>=.98?.5:Math.max(w/2+.01,Math.min(1-w/2-.01,x)),y:h>=.98?.5:Math.max(h/2+.01,Math.min(1-h/2-.01,y))};
}

export function applyMeasurements(items,width,depth,measurements){
  return items.map(item=>{const m=measurements.find(entry=>entry.id===item.id)||{};const measured=Number(width)>0&&Number(depth)>0&&m.width_m>0&&m.depth_m>0;return {...item,diagram_width:item.diagram_width??item.width,diagram_depth:item.diagram_depth??item.depth,width:measured?m.width_m/Number(width):(item.diagram_width??item.width),depth:measured?m.depth_m/Number(depth):(item.diagram_depth??item.depth),fixed:!!m.fixed,width_source:measured?'measured':'example'};});
}

export function spatialWarnings(items,zones){
  return items.flatMap(item=>{const [w,h]=item.rotation%180?[item.depth,item.width]:[item.width,item.depth];return zones.filter(zone=>zone.reserve&&Math.min(item.x+w/2,zone.x+zone.width)>Math.max(item.x-w/2,zone.x)&&Math.min(item.y+h/2,zone.y+zone.depth)>Math.max(item.y-h/2,zone.y)).map(zone=>`${item.label}: ${zone.label}의 출입·열림 확인 영역과 겹칩니다 (${item.width_source==='measured'?'입력한 실측 크기':'예시 가구 크기'} 기준).`);});
}

export function layoutWarnings(items) {
  const warnings = [];
  const size = item => item.rotation % 180
    ? [item.depth, item.width] : [item.width, item.depth];
  items.forEach((item, index) => {
    const [w, h] = size(item);
    if (item.x - w / 2 < 0 || item.x + w / 2 > 1 || item.y - h / 2 < 0 || item.y + h / 2 > 1)
      warnings.push(`${item.label}가 가상 배치도 경계와 겹쳐요.`);
    if (Math.abs(item.x - .5) < w / 2 + .07)
      warnings.push(`${item.label}가 가운데 동선 가이드와 겹쳐요. 실제 출입문과 통로를 확인하세요.`);
    items.slice(0, index).forEach(other => {
      const [ow, oh] = size(other);
      if (Math.abs(item.x - other.x) < (w + ow) / 2 && Math.abs(item.y - other.y) < (h + oh) / 2)
        warnings.push(`${item.label}와 ${other.label}가 가상 배치도에서 겹쳐요.`);
    });
  });
  return [...new Set(warnings)];
}
