import test from "node:test";
import assert from "node:assert/strict";
import { runPhotoAnalysis } from "../src/photoAnalysis.js";

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve=yes; reject=no; }); return { promise, resolve, reject }; };

test("parallel mode starts both models and publishes the local result before the extra model", async () => {
  const local = deferred(), extra = deferred(), calls = [], partials = [];
  const bridge = { detectOfflinePhoto: () => { calls.push("local"); return local.promise; }, detectElectricalPhoto: (_uri, parallel) => { calls.push(`extra:${parallel}`); return extra.promise; } };
  const result = runPhotoAnalysis({ bridge, uri: "file:///test.jpg", useExtra: true, parallel: true, onPartial: value => partials.push(value) });
  await Promise.resolve();
  assert.deepEqual(calls.sort(), ["extra:true", "local"]);
  local.resolve([{ object_type: "chair" }]);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(partials.length, 1);
  extra.resolve([{ object_type: "electric_fan" }]);
  const output = await result;
  assert.deepEqual(output.detections.map(x => x.object_type), ["chair", "electric_fan"]);
  assert.equal(output.extraUsed, true);
});

test("low memory mode runs models sequentially and preserves local results if extra fails", async () => {
  const calls = [], partials = [];
  const bridge = { detectOfflinePhoto: async () => { calls.push("local"); return [{ object_type: "desk" }]; }, detectElectricalPhoto: async (_uri, parallel) => { calls.push(`extra:${parallel}`); throw new Error("additional model failed"); } };
  const output = await runPhotoAnalysis({ bridge, uri: "file:///test.jpg", useExtra: true, parallel: false, onPartial: value => partials.push(value) });
  assert.deepEqual(calls, ["local", "extra:false"]);
  assert.equal(partials.length, 1);
  assert.equal(output.detections[0].object_type, "desk");
  assert.equal(output.extraUsed, false);
  assert.match(output.extraError, /failed/);
});

test("disabling the extra model runs only local analysis", async () => {
  const bridge = { detectOfflinePhoto: async () => [], detectElectricalPhoto: () => { throw new Error("unexpected"); } };
  assert.deepEqual(await runPhotoAnalysis({ bridge, uri: "file:///test.jpg", useExtra: false, parallel: false }), { detections: [], extraUsed: false });
});
