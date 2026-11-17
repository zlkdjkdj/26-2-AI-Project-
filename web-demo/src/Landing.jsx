import { ScanLine, Video, Lock, Download, Corners } from "./icons.jsx";
import { release } from "./release.js";

const base = import.meta.env.BASE_URL;

// 실제 앱(mobile/src)의 문구·구성·색을 재현한 화면 목업입니다. 기기 캡처가 아닙니다.
function Phone({ title, caption, children }) {
  return (
    <figure className="phone-wrap">
      <div className="phone" role="img" aria-label={`${title} 화면 예시`}>
        <div className="notch" />
        <div className="screen">{children}</div>
      </div>
      <figcaption><b>{title}</b><span>{caption}</span></figcaption>
    </figure>
  );
}

function ScreenModes() {
  return (
    <div className="app">
      <div className="app-title">앗차차</div>
      <div className="app-sub">집을 더 안전하게. 홈캠과 사진 안전점검을 선택하세요.</div>
      <div className="app-card"><b>홈캠</b><p>실시간 영상으로 집을 지켜보세요. 공기계와 모니터링 휴대폰을 QR로 연결합니다.</p><div className="app-btn">홈캠 시작하기</div></div>
      <div className="app-card"><b>사진 안전점검</b><p>사진을 찍으면 가구, 전기, 위험 요소를 분석하고 개선점을 알려줍니다.</p><div className="app-btn">사진 점검 시작하기</div></div>
      <div className="app-foot">홈캠에는 Tailscale이 필요합니다. 사진 점검은 모델 설치 후 오프라인으로 사용할 수 있어요.</div>
    </div>
  );
}

function ScreenResult() {
  return (
    <div className="app">
      <div className="app-eyebrow">사진 안전점검</div>
      <div className="app-h">이곳부터 살펴보세요</div>
      <div className="app-score"><small>참고 안전점수</small><b>54점</b><span>탐지된 물건 6개 · 확인 항목 5개</span></div>
      <div className="app-photo">
        <img src={`${base}room-preview.jpg`} alt="" />
        <i style={{ left: "6%", top: "46%", width: "34%", height: "40%", borderColor: "#c2680a" }} />
        <i style={{ left: "46%", top: "52%", width: "44%", height: "34%", borderColor: "#c2680a" }} />
        <i style={{ left: "4%", top: "20%", width: "24%", height: "26%", borderColor: "#0a66d0" }} />
      </div>
      <div className="app-chips"><span className="on">전체 박스</span><span>1. 소파 모서리 · 중위험</span><span>2. 의자 · 중위험</span></div>
      <div className="app-card"><b>소파 모서리 확인</b><p>단단한 모서리가 노출되어 있고 사람이 부딪힐 위치인지 직접 확인하세요.</p></div>
    </div>
  );
}

function ScreenMonitor() {
  return (
    <div className="app dark">
      <div className="app-eyebrow">홈캠 · 모니터링</div>
      <div className="app-feed">
        <img src={`${base}room-preview.jpg`} alt="" />
        <span className="live"><i /> LIVE</span>
        <em className="person"><u>사람</u></em>
      </div>
      <div className="app-row"><div className="app-btn light">녹화</div><div className="app-btn light">PIP</div></div>
      <div className="app-foot">같은 Tailscale 네트워크로 연결됩니다. 영상은 PC 서버에 저장하지 않아요.</div>
    </div>
  );
}

function ScreenRole() {
  return (
    <div className="app">
      <div className="app-eyebrow">홈캠 · 역할 선택</div>
      <div className="app-h">이 휴대폰은 어떤 역할인가요</div>
      <div className="app-steps"><i className="on" /><i className="on" /><i /></div>
      <div className="app-card dk"><b>촬영용 공기계</b><p>집에 고정해 둘 휴대폰에서 선택하세요.</p><div className="app-btn light">이 휴대폰으로 촬영하기</div></div>
      <div className="app-card"><b>모니터링 휴대폰</b><p>밖에서도 확인할 휴대폰에서 선택하세요.</p><div className="app-btn">등록한 홈캠 보기</div></div>
      <div className="app-qr" aria-hidden="true">{Array.from({ length: 64 }, (_, i) => <i key={i} className={(i * 5 + (i >> 3)) % 3 === 0 ? "k" : ""} />)}</div>
    </div>
  );
}

const steps = [
  ["사진을 찍어요", "가구와 바닥, 이동 통로가 함께 보이게 촬영하거나 앨범에서 고릅니다."],
  ["확인할 곳을 봐요", "휴대폰 안에서 분석해 확인이 필요한 곳을 사진 위에 박스로 표시합니다."],
  ["홈캠으로 지켜봐요", "안 쓰는 폰을 홈캠으로 두고, 밖에서 다른 폰으로 실시간 영상을 봅니다."],
];

export function DownloadButton({ size }) {
  const cls = `btn${size === "sm" ? " sm" : ""}`;
  return release.url
    ? <a className={cls} href={release.url} download><Download /> APK 받기</a>
    : <span className={cls} role="link" aria-disabled="true"><Download /> 배포 준비 중</span>;
}

export default function Landing({ onStart }) {
  return (
    <div className="landing">
      <section className="l-hero">
        <div className="l-hero-text">
          <small>Android 생활안전 앱</small>
          <h1>사진 한 장으로<br />집 안의 위험 후보를 살펴요</h1>
          <p className="sub">가구와 전선 주변에서 확인할 곳을 사진 위에 표시하고, 안 쓰는 휴대폰은 홈캠으로 쓸 수 있어요.</p>
          <div className="row cta">
            <button className="btn" onClick={() => onStart("photo")}>사진 점검 체험하기</button>
            <a className="btn secondary" href="#download" onClick={(e) => { e.preventDefault(); onStart("download"); }}>앱 받기</a>
          </div>
        </div>
        <div className="l-hero-vis">
          <img className="l-hero-img" src={`${base}hero.jpg`} alt="휴대폰 화면에 가구와 콘센트 주변 확인 지점이 박스로 표시된 모습" width="1400" height="788" />
          <Corners />
        </div>
      </section>

      <section className="l-sec">
        <h2>앗차차가 하는 일</h2>
        <p className="lead">집은 익숙한 공간이라 통로의 전선이나 가구 주변을 놓치기 쉽습니다. 별도 카메라나 서버 없이, 스마트폰으로 그 확인을 돕습니다. 가족의 공간을 살피는 보호자와 집 안 환경을 점검하려는 사용자를 위한 서비스예요.</p>
        <div className="l-feature">
          <article className="l-card">
            <ScanLine />
            <h3>사진 안전점검</h3>
            <p>가구와 전기설비 주변의 위험 후보를 사진 위에 표시하고, 물건별 권고와 참고 점수를 보여 줍니다. 모델을 한 번 내려받으면 인터넷 없이 휴대폰에서 분석해요.</p>
          </article>
          <article className="l-card">
            <Video />
            <h3>공기계 홈캠</h3>
            <p>촬영용과 모니터링용 폰을 QR로 한 번 연결하면 다른 Wi-Fi나 모바일 데이터에서도 실시간 영상을 볼 수 있어요.</p>
          </article>
        </div>
        <div className="l-note-row"><Lock /><span>사진 분석은 휴대폰 안에서 이뤄지고 외부 서버로 전송하지 않습니다. 내려받은 모델은 SHA-256으로 무결성을 확인해요.</span></div>
      </section>

      <section className="l-sec">
        <h2>앱 화면</h2>
        <p className="lead">실제 앱의 구성과 문구를 그대로 옮긴 화면 예시입니다.</p>
        <div className="phones">
          <Phone title="모드 선택" caption="홈캠과 사진 점검을 동등하게"><ScreenModes /></Phone>
          <Phone title="사진 점검 결과" caption="박스, 점수, 물건별 권고"><ScreenResult /></Phone>
          <Phone title="홈캠 모니터링" caption="실시간 영상과 사람 위치 표시"><ScreenMonitor /></Phone>
          <Phone title="역할 선택과 연결" caption="QR로 두 폰을 한 번에 연결"><ScreenRole /></Phone>
        </div>
        <p className="caption-note">화면 예시는 구성 재현본이며 기기 캡처가 아닙니다. 실제 화면은 기기와 버전에 따라 다를 수 있어요.</p>
      </section>

      <section className="l-sec" id="download">
        <h2>Android 앱 받기</h2>
        <p className="lead">시연용 빌드입니다. 스토어 앱이 아니라서 설치할 때 몇 가지 확인이 필요해요.</p>
        <div className="dl">
          <div>
            <dl className="dl-spec">
              <dt>버전</dt><dd>{release.version} (코드 {release.versionCode})</dd>
              <dt>크기</dt><dd>{release.size}</dd>
              <dt>지원</dt><dd>{release.minAndroid}</dd>
              <dt>서명</dt><dd>{release.signing}</dd>
              <dt>SHA-256</dt><dd className="mono">{release.sha256}</dd>
            </dl>
            <div className="dl-actions">
              <DownloadButton />
              <p className="dl-warn">받은 파일의 SHA-256이 위 값과 같은지 확인하세요. 처음 사용할 때 사진 점검용 모델(약 45MB)을 별도로 내려받습니다.</p>
            </div>
          </div>
          <aside className="dl-side">
            <h3>설치 방법</h3>
            <ol>
              <li>휴대폰에서 APK 파일을 내려받습니다.</li>
              <li>설치 중 안내가 나오면 해당 브라우저나 파일 앱의 &lsquo;출처를 알 수 없는 앱 설치&rsquo;를 허용합니다.</li>
              <li>설치 후 카메라 권한을 허용하면 사진 점검과 홈캠을 쓸 수 있어요.</li>
            </ol>
            <p className="dl-warn">개발용 인증서로 서명된 빌드라 Play 프로텍트가 경고를 표시할 수 있어요.</p>
          </aside>
        </div>
      </section>

      <section className="l-sec">
        <h2>이렇게 사용해요</h2>
        <ol className="l-steps">
          {steps.map(([t, d], i) => (
            <li key={t}><span className="n mono">0{i + 1}</span><h3>{t}</h3><p>{d}</p></li>
          ))}
        </ol>
      </section>

      <section className="l-sec">
        <h2>기술과 보안 흐름</h2>
        <p className="lead">사진 분석은 기기 안에서, 홈캠은 같은 사설 네트워크(Tailscale) 안에서 암호화된 WebRTC로 연결합니다.</p>
        <img className="l-flow" src={`${base}flow.png`} alt="사진 안전점검과 홈캠의 기술과 보안 흐름도" loading="lazy" width="1600" height="900" />
      </section>

      <section className="l-sec">
        <h2>알려드릴 점</h2>
        <ul className="l-limits">
          <li>사진 점수는 안전 인증이 아닙니다. 탐지 박스는 위험을 확정하는 표시가 아니라 직접 확인할 후보예요.</li>
          <li>물기와 미끄러움, 물건의 높이와 안정성, 전기설비 손상은 사진만으로 확정할 수 없습니다.</li>
          <li>홈캠은 자동 낙상 감지, 긴급 신고, 푸시 알림을 제공하지 않습니다. 촬영 기기는 충전하며 앱과 화면을 켜 두어야 해요.</li>
          <li>웹 체험판은 기본 가구 모델만 사용합니다. 전기설비 추가 점검과 실제 홈캠 연결은 Android 앱에서 지원합니다.</li>
        </ul>
        <div className="l-end">
          <h2>직접 체험해 보세요</h2>
          <div className="row cta">
            <button className="btn light" onClick={() => onStart("photo")}>사진 점검 체험하기</button>
            <button className="btn secondary" onClick={() => onStart("homecam")}>홈캠 둘러보기</button>
          </div>
        </div>
      </section>
    </div>
  );
}
