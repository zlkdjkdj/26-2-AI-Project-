export function scoreMessage(result) {
  if (result.score_computable !== false) return "사진 확인 항목에 한정한 참고 점수입니다.";
  if ((result.hazards || []).some(h => h.risk_level === "CHECK")) return "물건의 종류를 확인해야 해 점수 산정을 보류했습니다. 사진을 확대하고 실제 물건을 확인하세요.";
  if (!(result.detected_objects || []).length) return "사진에서 평가할 수 있는 가구·전기설비를 찾지 못해 점수를 계산하지 않았습니다. 조명을 밝히고 가구·바닥·이동 통로가 함께 보이도록 다시 촬영해 주세요.";
  return "물건은 탐지했지만 선택한 대상자·공간에 적용할 위험 확인 항목이 없어 점수를 계산하지 않았습니다. 안전하다는 의미는 아니며 실제 사용 환경을 확인해 주세요.";
}

// Summarize only the candidates actually returned by the on-device scan.
export function overallFeedback(result) {
  const hazards = result.hazards || [];
  const order = { HIGH: 0, MEDIUM: 1, LOW: 2, CHECK: 3 };
  const ranked = [...hazards].sort((a, b) => (order[a.risk_level] ?? 3) - (order[b.risk_level] ?? 3));
  const counts = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  const actions = [];
  const seen = new Set();
  for (const hazard of ranked) {
    if (hazard.risk_level in counts) counts[hazard.risk_level]++;
    const action = hazard.recommendation?.trim();
    if (action && !seen.has(action)) {
      seen.add(action);
      actions.push({ label: hazard.instance_label || hazard.object_label || "위험 후보", text: action });
    }
  }
  const pending = hazards.filter(h => h.risk_level === "CHECK").length;
  return {
    counts,
    summary: hazards.length
      ? `${hazards.length}개 확인 항목 중 고위험 ${counts.HIGH}개, 중위험 ${counts.MEDIUM}개, 저위험 ${counts.LOW}개${pending ? `, 종류 확인 필요 ${pending}개` : ""}입니다. 위험도가 높은 항목부터 실제 상태를 확인하세요.`
      : "확인할 위험 후보를 찾지 못했습니다. 사진에서 보이지 않거나 탐지하지 못한 위험도 있을 수 있으므로 현장을 직접 확인하세요.",
    actions: actions.slice(0, 3),
  };
}
