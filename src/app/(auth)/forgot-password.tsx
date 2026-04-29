import React, { useEffect, useState } from "react";
import { Keyboard, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { CheckCircle, ChevronLeft, Lock, Mail } from "lucide-react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { ScreenWrapper } from "@/components/ui/ScreenWrapper";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useTheme } from "@/hooks/useTheme";
import { forgotPassword, resetPasswordWithOtp } from "@/services/authService";
import { useToastStore } from "@/components/ui/Toast";

const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

type Step = "request" | "verify" | "success";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useTranslation();
  const showToast = useToastStore((s) => s.show);

  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [errors, setErrors] = useState<{
    email?: string;
    otp?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Success animations
  const checkScale = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (step === "success") {
      checkScale.value = withSequence(
        withTiming(1.2, { duration: 300 }),
        withTiming(1, { duration: 200 })
      );
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
        ),
        -1,
        true
      );
    }
  }, [step, checkScale, pulse]);

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const handleSendOtp = async () => {
    Keyboard.dismiss();

    if (!email.trim()) {
      setErrors({ email: t("auth.validation.emailRequired") });
      return;
    }
    if (!isValidEmail(email.trim())) {
      setErrors({ email: t("auth.validation.emailInvalid") });
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      await forgotPassword(email.trim().toLowerCase());
      setStep("verify");
      showToast({
        variant: "success",
        title: t("common.success"),
        message: t("auth.forgotScreen.emailSent"),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("common.error");
      showToast({
        variant: "error",
        title: t("common.error"),
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    Keyboard.dismiss();
    const newErrors: typeof errors = {};

    if (!otp.trim()) newErrors.otp = t("auth.validation.otpRequired", { defaultValue: "Code requis" });
    if (!password) newErrors.password = t("auth.validation.passwordRequired");
    if (password !== confirmPassword) newErrors.confirmPassword = t("auth.validation.passwordMismatch");

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      await resetPasswordWithOtp(email.trim().toLowerCase(), otp.trim(), password);
      setStep("success");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("common.error");
      showToast({
        variant: "error",
        title: t("common.error"),
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === "success") {
    return (
      <ScreenWrapper scroll={false}>
        <View className="flex-1 items-center justify-center px-4">
          <Animated.View
            entering={FadeIn.duration(400)}
            style={[checkStyle, pulseStyle]}
            className="mb-6"
          >
            <View
              className="w-20 h-20 rounded-full items-center justify-center"
              style={{ backgroundColor: theme.successSoft }}
            >
              <CheckCircle size={40} color={theme.success} strokeWidth={1.5} />
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(200).duration(400)}
            className="items-center"
          >
            <Text variant="headlineMedium" align="center">
              {t("auth.forgotScreen.successTitle", { defaultValue: "Mot de passe réinitialisé" })}
            </Text>
            <Text
              variant="bodyMedium"
              color={theme.textSecondary}
              align="center"
              className="mt-3 px-4"
            >
              {t("auth.forgotScreen.successMessage", { defaultValue: "Votre mot de passe a été mis à jour avec succès." })}
            </Text>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(400).duration(400)}
            className="mt-10"
          >
            <Pressable onPress={() => router.push("/(auth)/login")}>
              <Text variant="titleMedium" color={theme.accent}>
                {t("auth.forgotScreen.backToLogin")}
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper scroll={false}>
      <Pressable onPress={Keyboard.dismiss} className="flex-1">
        {/* Back */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <Pressable
            onPress={() => step === "verify" ? setStep("request") : router.back()}
            hitSlop={12}
            className="mb-8 self-start"
          >
            <ChevronLeft size={28} color={theme.textPrimary} />
          </Pressable>
        </Animated.View>

        {step === "request" ? (
          <>
            {/* Header */}
            <Animated.View entering={FadeInDown.delay(100).duration(400)}>
              <Text variant="headlineLarge">
                {t("auth.forgotScreen.title")}
              </Text>
              <Text
                variant="bodyMedium"
                color={theme.textSecondary}
                className="mt-2"
              >
                {t("auth.forgotScreen.subtitle")}
              </Text>
            </Animated.View>

            {/* Email input */}
            <Animated.View
              entering={FadeInDown.delay(200).duration(400)}
              className="mt-8"
            >
              <Input
                label={t("auth.email")}
                placeholder={t("auth.forgotScreen.emailPlaceholder")}
                keyboardType="email-address"
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  if (errors.email) setErrors({});
                }}
                leftIcon={Mail}
                error={errors.email}
              />
            </Animated.View>

            {/* Send button */}
            <Animated.View
              entering={FadeInDown.delay(300).duration(400)}
              className="mt-8"
            >
              <Button
                variant="primary"
                size="lg"
                fullWidth
                loading={isSubmitting}
                onPress={handleSendOtp}
              >
                {t("auth.forgotScreen.sendLink")}
              </Button>
            </Animated.View>
          </>
        ) : (
          <>
            {/* Header */}
            <Animated.View entering={FadeInDown.delay(100).duration(400)}>
              <Text variant="headlineLarge">
                {t("auth.otpScreen.title")}
              </Text>
              <Text
                variant="bodyMedium"
                color={theme.textSecondary}
                className="mt-2"
              >
                {t("auth.forgotScreen.otpSubtitle", { defaultValue: "Entrez le code reçu par email" })}
              </Text>
            </Animated.View>

            {/* Inputs */}
            <Animated.View
              entering={FadeInDown.delay(200).duration(400)}
              className="mt-8 gap-4"
            >
              <Input
                label={t("auth.otpScreen.code", { defaultValue: "Code de réinitialisation" })}
                placeholder="123456"
                keyboardType="number-pad"
                maxLength={6}
                value={otp}
                onChangeText={(v) => {
                  setOtp(v);
                  if (errors.otp) setErrors(e => ({ ...e, otp: undefined }));
                }}
                error={errors.otp}
              />

              <Input
                variant="password"
                label={t("auth.password")}
                placeholder={t("auth.loginScreen.passwordPlaceholder")}
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  if (errors.password) setErrors(e => ({ ...e, password: undefined }));
                }}
                leftIcon={Lock}
                error={errors.password}
              />

              <Input
                variant="password"
                label={t("auth.registerScreen.confirmPassword")}
                placeholder={t("auth.registerScreen.confirmPasswordPlaceholder")}
                value={confirmPassword}
                onChangeText={(v) => {
                  setConfirmPassword(v);
                  if (errors.confirmPassword) setErrors(e => ({ ...e, confirmPassword: undefined }));
                }}
                leftIcon={Lock}
                error={errors.confirmPassword}
              />
            </Animated.View>

            {/* Reset button */}
            <Animated.View
              entering={FadeInDown.delay(300).duration(400)}
              className="mt-8"
            >
              <Button
                variant="primary"
                size="lg"
                fullWidth
                loading={isSubmitting}
                onPress={handleResetPassword}
              >
                {t("auth.forgotScreen.resetButton", { defaultValue: "Réinitialiser" })}
              </Button>
            </Animated.View>
          </>
        )}

        {/* Back to login */}
        <Animated.View
          entering={FadeInDown.delay(400).duration(400)}
          className="items-center mt-6"
        >
          <Pressable onPress={() => router.push("/(auth)/login")}>
            <Text variant="bodyMedium" color={theme.accent}>
              {t("auth.forgotScreen.backToLogin")}
            </Text>
          </Pressable>
        </Animated.View>
      </Pressable>
    </ScreenWrapper>
  );
}
