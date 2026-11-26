import test from "node:test";
import assert from "node:assert/strict";
import { containBox } from "../src/videoFit.js";

const tablet = { width: 1500, height: 1100 };

test("가로 영상은 가로로 넓게 비율을 지키며 가운데에 놓인다", () => {
  const box = containBox({ width: 1280, height: 720, turn: 0 }, tablet);
  assert.equal(box.width, 1500);
  assert.equal(Math.round(box.height), 844);
  assert.equal(Math.round(box.top), 128);
});

test("90도 회전 영상은 세로 화면비로 계산한다", () => {
  const box = containBox({ width: 1280, height: 720, turn: 90 }, tablet);
  assert.equal(box.height, 1100);
  assert.equal(Math.round(box.width), 619);
  assert.equal(Math.round(box.left), 441);
});

test("크기를 모르면 상자를 만들지 않는다", () => {
  assert.equal(containBox({ width: 0, height: 0 }, tablet), null);
  assert.equal(containBox({ width: 1280, height: 720 }, { width: 0, height: 0 }), null);
});
