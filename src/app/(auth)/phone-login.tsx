import React, { useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { StatusBar } from "expo-status-bar";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Phone,
} from "lucide-react-native";

import { Text } from "@/components/ui/Text";
import { Input } from "@/components/ui/Input";
import { useTheme } from "@/hooks/useTheme";
import { fontFamilies } from "@/theme/typography";

const ACCENT = "#7C3AED";

export default function PhoneLoginScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | undefined>();

  const validate = (): boolean => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 8) {
      setError(t("auth.validation.phoneRequired"));
      return false;
    }
    return true;
  };

  const handleContinue = () => {
    Keyboard.dismiss();
    if (!validate()) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: "/(auth)/otp",
      params: { phone: phone.trim(), flow: "signin" },
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar style={theme.background === "#050404" ? "light" : "dark"} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Top chrome */}
        <View
          style={{
            paddingTop: insets.top + 8,
            paddingHorizontal: 20,
            paddingBottom: 14,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: theme.surfaceTertiary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ChevronLeft size={20} color={theme.textPrimary} strokeWidth={2} />
          </Pressable>

          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: theme.accentSoft,
              borderWidth: 1,
              borderColor: ACCENT,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Image
              source={require("../../../assets/images/logo.png")}
              style={{ width: 26, height: 26 }}
              contentFit="contain"
            />
          </View>

          <View style={{ width: 40 }} />
        </View>

        <View
          style={{
            flex: 1,
            paddingHorizontal: 24,
            paddingBottom: insets.bottom + 16,
          }}
        >
          <Animated.View
            entering={FadeInDown.duration(400)}
            style={{ marginTop: 12, marginBottom: 24 }}
          >
            <Text
              variant="headlineLarge"
              style={{ fontFamily: fontFamilies.bold }}
            >
              {t("auth.phoneLoginScreen.title")}
            </Text>
            <Text
              variant="bodyMedium"
              color={theme.textSecondary}
              style={{ marginTop: 4 }}
            >
              {t("auth.phoneLoginScreen.subtitle")}
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(400).delay(100)}>
            <Input
              label={t("auth.phoneLoginScreen.phoneLabel")}
              placeholder={t("auth.phoneLoginScreen.phonePlaceholder")}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={(v) => {
                setPhone(v);
                if (error) setError(undefined);
              }}
              leftIcon={Phone}
              error={error}
            />
          </Animated.View>

          <View style={{ flex: 1 }} />

          <Pressable
            onPress={handleContinue}
            style={({ pressed }) => ({
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: ACCENT,
                borderRadius: 9999,
                padding: 6,
                paddingRight: 18,
                shadowColor: ACCENT,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.35,
                shadowRadius: 14,
                elevation: 6,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: "rgba(255, 255, 255, 0.18)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ArrowRight size={20} color="#FFFFFF" strokeWidth={2.2} />
              </View>
              <Animated.Text
                style={{
                  flex: 1,
                  textAlign: "center",
                  fontFamily: fontFamilies.semiBold,
                  fontSize: 16,
                  color: "#FFFFFF",
                  letterSpacing: 0.3,
                  marginLeft: -48,
                }}
              >
                {t("auth.phoneLoginScreen.continue")}
              </Animated.Text>
              <View style={{ flexDirection: "row", gap: 2 }}>
                <ChevronRight
                  size={14}
                  color="rgba(255, 255, 255, 0.4)"
                  strokeWidth={2.4}
                />
                <ChevronRight
                  size={14}
                  color="rgba(255, 255, 255, 0.7)"
                  strokeWidth={2.4}
                  style={{ marginLeft: -8 }}
                />
                <ChevronRight
                  size={14}
                  color="#FFFFFF"
                  strokeWidth={2.4}
                  style={{ marginLeft: -8 }}
                />
              </View>
            </View>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
