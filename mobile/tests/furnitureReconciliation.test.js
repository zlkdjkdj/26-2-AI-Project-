import test from "node:test";
import assert from "node:assert/strict";
import { reconcileFurniture, sameObject } from "../src/furnitureReconciliation.js";
import { generalOfflineResult } from "../src/offlineSafety.js";
import { scoreMessage } from "../src/scanFeedback.js";
const box = [0.2, 0.3, 0.25, 0.3];
const local = (object_type, bbox = box) => ({ object_type, confidence: .8, bbox });
const extra = (object_type, bbox = box, alternative_types = []) => ({ object_type, confidence: .7, bbox, alternative_types, source: "grounding_furniture" });

test("fan and chair disagreement remains an unscored item to verify", () => {
  const detections = reconcileFurniture([local("chair"), extra("electric_fan")]);
  assert.equal(detections.length, 1);
  assert.equal(detections[0].object_type, "uncertain_furniture");
  assert.deepEqual(detections[0].alternative_types, ["chair", "electric_fan"]);
  const result = generalOfflineResult(detections, true);
  assert.equal(result.hazards[0].risk_level, "CHECK");
  assert.equal(result.score_computable, false);
  assert.equal(result.safety_score, null);
  assert.match(scoreMessage(result), /종류를 확인/);
});

test("separate nearby fan and chair remain separate and can be checked", () => {
  const a = [0.1, .4, .1, .2], b = [.23, .4, .1, .2];
  assert.equal(sameObject(a, b), false);
  const detections = reconcileFurniture([local("chair", a), extra("electric_fan", b)]);
  assert.deepEqual(detections.map(d => d.object_type), ["chair", "electric_fan"]);
  assert.ok(generalOfflineResult(detections, true).hazards.some(h => h.object_label === "선풍기"));
});

test("a desk confirmation refines a matching table and retains corner advice", () => {
  const detections = reconcileFurniture([local("dining_table"), extra("desk")]);
  assert.equal(detections.length, 1);
  assert.equal(detections[0].object_type, "desk");
  const result = generalOfflineResult(detections, true);
  assert.ok(result.hazards.some(h => h.object_label === "책상" && /모서리/.test(h.recommendation)));
});

test("agreement avoids duplicates and without extra model baseline is unchanged", () => {
  const source = local("chair");
  assert.deepEqual(reconcileFurniture([source]), [source]);
  const result = reconcileFurniture([source, extra("chair")]);
  assert.equal(result.length, 1);
  assert.equal(result[0].classification_confirmed, true);
});

test("chooses the closest overlapping object instead of the first one", () => {
  const result = reconcileFurniture([local("chair", [0.2, .3, .3, .3]), local("chair", [0.25, .3, .2, .3]), extra("electric_fan", [0.25, .3, .2, .3])]);
  assert.equal(result[0].object_type, "chair");
  assert.equal(result[1].object_type, "uncertain_furniture");
});
