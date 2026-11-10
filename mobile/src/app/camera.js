import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking, Text, View } from "react-native";
import { router } from "expo-router";
import { useCameraPermissions } from "expo-camera";
import * as SecureStore from "expo-secure-store";
import QRCode from "react-native-qrcode-svg";
import { Camera, QrCode } from "lucide-react-native";
import {
  Page,
  PageHeader,
  Section,
  Notice,
  Progress,
  Player,
  confirmAction,
} from "../appUi";
import { usePlayerBack } from "../usePlayerBack";
import Bridge from "../../modules/homecam-bridge";
import DirectVideo from "../DirectVideo";
import { CAMERA_STORAGE } from "../directProtocol";
import { Button, s } from "../ui";

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [host, setHost] = useState(null);
  const [qr, setQr] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const [message, setMessage] = useState("촬영 기기 준비 중…");
  const [streaming, setStreaming] = useState(false);
  const [busy, setBusy] = useState(true);
  const [prepared, setPrepared] = useState(false);
  const identity = useRef(null);
  const alive = useRef(true);
  const stop = useCallback(() => setStreaming(false), []);
  usePlayerBack(streaming, stop);

  useEffect(() => {
    let active = true;
    alive.current = true;
    async function prepare() {
      try {
        const raw = await SecureStore.getItemAsync(CAMERA_STORAGE);
        const saved = raw
          ? JSON.parse(raw)
          : { id: Bridge.createSecret(), token: Bridge.createSecret() };
        if (
          !/^[a-f0-9]{64}$/.test(saved.id) ||
          !/^[a-f0-9]{64}$/.test(saved.token)
        )
          throw new Error(
            "저장된 기기 정보를 확인하지 못했습니다. 앱 데이터를 초기화해 주세요.",
          );
        await SecureStore.setItemAsync(CAMERA_STORAGE, JSON.stringify(saved));
        if (!active) return;
        identity.current = saved;
        setPrepared(true);
        const address = await Bridge.start(saved.token, saved.id);
        if (active) {
          setHost(address);
          setMessage("기기 준비 완료. 처음 연결할 때 등록 QR을 만드세요.");
        } else Bridge.stop();
      } catch (error) {
        if (active) setMessage(error.message);
      } finally {
        if (active) setBusy(false);
      }
    }
    prepare();
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        setStreaming(false);
        setQr(null);
      }
    });
    return () => {
      active = false;
      alive.current = false;
      sub.remove();
      Bridge.stop();
    };
  }, []);
  useEffect(() => {
    if (!qr || seconds <= 0) return;
    const timer = setTimeout(
      () => setSeconds((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => clearTimeout(timer);
  }, [qr, seconds]);
  async function restart() {
    if (!prepared || busy) return;
    setBusy(true);
    setQr(null);
    try {
      const address = await Bridge.start(
        identity.current.token,
        identity.current.id,
      );
      if (!alive.current) {
        Bridge.stop();
        return;
      }
      setHost(address);
      setMessage("Tailscale 연결을 다시 확인했습니다.");
    } catch (error) {
      setHost(null);
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }
  function pairing() {
    if (busy || !host) return;
    try {
      const data = Bridge.newPairing();
      setSeconds(data.expiresIn);
      setQr(
        JSON.stringify({
          app: "atchacha-direct",
          version: 1,
          origin: host.origin,
          id: identity.current.id,
          pair: data.pair,
        }),
      );
    } catch (error) {
      setMessage(error.message);
    }
  }
  async function start() {
    if (busy || !host) return;
    setBusy(true);
    try {
      const allowed =
        permission?.granted || (await requestPermission()).granted;
      if (!allowed) {
        setMessage("기기 설정에서 카메라 권한을 허용해 주세요.");
        return;
      }
      if (!alive.current || AppState.currentState !== "active") return;
      setQr(null);
      setStreaming(true);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function revoke() {
    setBusy(true);
    setQr(null);
    setHost(null);
    try {
      const next = { id: identity.current.id, token: Bridge.createSecret() };
      await Bridge.stop();
      await SecureStore.setItemAsync(CAMERA_STORAGE, JSON.stringify(next));
      identity.current = next;
      if (!alive.current) return;
      const address = await Bridge.start(next.token, next.id);
      if (!alive.current) {
        Bridge.stop();
        return;
      }
      setHost(address);
      setMessage(
        "기존 모니터링 기기의 접근을 해제했습니다. 새 QR로 다시 등록하세요.",
      );
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }
  if (streaming)
    return (
      <Player
        note="충전기를 연결하고 앱과 화면을 켜 두세요. 화면을 잠그면 전송이 중지됩니다."
        controls={
          <Button icon={Camera} onPress={stop}>
            촬영 중지 · 기기 설정
          </Button>
        }
      >
        <DirectVideo camera onStop={stop} fit="contain" />
      </Player>
    );
  return (
    <Page>
      <PageHeader
        onBack={() => router.back()}
        eyebrow="홈캠 · 촬영용 휴대폰"
        title="우리 집을 담는 촬영용 공기계"
        description="연결 준비를 확인하고, 처음 한 번 QR로 등록하세요. 준비가 끝나면 촬영을 시작합니다."
      />
      <Progress
        labels={["연결 준비", "QR 등록", "촬영 시작"]}
        current={host ? 1 : 0}
      />
      <Notice loading={busy} tone={!host && !busy ? "error" : "info"}>
        {busy ? "기기 상태를 확인하고 있어요" : message}
      </Notice>
      {host && (
        <Section
          icon={QrCode}
          title="모니터링 기기 등록"
          subtitle="가지고 다니는 휴대폰의 ‘새 홈캠 QR 등록’으로 읽으세요. 이미 등록했다면 바로 촬영을 시작하면 됩니다."
        >
          {qr && seconds > 0 ? (
            <View
              style={{
                alignItems: "center",
                gap: 16,
                paddingVertical: 16,
                backgroundColor: "#fff",
                borderRadius: 12,
              }}
            >
              <QRCode
                value={qr}
                size={208}
                backgroundColor="#fff"
                color="#1d1d1f"
              />
              <Text style={s.text}>{seconds}초 남음 · 1회 사용</Text>
              <Button secondary onPress={() => setQr(null)}>
                QR 닫기
              </Button>
            </View>
          ) : (
            <Button secondary icon={QrCode} disabled={busy} onPress={pairing}>
              {qr ? "새 등록 QR 만들기" : "등록 QR 만들기"}
            </Button>
          )}
          {qr && seconds === 0 && (
            <Notice>QR이 만료됐습니다. 새 QR을 만들어 주세요.</Notice>
          )}
          <Button icon={Camera} disabled={busy} onPress={start}>
            촬영 시작
          </Button>
        </Section>
      )}
      {permission && !permission.granted && !permission.canAskAgain && (
        <Button secondary onPress={() => Linking.openSettings()}>
          카메라 권한 설정 열기
        </Button>
      )}
      <Section
        title="연결이 안 될 때"
        subtitle="두 휴대폰에서 같은 계정의 Tailscale을 켜 주세요. 연결을 확인한 뒤 다시 시도할 수 있어요."
      >
        <Button secondary disabled={busy || !prepared} onPress={restart}>
          Tailscale 연결 다시 확인
        </Button>
      </Section>
      <Text style={s.footnote}>
        등록 후에는 장소가 달라도 볼 수 있습니다. PC는 필요하지 않으며 소리와
        영상을 저장하지 않습니다.
      </Text>
      {host && (
        <Button
          danger
          disabled={busy}
          onPress={() =>
            confirmAction(
              "등록된 기기를 모두 해제할까요?",
              "기존 모니터링 휴대폰은 영상을 볼 수 없게 됩니다. 새 QR로 다시 등록해야 합니다.",
              revoke,
            )
          }
        >
          등록된 모니터링 기기 모두 해제
        </Button>
      )}
    </Page>
  );
}
