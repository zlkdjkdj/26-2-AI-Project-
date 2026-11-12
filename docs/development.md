# Android 개발 및 실행 안내

[서비스 소개](../README.md) · [홈캠 사용 안내](standalone-homecam.md) · [보안 안내](../SECURITY.md)

## 준비 환경

Node.js 20.19 이상 또는 22.12 이상과 Android 개발 환경이 필요합니다. Expo Go에는 프로젝트의 WebRTC와 ONNX 네이티브 모듈이 포함되지 않으므로 자체 Android 개발·릴리스 빌드를 사용합니다.

```bash
cd mobile
npm ci
npm test
npm run lint
npm run typecheck
```

설치 과정의 `postinstall`이 WebRTC 패치를 적용합니다. Android 빌드에는 SDK와 Java가 필요하며, 앱 서명키와 기기 데이터는 Git에 포함하지 않습니다. 모바일 위험 규칙은 `mobile/src/offlineRules.js`에 포함되어 있습니다.

## 사진 점검

최초 사용 시 사용자가 가구 모델 약 13MB와 선택적 전기 실험 모델 약 204MB를 내려받습니다. 앱은 다운로드의 SHA-256을 검증하고 모델을 기기 전용 저장소에 보관합니다. 다운로드 후 기기 내 분석은 네트워크 없이 사용할 수 있습니다. 추론 런타임은 기본 앱에 포함됩니다.

RAM 5GiB 미만 기기에서는 전기 실험 모델을 제한합니다. 사진 기반 위험 후보와 점수는 안전 인증이 아니며, 전기설비 탐지의 오탐·미탐과 기기별 실행 성능은 추가 검증이 필요합니다. 현재 앱의 이전 연결 메뉴는 후속 앱 수정에서 정리할 예정입니다.

모델과 라이브러리의 사용·재배포 라이선스를 확인하세요. 현재 YOLOv8n 가중치 메타데이터에는 AGPL-3.0이 명시되어 있습니다.
