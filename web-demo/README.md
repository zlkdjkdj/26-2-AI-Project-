# 앗차차 웹 체험판 (web-demo)

모바일 앱(`../mobile`)과 별개로 작업하는 브라우저 체험판입니다. `mobile`은 수정하지 않습니다.

- **사진 안전점검**: 사진을 브라우저 안에서 분석합니다(서버 전송 없음). YOLOv8s ONNX를 `onnxruntime-web`(WASM)으로 실행하고, 전·후처리는 앱의 `OfflinePhotoDetector.java`를 `src/yolo.js`로 옮겼습니다.
- **규칙·점수·피드백**: `../mobile/src`의 순수 JS(`offlineSafety`, `furnitureReconciliation`, `scanFeedback`, `offlineRules`)를 `@shared` 별칭으로 그대로 가져옵니다. 앱과 결과가 어긋나지 않습니다.
- **홈캠 체험(D)**: 샘플 영상과 가짜 QR로 화면 흐름만 보여 주는 시연 모드입니다. 실제 WebRTC 연결·녹화는 없습니다. “내 카메라 미리보기”는 로컬 표시 전용입니다.

## 실행

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 전·후처리 단위 테스트
npm run build    # dist/ (정적 호스팅용)
```

모델(약 45MB)은 첫 사용 때 내려받아 SHA-256을 확인한 뒤 브라우저 Cache Storage에 저장합니다.

## 배포 전 확인

- **모델 라이선스**: YOLOv8s 가중치는 AGPL-3.0입니다. 공개 전에 라이선스 방침을 정하세요.
- **모델 호스팅**: 기본값은 Hugging Face 고정 커밋입니다. 자체 CDN을 쓰려면 `VITE_MODEL_URL`을 지정하고 CORS를 허용하세요(파일 해시는 동일해야 합니다).
- **HTTPS 필수**: `crypto.subtle`, Cache Storage, 카메라 API는 보안 컨텍스트(HTTPS 또는 localhost)에서만 동작합니다.
- **하위 경로 배포**: `VITE_BASE=/경로/ npm run build`.
- **속도**: 기본은 단일 스레드 WASM입니다. COOP/COEP 헤더로 cross-origin isolation을 켜면 멀티 스레드를 쓰도록 되어 있습니다. 개발 PC에서 샘플 사진 1장은 약 6초였으며, 모바일 기기 속도는 아직 측정하지 않았습니다.
- 전기설비 추가 모델(Grounding DINO)은 체험판에 포함하지 않았습니다.

## 평가하기 탭

평가는 구글폼으로 받습니다. 사이트의 "평가하기" 탭에서 안내를 보고 버튼을 누르면 구글폼이 새 탭으로 열립니다.

- 질문: 이름(필수), 전체 만족도 1~5(필수), 이용 후기(필수). 폼 첫 화면에 개인정보 수집·이용 안내가 있고, 제출하면 동의한 것으로 봅니다.
- 응답은 폼을 만든 구글 계정에 쌓이고, 새 응답이 오면 그 계정의 메일로 알림이 갑니다(폼의 응답 탭에서 설정).
- 폼 주소는 `src/feedback.config.js`의 `formUrl`입니다. 다른 폼으로 바꾸려면 이 값을 고치거나 빌드할 때 `VITE_FEEDBACK_FORM_URL`로 지정하세요.
- 폼 설명의 개인정보 안내를 고치면 `src/feedback.config.js`의 `notice`도 같은 내용으로 고치세요.
