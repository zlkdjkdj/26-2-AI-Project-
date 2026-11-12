import test from "node:test";
import assert from "node:assert/strict";
import { advancePersonTrack } from "../src/personTracking.js";

const box = (x) => ({ x, y: .2, width: .2, height: .4, frameWidth: 1280, frameHeight: 720 });
test("a moving person is followed smoothly without overshooting", () => {
  const first = advancePersonTrack(null, box(.1), 100);
  const moving = advancePersonTrack(first, box(.5), 100);
  assert.ok(moving.x > .1 && moving.x < .5);
  const next = advancePersonTrack(moving, box(.5), 100);
  assert.ok(next.x > moving.x && next.x < .5);
});
test("lost, failed, and invalid detections remove the displayed box", () => {
  assert.equal(advancePersonTrack(box(.1), null, 100), null);
  assert.equal(advancePersonTrack(box(.1), { error: 1 }, 100), null);
  assert.equal(advancePersonTrack(box(.1), box(NaN), 100), null);
});
test("a long pause or orientation change starts tracking afresh", () => {
  assert.deepEqual(advancePersonTrack(box(.1), box(.7), 800), box(.7));
  const rotated = { ...box(.6), frameWidth: 720, frameHeight: 1280 };
  assert.deepEqual(advancePersonTrack(box(.1), rotated, 100), rotated);
});
