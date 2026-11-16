import test from "node:test";
import assert from "node:assert/strict";
import { overallFeedback, scoreMessage } from "../src/scanFeedback.js";

test("unassessed photos explain missing detections rather than implying safety", () => {
  assert.match(scoreMessage({ score_computable: false, detected_objects: [] }), /다시 촬영/);
  assert.match(scoreMessage({ score_computable: false, detected_objects: [{}] }), /적용할 위험 확인 항목이 없어/);
  assert.match(scoreMessage({ score_computable: true, safety_score: 0 }), /참고 점수/);
});

test("overall feedback orders recommendations by risk and removes duplicates", () => {
  const feedback = overallFeedback({ hazards: [
    { risk_level: "LOW", object_label: "의자", recommendation: "모서리 확인" },
    { risk_level: "HIGH", object_label: "전선", recommendation: "전선 확인" },
    { risk_level: "MEDIUM", object_label: "멀티탭", recommendation: "전선 확인" },
  ] });
  assert.deepEqual(feedback.counts, { HIGH: 1, MEDIUM: 1, LOW: 1 });
  assert.deepEqual(feedback.actions.map(a => a.text), ["전선 확인", "모서리 확인"]);
  assert.match(overallFeedback({ hazards: [] }).summary, /직접 확인/);
});
