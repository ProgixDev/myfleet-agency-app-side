import React from "react";
import { Dimensions, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import * as Linking from "expo-linking";
import { Image } from "@/components/ui/Image";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { ArrowRight, ChevronRight } from "lucide-react-native";

import { WEB_ADMIN_URL } from "@/config/webAdmin";
import { fontFamilies } from "@/theme/typography";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const ACCENT = "#7C3AED";
const ACCENT_SOFT = "#A855F7";

export default function WelcomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const goRegister = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void Linking.openURL(`${WEB_ADMIN_URL}/signup`);
  };
  const goLogin = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/(auth)/login");
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#0A0510" }}>
      <StatusBar style="light" />

      {/* ── Background image ───────────────────────────────────── */}
      <Image
        source={require("../../../assets/images/auth.jpg")}
        style={{
          width: SCREEN_WIDTH,
          height: SCREEN_HEIGHT,
          position: "absolute",
        }}
        contentFit="cover"
        transition={400}
      />

      {/* ── Bottom gradient ────────────────────────────────────── */}
      <LinearGradient
        colors={[
          "transparent",
          "rgba(10, 5, 16, 0.35)",
          "rgba(10, 5, 16, 0.85)",
          "rgba(10, 5, 16, 1)",
        ]}
        locations={[0, 0.35, 0.7, 1]}
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: SCREEN_HEIGHT * 0.7,
        }}
        pointerEvents="none"
      />

      {/* ── Top: centered logo pill ────────────────────────────── */}
      <View
        style={{
          position: "absolute",
          top: 60,
          left: 0,
          right: 0,
          alignItems: "center",
          zIndex: 10,
        }}
        pointerEvents="box-none"
      >
        <Animated.View entering={FadeIn.duration(500)}>
          <BlurView
            intensity={30}
            tint="dark"
            style={{
              alignItems: "center",
              justifyContent: "center",
              width: 48,
              height: 48,
              borderRadius: 9999,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.15)",
            }}
          >
            <Image
              source={require("../../../assets/images/logo.png")}
              style={{ width: 30, height: 30 }}
              contentFit="contain"
            />
          </BlurView>
        </Animated.View>
      </View>

      {/* ── Feature chips ─────────────────────────────────────── */}
      <Animated.View
        entering={FadeInUp.duration(500).delay(100)}
        style={{
          position: "absolute",
          top: 130,
          left: 0,
          right: 0,
          flexDirection: "row",
          justifyContent: "center",
          gap: 6,
          zIndex: 10,
        }}
      >
        {["chip1", "chip2", "chip3"].map((k) => (
          <BlurView
            key={k}
            intensity={30}
            tint="dark"
            style={{
              paddingHorizontal: 11,
              paddingVertical: 6,
              borderRadius: 9999,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.12)",
            }}
          >
            <Animated.Text
              style={{
                fontFamily: fontFamilies.medium,
                fontSize: 11,
                color: "rgba(255, 255, 255, 0.9)",
                letterSpacing: 0.3,
              }}
            >
              {t(`auth.welcome.${k}`)}
            </Animated.Text>
          </BlurView>
        ))}
      </Animated.View>

      {/* ── Bottom glass card ──────────────────────────────────── */}
      <Animated.View
        entering={FadeInDown.duration(600).delay(150)}
        style={{
          position: "absolute",
          bottom: 40,
          left: 16,
          right: 16,
        }}
      >
        <View
          style={{
            borderRadius: 32,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.08)",
          }}
        >
          <BlurView
            intensity={50}
            tint="dark"
            style={{
              padding: 22,
              backgroundColor: "rgba(10, 5, 16, 0.55)",
            }}
          >
            {/* Title + accent bar + tagline */}
            <Animated.Text
              style={{
                fontFamily: fontFamilies.bold,
                fontSize: 36,
                color: "#FFFFFF",
                letterSpacing: 3,
                marginBottom: 8,
              }}
            >
              {t("auth.welcome.title")}
            </Animated.Text>

            <View
              style={{
                width: 40,
                height: 3,
                borderRadius: 2,
                backgroundColor: ACCENT,
                marginBottom: 12,
              }}
            />

            <Animated.Text
              style={{
                fontFamily: fontFamilies.regular,
                fontSize: 14,
                lineHeight: 21,
                color: "rgba(255, 255, 255, 0.75)",
                marginBottom: 22,
              }}
            >
              {t("auth.welcome.tagline")}
            </Animated.Text>

            {/* Primary CTA pill (accent circle + chevron trio) */}
            <Pressable
              onPress={goRegister}
              style={({ pressed }) => ({
                opacity: pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
                marginBottom: 10,
              })}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "rgba(255, 255, 255, 0.08)",
                  borderRadius: 9999,
                  padding: 6,
                  paddingRight: 18,
                  borderWidth: 1,
                  borderColor: "rgba(124, 58, 237, 0.35)",
                }}
              >
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    backgroundColor: ACCENT,
                    alignItems: "center",
                    justifyContent: "center",
                    shadowColor: ACCENT,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.6,
                    shadowRadius: 12,
                    elevation: 8,
                  }}
                >
                  <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.2} />
                </View>
                <Animated.Text
                  style={{
                    flex: 1,
                    textAlign: "center",
                    fontFamily: fontFamilies.semiBold,
                    fontSize: 15,
                    color: "#FFFFFF",
                    letterSpacing: 0.3,
                    marginLeft: -42,
                  }}
                >
                  {t("auth.welcome.getStarted")}
                </Animated.Text>
                <View style={{ flexDirection: "row", gap: 2 }}>
                  <ChevronRight
                    size={14}
                    color="rgba(168, 85, 247, 0.5)"
                    strokeWidth={2.4}
                  />
                  <ChevronRight
                    size={14}
                    color="rgba(168, 85, 247, 0.75)"
                    strokeWidth={2.4}
                    style={{ marginLeft: -8 }}
                  />
                  <ChevronRight
                    size={14}
                    color={ACCENT_SOFT}
                    strokeWidth={2.4}
                    style={{ marginLeft: -8 }}
                  />
                </View>
              </View>
            </Pressable>

            {/* Secondary CTA — outlined glass pill */}
            <Pressable
              onPress={goLogin}
              style={({ pressed }) => ({
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <View
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  paddingVertical: 13,
                  borderRadius: 9999,
                  backgroundColor: "rgba(255, 255, 255, 0.04)",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.12)",
                }}
              >
                <Animated.Text
                  style={{
                    fontFamily: fontFamilies.medium,
                    fontSize: 14,
                    color: "rgba(255, 255, 255, 0.85)",
                    letterSpacing: 0.3,
                  }}
                >
                  {t("auth.welcome.signIn")}
                </Animated.Text>
              </View>
            </Pressable>
          </BlurView>
        </View>
      </Animated.View>
    </View>
  );
}
