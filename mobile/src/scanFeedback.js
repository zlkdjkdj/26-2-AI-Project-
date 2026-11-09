export function scoreMessage(result) {
  if (result.score_computable !== false) return "사진 확인 항목에 한정한 참고 점수입니다.";
  if (!(result.detected_objects || []).length) return "사진에서 평가할 수 있는 가구·전기설비를 찾지 못해 점수를 계산하지 않았습니다. 조명을 밝히고 가구·바닥·이동 통로가 함께 보이도록 다시 촬영해 주세요.";
  return "물건은 탐지했지만 선택한 대상자·공간에 적용할 위험 확인 항목이 없어 점수를 계산하지 않았습니다. 안전하다는 의미는 아니며 실제 사용 환경을 확인해 주세요.";
}
