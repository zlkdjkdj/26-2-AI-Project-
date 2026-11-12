# 개발 및 실행 안내

앗차차의 사용자 대상 소개는 [README](../README.md), 독립형 Android 홈캠의 상세 동작은 [독립 실행 홈캠](standalone-homecam.md), 보안 운영 조건은 [SECURITY.md](../SECURITY.md)를 참조하세요.

## 준비 환경

- Python 3.12, Node.js 20.19 이상 또는 22.12 이상, Git
- Android 네이티브 개발: Android SDK 및 Java. Expo Go에는 프로젝트의 WebRTC와 ONNX 네이티브 모듈이 없으므로 자체 개발·릴리스 빌드가 필요합니다.
- 사진 분석 모델 가중치, SQLite DB, 사용자 사진과 환경 파일은 Git에 포함되지 않습니다.

## PC 백엔드와 웹

```bash
git clone https://github.com/zlkdjkdj/26-2-AI-Project-.git
cd 26-2-AI-Project-
python -m venv backend/.venv
# 가상환경 활성화 후
pip install --require-hashes -r backend/requirements.lock
python scripts/setup_model.py
python scripts/setup_electrical_model.py
```

`backend/.env.example`을 `backend/.env`로 복사하고 필요한 값만 설정합니다. 기존 파일을 덮어쓰지 마세요. 모델 스크립트는 정해진 파일의 해시를 확인합니다. API 키가 없다면 규칙 기반 문구를 사용합니다.

```bash
# 터미널 1
cd backend
uvicorn app.main:app --host 127.0.0.1 --port 8000

# 터미널 2
cd frontend
npm ci
npm run dev
```

웹: `http://127.0.0.1:5173` · 서버 상태: `http://127.0.0.1:8000/api/health`

웹 API는 기본적으로 개인 시연 코드와 세션으로 보호됩니다. 모바일의 선택적 PC 사진 분석은 코드 없이 사용하는 별도 예외이며 기본적으로 비활성입니다. 필요한 경우에만 `PHOTO_TAILNET_CODELESS=true`로 켜고 서버를 Tailscale 인터페이스에 바인딩한 뒤 방화벽에서 신뢰 기기만 허용하세요. Tailscale IP 범위와 전용 헤더는 개별 사용자 인증을 대신하지 않습니다. 공용 인터넷 포트포워딩과 Tailscale Funnel로 노출하지 마세요.

## Android 앱

```bash
cd mobile
npm ci
npm test
npm run lint
npm run typecheck
```

설치 시 `postinstall`이 WebRTC 패치를 적용합니다. 빌드와 패치, 등록 방식은 [독립 실행 홈캠 안내](standalone-homecam.md)를 확인하세요. 검수용 APK 서명키와 정식 배포 서명은 별도입니다.

앱에서 최초 사용자가 동의하면 가구 모델 약 13MB, 전기 실험 모델 약 204MB를 각각 다운로드해 SHA-256을 검증합니다. 가중치는 APK와 Git에 들어 있지 않으나 추론 런타임은 기본 앱에 포함됩니다. 모델 설치 후 기기 내 사진 분석에는 인터넷이나 PC가 필요하지 않습니다.

## 제한과 검증

- 5GiB 미만 RAM 기기에서는 전기 실험 모델을 차단합니다. KEYone에서는 해당 모델이 높은 메모리를 사용해 실험을 중단했습니다.
- 사진상 후보가 없다고 안전하다는 뜻이 아닙니다. 사진에서 평가할 근거가 없다면 점수 산정을 보류합니다.
- 모바일 전기 모델은 PC 모델의 약한 후보 재검사·보조 분류를 전부 포함하지 않으며, 별도의 정확도 검증이 필요합니다.
- 사진·영상은 민감한 데이터입니다. 모델, 사진, API 키, 디버깅 로그, DB, APK와 서명키는 Git에 올리지 마세요.
- 모델 가중치와 라이브러리의 사용·재배포 라이선스를 확인하세요. 현재 YOLOv8n 가중치 메타데이터에는 AGPL-3.0이 명시되어 있습니다.
