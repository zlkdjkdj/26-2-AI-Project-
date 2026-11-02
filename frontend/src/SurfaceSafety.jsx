export default function SurfaceSafety({data}){
 if(!data)return null;
 return <section className="surface-safety" aria-label="모서리와 미끄럼 권고사항"><h2>모서리·미끄럼도 확인하세요</h2><p>{data.notice}</p>
  <div className="surface-safety-grid"><details><summary>가구별 모서리 확인 {data.edges.length>0&&`· ${data.edges.length}개`}</summary>{data.edges.length?data.edges.map(item=><article key={item.key}><h3>{item.title}</h3><small>확인할 부위: {item.area}</small><ul>{item.questions.map(question=><li key={question}>{question}</li>)}</ul><p>{item.action}</p><p>{item.supplement}</p></article>):<p>사진에서 확인 위치를 제안할 가구를 찾지 못했습니다. 실제 이동 경로 주변의 단단한 모서리를 직접 살펴보세요.</p>}</details>
  <details><summary>공간별 미끄럼 예방 권고</summary><article><h3>{data.slip.area}</h3><ul>{data.slip.questions.map(question=><li key={question}>{question}</li>)}</ul>{data.slip.actions.map(action=><p key={action}>{action}</p>)}</article></details></div>
  <div className="surface-sources">{data.sources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>)}</div>
 </section>;
}
