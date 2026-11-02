import { useEffect, useState } from "react";
import {
  ShieldCheck,
  ArrowRight,
  LockKeyhole,
  Eye,
  EyeOff,
  LoaderCircle,
} from "lucide-react";
import { request, clearDemoSession } from "./api";
import Care from "./Care";

export default function DemoAccess({ children }) {
  const [ready, setReady] = useState(false),
    [unlocked, setUnlocked] = useState(false),
    [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [show, setShow] = useState(false);
  const [retention, setRetention] = useState(90);
  const [guardian] = useState(() =>
    new URLSearchParams(window.location.hash.slice(1)).get("care"),
  );
  useEffect(() => {
    if (guardian) return;
    let active = true;
    let pending = false;
    async function refreshAccess() {
      if (pending) return;
      pending = true;
      try {
        const data = await request("/api/demo/status", {}, 10000);
        if (active) {
          setUnlocked(data.unlocked);
          setRetention(data.retention_days);
          setReady(true);
        }
      } catch (e) {
        if (active) {
          setUnlocked(false);
          setError(e.message);
          setReady(true);
        }
      } finally {
        pending = false;
      }
    }
    refreshAccess();
    const timer = setInterval(refreshAccess, 30000);
    const visible = () => {
      if (document.visibilityState === "visible") refreshAccess();
    };
    document.addEventListener("visibilitychange", visible);
    const locked = () => {
      setUnlocked(false);
      setCode("");
      clearDemoSession();
    };
    window.addEventListener("demo-locked", locked);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("demo-locked", locked);
    };
  }, [guardian]);
  async function unlock(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request("/api/demo/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      setCode("");
      setUnlocked(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function lock(all = false) {
    setBusy(true);
    setError("");
    try {
      await request(all ? "/api/demo/lock-all" : "/api/demo/lock", {
        method: "POST",
      });
      clearDemoSession();
      setUnlocked(false);
      setCode("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (guardian)
    return (
      <main className="guardian-main">
        <Care guardianToken={guardian} />
      </main>
    );
  if (!ready)
    return (
      <div className="demo-loading" role="status">
        <LoaderCircle className="spin" />
        시연 공간을 확인하고 있어요.
      </div>
    );
  if (unlocked)
    return (
      <>
        <div className="demo-session-bar">
          <span>
            <LockKeyhole size={13} />
            개인 시연 모드 · 최대 8시간 허용 · 기록 {retention}일 보관
          </span>
          <div>
            <button disabled={busy} onClick={() => lock()}>
              이 기기 잠그기
            </button>
            <button disabled={busy} onClick={() => lock(true)}>
              모든 기기 잠그기
            </button>
          </div>
        </div>
        {error && (
          <p className="demo-session-error" role="alert">
            {error}
          </p>
        )}
        {children}
      </>
    );
  return (
    <div className="demo-access">
      <div className="demo-access-brand">
        <ShieldCheck size={27} />
        <strong>
          앗차차<span>.</span>
        </strong>
      </div>
      <div className="demo-access-layout">
        <section className="demo-access-intro">
          <span className="eyebrow">PRIVATE SAFETY DEMO</span>
          <h1>
            우리 공간의 안전,
            <br />
            <span>나만의 시연 공간에서.</span>
          </h1>
          <p>
            사진 속 위험요소를 살펴보고,
            <br />
            점수와 권고사항을 차근차근 확인하세요.
          </p>
          <div>
            <ShieldCheck size={20} />
            <span>
              회원가입 없이, 시연 코드 하나로.
              <br />
              <small>사진과 기록은 잠금을 해제한 기기에서만 열립니다.</small>
            </span>
          </div>
        </section>
        <form className="demo-access-form" onSubmit={unlock}>
          <div className="demo-lock-icon">
            <LockKeyhole size={24} />
          </div>
          <h2>시연 공간 열기</h2>
          <p>서버에서 발급한 시연 코드를 입력하세요.</p>
          <label htmlFor="demo-code">시연 코드</label>
          <div className="demo-code-field">
            <input
              id="demo-code"
              type={show ? "text" : "password"}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              maxLength={128}
              autoComplete="off"
              spellCheck={false}
              placeholder="시연 코드를 붙여넣으세요"
            />
            <button
              type="button"
              aria-label={show ? "시연 코드 숨기기" : "시연 코드 보기"}
              onClick={() => setShow((v) => !v)}
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {error && (
            <p className="demo-code-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy || !code.trim()}>
            {busy ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <>
                <span>시연 시작하기</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
          <p className="demo-code-help">
            기본 발급 코드는 서버의{" "}
            <code>backend/data/demo-access-code.txt</code> 파일에 있습니다.
            코드는 다른 사람과 공유하지 마세요.
          </p>
          <small>시연 코드는 브라우저에 저장하지 않습니다.</small>
        </form>
      </div>
    </div>
  );
}
