import { useCallback, useEffect, useRef, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { File } from "expo-file-system";
import { fetch as expoFetch } from "expo/fetch";
import { serverAddress } from "./api";
import { isTailnet } from "./directProtocol";
import { scoreMessage } from "./scanFeedback";
import { colors as c, fonts as f } from "./ui";
import { Enter, PageHeader, Progress, Notice } from "./appUi";
import { PHOTO_SERVER_STORAGE } from "./photoConnection";
import { useReducedMotion } from "./introMotion";

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

function Choice({ items, value, onChange, disabled = false }) {
  return (
    <View style={s.choices}>
      {Object.entries(items).map(([key, label]) => (
        <Pressable
          key={key}
          accessibilityRole="button"
          accessibilityState={{ selected: value === key, disabled }}
          disabled={disabled}
          onPress={() => onChange(key)}
          style={[
            s.chip,
            value === key && s.selected,
            disabled && { opacity: 0.6 },
          ]}
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
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        disabled && { opacity: 0.45 },
        pressed && !disabled && { opacity: 0.8, transform: [{ scale: 0.98 }] },
      ]}
    >
      <Text style={[s.buttonText, secondary && { color: "#1d1d1f" }]}>
        {title}
      </Text>
    </Pressable>
  );
}

export default function PhotoScan({ initialServer, onBack }) {
  const scroll = useRef(null);
  const recommendationY = useRef(0);
  const reduced = useReducedMotion();
  const [selectedHazard, setSelectedHazard] = useState(0);
  const [server, setServer] = useState(initialServer || "");
  const [serverReady, setServerReady] = useState(() => {
    try { return isTailnet(new URL(serverAddress(initialServer || "")).hostname); } catch { return false; }
  });
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
        credentials: "omit",
      });
      const data = await response.json();
      if (!response.ok) {
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
  async function connectServer() {
    setError("");
    try {
      const address = serverAddress(server);
      if (!isTailnet(new URL(address).hostname))
        throw new Error("코드 없이 이용하려면 PC의 Tailscale 주소를 입력하세요.");
      await SecureStore.setItemAsync(PHOTO_SERVER_STORAGE, address);
      setServerReady(true);
    } catch (e) { setError(e.message); }
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
    setSelectedHazard(0);
    setBusy(true);
    setError("");
    try {
      const data = new FormData();
      data.append("file", new File(photo.uri), "mobile-room.jpg");
      data.append("target_type", target);
      data.append("space_type", room);
      data.append("space_name", "우리집");
      data.append("save_image", "false");
      data.append("defer_explanation", "false");
      setResult(
        await jsonRequest("/api/analyze/image", {
          method: "POST",
          headers: { "X-Atchacha-Photo": "1" },
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
    let pending = false;
    const id = setInterval(async () => {
      if (pending) return;
      pending = true;
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
      } catch {
      } finally {
        pending = false;
      }
    }, 3000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [jsonRequest, result?.scan_id, result?.explanation_pending]);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [result?.scan_id]);
  const showResult = !!result;
  const hazards = result?.hazards || [];
  const selected = hazards[selectedHazard];
  function chooseHazard(index) {
    setSelectedHazard(index);
    scroll.current?.scrollTo({
      y: Math.max(0, recommendationY.current - 16),
      animated: !reduced,
    });
  }
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <Enter style={s.page}>
          <PageHeader
            onBack={onBack}
            eyebrow="사진 안전점검"
            title={
              showResult
                ? "이곳부터 살펴보세요"
                : "사진으로 살피는 우리 공간의 안전"
            }
            description={
              showResult
                ? "사진의 표시와 목록에서 물건별 권고를 확인하세요. 점수는 사진 확인 항목에 한정한 참고값입니다."
                : "가구와 바닥, 이동 통로가 함께 보이도록 촬영해 주세요."
            }
          />
          <Progress
            labels={["서버 연결", "사진 점검", "결과 확인"]}
            current={!serverReady ? 0 : showResult ? 2 : 1}
          />
          {!!error && <Notice tone="error">{error}</Notice>}
          {!serverReady ? (
            <View style={s.card}>
              <Text style={s.heading}>사진 분석 서버 연결</Text>
              <Text style={s.note}>
                PC와 휴대폰에서 Tailscale을 켜고 PC 서버 주소를 입력하세요. 주소는 이 기기에 저장됩니다.
              </Text>
              <Text style={s.label}>PC 서버 주소</Text>
              <TextInput
                accessibilityLabel="사진 분석 PC 서버 주소"
                style={s.input}
                value={server}
                onChangeText={setServer}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                placeholder="http://100.x.x.x:8000"
                editable={!busy}
              />
              <Button title="서버 주소 저장" onPress={connectServer} disabled={!server.trim()} />
            </View>
          ) : !showResult ? (
            <>
              <View style={s.card}>
                <Text style={s.note}>PC 분석 서버 · {server}</Text>
                <Button secondary title="서버 주소 변경" onPress={() => setServerReady(false)} disabled={busy} />
                <Text style={s.heading}>공간 사진</Text>
                {photo ? (
                  <PhotoPreview photo={photo} />
                ) : (
                  <View style={s.photoEmpty}>
                    <Text style={s.heading}>
                      우리 공간의 지금 모습을 담아주세요
                    </Text>
                    <Text style={s.note}>가구 · 바닥 · 이동 통로</Text>
                  </View>
                )}
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
              </View>
              <View style={s.card}>
                <Text style={s.heading}>누구와 어떤 공간인가요?</Text>
                <Text style={s.label}>사용 대상</Text>
                <Choice
                  items={targets}
                  value={target}
                  onChange={setTarget}
                  disabled={busy}
                />
                <Text style={s.label}>공간</Text>
                <Choice
                  items={rooms}
                  value={room}
                  onChange={setRoom}
                  disabled={busy}
                />
                <Button
                  title={busy ? "사진을 분석하고 있어요…" : "안전점검 시작"}
                  onPress={analyze}
                  disabled={!photo || busy}
                />
                {busy && (
                  <Notice loading>
                    탐지 결과를 준비하고 있어요. 완료되면 결과 화면으로
                    이동합니다.
                  </Notice>
                )}
                <Text style={s.note}>
                  점검 사진은 서버에 보관하지 않습니다. 분석 결과는 기존 보관
                  설정을 따릅니다.
                </Text>
              </View>
            </>
          ) : (
            <>
              <View style={s.scoreCard}>
                <Text style={s.label}>참고 안전점수</Text>
                <Text style={s.score}>
                  {result.score_computable === false
                    ? "점수 산정 보류"
                    : `${result.safety_score}점`}
                </Text>
                <Text style={s.body}>{scoreMessage(result)}</Text>
                <Text style={s.note}>
                  탐지된 물건 {result.detected_objects?.length || 0}개 · 위험
                  확인 항목 {hazards.length}개
                </Text>
              </View>
              {photo && (
                <PhotoPreview
                  photo={photo}
                  hazards={hazards}
                  selected={selectedHazard}
                  onSelect={chooseHazard}
                />
              )}
              <Text style={s.note}>{result.notice}</Text>
              {!!hazards.length && (
                <View style={s.choices}>
                  {hazards.map((h, i) => (
                    <Pressable
                      key={h.id || i}
                      accessibilityRole="button"
                      accessibilityState={{ selected: selectedHazard === i }}
                      onPress={() => setSelectedHazard(i)}
                      style={[s.chip, selectedHazard === i && s.selected]}
                    >
                      <Text
                        style={[
                          s.chipText,
                          selectedHazard === i && s.selectedText,
                        ]}
                      >
                        {i + 1}. {h.instance_label || h.object_label} ·{" "}
                        {levels[h.risk_level] || h.risk_level}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
              <View
                style={s.card}
                onLayout={(event) => {
                  recommendationY.current = event.nativeEvent.layout.y;
                }}
              >
                {selected ? (
                  <>
                    <Text style={s.eyebrow}>
                      {selectedHazard + 1} / {hazards.length} ·{" "}
                      {levels[selected.risk_level] || selected.risk_level}
                    </Text>
                    <Text style={s.hazardTitle}>
                      {selected.instance_label || selected.object_label}
                    </Text>
                    <Text style={s.body}>{selected.description}</Text>
                    {!!selected.accident && (
                      <Text style={s.body}>{selected.accident}</Text>
                    )}
                    <Text style={s.label}>먼저 확인할 권고</Text>
                    <Text style={s.advice}>{selected.recommendation}</Text>
                    {!!selected.supplement && (
                      <Text style={s.body}>{selected.supplement}</Text>
                    )}
                    {!!selected.placement_advice && (
                      <Text style={s.body}>{selected.placement_advice}</Text>
                    )}
                  </>
                ) : (
                  <Text style={s.body}>
                    사진에서 위험 후보가 발견되지 않았습니다. 탐지되지 않은 곳도
                    현장 확인이 필요합니다.
                  </Text>
                )}
              </View>
              {!!result.explanation?.summary && (
                <View style={s.card}>
                  <Text style={s.heading}>추가 개선 안내</Text>
                  <Text style={s.body}>{result.explanation.summary}</Text>
                </View>
              )}
              {result.explanation_pending && (
                <Notice loading>
                  추가 설명을 준비하고 있어요. 사진 피드백은 먼저 확인할 수
                  있습니다.
                </Notice>
              )}
              <Button
                title="사진·대상 설정으로 돌아가기"
                secondary
                onPress={() => {
                  setResult(null);
                  setError("");
                  scroll.current?.scrollTo({ y: 0, animated: false });
                }}
              />
              <Button
                title="다른 사진으로 점검하기"
                onPress={() => {
                  setResult(null);
                  setPhoto(null);
                  setError("");
                  scroll.current?.scrollTo({ y: 0, animated: false });
                }}
              />
            </>
          )}
        </Enter>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
function PhotoPreview({ photo, hazards = [], selected = -1, onSelect }) {
  return (
    <View
      style={{
        width: "100%",
        aspectRatio: photo.width / photo.height,
        backgroundColor: c.raised,
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      <Image
        source={{ uri: photo.uri }}
        style={StyleSheet.absoluteFill}
        resizeMode="stretch"
      />
      {hazards.map(
        (h, i) =>
          h.bbox?.length === 4 && (
            <Pressable
              key={h.id || i}
              accessibilityRole="button"
              accessibilityLabel={`${i + 1}. ${h.instance_label || h.object_label} 피드백 보기`}
              onPress={() => onSelect?.(i)}
              style={{
                position: "absolute",
                left: `${h.bbox[0] * 100}%`,
                top: `${h.bbox[1] * 100}%`,
                width: `${h.bbox[2] * 100}%`,
                height: `${h.bbox[3] * 100}%`,
                borderWidth: i === selected ? 3 : 2,
                borderColor: h.risk_level === "HIGH" ? "#a23d30" : "#8a5b16",
                backgroundColor: i === selected ? "#ffffff16" : "transparent",
              }}
            >
              <Text style={s.marker}>{i + 1}</Text>
            </Pressable>
          ),
      )}
    </View>
  );
}

const s = StyleSheet.create({
  page: {
    padding: 24,
    paddingBottom: 48,
    gap: 20,
    maxWidth: 640,
    width: "100%",
    alignSelf: "center",
  },
  photoEmpty: {
    minHeight: 200,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: c.line,
    borderRadius: 12,
    padding: 20,
  },
  scoreCard: {
    padding: 24,
    gap: 16,
    backgroundColor: c.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.line,
  },
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
    fontSize: 22,
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
