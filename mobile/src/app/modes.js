import { router } from "expo-router";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowRight, ScanLine, Video } from "lucide-react-native";
import { BackLink, colors as c, fonts as f, s } from "../ui";
export default function Modes() {
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content}>
        <BackLink onPress={() => router.back()} />
        <Text style={s.eyebrow}>앗차차 시작하기</Text>
        <Text style={s.title}>지금, 어떻게{"\n"}살펴볼까요?</Text>
        <Text style={s.text}>
          필요한 모드를 선택하세요{"\n"}언제든 다른 모드로 바꿀 수 있어요
        </Text>
        {[
          [
            ScanLine,
            "사진 한 장으로 확인하고 싶다면",
            "사진 안전점검",
            "위험 위치 · 참고 점수 · 물건별 권고",
            "개인 PC 서버와 시연 코드 필요",
            "/photo",
          ],
          [
            Video,
            "현재 공간을 보고 싶다면",
            "홈캠",
            "실시간 영상 · 휴대폰 두 대 연결",
            "다음 화면에서 촬영·모니터링 역할 선택",
            "/homecam",
          ],
        ].map(([Icon, hint, title, body, note, path], i) => (
          <Pressable
            key={path}
            accessibilityRole="button"
            onPress={() => router.push(path)}
            style={({ pressed }) => [
              a.option,
              i === 0 && a.photo,
              i === 1 && a.cam,
              pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            ]}
          >
            <View style={a.top}>
              <View style={a.icon}>
                <Icon size={28} color={c.ink} strokeWidth={1.5} />
              </View>
              <ArrowRight size={20} color={i === 1 ? "#82baff" : "#0066cc"} />
            </View>
            <Text style={[a.hint, i === 1 && a.onDark]}>{hint}</Text>
            <Text style={[a.title, i === 1 && a.onDarkTitle]}>{title}</Text>
            <Text style={[a.body, i === 1 && a.onDark]}>{body}</Text>
            <Text style={[a.note, i === 1 && a.onDark]}>{note}</Text>
            <View style={a.preview}>
              <Image
                source={require("../../assets/room-preview.jpg")}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
              <View style={a.frame} />
            </View>
          </Pressable>
        ))}
        <Text style={s.footnote}>
          사진 점수는 안전 인증이 아닙니다. 사진에서 알 수 없는 상태는 현장에서
          확인하세요. 홈캠은 자동 낙상 감지·긴급 출동 기능을 제공하지 않습니다.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
const a = StyleSheet.create({
  cam: { backgroundColor: "#08080a", borderColor: "#08080a" },
  onDark: { color: "#a1a1a6" },
  onDarkTitle: { color: "#f5f5f7" },
  preview: { height: 140, overflow: "hidden", borderRadius: 12, marginTop: 8 },
  frame: {
    position: "absolute",
    left: "24%",
    right: "24%",
    top: "20%",
    bottom: "16%",
    borderWidth: 2,
    borderColor: "#fff",
    borderRadius: 6,
  },
  option: {
    padding: 24,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 20,
    backgroundColor: c.surface,
    gap: 12,
  },
  photo: { backgroundColor: "#ffffff", borderColor: "#0071e3" },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: "#eaf3ff",
    justifyContent: "center",
    alignItems: "center",
  },
  hint: { fontFamily: f.regular, fontSize: 12, color: c.secondary },
  title: { fontFamily: f.medium, fontSize: 26, color: c.ink },
  body: {
    fontFamily: f.regular,
    fontSize: 15,
    lineHeight: 24,
    color: c.secondary,
  },
  note: { fontFamily: f.regular, fontSize: 12, lineHeight: 20, color: c.muted },
});
