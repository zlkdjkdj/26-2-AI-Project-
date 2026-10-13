import { useEffect, useRef, useState } from 'react';
import { Bell, HeartHandshake, MapPin, Copy, Pause, RefreshCw } from 'lucide-react';
import { request } from './api';

const storedKey='atchacha-care-session';
function loadSession() { try { return JSON.parse(localStorage.getItem(storedKey)||'null'); } catch { return null; } }
const timeLabel=value=>value?new Date(value*1000).toLocaleString('ko-KR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'아직 기록 없음';

export default function Care({ guardianToken=null }) {
  const [session,setSession]=useState(()=>guardianToken?null:loadSession());
  const [status,setStatus]=useState(null);
  const [name,setName]=useState('우리 가족');
  const [idleHours,setIdleHours]=useState(3);
  const [startHour,setStartHour]=useState(8);
  const [endHour,setEndHour]=useState(22);
  const [consent,setConsent]=useState(false);
  const [locationConsent,setLocationConsent]=useState(false);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [copied,setCopied]=useState(false);
  const activity=useRef(0);
  const lastLocation=useRef(0);
  const token=guardianToken || session?.owner_token;
  const guardian=!!guardianToken;
  const headers=token?{Authorization:`Bearer ${token}`}:{};

  async function refresh() { if(!token) return; try { const state=await request(guardian?'/api/care/guardian':'/api/care/status',{headers});setStatus(state);setError(''); } catch(e) {setError(e.message);} }
  useEffect(()=>{
    if(!token) return;
    let active=true;
    let pending=false;
    const onActivity=()=>{activity.current=Date.now()/1000;};
    async function poll() {
      if(pending) return;
      pending=true;
      try {
        const state=await request(guardian?'/api/care/guardian':'/api/care/heartbeat',guardian?{headers:{Authorization:`Bearer ${token}`}}:{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(activity.current?{last_activity:activity.current}:{})});
        if(active) {setStatus(state);setError('');}
      } catch(e) {if(active)setError(e.message);} finally {pending=false;}
    }
    poll();
    const timer=setInterval(poll,60000);
    if(!guardian) {window.addEventListener('pointerdown',onActivity);window.addEventListener('keydown',onActivity);}
    return ()=>{active=false;clearInterval(timer);window.removeEventListener('pointerdown',onActivity);window.removeEventListener('keydown',onActivity);};
  },[token,guardian]);

  useEffect(()=>{
    if(!token || guardian || !status?.enabled || !status.location_consent) return;
    let cancelled=false;
    function recordLocation() {
      if(cancelled || document.visibilityState!=='visible' || Date.now()-lastLocation.current<3600000) return;
      if(!window.isSecureContext || !navigator.geolocation) {setError('위치 기록에는 HTTPS 또는 localhost와 브라우저 위치 권한이 필요합니다. 활동 기록은 계속됩니다.');return;}
      lastLocation.current=Date.now();
      navigator.geolocation.getCurrentPosition(async position=>{
        if(cancelled) return;
        try {
          const state=await request('/api/care/heartbeat',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({latitude:position.coords.latitude,longitude:position.coords.longitude})});
          if(!cancelled)setStatus(state);
        } catch(e) {if(!cancelled)setError(e.message);}
      },()=>{if(!cancelled)setError('위치 권한 또는 위치 정보를 확인할 수 없습니다. 활동 기록은 계속됩니다.');},{enableHighAccuracy:false,timeout:10000,maximumAge:300000});
    }
    recordLocation();const timer=setInterval(recordLocation,60000);
    return ()=>{cancelled=true;clearInterval(timer);};
  },[token,guardian,status?.enabled,status?.location_consent]);

  async function start(event) {
    event.preventDefault();setBusy(true);setError('');
    try {
      const created=await request('/api/care/sessions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,idle_hours:Number(idleHours),start_hour:Number(startHour),end_hour:Number(endHour),consent,location_consent:locationConsent})});
      const saved={owner_token:created.owner_token,guardian_token:created.guardian_token};
      localStorage.setItem(storedKey,JSON.stringify(saved));activity.current=Date.now()/1000;lastLocation.current=0;setSession(saved);setStatus(created);
    } catch(e) {setError(e.message);} finally {setBusy(false);}
  }
  async function stop() {
    setBusy(true);setError('');
    try {setStatus(await request('/api/care/stop',{method:'POST',headers}));localStorage.removeItem(storedKey);setSession(null);}
    catch(e) {setError(e.message);} finally {setBusy(false);}
  }
  async function copyLink() {
    try {await navigator.clipboard.writeText(`${window.location.origin}/#care=${session.guardian_token}`);setCopied(true);} catch {setError('링크를 복사하려면 HTTPS 또는 localhost에서 접속하세요.');}
  }
  return <section className="care-panel">
    <div className="panel-heading"><span className="eyebrow">동의하고 시작하는 웹 생활 확인</span><h2>{guardian?'가족의 연결 상태.':'작은 안부를 이어가요.'}</h2><p>사고를 판단하는 대신, 직접 확인이 필요한 때를 알려드려요.</p></div>
    <div className="care-notice"><HeartHandshake size={23}/><p>이 웹 화면의 클릭·키 입력과 서버 연결만 기록합니다. 휴대폰 전체 활동을 읽거나 화면 종료 후 계속 관찰하지 않습니다. 브라우저가 닫히거나 절전 상태가 되면 연결 확인 안내가 표시될 수 있어요. 보호자 화면을 열어야 안내를 볼 수 있으며 문자·푸시는 보내지 않습니다.</p></div>
    {error && <p className="care-error" role="alert">{error}</p>}
    {!guardian && !session && <form onSubmit={start} className="care-form">
      <label>표시 이름<input required maxLength={50} value={name} onChange={e=>setName(e.target.value)}/></label>
      <label>이 화면에서 활동이 없을 때 확인<select value={idleHours} onChange={e=>setIdleHours(e.target.value)}>{[1,2,3,4,6,8,12,24].map(h=><option key={h} value={h}>{h}시간 후</option>)}</select></label>
      <div className="care-hours"><label>확인 시작 시간<select value={startHour} onChange={e=>setStartHour(e.target.value)}>{Array.from({length:24},(_,h)=><option key={h} value={h}>{h}시</option>)}</select></label><label>확인 종료 시간<select value={endHour} onChange={e=>setEndHour(e.target.value)}>{Array.from({length:24},(_,h)=><option key={h} value={h}>{h}시</option>)}</select></label></div><small>한국 시간 기준 · 시작과 종료가 같으면 하루 종일 확인합니다.</small>
      <label className="checkbox-label"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>이 화면의 활동 시간 기록과 기기 내 접근키 저장에 동의합니다.</label>
      <label className="checkbox-label"><input type="checkbox" checked={locationConsent} onChange={e=>setLocationConsent(e.target.checked)}/>선택: 약 1시간 주기로 위치를 서버에 기록합니다.</label><small>위치는 이 화면이 열려 있고 권한이 허용된 경우에만 기록하며, 보호자 화면과 AI에 보내지 않습니다. 중지하면 저장된 마지막 위치를 지웁니다.</small>
      <button className="primary submit-button" disabled={!consent || busy}><HeartHandshake size={17}/>웹 생활 확인 시작</button>
    </form>}
    {status && (guardian || session) && <>
      <div className={`care-state ${status.state}`}><span className="status-dot"/><div><strong>{status.name} · {({connected:'연결 확인',inactive:'활동 확인 필요',disconnected:'연결 확인 필요',quiet:'확인 시간 밖',paused:'중지'})[status.state]}</strong><p>{status.message}</p></div><button aria-label="생활 확인 새로고침" onClick={refresh}><RefreshCw size={16}/></button></div>
      <div className="care-times"><p>마지막 웹 활동 <strong>{timeLabel(status.last_activity)}</strong></p><p>마지막 서버 연결 <strong>{timeLabel(status.last_seen)}</strong></p>{!guardian && status.location_consent && <p><MapPin size={13}/>마지막 위치 기록 <strong>{timeLabel(status.location_at)}</strong></p>}</div>
      {!guardian && <><button className="completion-button" onClick={copyLink}><Copy size={16}/>{copied?'보호자 확인 링크 복사됨':'보호자 확인 링크 복사'}</button><p className="panel-note">이 링크는 상태와 알림을 볼 수 있는 접근키를 포함합니다. 확인할 보호자에게만 전달하세요. 위치 좌표는 공유하지 않습니다. 외부 접속은 공개 HTTPS 서버 배포 후 사용할 수 있습니다.</p><button className="plain-button" disabled={busy} onClick={stop}><Pause size={15}/>생활 확인 중지</button></>}
      <div className="care-alerts"><h3><Bell size={17}/>확인 안내</h3>{status.alerts.length?status.alerts.map(alert=><article key={alert.id}><strong>{alert.kind==='inactive'?'활동 확인 필요':'연결 확인 필요'}</strong><p>{alert.message}</p><small>{timeLabel(alert.created_at)}</small></article>):<p>아직 확인 안내가 없어요.</p>}</div>
    </>}
  </section>;
}
