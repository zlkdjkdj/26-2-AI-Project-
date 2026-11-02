import test from 'node:test';
import assert from 'node:assert/strict';
import {filterActions} from '../src/planner.js';
import {applyMeasurements,spatialWarnings} from '../src/layout.js';

test('filters actions without losing original safety records or mutating them',()=>{
  const steps=[{key:'a',risk_level:'HIGH',options:[{action:'정리',budget:'no_purchase',effort:'quick'},{action:'설치',budget:'professional',effort:'assistance'}]}];
  const before=JSON.stringify(steps),filtered=filterActions(steps,'no_purchase','quick');
  assert.equal(filtered.length,1);assert.equal(filtered[0].visibleOptions.length,1);assert.equal(filtered[0].risk_level,'HIGH');
  assert.equal(filterActions(steps,'professional','quick').length,0);
  assert.equal(JSON.stringify(steps),before);
});

test('measured sizes stay stable across repeated edits and door warnings update live',()=>{
  const items=[{id:'a',label:'의자',width:.1,depth:.1,x:.15,y:.1,rotation:0}];
  const measurements=[{id:'a',width_m:.8,depth_m:.6,fixed:true}];
  const measured=applyMeasurements(items,4,3,measurements);
  assert.ok(Math.abs(measured[0].width-.2)<1e-9);assert.ok(Math.abs(measured[0].depth-.2)<1e-9);assert.ok(measured[0].fixed);
  assert.deepEqual(applyMeasurements(measured,4,3,measurements),measured);
  const zone={id:'door',label:'문',x:0,y:0,width:.25,depth:.3,reserve:true};
  assert.equal(spatialWarnings(measured,[zone]).length,1);
  assert.equal(spatialWarnings([{...measured[0],x:.8,y:.8}],[zone]).length,0);
  assert.equal(applyMeasurements(measured,'','',[])[0].width,.1);
});
