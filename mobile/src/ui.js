import { Pressable, StyleSheet, Text, View } from "react-native";
import { ArrowLeft, ScanLine } from "lucide-react-native";
export const colors = {
  page: "#f7f8f5",
  surface: "#ffffff",
  raised: "#eef1ec",
  ink: "#22312b",
  secondary: "#56635c",
  muted: "#6b756e",
  line: "#dce2dc",
  accent: "#255345",
  accentSoft: "#eaf0e8",
  danger: "#92392e",
};
export const fonts = {
  regular: "SUIT-Regular",
  medium: "SUIT-Medium",
  semibold: "SUIT-SemiBold",
};
export function Button({
  children,
  onPress,
  secondary,
  disabled,
  danger,
  icon: Icon,
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        danger && s.danger,
        (pressed || disabled) && { opacity: 0.5 },
      ]}
    >
      {Icon && (
        <Icon
          size={18}
          strokeWidth={1.5}
          color={danger ? colors.danger : secondary ? colors.accent : "#fff"}
        />
      )}
      <Text
        style={[
          s.buttonText,
          secondary && { color: colors.accent },
          danger && { color: colors.danger },
        ]}
      >
        {children}
      </Text>
    </Pressable>
  );
}
export function Brand() {
  return (
    <View style={s.brandRow}>
      <ScanLine size={28} color={colors.accent} strokeWidth={1.5} />
      <Text style={s.brand}>앗차차</Text>
    </View>
  );
}
export function BackLink({ onPress }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={s.back}>
      <ArrowLeft size={18} color={colors.secondary} strokeWidth={1.5} />
      <Text style={s.backText}>홈으로</Text>
    </Pressable>
  );
}
export const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.page },
  content: { padding: 24, gap: 20, paddingBottom: 48 },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  brand: { color: colors.ink, fontSize: 24, fontFamily: fonts.semibold },
  eyebrow: { color: colors.accent, fontSize: 13, fontFamily: fonts.medium },
  title: {
    color: colors.ink,
    fontSize: 32,
    lineHeight: 42,
    fontFamily: fonts.medium,
    letterSpacing: -0.8,
  },
  section: {
    color: colors.ink,
    fontSize: 20,
    lineHeight: 28,
    fontFamily: fonts.medium,
  },
  text: {
    color: colors.secondary,
    fontSize: 15,
    lineHeight: 24,
    fontFamily: fonts.regular,
  },
  card: {
    backgroundColor: colors.surface,
    padding: 24,
    borderRadius: 12,
    gap: 16,
    borderColor: colors.line,
    borderWidth: 1,
  },
  button: {
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  danger: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "#e4c5bf",
  },
  buttonText: {
    color: "#fff",
    fontSize: 15,
    lineHeight: 22,
    fontFamily: fonts.medium,
    textAlign: "center",
    flexShrink: 1,
  },
  message: {
    padding: 16,
    backgroundColor: colors.raised,
    borderRadius: 8,
    color: colors.secondary,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 22,
  },
  toolbar: { padding: 16, gap: 12, backgroundColor: colors.page },
  row: { flexDirection: "row", gap: 12 },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    minHeight: 48,
    marginTop: -8,
  },
  backText: { color: colors.secondary, fontFamily: fonts.medium, fontSize: 14 },
  roleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  roleIcon: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  roleNumber: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12 },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 4 },
  footnote: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 20,
  },
});
