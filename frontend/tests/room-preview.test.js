import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const { code }=transformSync(readFileSync(new URL('../src/RoomPreview.jsx',import.meta.url),'utf8'),{loader:'jsx',format:'cjs',jsx:'transform'});
const module={exports:{}};
runInNewContext(code,{module,exports:module.exports,React,require:()=>React});
const Preview=module.exports.default;
const style={name:'테스트 컨셉',wall:'#ffffff',floor:'#bd966e',fabric:'#c8bca4',accent:'#71806c'};
const render=items=>renderToStaticMarkup(React.createElement(Preview,{items,style}));

test('preview contains only provided furniture and explicitly identifies simulation',()=>{
  const empty=render([]);
  assert.ok(empty.includes('배치할 가구가 탐지되지'));
  assert.ok(empty.includes('실제 사진 편집·실측 결과가 아닙니다'));
  assert.ok(!empty.includes('<circle'));
  const item={id:'bed-1',kind:'bed',x:.2,y:.3,width:.25,depth:.3,rotation:0};
  const original=render([item]);
  assert.ok(original.includes('>1</text>'));
  assert.ok(!original.includes('>2</text>'));
  assert.notEqual(original,render([{...item,x:.8,rotation:90}]));
  assert.ok(original.includes('#bd966e'));
});

test('same-kind furniture remains separately numbered',()=>{
  const item={kind:'chair',x:.2,y:.3,width:.1,depth:.1,rotation:0};
  const html=render([{...item,id:'a'},{...item,id:'b',x:.8}]);
  assert.ok(html.includes('>1</text>')&&html.includes('>2</text>'));
});

test('wall and floor custom colors and patterns change the exported drawing',()=>{
  const colored={...style,wall:'#d8e2dd',floor:'#987655',floor_pattern:'tile'};
  const tile=renderToStaticMarkup(React.createElement(Preview,{items:[],style:colored}));
  assert.ok(tile.includes('#d8e2dd')&&tile.includes('#987655'));
  assert.equal((tile.match(/<line /g)||[]).length,8);
  const plain=renderToStaticMarkup(React.createElement(Preview,{items:[],style:{...colored,floor_pattern:'plain'}}));
  assert.equal((plain.match(/<line /g)||[]).length,0);
});
