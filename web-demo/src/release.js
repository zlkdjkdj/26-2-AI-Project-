// 배포용 APK 정보. 값은 바탕화면의 앗차차-1.3.14-시연용.apk를 직접 확인한 결과다.
// url은 파일을 올린 뒤 VITE_APK_URL로 지정한다(예: GitHub Release 자산 주소). 비어 있으면 버튼이 비활성화된다.
export const release = {
  name: "앗차차 홈캠",
  version: "1.3.14",
  versionCode: 21,
  size: "약 90MB",
  minAndroid: "Android 7.0 이상 · arm64",
  sha256: "ff8a9b4758868eaeead65a2f9554d6273c0a0a167050c0e48f6bbac699077599",
  signing: "개발용(debug) 인증서",
  url: import.meta.env.VITE_APK_URL || "",
};
