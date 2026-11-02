import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const source = readFileSync(new URL('../src/DesignIdeas.jsx', import.meta.url), 'utf8');
const { code } = transformSync(source, { loader: 'jsx', format: 'cjs', jsx: 'transform' });
const module = { exports: {} };
runInNewContext(code, { module, exports: module.exports, React });
const DesignIdeas = module.exports.default;
const step = (key, risk_level, extra = {}) => ({ key, title: key, first: '개선 안내', supplement: '보완 안내', risk_level, source: 'photo', completed: false, ...extra });
const render = steps => renderToStaticMarkup(React.createElement(DesignIdeas, {
  guide: { principle: '현재 가구 활용', steps, target_tip: '직접 확인' }, concept: 'natural',
}));

test('prioritizes pending risks, limits suggestions and explains their evidence', () => {
  const html = render([step('low', 'LOW'), step('done', 'HIGH', { completed: true }),
    step('medium', 'MEDIUM'), step('high', 'HIGH', { source: 'user_confirmation' }), step('extra', 'LOW')]);
  assert.ok(html.indexOf('>high<') < html.indexOf('>medium<'));
  assert.ok(html.indexOf('>medium<') < html.indexOf('>low<'));
  assert.ok(!html.includes('>done<') && !html.includes('>extra<'));
  assert.ok(html.includes('직접 점검에서 확인') && html.includes('사진 탐지·규칙 기반 확인 항목'));
  assert.ok(html.includes('추가 1개') && html.includes('기존 우드 가구'));
});

test('empty and completed checklists do not imply that the space is safe', () => {
  assert.ok(render([]).includes('직접 점검으로 보완'));
  const completed = render([step('done', 'HIGH', { completed: true })]);
  assert.ok(completed.includes('재촬영과 직접 점검으로 확인'));
  assert.ok(completed.includes('안전점수는 바뀌지'));
});

test('renders rule text as text rather than executable markup', () => {
  const html = render([step('escaped', 'HIGH', { first: '<script>alert(1)</script>' })]);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});
