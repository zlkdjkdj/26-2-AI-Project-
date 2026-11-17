import test from "node:test";
import assert from "node:assert/strict";
import { ANCHORS, CLASSES, letterbox, decodeOutput, finalize, needsTableTiles, tileRects, iou } from "../src/yolo.js";

function tensor(entries) {
  const data = new Float32Array(84 * ANCHORS);
  entries.forEach(([i, cls, score, cx, cy, w, h]) => {
    data[i] = cx; data[ANCHORS + i] = cy; data[2 * ANCHORS + i] = w; data[3 * ANCHORS + i] = h;
    data[(cls + 4) * ANCHORS + i] = score;
  });
  return data;
}

test("letterbox centers a landscape image", () => {
  const lb = letterbox(1920, 1080);
  assert.equal(lb.rw, 640); assert.equal(lb.rh, 360); assert.equal(lb.px, 0); assert.equal(lb.py, 140);
});

test("decodeOutput maps model coordinates back to normalized image coordinates", () => {
  const image = { width: 1280, height: 640 };
  const source = { left: 0, top: 0, right: 1280, bottom: 640 };
  // 640x320 레터박스(py=160). 모델 공간 중앙 (320,320), 크기 100x100 → 원본 중앙, 200x200
  const boxes = decodeOutput(tensor([[0, 56, 0.9, 320, 320, 100, 100]]), source, image);
  assert.equal(boxes.length, 1);
  assert.equal(CLASSES[boxes[0].cls], "chair");
  assert.ok(Math.abs(boxes[0].x - (540 / 1280)) < 1e-6);
  assert.ok(Math.abs(boxes[0].y - (220 / 640)) < 1e-6);
  assert.ok(Math.abs(boxes[0].w - (200 / 1280)) < 1e-6);
});

test("score thresholds: 0.35 default, 0.24 for dining table", () => {
  const image = { width: 640, height: 640 }, source = { left: 0, top: 0, right: 640, bottom: 640 };
  assert.equal(decodeOutput(tensor([[1, 56, 0.30, 100, 100, 50, 50]]), source, image).length, 0);
  assert.equal(decodeOutput(tensor([[1, 60, 0.30, 100, 100, 50, 50]]), source, image).length, 1);
});

test("tile pass keeps only chair/couch/bed/table", () => {
  const image = { width: 640, height: 640 }, source = { left: 0, top: 0, right: 640, bottom: 640 };
  const data = tensor([[1, 56, 0.9, 100, 100, 50, 50], [2, 0, 0.9, 300, 300, 50, 50]]);
  const boxes = decodeOutput(data, source, image, true);
  assert.deepEqual(boxes.map(b => b.cls), [56]);
});

test("finalize applies per-class NMS and caps results", () => {
  const a = { cls: 56, score: 0.9, x: 0.1, y: 0.1, w: 0.3, h: 0.3 };
  const b = { cls: 56, score: 0.8, x: 0.11, y: 0.11, w: 0.3, h: 0.3 };
  const c = { cls: 57, score: 0.7, x: 0.11, y: 0.11, w: 0.3, h: 0.3 };
  const out = finalize([b, a, c]);
  assert.deepEqual(out.map(o => o.object_type), ["chair", "couch"]);
  assert.ok(iou(a, b) > 0.45);
  const many = Array.from({ length: 80 }, (_, i) => ({ cls: 0, score: 0.9 - i * 0.001, x: (i % 10) / 10, y: Math.floor(i / 10) / 10, w: 0.05, h: 0.05 }));
  assert.equal(finalize(many).length, 50);
});

test("table tile decision follows area and bottom position", () => {
  assert.equal(needsTableTiles([]), true);
  assert.equal(needsTableTiles([{ cls: 60, w: 0.5, h: 0.3, y: 0.6 }]), false);
  assert.equal(needsTableTiles([{ cls: 60, w: 0.1, h: 0.1, y: 0.6 }]), true);
  const [l, r] = tileRects(1000, 800);
  assert.equal(l.right, 720); assert.equal(r.left, 280); assert.equal(l.top, 200);
});
