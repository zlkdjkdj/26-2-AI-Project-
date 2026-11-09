import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { File } from "expo-file-system";
import { fetch as expoFetch } from "expo/fetch";
import { serverAddress } from "./api";
import { scoreMessage } from "./scanFeedback";
import { BackLink, colors as c, fonts as f } from "./ui";

const targets = {
  elderly: "노약자",
  toddler: "영유아",
  newborn: "신생아",
  wheelchair: "휠체어 사용자",
  limited_mobility: "거동 불편자",
};
const rooms = {
  auto: "자동 확인",
  living_room: "거실",
  bedroom: "침실",
  kitchen: "주방",
  bathroom: "욕실",
  entrance: "현관",
  hallway: "복도",
  stairs: "계단",
};
const levels = { HIGH: "고위험", MEDIUM: "중위험", LOW: "저위험" };

function Choice({ items, value, onChange }) {
  return (
    <View style={s.choices}>
      {Object.entries(items).map(([key, label]) => (
        <Pressable
          key={key}
          accessibilityRole="button"
          accessibilityState={{ selected: value === key }}
          onPress={() => onChange(key)}
          style={[s.chip, value === key && s.selected]}
        >
          <Text style={[s.chipText, value === key && s.selectedText]}>
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
function Button({ title, onPress, disabled, secondary }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        s.button,
        secondary && s.secondary,
        disabled && { opacity: 0.45 },
      ]}
    >
      <Text style={[s.buttonText, secondary && { color: "#255345" }]}>
        {title}
      </Text>
    </Pressable>
  );
}

export default function PhotoScan({ initialServer, onBack }) {
  const [server, setServer] = useState(initialServer || "");
  const [code, setCode] = useState("");
  const [csrf, setCsrf] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [target, setTarget] = useState("elderly");
  const [room, setRoom] = useState("living_room");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const jsonRequest = useCallback(
    async (path, options = {}) => {
      const response = await expoFetch(`${serverAddress(server)}${path}`, {
        ...options,
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) setCsrf(null);
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "입력값 또는 서버 상태를 확인해 주세요.",
        );
      }
      return data;
    },
    [server],
  );
  useEffect(() => {
    if (!server) return;
    let address;
    try {
      address = serverAddress(server);
    } catch {
      return;
    }
    let active = true;
    expoFetch(`${address}/api/demo/status`, { credentials: "include" })
      .then((response) => response.json())
      .then((data) => {
        if (active && data.unlocked) setCsrf(data.csrf_token);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [server]);
  async function unlock() {
    setBusy(true);
    setError("");
    try {
      const data = await jsonRequest("/api/demo/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      setCsrf(data.csrf_token);
      setCode("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function selectPhoto(camera) {
    setError("");
    try {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted)
          throw new Error("사진 촬영을 위해 카메라 권한이 필요합니다.");
      }
      const options = { mediaTypes: ["images"], quality: 0.85 };
      const selected = camera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (selected.canceled) return;
      const a = selected.assets[0];
      const size =
        a.width >= a.height
          ? { width: Math.min(a.width, 1920) }
          : { height: Math.min(a.height, 1920) };
      const normalized = await manipulateAsync(a.uri, [{ resize: size }], {
        compress: 0.8,
        format: SaveFormat.JPEG,
      });
      setPhoto(normalized);
      setResult(null);
    } catch (e) {
      setError(e.message);
    }
  }
  async function analyze() {
    if (!photo || busy) return;
    setBusy(true);
    setError("");
    try {
      const data = new FormData();
      data.append("file", new File(photo.uri), "mobile-room.jpg");
      data.append("target_type", target);
      data.append("space_type", room);
      data.append("space_name", "우리집");
      data.append("save_image", "false");
      data.append("defer_explanation", "true");
      setResult(
        await jsonRequest("/api/analyze/image", {
          method: "POST",
          headers: { "X-CSRF-Token": csrf },
          body: data,
        }),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!result?.explanation_pending) return;
    let active = true;
    const id = setInterval(async () => {
      try {
        const data = await jsonRequest(`/api/scans/${result.scan_id}`);
        if (active)
          setResult((old) =>
            old?.scan_id === data.scan_id
              ? {
                  ...old,
                  explanation: data.explanation,
                  explanation_pending: data.explanation_pending,
                }
              : old,
          );
      } catch {}
    }, 3000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [jsonRequest, result?.scan_id, result?.explanation_pending]);
  return (
    <ScrollView
      contentContainerStyle={s.page}
      keyboardShouldPersistTaps="handled"
    >
      <BackLink onPress={onBack} />
      <Text style={s.eyebrow}>사진 안전점검</Text>
      <Text style={s.title}>
        사진으로 살피는
        {"\n"}
        우리 공간의 안전
      </Text>
      {!csrf ? (
        <View style={s.card}>
          <Text style={s.heading}>사진점검 잠금 해제</Text>
          <Text style={s.note}>
            홈캠 연결 코드가 아닌 기존 시연 코드를 입력하세요.
          </Text>
          <TextInput
            style={s.input}
            value={server}
            onChangeText={setServer}
            autoCapitalize="none"
            keyboardType="url"
            placeholder="PC 서버 주소 (예: http://100.x.x.x:8000)"
          />
          <TextInput
            style={s.input}
            value={code}
            onChangeText={setCode}
            secureTextEntry
            placeholder="시연 코드"
            autoCapitalize="none"
          />
          <Button
            title="잠금 해제"
            onPress={unlock}
            disabled={busy || !server || !code}
          />
        </View>
      ) : (
        <>
          <View style={s.card}>
            <Text style={s.heading}>1. 공간 사진</Text>
            <View style={s.row}>
              <Button
                secondary
                title="카메라 촬영"
                onPress={() => selectPhoto(true)}
                disabled={busy}
              />
              <Button
                secondary
                title="앨범에서 선택"
                onPress={() => selectPhoto(false)}
                disabled={busy}
              />
            </View>
            {photo && (
              <View
                style={{
                  width: "100%",
                  aspectRatio: photo.width / photo.height,
                  backgroundColor: "#e5ebe5",
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                <Image
                  source={{ uri: photo.uri }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="stretch"
                />
                {result?.hazards?.map(
                  (h, i) =>
                    h.bbox?.length === 4 && (
                      <View
                        key={h.id || i}
                        style={{
                          position: "absolute",
                          left: `${h.bbox[0] * 100}%`,
                          top: `${h.bbox[1] * 100}%`,
                          width: `${h.bbox[2] * 100}%`,
                          height: `${h.bbox[3] * 100}%`,
                          borderWidth: 2,
                          borderColor:
                            h.risk_level === "HIGH" ? "#a23d30" : "#8a5b16",
                        }}
                      >
                        <Text style={s.marker}>{i + 1}</Text>
                      </View>
                    ),
                )}
              </View>
            )}
          </View>
          <View style={s.card}>
            <Text style={s.heading}>2. 누구와 어떤 공간인가요?</Text>
            <Text style={s.label}>사용 대상</Text>
            <Choice items={targets} value={target} onChange={setTarget} />
            <Text style={s.label}>공간</Text>
            <Choice items={rooms} value={room} onChange={setRoom} />
            <Button
              title={busy ? "사진을 분석하고 있어요…" : "안전점검 시작"}
              onPress={analyze}
              disabled={!photo || busy}
            />
            {busy && <ActivityIndicator color="#255345" />}
          </View>
          {result && (
            <View style={s.card}>
              <Text style={s.eyebrow}>사진 피드백</Text>
              <Text style={s.score}>
                {result.score_computable === false
                  ? "점수 산정 불가"
                  : `${result.safety_score}점`}
              </Text>
              <Text style={s.body}>{scoreMessage(result)}</Text>
              <Text style={s.note}>
                탐지된 물건 {result.detected_objects?.length || 0}개 · 위험 확인
                항목 {result.hazards?.length || 0}개
              </Text>
              <Text style={s.note}>{result.notice}</Text>
              {result.hazards?.length ? (
                result.hazards.map((h, i) => (
                  <View key={h.id || i} style={s.hazard}>
                    <Text style={s.hazardTitle}>
                      {i + 1}. {h.instance_label || h.object_label} ·{" "}
                      {levels[h.risk_level] || h.risk_level}
                    </Text>
                    <Text style={s.body}>{h.description}</Text>
                    {!!h.accident && <Text style={s.body}>{h.accident}</Text>}
                    <Text style={s.advice}>{h.recommendation}</Text>
                    {!!h.supplement && (
                      <Text style={s.body}>{h.supplement}</Text>
                    )}
                    {!!h.placement_advice && (
                      <Text style={s.body}>{h.placement_advice}</Text>
                    )}
                  </View>
                ))
              ) : (
                <Text style={s.body}>
                  사진에서 위험 후보가 발견되지 않았습니다. 현장 확인도
                  필요합니다.
                </Text>
              )}
              <Text style={s.body}>{result.explanation?.summary}</Text>
              {result.explanation_pending && (
                <Text style={s.note}>추가 설명을 준비하고 있어요.</Text>
              )}
            </View>
          )}
        </>
      )}
      {!!error && (
        <Text style={s.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { padding: 24, paddingBottom: 48, gap: 20 },
  eyebrow: { color: c.accent, fontSize: 13, fontFamily: f.medium },
  title: { color: c.ink, fontSize: 32, fontFamily: f.medium, lineHeight: 42 },
  card: {
    padding: 24,
    borderRadius: 12,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
    gap: 16,
  },
  heading: { fontFamily: f.medium, color: c.ink, fontSize: 18, lineHeight: 26 },
  note: { color: c.muted, fontSize: 13, lineHeight: 22, fontFamily: f.regular },
  label: { color: c.secondary, fontSize: 14, fontFamily: f.medium },
  input: {
    borderWidth: 1,
    borderColor: "#b6c1b8",
    borderRadius: 8,
    minHeight: 48,
    padding: 12,
    color: c.ink,
    fontFamily: f.regular,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  button: {
    backgroundColor: c.accent,
    minHeight: 48,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexGrow: 1,
  },
  secondary: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
  },
  buttonText: {
    color: "white",
    fontFamily: f.medium,
    fontSize: 14,
    lineHeight: 22,
  },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  selected: { backgroundColor: c.accent, borderColor: c.accent },
  chipText: { fontSize: 13, color: c.secondary, fontFamily: f.regular },
  selectedText: { color: "white" },
  score: { fontSize: 36, color: c.accent, fontFamily: f.medium },
  marker: {
    color: "white",
    backgroundColor: "#a23d30",
    fontSize: 11,
    fontFamily: f.medium,
    alignSelf: "flex-start",
    paddingHorizontal: 4,
  },
  hazard: { borderTopWidth: 1, borderColor: c.line, paddingTop: 20, gap: 12 },
  hazardTitle: {
    color: c.ink,
    fontFamily: f.medium,
    fontSize: 16,
    lineHeight: 24,
  },
  body: {
    color: c.secondary,
    lineHeight: 24,
    fontSize: 14,
    fontFamily: f.regular,
  },
  advice: {
    color: c.accent,
    lineHeight: 24,
    fontFamily: f.medium,
    fontSize: 14,
  },
  error: {
    color: c.danger,
    backgroundColor: "#faf1ef",
    padding: 16,
    borderRadius: 8,
    lineHeight: 22,
    fontFamily: f.regular,
  },
});
