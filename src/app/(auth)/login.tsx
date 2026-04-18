import React, { useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { StatusBar } from "expo-status-bar";
import { Image } from "expo-image";
import { ArrowRight, ChevronRight, Lock, Mail, Phone, X } from "lucide-react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Svg, { Path } from "react-native-svg";

import { Text } from "@/components/ui/Text";
import { Input } from "@/components/ui/Input";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/stores/useAuthStore";
import { useToastStore } from "@/components/ui/Toast";
import { isAppleSignInAvailable } from "@/services/auth/socialAuth";
import { fontFamilies } from "@/theme/typography";

const ACCENT = "#7C3AED";
const ACCENT_SOFT = "#A855F7";

const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// ── Social Brand Icons ─────────────────────────────────────────────────────

function GoogleIcon({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </Svg>
  );
}

function AppleIcon({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="#000000">
      <Path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </Svg>
  );
}

function FacebookIcon({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="#1877F2">
      <Path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </Svg>
  );
}

// ── Social Button (shadowed circular chip) ─────────────────────────────────

function SocialButton({
  icon,
  onPress,
  theme,
}: {
  icon: React.ReactNode;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => ({
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: theme.surface,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: theme.borderLight,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
        transform: [{ scale: pressed ? 0.95 : 1 }],
      })}
    >
      {icon}
    </Pressable>
  );
}

// ── Login Screen ────────────────────────────────────────────────────────────

export default function LoginScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useTranslation();

  const login = useAuthStore((s) => s.login);
  const loginWithSocial = useAuthStore((s) => s.loginWithSocial);
  const isLoading = useAuthStore((s) => s.isLoading);
  const showToast = useToastStore((s) => s.show);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );

  const showApple = isAppleSignInAvailable();

  const validate = (): boolean => {
    const newErrors: { email?: string; password?: string } = {};
    if (!email.trim()) {
      newErrors.email = t("auth.validation.emailRequired");
    } else if (!isValidEmail(email.trim())) {
      newErrors.email = t("auth.validation.emailInvalid");
    }
    if (!password) {
      newErrors.password = t("auth.validation.passwordRequired");
    } else if (password.length < 6) {
      newErrors.password = t("auth.validation.passwordMinLength");
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    Keyboard.dismiss();
    if (!validate()) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await login(email.trim(), password);
      router.replace("/(app)/(home)");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("common.error");
      showToast({ variant: "error", title: t("common.error"), message });
    }
  };

  const handleSocialLogin = async (
    provider: "apple" | "google" | "facebook",
  ) => {
    try {
      await loginWithSocial(provider);
      router.replace("/(app)/(home)");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("common.error");
      showToast({ variant: "error", title: t("common.error"), message });
    }
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.background,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        overflow: "hidden",
      }}
    >
      <StatusBar style={theme.background === "#050404" ? "light" : "dark"} />

      {/* Drag handle */}
      <View className="items-center pt-3 pb-1">
        <View
          style={{
            width: 44,
            height: 4,
            borderRadius: 2,
            backgroundColor: theme.surfaceTertiary,
          }}
        />
      </View>

      {/* Header row */}
      <View className="flex-row items-center justify-between px-5 pt-3 pb-2">
        <View style={{ width: 40 }} />

        {/* Centered logo chip */}
        <View
          style={{
            alignItems: "center",
            justifyContent: "center",
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: theme.accentSoft,
            borderWidth: 1,
            borderColor: ACCENT,
          }}
        >
          <Image
            source={require("../../../assets/images/logo.png")}
            style={{ width: 26, height: 26 }}
            contentFit="contain"
          />
        </View>

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
          <X size={18} color={theme.textSecondary} strokeWidth={2} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <Pressable onPress={Keyboard.dismiss}>
            {/* Title + subtitle */}
            <Animated.View
              entering={FadeInDown.delay(80).duration(400)}
              className="items-center mt-4 mb-6"
            >
              <Text
                variant="headlineMedium"
                align="center"
                style={{ fontFamily: fontFamilies.bold }}
              >
                {t("auth.loginScreen.title")}
              </Text>
              <Text
                variant="bodyMedium"
                color={theme.textSecondary}
                align="center"
                className="mt-1"
              >
                {t("auth.loginScreen.subtitle")}
              </Text>
            </Animated.View>

            {/* Social row */}
            <Animated.View
              entering={FadeInDown.delay(140).duration(400)}
              className="items-center mb-4"
            >
              <View className="flex-row gap-4">
                <SocialButton
                  icon={<GoogleIcon />}
                  onPress={() => handleSocialLogin("google")}
                  theme={theme}
                />
                {showApple && (
                  <SocialButton
                    icon={<AppleIcon />}
                    onPress={() => handleSocialLogin("apple")}
                    theme={theme}
                  />
                )}
                <SocialButton
                  icon={<FacebookIcon />}
                  onPress={() => handleSocialLogin("facebook")}
                  theme={theme}
                />
              </View>
            </Animated.View>

            {/* Continue with phone pill */}
            <Animated.View
              entering={FadeInDown.delay(170).duration(400)}
              style={{ marginBottom: 22, paddingHorizontal: 20 }}
            >
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push("/(auth)/phone-login");
                }}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  paddingVertical: 12,
                  paddingHorizontal: 18,
                  borderRadius: 9999,
                  backgroundColor: pressed
                    ? theme.accentSoft
                    : theme.surfaceTertiary,
                  borderWidth: 1,
                  borderColor: theme.borderLight,
                })}
              >
                <Phone size={16} color={ACCENT} strokeWidth={2} />
                <Text
                  variant="bodySmall"
                  style={{
                    fontFamily: fontFamilies.semiBold,
                    color: theme.textPrimary,
                  }}
                >
                  {t("auth.loginScreen.continueWithPhone")}
                </Text>
              </Pressable>
            </Animated.View>

            {/* Chip-style divider */}
            <Animated.View
              entering={FadeInDown.delay(200).duration(400)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 22,
              }}
            >
              <View
                style={{
                  flex: 1,
                  height: 1,
                  backgroundColor: theme.borderLight,
                }}
              />
              <View
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  marginHorizontal: 10,
                  borderRadius: 9999,
                  backgroundColor: theme.surfaceTertiary,
                }}
              >
                <Text
                  variant="bodySmall"
                  color={theme.textSecondary}
                  style={{ fontSize: 12 }}
                >
                  {t("auth.continueWith", {
                    defaultValue: "ou continuer avec email",
                  })}
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  height: 1,
                  backgroundColor: theme.borderLight,
                }}
              />
            </Animated.View>

            {/* Form */}
            <Animated.View
              entering={FadeInDown.delay(260).duration(400)}
              className="gap-4"
            >
              <Input
                label={t("auth.email")}
                placeholder={t("auth.loginScreen.emailPlaceholder")}
                keyboardType="email-address"
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  if (errors.email)
                    setErrors((e) => ({ ...e, email: undefined }));
                }}
                leftIcon={Mail}
                error={errors.email}
              />

              <Input
                variant="password"
                label={t("auth.password")}
                placeholder={t("auth.loginScreen.passwordPlaceholder")}
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  if (errors.password)
                    setErrors((e) => ({ ...e, password: undefined }));
                }}
                leftIcon={Lock}
                error={errors.password}
              />
            </Animated.View>

            {/* Forgot password chip */}
            <Animated.View
              entering={FadeInDown.delay(340).duration(400)}
              className="mt-3 self-end"
            >
              <Pressable
                onPress={() => router.push("/(auth)/forgot-password")}
                style={({ pressed }) => ({
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 9999,
                  backgroundColor: pressed ? theme.accentSoft : "transparent",
                })}
              >
                <Text variant="bodySmall" color={theme.accent}>
                  {t("auth.loginScreen.forgotPassword")}
                </Text>
              </Pressable>
            </Animated.View>

            {/* Primary CTA — accent pill with circle + chevron trio */}
            <Animated.View
              entering={FadeInDown.delay(400).duration(400)}
              className="mt-6"
            >
              <Pressable
                onPress={handleLogin}
                disabled={isLoading}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.9 : isLoading ? 0.7 : 1,
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
                    {t("auth.loginScreen.signIn")}
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
            </Animated.View>

            {/* Register link pill */}
            <Animated.View
              entering={FadeInDown.delay(480).duration(400)}
              className="items-center mt-8"
            >
              <Pressable
                onPress={() => {
                  router.back();
                  setTimeout(() => router.push("/(auth)/register"), 250);
                }}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 9999,
                  backgroundColor: pressed ? theme.surfaceTertiary : "transparent",
                })}
              >
                <Text variant="bodyMedium" color={theme.textSecondary}>
                  {t("auth.loginScreen.noAccount")}
                </Text>
                <Text
                  variant="titleMedium"
                  color={ACCENT}
                  style={{ fontFamily: fontFamilies.semiBold }}
                >
                  {t("auth.loginScreen.register")}
                </Text>
                <ChevronRight
                  size={16}
                  color={ACCENT_SOFT}
                  strokeWidth={2.2}
                />
              </Pressable>
            </Animated.View>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
