import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutWarnings, constrainPlacement } from '../src/layout.js';

const sofa = { id: 'sofa', label: '소파', x: .25, y: .3, width: .28, depth: .13, rotation: 0 };

test('moving furniture immediately adds and removes overlap warnings', () => {
  const chair = { ...sofa, id: 'chair', label: '의자', x: .8, width: .1, depth: .1 };
  assert.deepEqual(layoutWarnings([sofa, chair]), []);
  assert.ok(layoutWarnings([sofa, { ...chair, x: .25 }]).some(w => w.includes('소파가 가상 배치도에서 겹쳐요')));
  assert.deepEqual(layoutWarnings([sofa, chair]), []);
});

test('rotation changes boundary and guide checks', () => {
  const nearEdge = { ...sofa, x: .1 };
  assert.ok(layoutWarnings([nearEdge]).some(w => w.includes('경계')));
  assert.deepEqual(layoutWarnings([{ ...nearEdge, rotation: 90 }]), []);
  const nearGuide = { ...sofa, x: .3 };
  assert.ok(layoutWarnings([nearGuide]).some(w => w.includes('동선')));
  assert.deepEqual(layoutWarnings([{ ...nearGuide, rotation: 270 }]), []);
});

test('rotation is also respected when checking furniture overlap', () => {
  const chair = { ...sofa, label: '의자', x: .43, width: .1, depth: .1 };
  assert.ok(layoutWarnings([sofa, chair]).some(w => w.includes('소파가 가상 배치도에서 겹쳐요')));
  assert.ok(!layoutWarnings([{ ...sofa, rotation: 90 }, chair]).some(w => w.includes('소파가 가상 배치도에서 겹쳐요')));
});

test('empty diagrams and furniture exactly at the boundary do not warn', () => {
  assert.deepEqual(layoutWarnings([]), []);
  assert.deepEqual(layoutWarnings([{ ...sofa, x: .14 }]), []);
});

test('dragging and rotating keep the full furniture shape inside the board',()=>{
  const corner=constrainPlacement(sofa,-10,10);
  assert.ok(corner.x>=sofa.width/2 && corner.y<=1-sofa.depth/2);
  assert.deepEqual(layoutWarnings([corner]),[]);
  const rotated=constrainPlacement({...sofa,rotation:90},1,0);
  assert.ok(rotated.x<=1-sofa.depth/2 && rotated.y>=sofa.width/2);
  assert.deepEqual(layoutWarnings([rotated]),[]);
});
