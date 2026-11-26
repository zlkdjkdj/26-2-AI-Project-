import { Redirect, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import PhotoScan from "../PhotoScan";
import { s } from "../ui";
import { IS_TABLET } from "../variant";
export default function Photo() {
  if (IS_TABLET) return <Redirect href="/homecam" />;
  return <SafeAreaView style={s.safe}><PhotoScan onBack={() => router.back()} /></SafeAreaView>;
}
