import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaView } from 'react-native-safe-area-context';
import PhotoScan from '../PhotoScan';
import { s } from '../ui';
export default function Photo() {
  const [server, setServer] = useState(null);
  useEffect(() => {
    let active = true;
    SecureStore.getItemAsync('atchacha.homecam.connection')
      .then((raw) => { if (active) setServer(raw ? JSON.parse(raw).server || '' : ''); })
      .catch(() => { if (active) setServer(''); });
    return () => { active = false; };
  }, []);
  return <SafeAreaView style={s.safe}>{server === null ? <Text>연결 정보 확인 중…</Text> : <PhotoScan initialServer={server} onBack={() => router.back()} />}</SafeAreaView>;
}
