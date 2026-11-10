import { router } from "expo-router";
import { Text } from "react-native";
import { Camera, Monitor, QrCode, ShieldCheck } from "lucide-react-native";
import { Button, s } from "../ui";
import { Page, PageHeader, Progress, Section, Notice } from "../appUi";
export default function HomeCamRoles() {
  return (
    <Page>
      <PageHeader
        onBack={() => router.back()}
        eyebrow="홈캠 · 역할 선택"
        title="이 휴대폰은 어떤 역할인가요?"
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
      <Notice>
        두 기기에서 같은 계정의 Tailscale을 켜 주세요. 공기계는 충전기를
        연결하고 앱과 화면을 켜 둡니다.
      </Notice>
      <Text style={s.footnote}>
        앱 홈캠은 PC 없이 연결되며 소리와 영상을 저장하지 않습니다. 자동 낙상
        감지·긴급 출동 기능은 제공하지 않습니다.
      </Text>
      <Text style={s.section}>PC 브라우저에서 보고 싶다면</Text>
      <Text style={s.text}>
        개인 PC 서버에 연결해 기존 웹 홈캠을 사용할 수 있어요.
      </Text>
      <Button
        secondary
        icon={ShieldCheck}
        onPress={() => router.push("/legacy")}
      >
        PC 웹 홈캠 연결
      </Button>
    </Page>
  );
}
