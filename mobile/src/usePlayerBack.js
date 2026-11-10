import { useCallback } from "react";
import { BackHandler } from "react-native";
import { useFocusEffect } from "expo-router";
// Close the current player/scanner before navigating out of its setup screen.
export function usePlayerBack(active, onClose) {
  useFocusEffect(
    useCallback(() => {
      if (!active) return;
      const listener = BackHandler.addEventListener("hardwareBackPress", () => {
        onClose();
        return true;
      });
      return () => listener.remove();
    }, [active, onClose]),
  );
}
