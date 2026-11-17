# GROK_WORK.md - Grok Build 작업 기록 (2026-11-12)

## 1. 작업 배경
- 이전 Claude (Codex)가 1.3.2 버전까지 작업 (person-tracking, DirectVideo 개선, WebRTC 안정화 등)
- 현재 프로젝트는 1.3.5 (versionCode 12) 기반
- 사용자 요청: 앱 실행 시 홈캠이 너무 강조되는 구조를 개선 → **홈캠과 사진 안전점검을 반반 균형 있게** 메인 화면으로 변경 (Option A)

## 2. 주요 변경사항 (이번 Grok 작업)

### 2.1 새로운 메인 선택 화면 (`src/app/index.js`)
- 기존: `index.js`가 바로 `/homecam`으로 리다이렉트
- 변경: 새로운 `ModeSelection` 화면을 메인으로 설정
- 두 개의 큰 카드를 **시각적으로 균형** 있게 배치
  - 상단 카드: **홈캠 (Live HomeCam)**
    - 실시간 영상 감시, 촬영용/모니터링용 역할 선택
  - 하단 카드: **사진 안전점검 (Photo Safety Check)**
    - 가구, 전기, 위험물 점검 기능
- 디자인 원칙: 두 기능이 동등한 중요도로 보이도록 동일한 카드 크기, 아이콘, 설명 길이 조정
- 기존 `homecam.js` (역할 선택 화면)는 그대로 유지 (홈캠 카드에서 진입)

### 2.2 생성된 파일
- `GROK_WORK.md` (본 파일): Grok이 수행한 모든 작업을 코덱스가 이해하기 쉽게 기록
- `src/app/index.js` 완전 교체 (새로운 ModeSelection 화면)
- `src/appUi.js`, `ui.js`의 기존 컴포넌트(`Page`, `PageHeader`, `Section`, `Button` 등) 최대한 재사용하여 일관성 유지

### 2.3 디자인 의도
- 사용자 입장에서 "이 앱은 뭐하는 앱인가?"를 처음에 명확히 전달
- 홈캠과 사진점검을 **동등한 주요 기능**으로 인식하게 함
- 기존에 잘 만들어진 UI 컴포넌트(`Page`, `Section`, `Button`, SUIT 폰트, 색상 시스템) 완전 준수
- 불필요한 Progress bar나 Notice는 메인 화면에서는 제거하고 기능별 화면에서만 사용

## 3. 현재 상태 (1.3.5 + Grok 변경)
- S25 설치 버전: **1.3.5 (versionCode 12)**
- 테스트 결과: 실시간 영상, 사람 추적 박스, 카메라 전환 등 핵심 기능 정상 작동 확인
- 새로운 메인 화면 적용 후 재설치 필요

## 4. 다음 추천 작업 (코덱스 또는 Grok)
- 새로운 메인 화면 실기기 디자인 검수
- 필요시 카드 디자인, 색상 대비, 애니메이션 미세 조정
- `homecam.js` 내부 Progress bar와 설명도 새로운 메인 화면 스타일과 통일 고려
- 전체 앱 흐름 문서 업데이트 (`docs/standalone-homecam.md`)

---

**작성일**: 2026-11-12  
**작성자**: Grok Build (xAI)  
**목적**: Claude(Codex)와 Grok 간 작업 인계 용도

이 파일은 계속 업데이트될 예정입니다.
