# 앗차차 — 생활공간 안전점검

**사진 촬영 → 실제 객체 분석 → 부분별 개선 피드백 → 정리 후 재촬영**으로 이어지는 웹 MVP입니다. 폴더의 「인공지능 프로젝트 과제」 PDF를 기준으로 FastAPI·SQLite·React를 구성했습니다. 프론트는 밝은 중립색, 여백, 큰 타이포그래피와 파란색 버튼을 사용하는 Apple 스타일입니다.

현재 기본 설정은 **YOLOv8n + Grounding DINO 전기설비 분석 + Gemini 3.1 Flash-Lite 설명**입니다. Mock은 개발 테스트를 위해 서버 환경변수로 명시한 경우에만 동작합니다. 실제 모드에서 모델 오류가 발생해도 Mock 결과로 대체하지 않습니다.

## 현재 환경에서 사용

의존성, 일반 객체·전기설비 ONNX 모델, Gemini 키 설정과 서버 연결을 완료했습니다.

- 앱: http://localhost:5173
- API 문서: http://localhost:8000/docs
- 상태 확인: http://localhost:8000/api/health

첫 화면에서 사진을 촬영/선택하고 대상자와 공간을 지정한 뒤 피드백을 받으세요. **테스트 사진으로 체험하기** 또는 **예시 이미지로 체험하기**는 실제 COCO 실내 사진을 업로드하고 동일한 실제 모델을 실행합니다. 사진 박스나 객체 칩을 누르면 해당 부분의 이유·예상 사고·정리/재배치·보완 방법을 확인할 수 있습니다.

**정리한 뒤 다시 촬영하기**를 누르면 대상자·공간을 유지하고 새 사진을 분석해 이전 기록과 자동 비교합니다. 같은 사진을 다시 올리면 같은 추론 결과를 사용합니다. 자동으로 위험이 감소하는 시나리오는 사용하지 않습니다.

## 서버 실행 관리 (Linux)

프로젝트 루트에서:

```bash
python3 scripts/dev.py start
python3 scripts/dev.py status
python3 scripts/dev.py stop
```

서버는 채팅 터미널과 분리한 프로세스로 실행합니다. 로그는 `.run/backend.log`, `.run/frontend.log`에 저장하며, `stop`은 이 스크립트가 시작한 프로세스만 종료합니다. PC 재부팅 후에는 `start`를 실행하세요. `.env`를 바꾸면 `stop` 후 `start`로 재시작해야 합니다.

## 다른 PC에 설치

Python 3.11 이상, Node.js 20.19 이상 또는 22.12 이상이 필요합니다. 검증 환경은 Linux / Python 3.14 / Node 24입니다.

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
cd ..
python3 scripts/setup_model.py
python3 scripts/setup_electrical_model.py
cd frontend
npm ci
cp .env.example .env
cd ..
python3 scripts/dev.py start
```

`requirements.lock.txt`는 검증한 전체 Python 버전을 기록합니다. 다른 Python 버전에서는 `requirements.txt`로 호환 버전을 설치하세요. 일반 객체 모델은 약 13MB, 전기설비 모델은 약 204MB이며 고정 버전·SHA-256을 검증합니다. 기존 파일의 체크섬이 맞으면 다시 다운로드하지 않습니다.

Windows/macOS에서는 각각 두 터미널에서 직접 서버를 실행하세요. Windows 가상환경 활성화는 `.venv\Scripts\activate`, 환경파일 복사는 `copy`입니다.

```bash
# 백엔드 폴더에서 가상환경 활성화 후
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

```bash
# frontend 폴더에서
npm run dev
```

## Gemini 설정

API 키는 **backend/.env에만** 저장합니다. 프론트 환경변수·소스 코드·채팅·Git에 키를 넣지 마세요.

```dotenv
DETECTION_MODE=yolo
YOLO_MODEL_PATH=models/yolov8n.onnx
YOLO_CONFIDENCE=0.35
ELECTRICAL_DETECTION_ENABLED=true
ELECTRICAL_MODEL_DIR=models/grounding-dino
ELECTRICAL_BOX_THRESHOLD=0.35
LLM_PROVIDER=gemini
GEMINI_API_KEY=본인의_키
GEMINI_MODEL=gemini-3.1-flash-lite
```

실제 Gemini `generateContent` REST API를 호출합니다. **위험 설명 생성에서는** 원본 사진·이메일·이름·좌표는 보내지 않고, 사용자 **유형**, 공간 **유형**, DB의 위험 설명·예상 사고·개선 문구만 전송합니다. Gemini는 객체탐지·등급·점수를 결정하지 않습니다. 키가 없거나 제한/연결 오류/차단/불완전 응답이면 **설명만** DB 문구로 전환하고 화면에서 설명 모드를 구분합니다. YOLO는 계속 실제 사진을 분석합니다.

`/api/health`에서 설명 제공자, 모델명, 키 설정 여부만 확인할 수 있으며 키 자체는 반환하지 않습니다. 이 작업에서 사용자 키로 실제 Gemini 응답을 확인했습니다.

[Gemini 3.1 Flash-Lite 공식 가격표](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.1-flash-lite)에 무료 입력/출력 등급이 제공됩니다. 프로젝트별 요청 제한과 사용 가능 모델은 [AI Studio](https://aistudio.google.com/)에서 확인하세요. 무료 등급 데이터는 제품 개선에 사용될 수 있으므로 이 서비스는 사진 원본을 Gemini에 보내지 않도록 구성했습니다. 유료 등급 프로젝트라면 사용 요금이 발생할 수 있습니다.

선택적으로 `LLM_PROVIDER=openai`, `OPENAI_API_KEY`, `OPENAI_MODEL`을 설정할 수도 있습니다.

## 실제 분석의 범위와 점수

- **YOLOv8n / COCO 80종** 모델이 원본 사진에서 객체·Bounding Box·탐지 신뢰도를 계산합니다. CPU와 OpenCV DNN을 사용하며 PyTorch/GPU 설치가 필요하지 않습니다.
- 칼·가위: 사진에 도구가 보인다는 사실을 규칙에 전달합니다. 실제 손이 닿는 높이라고 확정하지 않습니다.
- 의자·소파·테이블·침대: 가구 존재 또는 사진 하단 중앙의 위치를 확인 항목으로 매칭합니다. 실제 이동 통로 침범·통로 폭은 조건부로 안내합니다.
- 가방·배낭·여행 가방: 사진 하단 중앙에 탐지되는 경우 실제 통로인지 확인하도록 안내합니다.
- 병을 세제로, 가구를 날카로운 모서리로 자동 변환하지 않습니다.
- **전선·콘센트·멀티탭**은 별도의 Grounding DINO tiny ONNX 모델이 로컬 CPU에서 탐지합니다. 각 종류를 첫 번째 대상 문구로 지정해 세 번 분석하고, 약한 작은 콘센트 후보는 주변을 확대해 재검증합니다. 같은 물건의 겹치는 분류는 가장 높은 모델 점수를 남기며, 점수 차가 작으면 종류 확인 필요를 표시합니다. 안전 분석용 원본 사진을 Gemini로 보내지 않습니다. 별도의 인테리어 사진 편집은 아래 동의·활성화 조건을 따릅니다.
- 전선의 사진 아래쪽 위치, 콘센트·멀티탭의 존재를 DB 규칙에 연결합니다. **실제 접근 높이·통로·물기·과부하·손상**은 확정하지 않습니다. 바닥 물기·손잡이·문턱 등은 직접 점검으로 확인합니다.
- 현재 로컬 CPU에서 전기설비 단계는 사진당 약 16~25초를 확인했습니다. Gemini 설명과 요청 대기 시간을 고려해 웹 요청 제한은 90초입니다. 여러 요청의 전기설비 추론은 모델 실행 잠금으로 직렬 처리합니다.
- 탐지 점수는 정답 확률이 아니며 작은 물건·가려짐·촬영 각도에 따라 누락·오분류가 가능합니다. 작은 후보의 확대 재검증과 분류 비교는 검출 개선 방법이며 일반 환경의 정확도를 보장하지 않습니다.

공간 **자동 확인**은 신뢰도 0.6 이상 객체(변기, 냉장고/오븐, 침대, 소파/TV)에 따른 **규칙 기반 추정**입니다. 별도 공간 분류 모델의 확률이 아니며, 결과에 `(추정)`을 표시합니다. 추정하기 어려우면 공간을 직접 선택하도록 요청합니다.

새 점검 점수는 `max(0, 100 - 고위험×25 - 중위험×12 - 저위험×5)`입니다. 위험이 하나라도 있으면 최대 80점, 고위험이 1개면 최대 60점, 2개 이상이면 최대 40점으로 제한합니다. 이는 보수적인 서비스 기준이며 검증된 사고 확률이 아닙니다. 기존 점검은 이전 기준(15/7/3)을 보존하고 **최신 점수 기준 적용하기** 버튼으로 저장된 위험만 재계산합니다. 서로 다른 기준의 점수 차이는 비교하지 않습니다. 현재 모델/규칙에서 매칭된 항목에 한정한 **참고값**입니다. 규칙과 매칭된 항목이 없으면 `safety_score=null`과 `score_computable=false`를 반환하고 **점수 보류**를 표시합니다. 탐지되지 않았다고 안전이 확인된 것은 아닙니다.

완료 체크 자체는 점수를 바꾸지 않습니다. 점수는 새 사진으로 재점검할 때 다시 계산합니다. 비교는 객체 종류·조건 집합과 개수 기준이며 같은 개별 객체를 추적하는 기능은 없습니다. 사진 각도·가림·탐지 오차만으로 결과가 달라질 수 있습니다. 실제 분석과 과거 Mock 기록 간 비교는 거절합니다.

## 이미지 보관

기본값은 저장 안 함입니다. 요청 처리 동안만 분석하고, 결과·이력·객체 좌표만 DB에 저장합니다. 같은 결과 화면에서는 브라우저의 사진 미리보기를 유지하지만 이력 재열기에는 사진이 보이지 않습니다.

**사진 보관 설정**에서 동의하면 EXIF를 제거한 JPEG를 `backend/data/uploads/`에 저장합니다. 이미지 비동의 상태에서도 원본을 서버에 업로드해 분석하는 처리는 필요합니다. Gemini로 사진 원본은 보내지 않습니다.

## 스마트폰 접속

PC와 휴대폰을 같은 Wi-Fi에 연결하세요. 프론트 `.env`의 `VITE_API_BASE_URL`은 비워두고 서버를 실행합니다. 휴대폰에서 `http://PC의LAN-IP:5173`에 접속하면 Vite가 `/api`와 `/uploads` 요청을 PC 백엔드로 전달합니다. 휴대폰의 localhost를 백엔드 주소로 사용하지 않습니다. 필요한 경우 방화벽에서 5173 포트를 허용합니다. 배포 시에도 동일 출처 리버스 프록시를 구성하거나 HTTPS API 주소를 설정하세요.

촬영 버튼은 `capture="environment"` 파일 입력입니다. 브라우저에 따라 카메라 또는 파일 선택 화면이 열립니다. HEIC는 JPG/PNG/WebP로 변환해야 합니다. 실제 휴대폰 카메라 동작은 기기별 확인이 필요합니다.

## 구조

```text
backend/
  app/main.py          FastAPI, 이미지 검증, 분석·이력·비교 API
  app/config.py        서버 환경변수
  app/models.py        요청·대상자·공간 타입
  app/db.py            SQLite, 기존 DB 마이그레이션
  app/seed.py          RiskRule: 실제 관찰 규칙 + 향후 위험 규칙
  app/detection.py     YOLO ONNX 추론, NMS, 좌표, 조건·공간 추정
  app/risk.py          DB 매칭과 점수 (LLM이 변경하지 않음)
  app/explanation.py   Gemini / OpenAI 설명, DB 안내 전환
  models/yolov8n.onnx  실제 모델 (자동 설치, Git 제외)
  tests/               모델·API·DB·설명·오류 테스트
frontend/
  src/App.jsx          사진 촬영 → 부분 피드백 → 재점검 → 이력
  src/api.js           실제 REST 연동, 타임아웃·오류 처리
  src/styles.css       Apple 스타일 반응형 UI
  public/sample-room.jpg 실제 추론 시연 사진
scripts/
  dev.py               서버 시작·중지·상태
  setup_model.py       체크섬 검증 모델 다운로드
docs/
  requirements.md      PDF 요구사항 대응
  verification.md      검증 결과
  screenshots/         화면 미리보기
```

모델: [YOLOv8n ONNX 배포 파일](https://huggingface.co/webml/yolov8n/blob/main/onnx/yolov8n.onnx), [Ultralytics 객체탐지 문서](https://docs.ultralytics.com/tasks/detect), [공식 OpenCV ONNX 추론 예제](https://github.com/ultralytics/ultralytics/blob/main/examples/YOLOv8-OpenCV-ONNX-Python/main.py). 모델은 Ultralytics 모델 라이선스를 따릅니다. 테스트 사진은 [COCO 2017](https://cocodataset.org/)의 `val2017/000000000139.jpg`로, 원본 이미지의 사용 조건은 COCO의 출처 정책을 따릅니다. 제품 출시 전 모델·이미지 라이선스를 확인하세요.

## API

| 메서드 | 경로 | 기능 |
| --- | --- | --- |
| GET | `/api/health` | 모델 준비·설명 제공자·모델·키 설정 여부 |
| GET | `/api/options` | 대상자·공간 종류 |
| GET, POST | `/api/targets` | 대상자 목록/등록 |
| GET, POST | `/api/spaces` | 공간 목록/등록 |
| POST | `/api/analyze/image` | 실제 사진 분석, 결과 저장 |
| POST | `/api/scans` | 이미지 분석 API 별칭 |
| GET | `/api/scans` | 최근 이력, limit 1~100, 기본 30 |
| GET | `/api/scans/{id}` | 결과·객체·피드백 |
| GET | `/api/scans/{id}/hazards` | 매칭 항목 |
| PATCH | `/api/hazards/{id}/resolution` | 완료 체크 `{"resolved":true}` |
| POST | `/api/scans/{id}/compare` | 비교 `{"previous_scan_id":1}` |
| POST | `/api/scans/{id}/rescore` | 저장된 위험을 최신 기준으로 재계산 |
| GET, PATCH | `/api/scans/{id}/interior` | 컨셉·가상 가구 배치 조회/저장 |
| POST | `/api/scans/{id}/interior/preview` | 동의한 원본 사진 편집, 현재 비활성 |

이미지 분석은 multipart `file`, `target_type`, `space_type=auto|living_room|…`, 선택적 `space_name`, `save_image`, `target_id`, `space_id`를 받습니다. `scenario`는 실제 모드에서 무시되며 결과에는 `actual`로 기록됩니다. 좌표는 정규화 `[x,y,width,height]`입니다.

```bash
curl -X POST http://localhost:8000/api/analyze/image \
  -F 'file=@frontend/public/sample-room.jpg' \
  -F 'target_type=elderly' \
  -F 'space_type=auto' \
  -F 'space_name=우리집' \
  -F 'save_image=false'
```

파일 오류 400/415/422, 크기·해상도 초과 413, 없는 기록 404, 모델/DB 오류 503을 반환합니다. 오류 시 가짜 결과를 저장하지 않습니다.

## 검증

```bash
cd backend
source .venv/bin/activate
pytest -q
```

```bash
cd frontend
npm run build
```

테스트는 임시 DB를 사용하고 외부 설명 API는 모의 HTTP로 검증합니다. 실제 ONNX 모델 테스트도 포함하므로 `setup_model.py`와 `setup_electrical_model.py`를 먼저 실행하세요. 동일 사진 재분석, 빈 사진의 점수 보류, 모델 누락 시 503, 실제/Mock 비교 거절, 좌표 범위, Gemini 성공·쿼터·차단·불완전 응답, 기존 DB 마이그레이션을 확인합니다. 사용자 키를 쓰는 실제 외부 호출은 수동 통합 검증으로 별도 확인했습니다.

## 남은 범위

현재는 단일 사용자 로컬 MVP입니다. 인증·다중 사용자 격리·이미지 접근 제어·삭제 정책은 아직 구현하지 않았습니다. 후속 작업은 다양한 가정의 라벨 데이터로 모델 정확도 검증·추가 학습, 실제 공간 조건 추출, 검증된 위험 기준, Flutter 앱, 모바일 백그라운드 활동·위치 및 푸시 알림입니다. 웹 생활 확인 API에는 별도 소유자·보호자 접근키가 있지만 일반 점검 API는 아직 단일 사용자 구조입니다. 공개 배포 전 사용자 인증과 기록 격리를 구현해야 합니다.

## 모바일 앱 개발 방향

현재 실행 대상은 React 웹 MVP입니다. 최종 목표는 Android APK 앱이며, 추후 `mobile/`에 Flutter 앱을 분리하고 기존 FastAPI API를 공유할 예정입니다. 현재 Flutter 앱이나 APK 산출물은 생성하지 않았습니다. 웹 분석 흐름을 먼저 검증합니다. Gemini 키는 백엔드 환경변수에만 보관하며 웹 또는 APK에 포함하지 않습니다.

**이미지 AI 분석과 위험 판정은 서버에서 수행합니다.** 웹과 향후 Flutter APK는 사진 촬영/선택, HTTPS 업로드, 분석 진행 상태, 결과 박스·설명 표시를 담당합니다. YOLO·Grounding DINO 가중치, 위험 DB, Gemini API 키는 APK에 넣지 않습니다. APK에서 DB에 직접 접속하지 않습니다.

```text
Flutter Android APK (촬영·업로드·결과 표시)
  → HTTPS /api/analyze/image
  → FastAPI 서버
      → 이미지 검증·EXIF 제거
      → 서버 YOLO + Grounding DINO 추론
      → 서버 위험 규칙 조회·점수 계산
      → 서버 Gemini 설명 생성 (원본 사진 전송 없음)
      → 결과 JSON + 정규화된 Bounding Box
  → APK에서 원본 화면에 결과 표시
```

현재 서버는 개발 PC의 FastAPI/Uvicorn(8000), 웹은 Vite(5173)입니다. DB는 `sqlite3` 직접 연동의 `backend/data/atchacha.db` 파일이며 별도 PostgreSQL/Oracle DB 서버가 아닙니다. 대상자·공간·스캔·위험·개선안·직접 점검·가이드 완료·웹 생활 확인을 저장합니다. 원본 보관은 기본 꺼짐이며, 동의한 사진만 EXIF 제거 후 `backend/data/uploads/`에 저장합니다. PC를 끄면 서비스도 중단됩니다.

APK 외부 사용에는 항상 접속 가능한 HTTPS 운영 API가 필요합니다. AWS·Oracle Cloud 등 특정 업체는 필수가 아니며, AI를 실행할 컴퓨팅 서버와 영구 저장소가 필요합니다. DB 자체는 이미지 분석을 하지 않습니다. 소규모 비공개 단일 서버 시범 운영은 SQLite로 가능하지만, 다중 사용자 정식 출시에는 PostgreSQL 전환을 권장합니다. 현재 SQLite 전용 SQL과 연결 코드를 사용하므로 환경변수 변경만으로 PostgreSQL/Oracle DB로 전환되지 않습니다. 별도 마이그레이션·연결 코드·동시 요청 검증이 필요합니다.

배포 후보는 AWS 컴퓨팅 + PostgreSQL(RDS 또는 자체 운영) + 이미지 객체 저장소, 또는 Oracle Cloud 컴퓨팅 + PostgreSQL입니다. Oracle Cloud 사용이 Oracle Database 사용을 의미하지 않습니다. 공개 출시 전에는 사용자 로그인·기록별 접근 권한, 저장 사진의 비공개 접근, HTTPS·백업·삭제 정책, 추론 대기열과 상태 조회를 구현해야 합니다. 현재 단일 사용자 점검 API와 `/uploads` 정적 제공은 공개 서비스용 권한 구조가 아닙니다. 추론 지연과 동시 요청 부하를 측정한 뒤 서버 크기와 GPU 필요 여부를 정합니다.



## 추가된 웹 기능

결과 화면의 **사진 피드백 / 인테리어 가이드 / 직접 점검**에서 사용할 수 있습니다.

- 인테리어 가이드: 미니멀 화이트 / 내추럴 우드 / 소프트 모던 / 편안한 동선 중 컨셉을 선택하고 컬러 예시를 확인합니다. 탐지된 가구를 가상 배치도에서 드래그하거나 좌표·회전 입력으로 조정하고 서버 DB에 저장합니다. 초기 위치·크기는 예시이며 사진에서 평면도를 복원하거나 실제 통로 폭을 측정하지 않습니다. 기존 정리→재배치→보완 안내와 완료 체크도 제공합니다. 실제 사진 편집 API는 구현했지만 현재 유료 호출 금지에 따라 비활성입니다. 컬러 예시는 실제 사진 편집 결과가 아닙니다.
- 위험규칙 1,293개: 문턱, 손잡이, 가구 고정, 블라인드 끈, 작은 부품, 약품, 멀티탭 상태, 손 끼임, 뜨거운 음료, 욕조의 남은 물 등 추가. 신생아의 부드러운 침구·침대 주변 끈·끼임·높은 기저귀 교환 위치와 노약자의 침대 주변 조명·불안정한 의자·이동 지지 부족·단차 등 12개 직접 확인 항목을 추가했습니다. 가구 모서리는 충격 흡수 몰딩·보호대를 단단히 고정하도록 안내하며 아기 침대 범퍼를 권장하지 않습니다. 근거는 [CPSC](https://www.cpsc.gov/Safety-Education/Safety-Education-Centers/cribs)와 [CDC](https://www.cdc.gov/steadi/patient-resources/index.html) 자료를 점검 항목에서 연결합니다. 규칙 수와 모델 학습 클래스 수는 다릅니다.
- 직접 점검: 위험 있음 / 해당 조건 없음 / 미확인과 메모를 저장합니다. 사진 점수는 유지하고 사진+현장 확인 위험을 합산한 별도 종합 참고점수를 제공합니다. 미확인은 안전이나 개선 완료가 아닙니다.
- 주의·위험 위치: DB 확인 항목 박스의 색을 표시합니다. 나머지 사진 영역은 미평가이며 녹색 안전구역으로 만들지 않습니다.
- 이력 검색·대상자 필터, 직접 점검 전후 상태 비교, 인쇄 가능한 HTML 보고서 다운로드.
- 웹 생활 확인: 기본 비활성. 동의 후 클릭·키 입력 시간 및 서버 연결을 기록합니다. 약 1시간 위치 기록은 별도 동의·권한이 있고 화면이 열려 있는 경우에만 시도합니다. 마지막 위치만 보관하고 중지하면 좌표를 제거합니다. 위치는 AI와 보호자 화면에 제공하지 않습니다.
- 확인 시간(한국 시간)과 미활동 기준을 설정합니다. 서버가 1분 주기로 상태를 평가하며 3분 연결 끊김과 장시간 웹 미활동을 구분해 안내를 저장합니다. 같은 상태의 안내는 중복 생성하지 않습니다. **휴대폰 전체 활동 감지·앱 종료 후 지속 관찰·문자/푸시 전송은 구현하지 않았습니다.**
- 보호자 확인 링크는 상태·안내 열람 전용 접근키를 URL fragment에 포함하며, 소유자 기록·위치 조회 권한과 구분됩니다. 로컬 네트워크 밖에서는 공개 HTTPS 배포가 필요합니다. 링크를 전달할 때는 확인할 보호자에게만 공유하세요.

위치 API는 [MDN Geolocation 문서](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)의 권한·보안 컨텍스트 제한을 따릅니다. 브라우저 절전·백그라운드의 타이머 제한은 [Page Visibility 문서](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)를 참고하세요.

### 추가 API

- `GET /api/risk-catalog?target_type=elderly&space_type=living_room`
- `PATCH /api/scans/{id}/field-checks` — `{ "items": [{ "key": "electric_wire", "status": "risk", "note": "현장 확인" }] }`
- `PATCH /api/scans/{id}/guide-tasks` — `{ "key": "check:electric_wire", "completed": true }`
- `GET /api/scans/{id}/report?format=html` — HTML 보고서 (`format=json`은 구조화 데이터).
- `POST /api/care/sessions`, `GET /api/care/status`, `POST /api/care/heartbeat`, `POST /api/care/stop`
- `GET /api/care/guardian` — 보호자 전용 읽기. 나머지 생활 확인 API는 소유자 Bearer 토큰을 요구합니다.

### 탐지 정확도 개선에 필요한 자원

추가 API 키 없이 로컬 모델을 사용합니다. 모델·전처리기는 [Grounding DINO ONNX 배포](https://huggingface.co/onnx-community/grounding-dino-tiny-ONNX)의 Apache-2.0 라이선스와 고정 revision을 사용합니다. 설치 파일은 추론 데이터이며 원격 Python 코드를 실행하지 않습니다.

출시 정확도를 검증하려면 다양한 방, 조명, 촬영 거리, 전선 색상, 멀티탭 형태, 가려진 장면 및 물건이 없는 장면을 모아 전선·콘센트·멀티탭 박스를 라벨링해야 합니다. 학습 사진과 평가 사진을 분리해 종류별 precision/recall과 IoU를 측정해야 합니다. 현재 소수의 회귀 사진 검증은 전체 정확도 평가가 아닙니다. 추가 학습 단계에는 GPU 또는 GPU 학습 서비스가 필요할 수 있으며, 아직 별도 GPU·유료 API를 요청하지 않습니다.


## 공개 이미지 참고 자료와 저부하 보조 학습

공개 이미지와 기존 위치 라벨을 참고 자료로 보관합니다. 사용자 허용 범위에서 작은 보조 분류기만 학습했습니다. PyTorch/GPU 설치, YOLO·Grounding DINO 재학습, 자동 반복 추론, 예약 학습·수집 작업은 실행하지 않습니다. 사진 업로드 때 기존 서버 탐지 모델을 실행하는 흐름은 유지합니다. 사용자 점검 사진을 참고 데이터로 자동 수집하지 않습니다.

참고 자료는 `datasets/reference/`에 저장하며 압축 파일·이미지·라벨을 포함한 폴더 전체에 **3,000,000,000 bytes** 제한을 적용합니다. 이미지는 파일로, 출처·CC BY 4.0 라이선스·저자·파일 경로·해시·객체 위치는 별도 `catalog.sqlite3` DB에 저장합니다. 서비스의 위험규칙 DB와 구분하며, 자료는 일반 사용자 사진 URL이나 API로 노출하지 않습니다.

소스: [Indoor Power Sockets and Light Switches 데이터셋](https://zenodo.org/records/18835199), DOI 10.5281/zenodo.18835199, Arzoumanidis 등, CC BY 4.0. 콘센트·멀티탭·스위치의 공개 라벨이며 전선 클래스는 포함하지 않습니다. 원본 출처와 변형 이미지가 섞여 있어 라벨과 중복을 추가 검토해야 합니다. 객체가 있다는 라벨은 위험 상태를 증명하지 않습니다.

```bash
backend/.venv/bin/python scripts/collect_reference_data.py
backend/.venv/bin/python scripts/index_reference_data.py
```

수집기는 소스 라이선스, 고정 MD5, 파일 크기, 압축 경로와 해제 용량을 검사합니다. 인덱스는 사진을 모델에 넣지 않고 이미지 크기·라벨·해시만 읽으며 반복 실행해도 레코드가 중복 생성되지 않습니다. 실제 수량과 용량은 `docs/reference-data.json`에 기록합니다. 원래 소스의 train/test/valid 구분은 출처 정보일 뿐, 이 프로젝트의 학습·평가를 실행한 결과가 아닙니다.

**참고 이미지를 저장하는 것만으로 모델의 정확도가 향상되지 않습니다.** 현재 개선된 전선 탐지는 서버 모델·분석 방식의 변경 결과입니다. 참고 자료는 추후 사람이 오인식 유형을 확인하거나 별도로 허가한 평가/학습을 준비할 때 사용할 수 있습니다.


### 제한된 CPU 보조 학습 결과

`train_reference_verifier.py`는 공개 라벨에서 최대 540개 객체 부분을 읽고 64×64 HOG·색상 특징으로 작은 선형 분류기를 학습합니다. CPU 1 스레드, 학습·특징 추출 60초 중단 기준을 적용합니다. 데이터 다운로드나 GPU가 필요하지 않으며 자동으로 학습을 반복하지 않습니다. 현재 425개 학습 / 55개 검증 / 60개 테스트를 사용했고, 원본 이름 변형과 파일 해시 중복을 묶어 분리했습니다. 이름이 같은 다른 원본은 과하게 묶일 수 있고 시각적 유사 이미지 전체가 분리됐다는 보장은 없습니다.

```bash
backend/.venv/bin/python scripts/train_reference_verifier.py
```

2026-10-01 실행은 약 7.22초, 모델 12.8KB였습니다. 테스트 부분 이미지의 종류 분류 정확도는 76.67%이며 **전체 사진의 객체 탐지 정확도가 아닙니다**. 그래서 탐지 종류·위치·위험점수를 바꾸거나 위험 객체를 제거하지 않습니다. 검증 기준을 통과한 모델을 서버에서 기존 콘센트/멀티탭 박스에만 적용하고, 보조 분류 점수가 0.9 이상인데 의견이 다르면 종류 확인 필요를 표시합니다. 점수는 보정된 확률이 아닙니다. 전선은 이 보조 모델의 학습 클래스가 아닙니다.

작은 콘센트를 포함한 사용자 사진과 별도 멀티탭 사진의 잘린 부분을 확인했을 때, 보조 분류 점수는 기준 미만이라 원래 결과를 바꾸지 않았습니다. 사용자 사진은 학습에 사용하지 않았습니다. 효과가 검증된 새로운 객체 탐지 모델을 학습했다는 주장은 하지 않습니다. 자료와 학습 결과는 `docs/reference-data.json`, `docs/reference-verifier-evaluation.json`, 참고 DB의 `verifier_runs`에 남깁니다.

백엔드 `/api/health`의 `reference_verifier`가 적용 준비 여부를 표시합니다. 서버 가중치는 `backend/models/reference_verifier.npz`이며 `REFERENCE_VERIFIER_ENABLED=false`로 보조 검사를 끌 수 있습니다. 파일이 없거나 손상되어도 기존 탐지 결과를 유지합니다. 전기설비 추론은 요청할 때만 실행하고 `ELECTRICAL_CPU_THREADS=2` 기본값으로 CPU 점유 스레드를 제한했습니다. 이는 작업량·전력의 엄격한 상한을 보장하지 않으며 시간은 PC 상태에 따라 달라집니다.

## 실제 인테리어 사진 편집의 상태

Gemini 이미지 편집은 서버에서만 수행하도록 연결했습니다. 현재 `.env`의 `INTERIOR_IMAGE_ENABLED=false`로 **유료 생성 호출을 차단**합니다. 실제 사진 편집 이미지는 생성하지 않았으며, 테스트는 모의 HTTP 응답으로 요청·응답 처리, 원본 일치, 동의 확인, 오류 및 점수 보존을 검증했습니다.

설정 항목은 `.env.example`의 `GEMINI_IMAGE_MODEL=gemini-3.1-flash-lite-image`, 선택적 `GEMINI_IMAGE_API_KEY`입니다. 기존 Gemini 키를 서버에서 사용할 수 있으나 모델 접근·결제·쿼터는 별도 조건입니다. [공식 가격표](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.1-flash-lite-image)상 무료 등급이 없으므로 사용자 요청대로 활성화하지 않습니다.

활성화된 경우에도 명시적인 사진 전송 동의와 생성 버튼 클릭이 필요합니다. 컨셉 선택이나 배치 조정만으로 호출하지 않습니다. 원본은 해당 점검의 사진과 일치해야 하며 개인정보 메타데이터 제거 후 외부 Gemini API에 전송합니다. 결과는 현재 화면에서만 표시하고 원본·생성 사진을 새로 영구 저장하지 않습니다. 사진에 적용된 모습은 제안일 뿐 실제 개선 완료나 안전점수 상승의 근거가 아닙니다.

## GitHub 업로드 전 확인

실제 키, `.env` 변형 파일, 점검 DB·사진, 개인 화면 캡처·원본 기획 PDF, 로그, 모델·참고 데이터와 모바일 서명키는 `.gitignore`로 제외합니다. 설정 예시·소스·설치 스크립트·의존성 잠금 파일은 유지합니다.

```bash
python3 scripts/check_publication.py
```

Git 저장소 생성 후에는 `git add --dry-run .`으로 추가 예정 목록도 확인하세요. 이미 추적된 파일은 `.gitignore`만으로 제거되지 않습니다. GitHub 웹에 폴더나 ZIP을 직접 업로드하면 제외 규칙이 자동 적용되지 않습니다. 점검 범위와 운영 배포 전 인증·사진 접근 제어 등 남은 위험은 [SECURITY.md](SECURITY.md)에 정리했습니다.
