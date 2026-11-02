import { useEffect, useState } from 'react';
import { ShieldCheck, Plus, RefreshCw, ArrowRight, ClipboardCheck, Clock3 } from 'lucide-react';
import { request } from './api';

const states={observed:'확인 대기',planned:'개선 계획',in_progress:'조치 중',completed:'조치 완료',verified:'현장 재확인',dismissed:'해당 없음'};
const levels={HIGH:'고위험',MEDIUM:'중위험',LOW:'저위험'};
const assessments={unknown:'아직 확인하지 않음',risk:'현장에서 위험 조건 확인',clear:'현장 확인 결과 해당 없음'};
const time=value=>new Date(value).toLocaleString('ko-KR');

function TaskEditor({task,onSave,busy,onPhoto}){
 const [draft,setDraft]=useState(task),[confirm,setConfirm]=useState(false);
 useEffect(()=>{setDraft(task);setConfirm(false);},[task]);
 const set=(key,value)=>setDraft(prev=>({...prev,[key]:value}));
 return <form className="safety-editor" onSubmit={e=>{e.preventDefault();onSave(task.key,{version:task.version,status:draft.status,assessment:draft.assessment,action:draft.action,assignee:draft.assignee,due_date:draft.due_date||null,note:draft.note,confirm_recheck:confirm});}}>
  <div className="safety-task-heading"><div><span className="safety-source">{task.source==='manual'?'직접 등록 · 위험등급은 사용자 선택':'사진 분석 · 기존 탐지 결과'}</span><h3>{task.title}</h3></div><span className={`risk-label ${task.risk_level}`}>{levels[task.risk_level]}</span></div>
  <p className="safety-description">{task.description}</p>
  {task.source==='photo'&&<button type="button" className="plain-button" onClick={()=>onPhoto(task.hazard_id)}>기존 사진 피드백 확인<ArrowRight size={14}/></button>}
  <div className="safety-editor-grid"><label>현장 확인<select value={draft.assessment} onChange={e=>set('assessment',e.target.value)}>{Object.entries(assessments).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>관리 단계<select value={draft.status} onChange={e=>set('status',e.target.value)}>{Object.entries(states).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></div>
  <label>실행할 개선 방법<textarea value={draft.action} maxLength={600} rows={3} onChange={e=>set('action',e.target.value)} placeholder="예: 거실 통로의 전선을 벽 쪽으로 정리하고 남는 길이를 고정하기"/></label>
  <div className="safety-editor-grid"><label>담당자 · 선택<input value={draft.assignee} maxLength={60} onChange={e=>set('assignee',e.target.value)} placeholder="예: 본인, 보호자"/></label><label>목표일 · 선택<input type="date" value={draft.due_date||''} onChange={e=>set('due_date',e.target.value)}/></label></div>
  <label>현장 확인·조치 메모<textarea value={draft.note} maxLength={1000} rows={3} onChange={e=>set('note',e.target.value)} placeholder="무엇을 확인했고 어떻게 조치했는지 남겨주세요. 재확인·해당 없음에는 메모가 필요합니다."/></label>
  {draft.status==='verified'&&<label className="safety-confirm"><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/>조치 완료 후 현장을 다시 확인했습니다. 안전 인증이 아닌 사용자 확인 기록임을 이해합니다.</label>}
  <p className="safety-help">조치 완료 → 현장 재확인은 따로 저장합니다. 기존 ‘정리했어요’ 표시와 자동 연동되지 않습니다.</p>
  <button className="primary" type="submit" disabled={busy}><ClipboardCheck size={17}/>{busy?'저장 중…':'관리 기록 저장'}</button>
 </form>;
}

export default function SafetyBoard({result,onPhoto,onChecks,onRescan}){
 const [board,setBoard]=useState(null),[selected,setSelected]=useState(null),[filter,setFilter]=useState('active'),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [manual,setManual]=useState({title:'',description:'',risk_level:'MEDIUM'}),[adding,setAdding]=useState(false);
 const path=`/api/scans/${result.scan_id}/safety`;
 useEffect(()=>{let active=true;setBoard(null);setError('');setNotice('');setSelected(null);request(path).then(data=>{if(active)setBoard(data);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[path]);
 async function refresh(){setBusy(true);setError('');try{setBoard(await request(path));setNotice('최신 관리 기록을 불러왔습니다.');}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function save(key,payload){setBusy(true);setError('');setNotice('');try{setBoard(await request(`${path}/${key}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}));setNotice('저장했습니다. 기존 위험등급과 안전점수는 유지됩니다.');}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function add(e){e.preventDefault();setBusy(true);setError('');setNotice('');try{const next=await request(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(manual)});setBoard(next);setSelected(next.tasks.find(t=>t.source==='manual'&&!board.tasks.some(old=>old.key===t.key))?.key||null);setManual({title:'',description:'',risk_level:'MEDIUM'});setAdding(false);setFilter('all');setNotice('직접 관찰한 항목을 등록했습니다. 사진 분석 점수에는 포함하지 않습니다.');}catch(e){setError(e.message);}finally{setBusy(false);}}
 const tasks=board?.tasks||[],active=tasks.filter(t=>!['verified','dismissed'].includes(t.status));
 const visible=tasks.filter(t=>filter==='all'||filter==='active'&&!['verified','dismissed'].includes(t.status)||filter==='overdue'&&t.overdue||filter==='verified'&&t.status==='verified');
 const task=visible.find(t=>t.key===selected)||visible[0];
 return <section className="safety-board" aria-label="안전관리 보드">
  <div className="safety-board-heading"><div><span className="eyebrow">발견 이후의 변화까지 관리해요</span><h2>우리 공간 안전관리</h2><p>현장에서 확인하고, 조치하고, 다시 살펴보세요.</p></div><ShieldCheck size={35}/></div>
  <div className="safety-metrics"><div><strong>{active.length}</strong><span>관리 중</span></div><div><strong>{active.filter(t=>t.risk_level==='HIGH').length}</strong><span>고위험 우선 확인</span></div><div><strong>{tasks.filter(t=>t.overdue).length}</strong><span>목표일 지남</span></div><div><strong>{tasks.filter(t=>t.status==='verified').length}</strong><span>사용자 재확인</span></div></div>
  <div className="safety-workflow"><span>01 현장 확인</span><ArrowRight size={13}/><span>02 개선 계획·조치</span><ArrowRight size={13}/><span>03 현장 재확인</span></div>
  <p className="safety-help">재확인까지 남은 항목 수이며 공간의 안전 점수가 아닙니다. 목표일은 한국 날짜 기준, 앱을 열 때 확인하며 알림을 발송하지 않습니다.</p>
  <div className="safety-board-actions"><button onClick={onChecks}><ClipboardCheck size={16}/>사진 밖의 조건 직접 점검</button><button onClick={()=>setAdding(v=>!v)} aria-expanded={adding}><Plus size={16}/>놓친 위험 직접 등록</button><button disabled={busy} onClick={refresh} aria-label="관리 기록 새로고침"><RefreshCw size={16}/></button></div>
  {error&&<p className="error-message" role="alert">{error}</p>}{notice&&<p className="safety-save-message" role="status">{notice}</p>}
  {adding&&<form className="safety-manual" onSubmit={add}><h3>직접 관찰한 위험 추가</h3><p>사진 탐지 여부와 별개로 기록합니다. 위험등급은 사용자가 선택한 값입니다.</p><label>항목 이름<input required maxLength={100} value={manual.title} onChange={e=>setManual({...manual,title:e.target.value})} placeholder="예: 침실 입구의 들뜬 매트"/></label><label>관찰한 상황<textarea required maxLength={600} rows={2} value={manual.description} onChange={e=>setManual({...manual,description:e.target.value})}/></label><label>사용자가 정한 위험등급<select value={manual.risk_level} onChange={e=>setManual({...manual,risk_level:e.target.value})}>{Object.entries(levels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><button disabled={busy} className="primary">직접 등록하기</button></form>}
  {!board?<p role="status">{error?'새로고침 버튼으로 다시 시도하세요.':'관리 기록을 불러오고 있어요…'}</p>:<><div className="safety-filters" role="group" aria-label="관리 항목 필터">{[['active','관리 중'],['overdue','목표일 지남'],['verified','재확인 기록'],['all','전체']].map(([key,label])=><button aria-pressed={filter===key} key={key} onClick={()=>setFilter(key)}>{label}</button>)}</div><div className="safety-workspace"><div className="safety-task-list" aria-label="안전관리 항목">{visible.length?visible.map(t=><button key={t.key} aria-pressed={task?.key===t.key} onClick={()=>setSelected(t.key)}><span className={`risk-label ${t.risk_level}`}>{levels[t.risk_level]}</span><strong>{t.title}</strong><span>{states[t.status]}{t.assignee&&` · ${t.assignee}`}</span>{t.due_date&&<small className={t.overdue?'overdue':''}>{t.overdue?'목표일 지남 · ':''}{t.due_date}</small>}</button>):<p className="safety-empty">이 조건의 관리 항목이 없습니다. 미탐지나 목록 비어 있음이 안전을 뜻하지는 않습니다.</p>}</div>{task&&<TaskEditor key={task.key} task={task} onSave={save} busy={busy} onPhoto={onPhoto}/>}</div>
   <details className="safety-event-log"><summary><Clock3 size={17}/>관리 변경 이력 · 최근 {board.events.length}건</summary>{board.events.length?board.events.map(event=><article key={event.id}><strong>{event.title}</strong><span>{event.before?`${states[event.before]} → `:'등록 · '}{states[event.status]}</span><small>{time(event.at)} · {assessments[event.assessment]}</small>{event.note&&<p>{event.note}</p>}{event.action&&<p>개선 방법: {event.action}</p>}{(event.assignee||event.due_date)&&<small>담당: {event.assignee||'미지정'} · 목표일: {event.due_date||'미지정'}</small>}</article>):<p>저장한 변경 기록이 없습니다.</p>}</details>
  </>}
  <div className="safety-revisit"><div><strong>조치 후에는 같은 공간을 다시 촬영하세요.</strong><p>새 점검에서 기존 가구와 연결해 비교할 수 있습니다. 새 사진에서 안 보이는 항목을 자동 해결로 처리하지 않습니다.</p></div><button className="primary" onClick={onRescan}>재촬영하기<ArrowRight size={16}/></button></div>
  <p className="safety-help">{board?.notice||'관리 기록은 기존 사진 분석 점수와 분리됩니다.'}</p>
 </section>;
}
