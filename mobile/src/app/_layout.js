import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { SafeAreaProvider } from "react-native-safe-area-context";
export default function Layout() {
  const [loaded, error] = useFonts({
    "SUIT-Regular": require("../../assets/fonts/SUIT-Regular.ttf"),
    "SUIT-Medium": require("../../assets/fonts/SUIT-Medium.ttf"),
    "SUIT-SemiBold": require("../../assets/fonts/SUIT-SemiBold.ttf"),
  });
  if (!loaded && !error) return null;
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#f5f5f7" },
        }}
      />
    </SafeAreaProvider>
  );
}
