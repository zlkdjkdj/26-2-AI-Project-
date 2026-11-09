import test from "node:test";
import assert from "node:assert/strict";
import { scoreMessage } from "../src/scanFeedback.js";

test("unassessed photos explain missing detections rather than implying safety", () => {
  assert.match(scoreMessage({ score_computable: false, detected_objects: [] }), /다시 촬영/);
  assert.match(scoreMessage({ score_computable: false, detected_objects: [{}] }), /적용할 위험 확인 항목이 없어/);
  assert.match(scoreMessage({ score_computable: true, safety_score: 0 }), /참고 점수/);
});
