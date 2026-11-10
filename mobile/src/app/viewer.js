import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Text, View } from "react-native";
import { router } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as SecureStore from "expo-secure-store";
import DirectVideo from "../DirectVideo";
import { Monitor, QrCode } from "lucide-react-native";
import {
  Page,
  PageHeader,
  Section,
  Notice,
  Player,
  ScanFinder,
  confirmAction,
} from "../appUi";
import { usePlayerBack } from "../usePlayerBack";
import {
  directRequest,
  parseDirectQr,
  savedCamera,
  VIEWER_STORAGE,
} from "../directProtocol";
import { Button, s } from "../ui";

export default function ViewerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [connection, setConnection] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [watching, setWatching] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fit, setFit] = useState("contain");
  const [message, setMessage] = useState("");
  const lock = useRef(false);
  const alive = useRef(true);
  const stop = useCallback(() => setWatching(false), []);
  const closeScan = useCallback(() => setScanning(false), []);
  const closeActive = useCallback(() => {
    setWatching(false);
    setScanning(false);
  }, []);
  usePlayerBack(watching || scanning, closeActive);
  useEffect(() => {
    alive.current = true;
    SecureStore.getItemAsync(VIEWER_STORAGE)
      .then((raw) => {
        if (raw && alive.current) setConnection(savedCamera(JSON.parse(raw)));
      })
      .catch(() => {
        if (alive.current)
          setMessage("기기 정보를 복원하지 못했습니다. QR로 다시 등록하세요.");
      })
      .finally(() => {
        if (alive.current) setLoaded(true);
      });
    return () => {
      alive.current = false;
    };
  }, []);
  async function scan() {
    if (!loaded || busy) return;
    setBusy(true);
    try {
      const allowed =
        permission?.granted || (await requestPermission()).granted;
      if (!allowed) {
        setMessage("QR 등록을 위해 카메라 권한이 필요합니다.");
        return;
      }
      lock.current = false;
      setScanning(true);
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function read({ data }) {
    if (lock.current) return;
    lock.current = true;
    setScanning(false);
    setBusy(true);
    try {
      const qr = parseDirectQr(data);
      const result = await directRequest(qr.origin, "/v1/pair", {
        json: { pair: qr.pair },
      });
      if (result.id !== qr.id)
        throw new Error("등록 기기가 일치하지 않습니다.");
      const saved = savedCamera({ origin: qr.origin, ...result });
      await SecureStore.setItemAsync(VIEWER_STORAGE, JSON.stringify(saved));
      if (alive.current) {
        setConnection(saved);
        setMessage(
          "등록 완료. 공기계에서 촬영 시작을 누른 뒤 영상을 확인하세요.",
        );
      }
    } catch (error) {
      if (alive.current) setMessage(error.message);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function forget() {
    setBusy(true);
    try {
      await SecureStore.deleteItemAsync(VIEWER_STORAGE);
      setConnection(null);
      setMessage(
        "이 휴대폰의 등록 정보를 삭제했습니다. 접근 권한을 해제하려면 공기계에서도 기기 해제를 눌러 주세요.",
      );
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }
  if (watching)
    return (
      <Player
        note={
          fit === "cover"
            ? "화면을 가득 채우는 중입니다. 영상 가장자리가 잘릴 수 있어요."
            : "전체 영상이 보이는 원본 비율입니다."
        }
        controls={
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Button
                secondary
                onPress={() =>
                  setFit((value) => (value === "contain" ? "cover" : "contain"))
                }
              >
                {fit === "contain" ? "화면 가득 확대" : "원본 비율"}
              </Button>
            </View>
            <View style={{ flex: 1 }}>
              <Button onPress={stop}>영상 닫기</Button>
            </View>
          </View>
        }
      >
        <DirectVideo
          camera={false}
          connection={connection}
          fit={fit}
          onStop={stop}
        />
      </Player>
    );
  if (scanning)
    return (
      <Player controls={<Button onPress={closeScan}>스캔 취소</Button>}>
        <CameraView
          style={{ flex: 1 }}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={read}
        />
        <ScanFinder />
      </Player>
    );
  return (
    <Page>
      <PageHeader
        onBack={() => router.back()}
        eyebrow="홈캠 · 모니터링 휴대폰"
        title="떨어져 있어도 바로 확인하세요"
        description="등록된 홈캠을 열거나, 공기계의 QR을 처음 한 번 읽어 연결하세요."
      />
      {!loaded && <Notice loading>등록한 기기를 확인하고 있어요</Notice>}
      {message ? <Notice>{message}</Notice> : null}
      {connection ? (
        <Section
          dark
          icon={Monitor}
          title="등록된 우리 집 홈캠"
          subtitle="등록 정보가 저장돼 있습니다. 공기계에서 촬영을 시작한 뒤 영상을 열어 주세요."
        >
          <Button
            disabled={!loaded || busy}
            icon={Monitor}
            onPress={() => setWatching(true)}
          >
            실시간 영상 보기
          </Button>
        </Section>
      ) : (
        loaded && (
          <Section
            icon={QrCode}
            title="첫 홈캠을 등록해 볼까요"
            subtitle="촬영용 공기계에서 ‘등록 QR 만들기’를 누르고, 이 휴대폰으로 읽어 주세요."
          >
            <Button icon={QrCode} disabled={busy} onPress={scan}>
              {busy ? "기기 등록 중…" : "새 홈캠 QR 등록"}
            </Button>
          </Section>
        )
      )}
      {connection && (
        <Button
          secondary
          icon={QrCode}
          disabled={!loaded || busy}
          onPress={scan}
        >
          새 홈캠 QR 등록
        </Button>
      )}
      {permission && !permission.granted && !permission.canAskAgain && (
        <Button secondary onPress={() => Linking.openSettings()}>
          QR 카메라 권한 설정
        </Button>
      )}
      <Text style={s.footnote}>
        두 기기 모두 Tailscale을 켜 주세요. 등록 이후에는 모바일 데이터나 다른
        Wi-Fi에서도 볼 수 있습니다. 앱과 화면을 켜 둔 동안 영상이 전송됩니다.
      </Text>
      {connection && (
        <Button
          danger
          disabled={busy}
          onPress={() =>
            confirmAction(
              "이 휴대폰의 등록을 지울까요?",
              "다시 보려면 공기계의 QR을 새로 읽어야 합니다. 공기계의 접근 권한 자체는 공기계에서 해제할 수 있습니다.",
              forget,
            )
          }
        >
          이 휴대폰의 등록 정보 삭제
        </Button>
      )}
    </Page>
  );
}
