import { router } from "expo-router";
import { Text } from "react-native";
import { Camera, ShieldCheck, Monitor } from "lucide-react-native";
import { Page, PageHeader, Section } from "../appUi";
import { Button, s } from "../ui";

export default function ModeSelection() {
  return (
    <Page>
      <PageHeader
        title="앗차차"
        description="집을 더 안전하게. 홈캠과 사진 안전점검을 선택하세요."
      />

      <Section
        icon={Camera}
        title="홈캠"
        subtitle="실시간 영상으로 집을 지켜보세요. 공기계와 모니터링 휴대폰을 QR로 연결합니다."
      >
        <Button
          icon={Monitor}
          onPress={() => router.push("/homecam")}
        >
          홈캠 시작하기
        </Button>
      </Section>

      <Section
        icon={ShieldCheck}
        title="사진 안전점검"
        subtitle="사진을 찍으면 AI가 가구, 전기, 위험 요소를 분석하고 개선점을 알려줍니다."
      >
        <Button
          icon={ShieldCheck}
          onPress={() => router.push("/photo")}
        >
          사진 점검 시작하기
        </Button>
      </Section>

      <Text style={s.footnote}>
        홈캠에는 Tailscale이 필요합니다. 휴대폰 사진 점검은 모델 설치 후 오프라인으로 사용할 수 있어요.
      </Text>
    </Page>
  );
}
