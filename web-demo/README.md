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
