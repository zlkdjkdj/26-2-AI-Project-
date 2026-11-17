import { useEffect, useState } from "react";
import Landing from "./Landing.jsx";
import PhotoDemo from "./PhotoDemo.jsx";
import HomecamDemo from "./HomecamDemo.jsx";

const tabs = [
  ["home", "서비스 소개"],
  ["photo", "사진 점검 체험"],
  ["homecam", "홈캠 체험"],
];
const fromHash = () => {
  const id = location.hash.replace("#/", "");
  return tabs.some(([t]) => t === id) ? id : "home";
};

export default function App() {
  const [tab, setTabState] = useState(fromHash);
  useEffect(() => {
    const onHash = () => setTabState(fromHash());
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);
  function setTab(id) {
    location.hash = `#/${id}`;
    setTabState(id);
    scrollTo({ top: 0 });
  }
  return (
    <div className={tab === "home" ? "shell wide" : "shell"}>
      <header className="top">
        <div className="brand"><a href="#/home" onClick={() => setTab("home")}>앗차차</a> <span className="badge">웹 체험판</span></div>
        <nav role="tablist" className="tabs">
          {tabs.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "tab on" : "tab"} onClick={() => setTab(id)}>{label}</button>
          ))}
        </nav>
      </header>
      <main className="main">
        {/* 탭을 바꿔도 다운로드·분석 상태가 유지되도록 체험 화면은 계속 마운트해 둔다. */}
        <div hidden={tab !== "home"}><Landing onStart={setTab} /></div>
        <div hidden={tab !== "photo"} className="narrow"><PhotoDemo /></div>
        <div hidden={tab !== "homecam"} className="narrow"><HomecamDemo /></div>
      </main>
      <footer className="foot">
        체험판입니다. 실제 앱(Android)에서는 휴대폰 두 대를 Tailscale로 연결하는 홈캠과 전기설비 추가 점검을 사용할 수 있습니다.
        사진 점수는 안전 인증이 아니며, 사진에서 알 수 없는 상태는 현장에서 확인해야 합니다.
      </footer>
    </div>
  );
}
