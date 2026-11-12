import { useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  useAnimatedValue,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect } from "expo-router";
import { Check, Info, TriangleAlert } from "lucide-react-native";
import { BackLink, colors as c, fonts as f, s } from "./ui";
import { useReducedMotion } from "./introMotion";
export function Enter({ children, style }) {
  const value = useAnimatedValue(1);
  const reduced = useReducedMotion();
  useFocusEffect(
    useCallback(() => {
      value.setValue(reduced ? 1 : 0);
      if (reduced) return;
      const animation = Animated.timing(value, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
      animation.start();
      return () => animation.stop();
    }, [reduced, value]),
  );
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: value,
          transform: [
            {
              translateY: value.interpolate({
                inputRange: [0, 1],
                outputRange: [16, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
export function Page({ children }) {
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <Enter style={[s.content, a.page]}>{children}</Enter>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function PageHeader({ title, eyebrow, description, onBack }) {
  return (
    <>
      {onBack && <BackLink onPress={onBack} />}
      <View style={a.heading}>
        <Text style={s.eyebrow}>{eyebrow}</Text>
        <Text style={s.title} accessibilityRole="header">
          {title}
        </Text>
        {description && <Text style={s.text}>{description}</Text>}
      </View>
    </>
  );
}
export function Section({
  children,
  title,
  subtitle,
  icon: Icon,
  dark = false,
}) {
  return (
    <View style={[s.card, dark && a.darkCard]}>
      {(title || Icon) && (
        <View style={a.sectionTitle}>
          {Icon && (
            <Icon
              size={22}
              color={dark ? "#82baff" : c.link}
              strokeWidth={1.5}
            />
          )}
          <Text
            style={[s.section, { flex: 1 }, dark && a.light]}
            accessibilityRole="header"
          >
            {title}
          </Text>
        </View>
      )}
      {subtitle && (
        <Text style={[s.text, dark && a.lightMuted]}>{subtitle}</Text>
      )}
      {children}
    </View>
  );
}
export function Notice({ children, tone = "info", loading = false }) {
  const Icon = tone === "error" ? TriangleAlert : Info;
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole={tone === "error" ? "alert" : undefined}
      style={[a.notice, tone === "error" && a.error]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={c.link} />
      ) : (
        <Icon
          size={18}
          color={tone === "error" ? c.danger : c.link}
          strokeWidth={1.5}
        />
      )}
      <Text style={[a.noticeText, tone === "error" && { color: c.danger }]}>
        {children}
      </Text>
    </View>
  );
}
export function Progress({ labels, current }) {
  return (
    <View
      style={a.progress}
      accessibilityLabel={labels
        .map(
          (label, i) => `${i + 1} ${label}${i === current ? " 현재 단계" : ""}`,
        )
        .join(", ")}
    >
      {labels.map((label, i) => (
        <View key={label} style={a.progressItem}>
          <View style={[a.number, i <= current && a.numberActive]}>
            {i < current ? (
              <Check size={12} color="#fff" />
            ) : (
              <Text style={[a.numberText, i <= current && a.light]}>
                {i + 1}
              </Text>
            )}
          </View>
          <Text style={[a.progressText, i === current && { color: c.link }]}>
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
}
export function Player({ children, controls, note }) {
  return (
    <SafeAreaView style={a.player}>
      <StatusBar style="light" />
      <View style={a.video}>{children}</View>
      <View style={a.controls}>
        {note && <Text style={a.playerNote}>{note}</Text>}
        {controls}
      </View>
    </SafeAreaView>
  );
}
export function ScanFinder() {
  return (
    <View pointerEvents="none" style={a.finderWrap}>
      <View style={a.finder}>
        {["tl", "tr", "bl", "br"].map((key) => (
          <View key={key} style={[a.corner, a[key]]} />
        ))}
      </View>
      <Text style={a.finderText}>공기계의 등록 QR을 안에 맞춰 주세요</Text>
    </View>
  );
}
export function confirmAction(title, message, onConfirm) {
  Alert.alert(title, message, [
    { text: "취소", style: "cancel" },
    { text: "해제하기", style: "destructive", onPress: onConfirm },
  ]);
}
const a = StyleSheet.create({
  page: { width: "100%", maxWidth: 640, alignSelf: "center" },
  heading: { gap: 16, marginBottom: 8 },
  sectionTitle: { flexDirection: "row", alignItems: "center", gap: 12 },
  notice: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#eaf3ff",
    alignItems: "flex-start",
  },
  noticeText: {
    fontFamily: f.regular,
    fontSize: 14,
    lineHeight: 22,
    color: "#315471",
    flex: 1,
  },
  error: { backgroundColor: "#faf1ef" },
  progress: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    paddingBottom: 8,
  },
  progressItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  number: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: c.raised,
    alignItems: "center",
    justifyContent: "center",
  },
  numberActive: { backgroundColor: c.accent },
  numberText: { fontFamily: f.medium, fontSize: 11, color: c.muted },
  progressText: { fontFamily: f.medium, fontSize: 12, color: c.muted },
  darkCard: { backgroundColor: "#08080a", borderColor: "#08080a" },
  light: { color: "#fff" },
  lightMuted: { color: "#a1a1a6" },
  player: { flex: 1, backgroundColor: "#08080a" },
  video: { flex: 1, overflow: "hidden" },
  controls: { backgroundColor: "#151518", padding: 16, gap: 12 },
  playerNote: {
    fontFamily: f.regular,
    fontSize: 12,
    lineHeight: 20,
    color: "#a1a1a6",
  },
  finderWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
  finder: { width: 232, height: 232 },
  corner: { position: "absolute", width: 32, height: 32, borderColor: "#fff" },
  tl: { left: 0, top: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  tr: { right: 0, top: 0, borderTopWidth: 3, borderRightWidth: 3 },
  bl: { left: 0, bottom: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  br: { right: 0, bottom: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  finderText: {
    fontFamily: f.medium,
    fontSize: 13,
    color: "#fff",
    backgroundColor: "#000000aa",
    padding: 12,
    borderRadius: 8,
  },
});
