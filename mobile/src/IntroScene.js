import { Image, StyleSheet, Text, View } from "react-native";
import { ScanLine, Video } from "lucide-react-native";
import { fonts as f } from "./ui";
export default function IntroScene({ step = 0 }) {
  return (
    <View style={v.stage} accessibilityLabel="사진 점검과 홈캠 이용 예시">
      <View style={v.toolbar}>
        <Text style={v.brand}>앗차차</Text>
        <Text style={v.meta}>
          {["공간 사진", "확인 위치", "홈캠 미리보기"][step]}
        </Text>
      </View>
      <View style={v.image}>
        <Image
          source={require("../assets/room-preview.jpg")}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
        {step === 0 && <View style={v.focus} />}
        {step === 1 && (
          <>
            <View style={[v.pin, { left: 12, top: 72 }]}>
              <ScanLine size={14} color="#0066cc" />
              <Text style={v.pinText}>모서리와 이동 공간 확인</Text>
            </View>
            <View style={[v.pin, { right: 12, bottom: 24 }]}>
              <Text style={v.pinText}>주변 물건 정리 확인</Text>
            </View>
          </>
        )}
      </View>
      <View style={v.bottom}>
        <Text style={v.meta}>기능 설명용 미리보기</Text>
        <Video size={14} color="#a1a1a6" />
      </View>
      {step === 2 && (
        <View style={v.phone}>
          <View style={v.island} />
          <Image
            source={require("../assets/room-preview.jpg")}
            style={v.phonePhoto}
          />
          <Text style={v.phoneText}>우리 집 홈캠</Text>
        </View>
      )}
    </View>
  );
}
const v = StyleSheet.create({
  stage: {
    backgroundColor: "#161618",
    borderRadius: 16,
    padding: 6,
    borderWidth: 1,
    borderColor: "#54545b",
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
  },
  brand: { color: "#fff", fontFamily: f.medium, fontSize: 12 },
  meta: { color: "#a1a1a6", fontFamily: f.regular, fontSize: 10 },
  image: { height: 220, overflow: "hidden", borderRadius: 8 },
  focus: {
    position: "absolute",
    left: "22%",
    right: "25%",
    top: "20%",
    bottom: "15%",
    borderWidth: 2,
    borderColor: "#fff",
    borderRadius: 8,
  },
  pin: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ffffffed",
    padding: 10,
    borderRadius: 8,
  },
  pinText: { color: "#1d1d1f", fontFamily: f.medium, fontSize: 11 },
  bottom: {
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  phone: {
    position: "absolute",
    right: -8,
    bottom: -12,
    width: 112,
    height: 180,
    borderWidth: 2,
    borderColor: "#8e8e96",
    borderRadius: 24,
    backgroundColor: "#161618",
    padding: 8,
    transform: [{ rotate: "6deg" }],
  },
  island: {
    width: 36,
    height: 10,
    borderRadius: 8,
    backgroundColor: "#000",
    alignSelf: "center",
    marginBottom: 12,
  },
  phonePhoto: { width: "100%", height: 106, borderRadius: 8 },
  phoneText: {
    color: "#f5f5f7",
    fontFamily: f.medium,
    fontSize: 10,
    textAlign: "center",
    marginTop: 12,
  },
});
