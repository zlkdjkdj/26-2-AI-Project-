import { useEffect, useRef, useState } from "react";

// 체험 전용 화면입니다. 실제 영상 전송·QR 등록·녹화는 하지 않으며, 앱의 흐름과 화면 구성만 보여줍니다.
function FakeQr() {
  const cells = Array.from({ length: 169 }, (_, i) => ((i * 7 + (i >> 3) * 3) % 5 < 2));
  return (
    <svg viewBox="0 0 13 13" className="qr" role="img" aria-label="체험용 가짜 QR">
      <rect width="13" height="13" fill="#fff" />
      {cells.map((on, i) => on && <rect key={i} x={i % 13} y={Math.floor(i / 13)} width="1" height="1" fill="#1d1d1f" />)}
    </svg>
  );
}

function Feed({ live, children }) {
  const [t, setT] = useState(0);
  useEffect(() => { const id = setInterval(() => setT(v => v + 1), 1000); return () => clearInterval(id); }, []);
  const mm = String(Math.floor(t / 60)).padStart(2, "0"), ss = String(t % 60).padStart(2, "0");
  return (
    <div className="feed">
      <img src={`${import.meta.env.BASE_URL}room-preview.jpg`} alt="체험용 샘플 영상" />
      {live}
      <div className="live"><i /> LIVE · {mm}:{ss}</div>
      <div className="demo-tag">체험 영상 · 실제 촬영이 아닙니다</div>
      {children}
    </div>
  );
}

function Monitor({ onBack }) {
  const [rec, setRec] = useState(false);
  return (
    <div className="stack">
      <button className="link" onClick={onBack}>← 역할 선택</button>
      <Feed live={<div className="person" aria-label="사람 감지 박스(체험)"><span>사람 0.92</span></div>} />
      <div className="row">
        <button className={rec ? "btn danger" : "btn secondary"} onClick={() => setRec(!rec)}>{rec ? "녹화 중지 (체험)" : "녹화 시작 (체험)"}</button>
        <button className="btn secondary" disabled title="앱에서 지원합니다">PIP · 앱에서 지원</button>
      </div>
      <p className="note">체험판에서는 녹화가 저장되지 않습니다. 실제 앱은 사람 감지 박스, 화면 확대·회전, PIP, 영상 기록을 지원합니다.</p>
    </div>
  );
}

function Camera({ onBack }) {
  const [stream, setStream] = useState(null);
  const [error, setError] = useState("");
  const video = useRef(null);
  useEffect(() => { if (video.current) video.current.srcObject = stream; }, [stream]);
  useEffect(() => () => stream?.getTracks().forEach(t => t.stop()), [stream]);
  async function preview() {
    setError("");
    try { setStream(await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false })); }
    catch { setError("카메라를 사용할 수 없습니다. 권한을 허용했는지 확인해 주세요."); }
  }
  return (
    <div className="stack">
      <button className="link" onClick={onBack}>← 역할 선택</button>
      <section className="card">
        <h2>촬영용 공기계 — 등록 QR</h2>
        <p>실제 앱에서는 이 QR을 모니터링 휴대폰이 스캔하면 Tailscale 네트워크로 영상이 연결됩니다. 아래 QR은 체험용 모양이며 동작하지 않습니다.</p>
        <FakeQr />
      </section>
      <section className="card">
        <h2>내 카메라 미리보기 (선택)</h2>
        <p>촬영 화면이 어떻게 보이는지만 확인합니다. 영상은 이 기기 밖으로 전송하거나 저장하지 않습니다.</p>
        {error && <div className="notice error">{error}</div>}
        {stream ? <video ref={video} className="photo" autoPlay playsInline muted /> : null}
        <button className="btn secondary" onClick={stream ? () => setStream(null) : preview}>{stream ? "미리보기 끄기" : "내 카메라로 미리보기"}</button>
      </section>
    </div>
  );
}

export default function HomecamDemo() {
  const [role, setRole] = useState(null);
  if (role === "camera") return <Camera onBack={() => setRole(null)} />;
  if (role === "monitor") return <Monitor onBack={() => setRole(null)} />;
  return (
    <div className="stack">
      <section className="hero">
        <h1>이 휴대폰은 어떤 역할인가요?</h1>
        <p>앗차차 홈캠은 집에 둔 공기계(촬영)와 가지고 다니는 휴대폰(모니터링)을 QR로 연결합니다. 체험판에서는 화면 흐름만 둘러볼 수 있어요.</p>
      </section>
      <section className="card dark">
        <h2>촬영용 공기계</h2>
        <p>집에 고정해 둘 휴대폰에서 선택하세요. 등록 QR을 만든 뒤 촬영을 시작합니다.</p>
        <button className="btn light" onClick={() => setRole("camera")}>촬영 화면 체험</button>
      </section>
      <section className="card">
        <h2>모니터링 휴대폰</h2>
        <p>밖에서도 확인할 휴대폰에서 선택하세요. 등록한 홈캠을 열어 실시간으로 봅니다.</p>
        <button className="btn" onClick={() => setRole("monitor")}>모니터링 화면 체험</button>
      </section>
      <p className="note">홈캠은 자동 낙상 감지·긴급 출동 기능을 제공하지 않습니다.</p>
    </div>
  );
}
