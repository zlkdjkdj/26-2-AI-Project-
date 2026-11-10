import { useCallback, useEffect, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import {
  Animated,
  useAnimatedValue,
  AppState,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowRight, Pause, Play, ScanLine, Video } from "lucide-react-native";
import IntroScene from "../IntroScene";
import { useReducedMotion } from "../introMotion";
import { Brand, Button, fonts as f, s } from "../ui";
const scenes = [
  [
    "위험은 먼저 찾고.",
    "우리 집은 가까이.",
    "사진으로 위험요소를 살피고, 떨어져 있을 땐 홈캠으로 확인해요",
  ],
  [
    "확인할 위치를",
    "한눈에.",
    "가구와 이동 공간을 살피고, 물건별 점수와 권고를 확인하세요",
  ],
  [
    "멀리 있어도,",
    "지금 우리 집.",
    "등록한 휴대폰으로 우리 집 화면을 확인하세요",
  ],
];
export default function Introduction() {
  const [step, setStep] = useState(0),
    [playing, setPlaying] = useState(true),
    [focused, setFocused] = useState(false),
    [active, setActive] = useState(AppState.currentState === "active");
  const reduced = useReducedMotion();
  const entrance = useAnimatedValue(1);
  const scrollY = useAnimatedValue(0);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) =>
      setActive(state === "active"),
    );
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!playing || reduced || !focused || !active) return;
    const timer = setTimeout(() => {
      if (step < 2) setStep(step + 1);
      else setPlaying(false);
    }, 3400);
    return () => clearTimeout(timer);
  }, [step, playing, reduced, focused, active]);
  useEffect(() => {
    entrance.setValue(reduced ? 1 : 0);
    const animation = Animated.timing(entrance, {
      toValue: 1,
      duration: 650,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [step, reduced, entrance]);
  return (
    <SafeAreaView style={s.safe}>
      <Animated.ScrollView
        contentContainerStyle={a.page}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
      >
        <View style={a.brand}>
          <Brand />
        </View>
        <View style={a.hero}>
          <Text style={a.kicker}>사진 점검과 휴대폰 홈캠, 앗차차</Text>
          <Animated.View
            style={{
              opacity: entrance,
              transform: [
                {
                  translateY: entrance.interpolate({
                    inputRange: [0, 1],
                    outputRange: [24, 0],
                  }),
                },
                {
                  scale: entrance.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.97, 1],
                  }),
                },
              ],
            }}
          >
            <Text style={a.title}>
              {scenes[step][0]}
              <Text style={a.titleSoft}> {scenes[step][1]}</Text>
            </Text>
            <Text style={a.description}>{scenes[step][2]}</Text>
          </Animated.View>
          <Button icon={ArrowRight} onPress={() => router.push("/modes")}>
            시작하기
          </Button>
          <Animated.View
            style={[
              a.picture,
              {
                opacity: entrance,
                transform: reduced
                  ? []
                  : [
                      {
                        translateY: scrollY.interpolate({
                          inputRange: [0, 600],
                          outputRange: [0, -24],
                          extrapolate: "clamp",
                        }),
                      },
                      {
                        scale: entrance.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.94, 1],
                        }),
                      },
                    ],
              },
            ]}
          >
            <IntroScene step={step} />
          </Animated.View>
          <View style={a.controls}>
            {["공간 촬영", "위치 확인", "홈캠 연결"].map((text, i) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: step === i }}
                key={text}
                onPress={() => {
                  setStep(i);
                  setPlaying(false);
                }}
                style={({ pressed }) => [
                  a.step,
                  step === i && a.selected,
                  pressed && { transform: [{ scale: 0.96 }] },
                ]}
              >
                <Text style={[a.stepText, step === i && { color: "#1d1d1f" }]}>
                  {text}
                </Text>
              </Pressable>
            ))}
            {!reduced && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  playing ? "소개 일시정지" : "소개 다시 재생"
                }
                onPress={() => {
                  if (!playing && step === 2) setStep(0);
                  setPlaying(!playing);
                }}
                style={a.play}
              >
                {playing ? (
                  <Pause size={16} color="#d2d2d7" />
                ) : (
                  <Play size={16} color="#d2d2d7" />
                )}
              </Pressable>
            )}
          </View>
          <Text style={a.disclaimer}>
            기능 설명용 미리보기 · 실제 분석 결과와 영상이 아닙니다
          </Text>
        </View>
        <View style={a.details}>
          <Text style={s.eyebrow}>확인하는 습관부터</Text>
          <Text style={a.section}>사진으로 찾고.{"\n"}홈캠으로 살펴요.</Text>
          <View style={a.feature}>
            <ScanLine size={22} color="#0071e3" />
            <View style={a.featureBody}>
              <Text style={a.featureTitle}>사진 안전점검</Text>
              <Text style={s.text}>
                물건별 위험 위치와 참고 점수, 정리 권고를 확인하세요. 개인 PC
                서버가 필요합니다.
              </Text>
            </View>
          </View>
          <View style={a.feature}>
            <Video size={22} color="#0071e3" />
            <View style={a.featureBody}>
              <Text style={a.featureTitle}>휴대폰 홈캠</Text>
              <Text style={s.text}>
                휴대폰 두 대를 QR로 등록해 다른 장소에서도 확인하세요. 앱 홈캠은
                PC 없이 연결됩니다.
              </Text>
            </View>
          </View>
          <Text style={s.footnote}>
            사진 점수는 안전 인증이 아닙니다. 자동 낙상 감지·긴급 출동 기능은
            제공하지 않습니다. 사진 Max Vakhtbovych / Pexels.
          </Text>
          <Button onPress={() => router.push("/modes")}>
            사용할 모드 선택하기
          </Button>
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}
const a = StyleSheet.create({
  page: { paddingBottom: 48 },
  brand: { padding: 24, paddingBottom: 0 },
  hero: {
    margin: 12,
    borderRadius: 24,
    backgroundColor: "#050506",
    padding: 24,
    gap: 24,
    overflow: "hidden",
  },
  kicker: {
    fontFamily: f.medium,
    fontSize: 12,
    color: "#a1a1a6",
    textAlign: "center",
  },
  title: {
    fontFamily: f.semibold,
    fontSize: 38,
    lineHeight: 46,
    letterSpacing: -0.4,
    color: "#fff",
    textAlign: "center",
  },
  titleSoft: { color: "#a1a1a6" },
  description: {
    fontFamily: f.regular,
    fontSize: 15,
    lineHeight: 24,
    color: "#a1a1a6",
    textAlign: "center",
    marginTop: 20,
  },
  picture: { marginTop: 12, marginBottom: 8 },
  controls: {
    flexDirection: "row",
    backgroundColor: "#1c1c1e",
    borderRadius: 28,
    padding: 4,
  },
  step: {
    flex: 1,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 24,
  },
  selected: { backgroundColor: "#fff" },
  stepText: { fontFamily: f.medium, fontSize: 11, color: "#a1a1a6" },
  play: {
    width: 32,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  disclaimer: {
    fontFamily: f.regular,
    fontSize: 10,
    lineHeight: 18,
    color: "#a1a1a6",
    textAlign: "center",
  },
  details: { padding: 24, gap: 24 },
  section: {
    fontFamily: f.semibold,
    fontSize: 32,
    lineHeight: 40,
    color: "#1d1d1f",
  },
  feature: {
    flexDirection: "row",
    gap: 16,
    alignItems: "flex-start",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: "#e5e5e7",
  },
  featureBody: { flex: 1, gap: 12 },
  featureTitle: { fontFamily: f.medium, fontSize: 20, color: "#1d1d1f" },
});
