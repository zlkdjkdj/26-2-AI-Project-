import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as SecureStore from 'expo-secure-store';
import DirectVideo from '../DirectVideo';
import { directRequest, parseDirectQr, savedCamera, VIEWER_STORAGE } from '../directProtocol';
import { Button, s } from '../ui';

export default function ViewerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [connection, setConnection] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [watching, setWatching] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fit, setFit] = useState('contain');
  const [message, setMessage] = useState('');
  const lock = useRef(false);
  const alive = useRef(true);
  const stop = useCallback(() => setWatching(false), []);
  useEffect(() => {
    alive.current = true;
    SecureStore.getItemAsync(VIEWER_STORAGE).then((raw) => {
      if (raw && alive.current) setConnection(savedCamera(JSON.parse(raw)));
    }).catch(() => { if (alive.current) setMessage('기기 정보를 복원하지 못했습니다. QR로 다시 등록하세요.'); })
      .finally(() => { if (alive.current) setLoaded(true); });
    return () => { alive.current = false; };
  }, []);
  async function scan() {
    const allowed = permission?.granted || (await requestPermission()).granted;
    if (!allowed) { setMessage('QR 등록을 위해 카메라 권한이 필요합니다.'); return; }
    lock.current = false; setScanning(true); setMessage('');
  }
  async function read({ data }) {
    if (lock.current) return;
    lock.current = true; setScanning(false); setBusy(true);
    try {
      const qr = parseDirectQr(data);
      const result = await directRequest(qr.origin, '/v1/pair', { json: { pair: qr.pair } });
      if (result.id !== qr.id) throw new Error('등록 기기가 일치하지 않습니다.');
      const saved = savedCamera({ origin: qr.origin, ...result });
      await SecureStore.setItemAsync(VIEWER_STORAGE, JSON.stringify(saved));
      if (alive.current) { setConnection(saved); setMessage('등록 완료. 공기계에서 촬영 시작을 누른 뒤 영상을 확인하세요.'); }
    } catch (error) { if (alive.current) setMessage(error.message); }
    finally { if (alive.current) setBusy(false); }
  }
  async function forget() {
    await SecureStore.deleteItemAsync(VIEWER_STORAGE); setConnection(null);
    setMessage('이 휴대폰의 등록 정보를 삭제했습니다. 접근 권한 자체를 해제하려면 공기계에서도 기기 해제를 눌러 주세요.');
  }
  if (watching) return <SafeAreaView style={s.safe}>
    <DirectVideo camera={false} connection={connection} fit={fit} onStop={stop} />
    <View style={s.toolbar}>
      <Button secondary onPress={() => setFit((value) => value === 'contain' ? 'cover' : 'contain')}>{fit === 'contain' ? '화면 가득 확대' : '원본 비율로 보기'}</Button>
      <Button onPress={stop}>영상 닫기</Button>
    </View>
  </SafeAreaView>;
  if (scanning) return <SafeAreaView style={s.safe}>
    <CameraView style={{ flex: 1 }} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={read} />
    <View style={s.toolbar}><Text style={s.text}>공기계의 등록 QR을 화면에 맞춰 주세요.</Text><Button onPress={() => setScanning(false)}>스캔 취소</Button></View>
  </SafeAreaView>;
  return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.content}>
    <Button secondary onPress={() => router.back()}>← 홈으로</Button>
    <Text style={s.eyebrow}>MONITORING DEVICE</Text><Text style={s.title}>멀리 있어도,{"\n"}바로 확인하세요.</Text>
    <Text style={s.text}>Tailscale을 켜면 모바일 데이터나 다른 Wi-Fi에서도 등록한 공기계의 영상을 볼 수 있습니다.</Text>
    {message ? <Text style={s.message}>{message}</Text> : null}
    {connection && <View style={s.card}><Text style={s.section}>등록된 우리집 홈캠</Text><Text style={s.text}>공기계에서 촬영 중인지 확인하세요. 영상은 이 화면에서만 재생됩니다.</Text><Button disabled={busy} onPress={() => setWatching(true)}>실시간 영상 보기</Button></View>}
    <Button secondary disabled={!loaded || busy} onPress={scan}>{busy ? '기기 등록 중…' : '새 홈캠 QR 등록'}</Button>
    {connection && <Button secondary disabled={busy} onPress={forget}>이 휴대폰의 등록 정보 삭제</Button>}
    <Text style={s.text}>QR 등록은 두 휴대폰이 함께 있을 때 한 번만 진행하세요. 계정 가입·PC 서버 주소 입력 없이 연결됩니다.</Text>
  </ScrollView></SafeAreaView>;
}
