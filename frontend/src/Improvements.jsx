import { useEffect, useState } from 'react';
import { Check, CheckCircle2, ChevronRight, LayoutTemplate, ListChecks, MoveRight, ShieldCheck } from 'lucide-react';
import InteriorStudio from './InteriorStudio';

const levelNames = { HIGH: '고위험', MEDIUM: '중위험', LOW: '저위험' };

export function InteriorGuide({ result, image, file, busy, onToggle, onPhoto }) {
  const guide = result.interior_guide;
  if (!guide) return null;
  return <section className="improvement-panel">
    <InteriorStudio key={result.scan_id} result={result} image={image} file={file}/>
    <details className="studio-safety"><summary>안전 개선 체크리스트와 상세 가이드</summary><div>
    <div className="panel-heading"><span className="eyebrow">현재 환경을 최대한 유지해요</span><h2>{guide.title}</h2><p>새 가구보다, 지금 공간의 작은 변화부터.</p></div>
    <div className="room-principle"><LayoutTemplate size={23}/><div><strong>{guide.path}</strong><p>{guide.principle}</p><small>{guide.target_tip}<br/>{guide.measurement_tip}</small></div></div>
    <div className="guide-order"><span>1 정리</span><ChevronRight size={15}/><span>2 재배치</span><ChevronRight size={15}/><span>3 보완</span></div>
    {image && <div className="guide-photo"><img src={image} alt="재배치 전에 위치를 확인할 공간"/>{guide.steps.map((step,index) => step.bbox && <button key={step.key} className="guide-pin" style={{left:`${(step.bbox[0]+step.bbox[2]/2)*100}%`,top:`${(step.bbox[1]+step.bbox[3]/2)*100}%`}} aria-label={`${step.title} 사진 피드백 열기`} onClick={()=>onPhoto(step.hazard_id)}>{index+1}</button>)}</div>}
    <div className="guide-progress"><span>{guide.completed} / {guide.steps.length}개 실천</span><progress value={guide.completed} max={Math.max(1,guide.steps.length)}/></div>
    {guide.steps.length ? guide.steps.map((step,index)=><article className={`guide-card ${step.completed?'completed':''}`} key={step.key}>
      <div className="guide-card-title"><span className="guide-index">{step.completed?<Check size={16}/>:index+1}</span><div><h3>{step.title}</h3><small>{step.source==='photo'?'사진 기반 확인 항목':'직접 확인한 위험'}</small></div><span className={`risk-label ${step.risk_level}`}>{levelNames[step.risk_level]}</span></div>
      <div className="guide-advice"><MoveRight size={17}/><p>{step.first}</p></div><p className="guide-supplement">보완이 필요하면 · {step.supplement}</p>
      <button className={`completion-button ${step.completed?'done':''}`} disabled={busy} onClick={()=>onToggle(step)}><CheckCircle2 size={16}/>{step.completed?'실천 완료 · 취소':'이 가이드를 실천했어요'}</button>
    </article>) : <div className="guide-card"><h3>현장에서 확인할 항목부터 살펴보세요</h3><p>직접 점검에서 위험이 있다고 확인한 항목도 이 가이드에 추가됩니다.</p></div>}
    <p className="panel-note">{guide.notice}</p>
    <details className="extra-settings"><summary>가이드 참고 자료</summary><div className="extra-content">{guide.sources.map(source=><p key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></p>)}</div></details>
    </div></details>
  </section>;
}

export function FieldChecklist({ result, busy, onSave }) {
  const checks = result.field_checks || [];
  const [draft,setDraft] = useState({});
  const [saved,setSaved] = useState(false);
  useEffect(()=>{setDraft(Object.fromEntries(checks.map(c=>[c.key,{status:c.status,note:c.note}])));},[result.scan_id,result.field_checks]);
  useEffect(()=>setSaved(false),[result.scan_id]);
  const changed = checks.some(c=>draft[c.key]?.status!==c.status || draft[c.key]?.note!==c.note);
  const summary=result.field_check_summary;
  async function save() { if(await onSave(checks.map(c=>({key:c.key,...draft[c.key]})))) setSaved(true); }
  return <section className="improvement-panel">
    <div className="panel-heading"><span className="eyebrow">사진 밖의 위험도 확인해요</span><h2>직접 살펴보기.</h2><p>전선·물기·실제 통로는 현장에서 확인해 주세요.</p></div>
    <div className="check-summary"><ListChecks size={24}/><div><strong>{summary?.checked || 0} / {checks.length}개 확인</strong><p>확인한 위험 {summary?.confirmed_risks || 0}개 · 미확인 {summary?.unknown ?? checks.length}개</p></div><div className="field-score"><strong>{summary?.combined_reference_score ?? '—'}</strong><small>종합 참고점수</small></div></div>
    <p className="panel-note">{summary?.notice} ‘없음’은 해당 위험 조건을 현장에서 확인하지 못했다는 뜻입니다.</p>
    {checks.map(check=><article className="check-card" key={check.key}>
      <div className="check-card-heading"><h3>{check.label}</h3><span className={`risk-label ${check.risk_level}`}>{levelNames[check.risk_level]}</span></div><p>{check.question}</p>{check.source_url && <a className="source-link" href={check.source_url} target="_blank" rel="noreferrer">안전 기준 참고 자료 ↗</a>}
      <div className="check-options" role="group" aria-label={`${check.label} 확인 상태`}>{[['unknown','미확인'],['clear','없음'],['risk','위험 있음']].map(([value,label])=><button key={value} className={draft[check.key]?.status===value?`selected ${value}`:''} aria-pressed={draft[check.key]?.status===value} disabled={busy} onClick={()=>{setDraft(prev=>({...prev,[check.key]:{...prev[check.key],status:value}}));setSaved(false);}}>{label}</button>)}</div>
      {draft[check.key]?.status==='risk' && <div className="confirmed-advice"><strong>{check.accident} 가능성</strong><p>{check.recommendation}</p><label>메모 (선택)<input maxLength={300} value={draft[check.key]?.note || ''} disabled={busy} placeholder="예: 출입문 옆 전선" onChange={e=>setDraft(prev=>({...prev,[check.key]:{...prev[check.key],note:e.target.value}}))}/></label></div>}
    </article>)}
    <button className="primary submit-button" disabled={busy || !changed} onClick={save}><ShieldCheck size={18}/>{busy?'저장하고 있어요':'직접 점검 저장하기'}</button>
    <p className="save-status" role="status">{changed?'변경한 내용을 저장해 주세요.':saved?'점검을 저장했어요. 확인한 위험은 인테리어 가이드에 반영됩니다.':'저장한 점검은 이력에서도 다시 볼 수 있어요.'}</p>
  </section>;
}
