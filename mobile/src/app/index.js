import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text } from "react-native";
import WelcomeGuide, { hasSeenGuide, saveGuideSeen } from "../WelcomeGuide";
import { Camera, ShieldCheck, Monitor } from "lucide-react-native";
import { Page, PageHeader, Section } from "../appUi";
import { Button, s } from "../ui";
import { IS_TABLET } from "../variant";

export default function ModeSelection() {
  const [guideVisible, setGuideVisible] = useState(false);
  useEffect(() => { if (IS_TABLET) return undefined; let active=true; hasSeenGuide().then(seen => { if(active && !seen) setGuideVisible(true); }); return () => { active=false; }; }, []);
  function closeGuide() { setGuideVisible(false); saveGuideSeen(); }
  return (
    <Page>
      {guideVisible && <WelcomeGuide visible onClose={closeGuide} />}
      <PageHeader
        title="앗차차"
        description={IS_TABLET ? "집을 더 안전하게. 태블릿에서 홈캠을 보거나 촬영하세요." : "집을 더 안전하게. 홈캠과 사진 안전점검을 선택하세요."}
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

      {!IS_TABLET && <Section
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
      </Section>}

      {!IS_TABLET && <Pressable accessibilityRole="button" onPress={() => setGuideVisible(true)}><Text style={s.text}>앗차차 시작 가이드 다시 보기 →</Text></Pressable>}
      <Text style={s.footnote}>
        {IS_TABLET ? "홈캠에는 Tailscale이 필요합니다. 태블릿 버전은 홈캠 모니터링과 촬영만 제공합니다." : "홈캠에는 Tailscale이 필요합니다. 휴대폰 사진 점검은 모델 설치 후 오프라인으로 사용할 수 있어요."}
      </Text>
    </Page>
  );
}
