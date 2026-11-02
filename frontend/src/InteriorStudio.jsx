import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, LoaderCircle, RotateCw, Sparkles, Upload } from 'lucide-react';
import { request } from './api';
import DesignIdeas from './DesignIdeas';
import { layoutWarnings,applyMeasurements,spatialWarnings } from './layout';
import SpatialSettings,{openingZones} from './SpatialSettings';
import StyleFinder from './StyleFinder';
import ConceptReference from './ConceptReference';
import RoomPreview, { downloadPreview } from './RoomPreview';
import LayoutEditor from './LayoutEditor';

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
  const [spatial,setSpatial]=useState({openings:[],furniture_measurements:[]});
  const [wallColor,setWallColor]=useState(null),[floorColor,setFloorColor]=useState(null),[floorPattern,setFloorPattern]=useState('wood');
  const [chosenFile,setChosenFile]=useState(null),[localUrl,setLocalUrl]=useState(null);
  const picker=useRef(null),revision=useRef(0),preview=useRef(null);
  useEffect(()=>{let alive=true;request(`/api/scans/${result.scan_id}/interior`).then(data=>{if(!alive)return;setPlan(data);setItems(data.furniture);setConcept(data.selected_concept||'minimal');setWidth(data.room_width||'');setDepth(data.room_depth||'');setWallColor(data.wall_color||null);setFloorColor(data.floor_color||null);setFloorPattern(data.floor_pattern||'wood');setSpatial({openings:data.openings||[],furniture_measurements:data.furniture_measurements||[]});}).catch(e=>alive&&setError(e.message));return()=>{alive=false;revision.current++;};},[result.scan_id]);
  useEffect(()=>{if(!chosenFile){setLocalUrl(null);return;}const url=URL.createObjectURL(chosenFile);setLocalUrl(url);return()=>URL.revokeObjectURL(url);},[chosenFile]);
  if(!plan)return <section className="improvement-panel"><p role="status">{error||'컨셉과 배치를 불러오고 있어요…'}</p></section>;
  const baseStyle=plan.concepts.find(c=>c.id===concept)||plan.concepts[0];
  const style={...baseStyle,wall:wallColor||baseStyle.wall,floor:floorColor||baseStyle.floor,floor_pattern:floorPattern,room_width:Number(width),room_depth:Number(depth),opening_zones:openingZones(spatial.openings,width,depth)},shown=localUrl||image;
  const displayItems=applyMeasurements(items,width,depth,spatial.furniture_measurements),current=displayItems.find(item=>item.id===selected);
  function finish(key,value){revision.current++;setEdited(null);if(key==='wall')setWallColor(value);if(key==='floor')setFloorColor(value);if(key==='pattern')setFloorPattern(value);if(key==='reset'){setWallColor(null);setFloorColor(null);setFloorPattern('wood');}setMessage('색상 변경을 저장해 주세요.');}
  function restore(){setConcept(plan.selected_concept||'minimal');setItems(plan.furniture);setWallColor(plan.wall_color||null);setFloorColor(plan.floor_color||null);setFloorPattern(plan.floor_pattern||'wood');setSpatial({openings:plan.openings||[],furniture_measurements:plan.furniture_measurements||[]});setSelected(null);setEdited(null);revision.current++;setMessage('마지막으로 저장한 배치와 색상으로 되돌렸어요.');}
  const enabled=plan.image_generation.enabled&&plan.image_generation.configured;
  const warnings=[...layoutWarnings(displayItems),...spatialWarnings(displayItems,style.opening_zones)];
  function updateSpatial(next){setSpatial(next);revision.current++;setEdited(null);setMessage('실측·문·창문 변경을 저장해 주세요.');}
  async function chooseConcept(id){if(!plan.concepts.some(c=>c.id===id)){try{const latest=await request(`/api/scans/${result.scan_id}/interior`);setPlan(latest);if(!latest.concepts.some(c=>c.id===id)){setError('새 컨셉 목록을 불러오려면 서버를 최신 코드로 실행해 주세요.');return;}}catch(e){setError(e.message);return;}}setConcept(id);setWallColor(null);setFloorColor(null);setFloorPattern('wood');setEdited(null);setMessage('선택한 컨셉의 기본 색상을 적용했어요.');revision.current++;}
  function applyOption(option){const positions=new Map(option.placements.map(item=>[item.id,item]));edit(items.map(item=>({...item,...positions.get(item.id)})));setMessage(`${option.name}을 적용했어요. 실제 문·고정 가구 위치를 확인하고 저장하세요.`);}
  async function exportImage(){try{await downloadPreview(preview.current,`atchacha-${concept}-layout.png`);setMessage('예상 배치 이미지를 PNG로 저장했어요.');}catch(e){setError(e.message);}}
  const recommendations=plan.layout_options?.length>0&&<section className="layout-recommendations"><div className="panel-heading"><span className="eyebrow">현재 가구로 제안하는 두 가지 방향</span><h3>어떤 배치가 생활에 맞을까요?</h3><p>저장된 가구 목록을 반영한 가상 추천안이에요. 가구를 추가했다면 먼저 저장해 새 추천에 반영하세요. 실제 방 모양·문 위치·치수는 직접 확인하세요.</p></div><div className="recommendation-grid">{plan.layout_options.map(option=>{const positions=new Map(option.placements.map(p=>[p.id,p]));const proposed=displayItems.map(item=>({...item,...positions.get(item.id)}));return <article key={option.id}><RoomPreview items={proposed} style={style} compact/><div><h4>{option.name}</h4><p>{option.description}</p>{option.warnings.length>0&&<small>가상 겹침 확인 {option.warnings.length}건 · 적용 후 경고를 확인하세요.</small>}<button className="plain-button" disabled={busy} onClick={()=>applyOption(option)}>이 추천 배치 적용</button><details><summary>가구별 배치 이유</summary>{option.reasons.map(reason=><p key={reason.id}><strong>{reason.label}</strong> {reason.action}</p>)}<small>{option.notice}</small></details></div></article>;})}</div></section>;
  function edit(next){revision.current++;setItems(next);setEdited(null);setMessage('배치 변경을 저장해 주세요.');}
  async function save(nextStage) {
    if(busy)return false;setBusy(true);setError('');
    try {const updated=await request(`/api/scans/${result.scan_id}/interior`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({concept,wall_color:wallColor,floor_color:floorColor,floor_pattern:floorPattern,openings:spatial.openings,furniture_measurements:spatial.furniture_measurements.filter(m=>items.some(item=>item.id===m.id)),custom_furniture:items.filter(item=>item.source==='user_added').map(item=>({id:item.id,kind:item.kind,label:item.label,width:item.diagram_width??item.width,depth:item.diagram_depth??item.depth})),placements:items.map(({id,x,y,rotation})=>({id,x,y,rotation})),room_width:width===''?null:Number(width),room_depth:depth===''?null:Number(depth)})});setPlan(updated);setItems(updated.furniture);setMessage('컨셉·색상·가구 배치를 저장했어요. 안전점수는 재촬영으로 확인하세요.');if(nextStage)setStage(nextStage);return true;}
    catch(e){setError(e.message);return false;}finally{setBusy(false);}
  }
  async function generate() {
    if(!consent||busy)return;if(!await save())return;
    setBusy(true);setError('');setMessage('원본 사진을 바탕으로 예상 모습을 생성하고 있어요…');const ownRevision=revision.current;
    const data=new FormData();data.append('consent','true');if(chosenFile||file)data.append('file',chosenFile||file);
    try{const response=await request(`/api/scans/${result.scan_id}/interior/preview`,{method:'POST',body:data},110000);if(ownRevision===revision.current){setEdited(response);setOriginal(false);setMessage('예상 모습을 만들었어요. 실제 개선 여부는 재촬영으로 확인해 주세요.');}}
    catch(e){setError(e.message);setMessage('');}finally{setBusy(false);}
  }
  function pick(event){const candidate=event.target.files[0];event.target.value='';if(!candidate)return;if(!['image/jpeg','image/png','image/webp'].includes(candidate.type)||candidate.size>8*1024*1024){setError('JPG·PNG·WebP, 8MB 이하의 원본을 선택하세요.');return;}setChosenFile(candidate);setEdited(null);setError('');}
  return <section className="interior-studio">
    <nav className="studio-steps" aria-label="인테리어 가이드 단계">{['컨셉 선택','예상 모습','직접 꾸미기'].map((label,i)=><button key={label} aria-current={stage===i+1?'step':undefined} disabled={busy||(i>0&&!plan.selected_concept)} onClick={()=>setStage(i+1)}><span>{stage>i+1?<Check size={12}/>:i+1}</span>{label}</button>)}</nav>
    {error&&<p className="studio-error" role="alert">{error}</p>}
    {stage===1?<>
      <div className="panel-heading"><span className="eyebrow">우리 공간에 어울리는 분위기</span><h2>어떤 공간을 원하세요?</h2><p>현재 가구를 살리고, 안전한 변화부터 시작해요.</p></div>
      <StyleFinder onChoose={chooseConcept} disabled={busy}/><div className="concept-grid">{plan.concepts.map(c=><button key={c.id} className={`concept-card ${concept===c.id?'selected':''}`} disabled={busy} aria-pressed={concept===c.id} onClick={()=>chooseConcept(c.id)}><Scene style={c}/><div><small>{c.tag}</small><strong>{c.name}</strong><p>{c.description}</p></div><span className="concept-check">{concept===c.id&&<Check size={15}/>}</span></button>)}</div>
      <ConceptReference concept={concept} name={style.name}/>
      <button className="primary submit-button" disabled={busy} onClick={()=>save(2)}>{busy?<LoaderCircle className="spin" size={18}/>:<Sparkles size={18}/>}이 컨셉으로 예상 모습 보기<ArrowRight size={17}/></button>
    </>:stage===2?<>
      <div className="panel-heading"><span className="eyebrow">{style.name}</span><h2>작은 변화, 새로운 분위기.</h2><p>현재 가구의 배치와 컨셉을 함께 비교해 보세요.</p></div>
      <div className="studio-overview"><div className="free-preview"><span className="eyebrow">무료 · 현재 가구의 배치 시뮬레이션</span><RoomPreview ref={preview} items={displayItems} style={style}/><div className="preview-legend">{items.map((item,index)=><span key={item.id}>{index+1}. {item.label} <small>{item.photo_position}</small></span>)}</div><p className="panel-note">탐지한 가구의 종류·개수와 선택한 배치·컨셉을 반영해요. 도형 크기는 예시이며 실제 사진 편집이나 방 구조 복원 결과가 아닙니다.</p><button className="plain-button" disabled={busy||!items.length} onClick={exportImage}>예상 이미지 PNG 저장 · 무료</button></div><DesignIdeas guide={result.interior_guide} concept={concept}/></div>
      {recommendations}
      <ConceptReference concept={concept} name={style.name}/>
      {edited&&<div className="studio-preview"><img src={original?shown:edited.image_data_url} alt={original?'점검 원본 사진':'AI가 컨셉을 적용한 예상 모습'}/><span className="preview-badge">{original?'원본 사진':'AI 생성 예상 모습'}</span>{shown&&<div className="preview-switch"><button aria-pressed={original} onClick={()=>setOriginal(true)}>원본</button><button aria-pressed={!original} onClick={()=>setOriginal(false)}>예상 모습</button></div>}</div>}
      {!edited&&shown&&<details className="extra-settings"><summary>원본 공간 사진 확인</summary><img className="studio-original" src={shown} alt="인테리어 편집에 사용할 원본 공간"/></details>}
      <details className="paid-preview"><summary>실제 사진 AI 편집 · 현재 비활성</summary><div className="image-generation-card"><div><Sparkles size={20}/><h3>내 사진에 이 컨셉 적용하기</h3></div><p>같은 방과 기존 가구를 유지하면서 색감·전선 정리·모서리 보호·배치 개선을 요청합니다. AI가 치수나 구조를 바꾸어 표현할 수 있어요.</p>
        {(!file&&!result.image_url)||chosenFile?<button className="plain-button" disabled={busy} onClick={()=>picker.current.click()}><Upload size={16}/>{chosenFile?'다른 원본 사진 선택':'이 점검의 원본 사진 다시 선택'}</button>:null}
        <input ref={picker} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={pick}/>
        {!enabled&&<p className="studio-setup">실제 사진 편집은 서버의 이미지 생성 설정이 필요해요. 현재 무료 컨셉 예시·배치도는 바로 사용할 수 있습니다. 이미지 API는 무료 등급이 없으며 별도 사용 요금이 발생해요.</p>}
        <label className="checkbox-label"><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/>이 사진을 Gemini 이미지 생성 API로 전송하고, 이미지 생성 비용이 발생할 수 있음을 확인합니다.</label>
        <button className="primary submit-button" disabled={busy||!enabled||!consent||(!file&&!result.image_url&&!chosenFile)} onClick={generate}>{busy?<LoaderCircle size={18} className="spin"/>:<Sparkles size={18}/>} {busy?'처리하고 있어요…':'AI로 내 사진 편집하기'}</button>
        <small>생성 이미지는 서버에 보관하지 않으며 화면을 나가면 사라져요. 컨셉과 배치도는 저장됩니다. 생성 결과로 점수가 올라가지는 않습니다.</small>
      </div></details>
      <button className="primary submit-button" disabled={busy} onClick={()=>setStage(3)}>가구·벽지·바닥을 직접 꾸미기<ArrowRight size={17}/></button>
    </>:<>
      <div className="panel-heading"><span className="eyebrow">현재 가구로 만드는 변화</span><h2>우리 공간을 직접 꾸며보세요.</h2><p>가구를 옮기고, 벽지와 바닥 색상을 바꿔보세요. 예상 모습에 바로 반영됩니다.</p></div>
      <LayoutEditor items={displayItems} style={style} selected={selected} onSelect={setSelected} onChange={edit} onFinish={finish} onError={setError} busy={busy} previewRef={preview} onExport={exportImage} onSave={()=>save()} onRestore={restore}/>
      {current?.advice&&<div className="furniture-advice"><h3>{current.label}에 맞는 배치 확인</h3><p>{current.advice.action}</p><p>{current.advice.supplement}</p><small>{current.advice.target_tip}</small></div>}
      <SpatialSettings items={displayItems} width={width} depth={depth} onWidth={setWidth} onDepth={setDepth} spatial={spatial} onChange={updateSpatial} busy={busy}/>
      {recommendations}
      <div className="layout-warnings" role="status" aria-live="polite"><strong>현재 가상 배치에서 확인할 부분</strong>{warnings.length ? warnings.map(w=><p key={w}>{w}</p>) : <p>가상 도형의 겹침은 없어요. 실제 통로 폭·출입문·가구 고정 상태는 별도로 확인하세요.</p>}</div>
      <button className="plain-button" disabled={busy} onClick={()=>setStage(2)}>전체 예상 모습 보기</button>
    </>}
    <p className="save-status" role="status">{message}</p>
  </section>;
}
