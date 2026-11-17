// 외부 아이콘 라이브러리 없이 쓰는 최소 아이콘(lucide 스타일). 18px, 선 1.5, 글자색을 따른다.
const make = (paths) => function Icon({ size = 18 }) {
  return (
    <svg className="ico" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
};

export const ScanLine = make(["M3 7V5a2 2 0 0 1 2-2h2", "M17 3h2a2 2 0 0 1 2 2v2", "M21 17v2a2 2 0 0 1-2 2h-2", "M7 21H5a2 2 0 0 1-2-2v-2", "M7 12h10"]);
export const Video = make(["m16 13 5.2 3.5a.5.5 0 0 0 .8-.4V7.9a.5.5 0 0 0-.8-.4L16 11", "M3 6h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"]);
export const Lock = make(["M5 11h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z", "M8 11V7a4 4 0 0 1 8 0v4"]);
export const Download = make(["M12 3v12", "m7 11 5 5 5-5", "M5 21h14"]);
export const Menu = make(["M4 7h16", "M4 12h16", "M4 17h16"]);

// 앗차차의 표식: 탐지 박스의 네 모서리. 로고, 히어로 프레임, 사진 위 탐지 박스에만 쓴다.
export function Brackets({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true">
      <path d="M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6" />
    </svg>
  );
}

// 이미지 프레임용 모서리 표식(CSS로 그린 네 개의 ㄱ자).
export function Corners() {
  return <div className="corners" aria-hidden="true"><i /><i /><i /><i /></div>;
}
