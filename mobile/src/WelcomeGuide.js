import { useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { Camera, ScanLine, ShieldCheck } from "lucide-react-native";

const KEY = "atchacha.intro.v2";
const slides = [
  { icon: ShieldCheck, title: "우리 집을 살피는\n두 가지 방법", body: "홈캠으로 실시간 영상을 확인하고, 사진 안전점검으로 공간의 위험 후보와 개선 방법을 살펴보세요." },
  { icon: Camera, title: "홈캠 연결 준비", body: "두 휴대폰에 앗차차와 Tailscale을 설치하세요. 같은 Tailscale 계정으로 로그인하고 두 기기 모두 연결합니다." },
  { icon: Camera, title: "QR로 홈캠 등록", body: "집에 둘 기기에서 촬영용을 선택해 QR을 만드세요. 볼 기기에서 모니터링용을 선택하고 QR을 읽은 뒤, 촬영을 시작하세요." },
  { icon: Camera, title: "밖에서도 실시간 확인", body: "두 기기에 인터넷과 Tailscale이 연결되어 있으면 다른 Wi-Fi나 모바일 데이터에서도 볼 수 있어요. 촬영 기기는 충전하며 앱과 화면을 켜 두세요." },
  { icon: ScanLine, title: "사진 안전점검 준비", body: "가구 모델을 한 번 내려받고 가구·바닥·통로가 함께 나오도록 찍으세요. 전선·플러그 등 추가 점검에는 별도 모델이 필요해요." },
  { icon: ScanLine, title: "결과와 권고 확인", body: "종합 피드백에서 먼저 확인할 항목을 보고, 번호를 누르면 해당 박스만 표시돼요. 사진을 눌러 확대하고 실제 위험 여부도 확인하세요." },
];
export default function WelcomeGuide({ visible, onClose }) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - 40, 420);
  const slideWidth = cardWidth - 48;
  const [page, setPage] = useState(0);
  const scroll = useRef(null);
  function next() { if (page === slides.length - 1) onClose(); else scroll.current?.scrollTo({ x: slideWidth * (page + 1), animated: true }); }
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.overlay}><View style={[styles.card, { width: cardWidth }]}>
      <View style={styles.top}><Text style={styles.brand}>ATCHACHA</Text><Pressable onPress={onClose} accessibilityRole="button"><Text style={styles.skip}>건너뛰기</Text></Pressable></View>
      <ScrollView ref={scroll} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={e => setPage(Math.round(e.nativeEvent.contentOffset.x / slideWidth))}>
        {slides.map(({icon: Icon,title,body}) => <View key={title} style={{width: slideWidth}}><View style={styles.illustration}><View style={styles.icon}><Icon size={48} strokeWidth={1.7} color="#fff" /></View></View><Text style={styles.title}>{title}</Text><Text style={styles.body}>{body}</Text></View>)}
      </ScrollView>
      <View style={styles.footer}><View style={styles.dots}>{slides.map((_,i)=><View key={i} style={[styles.dot,i===page&&styles.active]} />)}</View><Text style={styles.hint}>밀어서 둘러보기</Text></View>
      <Pressable onPress={next} accessibilityRole="button" style={styles.button}><Text style={styles.buttonText}>{page === slides.length-1 ? "시작하기" : "다음"}</Text></Pressable>
    </View></View>
  </Modal>;
}
export async function hasSeenGuide() { try { return (await SecureStore.getItemAsync(KEY)) === "1"; } catch { return false; } }
export async function saveGuideSeen() { try { await SecureStore.setItemAsync(KEY,"1"); } catch {} }
const styles=StyleSheet.create({
 overlay:{flex:1,justifyContent:"center",alignItems:"center",backgroundColor:"rgba(0,0,0,0.65)"},card:{backgroundColor:"#fff",borderRadius:28,padding:24},top:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:20},brand:{fontSize:12,fontWeight:"800",letterSpacing:1.2,color:"#0866d9"},skip:{fontSize:14,color:"#777"},illustration:{height:120,backgroundColor:"#eaf3ff",borderRadius:22,justifyContent:"center",alignItems:"center"},icon:{width:80,height:80,borderRadius:26,backgroundColor:"#0866d9",justifyContent:"center",alignItems:"center"},title:{fontSize:24,lineHeight:32,fontWeight:"800",color:"#121720",marginTop:18},body:{fontSize:15,lineHeight:23,color:"#606978",marginTop:12,minHeight:115},footer:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginVertical:16},dots:{flexDirection:"row",gap:6},dot:{width:7,height:7,borderRadius:4,backgroundColor:"#d8dce4"},active:{width:22,backgroundColor:"#0866d9"},hint:{fontSize:12,color:"#88909d"},button:{height:54,borderRadius:14,backgroundColor:"#0866d9",alignItems:"center",justifyContent:"center"},buttonText:{fontSize:16,fontWeight:"700",color:"#fff"},
});
