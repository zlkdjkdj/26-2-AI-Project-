import { useEffect, useState } from "react";
import Landing, { DownloadButton } from "./Landing.jsx";
import PhotoDemo from "./PhotoDemo.jsx";
import HomecamDemo from "./HomecamDemo.jsx";
import { Brackets, Menu } from "./icons.jsx";

const links = [
  ["home", "서비스 소개"],
  ["photo", "사진 점검 체험"],
  ["homecam", "홈캠 체험"],
];
const views = ["home", "photo", "homecam"];
const fromHash = () => {
  const id = location.hash.replace("#/", "").replace("#", "");
  return views.includes(id) ? id : "home";
};

export default function App() {
  const [view, setView] = useState(fromHash);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    const onHash = () => setView(fromHash());
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);

  // id가 "download"이면 소개 화면의 다운로드 구역으로 이동한다.
  function go(id) {
    setMenu(false);
    if (id === "download") {
      location.hash = "#/home";
      setView("home");
      setTimeout(() => document.getElementById("download")?.scrollIntoView({ behavior: "smooth" }), 50);
      return;
    }
    location.hash = `#/${id}`;
    setView(id);
    scrollTo({ top: 0 });
  }

  return (
    <div className={view === "home" ? "shell wide" : "shell"}>
      <header className="nav">
        <a className="logo" href="#/home" onClick={(e) => { e.preventDefault(); go("home"); }}>
          <Brackets /> 앗차차 <small>웹 체험판</small>
        </a>
        <nav className={menu ? "nav-links open" : "nav-links"} aria-label="주요 메뉴">
          {links.map(([id, label]) => (
            <button key={id} className="nav-link" aria-current={view === id ? "page" : undefined} onClick={() => go(id)}>{label}</button>
          ))}
        </nav>
        <span className="nav-cta"><DownloadButton size="sm" /></span>
        <button className="btn secondary sm menu-btn" aria-expanded={menu} onClick={() => setMenu(!menu)}><Menu /> 메뉴</button>
      </header>
      <main className="main">
        {/* 탭을 바꿔도 다운로드·분석 상태가 유지되도록 체험 화면은 계속 마운트해 둔다. */}
        <div hidden={view !== "home"}><Landing onStart={go} /></div>
        <div hidden={view !== "photo"} className="narrow"><PhotoDemo /></div>
        <div hidden={view !== "homecam"} className="narrow"><HomecamDemo /></div>
      </main>
      <footer className="foot">
        체험판입니다. 실제 앱(Android)에서는 휴대폰 두 대를 Tailscale로 연결하는 홈캠과 전기설비 추가 점검을 사용할 수 있습니다.
        사진 점수는 안전 인증이 아니며, 사진에서 알 수 없는 상태는 현장에서 확인해야 합니다.
        디자인 정리에 unslop(Damir Sokolovsky, CC BY 4.0)의 지침을 사용했습니다.
      </footer>
    </div>
  );
}
