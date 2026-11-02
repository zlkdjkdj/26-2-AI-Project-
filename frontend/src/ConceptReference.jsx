const references = {
  minimal: { id: 19889135, author: 'Lisa Anna', title: '밝은 흰색과 간결한 가구', points: ['벽·커튼·큰 가구의 밝은 색 통일', '작은 물건은 닫힌 수납으로 정리', '러그·장식은 색감 참고용이며 안전 권장품은 아니에요.'] },
  natural: { id: 6588599, author: 'Max Vakhtbovych', title: '우드 바닥과 테이블의 따뜻한 질감', points: ['기존 나무 가구의 색을 기준으로 조합', '베이지·회색으로 큰 면의 색을 정돈', '장식을 늘리기보다 가구 사이 여백을 확인해요.'] },
  soft: { id: 19899076, author: 'Lisa Anna', title: '회청색 벽과 차분한 포인트', points: ['차분한 벽색에 기존 중립색 가구 활용', '조명과 작은 소품으로 포인트', '유리 상판·러그 등은 그대로 따라 하기 전 별도 점검해요.'] },
  accessible: { id: 29120627, author: 'DARKMODE CINEMA', title: '생활 구역 옆에 남기는 이동 여백', points: ['큰 가구를 모아 비워둘 구역을 구분', '가구 가장자리가 보이는 색 대비 고려', '이 사진은 접근성 인증 사례가 아니며 실제 이동 폭은 직접 확인해요.'] },
  scandinavian: { id:31594912,author:'Edmond Elshani',title:'밝은 빛과 간결한 소재',points:['밝은 우드와 흰색을 기본으로 활용','작은 색 포인트와 실용적인 수납','러그·화분은 이동과 물기·고정 상태를 별도로 확인해요.'] },
  japandi: { id:29383009,author:'Pavel Morillo',title:'차분한 질감과 절제된 장식',points:['베이지·우드·무광 질감 중심','장식 수보다 넉넉한 여백을 우선','낮은 가구는 앉고 일어나는 편의성을 직접 확인해요.'] },
  industrial: { id:8089269,author:'Max Vakhtbovych',title:'벽돌·금속·우드의 대비',points:['기존 우드와 짙은 금속 포인트 조합','가구를 많이 늘리지 않고 소재로 분위기 표현','노출된 모서리와 전선은 장식으로 남기지 말고 정리해요.'] },
  classic: { id:7045700,author:'Max Vakhtbovych',title:'차분한 균형과 우아한 포인트',points:['크림색과 짙은 우드로 조화','기존 가구를 활용해 좌우 균형 조절','두꺼운 러그나 큰 장식은 이동 경로를 막지 않는지 확인해요.'] },
};

export default function ConceptReference({ concept, name }) {
  const ref = references[concept];
  return <section className="concept-reference">
    <div className="reference-image"><img src={`/interior/${concept}.webp`} alt={`${name} 분위기를 참고하는 실제 거실 사진`} loading="lazy"/><span>실제 참고 사진 · 다른 집의 사례</span></div>
    <div className="reference-copy"><span className="eyebrow">이 컨셉을 실제 공간에서 보면</span><h3>{ref.title}</h3><ul>{ref.points.map(point => <li key={point}>{point}</li>)}</ul><a href={`https://www.pexels.com/photo/${ref.id}/`} target="_blank" rel="noreferrer">사진: {ref.author} / Pexels ↗</a><small>참고 사진의 가구·치수는 우리 공간과 달라요. 분위기를 참고하고, 배치는 현재 가구를 기준으로 조정하세요.</small></div>
  </section>;
}
