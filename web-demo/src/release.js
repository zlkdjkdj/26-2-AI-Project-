// 배포용 APK 정보. 값은 3차 빌드(2026-11-24) APK를 직접 확인한 결과다.
// url은 파일을 올린 뒤 VITE_APK_URL로 지정한다(예: GitHub Release 자산 주소). 비어 있으면 버튼이 비활성화된다.
export const release = {
  name: "앗차차 홈캠",
  version: "1.3.14",
  versionCode: 21,
  size: "약 90MB",
  minAndroid: "Android 7.0 이상 · arm64",
  sha256: "36d0286796f879678f424d8149ec0ced9c34e78d5ad1eed5783d1d9eb3c9a0b1",
  signing: "개발용(debug) 인증서",
  url: import.meta.env.VITE_APK_URL || "",
};
