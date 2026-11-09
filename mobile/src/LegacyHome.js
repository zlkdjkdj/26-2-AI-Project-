import { useEffect, useRef, useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import { cameraRequest, serverAddress } from "./api";
import VideoCamera from "./VideoCamera";
import PhotoScan from "./PhotoScan";
import { parsePairQr } from "./pairQr";
import { colors as c, fonts as f } from "./ui";

const STORAGE = "atchacha.homecam.connection";

function Button({ children, onPress, secondary, disabled }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        (disabled || pressed) && { opacity: 0.55 },
      ]}
    >
      <Text style={[styles.buttonText, secondary && { color: "#31543e" }]}>
        {children}
      </Text>
    </Pressable>
  );
}

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [server, setServer] = useState("");
  const [code, setCode] = useState("");
  const [connection, setConnection] = useState(null);
  const [streaming, setStreaming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const [page, setPage] = useState("homecam");
  const [scanning, setScanning] = useState(false);
  const scanLock = useRef(false);
  const [stats, setStats] = useState({ count: 0, last: null });
  useEffect(() => {
    let active = true;
    SecureStore.getItemAsync(STORAGE)
      .then(async (raw) => {
        if (!raw) return;
        try {
          const saved = JSON.parse(raw);
          if (
            saved.expires_at * 1000 > Date.now() &&
            saved.device_token &&
            active
          ) {
            saved.server = serverAddress(saved.server);
            setConnection(saved);
            setServer(saved.server);
          } else await SecureStore.deleteItemAsync(STORAGE);
        } catch {
          await SecureStore.deleteItemAsync(STORAGE);
        }
      })
      .catch(() => {
        if (active)
          setMessage("연결을 복원하지 못했습니다. 다시 연결해 주세요.");
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);
  async function pair(serverInput = server, codeInput = code) {
    setBusy(true);
    setMessage("");
    try {
      const address = serverAddress(serverInput);
      if (!/^\d{6}$/.test(codeInput))
        throw new Error("웹에서 만든 6자리 연결 코드를 입력하세요.");
      const result = await cameraRequest(address, "/api/homecam/pair", {
        json: { code: codeInput },
      });
      const saved = { ...result, server: address };
      await SecureStore.setItemAsync(STORAGE, JSON.stringify(saved));
      setConnection(saved);
      setServer(address);
      setCode("");
      setMessage("연결 완료. 휴대폰을 고정하고 홈캠을 시작하세요.");
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function scanQr() {
    const granted = permission?.granted || (await requestPermission()).granted;
    if (!granted) {
      setMessage("QR 스캔을 위해 카메라 권한이 필요합니다.");
      return;
    }
    scanLock.current = false;
    setMessage("");
    setScanning(true);
  }
  function readQr({ data }) {
    if (scanLock.current) return;
    scanLock.current = true;
    try {
      const value = parsePairQr(data);
      setScanning(false);
      pair(value.server, value.code);
    } catch (e) {
      setScanning(false);
      setMessage(e.message || "QR 코드를 확인해 주세요.");
    }
  }
  async function forget() {
    setStreaming(false);
    if (connection)
      cameraRequest(connection.server, "/api/homecam/device/pause", {
        token: connection.device_token,
      }).catch(() => {});
    await SecureStore.deleteItemAsync(STORAGE).catch(() => {});
    setConnection(null);
    setCode("");
    setStats({ count: 0, last: null });
    setMessage("기기 연결 정보를 지웠습니다. 웹에서도 연결을 해제해 주세요.");
  }
  async function start() {
    if (connection.expires_at * 1000 <= Date.now()) {
      await forget();
      return;
    }
    const granted = permission?.granted || (await requestPermission()).granted;
    if (!granted) {
      setMessage("카메라 권한이 필요합니다. 기기 설정에서 허용해 주세요.");
      return;
    }
    setStats({ count: 0, last: null });
    setMessage("카메라 준비 중…");
    setStreaming(true);
  }
  if (page === "photo")
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safe}>
          <PhotoScan
            initialServer={connection?.server || server}
            onBack={() => setPage("homecam")}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.brand}>
            앗차차<Text style={{ color: "#5c8866" }}>.</Text>
          </Text>
          <Button
            secondary
            onPress={() => {
              setStreaming(false);
              setPage("photo");
            }}
          >
            사진 안전점검 열기
          </Button>
          <Text style={styles.eyebrow}>PC 웹 홈캠 연결</Text>
          <Text style={styles.title}>
            {connection ? connection.name : "휴대폰을\n우리집 홈캠으로."}
          </Text>
          <Text style={styles.description}>
            Wi-Fi 또는 Tailscale로 PC와 연결하세요. 화면을 켜 둔 동안 실시간
            영상을 전송합니다.
          </Text>
          {!loaded ? (
            <Text>연결 확인 중…</Text>
          ) : !connection ? (
            <View style={styles.card}>
              <Text style={styles.section}>웹에서 연결 코드 만들기</Text>
              <Text style={styles.hint}>
                PC의 ‘모바일 홈캠’에서 일회용 코드를 만든 뒤 입력하세요. PC
                서버는 LAN 접속 모드로 실행해야 합니다.
              </Text>
              {scanning ? (
                <>
                  <View style={styles.qrPreview}>
                    <CameraView
                      style={StyleSheet.absoluteFill}
                      facing="back"
                      barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                      onBarcodeScanned={readQr}
                    />
                  </View>
                  <Button secondary onPress={() => setScanning(false)}>
                    스캔 취소
                  </Button>
                </>
              ) : (
                <Button secondary onPress={scanQr} disabled={busy}>
                  QR로 간편 연결
                </Button>
              )}
              <Text style={styles.label}>PC 서버 주소</Text>
              <TextInput
                accessibilityLabel="PC 서버 주소"
                style={styles.input}
                value={server}
                onChangeText={setServer}
                placeholder="http://192.168.0.10:8000"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                editable={!busy}
              />
              <Text style={styles.label}>일회용 연결 코드</Text>
              <TextInput
                accessibilityLabel="일회용 연결 코드"
                style={[styles.input, styles.code]}
                value={code}
                onChangeText={(text) =>
                  setCode(text.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="000000"
                keyboardType="number-pad"
                maxLength={6}
                editable={!busy}
              />
              <Button onPress={() => pair()} disabled={busy}>
                {busy ? "연결 중…" : "PC와 연결하기"}
              </Button>
              <Text style={styles.hint}>
                시연 코드가 아닌 3분 유효 연결 코드입니다. 사설 Wi-Fi 또는
                Tailscale 연결을 사용하세요.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.preview}>
                {streaming ? (
                  <VideoCamera
                    connection={connection}
                    onStop={() => {
                      setStreaming(false);
                      setMessage(
                        "전송 중지. 다시 시작하려면 버튼을 눌러 주세요.",
                      );
                    }}
                    onExpired={forget}
                    onUpdate={(data) => {
                      setStats((s) => ({ ...s, ...data }));
                      setMessage(data.message);
                    }}
                  />
                ) : (
                  <View style={styles.placeholder}>
                    <Text style={styles.placeholderTitle}>홈캠 준비 완료</Text>
                    <Text style={styles.placeholderText}>
                      후면 카메라를 공간으로 향하고\n흔들리지 않게 고정해
                      주세요.
                    </Text>
                  </View>
                )}
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {streaming ? "● 영상 연결 중" : "○ 전송 중지"}
                  </Text>
                </View>
              </View>
              <View style={styles.card}>
                <Text style={styles.section}>
                  {streaming
                    ? "화면을 켜 둔 채로 유지하세요"
                    : "준비되면 시작하세요"}
                </Text>
                <Text style={styles.hint}>
                  실시간 영상 모드
                  {stats.last
                    ? ` · 마지막 ${new Date(stats.last * 1000).toLocaleTimeString("ko-KR")}`
                    : ""}
                </Text>
                <Button
                  onPress={
                    streaming
                      ? () => {
                          setStreaming(false);
                          setMessage("전송을 중지했습니다.");
                        }
                      : start
                  }
                >
                  {streaming ? "홈캠 중지" : "홈캠 시작"}
                </Button>
                {permission &&
                  !permission.granted &&
                  !permission.canAskAgain && (
                    <Button secondary onPress={() => Linking.openSettings()}>
                      카메라 권한 설정 열기
                    </Button>
                  )}
                <Button secondary onPress={forget}>
                  이 휴대폰 연결 정보 지우기
                </Button>
                <Text style={styles.hint}>
                  연결은 최대 8시간 유효합니다. PC 웹에서 언제든 해제할 수
                  있습니다.
                </Text>
              </View>
            </>
          )}
          {!!message && (
            <Text accessibilityLiveRegion="polite" style={styles.message}>
              {message}
            </Text>
          )}
          <View style={styles.note}>
            <Text style={styles.section}>지금 가능한 것</Text>
            <Text style={styles.hint}>
              웹에서 실시간 화면 확인 · 사진 안전점검. 소리와 동영상은 저장하지
              않습니다. 앱을 내리거나 화면을 잠그면 중지됩니다. 사람·낙상 감지는
              아직 제공하지 않습니다.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.page },
  content: { padding: 24, paddingBottom: 48, gap: 20 },
  brand: {
    fontFamily: f.semibold,
    fontSize: 24,
    color: c.ink,
    marginBottom: 12,
  },
  eyebrow: { fontSize: 13, color: c.accent, fontFamily: f.medium },
  title: { fontSize: 32, lineHeight: 42, fontFamily: f.medium, color: c.ink },
  description: {
    fontSize: 15,
    lineHeight: 24,
    color: c.secondary,
    fontFamily: f.regular,
  },
  card: {
    backgroundColor: c.surface,
    borderRadius: 12,
    padding: 24,
    gap: 16,
    borderWidth: 1,
    borderColor: c.line,
  },
  section: { fontSize: 20, lineHeight: 28, fontFamily: f.medium, color: c.ink },
  hint: { fontSize: 13, lineHeight: 22, color: c.muted, fontFamily: f.regular },
  label: {
    fontSize: 14,
    color: c.secondary,
    marginTop: 8,
    fontFamily: f.medium,
  },
  input: {
    borderWidth: 1,
    borderColor: "#b6c1b8",
    borderRadius: 8,
    padding: 12,
    minHeight: 48,
    color: c.ink,
    backgroundColor: c.surface,
    fontSize: 15,
    fontFamily: f.regular,
  },
  code: {
    fontSize: 28,
    letterSpacing: 4,
    textAlign: "center",
    fontFamily: f.medium,
  },
  button: {
    backgroundColor: c.accent,
    minHeight: 48,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  secondary: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
  },
  buttonText: {
    color: "white",
    fontFamily: f.medium,
    fontSize: 15,
    lineHeight: 22,
  },
  preview: {
    aspectRatio: 3 / 4,
    overflow: "hidden",
    borderRadius: 12,
    backgroundColor: "#18211d",
  },
  qrPreview: {
    height: 280,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#18211d",
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 24,
  },
  placeholderTitle: { color: "#edf1ed", fontSize: 20, fontFamily: f.medium },
  placeholderText: {
    color: "#c5cfc8",
    fontSize: 14,
    lineHeight: 24,
    textAlign: "center",
    fontFamily: f.regular,
  },
  badge: {
    position: "absolute",
    top: 16,
    left: 16,
    backgroundColor: "#18211de6",
    padding: 12,
    borderRadius: 4,
  },
  badgeText: { color: "#fff", fontSize: 12, fontFamily: f.regular },
  message: {
    backgroundColor: c.raised,
    padding: 16,
    borderRadius: 8,
    color: c.secondary,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: f.regular,
  },
  note: { paddingTop: 24, borderTopWidth: 1, borderColor: c.line, gap: 12 },
});
