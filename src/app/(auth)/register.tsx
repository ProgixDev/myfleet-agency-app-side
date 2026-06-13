import React, { useMemo, useState } from "react";
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
import { Image } from "@/components/ui/Image";
import * as DocumentPicker from "expo-document-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  ArrowRight,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Lock,
  Mail,
  MapPin,
  Phone,
  Shield,
  Upload,
  User,
} from "lucide-react-native";

import { Text } from "@/components/ui/Text";
import { Input } from "@/components/ui/Input";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/stores/useAuthStore";
import { useToastStore } from "@/components/ui/Toast";
import { signUpAgency } from "@/services/authService";
import {
  uploadSignupDocument,
  type UploadedSignupDocument,
} from "@/services/storage";
import { fontFamilies } from "@/theme/typography";

const ACCENT = "#7C3AED";
const ACCENT_SOFT = "#A855F7";
const TOTAL_STEPS = 4;

const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

type FleetSize = "s" | "m" | "l" | "xl";
type DocKey = "kbis" | "license" | "insurance";
type UploadedDocsMap = Record<DocKey, UploadedSignupDocument | null>;

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  agency?: string;
  city?: string;
  fleetSize?: string;
  password?: string;
  confirmPassword?: string;
  cgu?: string;
}

// ── Password strength ───────────────────────────────────────────────────────

function scorePassword(pw: string): 0 | 1 | 2 | 3 {
  if (pw.length < 6) return 0;
  let score = 1;
  if (pw.length >= 10) score++;
  if (/\d/.test(pw) && /[A-Za-z]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(3, score) as 0 | 1 | 2 | 3;
}

export default function RegisterWizardScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isLoading = useAuthStore((s) => s.isLoading);
  const setLoading = useAuthStore((s) => s.setLoading);
  const showToast = useToastStore((s) => s.show);

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [agency, setAgency] = useState("");
  const [city, setCity] = useState("");
  const [fleetSize, setFleetSize] = useState<FleetSize | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [cguAccepted, setCguAccepted] = useState(false);
  const [docsUploaded, setDocsUploaded] = useState<UploadedDocsMap>({
    kbis: null,
    license: null,
    insurance: null,
  });
  const [uploadingDoc, setUploadingDoc] = useState<DocKey | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});

  const clearError = (field: keyof FormErrors) => {
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const passwordScore = useMemo(() => scorePassword(password), [password]);

  const progress = useSharedValue(step / TOTAL_STEPS);

  // ── Step validation ─────────────────────────────────────────────────────

  const validateStep = (s: number): boolean => {
    const e: FormErrors = {};
    if (s === 1) {
      if (!name.trim()) e.name = t("auth.validation.nameRequired");
      if (!phone.trim()) e.phone = t("auth.validation.phoneRequired");
      if (!email.trim()) {
        e.email = t("auth.validation.emailRequired");
      } else if (!isValidEmail(email.trim())) {
        e.email = t("auth.validation.emailInvalid");
      }
    }
    if (s === 2) {
      if (!agency.trim()) e.agency = t("auth.validation.agencyRequired");
      if (!city.trim()) e.city = t("auth.validation.agencyRequired");
      if (!fleetSize) e.fleetSize = t("auth.validation.agencyRequired");
    }
    if (s === 3) {
      if (!password) {
        e.password = t("auth.validation.passwordRequired");
      } else if (password.length < 6) {
        e.password = t("auth.validation.passwordMinLength");
      }
      if (password !== confirmPassword) {
        e.confirmPassword = t("auth.validation.passwordMismatch");
      }
      if (!cguAccepted) {
        e.cgu = t("auth.validation.passwordRequired");
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const goNext = () => {
    Keyboard.dismiss();
    if (!validateStep(step)) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < TOTAL_STEPS) {
      const next = step + 1;
      setStep(next);
      progress.value = withTiming(next / TOTAL_STEPS, { duration: 400 });
    } else {
      void handleFinalize();
    }
  };

  const goBack = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step > 1) {
      const prev = step - 1;
      setStep(prev);
      progress.value = withTiming(prev / TOTAL_STEPS, { duration: 400 });
    } else {
      router.back();
    }
  };

  const handleFinalize = async () => {
    try {
      setLoading(true);
      const normalizedEmail = email.trim().toLowerCase();
      await signUpAgency({
        fullName: name.trim(),
        phone: phone.trim(),
        email: normalizedEmail,
        agency: agency.trim(),
        city: city.trim(),
        fleetSize,
        docsUploaded,
        cguAccepted,
        password,
      });

      showToast({
        variant: "success",
        title: t("common.success"),
        message: t("auth.registerScreen.step4.finalize"),
      });
      router.replace({
        pathname: "/(auth)/verify-email",
        params: { email: normalizedEmail, password },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("common.error");
      showToast({
        variant: "error",
        title: t("common.error"),
        message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUploadDoc = async (docKey: DocKey) => {
    try {
      setUploadingDoc(docKey);
      const picked = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (picked.canceled || picked.assets.length === 0) {
        return;
      }

      const asset = picked.assets[0];
      const uploaded = await uploadSignupDocument({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? "application/octet-stream",
      });

      setDocsUploaded((current) => ({
        ...current,
        [docKey]: uploaded,
      }));
      showToast({
        variant: "success",
        title: t("common.success"),
        message: t("auth.registerScreen.step4.uploaded"),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("common.error");
      showToast({
        variant: "error",
        title: t("common.error"),
        message,
      });
    } finally {
      setUploadingDoc(null);
    }
  };

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const ctaLabel =
    step < TOTAL_STEPS
      ? t("auth.registerScreen.continue")
      : t("auth.registerScreen.step4.finalize");

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar style={theme.background === "#050404" ? "light" : "dark"} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* ── Top chrome ─────────────────────────────────────────── */}
        <View
          style={{
            paddingTop: insets.top + 8,
            paddingHorizontal: 20,
            paddingBottom: 14,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Pressable
              onPress={goBack}
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

            <View
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 9999,
                backgroundColor: theme.accentSoft,
                borderWidth: 1,
                borderColor: "rgba(124, 58, 237, 0.3)",
              }}
            >
              <Text
                variant="labelSmall"
                style={{
                  fontFamily: fontFamilies.semiBold,
                  fontSize: 11,
                  color: ACCENT,
                  letterSpacing: 1,
                }}
              >
                {t("auth.registerScreen.stepIndicator", {
                  current: String(step).padStart(2, "0"),
                  total: String(TOTAL_STEPS).padStart(2, "0"),
                })}
              </Text>
            </View>
          </View>

          {/* Progress bar */}
          <View
            style={{
              height: 4,
              borderRadius: 2,
              backgroundColor: theme.surfaceTertiary,
              marginTop: 14,
              overflow: "hidden",
            }}
          >
            <Animated.View
              style={[
                progressBarStyle,
                { height: 4, borderRadius: 2, backgroundColor: ACCENT },
              ]}
            />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 16,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <Pressable onPress={Keyboard.dismiss} style={{ flex: 1 }}>
            {/* Step content (keyed so it animates when step changes) */}
            <Animated.View
              key={step}
              entering={FadeInRight.duration(300)}
              style={{ flex: 1 }}
            >
              {step === 1 && (
                <Step1
                  theme={theme}
                  t={t}
                  name={name}
                  setName={(v) => {
                    setName(v);
                    clearError("name");
                  }}
                  phone={phone}
                  setPhone={(v) => {
                    setPhone(v);
                    clearError("phone");
                  }}
                  email={email}
                  setEmail={(v) => {
                    setEmail(v);
                    clearError("email");
                  }}
                  errors={errors}
                />
              )}

              {step === 2 && (
                <Step2
                  theme={theme}
                  t={t}
                  agency={agency}
                  setAgency={(v) => {
                    setAgency(v);
                    clearError("agency");
                  }}
                  city={city}
                  setCity={(v) => {
                    setCity(v);
                    clearError("city");
                  }}
                  fleetSize={fleetSize}
                  setFleetSize={(v) => {
                    setFleetSize(v);
                    clearError("fleetSize");
                  }}
                  errors={errors}
                />
              )}

              {step === 3 && (
                <Step3
                  theme={theme}
                  t={t}
                  password={password}
                  setPassword={(v) => {
                    setPassword(v);
                    clearError("password");
                  }}
                  confirmPassword={confirmPassword}
                  setConfirmPassword={(v) => {
                    setConfirmPassword(v);
                    clearError("confirmPassword");
                  }}
                  cguAccepted={cguAccepted}
                  setCguAccepted={(v) => {
                    setCguAccepted(v);
                    clearError("cgu");
                  }}
                  passwordScore={passwordScore}
                  errors={errors}
                />
              )}

              {step === 4 && (
                <Step4
                  theme={theme}
                  t={t}
                  docsUploaded={docsUploaded}
                  onUploadDoc={handleUploadDoc}
                  uploadingDoc={uploadingDoc}
                  onSkipDev={() => void handleFinalize()}
                  isLoading={isLoading}
                />
              )}
            </Animated.View>

            <View style={{ flex: 1, minHeight: 16 }} />

            {/* ── Primary CTA ─────────────────────────────────────── */}
            <Animated.View
              entering={FadeIn.duration(300)}
              style={{ marginTop: 20 }}
            >
              <Pressable
                onPress={goNext}
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
                    {ctaLabel}
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

            {step === 1 && (
              <Pressable
                onPress={() => {
                  router.back();
                  setTimeout(() => router.push("/(auth)/login"), 250);
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  marginTop: 14,
                }}
              >
                <Text variant="bodySmall" color={theme.textSecondary}>
                  {t("auth.registerScreen.hasAccount")}
                </Text>
                <Text
                  variant="titleSmall"
                  color={ACCENT}
                  style={{ fontFamily: fontFamilies.semiBold }}
                >
                  {t("auth.registerScreen.signIn")}
                </Text>
              </Pressable>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Step components ─────────────────────────────────────────────────────────

interface StepHeaderProps {
  title: string;
  subtitle: string;
}

function StepHeader({ title, subtitle }: StepHeaderProps) {
  const theme = useTheme();
  return (
    <View style={{ marginBottom: 20 }}>
      <Text variant="headlineLarge" style={{ fontFamily: fontFamilies.bold }}>
        {title}
      </Text>
      <Text
        variant="bodyMedium"
        color={theme.textSecondary}
        style={{ marginTop: 4 }}
      >
        {subtitle}
      </Text>
    </View>
  );
}

interface Step1Props {
  theme: ReturnType<typeof useTheme>;
  t: ReturnType<typeof useTranslation>["t"];
  name: string;
  setName: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  errors: FormErrors;
}

function Step1({
  t,
  name,
  setName,
  phone,
  setPhone,
  email,
  setEmail,
  errors,
}: Step1Props) {
  return (
    <View>
      <StepHeader
        title={t("auth.registerScreen.step1.title")}
        subtitle={t("auth.registerScreen.step1.subtitle")}
      />
      <View style={{ gap: 14 }}>
        <Input
          label={t("auth.registerScreen.fullName")}
          placeholder={t("auth.registerScreen.fullNamePlaceholder")}
          value={name}
          onChangeText={setName}
          leftIcon={User}
          error={errors.name}
        />
        <Input
          label={t("auth.registerScreen.phone")}
          placeholder={t("auth.registerScreen.phonePlaceholder")}
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          leftIcon={Phone}
          error={errors.phone}
        />
        <Input
          label={t("auth.email")}
          placeholder={t("auth.registerScreen.emailPlaceholder")}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          leftIcon={Mail}
          error={errors.email}
        />
      </View>
    </View>
  );
}

interface Step2Props {
  theme: ReturnType<typeof useTheme>;
  t: ReturnType<typeof useTranslation>["t"];
  agency: string;
  setAgency: (v: string) => void;
  city: string;
  setCity: (v: string) => void;
  fleetSize: FleetSize | null;
  setFleetSize: (v: FleetSize) => void;
  errors: FormErrors;
}

function Step2({
  theme,
  t,
  agency,
  setAgency,
  city,
  setCity,
  fleetSize,
  setFleetSize,
  errors,
}: Step2Props) {
  const FLEET_OPTIONS: { key: FleetSize; labelKey: string }[] = [
    { key: "s", labelKey: "auth.registerScreen.step2.fleetSizeS" },
    { key: "m", labelKey: "auth.registerScreen.step2.fleetSizeM" },
    { key: "l", labelKey: "auth.registerScreen.step2.fleetSizeL" },
    { key: "xl", labelKey: "auth.registerScreen.step2.fleetSizeXl" },
  ];
  return (
    <View>
      <StepHeader
        title={t("auth.registerScreen.step2.title")}
        subtitle={t("auth.registerScreen.step2.subtitle")}
      />
      <View style={{ gap: 14 }}>
        <Input
          label={t("auth.registerScreen.agencyName")}
          placeholder={t("auth.registerScreen.agencyNamePlaceholder")}
          value={agency}
          onChangeText={setAgency}
          leftIcon={Building2}
          error={errors.agency}
        />
        <Input
          label={t("auth.registerScreen.step2.city")}
          placeholder={t("auth.registerScreen.step2.cityPlaceholder")}
          value={city}
          onChangeText={setCity}
          leftIcon={MapPin}
          error={errors.city}
        />

        <View>
          <Text
            variant="labelSmall"
            color={theme.textSecondary}
            style={{
              fontFamily: fontFamilies.medium,
              marginBottom: 8,
              fontSize: 12,
            }}
          >
            {t("auth.registerScreen.step2.fleetSize")}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {FLEET_OPTIONS.map((opt) => {
              const selected = fleetSize === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setFleetSize(opt.key);
                  }}
                  style={{
                    paddingHorizontal: 18,
                    paddingVertical: 11,
                    borderRadius: 9999,
                    backgroundColor: selected
                      ? ACCENT
                      : theme.surfaceTertiary,
                    borderWidth: 1,
                    borderColor: selected
                      ? ACCENT
                      : theme.borderLight,
                  }}
                >
                  <Text
                    variant="labelSmall"
                    style={{
                      fontFamily: fontFamilies.semiBold,
                      fontSize: 13,
                      color: selected ? "#FFFFFF" : theme.textSecondary,
                      letterSpacing: 0.3,
                    }}
                  >
                    {t(opt.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {errors.fleetSize && (
            <Text
              variant="bodySmall"
              color={theme.danger}
              style={{ marginTop: 6, fontSize: 12 }}
            >
              {errors.fleetSize}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

interface Step3Props {
  theme: ReturnType<typeof useTheme>;
  t: ReturnType<typeof useTranslation>["t"];
  password: string;
  setPassword: (v: string) => void;
  confirmPassword: string;
  setConfirmPassword: (v: string) => void;
  cguAccepted: boolean;
  setCguAccepted: (v: boolean) => void;
  passwordScore: 0 | 1 | 2 | 3;
  errors: FormErrors;
}

function Step3({
  theme,
  t,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  cguAccepted,
  setCguAccepted,
  passwordScore,
  errors,
}: Step3Props) {
  const strengthLabel =
    passwordScore >= 3
      ? t("auth.registerScreen.step3.strengthStrong")
      : passwordScore === 2
        ? t("auth.registerScreen.step3.strengthMedium")
        : t("auth.registerScreen.step3.strengthWeak");
  const strengthColor =
    passwordScore >= 3
      ? theme.success
      : passwordScore === 2
        ? theme.warning
        : theme.danger;

  return (
    <View>
      <StepHeader
        title={t("auth.registerScreen.step3.title")}
        subtitle={t("auth.registerScreen.step3.subtitle")}
      />
      <View style={{ gap: 14 }}>
        <Input
          variant="password"
          label={t("auth.password")}
          placeholder={t("auth.registerScreen.passwordPlaceholder")}
          value={password}
          onChangeText={setPassword}
          leftIcon={Lock}
          error={errors.password}
        />

        {password.length > 0 && (
          <View>
            <View style={{ flexDirection: "row", gap: 4, marginBottom: 4 }}>
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor:
                      i < passwordScore ? strengthColor : theme.surfaceTertiary,
                  }}
                />
              ))}
            </View>
            <Text
              variant="bodySmall"
              style={{
                fontFamily: fontFamilies.medium,
                fontSize: 11,
                color: strengthColor,
              }}
            >
              {strengthLabel}
            </Text>
          </View>
        )}

        <Input
          variant="password"
          label={t("auth.registerScreen.confirmPassword")}
          placeholder={t("auth.registerScreen.confirmPasswordPlaceholder")}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          leftIcon={Lock}
          error={errors.confirmPassword}
        />

        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setCguAccepted(!cguAccepted);
          }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            padding: 14,
            borderRadius: 16,
            backgroundColor: cguAccepted
              ? theme.accentSoft
              : theme.surfaceTertiary,
            borderWidth: 1,
            borderColor: cguAccepted ? ACCENT : theme.borderLight,
            marginTop: 4,
          }}
        >
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              backgroundColor: cguAccepted ? ACCENT : theme.surface,
              borderWidth: 1.5,
              borderColor: cguAccepted ? ACCENT : theme.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {cguAccepted && (
              <Check size={14} color="#FFFFFF" strokeWidth={3} />
            )}
          </View>
          <Text
            variant="bodySmall"
            style={{
              flex: 1,
              color: cguAccepted ? theme.textPrimary : theme.textSecondary,
            }}
          >
            {t("auth.registerScreen.step3.cguText")}
          </Text>
        </Pressable>
        {errors.cgu && (
          <Text
            variant="bodySmall"
            color={theme.danger}
            style={{ fontSize: 12, marginTop: -6 }}
          >
            {errors.cgu}
          </Text>
        )}
      </View>
    </View>
  );
}

interface Step4Props {
  theme: ReturnType<typeof useTheme>;
  t: ReturnType<typeof useTranslation>["t"];
  docsUploaded: UploadedDocsMap;
  onUploadDoc: (k: DocKey) => void;
  uploadingDoc: DocKey | null;
  onSkipDev: () => void;
  isLoading: boolean;
}

function Step4({
  theme,
  t,
  docsUploaded,
  onUploadDoc,
  uploadingDoc,
  onSkipDev,
  isLoading,
}: Step4Props) {
  const devSkipEnabled = process.env.EXPO_PUBLIC_DEV_SKIP_DOCS === "true";
  const DOCS: {
    key: DocKey;
    icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
    titleKey: string;
    hintKey: string;
  }[] = [
    {
      key: "kbis",
      icon: FileText,
      titleKey: "auth.registerScreen.step4.kbis",
      hintKey: "auth.registerScreen.step4.kbisHint",
    },
    {
      key: "license",
      icon: Shield,
      titleKey: "auth.registerScreen.step4.license",
      hintKey: "auth.registerScreen.step4.licenseHint",
    },
    {
      key: "insurance",
      icon: Shield,
      titleKey: "auth.registerScreen.step4.insurance",
      hintKey: "auth.registerScreen.step4.insuranceHint",
    },
  ];
  return (
    <View>
      <StepHeader
        title={t("auth.registerScreen.step4.title")}
        subtitle={t("auth.registerScreen.step4.subtitle")}
      />

      <View style={{ gap: 10 }}>
        {DOCS.map((doc) => {
          const uploaded = docsUploaded[doc.key] !== null;
          const isUploading = uploadingDoc === doc.key;
          const Icon = doc.icon;
          return (
            <Pressable
              key={doc.key}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onUploadDoc(doc.key);
              }}
              disabled={isUploading}
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 14,
                borderRadius: 18,
                backgroundColor: uploaded
                  ? theme.accentSoft
                  : theme.surfaceTertiary,
                borderWidth: 1,
                borderColor: uploaded ? ACCENT : theme.borderLight,
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: uploaded ? ACCENT : theme.surface,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {uploaded ? (
                  <Check size={20} color="#FFFFFF" strokeWidth={2.4} />
                ) : (
                  <Icon size={20} color={theme.textSecondary} strokeWidth={1.8} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  variant="titleSmall"
                  style={{ fontFamily: fontFamilies.semiBold }}
                >
                  {t(doc.titleKey)}
                </Text>
                <Text variant="caption" color={theme.textTertiary}>
                  {t(doc.hintKey)}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 9999,
                  backgroundColor: uploaded ? ACCENT : theme.surface,
                  borderWidth: 1,
                  borderColor: uploaded ? ACCENT : theme.border,
                }}
              >
                {!uploaded && (
                  <Upload size={12} color={ACCENT} strokeWidth={2.2} />
                )}
                <Text
                  variant="labelSmall"
                  style={{
                    fontFamily: fontFamilies.semiBold,
                    fontSize: 11,
                    color: uploaded ? "#FFFFFF" : ACCENT,
                    letterSpacing: 0.3,
                  }}
                >
                  {isUploading
                    ? "..."
                    : uploaded
                    ? t("auth.registerScreen.step4.uploaded")
                    : t("auth.registerScreen.step4.upload")}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <Text
        variant="caption"
        color={theme.textTertiary}
        align="center"
        style={{ marginTop: 18, fontSize: 11 }}
      >
        {t("auth.registerScreen.step4.skipForNow")}
      </Text>

      {devSkipEnabled && (
        <Pressable
          testID="register-skip-docs-dev"
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onSkipDev();
          }}
          disabled={isLoading}
          style={({ pressed }) => ({
            alignSelf: "center",
            marginTop: 14,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 9999,
            backgroundColor: theme.surfaceTertiary,
            borderWidth: 1,
            borderColor: theme.borderLight,
            borderStyle: "dashed",
            opacity: pressed ? 0.85 : isLoading ? 0.55 : 1,
          })}
        >
          <Text
            variant="labelSmall"
            style={{
              fontFamily: fontFamilies.semiBold,
              fontSize: 12,
              color: ACCENT,
              letterSpacing: 0.3,
            }}
          >
            {t("auth.registerScreen.step4.skipForNowDev")}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
