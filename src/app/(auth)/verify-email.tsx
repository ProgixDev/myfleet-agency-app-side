import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { StatusBar } from "expo-status-bar";
import { Image } from "@/components/ui/Image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Mail,
} from "lucide-react-native";

import { Text } from "@/components/ui/Text";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/stores/useAuthStore";
import { useToastStore } from "@/components/ui/Toast";
import {
  resendVerificationEmail,
  verifyEmailOtp,
} from "@/services/authService";
import { fontFamilies } from "@/theme/typography";

const ACCENT = "#7C3AED";
const CODE_LENGTH = 6;
const RESEND_SECONDS = 30;

export default function VerifyEmailScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    email?: string;
    password?: string;
    autoSend?: string;
  }>();
  const loginWithSession = useAuthStore((s) => s.loginWithSession);
  const isLoading = useAuthStore((s) => s.isLoading);
  const showToast = useToastStore((s) => s.show);

  const email = params.email ?? "";
  const autoSend = params.autoSend === "true";
  const autoSentRef = useRef(false);

  const [step, setStep] = useState<"send" | "verify">("send");
  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [invalid, setInvalid] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const verifying = useRef(false);

  useEffect(() => {
    if (!email) {
      router.back();
    }
  }, [email, router]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft]);

  const joinedCode = code.join("");
  const isComplete = joinedCode.length === CODE_LENGTH;

  const handleSend = async () => {
    if (!email) return;
    setIsSending(true);
    try {
      await resendVerificationEmail(email);
      setStep("verify");
      setSecondsLeft(RESEND_SECONDS);
      showToast({
        variant: "success",
        title: t("common.success"),
        message: t("auth.verifyEmail.sent", {
          defaultValue: "Verification email sent",
        }),
      });
      setTimeout(() => inputRef.current?.focus(), 350);
    } catch (err: unknown) {
      console.error("[verify-email] resendVerificationEmail failed", err);
      const message = err instanceof Error ? err.message : t("common.error");
      showToast({ variant: "error", title: t("common.error"), message });
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    if (autoSend && email && !autoSentRef.current && step === "send") {
      autoSentRef.current = true;
      void handleSend();
    }
    // handleSend is stable enough for this one-shot auto-send; intentionally
    // not in deps to avoid re-firing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSend, email, step]);

  const handleVerify = useCallback(
    async (codeToVerify: string) => {
      if (verifying.current || !email) return;
      verifying.current = true;
      Keyboard.dismiss();
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      try {
        const { accessToken, refreshToken } = await verifyEmailOtp(
          email,
          codeToVerify,
        );
        await loginWithSession(accessToken, refreshToken);
        router.replace("/(app)/(home)");
      } catch {
        setInvalid(true);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        verifying.current = false;
      }
    },
    [email, loginWithSession, router],
  );

  useEffect(() => {
    if (isComplete && !verifying.current) {
      void handleVerify(joinedCode);
    }
  }, [isComplete, joinedCode, handleVerify]);

  const handleChange = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, CODE_LENGTH);
    const next = Array(CODE_LENGTH).fill("");
    for (let i = 0; i < digits.length; i++) next[i] = digits[i];
    setCode(next);
    if (invalid) setInvalid(false);
  };

  const handleResend = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCode(Array(CODE_LENGTH).fill(""));
    setInvalid(false);
    setSecondsLeft(RESEND_SECONDS);
    inputRef.current?.focus();
    void handleSend();
  };

  const boxBg = (i: number) => {
    if (invalid) return theme.dangerSoft;
    if (code[i]) return theme.accentSoft;
    return theme.surfaceTertiary;
  };

  const boxBorder = (i: number, focused: boolean) => {
    if (invalid) return theme.danger;
    if (focused) return ACCENT;
    if (code[i]) return ACCENT;
    return theme.borderLight;
  };

  const firstEmpty = code.findIndex((d) => d === "");
  const focusedIndex = firstEmpty === -1 ? CODE_LENGTH - 1 : firstEmpty;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar style={theme.background === "#050404" ? "light" : "dark"} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
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
            style={{ marginTop: 12, marginBottom: 28 }}
          >
            <Text
              variant="headlineLarge"
              style={{ fontFamily: fontFamilies.bold }}
            >
              {step === "send"
                ? t("auth.verifyEmail.title", {
                    defaultValue: "Verify your email",
                  })
                : t("auth.otpScreen.title")}
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                flexWrap: "wrap",
                marginTop: 6,
              }}
            >
              <Text variant="bodyMedium" color={theme.textSecondary}>
                {step === "send"
                  ? t("auth.verifyEmail.subtitle", {
                      defaultValue: "We need to verify your email address",
                    })
                  : t("auth.otpScreen.subtitle")}
              </Text>
              <Text
                variant="bodyMedium"
                color={theme.textPrimary}
                style={{ fontFamily: fontFamilies.semiBold, marginLeft: 4 }}
              >
                {email}
              </Text>
            </View>
          </Animated.View>

          {step === "send" ? (
            <Animated.View entering={FadeInDown.delay(100).duration(400)}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: theme.accentSoft,
                  alignItems: "center",
                  justifyContent: "center",
                  alignSelf: "center",
                  marginBottom: 24,
                }}
              >
                <Mail size={28} color={ACCENT} strokeWidth={1.8} />
              </View>

              <Pressable
                onPress={() => void handleSend()}
                disabled={isSending || isLoading}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.9 : isSending || isLoading ? 0.55 : 1,
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
                    {isSending
                      ? t("common.loading", { defaultValue: "Loading..." })
                      : t("auth.verifyEmail.sendButton", {
                          defaultValue: "Send verification email",
                        })}
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
          ) : (
            <>
              <Pressable
                onPress={() => inputRef.current?.focus()}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginBottom: 18,
                }}
              >
                {code.map((digit, i) => {
                  const focused = i === focusedIndex;
                  return (
                    <Animated.View
                      key={i}
                      entering={FadeInDown.duration(300).delay(i * 40)}
                      style={{
                        width: 52,
                        height: 60,
                        borderRadius: 16,
                        backgroundColor: boxBg(i),
                        borderWidth: focused ? 2 : 1,
                        borderColor: boxBorder(i, focused),
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        variant="headlineSmall"
                        style={{
                          fontFamily: fontFamilies.bold,
                          fontSize: 22,
                          color: invalid ? theme.danger : theme.textPrimary,
                        }}
                      >
                        {digit}
                      </Text>
                    </Animated.View>
                  );
                })}
              </Pressable>

              <TextInput
                ref={inputRef}
                testID="verify-email-code-input"
                value={joinedCode}
                onChangeText={handleChange}
                keyboardType="number-pad"
                maxLength={CODE_LENGTH}
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                caretHidden
                style={{
                  position: "absolute",
                  opacity: 0,
                  height: 1,
                  width: 1,
                  top: 0,
                  left: 0,
                }}
              />

              {invalid && (
                <Animated.Text
                  entering={FadeIn.duration(200)}
                  style={{
                    fontFamily: fontFamilies.medium,
                    fontSize: 12,
                    color: theme.danger,
                    marginBottom: 8,
                  }}
                >
                  {t("auth.otpScreen.invalid")}
                </Animated.Text>
              )}

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  marginTop: 4,
                }}
              >
                <Text variant="bodySmall" color={theme.textSecondary}>
                  {t("auth.otpScreen.didNotReceive")}
                </Text>
                {secondsLeft > 0 ? (
                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 9999,
                      backgroundColor: theme.surfaceTertiary,
                    }}
                  >
                    <Text variant="bodySmall" color={theme.textTertiary}>
                      {t("auth.otpScreen.resendIn", {
                        seconds: secondsLeft,
                      })}
                    </Text>
                  </View>
                ) : (
                  <Pressable
                    testID="verify-email-resend"
                    onPress={handleResend}
                    style={({ pressed }) => ({
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 9999,
                      backgroundColor: pressed
                        ? theme.accentSoft
                        : "transparent",
                    })}
                  >
                    <Text
                      variant="bodySmall"
                      color={ACCENT}
                      style={{ fontFamily: fontFamilies.semiBold }}
                    >
                      {t("auth.otpScreen.resend")}
                    </Text>
                  </Pressable>
                )}
              </View>
            </>
          )}

          <View style={{ flex: 1 }} />

          {step === "verify" && (
            <Pressable
              testID="verify-email-submit"
              onPress={() => void handleVerify(joinedCode)}
              disabled={!isComplete || isLoading}
              style={({ pressed }) => ({
                opacity: pressed ? 0.9 : isComplete && !isLoading ? 1 : 0.55,
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
                  {t("auth.otpScreen.verify")}
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
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
