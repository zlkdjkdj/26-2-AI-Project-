import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, LoaderCircle, RotateCw, Sparkles, Upload } from 'lucide-react';
import { request } from './api';

function Scene({ style }) {
  return <svg viewBox="0 0 640 360" role="img" aria-label={`${style.name} 가상 공간 컬러 예시`}>
    <rect width="640" height="360" fill={style.wall}/><path d="M0 260H640V360H0Z" fill={style.floor}/>
    <rect x="60" y="50" width="135" height="140" rx="4" fill="#fff" opacity=".75"/><path d="M127 50V190M60 120H195" stroke={style.wall} strokeWidth="5"/>
    <rect x="290" y="72" width="190" height="107" rx="5" fill="#303335"/><rect x="280" y="198" width="210" height="29" rx="5" fill={style.floor}/>
    <rect x="94" y="211" width="211" height="73" rx="20" fill={style.fabric}/><rect x="81" y="232" width="26" height="59" rx="12" fill={style.accent}/><rect x="293" y="232" width="26" height="59" rx="12" fill={style.accent}/>
    <rect x="107" y="227" width="80" height="27" rx="8" fill="#fff" opacity=".25"/><rect x="196" y="227" width="80" height="27" rx="8" fill="#fff" opacity=".25"/>
    <path d="M327 291L429 264L484 293L380 320Z" fill={style.accent}/><path d="M380 320V341M475 296V322M337 295V320" stroke={style.accent} strokeWidth="7"/>
    <text x="22" y="338" fill="#514c47" fontSize="12">컨셉 컬러 예시 · 실제 사진 편집 결과가 아닙니다</text>
  </svg>;
}

export default function InteriorStudio({ result, image, file }) {
  const [plan,setPlan]=useState(null),[concept,setConcept]=useState('minimal'),[stage,setStage]=useState(1),[items,setItems]=useState([]);
  const [selected,setSelected]=useState(null),[width,setWidth]=useState(''),[depth,setDepth]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[consent,setConsent]=useState(false),[edited,setEdited]=useState(null),[original,setOriginal]=useState(false),[message,setMessage]=useState('');
  const [chosenFile,setChosenFile]=useState(null),[localUrl,setLocalUrl]=useState(null);
  const picker=useRef(null),board=useRef(null),drag=useRef(null),revision=useRef(0);
  useEffect(()=>{let alive=true;request(`/api/scans/${result.scan_id}/interior`).then(data=>{if(!alive)return;setPlan(data);setItems(data.furniture);setConcept(data.selected_concept||'minimal');setWidth(data.room_width||'');setDepth(data.room_depth||'');}).catch(e=>alive&&setError(e.message));return()=>{alive=false;revision.current++;};},[result.scan_id]);
  useEffect(()=>{if(!chosenFile){setLocalUrl(null);return;}const url=URL.createObjectURL(chosenFile);setLocalUrl(url);return()=>URL.revokeObjectURL(url);},[chosenFile]);
  if(!plan)return <section className="improvement-panel"><p role="status">{error||'컨셉과 배치를 불러오고 있어요…'}</p></section>;
  const style=plan.concepts.find(c=>c.id===concept),shown=localUrl||image,current=items.find(item=>item.id===selected);
  const enabled=plan.image_generation.enabled&&plan.image_generation.configured;
  function edit(next){revision.current++;setItems(next);setEdited(null);setMessage('배치 변경을 저장해 주세요.');}
  async function save(nextStage) {
    if(busy)return false;setBusy(true);setError('');
    try {const updated=await request(`/api/scans/${result.scan_id}/interior`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({concept,placements:items.map(({id,x,y,rotation})=>({id,x,y,rotation})),room_width:width===''?null:Number(width),room_depth:depth===''?null:Number(depth)})});setPlan(updated);setItems(updated.furniture);setMessage('컨셉과 배치를 저장했어요. 안전점수는 재촬영으로 확인하세요.');if(nextStage)setStage(nextStage);return true;}
    catch(e){setError(e.message);return false;}finally{setBusy(false);}
  }
  async function generate() {
    if(!consent||busy)return;if(!await save())return;
    setBusy(true);setError('');setMessage('원본 사진을 바탕으로 예상 모습을 생성하고 있어요…');const ownRevision=revision.current;
    const data=new FormData();data.append('consent','true');if(chosenFile||file)data.append('file',chosenFile||file);
    try{const response=await request(`/api/scans/${result.scan_id}/interior/preview`,{method:'POST',body:data},110000);if(ownRevision===revision.current){setEdited(response);setOriginal(false);setMessage('예상 모습을 만들었어요. 실제 개선 여부는 재촬영으로 확인해 주세요.');}}
    catch(e){setError(e.message);setMessage('');}finally{setBusy(false);}
  }
  function pointerMove(event){if(!drag.current||!board.current||busy)return;const rect=board.current.getBoundingClientRect(),x=Math.max(.03,Math.min(.97,(event.clientX-rect.left)/rect.width)),y=Math.max(.03,Math.min(.97,(event.clientY-rect.top)/rect.height));edit(items.map(item=>item.id===drag.current?{...item,x,y}:item));}
  function pick(event){const candidate=event.target.files[0];event.target.value='';if(!candidate)return;if(!['image/jpeg','image/png','image/webp'].includes(candidate.type)||candidate.size>8*1024*1024){setError('JPG·PNG·WebP, 8MB 이하의 원본을 선택하세요.');return;}setChosenFile(candidate);setEdited(null);setError('');}
  return <section className="interior-studio">
    <nav className="studio-steps" aria-label="인테리어 가이드 단계">{['컨셉 선택','예상 모습','가구 재배치'].map((label,i)=><button key={label} aria-current={stage===i+1?'step':undefined} disabled={busy||(i>0&&!plan.selected_concept)} onClick={()=>setStage(i+1)}><span>{stage>i+1?<Check size={12}/>:i+1}</span>{label}</button>)}</nav>
    {error&&<p className="studio-error" role="alert">{error}</p>}
    {stage===1?<>
      <div className="panel-heading"><span className="eyebrow">우리 공간에 어울리는 분위기</span><h2>어떤 공간을 원하세요?</h2><p>현재 가구를 살리고, 안전한 변화부터 시작해요.</p></div>
      <div className="concept-grid">{plan.concepts.map(c=><button key={c.id} className={`concept-card ${concept===c.id?'selected':''}`} disabled={busy} aria-pressed={concept===c.id} onClick={()=>{revision.current++;setConcept(c.id);setEdited(null);setMessage('');}}><Scene style={c}/><div><small>{c.tag}</small><strong>{c.name}</strong><p>{c.description}</p></div><span className="concept-check">{concept===c.id&&<Check size={15}/>}</span></button>)}</div>
      <button className="primary submit-button" disabled={busy} onClick={()=>save(2)}>{busy?<LoaderCircle className="spin" size={18}/>:<Sparkles size={18}/>}이 컨셉으로 예상 모습 보기<ArrowRight size={17}/></button>
    </>:stage===2?<>
      <div className="panel-heading"><span className="eyebrow">{style.name}</span><h2>작은 변화, 새로운 분위기.</h2><p>사진 편집은 실제 공간의 개선을 상상하는 참고용이에요.</p></div>
      {edited?<div className="studio-preview"><img src={original?shown:edited.image_data_url} alt={original?'점검 원본 사진':'AI가 컨셉을 적용한 예상 모습'}/><span className="preview-badge">{original?'원본 사진':'AI 생성 예상 모습'}</span>{shown&&<div className="preview-switch"><button aria-pressed={original} onClick={()=>setOriginal(true)}>원본</button><button aria-pressed={!original} onClick={()=>setOriginal(false)}>예상 모습</button></div>}</div>:<div className="concept-preview"><Scene style={style}/></div>}
      {!edited&&shown&&<details className="extra-settings"><summary>원본 공간 사진 확인</summary><img className="studio-original" src={shown} alt="인테리어 편집에 사용할 원본 공간"/></details>}
      <div className="image-generation-card"><div><Sparkles size={20}/><h3>내 사진에 이 컨셉 적용하기</h3></div><p>같은 방과 기존 가구를 유지하면서 색감·전선 정리·모서리 보호·배치 개선을 요청합니다. AI가 치수나 구조를 바꾸어 표현할 수 있어요.</p>
        {(!file&&!result.image_url)||chosenFile?<button className="plain-button" disabled={busy} onClick={()=>picker.current.click()}><Upload size={16}/>{chosenFile?'다른 원본 사진 선택':'이 점검의 원본 사진 다시 선택'}</button>:null}
        <input ref={picker} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={pick}/>
        {!enabled&&<p className="studio-setup">실제 사진 편집은 서버의 이미지 생성 설정이 필요해요. 현재 무료 컨셉 예시·배치도는 바로 사용할 수 있습니다. 이미지 API는 무료 등급이 없으며 별도 사용 요금이 발생해요.</p>}
        <label className="checkbox-label"><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/>이 사진을 Gemini 이미지 생성 API로 전송하고, 이미지 생성 비용이 발생할 수 있음을 확인합니다.</label>
        <button className="primary submit-button" disabled={busy||!enabled||!consent||(!file&&!result.image_url&&!chosenFile)} onClick={generate}>{busy?<LoaderCircle size={18} className="spin"/>:<Sparkles size={18}/>} {busy?'처리하고 있어요…':'AI로 내 사진 편집하기'}</button>
        <small>생성 이미지는 서버에 보관하지 않으며 화면을 나가면 사라져요. 컨셉과 배치도는 저장됩니다. 생성 결과로 점수가 올라가지는 않습니다.</small>
      </div>
      <button className="primary submit-button" disabled={busy} onClick={()=>setStage(3)}>가구 위치도 조정해 볼까요?<ArrowRight size={17}/></button>
    </>:<>
      <div className="panel-heading"><span className="eyebrow">현재 가구로 만드는 변화</span><h2>동선을 비워볼까요?</h2><p>가구를 끌어 옮기거나 선택 후 위치를 조절해 보세요.</p></div>
      <div className="layout-board" ref={board} style={{background:style.floor}} onPointerMove={pointerMove} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>
        <div className="layout-path">동선 가이드</div>{items.map(item=><button key={item.id} className={`layout-item ${selected===item.id?'selected':''}`} style={{left:`${item.x*100}%`,top:`${item.y*100}%`,width:`${(item.rotation%180?item.depth:item.width)*100}%`,height:`${(item.rotation%180?item.width:item.depth)*100}%`,background:style.fabric}} disabled={busy} aria-label={`${item.label} 위치 조정`} onPointerDown={event=>{drag.current=item.id;setSelected(item.id);event.currentTarget.setPointerCapture(event.pointerId);}} onClick={()=>setSelected(item.id)}><span>{item.label}</span></button>)}
        {!items.length&&<p className="empty-layout">이 사진에서 배치할 가구가 탐지되지 않았어요.<br/>실제 가구가 없는 공간이라는 뜻은 아닙니다.</p>}
      </div><p className="panel-note">사진을 평면도로 변환한 결과가 아닌 가상 배치도입니다. 도형 크기는 예시이며 실제 가구 크기와 다릅니다. 가운데 선도 실제 출입문·통로 위치를 뜻하지 않습니다.</p>
      {current&&<div className="layout-controls"><strong>{current.label} 위치 조절</strong><label>좌우<input type="range" min="3" max="97" value={Math.round(current.x*100)} disabled={busy} onChange={e=>edit(items.map(item=>item.id===selected?{...item,x:Number(e.target.value)/100}:item))}/></label><label>앞뒤<input type="range" min="3" max="97" value={Math.round(current.y*100)} disabled={busy} onChange={e=>edit(items.map(item=>item.id===selected?{...item,y:Number(e.target.value)/100}:item))}/></label><button className="plain-button" disabled={busy} onClick={()=>edit(items.map(item=>item.id===selected?{...item,rotation:(item.rotation+90)%360}:item))}><RotateCw size={15}/>90° 회전</button></div>}
      <div className="room-measurements"><label>직접 잰 방 가로 (m, 선택)<input type="number" min="1" max="20" step="0.1" value={width} disabled={busy} placeholder="예: 4.2" onChange={e=>setWidth(e.target.value)}/></label><label>직접 잰 방 세로 (m, 선택)<input type="number" min="1" max="20" step="0.1" value={depth} disabled={busy} placeholder="예: 3.5" onChange={e=>setDepth(e.target.value)}/></label></div>
      <p className="panel-note">실측값은 메모로 보관합니다. 가구 치수·문 위치가 없어 통로 폭이나 통과 가능 여부를 계산하지 않습니다. 벽걸이 TV·고정 가구는 임의로 옮기지 마세요.</p>
      <button className="primary submit-button" disabled={busy} onClick={()=>save()}><Check size={18}/>이 배치 저장하기</button>
      {plan.warnings.length>0&&<div className="layout-warnings"><strong>저장한 배치에서 확인할 부분</strong>{plan.warnings.map(w=><p key={w}>{w}</p>)}</div>}
      <button className="plain-button" disabled={busy} onClick={()=>setStage(2)}>이 배치로 예상 모습 만들기</button>
    </>}
    <p className="save-status" role="status">{message}</p>
  </section>;
}
