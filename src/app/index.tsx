import { useEffect, useState } from "react";
import { View, Image, StyleSheet } from "react-native";
import { Redirect } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";

import { useAuthStore } from "@/stores/useAuthStore";
import { useSettingsStore } from "@/stores/useSettingsStore";

const SPLASH_DURATION_MS = 1600;

export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasSeenOnboarding = useSettingsStore((s) => s.hasSeenOnboarding);
  const [splashDone, setSplashDone] = useState(false);

  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, {
      duration: 700,
      easing: Easing.out(Easing.quad),
    });
    const timer = setTimeout(() => setSplashDone(true), SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (splashDone) {
    if (isAuthenticated) return <Redirect href="/(app)/(home)" />;
    if (!hasSeenOnboarding) return <Redirect href="/(auth)/onboarding" />;
    return <Redirect href="/(auth)/welcome" />;
  }

  return (
    <View style={styles.container}>
      <Animated.View style={logoStyle}>
        <Image
          source={require("../../assets/images/logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 120,
    height: 120,
  },
});
