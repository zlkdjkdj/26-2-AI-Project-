import test from "node:test";
import assert from "node:assert/strict";
import { mapPersonBox } from "../src/personBoxGeometry.js";

test("contain positions the box within the letterboxed video", () => {
  assert.deepEqual(mapPersonBox({ x: .25, y: .25, width: .5, height: .5 }, { width: 1600, height: 900 }, { width: 400, height: 400 }),
    { left: 100, top: 143.75, width: 200, height: 112.5 });
});
test("cover clips a box at the cropped viewport edge", () => {
  assert.deepEqual(mapPersonBox({ x: 0, y: 0, width: .5, height: 1 }, { width: 1600, height: 900 }, { width: 400, height: 400 }, "cover"),
    { left: 0, top: 0, width: 200, height: 400 });
});
test("rejects invalid and entirely out-of-frame boxes", () => {
  const frame = { width: 100, height: 100 }, view = { width: 100, height: 100 };
  assert.equal(mapPersonBox({ x: NaN, y: 0, width: 1, height: 1 }, frame, view), null);
  assert.equal(mapPersonBox({ x: 2, y: 0, width: .1, height: 1 }, frame, view), null);
  assert.equal(mapPersonBox({ x: 0, y: 0, width: 1, height: 1 }, frame, view, "stretch"), null);
});
