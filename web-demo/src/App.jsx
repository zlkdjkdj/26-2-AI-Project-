import { useState } from "react";
import PhotoDemo from "./PhotoDemo.jsx";
import HomecamDemo from "./HomecamDemo.jsx";

const tabs = [
  ["photo", "사진 안전점검"],
  ["homecam", "홈캠 체험"],
];

export default function App() {
  const [tab, setTab] = useState("photo");
  return (
    <div className="shell">
      <header className="top">
        <div className="brand">앗차차 <span className="badge">웹 체험판</span></div>
        <nav role="tablist" className="tabs">
          {tabs.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "tab on" : "tab"} onClick={() => setTab(id)}>{label}</button>
          ))}
        </nav>
      </header>
      <main className="main">
        {/* 탭을 바꿔도 다운로드·분석 상태가 유지되도록 두 화면을 계속 마운트해 둔다. */}
        <div hidden={tab !== "photo"}><PhotoDemo /></div>
        <div hidden={tab !== "homecam"}><HomecamDemo /></div>
      </main>
      <footer className="foot">
        체험판입니다. 실제 앱(Android)에서는 휴대폰 두 대를 Tailscale로 연결하는 홈캠과 전기설비 추가 점검을 사용할 수 있습니다.
        사진 점수는 안전 인증이 아니며, 사진에서 알 수 없는 상태는 현장에서 확인해야 합니다.
      </footer>
    </div>
  );
}
