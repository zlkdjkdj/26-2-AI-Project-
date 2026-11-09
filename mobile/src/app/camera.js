import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useCameraPermissions } from 'expo-camera';
import * as SecureStore from 'expo-secure-store';
import QRCode from 'react-native-qrcode-svg';
import Bridge from '../../modules/homecam-bridge';
import DirectVideo from '../DirectVideo';
import { CAMERA_STORAGE } from '../directProtocol';
import { Button, s } from '../ui';

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [host, setHost] = useState(null);
  const [qr, setQr] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const [message, setMessage] = useState('촬영 기기 준비 중…');
  const [streaming, setStreaming] = useState(false);
  const [busy, setBusy] = useState(false);
  const identity = useRef(null);
  const stop = useCallback(() => setStreaming(false), []);

  useEffect(() => {
    let active = true;
    async function prepare() {
      try {
        const raw = await SecureStore.getItemAsync(CAMERA_STORAGE);
        const saved = raw ? JSON.parse(raw) : { id: Bridge.createSecret(), token: Bridge.createSecret() };
        if (!/^[a-f0-9]{64}$/.test(saved.id) || !/^[a-f0-9]{64}$/.test(saved.token)) throw new Error('저장된 기기 정보를 확인하지 못했습니다. 앱 데이터를 초기화해 주세요.');
        await SecureStore.setItemAsync(CAMERA_STORAGE, JSON.stringify(saved));
        if (!active) return;
        identity.current = saved;
        const address = await Bridge.start(saved.token, saved.id);
        if (active) { setHost(address); setMessage('기기 준비 완료. 처음 연결할 때 등록 QR을 만드세요.'); }
        else Bridge.stop();
      } catch (error) { if (active) setMessage(error.message); }
    }
    prepare();
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') { setStreaming(false); setQr(null); }
    });
    return () => { active = false; sub.remove(); Bridge.stop(); };
  }, []);
  useEffect(() => {
    if (!qr) return;
    const timer = setInterval(() => setSeconds((current) => Math.max(0, current - 1)), 1000);
    return () => clearInterval(timer);
  }, [qr]);
  async function restart() {
    setBusy(true); setQr(null);
    try {
      const address = await Bridge.start(identity.current.token, identity.current.id);
      setHost(address); setMessage('Tailscale 연결을 다시 확인했습니다.');
    } catch (error) { setHost(null); setMessage(error.message); }
    finally { setBusy(false); }
  }
  function pairing() {
    const data = Bridge.newPairing();
    setSeconds(data.expiresIn);
    setQr(JSON.stringify({ app: 'atchacha-direct', version: 1, origin: host.origin, id: identity.current.id, pair: data.pair }));
  }
  async function start() {
    const allowed = permission?.granted || (await requestPermission()).granted;
    if (!allowed) { setMessage('기기 설정에서 카메라 권한을 허용해 주세요.'); return; }
    setQr(null); setStreaming(true);
  }
  async function revoke() {
    setBusy(true); setQr(null); setHost(null);
    try {
      const next = { id: identity.current.id, token: Bridge.createSecret() };
      await Bridge.stop();
      await SecureStore.setItemAsync(CAMERA_STORAGE, JSON.stringify(next));
      identity.current = next;
      const address = await Bridge.start(next.token, next.id);
      setHost(address); setMessage('기존 모니터링 기기의 접근을 해제했습니다. 새 QR로 다시 등록하세요.');
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  if (streaming) return <SafeAreaView style={s.safe}>
    <DirectVideo camera onStop={stop} fit="contain" />
    <View style={s.toolbar}><Text style={s.text}>충전기를 연결하고 이 화면을 켜 두세요.</Text><Button onPress={stop}>촬영 중지 · 기기 설정</Button></View>
  </SafeAreaView>;
  return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.content}>
    <Button secondary onPress={() => router.back()}>← 홈으로</Button>
    <Text style={s.eyebrow}>CAMERA DEVICE</Text><Text style={s.title}>우리집을 지키는{"\n"}촬영용 공기계.</Text>
    <Text style={s.message}>{message}</Text>
    {host && <View style={s.card}>
      <Text style={s.section}>처음 한 번, QR로 등록</Text>
      <Text style={s.text}>모니터링 휴대폰에서 ‘새 홈캠 QR 등록’을 누르세요. QR은 2분간 한 번만 사용할 수 있습니다.</Text>
      <Button secondary onPress={pairing}>새 등록 QR 만들기</Button>
      {qr && seconds > 0 && <View style={{ alignItems: 'center', gap: 12, paddingVertical: 12 }}>
        <QRCode value={qr} size={232} backgroundColor="#fff" color="#173d2b" />
        <Text style={s.text}>{seconds}초 남음 · 등록 후 QR을 닫아 주세요</Text>
      </View>}
      {qr && seconds === 0 && <Text style={s.text}>QR이 만료되었습니다. 새 QR을 만드세요.</Text>}
      <Button onPress={start} disabled={busy}>촬영 시작</Button>
    </View>}
    <Text style={s.text}>두 기기 모두 같은 Tailscale 계정으로 연결하세요. 등록 이후에는 장소가 달라도 볼 수 있습니다. PC·개발 서버는 필요하지 않습니다.</Text>
    <Button secondary disabled={busy} onPress={restart}>Tailscale 연결 다시 확인</Button>
    {host && <Button danger disabled={busy} onPress={revoke}>등록된 모니터링 기기 모두 해제</Button>}
  </ScrollView></SafeAreaView>;
}
