import React, { useState } from "react";
import { View, Pressable } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  ChevronLeft,
  Gauge,
  ParkingSquare,
  CircleAlert,
  AlertTriangle,
  Car,
  User,
  MapPin,
  CreditCard,
  CheckCircle,
  Clock,
  Send,
  Download,
  FileWarning,
  ExternalLink,
  Banknote,
  Search,
  ShieldAlert,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";

import { ScreenWrapper } from "@/components/ui/ScreenWrapper";
import { Text } from "@/components/ui/Text";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Divider } from "@/components/ui/Divider";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useToastStore } from "@/components/ui/Toast";
import { formatCurrency, formatDate } from "@/utils/format";
import { useViolation, useUpdateViolationStatus } from "@/hooks/useViolations";
import type { ViolationType, ViolationStatus } from "@/types/violation";

// ── Helpers ────────────────────────────────────────────────────────────────

function getTypeIcon(type: ViolationType): LucideIcon {
  switch (type) {
    case "speeding":
      return Gauge;
    case "parking":
      return ParkingSquare;
    case "redlight":
      return CircleAlert;
    case "other":
      return AlertTriangle;
  }
}

function getTypeLabel(type: ViolationType): string {
  switch (type) {
    case "speeding":
      return "Excès de vitesse";
    case "parking":
      return "Stationnement";
    case "redlight":
      return "Feu rouge";
    case "other":
      return "Autre";
  }
}

function statusBadgeVariant(
  status: ViolationStatus,
): "neutral" | "info" | "warning" | "success" | "danger" {
  const map: Record<
    ViolationStatus,
    "neutral" | "info" | "warning" | "success" | "danger"
  > = {
    received: "neutral",
    "client-identified": "info",
    forwarded: "warning",
    paid: "success",
    disputed: "danger",
  };
  return map[status];
}

function statusLabel(status: ViolationStatus): string {
  const map: Record<ViolationStatus, string> = {
    received: "Reçue",
    "client-identified": "Client identifié",
    forwarded: "Transmise",
    paid: "Payée",
    disputed: "Contestée",
  };
  return map[status];
}

// ── Timeline Step ──────────────────────────────────────────────────────────

interface TimelineStepProps {
  label: string;
  date?: string;
  state: "completed" | "active" | "pending";
  isLast?: boolean;
}

function TimelineStep({
  label,
  date,
  state,
  isLast = false,
}: TimelineStepProps) {
  const theme = useTheme();

  const dotColor =
    state === "completed"
      ? theme.success
      : state === "active"
        ? theme.accent
        : theme.border;

  const lineColor = state === "completed" ? theme.success : theme.border;

  const textColor =
    state === "pending" ? theme.textTertiary : theme.textPrimary;

  return (
    <View className="flex-row">
      {/* Dot + Line */}
      <View className="items-center mr-3" style={{ width: 20 }}>
        <View
          style={{
            width: state === "active" ? 14 : 10,
            height: state === "active" ? 14 : 10,
            borderRadius: 7,
            backgroundColor: dotColor,
          }}
        />
        {!isLast && (
          <View
            style={{
              width: 2,
              flex: 1,
              backgroundColor: lineColor,
              marginVertical: 4,
            }}
          />
        )}
      </View>

      {/* Label + Date */}
      <View className="flex-1 pb-5">
        <Text variant="bodyMedium" color={textColor}>
          {label}
        </Text>
        {date != null && (
          <Text
            variant="bodySmall"
            color={theme.textTertiary}
            className="mt-0.5"
          >
            {formatDate(date, "long")}
          </Text>
        )}
        {state === "active" && (
          <Badge variant="accent" size="sm" className="mt-1">
            En cours
          </Badge>
        )}
      </View>
    </View>
  );
}

// ── Timeline ───────────────────────────────────────────────────────────────

const TIMELINE_STEPS: {
  key: string;
  label: string;
  afterStatus: ViolationStatus[];
}[] = [
  {
    key: "received",
    label: "Reçue",
    afterStatus: [
      "received",
      "client-identified",
      "forwarded",
      "paid",
      "disputed",
    ],
  },
  {
    key: "client-identified",
    label: "Client identifié",
    afterStatus: ["client-identified", "forwarded", "paid", "disputed"],
  },
  {
    key: "forwarded",
    label: "Transmise au client",
    afterStatus: ["forwarded", "paid", "disputed"],
  },
  {
    key: "paid-requested",
    label: "Paiement demandé",
    afterStatus: ["paid"],
  },
  {
    key: "resolved",
    label: "Résolue",
    afterStatus: ["paid"],
  },
];

function getStepState(
  stepAfterStatus: ViolationStatus[],
  currentStatus: ViolationStatus,
  stepIndex: number,
  activeIndex: number,
): "completed" | "active" | "pending" {
  if (stepIndex < activeIndex) return "completed";
  if (stepIndex === activeIndex) return "active";
  return "pending";
}

function getActiveIndex(status: ViolationStatus): number {
  switch (status) {
    case "received":
      return 0;
    case "client-identified":
      return 1;
    case "forwarded":
      return 2;
    case "paid":
      return 4;
    case "disputed":
      return 2;
  }
}

// ── Main Screen ────────────────────────────────────────────────────────────

export default function ViolationDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const showToast = useToastStore((s) => s.show);

  const { data: violation, isLoading } = useViolation(id ?? "");
  const updateMutation = useUpdateViolationStatus();
  const updateViolationStatus = (vid: string, status: ViolationStatus) =>
    updateMutation.mutate({ id: vid, status });

  const [charging, setCharging] = useState(false);

  if (!violation) {
    return (
      <ScreenWrapper scroll>
        <View className="flex-1 items-center justify-center py-20">
          <EmptyState
            icon={ShieldAlert}
            title={t("violations.notFound", "Infraction introuvable")}
            subtitle={t(
              "violations.notFoundDesc",
              "L'infraction que vous recherchez n'existe pas.",
            )}
            actionLabel={t("common.back", "Retour")}
            onAction={() => router.back()}
          />
        </View>
      </ScreenWrapper>
    );
  }

  const TypeIcon = getTypeIcon(violation.type);
  const activeIndex = getActiveIndex(violation.status);

  // ── Action Handlers ──────────────────────────────────────────────────────

  const handleIdentifyClient = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateViolationStatus(violation.id, "client-identified");
    showToast({
      variant: "info",
      title: "Client identifié",
      message: "Le client responsable a été identifié automatiquement.",
    });
  };

  const handleForward = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateViolationStatus(violation.id, "forwarded");
    showToast({
      variant: "success",
      title: "Infraction transmise",
      message: "L'infraction a été transmise au client.",
    });
  };

  const handleCharge = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCharging(true);
    setTimeout(() => {
      setCharging(false);
      updateViolationStatus(violation.id, "paid");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast({
        variant: "success",
        title: "Client notifi\u00E9 puis d\u00E9bit\u00E9",
        message: `${formatCurrency(violation.totalCharge)} d\u00E9bit\u00E9 apr\u00E8s transmission de l'infraction.`,
      });
    }, 2000);
  };

  const handleMarkPaid = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateViolationStatus(violation.id, "paid");
    showToast({
      variant: "success",
      title: "Marqué payé",
      message: "Le paiement en espèces a été enregistré.",
    });
  };

  const handleDownload = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showToast({
      variant: "info",
      title: "Téléchargement",
      message: "Le reçu sera disponible prochainement.",
    });
  };

  const handleProvideEvidence = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showToast({
      variant: "info",
      title: "Preuves",
      message: "L'envoi de preuves sera disponible prochainement.",
    });
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <ScreenWrapper scroll>
      {/* ── Header ──────────────────────────────────────────────── */}
      <Animated.View
        entering={FadeInDown.duration(400)}
        className="flex-row items-center pt-4 pb-2"
      >
        <Pressable onPress={() => router.back()} className="mr-3 p-1">
          <ChevronLeft size={24} color={theme.textPrimary} />
        </Pressable>
        <View className="flex-1">
          <Text variant="headlineLarge">
            {t("violations.detail.title", "Détail infraction")}
          </Text>
          <Text variant="bodySmall" color={theme.textTertiary}>
            {violation.reference}
          </Text>
        </View>
      </Animated.View>

      {/* ── Disputed Banner ─────────────────────────────────────── */}
      {violation.status === "disputed" && (
        <Animated.View
          entering={FadeInDown.duration(400).delay(40)}
          className="flex-row items-center p-3 rounded-xl mt-2"
          style={{ backgroundColor: theme.dangerSoft }}
        >
          <FileWarning size={18} color={theme.danger} />
          <Text
            variant="bodySmall"
            color={theme.danger}
            className="ml-2 flex-1"
          >
            Cette infraction est contestée par le client. Preuves requises.
          </Text>
        </Animated.View>
      )}

      {/* ── Violation Info Card ──────────────────────────────────── */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(80)}
        className="mt-4"
      >
        <Card>
          <View className="flex-row items-center">
            <View
              className="w-12 h-12 rounded-xl items-center justify-center mr-4"
              style={{ backgroundColor: theme.surfaceTertiary }}
            >
              <TypeIcon size={24} color={theme.accent} />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center justify-between">
                <Text variant="titleMedium">
                  {getTypeLabel(violation.type)}
                </Text>
                <Badge variant={statusBadgeVariant(violation.status)} size="sm">
                  {statusLabel(violation.status)}
                </Badge>
              </View>
              <Text
                variant="bodySmall"
                color={theme.textSecondary}
                className="mt-1"
              >
                {formatDate(violation.date, "long")}
              </Text>
              {violation.location.length > 0 && (
                <View className="flex-row items-center mt-1">
                  <MapPin size={12} color={theme.textTertiary} />
                  <Text
                    variant="bodySmall"
                    color={theme.textTertiary}
                    className="ml-1"
                    numberOfLines={1}
                  >
                    {violation.location}
                  </Text>
                </View>
              )}
              <Text
                variant="bodySmall"
                color={theme.textTertiary}
                className="mt-1"
              >
                Réf: {violation.reference}
              </Text>
            </View>
          </View>
        </Card>
      </Animated.View>

      {/* ── Vehicle Card ─────────────────────────────────────────── */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(160)}
        className="mt-4"
      >
        <Text variant="headlineSmall" className="mb-3">
          Véhicule
        </Text>
        <Card>
          <View className="flex-row items-center">
            <View
              className="w-10 h-10 rounded-full items-center justify-center"
              style={{ backgroundColor: theme.surfaceTertiary }}
            >
              <Car size={20} color={theme.accent} />
            </View>
            <View className="ml-3 flex-1">
              <Text variant="titleSmall">{violation.vehicleName}</Text>
              <Text variant="bodySmall" color={theme.textSecondary}>
                {violation.licensePlate}
              </Text>
            </View>
          </View>
        </Card>
      </Animated.View>

      {/* ── Client Card ──────────────────────────────────────────── */}
      {violation.clientName != null && (
        <Animated.View
          entering={FadeInDown.duration(400).delay(240)}
          className="mt-4"
        >
          <Text variant="headlineSmall" className="mb-3">
            Client
          </Text>
          <Card>
            <View className="flex-row items-center">
              <View
                className="w-10 h-10 rounded-full items-center justify-center"
                style={{ backgroundColor: theme.surfaceTertiary }}
              >
                <User size={20} color={theme.accent} />
              </View>
              <View className="ml-3 flex-1">
                <Text variant="titleSmall">{violation.clientName}</Text>
                {violation.bookingId != null && (
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push(`/(app)/(bookings)/${violation.bookingId}`);
                    }}
                    className="flex-row items-center mt-1"
                  >
                    <ExternalLink size={12} color={theme.accent} />
                    <Text
                      variant="bodySmall"
                      color={theme.accent}
                      className="ml-1"
                    >
                      Voir la réservation
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          </Card>
        </Animated.View>
      )}

      {/* ── Charges Card ─────────────────────────────────────────── */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(320)}
        className="mt-4"
      >
        <Text variant="headlineSmall" className="mb-3">
          Charges
        </Text>
        <Card>
          <View className="flex-row justify-between py-1.5">
            <Text variant="bodyMedium" color={theme.textSecondary}>
              Amende
            </Text>
            <Text variant="bodyMedium">
              {formatCurrency(violation.fineAmount)}
            </Text>
          </View>
          <View className="flex-row justify-between py-1.5">
            <Text variant="bodyMedium" color={theme.textSecondary}>
              Frais administratifs
            </Text>
            <Text variant="bodyMedium">
              {formatCurrency(violation.adminFee)}
            </Text>
          </View>

          <Divider className="my-3" />

          <View className="flex-row justify-between py-1">
            <Text variant="titleMedium">Total</Text>
            <Text variant="headlineMedium" color={theme.accent}>
              {formatCurrency(violation.totalCharge)}
            </Text>
          </View>
        </Card>
      </Animated.View>

      {/* ── Timeline ─────────────────────────────────────────────── */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(400)}
        className="mt-4"
      >
        <Text variant="headlineSmall" className="mb-3">
          Chronologie
        </Text>
        <Card>
          {TIMELINE_STEPS.map((step, index) => {
            const stepState = getStepState(
              step.afterStatus,
              violation.status,
              index,
              activeIndex,
            );

            let stepDate: string | undefined;
            if (index === 0 && stepState !== "pending") {
              stepDate = violation.receivedDate;
            }

            return (
              <TimelineStep
                key={step.key}
                label={step.label}
                date={stepDate}
                state={stepState}
                isLast={index === TIMELINE_STEPS.length - 1}
              />
            );
          })}
        </Card>
      </Animated.View>

      {/* ── Actions ──────────────────────────────────────────────── */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(480)}
        className="mt-6 mb-8"
      >
        <ActionButtons
          status={violation.status}
          charging={charging}
          onIdentify={handleIdentifyClient}
          onForward={handleForward}
          onCharge={handleCharge}
          onMarkPaid={handleMarkPaid}
          onDownload={handleDownload}
          onProvideEvidence={handleProvideEvidence}
        />
      </Animated.View>
    </ScreenWrapper>
  );
}

// ── Action Buttons ─────────────────────────────────────────────────────────

interface ActionButtonsProps {
  status: ViolationStatus;
  charging: boolean;
  onIdentify: () => void;
  onForward: () => void;
  onCharge: () => void;
  onMarkPaid: () => void;
  onDownload: () => void;
  onProvideEvidence: () => void;
}

function ActionButtons({
  status,
  charging,
  onIdentify,
  onForward,
  onCharge,
  onMarkPaid,
  onDownload,
  onProvideEvidence,
}: ActionButtonsProps) {
  switch (status) {
    case "received":
      return (
        <View className="gap-3">
          <Button
            variant="primary"
            fullWidth
            leftIcon={Search}
            onPress={onIdentify}
          >
            Identifier le client
          </Button>
        </View>
      );

    case "client-identified":
      return (
        <View className="gap-3">
          <Button
            variant="primary"
            fullWidth
            leftIcon={Send}
            onPress={onForward}
          >
            Transmettre au client
          </Button>
        </View>
      );

    case "forwarded":
      return (
        <View className="gap-3">
          <View className="flex-row items-start gap-3 rounded-2xl border border-warning-500/25 bg-warning-500/10 p-4">
            <Send size={18} color="#F59E0B" strokeWidth={2} />
            <View className="flex-1">
              <Text className="font-semibold text-text-primary">
                Client notifi{"\u00E9"}
              </Text>
              <Text className="mt-1 text-sm text-text-secondary">
                L&apos;infraction a déjà été transmise avant tout débit.
              </Text>
            </View>
          </View>
          <Button
            variant="primary"
            fullWidth
            leftIcon={CreditCard}
            loading={charging}
            onPress={onCharge}
          >
            D{"\u00E9"}biter apr{"\u00E8"}s notification
          </Button>
          <Button
            variant="secondary"
            fullWidth
            leftIcon={Banknote}
            onPress={onMarkPaid}
          >
            Marquer payé
          </Button>
        </View>
      );

    case "paid":
      return (
        <View className="gap-3">
          <Button
            variant="secondary"
            fullWidth
            leftIcon={Download}
            onPress={onDownload}
          >
            Télécharger le reçu
          </Button>
        </View>
      );

    case "disputed":
      return (
        <View className="gap-3">
          <Button
            variant="primary"
            fullWidth
            leftIcon={FileWarning}
            onPress={onProvideEvidence}
          >
            Fournir preuves
          </Button>
        </View>
      );

    default:
      return null;
  }
}
