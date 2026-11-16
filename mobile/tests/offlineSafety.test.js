import test from 'node:test';
import assert from 'node:assert/strict';
import { offlineResult, generalOfflineResult } from '../src/offlineSafety.js';
test('local furniture rules apply conservative score and clearly exclude electrical',()=>{
 const result=offlineResult([{object_type:'chair',confidence:.9,bbox:[.4,.5,.2,.3]}],'elderly','living_room');
 assert.equal(result.hazards[0].risk_level,'MEDIUM'); assert.equal(result.safety_score,80); assert.match(result.notice,/전선/);
});
test('no evidence or unknown room does not claim a score',()=>{
 assert.equal(offlineResult([],'elderly','living_room').score_computable,false);
 assert.equal(offlineResult([{object_type:'chair',confidence:.9,bbox:[.4,.5,.2,.3]}],'elderly','auto').score_computable,false);
});
test('electrical detections yield specific risks without implying certainty',()=>{
 const items=[{object_type:'electric_wire',confidence:.7,bbox:[.3,.8,.4,.1]},{object_type:'power_strip',confidence:.8,bbox:[.5,.4,.2,.1]},{object_type:'electric_plug',confidence:.7,bbox:[.1,.5,.1,.1]}];
 const result=offlineResult(items,'elderly','living_room',true);
 assert.ok(result.hazards.some(h=>h.object==='electric_wire'&&h.risk_level==='MEDIUM'));
 assert.ok(result.hazards.some(h=>h.object==='power_strip'));
 assert.ok(result.hazards.some(h=>h.object==='electric_plug'));
 assert.match(result.notice,/잘못 탐지/);
});
test('overlapping electrical classes are identified as uncertain',()=>{
 const result=offlineResult([{object_type:'socket',confidence:.8,bbox:[.3,.4,.2,.2],alternative_types:['power_strip','electric_plug']}],'elderly','living_room',true);
 assert.match(result.hazards[0].description,/멀티탭/);
 assert.match(result.hazards[0].description,/실제 종류를 확인/);
 assert.equal(result.hazards.length,1);
});

test('table detections produce a corner check without asserting a sharp corner',()=>{
 const result=offlineResult([{object_type:'dining_table',confidence:.28,bbox:[.2,.55,.7,.4]}],'elderly','living_room');
 assert.equal(result.hazards.length,1);
 assert.match(result.hazards[0].instance_label,/모서리 확인/);
 assert.match(result.hazards[0].description,/확정할 수 없습니다/);
 assert.match(result.hazards[0].recommendation,/모서리 보호대/);
});
test('missed tables do not create invented boxes and still require manual checks',()=>{
 const result=offlineResult([{object_type:'tv',confidence:.9,bbox:[.2,.2,.3,.3]}],'elderly','living_room');
 assert.ok(!result.hazards.some(h=>h.object==='dining_table'));
 assert.match(result.notice,/모서리가 탐지되지 않을 수/);
});

test('general checks flag furniture corners without assuming a person or room',()=>{
 for(const kind of ['chair','couch','bed','dining_table']) {
  const result=generalOfflineResult([{object_type:kind,confidence:.8,bbox:[.2,.4,.4,.4]}]);
  assert.match(result.hazards[0].instance_label,/모서리 확인/);
  assert.match(result.hazards[0].description,/확정할 수 없습니다/);
  assert.doesNotMatch(result.hazards[0].description,/노약자|거실/);
  assert.equal(result.hazards[0].placement_advice,null);
 }
});
test('general checks do not require detected room to produce a score',()=>{
 const result=generalOfflineResult([{object_type:'chair',confidence:.8,bbox:[.2,.4,.4,.4]}]);
 assert.equal(result.score_computable,true);
});

test('wet-floor and rug candidates ask for verification instead of asserting slipping',()=>{
 const results=generalOfflineResult([{object_type:'wet_floor',confidence:.7,bbox:[.1,.6,.6,.2]},{object_type:'rug',confidence:.7,bbox:[.2,.6,.4,.2]}],true);
 assert.equal(results.hazards.length,2);
 assert.match(results.hazards[0].description,/확인/);
 assert.match(results.hazards[0].supplement,/확정할 수 없습니다/);
});
test('upper objects prompt a fall check without claiming actual height',()=>{
 const result=generalOfflineResult([{object_type:'bottle',confidence:.8,bbox:[.3,.1,.1,.2]}]);
 assert.ok(result.hazards.some(h=>/낙하 여부 확인/.test(h.instance_label)));
 assert.match(result.hazards[0].description,/높이와 안정성은 판단할 수 없습니다/);
});
