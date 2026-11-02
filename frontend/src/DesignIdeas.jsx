const levels = { HIGH: '고위험', MEDIUM: '중위험', LOW: '저위험' };
const priority = { HIGH: 0, MEDIUM: 1, LOW: 2 };
const finishes = {
  minimal: '기존 수납장과 같은 밝은 색으로 정리용품을 맞추면 시각적인 복잡함을 줄일 수 있어요.',
  natural: '기존 우드 가구를 살리고 베이지·자연색 수납용품으로 색을 통일해 보세요.',
  soft: '기존 가구에 차분한 회청색 포인트를 더해 보세요. 장식은 이동 경로 밖에 두세요.',
  scandinavian: '밝은 우드와 간결한 수납에 작은 색 포인트를 더해 보세요.',
  japandi: '자연 질감과 차분한 중립색을 살리고 장식은 꼭 필요한 만큼만 두세요.',
  industrial: '현재 우드 가구에 짙은 금속색 포인트를 조합하되 돌출된 모서리는 직접 확인하세요.',
  classic: '기존 가구의 좌우 균형과 크림색·짙은 우드의 조화를 먼저 맞춰 보세요.',
  accessible: '바닥과 가구 가장자리를 구분하기 쉬운 색 대비를 고려하고, 필요한 물건의 접근 위치를 직접 확인하세요.',
};

export default function DesignIdeas({ guide, concept }) {
  if (!guide) return null;
  const pending = guide.steps.filter(step => !step.completed)
    .sort((a, b) => priority[a.risk_level] - priority[b.risk_level]);
  const ideas = pending.slice(0, 3);
  return <section className="design-ideas" aria-label="분석 결과를 반영한 개선 제안">
    <h3>우리 공간에서 먼저 바꿔볼 것</h3>
    <p>{guide.principle}</p>
    {ideas.length ? <ol>{ideas.map(idea => <li key={idea.key}>
      <div><strong>{idea.title}</strong><span>{levels[idea.risk_level]} · {idea.source === 'user_confirmation' ? '직접 점검에서 확인' : '사진 탐지·규칙 기반 확인 항목'}</span></div>
      <p>{idea.first}</p><p className="idea-supplement">{idea.supplement}</p>
    </li>)}</ol> : <p className="idea-supplement">{guide.steps.length ? '등록된 개선 항목에 완료 표시했어요. 실제 개선 여부는 재촬영과 직접 점검으로 확인하세요.' : '이 사진에서 연결된 개선 항목이 없어요. 직접 점검으로 보완해 주세요.'}</p>}
    {pending.length > 3 && <p className="idea-supplement">추가 {pending.length - 3}개 항목은 아래 안전 개선 체크리스트에서 확인할 수 있어요.</p>}
    <div className="design-finish"><strong>선택한 분위기에 맞추려면</strong><p>{finishes[concept]}</p></div>
    <p className="idea-supplement">{guide.target_tip}</p>
    <small>사진에서 보이지 않는 조건과 실제 치수는 직접 확인하세요. 제안이나 완료 표시로 안전점수는 바뀌지 않아요.</small>
  </section>;
}
