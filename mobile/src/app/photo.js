import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { SafeAreaView } from "react-native-safe-area-context";
import PhotoScan from "../PhotoScan";
import { PHOTO_SERVER_STORAGE, preferredPhotoServer } from "../photoConnection";
import { colors, s } from "../ui";
export default function Photo() {
  const [server, setServer] = useState(null);
  useEffect(() => {
    let active = true;
    Promise.all([
      SecureStore.getItemAsync(PHOTO_SERVER_STORAGE),
      SecureStore.getItemAsync("atchacha.homecam.connection"),
    ])
      .then(([saved, legacy]) => {
        if (active) setServer(preferredPhotoServer(saved, legacy));
      })
      .catch(() => {
        if (active) setServer("");
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <SafeAreaView style={s.safe}>
      {server === null ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
          }}
        >
          <ActivityIndicator color={colors.accent} />
          <Text style={s.text}>사진 점검 연결 정보 확인 중…</Text>
        </View>
      ) : (
        <PhotoScan initialServer={server} onBack={() => router.back()} />
      )}
    </SafeAreaView>
  );
}
