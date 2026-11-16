import test from 'node:test';
import assert from 'node:assert/strict';
import {fittedSize,clampPosition,zoomAtCenter} from '../src/photoZoomGeometry.js';
test('fits photo while preserving aspect ratio',()=>{assert.deepEqual(fittedSize({width:300,height:600},{width:1200,height:600}),{width:300,height:150});});
test('zooming and panning keeps photo in view without changing box coordinates',()=>{
 const view={width:300,height:600}, base={width:300,height:150}, initial={scale:1,x:0,y:225};
 const enlarged=zoomAtCenter(view,base,initial,3,0,0);
 assert.deepEqual(enlarged,{scale:3,x:-300,y:75});
 const moved=zoomAtCenter(view,base,enlarged,3,999,-999);
 assert.deepEqual(moved,{scale:3,x:0,y:75});
 assert.equal(zoomAtCenter(view,base,enlarged,99).scale,4);
 assert.equal(zoomAtCenter(view,base,enlarged,.1).scale,1);
});
test('small fitted image is centered at minimum zoom',()=>{assert.deepEqual(clampPosition({width:300,height:500},{width:300,height:150},1,99,-5),{x:0,y:175});});
