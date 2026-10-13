import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Camera, Check, CheckCircle2, ChevronDown, ChevronRight, Clock3, ImagePlus, LoaderCircle, RefreshCw, ShieldCheck, Sparkles, Upload, X } from 'lucide-react';
import { request, imageUrl, API } from './api';
import { InteriorGuide, FieldChecklist } from './Improvements';
import Care from './Care';

const targets = { newborn: '신생아', toddler: '영유아', elderly: '노약자', wheelchair: '휠체어 사용자', limited_mobility: '거동 불편자' };
const rooms = { auto: '자동 확인', living_room: '거실', bedroom: '침실', kitchen: '주방', bathroom: '욕실', entrance: '현관', hallway: '복도', stairs: '계단' };
const levels = { HIGH: '고위험', MEDIUM: '중위험', LOW: '저위험' };
const dateLabel = date => new Date(date).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function App() {
  const [guardianToken] = useState(()=>new URLSearchParams(window.location.hash.slice(1)).get('care'));
  const [resultTab, setResultTab] = useState('photo');
  const [showZones, setShowZones] = useState(false);
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyTarget, setHistoryTarget] = useState('all');
  const [page, setPage] = useState(()=>new URLSearchParams(window.location.hash.slice(1)).has('care')?'care':'capture');
  const [target, setTarget] = useState('elderly');
  const [room, setRoom] = useState('auto');
  const [spaceName, setSpaceName] = useState('우리집');
  const [service, setService] = useState(null);
  const [saveImage, setSaveImage] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [resultFile, setResultFile] = useState(null);
  const [resultPreview, setResultPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [records, setRecords] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [previousId, setPreviousId] = useState(null);
  const cameraRef = useRef(null);
  const uploadRef = useRef(null);
  const feedbackRef = useRef(null);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    if (!resultFile) { setResultPreview(null); return; }
    const url = URL.createObjectURL(resultFile); setResultPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [resultFile]);
  async function refresh() {
    const history = await request('/api/scans'); setRecords(history);
  }
  useEffect(() => {
    let active = true;
    async function checkConnection() {
      try { const status = await request('/api/health'); if (active) setService(status); }
      catch { if (active) setService({ status: 'unavailable', model_ready: false }); }
    }
    refresh().catch(e => { if (active) setError(e.message); });
    checkConnection();
    const timer = setInterval(checkConnection, 15000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  function navigate(next) { setPage(next); setError(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function pickFile(next) {
    if (!next) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type)) { setError('JPG, PNG, WebP 사진을 선택해 주세요.'); return; }
    if (next.size > 8 * 1024 * 1024) { setError('사진은 8MB 이하로 선택해 주세요.'); return; }
    setFile(next); setError('');
  }
  async function demo() {
    try {
      const response = await fetch('/sample-room.jpg');
      if (!response.ok) throw new Error('예시 사진을 불러오지 못했습니다.');
      pickFile(new File([await response.blob()], 'sample-room.jpg', { type: 'image/jpeg' }));
    } catch (e) { setError(e.message); }
  }
  async function analyze(event) {
    event.preventDefault(); if (!file || busy) return;
    if (!spaceName.trim()) { setError('공간 이름을 입력해 주세요.'); return; }
    setBusy(true); setError('');
    const data = new FormData();
    Object.entries({ file, target_type: target, space_type: room, space_name: spaceName.trim(), save_image: saveImage }).forEach(([key, value]) => data.append(key, value));
    if (previousId && result?.target_id) data.append('target_id', result.target_id);
    if (previousId && result?.space_id) data.append('space_id', result.space_id);
    try {
      const scan = await request('/api/analyze/image', { method: 'POST', body: data });
      setResultTab('photo'); setResult(scan); setResultFile(file); setSelected(scan.hazards[0]?.id ?? null); setComparison(null);
      setPage('feedback'); window.scrollTo({ top: 0, behavior: 'smooth' });
      if (previousId) {
        try { setComparison(await request(`/api/scans/${scan.scan_id}/compare`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ previous_scan_id: previousId }) })); }
        catch (e) { setError(`점검은 완료했습니다. 비교 결과: ${e.message}`); }
      }
      setPreviousId(null);
      try { await refresh(); } catch (e) { setError(`결과는 저장했습니다. 이력 새로고침: ${e.message}`); }
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function openRecord(record) {
    setBusy(true); setError('');
    try { const scan = await request(`/api/scans/${record.scan_id}`); setResultTab('photo'); setResult(scan); setResultFile(null); setResultPreview(null); setSelected(scan.hazards[0]?.id ?? null); setComparison(null); navigate('feedback'); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function resolve(hazard) {
    if (busy) return; setBusy(true); setError('');
    try {
      await request(`/api/hazards/${hazard.id}/resolution`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resolved: !hazard.resolved }) });
      setResult(prev => ({ ...prev, hazards: prev.hazards.map(h => h.id === hazard.id ? { ...h, resolved: !h.resolved } : h) }));
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function saveChecks(items) {
    setBusy(true); setError('');
    try { setResult(await request(`/api/scans/${result.scan_id}/field-checks`, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({items})})); return true; }
    catch(e) { setError(e.message); return false; } finally { setBusy(false); }
  }
  async function updateScore() {
    if(busy)return;setBusy(true);setError('');
    try{setResult(await request(`/api/scans/${result.scan_id}/rescore`,{method:'POST'}));setComparison(null);await refresh();}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function toggleGuide(step) {
    setBusy(true); setError('');
    try { setResult(await request(`/api/scans/${result.scan_id}/guide-tasks`, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:step.key,completed:!step.completed})})); }
    catch(e) { setError(e.message); } finally { setBusy(false); }
  }
  function showPhotoHazard(id) { setResultTab('photo'); setSelected(id); }
  function rescan() {
    setTarget(result.target_type); setRoom(result.space_type); setSpaceName(result.space_name);
    setPreviousId(result.scan_id); setFile(null); navigate('capture');
  }
  function newScan() { setPreviousId(null); setFile(null); navigate('capture'); }
  function selectHazard(id) { setSelected(id); feedbackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
  const filteredRecords = records.filter(record => (historyTarget==='all' || record.target_type===historyTarget) && `${record.space_name} ${rooms[record.space_type]} ${targets[record.target_type]}`.includes(historyQuery.trim()));
  const hazard = result?.hazards.find(h => h.id === selected);
  const shownImage = result?.image_url ? imageUrl(result.image_url) : resultPreview;

  return <div className="app">
    <header className="app-header"><button className="brand" disabled={busy} onClick={newScan} aria-label="앗차차 새 점검"><ShieldCheck size={27} /><span>앗차차<span className="brand-dot">.</span></span></button><button className={`history-button ${page === 'history' ? 'active' : ''}`} disabled={busy} onClick={() => { navigate('history'); refresh().catch(e => setError(e.message)); }}><Clock3 size={18} /><span>점검 기록</span></button></header>
    <main>
      {error && <div className="error-message" role="alert"><span>{error}</span><button aria-label="오류 닫기" onClick={() => setError('')}><X size={18} /></button></div>}
      {page !== 'history' && <div className="flow" aria-label="점검 진행 단계"><span className={page === 'capture' ? 'current' : 'completed'}>{page === 'capture' ? <span className="step-number">1</span> : <Check size={15} />}사진 촬영</span><ChevronRight size={13} /><span className={page === 'feedback' ? 'current' : ''}><span className="step-number">2</span>안전 피드백</span><ChevronRight size={13} /><span><span className="step-number">3</span>정리 후 재점검</span></div>}

      {page === 'capture' && <>
        <div className="intro"><span className="eyebrow">{previousId ? '작은 변화가 만든 차이를 확인해요' : 'AI 기반 생활공간 안전점검'}</span><h1>{previousId ? <>정리한 공간을<br />다시 찍어주세요.</> : <>사진 한 장.<br /><span className="hero-subtitle">더 안전한 하루.</span></>}</h1><p>{previousId ? '이전 점검과 비교해서 달라진 점을 보여드릴게요.' : '우리 공간을 담아주세요. 필요한 변화부터 알려드릴게요.'}</p></div>
        <form onSubmit={analyze}>
          <div className={`photo-area ${preview ? 'with-photo' : ''}`} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!busy) pickFile(e.dataTransfer.files[0]); }}>
            {preview ? <><img src={preview} alt="점검할 공간 사진" /><button className="remove-photo" type="button" disabled={busy} onClick={() => setFile(null)} aria-label="사진 삭제"><X size={18} /></button><span className="photo-caption"><CheckCircle2 size={15} />이 사진으로 점검할게요</span></> : <><div className="camera-graphic"><Camera size={41} strokeWidth={1.4} /><span className="focus-corner a"/><span className="focus-corner b"/><span className="focus-corner c"/><span className="focus-corner d"/></div><strong>우리 공간의 지금 모습을 담아주세요</strong><p>바닥과 이동 통로가 보이면 더 좋아요.</p><button type="button" className="primary camera-button" disabled={busy} onClick={() => cameraRef.current.click()}><Camera size={19} />공간 사진 찍기</button><button type="button" className="plain-button" disabled={busy} onClick={() => uploadRef.current.click()}><Upload size={15} />이미 있는 사진 선택</button></>}
          </div>
          <input type="file" ref={cameraRef} accept="image/jpeg,image/png,image/webp" capture="environment" hidden onChange={e => { pickFile(e.target.files[0]); e.target.value = ''; }} />
          <input type="file" ref={uploadRef} accept="image/jpeg,image/png,image/webp" hidden onChange={e => { pickFile(e.target.files[0]); e.target.value = ''; }} />
          {preview && <button className="plain-button change-photo" type="button" disabled={busy} onClick={() => uploadRef.current.click()}><RefreshCw size={14} />다른 사진 선택</button>}
          <div className="context-fields"><label htmlFor="target">누구를 위한 공간인가요?<select id="target" value={target} disabled={busy || !!previousId} onChange={e => setTarget(e.target.value)}>{Object.entries(targets).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label htmlFor="room">어떤 공간인가요?<select id="room" value={room} disabled={busy || !!previousId} onChange={e => setRoom(e.target.value)}>{Object.entries(rooms).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
          <button className="primary submit-button" type="submit" disabled={busy || !file}>{busy ? <><LoaderCircle size={19} className="spin" />전선·전기설비까지 분석하고 있어요</> : <><Sparkles size={18} />{previousId ? '다시 점검하고 변화 확인하기' : '이 사진으로 안전 피드백 받기'}<ArrowRight size={18} /></>}</button>
          <p className="privacy-note"><ShieldCheck size={14} />사진은 기본적으로 서버에 저장하지 않아요.</p>
          <details className="extra-settings"><summary>공간 이름과 사진 보관 설정<ChevronDown size={15} /></summary><div className="extra-content"><label htmlFor="space-name">공간 이름<input id="space-name" value={spaceName} disabled={busy || !!previousId} maxLength={80} onChange={e => setSpaceName(e.target.value)} /></label><label className="checkbox-label"><input type="checkbox" checked={saveImage} disabled={busy} onChange={e => setSaveImage(e.target.checked)} />점검 사진 저장에 동의합니다</label><p>동의 시 위치 등 EXIF 정보를 제거한 사진을 로컬 서버에 저장합니다. 이력에서 사진을 다시 볼 수 있어요.</p><p>사진의 객체와 위치를 서버에서 분석합니다. JPG/PNG/WebP, 최대 8MB·2,400만 화소를 지원합니다. 작은 물건이나 가려진 전선은 놓칠 수 있어요. 물기·과부하·손상·실제 통로 폭은 직접 확인해 주세요.</p></div></details>
        </form>
        {!preview && <button className="demo-link" disabled={busy} onClick={demo}>사진이 없다면 예시 이미지로 체험하기<ArrowRight size={14} /></button>}
        <div className="service-note"><span className={service?.model_ready ? "status-dot ready" : "status-dot"} />{service?.model_ready ? (service.detection_mode === "mock" ? "개발용 Mock 모드" : "사진 기반 객체 분석 준비됨") : service ? "분석 서버 연결을 확인해 주세요. 요청 실패 시 다시 시도할 수 있어요." : "사진 분석 연결을 확인하고 있어요"}</div>
      </>}

      {page === 'feedback' && result && <>
        <div className="result-heading"><div><span className="eyebrow">{targets[result.target_type]} · {result.space_name} {rooms[result.space_type]}{result.space_source === "object_heuristic" ? " (추정)" : ""} · {result.detection_mode === "mock" ? "Mock" : "사진 분석"}</span><h1>{comparison ? '우리 공간의 변화.' : (result.hazards.length ? '이곳부터 살펴보세요.' : '사진 분석 결과.')}</h1><p>{result.hazards.length ? "표시된 부분을 눌러 개선방법을 확인하세요." : "현재 모델이 확인한 내용을 살펴보세요."}</p></div><div className="score"><strong>{result.score_computable === false ? "—" : result.safety_score}</strong><span>{result.score_computable === false ? "점수 보류" : "참고 안전점수"}</span></div></div>
        {comparison && <div className="comparison"><CheckCircle2 size={23} /><div><strong>{comparison.score_comparable === false ? "점수 비교 보류" : <>{comparison.before_score}점 <ArrowRight size={16} /> {comparison.after_score}점 <span>{comparison.score_change > 0 ? '+' : ''}{comparison.score_change}점</span></>}</strong><p>점검 항목 {comparison.before_hazards}개 → {comparison.after_hazards}개</p><small>{comparison.same_image ? "같은 사진을 다시 분석한 결과입니다." : comparison.notice}</small></div></div>}
        <div className="result-nav" role="group" aria-label="점검 결과 보기">{[['photo','사진 피드백'],['interior','인테리어 가이드'],['checks','직접 점검']].map(([key,label])=><button key={key} aria-pressed={resultTab===key} className={resultTab===key?'selected':''} disabled={busy} onClick={()=>setResultTab(key)}>{label}</button>)}</div>
        {resultTab === 'photo' && <>
        <div className="zone-controls"><button className={showZones?'selected':''} aria-pressed={showZones} onClick={()=>setShowZones(!showZones)}>주의·위험 위치 {showZones?'끄기':'보기'}</button>{showZones && <span><i className="danger"/>위험 <i className="caution"/>주의 · 나머지는 미평가</span>}</div>
        <div className={`result-photo ${showZones?'with-zones':''}`}>{shownImage ? <><img src={shownImage} alt="생활공간 사진과 분석한 객체 위치" />{result.hazards.map((h, index) => <button key={h.id} className={`bbox ${h.risk_level} ${selected === h.id ? 'selected' : ''}`} style={{ left: `${h.bbox[0] * 100}%`, top: `${h.bbox[1] * 100}%`, width: `${h.bbox[2] * 100}%`, height: `${h.bbox[3] * 100}%` }} aria-label={`${index + 1}. ${h.object_label} 피드백 보기`} onClick={() => selectHazard(h.id)}><span>{index + 1} {h.object_label}</span></button>)}{!result.hazards.length && result.detected_objects?.slice(0,10).map((object,index) => <div key={index} className="detected-box" style={{left:`${object.bbox[0]*100}%`,top:`${object.bbox[1]*100}%`,width:`${object.bbox[2]*100}%`,height:`${object.bbox[3]*100}%`}}><span>{object.object_label || object.object_type}</span></div>)}<span className="image-tag">{result.detection_mode === "mock" ? "Mock 위치" : "실제 사진 분석"}</span></> : <div className="no-photo"><ImagePlus size={32} /><strong>사진은 저장하지 않은 점검이에요</strong><p>아래 목록에서 피드백을 확인할 수 있어요.</p></div>}</div>
        <p className="photo-analysis-note">{result.notice}</p>
        <div className="hazard-tabs" aria-label="피드백 받을 위험요소">{result.hazards.map((h, index) => <button key={h.id} className={selected === h.id ? 'selected' : ''} onClick={() => selectHazard(h.id)} aria-pressed={selected === h.id}><span>{index + 1}</span>{h.object_label}{h.resolved && <Check size={14} />}</button>)}</div>
        {hazard && <section className="feedback-card" ref={feedbackRef}><div className="feedback-title"><h2>{hazard.object_label}</h2><span className={`risk-label ${hazard.risk_level}`}>{levels[hazard.risk_level]}</span></div><p className="why">{hazard.description}</p>{hazard.classification_uncertain && <p className="panel-note">물건 종류 확인이 필요해요. 다른 가능성: {hazard.alternative_labels.join(', ')}. 실제 물건을 확인한 후 안내를 적용하세요.</p>}<p className="accident">{hazard.accident}</p><div className="action-advice"><span className="advice-number">1</span><div><h3>먼저 정리하거나 위치를 바꿔주세요</h3><p>{hazard.recommendation}</p></div></div><div className="action-advice supplement"><span className="advice-number">2</span><div><h3>필요하면 이것만 보완해 주세요</h3><p>{hazard.supplement}</p></div></div><button className={`completion-button ${hazard.resolved ? 'done' : ''}`} disabled={busy} onClick={() => resolve(hazard)}><CheckCircle2 size={18} />{hazard.resolved ? '정리 완료 · 표시 취소' : '이 부분은 정리했어요'}</button><small className="completion-note">완료 표시는 체크리스트예요. 점수는 재점검할 때 계산해요.</small></section>}
        {!result.hazards.length && <section className="feedback-card empty-feedback"><ShieldCheck size={28} /><h2>확인할 위험 항목을 찾지 못했어요.</h2><p>현재 모델이 지원하는 객체와 규칙에서 일치하는 항목이 없습니다. 공간이 안전하다는 뜻은 아니며, 전선·콘센트·바닥 물기 등은 직접 확인해 주세요.</p></section>}
        {result.detected_objects?.length > 0 && <details className="extra-settings object-details"><summary>사진에서 탐지한 객체 {result.detected_objects.length}개<ChevronDown size={15} /></summary><p className="panel-note">모델 점수는 정답 확률이 아닙니다. 작은 물건·가려짐·촬영 각도에 따라 놓치거나 잘못 분류할 수 있어요.</p><div className="object-list">{result.detected_objects.map((object, index) => <div key={index}><span>{object.object_label || object.object_type}</span><small>모델 점수 {Math.round(object.confidence * 100)}%{object.detector === 'grounding_dino' ? ' · 전기설비 모델' : ''}</small></div>)}</div></details>}
        {result.explanation.mode !== 'rule_template' && <section className="ai-summary"><span><Sparkles size={17} />{result.explanation.mode === 'gemini' ? 'Gemini 개선 안내' : 'AI 개선 안내'}</span><p>{result.explanation.summary}</p></section>}
        </>}
        {resultTab === 'interior' && <InteriorGuide result={result} image={shownImage} file={resultFile} busy={busy} onToggle={toggleGuide} onPhoto={showPhotoHazard}/>}
        {resultTab === 'checks' && <FieldChecklist result={result} busy={busy} onSave={saveChecks}/>}
        <a className="report-link" href={`${API}/api/scans/${result.scan_id}/report?format=html`} download>점검 보고서 내려받기</a>
        <div className="next-action"><strong>하나씩 정리했다면, 다시 확인해 볼까요?</strong><p>같은 공간을 다시 촬영하면 전후 점수를 비교할 수 있어요.</p><button className="primary submit-button" disabled={busy} onClick={rescan}><Camera size={19} />정리한 뒤 다시 촬영하기<ArrowRight size={18} /></button></div>
        <details className="extra-settings result-details"><summary>전체 점검 안내와 점수 기준<ChevronDown size={15} /></summary><div className="extra-content"><p>{result.explanation.summary}</p><p>{result.explanation.notice}</p><p>고위험 {result.counts.HIGH}개 · 중위험 {result.counts.MEDIUM}개 · 저위험 {result.counts.LOW}개</p><p>{result.scoring?.notice || '이전 기준으로 계산한 기록입니다. 다시 촬영하면 최신 기준을 적용합니다.'}</p><p>{result.notice} 표시되지 않은 영역도 안전이 확인된 곳은 아닙니다.</p><p>점검 시간: {dateLabel(result.created_at)}</p>{comparison && <p>현재 사진에서 탐지되지 않은 항목: {comparison.removed.join(', ') || '없음'}<br />현재 사진에 추가된 항목: {comparison.added.join(', ') || '없음'}</p>}</div></details>
        {comparison?.score_notice && <p className="panel-note">{comparison.score_notice}</p>}{result.scoring?.version==='v1' && <button className="plain-button" disabled={busy} onClick={updateScore}>최신 점수 기준 적용하기</button>}<div className="service-note">{result.detection_mode === "mock" ? "이 기록은 과거 Mock 시연 결과입니다." : "사진 기반 참고 점검 · 실제 환경도 함께 확인하세요"}</div>
        <button className="plain-button back-link" disabled={busy} onClick={newScan}><ArrowLeft size={15} />다른 공간 점검하기</button>
      </>}

      {page === 'history' && <>
        <button className="plain-button back-link" disabled={busy} onClick={() => navigate(result ? 'feedback' : 'capture')}><ArrowLeft size={15} />점검으로 돌아가기</button>
        <div className="intro history-intro"><span className="eyebrow">작은 변화를 기록해요</span><h1>지난 점검</h1><p>사진을 다시 열어 개선 안내를 확인하세요.</p></div>
        <div className="history-filters"><label>공간 검색<input value={historyQuery} onChange={e=>setHistoryQuery(e.target.value)} placeholder="거실, 우리집 등"/></label><label>대상자<select value={historyTarget} onChange={e=>setHistoryTarget(e.target.value)}><option value="all">전체 대상자</option>{Object.entries(targets).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label></div>
        {filteredRecords.length ? <div className="history-list">{filteredRecords.map(record => <button className="history-row" key={record.scan_id} disabled={busy} onClick={() => openRecord(record)}><span className="history-icon"><Camera size={21} /></span><span className="history-text"><strong>{record.space_name} {rooms[record.space_type]}</strong><small>{targets[record.target_type]} · {dateLabel(record.created_at)}</small><small>{record.detection_mode === 'mock' ? '과거 Mock 시연' : '실제 사진 분석'}</small></span><span className="history-score">{record.score_computable === false ? "—" : record.safety_score}<small>{record.score_computable === false ? "보류" : "점"}</small></span><ChevronRight size={17} /></button>)}</div> : <div className="empty-history"><Clock3 size={35} /><p>{records.length ? '검색 조건에 맞는 기록이 없어요.' : '아직 점검한 공간이 없어요.'}</p></div>}
        <button className="primary submit-button" disabled={busy} onClick={newScan}><Camera size={18} />새로운 공간 촬영하기</button><p className="privacy-note">최근 30건의 점검 결과를 보여드려요.</p>
      </>}
      <div hidden={page !== 'care'}><button className="plain-button back-link" onClick={()=>navigate('capture')}><ArrowLeft size={15}/>사진 점검으로 돌아가기</button><Care guardianToken={guardianToken}/></div>
      {page !== 'care' && <details className="extra-settings care-entry"><summary>웹 생활 확인과 보호자 안내<ChevronDown size={15}/></summary><p className="panel-note">동의 후 이 웹 화면의 활동과 연결 상태를 확인합니다.</p><button className="plain-button" onClick={()=>navigate('care')}>생활 확인 열기<ArrowRight size={15}/></button></details>}
      <footer>앗차차 · 작은 변화, 더 안전한 일상</footer>
    </main>
    {busy && page !== 'capture' && <div className="busy-toast" role="status"><LoaderCircle size={18} className="spin" />처리하고 있어요</div>}
  </div>;
}
