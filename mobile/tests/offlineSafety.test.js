import test from 'node:test';
import assert from 'node:assert/strict';
import { offlineResult } from '../src/offlineSafety.js';
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
