# PC 없이 사용하는 Android 홈캠

## 사람 위치 표시 (개발 중인 최신 소스)

모니터링 휴대폰의 WebRTC 수신 프레임을 기기 안에서 분석해 화면에서 가장 두드러진 사람의 대략적인 위치를 파란 박스로 표시합니다. Google ML Kit 기본 자세 모델을 앱에 포함하며, 최대 한 사람을 대상으로 합니다. 자세 랜드마크로 추정한 위치이므로 신체 일부가 가려지거나 사람이 작게 보이면 박스가 누락되거나 정확하지 않을 수 있습니다. 신원 식별, 낙상 감지 또는 긴급 알림 기능은 제공하지 않습니다.

영상 프레임은 별도 파일로 저장하거나 분석 서버에 업로드하지 않습니다. 초당 최대 네 번 분석하며, 사람의 새 위치로 박스가 부드럽게 이동합니다. 처리 중인 프레임이 있으면 다음 프레임은 건너뛰므로 실제 갱신 속도는 기기 성능에 따라 달라집니다. 결과가 1.5초 이상 갱신되지 않거나 인식이 사라지면 박스를 숨깁니다. 화면 가득 보기에서는 영상과 박스가 함께 잘립니다. 분석에 실패하면 영상은 유지하고 사람 인식 사용 불가를 표시합니다.

현재 소스는 Android 네이티브 컴파일과 기존 모듈 자동 테스트를 통과했습니다. 실제 두 휴대폰에서 인식 정확도·영상 속도·회전·재연결은 별도 확인이 필요합니다. 기존 앱에 없는 네이티브 모델이므로 향후 새 APK가 필요합니다.

## 범위와 사용법

동일 APK에서 **촬영용 공기계 / 모니터링 휴대폰**을 선택합니다. 앱 코드가 APK에 포함되므로 PC·Python API·Metro·Expo Go가 필요하지 않습니다. 두 휴대폰의 Tailscale은 필요하며 외부 조정·중계 인프라는 계속 사용합니다. 완전한 오프라인 시스템은 아닙니다.

공기계는 충전하고 앱을 전면에 띄워 화면을 켜 둡니다. 잠금·백그라운드 촬영, 오디오, 녹화, 낙상 감지는 이번 범위에서 제외합니다. 기존 사진 안전점검과 PC 웹 홈캠은 메뉴에 유지하며 **기존 PC 백엔드가 필요**합니다.

1. 두 Android 휴대폰에 동일 APK를 설치하고 Tailscale을 같은 계정 또는 서로 접근할 수 있는 Tailnet에 연결합니다.
2. 공기계에서 **이 휴대폰으로 촬영하기 → 새 등록 QR 만들기**를 선택합니다.
3. 모니터링 휴대폰에서 **등록한 홈캠 보기 → 새 홈캠 QR 등록**으로 스캔합니다. QR은 120초간 한 번만 사용 가능합니다.
4. 공기계에서 **촬영 시작**, 모니터링 휴대폰에서 **실시간 영상 보기**를 누릅니다.
5. 다음부터는 QR 재입력 없이 영상을 봅니다. 원본 비율/화면 가득 확대를 전환할 수 있습니다.

처음 등록은 함께 있을 때 진행하고 이후 PC를 끈 상태, 다른 Wi-Fi·모바일 데이터에서 확인합니다. 공기계의 **등록된 모니터링 기기 모두 해제**는 접근 토큰을 회전합니다. 모니터링 휴대폰의 등록 정보 삭제는 해당 휴대폰의 저장 정보만 지웁니다. 현재는 등록 카메라 한 대와 동시 시청 한 대를 대상으로 하며 새 시청 세션은 이전 세션을 교체합니다.

## 구조와 접근 제한

```text
모니터링 Android 앱 ── Tailscale ── 촬영용 Android 앱
    QR 등록·저장       암호화 터널     로컬 신호교환 :8787
    WebRTC 수신  ←──── DTLS-SRTP ──── 카메라 영상
```

- `mobile/modules/homecam-bridge`: Kotlin Expo 로컬 모듈. 공기계의 **Tailscale IPv4 인터페이스에만** HTTP listener를 바인딩하며 LAN 전체·공용 IP에 바인딩하지 않습니다. 파일·사진·영상 저장 API는 없습니다.
- `mobile/src/DirectVideo.js`: 영상 송수신, 재접속, 시청 heartbeat, 종료 시 트랙·피어 정리. 외부 STUN/TURN 없이 Tailscale IPv4 ICE 후보만 전달합니다.
- `mobile/src/directProtocol.js`: 앱·버전·주소·256bit 비밀 검증, 요청 timeout, 쿠키 없는 Bearer 인증.
- `mobile/src/app/`: Expo Router 화면. QR 임시 비밀과 장기 시청 토큰은 분리하며 장기 비밀은 SecureStore에 저장합니다. 비밀을 URL·로그·Git에 넣지 않습니다.

listener는 원격 Tailnet IP·Host·Origin·인증·본문/헤더 크기를 검사하고 worker/queue를 제한합니다. QR 실패 횟수와 영상 시청 lease에 제한이 있습니다. 공기계에서 촬영을 시작하기 전에는 원격으로 카메라를 켤 수 없습니다. 촬영 화면을 나가면 listener와 세션을 종료합니다.

## 로컬 APK 빌드

SDK 58 / RN 0.88입니다. Android SDK·Java 환경은 `live-homecam.md`를 참고합니다. Windows에서는 `mobile` 소스를 짧은 영문 경로(예: `C:\ac-homecam\m`)로 복사합니다. `node_modules`, 생성된 루트 `android`, 빌드 산출물을 제외하되 **로컬 모듈 소스인 `modules/homecam-bridge/android`는 반드시 포함**합니다.

```powershell
npm ci
npx expo prebuild --no-install --platform android
cd android
.\gradlew.bat ':homecam-bridge:testDebugUnitTest' assembleRelease '-PreactNativeArchitectures=arm64-v8a,armeabi-v7a'
```

산출물은 `android/app/build/outputs/apk/release/app-release.apk`입니다. 개인 시연용 APK는 Android 기본 개발 서명을 사용하며 스토어 배포용 서명은 아닙니다. 키는 저장소에 올리지 않습니다.

Windows Application Control에서 Hermes 컴파일러가 차단되는 환경을 위해 `withStandaloneBundle.cjs`가 RN bundle task를 plain JavaScript 번들 모드로 설정합니다. Hermes **실행 엔진은 유지**하고 선택적인 bytecode 사전 컴파일만 생략합니다. OS 보호 설정은 변경하지 않습니다. 일반 bytecode 빌드보다 앱 첫 실행 시 파싱 비용이 있을 수 있습니다.

## 검증

JavaScript 테스트 9개(QR·인증·주소·영상 후보 제한 포함), Expo lint, TypeScript 검사 통과. Kotlin socket 테스트 4개 통과. ARM64/ARM32 독립 실행 APK(1.1.0, versionCode 3) 빌드 성공. APK 내부 JS 번들·신호교환 모듈·WebRTC 라이브러리·서명과 비디버그 릴리스 manifest를 확인했습니다. 실제 Android 두 대에서 신규 QR 등록, PC를 끈 상태의 영상, Wi-Fi/모바일 데이터 전환은 새 APK 설치 후 확인해야 합니다. 이전 v2의 PC 웹 영상 검수와 구분합니다.

Kotlin socket 테스트 4개는 모두 통과했습니다. 현재 WebRTC Android 의존성에서 선택적 AV1 JNI 인터페이스 누락이 확인되어 AV1 협상을 제외하고 H.264/VP8/VP9을 사용합니다. 해당 단일 클래스에만 R8 경고 제외 규칙을 적용하며 최적화·검사 전체를 끄지 않습니다. 이미 생성된 프로젝트에는 `--init-script ../scripts/homecam-release.gradle`로 동일한 규칙을 적용할 수 있습니다. 새 prebuild에는 config plugin이 적용합니다.

연결 실패 시 두 기기의 Tailscale과 공기계 촬영 시작 여부부터 확인합니다. Tailscale을 나중에 켰다면 공기계의 **Tailscale 연결 다시 확인**을 누릅니다. 영상용 VPN 경로를 찾지 못했다는 메시지는 Tailscale을 먼저 켜고 앱을 재실행한 뒤 다시 확인합니다.

참고: [Expo 로컬 모듈](https://docs.expo.dev/modules/get-started/), [Expo Router 설치](https://docs.expo.dev/router/installation/), [React Native Hermes](https://reactnative.dev/docs/hermes).

## 1.1.1 VPN 영상 후보 수집 수정

1.1.0에서 사용자가 모니터링 화면의 ‘영상용 Tailscale 경로를 찾지 못했습니다’ 오류를 보고했습니다. 이는 인증된 공기계 상태 조회 뒤 영상 후보 검사에서 중단되는 경로입니다. Tailscale HTTP 연결과 WebRTC의 VPN 인터페이스 수집은 별개로 확인해야 합니다.

`withTailnetWebRTC.cjs`에서 React/WebRTC 초기화 전에 NetworkMonitorAutoDetect의 VPN 요청·다른 UID 네트워크 수집을 켜고 초기 캐시 의존을 끕니다. 실제 사용 중인 Jitsi WebRTC 155.0.1 바이너리의 옵션 이름·파서를 확인했습니다. 공용/LAN 영상 후보는 계속 제외하며, 영상 수집 대기와 실패 진단을 보완했습니다. 진단 T/V/C는 Tailnet 인터페이스 여부·VPN 관찰 여부·영상 후보 개수이며 IP·SSID·인증 토큰을 표시하지 않습니다.

촬영용·모니터링용 **두 휴대폰 모두 업데이트**하고 Tailscale 연결 후 앱을 완전히 재실행합니다. 같은 패키지·서명과 저장 형식을 유지하므로 기존 QR 등록을 재사용할 수 있습니다. 실제 연결 복구는 수정 APK 설치 후 확인해야 합니다. 여전히 실패하면 화면의 T/V/C 코드와 오류 문구로 다음 원인을 확인합니다.

새 prebuild에는 app.json의 config plugin이 적용됩니다. 기존 로컬 생성 프로젝트에는 `node scripts/apply-android-mods.cjs`로 같은 Expo mod와 버전 설정을 적용하여 CMake 캐시를 유지할 수 있습니다.

1.1.1/versionCode 4의 ARM64/ARM32 release APK 빌드, 내장 번들·컴파일된 VPN 옵션·서명 검증을 완료했습니다. JavaScript 10개와 Kotlin socket 4개, lint/typecheck가 통과했습니다. 연결 복구 여부는 사용자 두 휴대폰에서 업데이트 후 확인하는 단계입니다.

근거: [WebRTC VPN 수집 구현](https://webrtc.googlesource.com/src/+/refs/heads/main/sdk/android/api/org/webrtc/NetworkMonitorAutoDetect.java), [Android 네트워크 UID 수집 API](https://developer.android.com/reference/android/net/NetworkRequest.Builder#setIncludeOtherUidNetworks(boolean)).

## 1.1.2 OS 네트워크 조회와 Tailnet IPv6

1.1.1 실기기에서도 `T1/V1/C8`이 보고되어 연결 복구가 확인되지 않았습니다. 인터페이스와 VPN은 보이나 IPv4 전용 필터가 허용하는 후보가 없다는 뜻이며, 이 코드만으로 후보의 실제 주소나 주소 종류를 확정할 수는 없습니다.

1.1.2는 `PeerConnectionFactory.Options.disableNetworkMonitor=true`로 WebRTC의 Android 네트워크 감시·소켓 바인딩 대신 OS 인터페이스 조회/폴링과 라우팅을 사용합니다. 네트워크 제외 마스크는 loopback만 설정하며 `disableEncryption=false`를 명시합니다. 이 옵션은 Tailscale이나 영상 암호화를 끄는 설정이 아닙니다.

RN WebRTC 155.0.1이 해당 factory 옵션을 노출하지 않아 `patches/react-native-webrtc+155.0.1.patch`에서 옵션 필드와 builder 연결을 추가합니다. `npm install`/`npm ci`의 postinstall이 patch-package로 적용하며 실패하면 설치도 실패합니다. 모바일 빌드는 devDependencies를 포함해 설치해야 합니다. WebRTC 버전을 바꿀 때 패치를 함께 검토해야 합니다. 원본 build copy의 미패치 의존성에 설치 훅을 적용해 성공하는 것을 확인했습니다.

영상 후보는 기존 `100.64.0.0/10`에 Tailscale 전용 IPv6 `fd7a:115c:a1e0::/48`을 추가합니다. 일반 LAN·임의 ULA·공용 IPv6는 계속 거부하며, HTTP 주소와 QR 등록은 기존 IPv4를 유지합니다. 존재하지 않는 후보를 만들거나 물리 네트워크 주소를 Tailnet 주소로 치환하지 않습니다. 초기 수집 완료 이벤트가 먼저 와도 Tailnet 후보를 기다리고, 실패 시 I4/I6 후보 개수만 추가로 표시합니다.

사용자는 **양쪽 휴대폰을 함께 업데이트**하고 Tailscale 연결 후 앱을 재실행해야 합니다. 2026-11-09 사용자가 1.1.2에서 정상 작동을 확인했습니다. 기존 T1/V1/C8 오류 후 휴대폰 간 영상 연결이 복구된 것으로 기록합니다. PC를 끈 상태·모바일 데이터 전환·장시간 연속 동작은 이번 확인에서 별도로 보고되지 않았으므로 추가 검수 항목으로 남깁니다.

1.1.2/versionCode 5 release APK 빌드·서명·ARM64/ARM32 라이브러리·내장 IPv6 필터를 확인했습니다. 컴파일된 초기화 코드에서 `disableNetworkMonitor=true`, `disableEncryption=false`, 제외 마스크=loopback 값을 확인했습니다. 깨끗한 `npm ci`에서 패치 자동 적용, JavaScript 11개·lint/typecheck·Expo 의존성 호환성 검사와 감사가 통과했습니다. Kotlin socket 테스트 4개도 Gradle에서 확인했습니다. 위의 사용자 실기기 확인은 이 자동 검사와 별도의 결과입니다.

근거: [WebRTC factory 네트워크 모니터 옵션](https://webrtc.googlesource.com/src/+/refs/heads/main/api/peer_connection_interface.h), [Tailscale IPv6 범위](https://tailscale.com/docs/concepts/ipv6).

## 1.2.0 디자인 통합

웹과 Android의 색·서체·간격·버튼·아이콘을 통일했습니다. 앱의 역할 선택, 촬영 설정과 일회용 QR, 모니터링, 사진 점검, PC 웹 홈캠 연결을 같은 시각 체계로 정리했습니다. 기존 등록 저장소·앱 패키지·서명은 유지하며 업데이트를 위해 앱 데이터를 지울 필요는 없습니다. Expo 기본 아이콘은 사진 확인을 뜻하는 모서리 프레임 로고로 바꿨습니다.

Tailscale 영상 후보, WebRTC factory 옵션과 암호화, QR 유효기간, 인증·접근 범위, 사진 점수와 권고 규칙은 변경하지 않았습니다. 상세 디자인과 검증 범위는 [design-system.md](design-system.md)를 참고하세요. 새 버전의 실기기 UI·영상 동작은 설치 후 검수가 필요합니다.

## 1.3.0 서비스 소개와 목적별 진입

웹과 앱에 3단계 모션 소개 → 사진 안전점검/홈캠 선택 → 각 모드 진입 흐름을 적용했습니다. 앱 홈캠의 촬영용·모니터링용 역할 선택은 홈캠 모드 안으로 이동했습니다. 웹은 소개를 잠금 전에 볼 수 있고, 선택한 개인 기능은 기존 시연 코드로 보호합니다. 기존 QR 등록과 SecureStore 키, Tailnet 후보, WebRTC factory 옵션·암호화, API 쿠키·CSRF와 사진 점수 규칙은 유지합니다.

밝은 노랑과 먹색, 직접 구성한 거실 설명 그림으로 1차 디자인을 바꿨습니다. 모션 감소·일시정지·화면 비활성 시 타이머 정리를 지원합니다. 새 APK 실기기 검수는 설치 후 필요합니다. 구성과 출처·검증 범위는 [design-system.md](design-system.md)를 참고하세요.

## Apple 참고 문서 기반 제품 화면·모션 개편

사용자가 제공한 참고를 반영해 검정·화이트·블루와 실제 공간 사진을 중심으로 소개를 다시 구성했습니다. 제품 프레임의 입체 반응, 스캔 밴드, 위치 표시 순차 등장, 홈캠 휴대폰 전개, 스크롤과 버튼·카드 반응을 추가했습니다. 앱 소스도 사진 미리보기와 native-driver 모션, 새 색상·선택 카드로 정리했습니다. 기능 진입 순서·보안·사진 분석·영상 연결 메커니즘은 유지합니다.

사용자 선호에 따라 APK는 명시적으로 요청받을 때만 빌드·전달합니다. 이번 단계에서 APK를 생성하지 않았으며 앱 실기기 화면 검수는 이후 요청에 따른 설치본으로 진행합니다. 최신 시각 체계와 모션·검증 범위는 [design-system.md](design-system.md)에 기록합니다.

## Android 화면·사용 흐름 보완

앱 개발을 이어서 진행해 소개·목적 선택 다음의 실제 작업 화면을 정리했습니다.

- 홈캠 역할 선택, 촬영 기기 설정, 모니터링, 사진 점검에 공통 화면 진입 모션·헤더·단계 안내·상태 메시지를 적용했습니다.
- 사진 분석 후에는 결과 중심 화면으로 이동합니다. 사진 위치 표시와 물건 목록에서 해당 권고를 고르고, 설정으로 돌아가거나 다른 사진을 점검할 수 있습니다. 점수·권고·좌표 계산 및 이미지 전처리·쿠키·CSRF 요청 방식은 유지합니다.
- 마지막으로 잠금을 해제한 사진 분석 서버 주소만 SecureStore에 보관합니다. 코드·CSRF 토큰을 저장하지 않습니다. 기존 PC 홈캠 주소도 초기값으로 복원할 수 있으며 같은 서버 주소 검증 정책을 적용합니다.
- 추가 설명 조회는 이전 요청이 끝나기 전에 다음 요청을 겹쳐 보내지 않습니다.
- 촬영 준비 중 버튼 중복 실행을 막고, QR 만료 후 타이머를 종료합니다. 화면 이탈 후 촬영을 시작하지 않도록 권한 응답 경로를 확인합니다.
- QR 스캔과 영상 시청 중 Android 뒤로가기는 현재 화면을 먼저 닫습니다. 등록 정보 삭제·기기 접근 해제에는 확인 절차를 추가했습니다.
- 영상 조작은 하단 두 버튼으로 묶어 화면 영역을 늘렸습니다. 원본 비율과 가득 채우기를 구분하고, 확대 시 가장자리가 잘릴 수 있음을 안내합니다.

앱 JavaScript 테스트 13개(서버 주소 복원·검증 테스트 포함), lint·typecheck·npm audit(0), Android 대상 Metro export를 통과했습니다. export는 `--no-bytecode`를 사용한 JavaScript 소스 검증이며 네이티브 빌드나 APK 생성이 아닙니다. 새로운 실기기 화면·QR·영상 동작 검수는 아직 진행하지 않았습니다.

## 모바일 사진 점검 (코드 입력 생략)

모바일 사진 분석은 휴대폰 내부 AI가 아니라 PC의 기존 분석 서버가 필요합니다. PC와 휴대폰의 Tailscale을 연결하고 앱에 PC의 Tailscale 주소를 입력합니다. 앱은 사진을 서버로 전송하며 save_image=false로 요청합니다. 추가 AI 설명은 전체 응답에 포함되므로 기존 지연 설명 방식보다 결과가 늦어질 수 있습니다.

코드 없는 요청은 `POST /api/analyze/image`에 한해 TCP 상대 주소가 Tailscale IPv4 범위이고 전용 헤더가 있으며 Origin이 없는 경우에만 허용합니다. 다른 API와 웹은 기존 인증을 유지합니다. 이 조건은 개별 사용자 인증이 아닙니다. 해당 주소 범위의 다른 기기는 분석 요청을 할 수 있으므로 PC 방화벽에서 8000 포트를 Tailscale 인터페이스/신뢰 기기로 제한하고, 포트 포워딩이나 Funnel로 공개하지 마세요. 이 예외는 사진을 보낸 기기의 권한을 개별적으로 식별하지 않습니다.

홈캠은 Tailscale 후보만 사용하며 후보를 찾은 뒤 짧은 안정화 시간 이후 협상을 시작합니다. 기기 환경에 따라 경로 탐색 시간은 달라질 수 있고 실기기 검증이 필요합니다.
