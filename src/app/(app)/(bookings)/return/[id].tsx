import React, { useState, useCallback } from "react";
import { View, Pressable, ScrollView, Alert } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  ZoomIn,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import {
  ChevronLeft,
  Check,
  CheckCircle,
  Gauge,
  Key,
  AlertTriangle,
  Car,
  RotateCcw,
  FileText,
  Sparkles,
  Receipt,
  Banknote,
} from "lucide-react-native";

import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Divider } from "@/components/ui/Divider";
import { IconButton } from "@/components/ui/IconButton";
import { useToastStore } from "@/components/ui/Toast";
import {
  useBooking,
  useCaptureDeposit,
  useCloseBooking,
} from "@/hooks/useBookings";
import {
  useInspections,
  useRunInspectionAngleAi,
} from "@/hooks/useInspections";
import { PrePostAngleList } from "@/components/inspections/PrePostAngleList";
import { ManualAngleReviewModal } from "@/components/inspections/ManualAngleReviewModal";
import {
  PHOTO_ANGLES,
  type PhotoAngle,
  type Inspection,
  type DamageSeverity,
} from "@/types/inspection";
import { BookingInspectionStep } from "@/components/inspection/BookingInspectionStep";
import type { Booking } from "@/types/booking";
import { useVehicle } from "@/hooks/useFleet";
import { useClient } from "@/hooks/useClients";
import { useAgency } from "@/hooks/useAgency";
import { formatCurrency } from "@/utils/format";
import { isInsufficientCredits } from "@/services/apiErrors";
import { EmptyState } from "@/components/ui/EmptyState";
import { Image } from "@/components/ui/Image";
import { resolveVehicleImageSource } from "@/data/vehicleImages";
import { useTheme } from "@/hooks/useTheme";
import { shadows } from "@/theme/shadows";
import { ActivityIndicator } from "react-native";

const DEFAULT_INCLUDED_KM = 200;
// Stored in cents per km (matches the rest of the cents convention).
const DEFAULT_EXTRA_KM_RATE = 30;

// fuelLevel is stored as a 0..100 percent (matching the server schema).
// Rendering label lookup mirrors the BookingInspectionStep selector.
const FUEL_LABELS: Record<number, string> = {
  0: "Empty",
  25: "1/4",
  50: "1/2",
  75: "3/4",
  100: "Full",
};
function fuelLabel(pct: number | null): string {
  if (pct == null) return "—";
  return FUEL_LABELS[pct] ?? `${pct}%`;
}

const STEPS = [
  "Checklist",
  "Inspection",
  "Comparison",
  "Review & Close",
] as const;

interface DamageEntry {
  angleLabel: string;
  severity: DamageSeverity;
  description: string;
}

const SEVERITY_ORDER: Record<DamageSeverity, number> = {
  severe: 0,
  moderate: 1,
  minor: 2,
};

function collectDamages(inspection: Inspection | undefined): DamageEntry[] {
  if (!inspection) return [];
  const out: DamageEntry[] = [];
  for (const photo of inspection.photos) {
    const angleLabel =
      PHOTO_ANGLES.find((a) => a.key === photo.angle)?.label ?? photo.angle;
    for (const ann of photo.annotations) {
      out.push({
        angleLabel,
        severity: ann.severity,
        description: ann.description,
      });
    }
    if (photo.aiResult && photo.aiResult.damagesFound > 0) {
      const aiOnly = photo.aiResult.damagesFound - photo.annotations.length;
      for (let i = 0; i < Math.max(0, aiOnly); i++) {
        out.push({
          angleLabel,
          severity: "moderate",
          description: "AI detected",
        });
      }
    }
  }
  out.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return out;
}

// ── Step Progress Component ─────────────────────────────────────────────────

interface StepProgressProps {
  currentStep: number;
  steps: readonly string[];
}

function StepProgress({ currentStep, steps }: StepProgressProps) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 20,
        paddingHorizontal: 24,
      }}
    >
      {steps.map((label, index) => {
        const isCompleted = index < currentStep;
        const isActive = index === currentStep;

        const circleSize = 32;
        const circleColor =
          isCompleted || isActive ? theme.accent : theme.surfaceTertiary;
        const textColor =
          isCompleted || isActive ? "#FFFFFF" : theme.textTertiary;

        return (
          <React.Fragment key={label}>
            {index > 0 && (
              <View
                style={{
                  flex: 1,
                  height: 2,
                  backgroundColor:
                    index <= currentStep ? theme.accent : theme.surfaceTertiary,
                  marginHorizontal: 4,
                }}
              />
            )}

            <View style={{ alignItems: "center" }}>
              <View
                style={{
                  width: circleSize,
                  height: circleSize,
                  borderRadius: circleSize / 2,
                  backgroundColor: circleColor,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isCompleted ? (
                  <Check size={16} color="#FFFFFF" strokeWidth={3} />
                ) : (
                  <Text
                    variant="bodySmall"
                    color={textColor}
                    style={{ fontWeight: "700", fontSize: 13 }}
                  >
                    {index + 1}
                  </Text>
                )}
              </View>
              <Text
                variant="bodySmall"
                color={isActive ? theme.accent : theme.textTertiary}
                style={{
                  marginTop: 4,
                  fontWeight: isActive ? "600" : "400",
                  fontSize: 11,
                }}
              >
                {label}
              </Text>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ── Checklist Item ──────────────────────────────────────────────────────────

interface ChecklistItemProps {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  checked: boolean;
  onToggle: () => void;
  subtitle?: string;
  testID?: string;
}

function ChecklistItem({
  icon: Icon,
  label,
  checked,
  onToggle,
  subtitle,
  testID,
}: ChecklistItemProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onToggle();
      }}
      testID={testID}
      accessibilityRole="button"
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 16,
        gap: 12,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: checked ? theme.accentSoft : theme.surfaceSecondary,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={20} color={checked ? theme.accent : theme.textTertiary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          variant="bodyMedium"
          color={checked ? theme.textPrimary : theme.textSecondary}
          style={{ fontWeight: checked ? "600" : "400" }}
        >
          {label}
        </Text>
        {subtitle != null && (
          <Text variant="caption" color={theme.textTertiary}>
            {subtitle}
          </Text>
        )}
      </View>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          borderWidth: 2,
          borderColor: checked ? theme.accent : theme.border,
          backgroundColor: checked ? theme.accent : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {checked && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
      </View>
    </Pressable>
  );
}

// ── Main Screen ─────────────────────────────────────────────────────────────

export default function ReturnScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const showToast = useToastStore((s) => s.show);
  const insets = useSafeAreaInsets();

  const {
    data: storeBooking,
    isLoading: isLoadingBooking,
    isError: isBookingError,
    refetch: refetchBooking,
  } = useBooking(id);
  const { data: vehicle } = useVehicle(storeBooking?.vehicleId ?? "");
  const { data: client } = useClient(storeBooking?.clientId ?? "");
  const { data: agency } = useAgency();
  const currency = agency?.currency ?? "EUR";
  const { data: relatedInspections = [] } = useInspections(
    storeBooking?.id ? { bookingId: storeBooking.id } : undefined,
  );
  const preRentalInspection = relatedInspections.find(
    (i) => i.type === "pre-rental",
  );

  const closeMutation = useCloseBooking();
  const captureDepositMutation = useCaptureDeposit();

  // Result of the close call — the server-issued damages invoice id and the
  // closed booking (carrying the authoritative overage figures + deposit
  // status). Surfaced on the success screen.
  const [closeResult, setCloseResult] = useState<{
    booking: Booking;
    invoiceId: string | null;
  } | null>(null);
  const [depositCaptured, setDepositCaptured] = useState(false);

  const [postInspectionId, setPostInspectionId] = useState<string | null>(null);
  const postRentalInspection = relatedInspections.find(
    (i) => i.type === "post-rental",
  );
  const existingPostInspectionId = postRentalInspection?.id;

  const [currentStep, setCurrentStep] = useState(0);
  const [completed, setCompleted] = useState(false);

  // Step 1 state
  const [fuelLevel, setFuelLevel] = useState<number | null>(null);
  const [keysReturned, setKeysReturned] = useState(false);
  const [mileageValue, setMileageValue] = useState("");

  // Seed the return-mileage field from the persisted value once the booking
  // hydrates, so an agent revisiting this screen sees what's already on
  // record (set via recordReturnMileage on a previous attempt).
  React.useEffect(() => {
    if (mileageValue !== "") return;
    const saved = storeBooking?.returnMileage;
    if (saved != null && saved > 0) {
      setMileageValue(String(saved));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeBooking?.returnMileage]);

  // If a post-rental inspection already exists for this booking, hydrate
  // mileage and fuel from it so the agent doesn't have to re-enter them.
  // The inspection record is the source of truth — it's set when the
  // BookingInspectionStep was completed on a previous attempt.
  React.useEffect(() => {
    if (!postRentalInspection) return;
    if (mileageValue === "" && postRentalInspection.mileage > 0) {
      setMileageValue(String(postRentalInspection.mileage));
    }
    if (fuelLevel == null && postRentalInspection.fuelLevel != null) {
      setFuelLevel(postRentalInspection.fuelLevel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postRentalInspection?.id]);

  // Step 3 (Comparison) — per-angle AI + manual review state, mirrors the
  // inspection detail screen.
  const runAngleAi = useRunInspectionAngleAi();
  const [pendingAiAngles, setPendingAiAngles] = useState<Set<PhotoAngle>>(
    new Set(),
  );
  const [manualReview, setManualReview] = useState<{
    angle: PhotoAngle;
    angleLabel: string;
  } | null>(null);

  const triggerAngleAi = useCallback(
    (angle: PhotoAngle) => {
      if (!postRentalInspection) return;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setPendingAiAngles((s) => new Set(s).add(angle));
      runAngleAi.mutate(
        { id: postRentalInspection.id, angle },
        {
          onError: (err) => {
            if (isInsufficientCredits(err)) {
              Alert.alert(
                t(
                  "inspections.detail.ai.insufficientCreditsTitle",
                  "Out of AI credits",
                ),
                t(
                  "inspections.detail.ai.insufficientCreditsMessage",
                  "Your agency has run out of AI inspection credits. Please contact your account administrator to add more.",
                ),
                [{ text: t("common.ok", "OK") }],
              );
              return;
            }
            showToast({
              variant: "error",
              title: t(
                "inspections.detail.ai.errorTitle",
                "AI analysis failed",
              ),
              message: err instanceof Error ? err.message : String(err),
            });
          },
          onSettled: () => {
            setPendingAiAngles((s) => {
              const next = new Set(s);
              next.delete(angle);
              return next;
            });
          },
        },
      );
    },
    [postRentalInspection, runAngleAi, showToast, t],
  );

  const days =
    storeBooking != null
      ? Math.max(
          1,
          Math.round(
            (Date.parse(storeBooking.endDate) -
              Date.parse(storeBooking.startDate)) /
              (1000 * 60 * 60 * 24),
          ) + 1,
        )
      : 0;
  const booking = storeBooking
    ? {
        id: storeBooking.id,
        client: {
          name: storeBooking.clientName,
          phone: client?.phone ?? "—",
          licenseNo: "—",
        },
        vehicle: {
          name: storeBooking.vehicleName,
          plate: vehicle?.licensePlate ?? "—",
          color: vehicle?.color ?? "—",
          vin: "—",
        },
        dates: {
          start: storeBooking.startDate,
          end: storeBooking.endDate,
          days,
        },
        mileageOut: storeBooking.startMileage ?? 0,
      }
    : null;

  // ── Mileage (pulled from the real booking when available) ────────────────
  const startMileage = storeBooking?.startMileage ?? null;
  const includedKm = storeBooking?.includedKm ?? DEFAULT_INCLUDED_KM;
  const extraKmRate = storeBooking?.extraKmRate ?? DEFAULT_EXTRA_KM_RATE;

  const parsedReturn = Number.parseInt(mileageValue.replace(/[^0-9]/g, ""), 10);
  const hasReturnInput =
    mileageValue.trim().length > 0 && Number.isFinite(parsedReturn);
  const isReturnMileageValid =
    hasReturnInput && startMileage != null && parsedReturn > startMileage;

  const kmDriven =
    isReturnMileageValid && startMileage != null
      ? parsedReturn - startMileage
      : 0;
  const kmOverage = Math.max(0, kmDriven - includedKm);
  // extraKmRate is stored in cents per km, so the product is already cents.
  const overageCostCents = Math.round(kmOverage * extraKmRate);

  // Mileage and fuel are now collected as part of Step 2 (the inspection).
  // Step 1 only gates on the Keys Returned checkbox.
  const allChecked = keysReturned;

  const newDamagesList = React.useMemo(
    () => collectDamages(postRentalInspection),
    [postRentalInspection],
  );
  const preExistingDamagesList = React.useMemo(
    () => collectDamages(preRentalInspection),
    [preRentalInspection],
  );
  const newDamagesCount = newDamagesList.length;
  const preExistingDamagesCount = preExistingDamagesList.length;

  const handleNext = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    }
  }, [currentStep]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    } else {
      router.back();
    }
  }, [currentStep, router]);

  const handleComplete = useCallback(async () => {
    if (!id) {
      showToast({
        variant: "error",
        title: t("bookings.mileage.errorBookingNotFound", "Booking not found"),
      });
      return;
    }

    if (!isReturnMileageValid) {
      showToast({
        variant: "error",
        title: t(
          "bookings.mileage.errorReturnBelowStart",
          "Return mileage must be higher than departure",
        ),
      });
      return;
    }

    // The contract is already signed and emailed at pickup — return only
    // closes the booking with the final mileage / fuel readings and links
    // the post-rental inspection. Close ALREADY issues the damages invoice
    // (incl. the km-overage line) and returns { booking, invoiceId } — capture
    // it so the success screen can surface the overage + invoice + deposit.
    try {
      const result = await closeMutation.mutateAsync({
        id,
        payload: {
          returnMileage: parsedReturn,
          fuelLevel: fuelLevel ?? undefined,
          postInspectionId: postInspectionId ?? undefined,
        },
      });
      setCloseResult(result);
    } catch (err) {
      showToast({
        variant: "error",
        title: t("bookings.mileage.errorInvalid", "Invalid mileage"),
        message: err instanceof Error ? err.message : undefined,
      });
      return;
    }

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCompleted(true);
  }, [
    id,
    isReturnMileageValid,
    parsedReturn,
    fuelLevel,
    postInspectionId,
    closeMutation,
    showToast,
    t,
  ]);

  // Capture the deposit (or part of it) to actually collect the damages /
  // overage charged by the close call. We don't pass an amount so the backend
  // applies its own default (the outstanding damages invoice balance) and we
  // avoid double-charging from a stale client figure.
  const handleCaptureDeposit = useCallback(() => {
    const closedBooking = closeResult?.booking;
    if (!closedBooking) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    captureDepositMutation.mutate(
      { id: closedBooking.id },
      {
        onSuccess: () => {
          setDepositCaptured(true);
          void Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          );
          showToast({
            variant: "success",
            title: t("return.success.depositCaptured", "Deposit captured"),
          });
        },
        onError: (err) => {
          showToast({
            variant: "error",
            title: t(
              "return.success.depositCaptureError",
              "Could not capture deposit",
            ),
            message: err instanceof Error ? err.message : undefined,
          });
        },
      },
    );
  }, [closeResult, captureDepositMutation, showToast, t]);

  // ── Loading / not-found guards ─────────────────────────────────────────

  if (isLoadingBooking && !storeBooking) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" color={theme.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if ((isBookingError && !storeBooking) || !booking) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View className="flex-1 items-center justify-center px-4 py-20">
          <EmptyState
            icon={Car}
            title={t("bookings.detail.notFound", "Booking not found")}
            actionLabel={t("common.retry", "Retry")}
            onAction={() => void refetchBooking()}
          />
        </View>
      </SafeAreaView>
    );
  }

  // ── Success Screen ──────────────────────────────────────────────────────

  if (completed) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <StatusBar style="dark" />
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 32,
          }}
        >
          <Animated.View entering={ZoomIn.springify().damping(12)}>
            <View
              style={{
                width: 120,
                height: 120,
                borderRadius: 60,
                backgroundColor: theme.successSoft,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 24,
              }}
            >
              <LinearGradient
                colors={[theme.success, "#34D399"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Check size={40} color="#FFFFFF" strokeWidth={3} />
              </LinearGradient>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(300).springify()}>
            <Text
              variant="headlineLarge"
              align="center"
              style={{ marginBottom: 8 }}
            >
              {t("return.success.title", { defaultValue: "Return Complete!" })}
            </Text>
            <Text
              variant="bodyMedium"
              color={theme.textSecondary}
              align="center"
              style={{ marginBottom: 8 }}
            >
              {t("return.success.subtitle", {
                defaultValue: "Vehicle return processed successfully",
              })}
            </Text>
            {newDamagesCount > 0 && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  marginBottom: 8,
                }}
              >
                <AlertTriangle size={14} color={theme.warning} />
                <Text variant="bodySmall" color={theme.warning}>
                  {t("return.success.newDamages", {
                    defaultValue: "{{count}} new damage(s) recorded",
                    count: newDamagesCount,
                  })}
                </Text>
              </View>
            )}
            <Text
              variant="bodySmall"
              color={theme.textTertiary}
              align="center"
              style={{ marginBottom: 24 }}
            >
              {t("return.success.booking", {
                defaultValue: "Booking {{id}}",
                id: booking.id,
              })}
            </Text>
          </Animated.View>

          {/* Server-authoritative overage (from the closed booking). The close
              call already billed it on the damages invoice. */}
          {(() => {
            const closed = closeResult?.booking;
            const overageCost = closed?.overageCost ?? 0;
            const kmOver = closed?.kmOverage ?? 0;
            if (overageCost <= 0 && kmOver <= 0) return null;
            return (
              <Animated.View
                entering={FadeInDown.delay(400).springify()}
                style={{
                  width: "100%",
                  marginBottom: 16,
                  borderRadius: 16,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  backgroundColor: theme.warningSoft,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text variant="bodyMedium" color={theme.warning}>
                    {t("return.success.overageLabel", {
                      defaultValue: "Mileage overage ({{km}} km)",
                      km: kmOver.toLocaleString(),
                    })}
                  </Text>
                  <Text
                    variant="titleSmall"
                    color={theme.warning}
                    style={{ fontWeight: "700" }}
                  >
                    {formatCurrency(overageCost, currency)}
                  </Text>
                </View>
              </Animated.View>
            );
          })()}

          <Animated.View
            entering={FadeInUp.delay(500).springify()}
            style={{ width: "100%", gap: 12 }}
          >
            {/* View the damages invoice the close call issued. */}
            {closeResult?.invoiceId ? (
              <Button
                testID="return-view-invoice-button"
                variant="secondary"
                fullWidth
                leftIcon={Receipt}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(
                    `/(app)/(more)/billing/${closeResult.invoiceId}` as never,
                  );
                }}
              >
                {t("return.success.viewInvoice", { defaultValue: "View invoice" })}
              </Button>
            ) : null}

            {/* Collect the charge against the held deposit, if any. */}
            {(closeResult?.booking?.depositStatus === "held" ||
              closeResult?.booking?.depositStatus === "partially_captured") &&
            !depositCaptured ? (
              <Button
                testID="return-capture-deposit-button"
                variant="primary"
                fullWidth
                leftIcon={Banknote}
                loading={captureDepositMutation.isPending}
                onPress={handleCaptureDeposit}
              >
                {t("return.success.captureDeposit", {
                  defaultValue: "Capture deposit",
                })}
              </Button>
            ) : null}

            <Button
              testID="return-done-button"
              variant={
                closeResult?.invoiceId || depositCaptured ? "ghost" : "primary"
              }
              fullWidth
              onPress={() => router.back()}
            >
              {t("return.success.done", { defaultValue: "Done" })}
            </Button>
          </Animated.View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Step 1: Return Checklist ────────────────────────────────────────────

  const renderStep1 = () => (
    <Animated.View entering={FadeIn.duration(300)} style={{ gap: 16 }}>
      {/* Return Info Banner */}
      <Card variant="accent" padding="md">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <RotateCcw size={20} color="#FFFFFF" />
          <View style={{ flex: 1 }}>
            <Text variant="bodySmall" color="#FFFFFF" style={{ opacity: 0.8 }}>
              {t("return.checklist.banner", {
                defaultValue: "Returning vehicle",
              })}
            </Text>
            <Text
              variant="titleMedium"
              color="#FFFFFF"
              style={{ fontWeight: "700" }}
            >
              {booking.vehicle.name} — {booking.client.name}
            </Text>
          </View>
        </View>
      </Card>

      <ReturnVehicleThumbnail vehicle={vehicle} theme={theme} />

      {/* Pre-rental reference (read-only) */}
      {preRentalInspection && (
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push(
              `/(app)/(inspections)/${preRentalInspection.id}` as never,
            );
          }}
          testID={`return-pre-rental-reference-${preRentalInspection.id}`}
          accessibilityRole="button"
          accessibilityLabel={t(
            "return.preRentalReference.title",
            "Pre-rental reference",
          )}
          style={{
            backgroundColor: theme.surface,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginBottom: 10,
            }}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                backgroundColor: theme.accentSoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FileText size={15} color={theme.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="titleMedium" style={{ fontWeight: "600" }}>
                {t("return.preRentalReference.title", "Pre-rental reference")}
              </Text>
              <Text variant="caption" color={theme.textTertiary}>
                {t(
                  "return.preRentalReference.subtitle",
                  "Condition recorded at pickup",
                )}
              </Text>
            </View>
            <Badge variant="info" size="sm">
              {preRentalInspection.date}
            </Badge>
          </View>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text variant="caption" color={theme.textTertiary}>
                {t("return.preRentalReference.mileage", "Mileage at pickup")}
              </Text>
              <Text
                variant="bodyMedium"
                style={{ fontWeight: "600", marginTop: 2 }}
              >
                {preRentalInspection.mileage.toLocaleString()} km
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="caption" color={theme.textTertiary}>
                {t("return.preRentalReference.fuel", "Fuel at pickup")}
              </Text>
              <Text
                variant="bodyMedium"
                style={{ fontWeight: "600", marginTop: 2 }}
              >
                {preRentalInspection.fuelLevel}%
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="caption" color={theme.textTertiary}>
                {t("return.preRentalReference.damages", "Pre-existing damages")}
              </Text>
              <Text
                variant="bodyMedium"
                color={
                  preRentalInspection.totalDamagesAI +
                    preRentalInspection.totalDamagesManual >
                  0
                    ? theme.warning
                    : theme.success
                }
                style={{ fontWeight: "600", marginTop: 2 }}
              >
                {preRentalInspection.totalDamagesAI +
                  preRentalInspection.totalDamagesManual}
              </Text>
            </View>
          </View>
        </Pressable>
      )}

      {/* Mileage (read-only summary; return mileage is captured on Step 2). */}
      <Card>
        <Text variant="titleLarge" style={{ marginBottom: 4 }}>
          {t("bookings.mileage.sectionTitle", "Mileage")}
        </Text>
        <Text
          variant="bodySmall"
          color={theme.textSecondary}
          style={{ marginBottom: 12 }}
        >
          {t("bookings.mileage.helperIncluded", {
            defaultValue: "{{included}} km included · {{rate}} / extra km",
            included: includedKm,
            rate: formatCurrency(extraKmRate, currency),
          })}
        </Text>

        {/* Departure km — read-only */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: 10,
            paddingHorizontal: 12,
            backgroundColor: theme.surfaceSecondary,
            borderRadius: 12,
            marginBottom: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Gauge size={16} color={theme.textTertiary} />
            <Text variant="bodySmall" color={theme.textSecondary}>
              {t("bookings.mileage.startMileageReadonly", "Departure mileage")}
            </Text>
          </View>
          <Text variant="bodyMedium" style={{ fontWeight: "600" }}>
            {startMileage != null
              ? `${startMileage.toLocaleString()} ${t("bookings.mileage.unit", "km")}`
              : "—"}
          </Text>
        </View>

        {/* Live computation panel — visible once Step 2 captures the
            return mileage on the inspection. */}
        {isReturnMileageValid && (
          <View style={{ marginTop: 12, gap: 8 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                paddingVertical: 8,
                paddingHorizontal: 12,
                backgroundColor: theme.surfaceSecondary,
                borderRadius: 10,
              }}
            >
              <Text variant="bodySmall" color={theme.textSecondary}>
                {t("bookings.mileage.kmDriven", "Km driven")}
              </Text>
              <Text
                variant="bodySmall"
                color={theme.accent}
                style={{ fontWeight: "700" }}
              >
                {kmDriven.toLocaleString()} {t("bookings.mileage.unit", "km")}
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                paddingVertical: 8,
                paddingHorizontal: 12,
                backgroundColor:
                  kmOverage > 0 ? theme.warningSoft : theme.surfaceSecondary,
                borderRadius: 10,
              }}
            >
              <Text
                variant="bodySmall"
                color={kmOverage > 0 ? theme.warning : theme.textSecondary}
              >
                {t("bookings.mileage.overage", "Overage")}
              </Text>
              <Text
                variant="bodySmall"
                color={kmOverage > 0 ? theme.warning : theme.textSecondary}
                style={{ fontWeight: "700" }}
              >
                {kmOverage.toLocaleString()} {t("bookings.mileage.unit", "km")}
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                paddingVertical: 8,
                paddingHorizontal: 12,
                backgroundColor:
                  kmOverage > 0 ? theme.warningSoft : theme.surfaceSecondary,
                borderRadius: 10,
              }}
            >
              <Text
                variant="bodySmall"
                color={kmOverage > 0 ? theme.warning : theme.textSecondary}
              >
                {t("bookings.mileage.extraCost", "Extra cost")}
              </Text>
              <Text
                variant="bodySmall"
                color={kmOverage > 0 ? theme.warning : theme.textSecondary}
                style={{ fontWeight: "700" }}
              >
                {formatCurrency(overageCostCents, currency)}
              </Text>
            </View>
          </View>
        )}
      </Card>

      {/* Keys */}
      <Card>
        <Text variant="titleLarge" style={{ marginBottom: 12 }}>
          {t("return.checklist.returnItems", {
            defaultValue: "Return Items",
          })}
        </Text>
        <ChecklistItem
          testID="return-checklist-keys-item"
          icon={Key}
          label={t("return.checklist.keys", {
            defaultValue: "Keys returned",
          })}
          checked={keysReturned}
          onToggle={() => setKeysReturned((v) => !v)}
        />
      </Card>

      {/* Continue */}
      <Button
        testID="return-checklist-continue-button"
        fullWidth
        disabled={!allChecked}
        onPress={handleNext}
      >
        {t("return.checklist.continue", {
          defaultValue: "Continue to Inspection",
        })}
      </Button>
    </Animated.View>
  );

  // ── Step 2: Post-Return Inspection ──────────────────────────────────────

  const renderStep2 = () =>
    storeBooking ? (
      <BookingInspectionStep
        bookingId={storeBooking.id}
        vehicleId={storeBooking.vehicleId}
        vehicleName={booking.vehicle.name}
        clientName={booking.client.name}
        type="post-rental"
        existingInspectionId={existingPostInspectionId}
        continueLabel={t("return.inspection.continue", {
          defaultValue: "Continue to Comparison",
        })}
        onInspectionReady={setPostInspectionId}
        onContinue={handleNext}
        mileageValue={mileageValue}
        onMileageChange={setMileageValue}
        mileageLabel={t(
          "bookings.mileage.returnMileageLabel",
          "Return mileage",
        )}
        fuelLevelValue={fuelLevel}
        onFuelLevelChange={setFuelLevel}
      />
    ) : null;

  // ── Step 3: Damage Comparison (per-angle AI + manual review) ────────────

  const renderStep3 = () => (
    <Animated.View entering={FadeIn.duration(300)} style={{ gap: 16 }}>
      <Card>
        <Text variant="titleLarge" style={{ marginBottom: 4 }}>
          {t("return.comparison.title", {
            defaultValue: "Damage Comparison",
          })}
        </Text>
        <Text variant="bodySmall" color={theme.textSecondary}>
          {t("return.comparison.subtitle", {
            defaultValue: "Before (pickup) vs. After (return)",
          })}
        </Text>
      </Card>

      {!preRentalInspection || !postRentalInspection ? (
        <Card>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              padding: 4,
            }}
          >
            <AlertTriangle size={18} color={theme.warning} />
            <Text variant="bodySmall" color={theme.warning} style={{ flex: 1 }}>
              {t("return.comparison.missingInspections", {
                defaultValue:
                  "Both pre-rental and post-rental inspections are required before you can compare damages.",
              })}
            </Text>
          </View>
        </Card>
      ) : (
        <>
          {/* AI summary (when present on the post-rental inspection) */}
          {postRentalInspection.aiSummary &&
            postRentalInspection.aiSummary.trim().length > 0 && (
              <Card>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 6,
                  }}
                >
                  <Sparkles size={14} color={theme.accent} />
                  <Text variant="titleSmall" style={{ fontWeight: "600" }}>
                    {t("inspections.detail.ai.summaryTitle", "AI summary")}
                  </Text>
                </View>
                <Text variant="bodySmall" color={theme.textSecondary}>
                  {postRentalInspection.aiSummary}
                </Text>
              </Card>
            )}

          <PrePostAngleList
            pre={preRentalInspection}
            post={postRentalInspection}
            pendingAngles={pendingAiAngles}
            onRunAi={triggerAngleAi}
            onManualReview={(angle, angleLabel) =>
              setManualReview({ angle, angleLabel })
            }
          />
        </>
      )}

      <Button
        testID="return-comparison-continue-button"
        fullWidth
        disabled={!preRentalInspection || !postRentalInspection}
        onPress={handleNext}
      >
        {t("return.comparison.continue", {
          defaultValue: "Continue to Review & Sign",
        })}
      </Button>
    </Animated.View>
  );

  // ── Step 4: Review & Sign ───────────────────────────────────────────────

  const renderStep4 = () => (
    <Animated.View entering={FadeIn.duration(300)} style={{ gap: 16 }}>
      {/* Damages — derived from inspection photos so the list reflects
          everything captured during the Comparison step. */}
      <Card>
        <Text variant="titleLarge" style={{ marginBottom: 12 }}>
          {t("return.review.damages", { defaultValue: "Damages" })}
        </Text>

        {/* Pre-existing */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <Text
            variant="titleSmall"
            color={theme.textSecondary}
            style={{ fontWeight: "600" }}
          >
            {t("return.comparison.preExisting", {
              defaultValue: "Pre-existing (from pickup)",
            })}
          </Text>
          <Text variant="bodySmall" style={{ fontWeight: "700" }}>
            {preExistingDamagesCount}
          </Text>
        </View>
        {preExistingDamagesList.length > 0 ? (
          <View style={{ gap: 6, marginBottom: 12 }}>
            {preExistingDamagesList.map((d, i) => (
              <DamageListItem
                key={`pre-${i}`}
                damage={d}
                tone="neutral"
                theme={theme}
              />
            ))}
          </View>
        ) : (
          <Text
            variant="bodySmall"
            color={theme.textTertiary}
            style={{ marginBottom: 12 }}
          >
            {t("return.comparison.noPrior", {
              defaultValue: "No pre-existing damages",
            })}
          </Text>
        )}

        <Divider />

        {/* New */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 12,
            marginBottom: 8,
          }}
        >
          <Text
            variant="titleSmall"
            color={newDamagesCount > 0 ? theme.danger : theme.success}
            style={{ fontWeight: "600" }}
          >
            {t("return.comparison.newDamages", {
              defaultValue: "New Damages",
            })}
          </Text>
          <Text
            variant="bodySmall"
            color={newDamagesCount > 0 ? theme.danger : theme.success}
            style={{ fontWeight: "700" }}
          >
            {newDamagesCount}
          </Text>
        </View>
        {newDamagesList.length > 0 ? (
          <View style={{ gap: 6 }}>
            {newDamagesList.map((d, i) => (
              <DamageListItem
                key={`new-${i}`}
                damage={d}
                tone="danger"
                theme={theme}
              />
            ))}
          </View>
        ) : (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingVertical: 8,
              paddingHorizontal: 12,
              backgroundColor: theme.successSoft,
              borderRadius: 10,
            }}
          >
            <CheckCircle size={16} color={theme.success} />
            <Text
              variant="bodySmall"
              color={theme.success}
              style={{ fontWeight: "600" }}
            >
              {t("return.comparison.noDamages", {
                defaultValue: "No new damages detected",
              })}
            </Text>
          </View>
        )}
      </Card>

      {/* Mileage Summary */}
      <Card>
        <Text variant="titleLarge" style={{ marginBottom: 12 }}>
          {t("return.comparison.summary", { defaultValue: "Return Summary" })}
        </Text>
        <View style={{ gap: 8 }}>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            <Text variant="bodySmall" color={theme.textSecondary}>
              {t("bookings.mileage.startMileageReadonly", "Departure mileage")}
            </Text>
            <Text variant="bodySmall" style={{ fontWeight: "600" }}>
              {startMileage != null
                ? `${startMileage.toLocaleString()} ${t("bookings.mileage.unit", "km")}`
                : "—"}
            </Text>
          </View>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            <Text variant="bodySmall" color={theme.textSecondary}>
              {t("bookings.mileage.returnMileageStored", "Return mileage")}
            </Text>
            <Text variant="bodySmall" style={{ fontWeight: "600" }}>
              {hasReturnInput
                ? `${parsedReturn.toLocaleString()} ${t("bookings.mileage.unit", "km")}`
                : "—"}
            </Text>
          </View>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            <Text variant="bodySmall" color={theme.textSecondary}>
              {t("bookings.mileage.kmDriven", "Km driven")}
            </Text>
            <Text
              variant="bodySmall"
              color={theme.accent}
              style={{ fontWeight: "700" }}
            >
              {kmDriven.toLocaleString()} {t("bookings.mileage.unit", "km")}
            </Text>
          </View>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            <Text variant="bodySmall" color={theme.textSecondary}>
              {t("bookings.mileage.overage", "Overage")}
            </Text>
            <Text
              variant="bodySmall"
              color={kmOverage > 0 ? theme.warning : theme.textSecondary}
              style={{ fontWeight: "700" }}
            >
              {kmOverage.toLocaleString()} {t("bookings.mileage.unit", "km")}
            </Text>
          </View>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            <Text variant="bodySmall" color={theme.textSecondary}>
              {t("bookings.mileage.extraCost", "Extra cost")}
            </Text>
            <Text
              variant="bodySmall"
              color={kmOverage > 0 ? theme.warning : theme.textSecondary}
              style={{ fontWeight: "700" }}
            >
              {formatCurrency(overageCostCents, currency)}
            </Text>
          </View>
          <Divider />
          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            <Text variant="bodySmall" color={theme.textSecondary}>
              {t("return.comparison.fuelReturn", {
                defaultValue: "Fuel Level",
              })}
            </Text>
            <Text variant="bodySmall" style={{ fontWeight: "600" }}>
              {fuelLabel(fuelLevel)}
            </Text>
          </View>
        </View>
      </Card>

      {/* Close Booking */}
      {(() => {
        const isSubmitting = closeMutation.isPending;
        return (
          <View style={{ ...shadows.accent, borderRadius: 9999 }}>
            <LinearGradient
              colors={[theme.accentGradientStart, theme.accentGradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ borderRadius: 9999, overflow: "hidden" }}
            >
              <Pressable
                onPress={handleComplete}
                disabled={isSubmitting}
                testID="return-close-booking-button"
                accessibilityRole="button"
                style={{
                  height: 52,
                  borderRadius: 9999,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 8,
                  opacity: isSubmitting ? 0.5 : 1,
                }}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <CheckCircle size={20} color="#FFFFFF" />
                )}
                <Text
                  variant="bodyLarge"
                  color="#FFFFFF"
                  style={{ fontWeight: "700" }}
                >
                  {isSubmitting
                    ? t("return.review.closing", {
                        defaultValue: "Closing…",
                      })
                    : t("return.review.close", {
                        defaultValue: "Close Booking",
                      })}
                </Text>
              </Pressable>
            </LinearGradient>
          </View>
        );
      })()}
    </Animated.View>
  );

  // ── Main Layout ─────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar style="dark" />

      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 8,
          gap: 12,
        }}
      >
        <IconButton
          icon={ChevronLeft}
          variant="ghost"
          size="md"
          onPress={handleBack}
        />
        <View style={{ flex: 1 }}>
          <Text variant="headlineSmall">
            {t("return.title", { defaultValue: "Vehicle Return" })}
          </Text>
          <Text variant="bodySmall" color={theme.textSecondary}>
            {booking.id}
          </Text>
        </View>
      </View>

      {/* Step Indicator */}
      <StepProgress currentStep={currentStep} steps={STEPS} />

      {/* Content */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 110 + insets.bottom,
        }}
        bounces
      >
        {currentStep === 0 && renderStep1()}
        {currentStep === 1 && renderStep2()}
        {currentStep === 2 && renderStep3()}
        {currentStep === 3 && renderStep4()}
      </ScrollView>

      {/* Manual angle review modal (Step 3) */}
      {manualReview && postRentalInspection && (
        <ManualAngleReviewModal
          inspectionId={postRentalInspection.id}
          angle={manualReview.angle}
          angleLabel={manualReview.angleLabel}
          postPhoto={postRentalInspection.photos.find(
            (p) => p.angle === manualReview.angle,
          )}
          prePhoto={preRentalInspection?.photos.find(
            (p) => p.angle === manualReview.angle,
          )}
          onClose={() => setManualReview(null)}
        />
      )}
    </SafeAreaView>
  );
}

// ── Damage list item (Step 4) ───────────────────────────────────────────────

const SEVERITY_LABEL: Record<DamageSeverity, string> = {
  minor: "Minor",
  moderate: "Moderate",
  severe: "Severe",
};

function DamageListItem({
  damage,
  tone,
  theme,
}: {
  damage: DamageEntry;
  tone: "neutral" | "danger";
  theme: ReturnType<typeof useTheme>;
}) {
  const severityColor =
    damage.severity === "severe"
      ? theme.danger
      : damage.severity === "moderate"
        ? theme.warning
        : theme.info;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor:
          tone === "danger" ? theme.dangerSoft : theme.surfaceSecondary,
        borderRadius: 10,
        gap: 8,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodySmall" style={{ fontWeight: "600" }}>
          {damage.angleLabel}
        </Text>
        <Text variant="caption" color={theme.textTertiary} numberOfLines={2}>
          {damage.description}
        </Text>
      </View>
      <View
        style={{
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 9999,
          backgroundColor: severityColor + "22",
        }}
      >
        <Text
          variant="caption"
          color={severityColor}
          style={{ fontWeight: "700" }}
        >
          {SEVERITY_LABEL[damage.severity]}
        </Text>
      </View>
    </View>
  );
}

interface ReturnVehicleThumbnailProps {
  vehicle: Parameters<typeof resolveVehicleImageSource>[0];
  theme: ReturnType<typeof useTheme>;
}

function ReturnVehicleThumbnail({
  vehicle,
  theme,
}: ReturnVehicleThumbnailProps) {
  const source = resolveVehicleImageSource(vehicle);
  if (!source) return null;
  return (
    <View
      style={{
        width: "100%",
        height: 140,
        borderRadius: 14,
        overflow: "hidden",
        backgroundColor: theme.surfaceTertiary,
      }}
    >
      <Image
        source={source}
        style={{ width: "100%", height: "100%" }}
        contentFit="cover"
        transition={200}
      />
    </View>
  );
}
