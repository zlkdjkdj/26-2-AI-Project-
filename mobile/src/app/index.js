import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, s } from '../ui';
export default function Home() {
  return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.content}>
    <Text style={s.brand}>앗차차.</Text>
    <Text style={s.eyebrow}>MY PRIVATE HOME CAM</Text>
    <Text style={s.title}>남는 휴대폰으로,{"\n"}어디서든 우리집.</Text>
    <Text style={s.text}>PC를 켜 두지 않아도 괜찮아요. 두 휴대폰에서 Tailscale을 켜고, 각 기기의 역할을 선택하세요.</Text>
    <View style={s.card}>
      <Text style={s.section}>01  촬영용 공기계</Text>
      <Text style={s.text}>집에 두는 휴대폰에서 선택하세요. 등록 QR을 보여 준 뒤, 충전기를 연결하고 촬영을 시작합니다.</Text>
      <Button onPress={() => router.push('/camera')}>이 휴대폰으로 촬영하기</Button>
    </View>
    <View style={s.card}>
      <Text style={s.section}>02  모니터링 휴대폰</Text>
      <Text style={s.text}>평소 쓰는 휴대폰에서 선택하세요. QR 등록은 처음 한 번만, 다음부터는 바로 영상을 확인하세요.</Text>
      <Button onPress={() => router.push('/viewer')}>등록한 홈캠 보기</Button>
    </View>
    <Text style={s.message}>촬영용 공기계는 앱과 화면을 켜 둡니다. 소리·녹화 없이 실시간 영상만 전송합니다.</Text>
    <View style={s.card}>
      <Text style={s.section}>기존 안전점검</Text>
      <Text style={s.text}>사진 위험 분석과 PC 웹 홈캠도 계속 사용할 수 있어요. 이 기능에는 기존 PC 서버가 필요합니다.</Text>
      <Button secondary onPress={() => router.push('/photo')}>사진 안전점검</Button>
      <Button secondary onPress={() => router.push('/legacy')}>PC 웹 홈캠 연결</Button>
    </View>
  </ScrollView></SafeAreaView>;
}
