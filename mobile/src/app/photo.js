import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import PhotoScan from "../PhotoScan";
import { s } from "../ui";
export default function Photo() {
  return <SafeAreaView style={s.safe}><PhotoScan onBack={() => router.back()} /></SafeAreaView>;
}
