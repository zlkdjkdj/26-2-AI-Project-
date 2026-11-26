import { router } from "expo-router";
import { Text } from "react-native";
import { Camera, Monitor, QrCode, ShieldCheck } from "lucide-react-native";
import { Button, s } from "../ui";
import { Page, PageHeader, Progress, Section, Notice } from "../appUi";
import { IS_TABLET } from "../variant";
export default function HomeCamRoles() {
  return (
    <Page>
      <PageHeader
        onBack={() => router.back()}
        eyebrow="홈캠 · 역할 선택"
        title={IS_TABLET ? "이 태블릿은 어떤 역할인가요?" : "이 휴대폰은 어떤 역할인가요?"}
        description="집에 두는 공기계는 촬영용으로, 가지고 다니는 휴대폰은 모니터링용으로 선택하세요."
      />
      <Progress labels={["모드 선택", "기기 역할", "연결"]} current={1} />
      <Section
        dark
        icon={Camera}
        title="촬영용 공기계"
        subtitle="집에 고정해 둘 휴대폰에서 선택하세요. 처음 한 번 등록 QR을 만든 뒤 촬영을 시작합니다."
      >
        <Button icon={Camera} onPress={() => router.push("/camera")}>
          이 휴대폰으로 촬영하기
        </Button>
      </Section>
      <Section
        icon={Monitor}
        title="모니터링 휴대폰"
        subtitle="밖에서도 확인할 휴대폰에서 선택하세요. 등록된 홈캠을 열거나 공기계의 QR을 읽어 연결합니다."
      >
        <Button icon={QrCode} onPress={() => router.push("/viewer")}>
          등록한 홈캠 보기
        </Button>
      </Section>
      <Section title="처음 연결하는 방법" subtitle="처음에는 두 휴대폰을 가까이 두고 QR을 등록해 주세요.">
        <Text style={s.text}>1. 두 휴대폰에 앗차차와 Tailscale을 설치하고 같은 Tailscale 계정으로 로그인해 연결합니다.</Text>
        <Text style={s.text}>2. 집에 둘 휴대폰에서 ‘촬영용 공기계’를 선택하고 카메라 권한을 허용한 뒤 등록 QR을 만듭니다.</Text>
        <Text style={s.text}>3. 볼 휴대폰에서 ‘모니터링 휴대폰’을 선택해 QR을 스캔합니다. QR이 만료되면 새로 만들어 주세요.</Text>
        <Text style={s.text}>4. 촬영용 휴대폰에서 촬영을 시작하고, 모니터링 휴대폰에서 등록한 홈캠을 엽니다.</Text>
        <Text style={s.text}>5. 이후에는 서로 다른 Wi-Fi나 모바일 데이터에서도 두 기기의 인터넷과 Tailscale이 연결되어 있으면 시청할 수 있습니다.</Text>
        <Text style={s.text}>연결되지 않으면 양쪽 Tailscale 상태와 인터넷, 카메라 권한을 확인한 뒤 앱을 다시 열어 주세요.</Text>
      </Section>
      <Notice>
        두 기기에서 같은 계정의 Tailscale을 켜 주세요. 공기계는 충전기를
        연결하고 앱과 화면을 켜 둡니다.
      </Notice>
      <Text style={s.footnote}>
        앱 홈캠은 PC 없이 연결됩니다. 촬영 기기에서 실험용 낙상 의심 영상
        기록을 선택할 수 있으며, 자동 신고·긴급 출동 기능은 제공하지 않습니다.
      </Text>
      {!IS_TABLET && <>
      <Text style={s.section}>추가 기능</Text>
      <Text style={s.text}>사진을 촬영해 가구 주변을 점검할 수 있어요. 가구 모델은 필요한 경우 별도로 내려받습니다.</Text>
      <Button secondary icon={ShieldCheck} onPress={() => router.push("/photo")}>
        사진 안전점검 열기
      </Button>
      </>}
    </Page>
  );
}
