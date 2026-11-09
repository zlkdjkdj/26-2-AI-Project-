import { router } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import {
  Camera,
  Monitor,
  ScanLine,
  QrCode,
  ShieldCheck,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Brand, Button, colors, s } from "../ui";
export default function Home() {
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content}>
        <Brand />
        <Text style={s.eyebrow}>우리 집을 살피는 두 가지 방법</Text>
        <Text style={s.title}>가까이 두고,{"\n"}멀리서도 살펴요</Text>
        <Text style={s.text}>
          남는 휴대폰은 홈캠으로, 손 안의 휴대폰은 모니터로. 두 기기에서
          Tailscale을 켜고 역할을 선택하세요.
        </Text>
        <View style={s.card}>
          <View style={s.roleHeader}>
            <View style={s.roleIcon}>
              <Camera size={22} color={colors.accent} strokeWidth={1.5} />
            </View>
            <Text style={s.roleNumber}>01 / 집에 두는 휴대폰</Text>
          </View>
          <Text style={s.section}>이 휴대폰으로 촬영</Text>
          <Text style={s.text}>
            등록 QR을 보여 준 뒤 촬영을 시작하세요. 충전기를 연결하고 앱과
            화면을 켜 둡니다.
          </Text>
          <Button icon={Camera} onPress={() => router.push("/camera")}>
            촬영용 공기계 설정
          </Button>
        </View>
        <View style={s.card}>
          <View style={s.roleHeader}>
            <View style={s.roleIcon}>
              <Monitor size={22} color={colors.accent} strokeWidth={1.5} />
            </View>
            <Text style={s.roleNumber}>02 / 가지고 다니는 휴대폰</Text>
          </View>
          <Text style={s.section}>등록한 홈캠 확인</Text>
          <Text style={s.text}>
            QR 등록은 처음 한 번만. 다른 장소와 모바일 데이터에서도 영상을
            확인하세요.
          </Text>
          <Button
            secondary
            icon={QrCode}
            onPress={() => router.push("/viewer")}
          >
            모니터링 열기
          </Button>
        </View>
        <Text style={s.footnote}>
          앱 홈캠은 PC 없이 연결됩니다. 소리·녹화 없이 실시간 영상만 전송합니다.
        </Text>
        <View style={s.divider} />
        <Text style={s.section}>사진으로 안전점검</Text>
        <Text style={s.text}>
          공간을 촬영하고 물건별 위험 위치, 참고 점수와 권고사항을 확인하세요.
        </Text>
        <Button secondary icon={ScanLine} onPress={() => router.push("/photo")}>
          사진 안전점검 열기
        </Button>
        <Text style={s.footnote}>
          사진 AI 분석에는 기존 개인 PC 서버와 시연 코드가 필요합니다.
        </Text>
        <View style={s.divider} />
        <Button
          secondary
          icon={ShieldCheck}
          onPress={() => router.push("/legacy")}
        >
          PC 웹 홈캠 연결
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
