import { useEffect, useRef, useState } from "react";
import { generalOfflineResult } from "@shared/offlineSafety.js";
import { reconcileFurniture } from "@shared/furnitureReconciliation.js";
import { overallFeedback, scoreMessage } from "@shared/scanFeedback.js";
import { detectPhoto, downloadModel, modelReady, removeModel } from "./detector.js";

const LEVEL = { HIGH: "고위험", MEDIUM: "중위험", LOW: "저위험", CHECK: "종류 확인" };
const COLOR = { HIGH: "#d70015", MEDIUM: "#ff9500", LOW: "#0071e3", CHECK: "#8e8e93" };

function Overlay({ hazards, selected, showAll }) {
  return (
    <svg className="overlay" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
      {hazards.map((h, i) => (showAll || i === selected) && (
        <rect key={i} x={h.bbox[0]} y={h.bbox[1]} width={h.bbox[2]} height={h.bbox[3]}
          fill="none" stroke={COLOR[h.risk_level]} strokeWidth="3" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

export default function PhotoDemo() {
  const [ready, setReady] = useState(null);
  const [progress, setProgress] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(0);
  const [showAll, setShowAll] = useState(true);
  const urlRef = useRef(null);

  useEffect(() => { modelReady().then(setReady).catch(() => setReady(false)); }, []);
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  async function download() {
    setBusy(true); setError(""); setProgress({ received: 0, total: 0 });
    try {
      await downloadModel((received, total) => setProgress({ received, total }));
      setReady(true);
    } catch (e) { setError(e.message || "모델 다운로드에 실패했습니다."); }
    finally { setBusy(false); setProgress(null); }
  }
  async function remove() {
    await removeModel(); setReady(false); setPhoto(null); setResult(null);
  }
  function pick(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = URL.createObjectURL(file);
    setPhoto(urlRef.current); setResult(null); setError("");
  }
  async function analyze() {
    if (!photo || busy) return;
    setBusy(true); setError("");
    const started = performance.now();
    try {
      const detections = await detectPhoto(photo);
      const scan = generalOfflineResult(reconcileFurniture(detections), false);
      setResult({ ...scan, elapsed_ms: Math.round(performance.now() - started) });
      setSelected(0); setShowAll(true);
    } catch (e) { setError(e.message || "분석에 실패했습니다."); }
    finally { setBusy(false); }
  }

  const hazards = result?.hazards || [];
  const current = hazards[selected];
  const overall = result ? overallFeedback(result) : null;
  const pct = progress?.total ? Math.round((progress.received / progress.total) * 100) : null;

  return (
    <div className="stack">
      <section className="hero">
        <h1>사진으로 살피는 우리 공간의 안전</h1>
        <p>가구와 바닥, 이동 통로가 함께 보이도록 찍은 사진을 올리면 위험 후보와 권고를 알려드려요.</p>
        <p className="privacy">사진은 서버로 전송되지 않고 이 브라우저 안에서만 분석됩니다.</p>
      </section>

      {error && <div className="notice error" role="alert">{error}</div>}

      {ready === false && (
        <section className="card">
          <h2>분석 모델 준비</h2>
          <p>처음 한 번 약 45MB 모델을 내려받아 브라우저에 저장합니다. 이후에는 인터넷 없이도 분석할 수 있어요. 데이터 요금에 유의하세요.</p>
          <button className="btn" onClick={download} disabled={busy}>
            {busy ? `모델 다운로드 중… ${pct != null ? pct + "%" : ""}` : "분석 모델 다운로드"}
          </button>
          {busy && <div className="bar"><div style={{ width: `${pct ?? 5}%` }} /></div>}
        </section>
      )}

      {ready && !result && (
        <section className="card">
          <h2>공간 사진</h2>
          {photo ? <img className="photo" src={photo} alt="선택한 공간 사진" /> : <div className="empty">우리 공간의 지금 모습을 올려주세요<br /><small>가구 · 바닥 · 이동 통로</small></div>}
          <div className="row">
            <label className="btn secondary">앨범에서 선택<input type="file" accept="image/*" hidden onChange={pick} disabled={busy} /></label>
            <label className="btn secondary">카메라 촬영<input type="file" accept="image/*" capture="environment" hidden onChange={pick} disabled={busy} /></label>
          </div>
          <button className="btn" onClick={analyze} disabled={!photo || busy}>{busy ? "사진을 분석하고 있어요…" : "안전점검 시작"}</button>
          <button className="link" onClick={remove} disabled={busy}>저장된 모델 삭제</button>
        </section>
      )}

      {result && (
        <>
          <section className="card score">
            <div className="label">참고 안전점수</div>
            <div className="big">{result.score_computable === false ? "점수 산정 보류" : `${result.safety_score}점`}</div>
            <p>{scoreMessage(result)}</p>
            <small>탐지된 물건 {result.detected_objects?.length || 0}개 · 위험 확인 항목 {hazards.length}개 · {(result.elapsed_ms / 1000).toFixed(1)}초</small>
          </section>
          <section className="card">
            <h2>종합 안전 피드백</h2>
            <p>{overall.summary}</p>
            {overall.actions.map((a, i) => <div key={i}><div className="label">{i + 1}. {a.label}</div><p>{a.text}</p></div>)}
          </section>
          <section className="card">
            <div className="stage"><img className="photo" src={photo} alt="분석한 사진" /><Overlay hazards={hazards} selected={selected} showAll={showAll} /></div>
            {!!hazards.length && (
              <div className="chips">
                <button className={showAll ? "chip on" : "chip"} onClick={() => setShowAll(true)}>전체 박스 보기</button>
                {hazards.map((h, i) => (
                  <button key={i} className={!showAll && selected === i ? "chip on" : "chip"} onClick={() => { setSelected(i); setShowAll(false); }}>
                    {i + 1}. {h.instance_label || h.object_label} · {LEVEL[h.risk_level]}
                  </button>
                ))}
              </div>
            )}
          </section>
          <section className="card">
            {current ? (
              <>
                <div className="label">{selected + 1} / {hazards.length} · {LEVEL[current.risk_level]}</div>
                <h2>{current.instance_label || current.object_label}</h2>
                <p>{current.description}</p>
                {current.accident && <p>{current.accident}</p>}
                <div className="label">먼저 확인할 권고</div>
                <p className="advice">{current.recommendation}</p>
                {current.supplement && <p>{current.supplement}</p>}
                {current.placement_advice && <p>{current.placement_advice}</p>}
              </>
            ) : <p>사진에서 위험 후보가 발견되지 않았습니다. 탐지되지 않은 곳도 현장 확인이 필요합니다.</p>}
            <p className="note">{result.notice}</p>
          </section>
          <button className="btn secondary" onClick={() => { setResult(null); setPhoto(null); }}>다른 사진 점검하기</button>
        </>
      )}
    </div>
  );
}
