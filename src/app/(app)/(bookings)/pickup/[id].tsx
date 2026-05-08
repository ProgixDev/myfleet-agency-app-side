import React, { useState, useCallback } from "react";
import { View, Pressable, ScrollView } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
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
  UserCheck,
  CreditCard,
  Key,
  FileText,
  Shield,
  Car,
  AlertTriangle,
} from "lucide-react-native";

import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Divider } from "@/components/ui/Divider";
import { IconButton } from "@/components/ui/IconButton";
import { useToastStore } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { Image } from "@/components/ui/Image";
import { resolveVehicleImageSource } from "@/data/vehicleImages";
import {
  useBooking,
  useMarkCashPaid,
  useRecordStartMileage,
  useStartPickup,
} from "@/hooks/useBookings";
import { useVehicle } from "@/hooks/useFleet";
import { useClient } from "@/hooks/useClients";
import {
  useContracts,
  useCreateContract,
  useSignContract,
} from "@/hooks/useContracts";
import { invoiceKeys, useInvoices } from "@/hooks/useInvoices";
import { useAgency } from "@/hooks/useAgency";
import { useQueryClient } from "@tanstack/react-query";
import {
  SignaturePad,
  type SignaturePadRef,
} from "@/components/contracts/SignaturePad";
import { BookingInspectionStep } from "@/components/inspection/BookingInspectionStep";
import { getPickupEligibility } from "@/utils/pickupEligibility";
import { formatCurrency } from "@/utils/format";
import { useTheme } from "@/hooks/useTheme";
import { shadows } from "@/theme/shadows";
import { ActivityIndicator } from "react-native";

const STEPS = ["Reservation", "Inspection", "Contract"] as const;

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
  sublabel?: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

function ChecklistItem({
  icon: Icon,
  label,
  sublabel,
  checked,
  onToggle,
  disabled,
}: ChecklistItemProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onToggle();
      }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 16,
        gap: 12,
        opacity: disabled ? 0.85 : 1,
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
        {sublabel ? (
          <Text
            variant="bodySmall"
            color={theme.textTertiary}
            style={{ marginTop: 2 }}
          >
            {sublabel}
          </Text>
        ) : null}
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

export default function PickupScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const showToast = useToastStore((s) => s.show);
  const insets = useSafeAreaInsets();

  const {
    data: realBooking,
    isLoading: isLoadingBooking,
    isError: isBookingError,
    refetch: refetchBooking,
  } = useBooking(id);
  const { data: vehicle } = useVehicle(realBooking?.vehicleId ?? "");
  const { data: client } = useClient(realBooking?.clientId ?? "");
  const { data: agency } = useAgency();
  const currency = agency?.currency ?? "EUR";

  const startPickupMutation = useStartPickup();
  const recordStartMileageMutation = useRecordStartMileage();
  const markCashPaidMutation = useMarkCashPaid();
  const createContractMutation = useCreateContract();
  const signContractMutation = useSignContract();
  const sigPadRef = React.useRef<SignaturePadRef>(null);

  // Look up an existing contract for this booking so we don't create duplicates.
  const { data: existingContracts = [] } = useContracts(
    realBooking?.id ? { bookingId: realBooking.id } : undefined,
  );
  const contractId = existingContracts[0]?.id ?? null;

  // For online bookings: refetch on focus so a Stripe webhook flipping
  // the rental invoice → 'paid' is reflected on the checklist without a
  // manual pull-to-refresh.
  const queryClient = useQueryClient();
  useFocusEffect(
    React.useCallback(() => {
      void refetchBooking();
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
    }, [refetchBooking, queryClient]),
  );

  // Stamp pickupStartedAt on the booking when this screen first opens.
  const [, setPreInspectionId] = useState<string | null>(null);
  React.useEffect(() => {
    if (!realBooking?.id) return;
    if (realBooking.workflow?.pickupStartedAt == null) {
      startPickupMutation.mutate(realBooking.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realBooking?.id]);

  const [currentStep, setCurrentStep] = useState(0);

  // Ensure the contract row exists once we reach the contract step so the
  // signature endpoint has an id to write against.
  React.useEffect(() => {
    if (currentStep !== 2) return;
    if (!realBooking?.id) return;
    if (existingContracts.length > 0) return;
    if (createContractMutation.isPending) return;
    createContractMutation.mutate({ bookingId: realBooking.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, realBooking?.id, existingContracts.length]);
  const [completed, setCompleted] = useState(false);

  // Step 1 state
  const [identityVerified, setIdentityVerified] = useState(false);
  // Cash bookings: agent ticks this manually; the toggle is sent to the
  // backend (markCashPaid) when pickup completes.
  // Online bookings: server is the source of truth — the rental invoice's
  // status flips to 'paid' (or 'partially-paid'/'refund_pending' for edge
  // cases) once the Stripe webhook reconciles. We never gate pickup on a
  // manually-ticked checkbox for online bookings.
  const [cashPaymentTicked, setCashPaymentTicked] = useState(false);
  const isCashBooking = realBooking?.paymentMethod === "cash";
  const { data: bookingInvoices } = useInvoices(
    realBooking?.id ? { bookingId: realBooking.id, kind: "rental" } : undefined,
    { enabled: !!realBooking?.id },
  );
  const rentalInvoice = bookingInvoices?.[0];
  const onlinePaid = rentalInvoice?.status === "paid";
  const paymentReceived = isCashBooking ? cashPaymentTicked : onlinePaid;
  const [keysReady, setKeysReady] = useState(false);
  const [startMileageInput, setStartMileageInput] = useState("");
  const [startFuelLevel, setStartFuelLevel] = useState<number | null>(null);

  // Seed the mileage field from the persisted value once the booking
  // hydrates, so an agent revisiting this screen mid-pickup sees what's
  // already on record (set via recordStartMileage on a previous attempt).
  React.useEffect(() => {
    if (startMileageInput !== "") return;
    const saved = realBooking?.startMileage;
    if (saved != null && saved > 0) {
      setStartMileageInput(String(saved));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realBooking?.startMileage]);

  // Step 3 state
  const [contractSigned, setContractSigned] = useState(false);

  // Derive the view-model that the existing JSX expects from real backend data.
  // Some fields (vin, license number) are not yet on the typed entities and fall
  // back to placeholders until those types are extended.
  const days =
    realBooking != null
      ? Math.max(
          1,
          Math.round(
            (Date.parse(realBooking.endDate) -
              Date.parse(realBooking.startDate)) /
              (1000 * 60 * 60 * 24),
          ) + 1,
        )
      : 0;
  const booking = realBooking
    ? {
        id: realBooking.id,
        client: {
          name: realBooking.clientName,
          phone: client?.phone ?? "—",
          licenseNo: "—",
        },
        vehicle: {
          name: realBooking.vehicleName,
          plate: vehicle?.licensePlate ?? "—",
          color: vehicle?.color ?? "—",
          vin: "—",
        },
        dates: {
          start: realBooking.startDate,
          end: realBooking.endDate,
          days,
        },
        pricing: {
          daily: realBooking.dailyRate,
          total: realBooking.totalAmount,
          deposit: realBooking.deposit,
          currency,
        },
        insurance:
          realBooking.insurance?.tier === "all_inclusive"
            ? ("all-inclusive" as const)
            : ("basic" as const),
      }
    : null;

  const parsedStartMileage = Number.parseInt(
    startMileageInput.replace(/[^0-9]/g, ""),
    10,
  );
  const isStartMileageValid =
    startMileageInput.trim().length > 0 &&
    Number.isFinite(parsedStartMileage) &&
    parsedStartMileage > 0;

  // Mileage is collected as part of Step 2 (the inspection), so the Step 1
  // continue button doesn't gate on it.
  const allChecked = identityVerified && paymentReceived && keysReady;

  const handleNext = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentStep < 2) {
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
    if (!id || !isStartMileageValid) {
      showToast({
        variant: "error",
        title: t(
          "bookings.mileage.startMileageRequired",
          "Departure mileage required",
        ),
      });
      return;
    }

    if (!contractId) {
      showToast({
        variant: "error",
        title: t("pickup.contract.notReady", {
          defaultValue: "Contract not ready",
        }),
      });
      return;
    }
    if (sigPadRef.current?.isEmpty() ?? true) {
      showToast({
        variant: "error",
        title: t("pickup.contract.signatureRequired", {
          defaultValue: "Signature required",
        }),
      });
      return;
    }

    try {
      await recordStartMileageMutation.mutateAsync({
        id,
        km: parsedStartMileage,
      });
    } catch (err) {
      showToast({
        variant: "error",
        title: t("bookings.mileage.errorInvalid", "Invalid mileage"),
        message: err instanceof Error ? err.message : undefined,
      });
      return;
    }

    try {
      const svg = sigPadRef.current?.toSvg() ?? "";
      await signContractMutation.mutateAsync({
        id: contractId,
        payload: {
          role: "lessee",
          svg,
          signerName: realBooking?.clientName ?? "Client",
        },
      });
    } catch (err) {
      showToast({
        variant: "error",
        title: t("pickup.contract.signFailed", {
          defaultValue: "Couldn't sign contract",
        }),
        message: err instanceof Error ? err.message : undefined,
      });
      return;
    }

    // Cash payment: agent ticked the box at pickup, now persist it.
    // Online payment: server-side already paid via Stripe webhook, nothing to do.
    if (
      isCashBooking &&
      cashPaymentTicked &&
      realBooking?.depositStatus !== "held"
    ) {
      try {
        await markCashPaidMutation.mutateAsync(id);
      } catch (err) {
        showToast({
          variant: "error",
          title: t("pickup.checklist.markCashFailed", {
            defaultValue: "Couldn't record cash payment",
          }),
          message: err instanceof Error ? err.message : undefined,
        });
        return;
      }
    }

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCompleted(true);
  }, [
    id,
    isStartMileageValid,
    parsedStartMileage,
    recordStartMileageMutation,
    realBooking,
    contractId,
    signContractMutation,
    isCashBooking,
    cashPaymentTicked,
    markCashPaidMutation,
    showToast,
    t,
  ]);

  // ── Success Screen ──────────────────────────────────────────────────────

  if (isLoadingBooking && !realBooking) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" color={theme.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if ((isBookingError && !realBooking) || !booking) {
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

  const eligibility = realBooking
    ? getPickupEligibility(realBooking)
    : { kind: "ok" as const };

  if (eligibility.kind !== "ok" && !completed) {
    const title =
      eligibility.kind === "already-handed-off"
        ? t("pickup.gate.alreadyTitle", {
            defaultValue: "Already handed off",
          })
        : eligibility.kind === "too-early"
          ? t("pickup.gate.tooEarlyTitle", {
              defaultValue: "Pickup not open yet",
            })
          : t("pickup.gate.closedTitle", {
              defaultValue: "Booking closed",
            });
    const message =
      eligibility.kind === "already-handed-off"
        ? t("pickup.gate.alreadyMessage", {
            defaultValue: "This booking was handed off on {{at}}.",
            at: new Date(eligibility.pickupCompletedAt).toLocaleString(),
          })
        : eligibility.kind === "too-early"
          ? t("pickup.gate.tooEarlyMessage", {
              defaultValue:
                "Pickup opens at {{at}} (2 hours before the booking start).",
              at: eligibility.earliestAt.toLocaleString(),
            })
          : t("pickup.gate.closedMessage", {
              defaultValue:
                "This booking is {{status}}. No further pickup actions are allowed.",
              status: eligibility.status,
            });
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <StatusBar style="dark" />
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 32,
            gap: 16,
          }}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: theme.warningSoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AlertTriangle size={36} color={theme.warning} />
          </View>
          <Text variant="headlineMedium" align="center">
            {title}
          </Text>
          <Text variant="bodyMedium" color={theme.textSecondary} align="center">
            {message}
          </Text>
          <Button fullWidth onPress={() => router.back()}>
            {t("common.done", { defaultValue: "Done" })}
          </Button>
        </View>
      </SafeAreaView>
    );
  }

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
                backgroundColor: theme.accentSoft,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 24,
              }}
            >
              <LinearGradient
                colors={[theme.accentGradientStart, theme.accentGradientEnd]}
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
              {t("pickup.success.title", { defaultValue: "Vehicle Departed!" })}
            </Text>
            <Text
              variant="bodyMedium"
              color={theme.textSecondary}
              align="center"
              style={{ marginBottom: 8 }}
            >
              {t("pickup.success.subtitle", {
                defaultValue: "Pickup process completed successfully",
              })}
            </Text>
            <Text
              variant="bodySmall"
              color={theme.textTertiary}
              align="center"
              style={{ marginBottom: 32 }}
            >
              {t("pickup.success.booking", {
                defaultValue: "Booking {{id}}",
                id: booking.id,
              })}
            </Text>
          </Animated.View>

          <Animated.View
            entering={FadeInUp.delay(500).springify()}
            style={{ width: "100%" }}
          >
            <Button fullWidth onPress={() => router.back()}>
              {t("pickup.success.done", { defaultValue: "Done" })}
            </Button>
          </Animated.View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Step 1: Reservation Summary ─────────────────────────────────────────

  const renderStep1 = () => (
    <Animated.View entering={FadeIn.duration(300)} style={{ gap: 16 }}>
      {/* Booking Summary */}
      <Card>
        <View style={{ gap: 12 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text variant="headlineSmall">
              {t("pickup.reservation.title", {
                defaultValue: "Booking Summary",
              })}
            </Text>
            <Badge variant="accent">{booking.id}</Badge>
          </View>

          <VehicleThumbnail vehicle={vehicle} theme={theme} />

          <Divider />

          <View style={{ gap: 8 }}>
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <Text variant="bodySmall" color={theme.textSecondary}>
                {t("pickup.reservation.client", { defaultValue: "Client" })}
              </Text>
              <Text variant="bodySmall" style={{ fontWeight: "600" }}>
                {booking.client.name}
              </Text>
            </View>
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <Text variant="bodySmall" color={theme.textSecondary}>
                {t("pickup.reservation.phone", { defaultValue: "Phone" })}
              </Text>
              <Text variant="bodySmall" style={{ fontWeight: "600" }}>
                {booking.client.phone}
              </Text>
            </View>
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <Text variant="bodySmall" color={theme.textSecondary}>
                {t("pickup.reservation.license", { defaultValue: "License" })}
              </Text>
              <Text variant="bodySmall" style={{ fontWeight: "600" }}>
                {booking.client.licenseNo}
              </Text>
            </View>
          </View>

          <Divider />

          <View style={{ gap: 8 }}>
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <Text variant="bodySmall" color={theme.textSecondary}>
                {t("pickup.reservation.vehicle", { defaultValue: "Vehicle" })}
              </Text>
              <Text variant="bodySmall" style={{ fontWeight: "600" }}>
                {booking.vehicle.name}
              </Text>
            </View>
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <Text variant="bodySmall" color={theme.textSecondary}>
                {t("pickup.reservation.plate", { defaultValue: "Plate" })}
              </Text>
              <Text variant="bodySmall" style={{ fontWeight: "600" }}>
                {booking.vehicle.plate}
              </Text>
            </View>
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <Text variant="bodySmall" color={theme.textSecondary}>
                {t("pickup.reservation.period", { defaultValue: "Period" })}
              </Text>
              <Text variant="bodySmall" style={{ fontWeight: "600" }}>
                {booking.dates.start} - {booking.dates.end} (
                {booking.dates.days}d)
              </Text>
            </View>
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <Text variant="bodySmall" color={theme.textSecondary}>
                {t("pickup.reservation.total", { defaultValue: "Total" })}
              </Text>
              <Text
                variant="bodySmall"
                color={theme.accent}
                style={{ fontWeight: "700" }}
              >
                {formatCurrency(
                  booking.pricing.total,
                  booking.pricing.currency,
                )}
              </Text>
            </View>
          </View>
        </View>
      </Card>

      {/* Checklist */}
      <Card>
        <Text variant="titleLarge" style={{ marginBottom: 4 }}>
          {t("pickup.checklist.title", {
            defaultValue: "Pre-Departure Checklist",
          })}
        </Text>
        <Text
          variant="bodySmall"
          color={theme.textSecondary}
          style={{ marginBottom: 12 }}
        >
          {t("pickup.checklist.subtitle", {
            defaultValue: "Verify all items before proceeding",
          })}
        </Text>

        <ChecklistItem
          icon={UserCheck}
          label={t("pickup.checklist.identity", {
            defaultValue: "Client identity verified",
          })}
          checked={identityVerified}
          onToggle={() => setIdentityVerified((v) => !v)}
        />
        <View
          style={{
            height: 1,
            backgroundColor: theme.borderLight,
            marginHorizontal: 16,
          }}
        />
        <ChecklistItem
          icon={CreditCard}
          label={t("pickup.checklist.payment", {
            defaultValue: "Payment received",
          })}
          sublabel={
            isCashBooking
              ? rentalInvoice
                ? t("pickup.checklist.paymentCashHintAmount", {
                    defaultValue: "Collect {{amount}} cash",
                    amount: formatCurrency(
                      rentalInvoice.remainingBalance,
                      currency,
                    ),
                  })
                : t("pickup.checklist.paymentCashHint", {
                    defaultValue: "Cash at pickup — tick once collected",
                  })
              : onlinePaid
                ? rentalInvoice
                  ? t("pickup.checklist.paymentOnlinePaidAmount", {
                      defaultValue: "Invoice paid · {{amount}}",
                      amount: formatCurrency(rentalInvoice.totalDue, currency),
                    })
                  : t("pickup.checklist.paymentOnlinePaid", {
                      defaultValue: "Invoice marked paid",
                    })
                : rentalInvoice
                  ? t("pickup.checklist.paymentOnlineWaitingAmount", {
                      defaultValue: "Awaiting payment · {{amount}} due",
                      amount: formatCurrency(
                        rentalInvoice.remainingBalance,
                        currency,
                      ),
                    })
                  : t("pickup.checklist.paymentOnlineWaiting", {
                      defaultValue: "Awaiting payment confirmation",
                    })
          }
          checked={paymentReceived}
          onToggle={() => setCashPaymentTicked((v) => !v)}
          disabled={!isCashBooking}
        />
        <View
          style={{
            height: 1,
            backgroundColor: theme.borderLight,
            marginHorizontal: 16,
          }}
        />
        <ChecklistItem
          icon={Key}
          label={t("pickup.checklist.keys", {
            defaultValue: "Vehicle keys prepared",
          })}
          checked={keysReady}
          onToggle={() => setKeysReady((v) => !v)}
        />
      </Card>

      {/* Continue Button */}
      <Button fullWidth disabled={!allChecked} onPress={handleNext}>
        {t("pickup.reservation.continue", {
          defaultValue: "Continue to Inspection",
        })}
      </Button>
    </Animated.View>
  );

  // ── Step 2: Pre-Departure Inspection ────────────────────────────────────

  const renderStep2 = () =>
    realBooking ? (
      <BookingInspectionStep
        bookingId={realBooking.id}
        vehicleId={realBooking.vehicleId}
        vehicleName={booking.vehicle.name}
        clientName={booking.client.name}
        type="pre-rental"
        existingInspectionId={realBooking.workflow?.preInspectionId}
        showSignatures
        continueLabel={t("pickup.inspection.continue", {
          defaultValue: "Continue to Contract",
        })}
        onInspectionReady={setPreInspectionId}
        onContinue={handleNext}
        mileageValue={startMileageInput}
        onMileageChange={setStartMileageInput}
        mileageLabel={t(
          "bookings.mileage.startMileageLabel",
          "Departure mileage",
        )}
        fuelLevelValue={startFuelLevel}
        onFuelLevelChange={setStartFuelLevel}
      />
    ) : null;

  // ── Step 3: Contract ────────────────────────────────────────────────────

  const renderStep3 = () => (
    <Animated.View entering={FadeIn.duration(300)} style={{ gap: 16 }}>
      {/* Contract Preview */}
      <Card>
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: theme.accentSoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FileText size={20} color={theme.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="titleLarge">
                {t("pickup.contract.title", {
                  defaultValue: "Rental Contract",
                })}
              </Text>
              <Text variant="bodySmall" color={theme.textSecondary}>
                {t("pickup.contract.subtitle", {
                  defaultValue: "Review and sign to complete",
                })}
              </Text>
            </View>
          </View>

          <Divider />

          {/* Contract Details */}
          <View style={{ gap: 10 }}>
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <Text variant="bodySmall" color={theme.textSecondary}>
                {t("pickup.contract.contractId", {
                  defaultValue: "Contract ID",
                })}
              </Text>
              <Text variant="bodySmall" style={{ fontWeight: "600" }}>
                CTR-{booking.id.replace("BK-", "")}
              </Text>
            </View>
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <Text variant="bodySmall" color={theme.textSecondary}>
                {t("pickup.contract.renter", { defaultValue: "Renter" })}
              </Text>
              <Text variant="bodySmall" style={{ fontWeight: "600" }}>
                {booking.client.name}
              </Text>
            </View>
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <Text variant="bodySmall" color={theme.textSecondary}>
                {t("pickup.contract.vehicle", { defaultValue: "Vehicle" })}
              </Text>
              <Text variant="bodySmall" style={{ fontWeight: "600" }}>
                {booking.vehicle.name}
              </Text>
            </View>
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <Text variant="bodySmall" color={theme.textSecondary}>
                {t("pickup.contract.plateNumber", { defaultValue: "Plate" })}
              </Text>
              <Text variant="bodySmall" style={{ fontWeight: "600" }}>
                {booking.vehicle.plate}
              </Text>
            </View>
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <Text variant="bodySmall" color={theme.textSecondary}>
                {t("pickup.contract.vin", { defaultValue: "VIN" })}
              </Text>
              <Text variant="bodySmall" style={{ fontWeight: "600" }}>
                {booking.vehicle.vin}
              </Text>
            </View>
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <Text variant="bodySmall" color={theme.textSecondary}>
                {t("pickup.contract.rentalPeriod", {
                  defaultValue: "Rental Period",
                })}
              </Text>
              <Text variant="bodySmall" style={{ fontWeight: "600" }}>
                {booking.dates.start} - {booking.dates.end}
              </Text>
            </View>
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <Text variant="bodySmall" color={theme.textSecondary}>
                {t("pickup.contract.dailyRate", { defaultValue: "Daily Rate" })}
              </Text>
              <Text variant="bodySmall" style={{ fontWeight: "600" }}>
                {formatCurrency(
                  booking.pricing.daily,
                  booking.pricing.currency,
                )}
              </Text>
            </View>
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <Text variant="bodySmall" color={theme.textSecondary}>
                {t("pickup.contract.totalAmount", {
                  defaultValue: "Total Amount",
                })}
              </Text>
              <Text
                variant="bodySmall"
                color={theme.accent}
                style={{ fontWeight: "700" }}
              >
                {formatCurrency(
                  booking.pricing.total,
                  booking.pricing.currency,
                )}
              </Text>
            </View>
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <Text variant="bodySmall" color={theme.textSecondary}>
                {t("pickup.contract.deposit", { defaultValue: "Deposit" })}
              </Text>
              <Text variant="bodySmall" style={{ fontWeight: "600" }}>
                {formatCurrency(
                  booking.pricing.deposit,
                  booking.pricing.currency,
                )}
              </Text>
            </View>
          </View>
        </View>
      </Card>

      {/* Insurance Tier */}
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: theme.successSoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Shield size={20} color={theme.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="titleMedium" style={{ fontWeight: "600" }}>
              {t("pickup.contract.insurance", { defaultValue: "Insurance" })}
            </Text>
            <Text variant="bodySmall" color={theme.textSecondary}>
              {booking.insurance === "all-inclusive"
                ? t("pickup.contract.insuranceAllInclusive", {
                    defaultValue: "All-Inclusive Coverage",
                  })
                : t("pickup.contract.insuranceBasic", {
                    defaultValue: "Basic Coverage",
                  })}
            </Text>
          </View>
          <Badge
            variant={
              booking.insurance === "all-inclusive" ? "success" : "neutral"
            }
          >
            {booking.insurance === "all-inclusive"
              ? t("pickup.contract.allInclusive", {
                  defaultValue: "All-Inclusive",
                })
              : t("pickup.contract.basic", { defaultValue: "Basic" })}
          </Badge>
        </View>
      </Card>

      {/* Contract Signature */}
      <Card>
        <Text variant="titleLarge" style={{ marginBottom: 12 }}>
          {t("pickup.contract.signatureTitle", {
            defaultValue: "Contract Signature",
          })}
        </Text>
        <SignaturePad
          ref={sigPadRef}
          label={t("pickup.contract.clientSignature", {
            defaultValue: "Client Signature",
          })}
          onSignatureChange={setContractSigned}
        />
      </Card>

      {/* Sign & Complete */}
      <View style={{ ...shadows.accent, borderRadius: 9999 }}>
        <LinearGradient
          colors={[theme.accentGradientStart, theme.accentGradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ borderRadius: 9999, overflow: "hidden" }}
        >
          <Pressable
            onPress={handleComplete}
            disabled={!contractSigned}
            style={{
              height: 52,
              borderRadius: 9999,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 8,
              opacity: contractSigned ? 1 : 0.5,
            }}
          >
            <CheckCircle size={20} color="#FFFFFF" />
            <Text
              variant="bodyLarge"
              color="#FFFFFF"
              style={{ fontWeight: "700" }}
            >
              {t("pickup.contract.complete", {
                defaultValue: "Sign & Complete",
              })}
            </Text>
          </Pressable>
        </LinearGradient>
      </View>
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
            {t("pickup.title", { defaultValue: "Vehicle Pickup" })}
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
      </ScrollView>
    </SafeAreaView>
  );
}

interface VehicleThumbnailProps {
  vehicle: Parameters<typeof resolveVehicleImageSource>[0];
  theme: ReturnType<typeof useTheme>;
}

function VehicleThumbnail({ vehicle, theme }: VehicleThumbnailProps) {
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
