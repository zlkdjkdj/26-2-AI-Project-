import data from './offlineRules.js';
const furniture = new Set(['chair','couch','bed','dining_table']);
const bags = new Set(['backpack','handbag','suitcase']);
const appliance = new Set(['oven','microwave','toaster']);
const heavy = new Set(['tv','potted_plant','vase']);
const household = new Set(['wine_glass','skateboard','sports_ball','umbrella']);
const levels = {HIGH:25,MEDIUM:12,LOW:5};
function evidence(kind,[x,y,w,h]) {
 if(kind==='electric_wire') return y+h>=.85?'image_low_cable':'visible_cable';
 if(kind==='socket') return 'visible_socket';
 if(kind==='power_strip') return 'visible_power_strip';
 const lower=x+w/2>=.25&&x+w/2<=.75&&y+h>=.65;
 if(kind==='knife'||kind==='scissors') return 'visible_sharp_object';
 if(furniture.has(kind)) return lower?'image_lower_center':'visible_furniture';
 if(bags.has(kind)&&lower) return 'image_lower_center';
 if(appliance.has(kind)) return 'visible_appliance';
 if(heavy.has(kind)) return 'visible_heavy_object';
 if(household.has(kind)) return 'visible_household_object';
 return '';
}
function automaticRoom(items) {
 const objects=new Set(items.filter(d=>d.confidence>=.6).map(d=>d.object_type));
 if(objects.has('toilet')) return 'bathroom';
 if(['refrigerator','oven','microwave'].some(x=>objects.has(x))) return 'kitchen';
 if(objects.has('bed')) return 'bedroom';
 if(objects.has('couch')||objects.has('tv')) return 'living_room';
 return null;
}
export function offlineResult(detections,target,room,electrical=false,general=false) {
 const actualRoom=room==='auto'?automaticRoom(detections):room;
 const hazards=[];
 for(const item of detections) {
  const condition=evidence(item.object_type,item.bbox);
  if (actualRoom && ['wet_floor','rug'].includes(item.object_type)) {
   const wet=item.object_type==='wet_floor';
   hazards.push({object:item.object_type,object_label:wet?'바닥 물기 후보':'러그·매트 후보',instance_label:wet?'바닥 물기 확인 필요':'러그·매트 미끄럼 확인',risk_level:'LOW',bbox:item.bbox,description:wet?'사진에서 물기가 있을 수 있는 바닥 후보입니다. 반사나 무늬일 수도 있으니 실제 물기와 미끄러움을 직접 확인하세요.':'사진에서 러그·매트 후보를 찾았습니다. 밀리거나 가장자리가 접혀 있는지 직접 확인하세요.',recommendation:wet?'실제로 젖은 곳이면 물기를 제거하고 완전히 마를 때까지 이동에 주의하세요.':'움직이거나 접히는 매트라면 평평하게 펴고 바닥에 맞는 미끄럼 방지 처리를 확인하세요.',supplement:'사진만으로 바닥 마찰과 젖은 상태를 확정할 수 없습니다.',accident:'미끄러짐 또는 걸림을 확인하세요.'});
   continue;
  }
  if (actualRoom && item.object_type === 'electric_plug') {
   const alternatives=(item.alternative_types||[]).map(x=>({electric_wire:'전선',socket:'콘센트',power_strip:'멀티탭',electric_plug:'플러그'})[x]).filter(Boolean);
   hazards.push({object:'electric_plug',object_label:'플러그',instance_label:alternatives.length?'전기설비 · 종류 확인 필요':'플러그',risk_level:'LOW',bbox:item.bbox,description:'사진에서 플러그 후보가 탐지되었습니다. '+(alternatives.length?'유사 후보: '+alternatives.join(', ')+'. 실제 종류를 확인하세요. ':'')+'연결 상태, 손상 및 물기 여부를 직접 확인하세요.',recommendation:'플러그와 전선을 물기 및 이동 경로에서 떨어진 위치에 두세요.',supplement:'파손이나 과열이 의심되면 사용을 중단하고 전문가에게 확인받으세요.',accident:'감전 또는 화재 위험을 확인하세요.'});
   continue;
  }
  for(const rule of data.rules) {
   if(rule.target_type!==target||rule.space_type!==actualRoom||rule.object_type!==item.object_type||rule.condition!==condition) continue;
   const label=data.objectLabels[item.object_type]||item.object_type;
   let description=general ? `${rule.reason}.` : `${rule.reason}. ${data.targetLabels[target]} 기준의 확인 항목입니다.`;
   let recommendation=rule.recommendation, supplement=rule.supplement, instance=label;
   const profile=data.profiles[item.object_type];
   const [x,y,w,h]=item.bbox;
   if(profile) {
    const pos=`사진 ${x+w/2<.35?'왼쪽':x+w/2>.65?'오른쪽':'중앙'}·${y+h/2<.35?'상단':y+h/2>.65?'하단':'중간'}`;
    instance=`${label} · ${pos}`;
    description=general ? `${pos}에 ${label}가 탐지되었습니다. ${profile[1]}` : `${pos}에 ${label}가 탐지되었습니다. ${profile[1]} ${data.spaceLabels[actualRoom]}·${data.targetLabels[target]} 기준의 확인 항목입니다.`;
    recommendation=profile[2]; supplement=profile[3];
    if(item.object_type==='bed'&&target==='newborn') recommendation='성인 침대와 아기 수면 공간을 구분하고, 아기 수면 공간의 부드러운 침구·주변 끈을 직접 확인하세요. 보호자가 접근하는 쪽은 비워 두세요.';
    if(item.object_type==='chair'&&['entrance','hallway'].includes(actualRoom)) recommendation='의자 사용 중에도 문이 열리고 사람이 지나갈 수 있는지 확인하세요. 신발을 신는 용도라면 흔들리지 않는 위치를 먼저 확인하세요.';
    if(furniture.has(item.object_type)) {
     instance=`${label} 모서리 확인 · ${pos}`;
     description=`${pos}에서 ${label}(으)로 추정되는 가구가 탐지되었습니다. 단단한 모서리가 노출되어 있고 사람이 부딪힐 위치인지 직접 확인하세요. 사진만으로 모서리 모양과 위험을 확정할 수 없습니다.`;
     recommendation='이동 동선과 가까운 날카로운 모서리라면 배치를 조정하거나 적합한 모서리 보호대를 단단히 부착하세요.';
    }
    if(item.object_type==='dining_table'&&target==='wheelchair') recommendation='상판 아래 무릎·발판 공간과 테이블 다리의 간섭을 실제 휠체어로 확인하고, 접근하는 쪽의 의자를 정리하세요.';
    if(condition==='image_lower_center') recommendation='사진 하단 중앙이 실제 이동 경로인지 먼저 확인한 뒤 적용하세요. '+recommendation;
   }
   const alternatives=(item.alternative_types||[]).map(x=>({electric_wire:'전선',socket:'콘센트',power_strip:'멀티탭',electric_plug:'플러그'})[x]).filter(Boolean);
   if(alternatives.length) { description += ` 유사 후보: ${alternatives.join(', ')}. 실제 종류를 확인하세요.`; instance='전기설비 · 종류 확인 필요'; }
   hazards.push({object:item.object_type,object_label:label,instance_label:instance,risk_level:rule.risk_level,bbox:item.bbox,description,recommendation,supplement,accident:`${data.accidents[rule.risk_type]||'사고'} 사고가 발생할 수 있습니다.`,placement_advice:profile&&!general?data.targetNotes[target]:null});
  }
 }
 // 사진 속 위쪽은 실제 높이를 뜻하지 않으므로, 물건의 낙하 여부는 현장에서 확인합니다.
 for(const item of detections) {
  if(!['potted_plant','vase','bottle','cup','wine_glass'].includes(item.object_type) || item.bbox[1]+item.bbox[3]>.6) continue;
  const label=data.objectLabels[item.object_type]||({bottle:'병',cup:'컵'}[item.object_type])||'물건';
  hazards.push({object:item.object_type,object_label:label,instance_label:`${label} 낙하 여부 확인`,risk_level:'LOW',bbox:item.bbox,description:`사진 위쪽에서 ${label} 후보가 보입니다. 실제로 높은 곳이나 가구 가장자리에 놓였는지 확인하세요. 사진만으로 높이와 안정성은 판단할 수 없습니다.`,recommendation:'불안정하거나 가장자리에 놓였다면 떨어지지 않는 낮고 안정적인 위치로 옮기세요.',supplement:'주변에서 사람이 부딪히거나 잡아당길 가능성도 확인하세요.',accident:'낙하 가능 여부를 확인하세요.'});
 }
 hazards.sort((a,b)=>levels[b.risk_level]-levels[a.risk_level]);
 const high=hazards.filter(h=>h.risk_level==='HIGH').length;
 const score=hazards.length?Math.max(0,Math.min(high>=2?40:high?60:80,100-hazards.reduce((sum,h)=>sum+levels[h.risk_level],0))):null;
 return {scan_id:`local-${Date.now()}`,hazards,detected_objects:detections,safety_score:score,score_computable:!!hazards.length,explanation_pending:false,notice:actualRoom?(electrical?'물기·매트와 낙하 후보는 실제 상태를 확인해야 하며 탐지되지 않을 수 있습니다. 휴대폰 내 가구 및 전기설비 후보 분석입니다. 전선·멀티탭·플러그가 빠지거나 잘못 탐지될 수 있으니 현장을 반드시 확인하세요.':'가구 모서리가 탐지되지 않을 수 있으니 직접 확인하세요. 휴대폰 내 가구·일반 물건 점검입니다. 전선·콘센트·멀티탭·플러그는 탐지하지 못하므로 직접 확인하세요.'):'공간을 자동 판별하지 못해 점수를 산정하지 않았습니다. 공간을 직접 선택해 다시 점검하세요.'};
}

// 공통 규칙만 사용하며 사용자나 공간을 추정하지 않습니다.
export function generalOfflineResult(detections,electrical=false) {
 return offlineResult(detections,'elderly','living_room',electrical,true);
}
