// 태블릿 전용 빌드(홈캠 모니터링·촬영만 제공)는 EXPO_PUBLIC_TABLET=1 로 번들한다.
// Metro가 빌드 시점에 값을 치환하므로 같은 소스에서 폰용과 태블릿용을 따로 만들 수 있다.
export const IS_TABLET = process.env.EXPO_PUBLIC_TABLET === "1";
