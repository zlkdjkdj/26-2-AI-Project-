import { useEffect, useRef, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { overallFeedback, scoreMessage } from "./scanFeedback";
import { colors as c, fonts as f } from "./ui";
import { Enter, PageHeader, Progress, Notice } from "./appUi";
import { useReducedMotion } from "./introMotion";
import Bridge from "../modules/homecam-bridge";
import { generalOfflineResult } from "./offlineSafety";
import ZoomPhoto from "./ZoomPhoto";

const levels = { HIGH: "고위험", MEDIUM: "중위험", LOW: "저위험" };

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

export default function PhotoScan({ onBack }) {
  const scroll = useRef(null);
  const recommendationY = useRef(0);
  const reduced = useReducedMotion();
  const [selectedHazard, setSelectedHazard] = useState(0);
  const [showAllBoxes, setShowAllBoxes] = useState(true);
  const [zoomVisible, setZoomVisible] = useState(false);
  const [modelReady, setModelReady] = useState(null);
  const [electricalReady, setElectricalReady] = useState(null);
  const [includeElectrical, setIncludeElectrical] = useState(true);
  const [electricalSupported, setElectricalSupported] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    Bridge.offlineModelReady().then((ready) => { if (active) setModelReady(ready); }).catch(() => { if (active) setModelReady(false); });
    Bridge.electricalModelSupported().then((ready) => { if (active) setElectricalSupported(ready); }).catch(() => { if (active) setElectricalSupported(false); });
    Bridge.electricalModelReady().then((ready) => { if (active) setElectricalReady(ready); }).catch(() => { if (active) setElectricalReady(false); });
    return () => { active = false; };
  }, []);
  async function downloadModel() {
    setBusy(true); setError("");
    try { await Bridge.downloadOfflineModel(); setModelReady(true); }
    catch (e) { setError(e.message || "모델 다운로드에 실패했습니다."); }
    finally { setBusy(false); }
  }
  async function removeModel() {
    setBusy(true); setError("");
    try { await Bridge.removeOfflineModel(); setModelReady(false); setPhoto(null); setResult(null); }
    catch (e) { setError(e.message || "모델을 삭제하지 못했습니다."); }
    finally { setBusy(false); }
  }
  async function downloadElectrical() {
    setBusy(true); setError("");
    try { await Bridge.downloadElectricalModel(); setElectricalReady(true); setIncludeElectrical(true); }
    catch (e) { setError(e.message || "전기 탐지 모델 다운로드에 실패했습니다."); }
    finally { setBusy(false); }
  }
  async function removeElectrical() {
    setBusy(true); setError("");
    try { await Bridge.removeElectricalModel(); setElectricalReady(false); }
    catch (e) { setError(e.message || "전기 탐지 모델을 삭제하지 못했습니다."); }
    finally { setBusy(false); }
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
    setShowAllBoxes(true);
    setBusy(true);
    setError("");
    try {
      const detections = await Bridge.detectOfflinePhoto(photo.uri);
      const useElectrical = electricalReady && includeElectrical;
      if (useElectrical) detections.push(...await Bridge.detectElectricalPhoto(photo.uri));
      setResult(generalOfflineResult(detections, useElectrical));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [result?.scan_id]);
  const showResult = !!result;
  const hazards = result?.hazards || [];
  const selected = hazards[selectedHazard];
  const overall = result ? overallFeedback(result) : null;
  function chooseHazard(index) {
    setSelectedHazard(index);
    setShowAllBoxes(false);
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
            labels={["분석 준비", "사진 점검", "결과 확인"]}
            current={!modelReady ? 0 : showResult ? 2 : 1}
          />
          {!!error && <Notice tone="error">{error}</Notice>}
          {!modelReady ? (
            <View style={s.card}>
              <Text style={s.heading}>가구 점검 모델 추가</Text>
              <Text style={s.note}>약 45MB를 한 번 다운로드하면 이후 PC와 인터넷 없이 휴대폰에서 가구와 일반 물건을 분석합니다. 전기 위험 점검은 아래에서 별도로 다운로드할 수 있습니다.</Text>
              <Button title={modelReady === null ? "모델 확인 중…" : busy ? "모델 다운로드 중…" : "가구 점검 모델 다운로드"} onPress={downloadModel} disabled={busy || modelReady === null} />
              <Text style={s.note}>다운로드 시 데이터가 사용됩니다. 사진은 기기 밖으로 전송하지 않습니다.</Text>
            </View>
          ) : !showResult ? (
            <>
              <View style={s.card}>
                  <Text style={s.note}>휴대폰 분석 · 모델을 받은 뒤 인터넷 없이 사진을 분석합니다.</Text>
                  <Button secondary title="가구 모델 삭제" onPress={removeModel} disabled={busy} />
                  <Text style={s.heading}>전기설비·바닥 위험 후보 점검</Text>
                  {electricalSupported === false ? <Text style={s.note}>이 휴대폰은 전기 점검 모델을 실행하기에 메모리가 부족합니다. 전선과 멀티탭은 직접 확인해 주세요.</Text> : electricalReady ? <>
                    <Text style={s.note}>{includeElectrical ? "전기설비와 물기·매트 후보를 함께 찾습니다. 오래 걸릴 수 있습니다." : "현재 가구만 점검합니다. 전기설비는 확인되지 않습니다."}</Text>
                    <Button secondary title={includeElectrical ? "추가 점검 끄기" : "추가 점검 켜기"} onPress={() => setIncludeElectrical(!includeElectrical)} disabled={busy} />
                    <Button secondary title="전기 모델 삭제" onPress={removeElectrical} disabled={busy} />
                  </> : <>
                    <Text style={s.note}>실험용 전기 모델을 약 204MB 추가로 받습니다. 높은 메모리를 사용하며 분석에 오래 걸릴 수 있습니다.</Text>
                    <Button secondary title={busy ? "전기 모델 다운로드 중…" : "추가 위험 모델 다운로드"} onPress={downloadElectrical} disabled={busy || electricalReady === null || electricalSupported === null} />
                  </>}
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
                <Button
                  title={busy ? "사진을 분석하고 있어요…" : "안전점검 시작"}
                  onPress={analyze}
                  disabled={!photo || busy}
                />
                {busy && (
                  <Notice loading>
                    탐지 결과를 준비하고 있어요. 전기 모델을 함께 사용하면 구형 기기에서 오래 걸릴 수 있습니다.
                  </Notice>
                )}
                <Text style={s.note}>
                  사진과 결과는 분석을 위해 외부로 전송하지 않습니다.
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
              <View style={s.card}>
                <Text style={s.heading}>종합 안전 피드백</Text>
                <Text style={s.body}>{overall.summary}</Text>
                {overall.actions.map((action, index) => (
                  <View key={`${action.label}-${index}`}>
                    <Text style={s.label}>{index + 1}. {action.label}</Text>
                    <Text style={s.advice}>{action.text}</Text>
                  </View>
                ))}
                <Text style={s.note}>사진에서 찾은 후보를 바탕으로 정리한 안내입니다. 실제 위험 여부와 사진에 보이지 않는 곳은 직접 확인해 주세요.</Text>
              </View>
              {zoomVisible && photo && <ZoomPhoto photo={photo} hazards={hazards} selected={selectedHazard} initialMode={showAllBoxes ? "all" : "selected"} onClose={() => setZoomVisible(false)} />}
              {photo && (
                <PhotoPreview
                  photo={photo}
                  hazards={hazards}
                  selected={selectedHazard}
                  showAll={showAllBoxes}
                  onSelect={chooseHazard}
                  onZoom={() => setZoomVisible(true)}
                />
              )}
              <Button title="사진 확대해서 보기" secondary onPress={() => setZoomVisible(true)} />
              <Text style={s.note}>{result.notice}</Text>
              {!!hazards.length && (
                <View style={s.choices}>
                  <Pressable accessibilityRole="button" accessibilityState={{ selected: showAllBoxes }} onPress={() => setShowAllBoxes(true)} style={[s.chip, showAllBoxes && s.selected]}>
                    <Text style={[s.chipText, showAllBoxes && s.selectedText]}>전체 박스 보기</Text>
                  </Pressable>
                  {hazards.map((h, i) => (
                    <Pressable
                      key={h.id || i}
                      accessibilityRole="button"
                      accessibilityState={{ selected: !showAllBoxes && selectedHazard === i }}
                      onPress={() => { setSelectedHazard(i); setShowAllBoxes(false); }}
                      style={[s.chip, !showAllBoxes && selectedHazard === i && s.selected]}
                    >
                      <Text
                        style={[
                          s.chipText,
                          !showAllBoxes && selectedHazard === i && s.selectedText,
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
                title="사진 선택으로 돌아가기"
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
function PhotoPreview({ photo, hazards = [], selected = -1, showAll = true, onSelect, onZoom }) {
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
      <Pressable onPress={onZoom} disabled={!onZoom} accessibilityRole="button" accessibilityLabel="사진 확대해서 보기" style={StyleSheet.absoluteFill}>
        <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} resizeMode="stretch" />
      </Pressable>
      {hazards.map(
        (h, i) =>
          h.bbox?.length === 4 && (showAll || i === selected) && (
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
                borderRadius: 4,
                borderColor: h.risk_level === "HIGH" ? "#ff5252" : h.risk_level === "MEDIUM" ? "#ffb020" : "#1685ff",
                backgroundColor: i === selected ? "#ffffff20" : "transparent",
              }}
            >
              <Text numberOfLines={1} style={[s.marker, { backgroundColor: h.risk_level === "HIGH" ? "#c92b38" : h.risk_level === "MEDIUM" ? "#a75a00" : "#075ac1" }]}>{i + 1} · {h.instance_label || h.object_label}</Text>
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
    position: "absolute",
    top: -20,
    left: -2,
    minWidth: 52,
    maxWidth: 180,
    color: "white",
    backgroundColor: "#a23d30",
    fontSize: 11,
    fontFamily: f.medium,
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
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
