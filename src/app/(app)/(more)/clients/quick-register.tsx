import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import Animated, {
  FadeInDown,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
  withDelay,
  runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import {
  ChevronLeft,
  User,
  Phone,
  Mail,
  Camera,
  RotateCcw,
  CreditCard,
  IdCard,
  Car,
  Check,
  Shield,
} from "lucide-react-native";

import { ScreenWrapper } from "@/components/ui/ScreenWrapper";
import { Text } from "@/components/ui/Text";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Image } from "@/components/ui/Image";
import { Divider } from "@/components/ui/Divider";
import { useTheme } from "@/hooks/useTheme";
import { useToastStore } from "@/components/ui/Toast";
import { useCreateClient } from "@/hooks/useClients";
import {
  uploadClientDocument,
  type ClientDocumentType,
} from "@/services/clientService";
import { fontFamilies } from "@/theme/typography";
import { shadows } from "@/theme/shadows";
import type { Client } from "@/types/client";

// ── Types ────────────────────────────────────────────────────────────────────

type DocumentSide =
  | "idFront"
  | "idBack"
  | "licenseFront"
  | "licenseBack"
  | "creditCardFront";

interface CapturedDocuments {
  idFront: string | null;
  idBack: string | null;
  licenseFront: string | null;
  licenseBack: string | null;
  creditCardFront: string | null;
}

// ── Section Header ───────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string;
  icon: React.ReactNode;
  index: number;
}

function SectionHeader({ title, icon, index }: SectionHeaderProps) {
  const theme = useTheme();
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 80)
        .duration(400)
        .springify()}
      style={{
        flexDirection: "row",
        alignItems: "center",
        marginTop: 28,
        marginBottom: 14,
        gap: 10,
      }}
    >
      {icon}
      <Text variant="headlineSmall" color={theme.textPrimary}>
        {title}
      </Text>
    </Animated.View>
  );
}

// ── Document Capture Area ────────────────────────────────────────────────────

interface CaptureAreaProps {
  label: string;
  uri: string | null;
  onCapture: () => void;
  onRetake: () => void;
  delay: number;
  testID?: string;
}

function CaptureArea({
  label,
  uri,
  onCapture,
  onRetake,
  delay,
  testID,
}: CaptureAreaProps) {
  const captured = uri !== null;
  const theme = useTheme();
  const { t } = useTranslation();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (captured) {
      onRetake();
    } else {
      onCapture();
    }
  };

  if (captured) {
    return (
      <Animated.View entering={FadeIn.duration(300)}>
        <Animated.View style={animatedStyle}>
          <View
            style={{
              backgroundColor: theme.surfaceTertiary,
              borderRadius: 16,
              overflow: "hidden",
              height: 160,
            }}
          >
            {/* Captured document preview */}
            {uri ? (
              <Image
                source={{ uri }}
                style={{ flex: 1 }}
                contentFit="cover"
                accessibilityLabel={label}
              />
            ) : null}

            {/* Captured badge */}
            <View
              style={{
                position: "absolute",
                bottom: 10,
                left: 10,
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "rgba(0,0,0,0.6)",
                borderRadius: 20,
                paddingHorizontal: 12,
                paddingVertical: 6,
                gap: 5,
              }}
            >
              <Check size={13} color="#FFFFFF" strokeWidth={2.5} />
              <Text
                variant="bodySmall"
                color="#FFFFFF"
                style={{ fontFamily: fontFamilies.medium }}
              >
                {label}
              </Text>
            </View>

            {/* Retake overlay button */}
            <Pressable
              testID={testID ? `${testID}-retake` : undefined}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onRetake();
              }}
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "rgba(0,0,0,0.6)",
                borderRadius: 20,
                paddingHorizontal: 12,
                paddingVertical: 6,
                gap: 5,
              }}
            >
              <RotateCcw size={13} color="#FFFFFF" strokeWidth={2} />
              <Text
                variant="bodySmall"
                color="#FFFFFF"
                style={{ fontFamily: fontFamilies.medium }}
              >
                {t("clients.quickRegister.retake", { defaultValue: "Retake" })}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(400).springify()}>
      <Animated.View style={animatedStyle}>
        <Pressable
          testID={testID}
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          <View
            style={{
              height: 140,
              borderRadius: 16,
              borderWidth: 2,
              borderStyle: "dashed",
              borderColor: theme.border,
              backgroundColor: theme.surface,
              justifyContent: "center",
              alignItems: "center",
              gap: 10,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: theme.accentSoft,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Camera size={22} color={theme.accent} strokeWidth={2} />
            </View>
            <Text variant="titleSmall" color={theme.textSecondary}>
              {label}
            </Text>
            <Text variant="caption" color={theme.textTertiary}>
              {t("clients.quickRegister.tapToCapture", {
                defaultValue: "Tap to capture",
              })}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

// ── Success Checkmark ────────────────────────────────────────────────────────

function AnimatedCheckmark() {
  const circleScale = useSharedValue(0);
  const checkOpacity = useSharedValue(0);

  React.useEffect(() => {
    circleScale.value = withSpring(1, { damping: 12, stiffness: 200 });
    checkOpacity.value = withDelay(300, withTiming(1, { duration: 250 }));
  }, [circleScale, checkOpacity]);

  const circleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: circleScale.value }],
  }));

  const checkStyle = useAnimatedStyle(() => ({
    opacity: checkOpacity.value,
  }));

  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 40,
      }}
    >
      <Animated.View
        style={[
          circleStyle,
          {
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: "#10B981",
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        <Animated.View style={checkStyle}>
          <Check size={40} color="#FFFFFF" strokeWidth={3} />
        </Animated.View>
      </Animated.View>
      <Animated.View style={[checkStyle, { marginTop: 16 }]}>
        <Text variant="headlineMedium" color="#10B981" align="center">
          Client Registered!
        </Text>
      </Animated.View>
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function QuickRegisterScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const showToast = useToastStore((s) => s.show);
  const createClient = useCreateClient();

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // Document capture state
  const [documents, setDocuments] = useState<CapturedDocuments>({
    idFront: null,
    idBack: null,
    licenseFront: null,
    licenseBack: null,
    creditCardFront: null,
  });

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleCapture = useCallback(
    async (side: DocumentSide) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        showToast({
          variant: "error",
          title: t("clients.quickRegister.cameraDeniedTitle", {
            defaultValue: "Camera access needed",
          }),
          message: t("clients.quickRegister.cameraDeniedMessage", {
            defaultValue: "Enable camera access to capture documents.",
          }),
        });
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.7,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets[0]?.uri) return;

      setDocuments((prev) => ({ ...prev, [side]: result.assets[0].uri }));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [showToast, t],
  );

  const handleRetake = useCallback((side: DocumentSide) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDocuments((prev) => ({
      ...prev,
      [side]: null,
    }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast({
        variant: "error",
        title: t("clients.quickRegister.errorTitle", {
          defaultValue: "Required Fields",
        }),
        message: t("clients.quickRegister.errorMessage", {
          defaultValue: "First name and last name are required.",
        }),
      });
      return;
    }

    if (!phone.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast({
        variant: "error",
        title: t("clients.quickRegister.errorTitle", {
          defaultValue: "Required Fields",
        }),
        message: t("clients.quickRegister.phoneRequired", {
          defaultValue: "Phone number is required.",
        }),
      });
      return;
    }

    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      // The agency_client relation is created first; the captured documents
      // are then posted to /clients/:id/documents (each upload sets
      // agency_client.verified_at server-side).
      const created = await createClient.mutateAsync({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: `+41${phone.trim()}`,
        address: "",
        dateOfBirth: "",
        idType: "national-id",
        idNumber: "",
        driverLicense: "",
        driverLicenseExpiry: "",
        notes: "",
        registrationMethod: "walk-in",
      });

      // Upload each captured document keyed by the new client's id. A failed
      // upload shouldn't roll back the (already-created) client — surface a
      // warning but still complete the flow.
      const uploads: { type: ClientDocumentType; uri: string }[] = (
        [
          { type: "id-front", uri: documents.idFront ?? "" },
          { type: "id-back", uri: documents.idBack ?? "" },
          { type: "license-front", uri: documents.licenseFront ?? "" },
          { type: "license-back", uri: documents.licenseBack ?? "" },
          { type: "credit-card-front", uri: documents.creditCardFront ?? "" },
        ] as const
      )
        .filter((d) => d.uri.length > 0)
        .map((d) => ({ type: d.type, uri: d.uri }));

      let uploadFailed = false;
      for (const doc of uploads) {
        try {
          await uploadClientDocument(created.id, doc.type, doc.uri);
        } catch {
          uploadFailed = true;
        }
      }

      setIsSubmitting(false);
      setShowSuccess(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (uploadFailed) {
        showToast({
          variant: "warning",
          title: t("clients.quickRegister.uploadPartialTitle", {
            defaultValue: "Some documents failed to upload",
          }),
          message: t("clients.quickRegister.uploadPartialMessage", {
            defaultValue: "The client was created. Re-capture documents later.",
          }),
        });
      }

      setTimeout(() => {
        if (!uploadFailed) {
          showToast({
            variant: "success",
            title: t("clients.quickRegister.successTitle", {
              defaultValue: "Client Registered",
            }),
            message: t("clients.quickRegister.successMessage", {
              defaultValue: `${firstName.trim()} ${lastName.trim()} has been registered.`,
            }),
          });
        }
        router.back();
      }, 1800);
    } catch {
      setIsSubmitting(false);
      showToast({
        variant: "error",
        title: t("clients.quickRegister.errorTitle", { defaultValue: "Error" }),
        message: t("clients.quickRegister.createError", {
          defaultValue: "Failed to register client. Please try again.",
        }),
      });
    }
  }, [
    firstName,
    lastName,
    phone,
    email,
    documents,
    createClient,
    showToast,
    router,
    t,
  ]);

  // ── Success overlay ──────────────────────────────────────────────────────

  if (showSuccess) {
    return (
      <ScreenWrapper>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <AnimatedCheckmark />
        </View>
      </ScreenWrapper>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <ScreenWrapper>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
          bounces
        >
          {/* ── Header ──────────────────────────────────────────────────── */}
          <Animated.View
            entering={FadeInDown.duration(400)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingTop: 16,
              paddingBottom: 8,
            }}
          >
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.back();
              }}
              hitSlop={12}
              style={{ marginRight: 12 }}
            >
              <ChevronLeft
                size={24}
                color={theme.textPrimary}
                strokeWidth={2}
              />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text variant="headlineLarge">
                {t("clients.quickRegister.title", {
                  defaultValue: "Quick Registration",
                })}
              </Text>
              <Text variant="bodySmall" color={theme.textTertiary}>
                {t("clients.quickRegister.subtitle", {
                  defaultValue: "Register a walk-in client",
                })}
              </Text>
            </View>
          </Animated.View>

          {/* ── Section 1: Basic Info ────────────────────────────────────── */}
          <SectionHeader
            title={t("clients.quickRegister.basicInfo", {
              defaultValue: "Basic Info",
            })}
            icon={<User size={20} color={theme.accent} strokeWidth={2} />}
            index={0}
          />

          <Animated.View
            entering={FadeInDown.delay(100).duration(400).springify()}
          >
            <Card variant="default" padding="md">
              <Input
                label={t("clients.quickRegister.firstName", {
                  defaultValue: "First Name",
                })}
                placeholder="Jean"
                value={firstName}
                onChangeText={setFirstName}
                leftIcon={User}
                className="mb-3"
              />

              <Input
                label={t("clients.quickRegister.lastName", {
                  defaultValue: "Last Name",
                })}
                placeholder="Dupont"
                value={lastName}
                onChangeText={setLastName}
                leftIcon={User}
                className="mb-3"
              />

              {/* Phone with +41 prefix chip */}
              <View style={{ marginBottom: 12 }}>
                <Text
                  variant="bodySmall"
                  color={theme.textSecondary}
                  style={{
                    fontFamily: fontFamilies.medium,
                    fontSize: 12,
                    marginBottom: 6,
                  }}
                >
                  {t("clients.quickRegister.phone", { defaultValue: "Phone" })}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {/* +41 Chip */}
                  <View
                    style={{
                      backgroundColor: theme.accentSoft,
                      borderRadius: 12,
                      paddingHorizontal: 14,
                      height: 48,
                      justifyContent: "center",
                      alignItems: "center",
                      flexDirection: "row",
                      gap: 6,
                    }}
                  >
                    <Phone size={14} color={theme.accent} strokeWidth={2} />
                    <Text
                      variant="titleSmall"
                      color={theme.accent}
                      style={{ fontFamily: fontFamilies.semiBold }}
                    >
                      +41
                    </Text>
                  </View>
                  {/* Phone input */}
                  <View style={{ flex: 1 }}>
                    <Input
                      placeholder="79 123 45 67"
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>
              </View>

              <Input
                label={t("clients.quickRegister.email", {
                  defaultValue: "Email (optional)",
                })}
                placeholder="jean.dupont@email.com"
                value={email}
                onChangeText={setEmail}
                leftIcon={Mail}
                keyboardType="email-address"
              />
            </Card>
          </Animated.View>

          {/* ── Section 2: Identity Document ─────────────────────────────── */}
          <SectionHeader
            title={t("clients.quickRegister.identityDocument", {
              defaultValue: "Identity Document",
            })}
            icon={<IdCard size={20} color={theme.accent} strokeWidth={2} />}
            index={1}
          />

          <Animated.View
            entering={FadeInDown.delay(200).duration(400).springify()}
          >
            <Card variant="default" padding="md">
              <View style={{ gap: 12 }}>
                <CaptureArea
                  label={t("clients.quickRegister.idFront", {
                    defaultValue: "Front Side",
                  })}
                  uri={documents.idFront}
                  onCapture={() => handleCapture("idFront")}
                  onRetake={() => handleRetake("idFront")}
                  delay={220}
                  testID="quick-register-capture-id-front"
                />
                <CaptureArea
                  label={t("clients.quickRegister.idBack", {
                    defaultValue: "Back Side",
                  })}
                  uri={documents.idBack}
                  onCapture={() => handleCapture("idBack")}
                  onRetake={() => handleRetake("idBack")}
                  delay={260}
                  testID="quick-register-capture-id-back"
                />
              </View>
            </Card>
          </Animated.View>

          {/* ── Section 3: Driver's License ──────────────────────────────── */}
          <SectionHeader
            title={t("clients.quickRegister.driverLicense", {
              defaultValue: "Driver's License",
            })}
            icon={<Car size={20} color={theme.accent} strokeWidth={2} />}
            index={2}
          />

          <Animated.View
            entering={FadeInDown.delay(320).duration(400).springify()}
          >
            <Card variant="default" padding="md">
              <View style={{ gap: 12 }}>
                <CaptureArea
                  label={t("clients.quickRegister.licenseFront", {
                    defaultValue: "Front Side",
                  })}
                  uri={documents.licenseFront}
                  onCapture={() => handleCapture("licenseFront")}
                  onRetake={() => handleRetake("licenseFront")}
                  delay={340}
                  testID="quick-register-capture-license-front"
                />
                <CaptureArea
                  label={t("clients.quickRegister.licenseBack", {
                    defaultValue: "Back Side",
                  })}
                  uri={documents.licenseBack}
                  onCapture={() => handleCapture("licenseBack")}
                  onRetake={() => handleRetake("licenseBack")}
                  delay={380}
                  testID="quick-register-capture-license-back"
                />
              </View>
            </Card>
          </Animated.View>

          {/* ── Section 4: Credit Card ───────────────────────────────────── */}
          <SectionHeader
            title={t("clients.quickRegister.creditCard", {
              defaultValue: "Credit Card",
            })}
            icon={<CreditCard size={20} color={theme.accent} strokeWidth={2} />}
            index={3}
          />

          <Animated.View
            entering={FadeInDown.delay(420).duration(400).springify()}
          >
            <Card variant="default" padding="md">
              <CaptureArea
                label={t("clients.quickRegister.creditCardFront", {
                  defaultValue: "Front Side",
                })}
                uri={documents.creditCardFront}
                onCapture={() => handleCapture("creditCardFront")}
                onRetake={() => handleRetake("creditCardFront")}
                delay={440}
                testID="quick-register-capture-credit-card-front"
              />

              {/* Privacy notice */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  marginTop: 12,
                  gap: 8,
                  paddingHorizontal: 4,
                }}
              >
                <Shield
                  size={14}
                  color={theme.textTertiary}
                  strokeWidth={2}
                  style={{ marginTop: 2 }}
                />
                <Text
                  variant="caption"
                  color={theme.textTertiary}
                  style={{ flex: 1 }}
                >
                  {t("clients.quickRegister.privacyNotice", {
                    defaultValue:
                      "Credit card images are stored securely and encrypted. They are used solely for deposit verification purposes and will be deleted after the rental period.",
                  })}
                </Text>
              </View>
            </Card>
          </Animated.View>

          {/* Bottom spacing for the sticky button */}
          <View style={{ height: 24 }} />
        </ScrollView>

        {/* ── Register Button ─────────────────────────────────────────── */}
        <Animated.View
          entering={FadeInDown.delay(500).duration(400).springify()}
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            paddingHorizontal: 16,
            paddingBottom: Platform.OS === "ios" ? 8 : 16,
            paddingTop: 12,
            backgroundColor: theme.background,
          }}
        >
          <Pressable
            testID="quick-register-submit"
            onPress={handleSubmit}
            disabled={isSubmitting}
            style={{
              borderRadius: 9999,
              overflow: "hidden",
              opacity: isSubmitting ? 0.7 : 1,
              ...shadows.accent,
            }}
          >
            <LinearGradient
              colors={[theme.accentGradientStart, theme.accentGradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                borderRadius: 9999,
                height: 56,
                flexDirection: "row",
                justifyContent: "center",
                alignItems: "center",
                gap: 8,
              }}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Check size={20} color="#FFFFFF" strokeWidth={2.5} />
                  <Text
                    variant="bodyLarge"
                    color="#FFFFFF"
                    style={{ fontFamily: fontFamilies.semiBold }}
                  >
                    {t("clients.quickRegister.submit", {
                      defaultValue: "Register Client",
                    })}
                  </Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}
