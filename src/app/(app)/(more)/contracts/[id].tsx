import React from "react";
import { View, Pressable, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SvgUri } from "react-native-svg";
import * as Haptics from "expo-haptics";
import {
  ChevronLeft,
  FileText,
  User,
  Building2,
  Car,
  CalendarRange,
  MapPin,
  CheckCircle,
  Clock,
  Eye,
  RefreshCw,
  StickyNote,
} from "lucide-react-native";

import { ScreenWrapper } from "@/components/ui/ScreenWrapper";
import { Text } from "@/components/ui/Text";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Divider } from "@/components/ui/Divider";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTheme } from "@/hooks/useTheme";
import { useToastStore } from "@/components/ui/Toast";
import {
  useContract,
  useContractPdfUrl,
  useContractSignatureUrl,
  useRegenerateContract,
} from "@/hooks/useContracts";
import type { ContractSignatureRole } from "@/services/contractService";
import { useAuthStore } from "@/stores/useAuthStore";
import { formatCurrency } from "@/utils/format";
import type {
  Contract,
  ContractStatus,
  ContractClause,
  SignatureData,
} from "@/types/contract";

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatNumber(n: number): string {
  return n.toLocaleString("fr-FR");
}

function statusBadgeVariant(
  status: ContractStatus,
): "neutral" | "warning" | "success" | "info" | "danger" {
  const map: Record<
    ContractStatus,
    "neutral" | "warning" | "success" | "info" | "danger"
  > = {
    draft: "neutral",
    "pending-signature": "warning",
    active: "success",
    expired: "info",
    terminated: "danger",
  };
  return map[status];
}

function statusLabel(status: ContractStatus): string {
  const map: Record<ContractStatus, string> = {
    draft: "Brouillon",
    "pending-signature": "En attente de signature",
    active: "Actif",
    expired: "Expiré",
    terminated: "Résilié",
  };
  return map[status];
}

// ── Toast helper type ───────────────────────────────────────────────────────

type ShowToastFn = (toast: {
  variant: "success" | "error" | "warning" | "info";
  title: string;
  message?: string;
  duration?: number;
}) => void;

// ── Loading Skeleton ────────────────────────────────────────────────────────

function ContractDetailSkeleton() {
  const theme = useTheme();
  return (
    <ScreenWrapper scroll>
      {/* Header */}
      <View className="flex-row items-center pt-4 pb-2">
        <View className="mr-3 p-1">
          <ChevronLeft size={24} color={theme.textPrimary} />
        </View>
        <View className="flex-1">
          <Skeleton height={28} width={"40%"} />
          <Skeleton height={12} width={"30%"} style={{ marginTop: 8 }} />
        </View>
      </View>

      {/* Status card */}
      <View className="mt-4">
        <View
          className="rounded-2xl p-4"
          style={{ backgroundColor: theme.surface }}
        >
          <Skeleton height={28} width={120} radius={14} />
          <Skeleton height={22} width={"55%"} style={{ marginTop: 12 }} />
          <Skeleton height={12} width={"35%"} style={{ marginTop: 6 }} />
        </View>
      </View>

      {/* Parties */}
      <View className="mt-6">
        <Skeleton height={20} width={"30%"} />
        {[0, 1].map((i) => (
          <View
            key={i}
            className="rounded-2xl p-4 mt-3"
            style={{ backgroundColor: theme.surface }}
          >
            <View className="flex-row items-center mb-3">
              <Skeleton width={40} height={40} radius={20} />
              <Skeleton height={16} width={"35%"} style={{ marginLeft: 12 }} />
            </View>
            <Skeleton height={14} width={"60%"} />
            <Skeleton height={12} width={"75%"} style={{ marginTop: 6 }} />
            <Skeleton height={12} width={"50%"} style={{ marginTop: 6 }} />
          </View>
        ))}
      </View>

      {/* Vehicle */}
      <View className="mt-6">
        <Skeleton height={20} width={"25%"} />
        <View
          className="rounded-2xl p-4 mt-3"
          style={{ backgroundColor: theme.surface }}
        >
          <View className="flex-row items-center">
            <Skeleton width={60} height={60} radius={12} />
            <View className="ml-4 flex-1">
              <Skeleton height={20} width={"60%"} />
              <Skeleton height={12} width={"40%"} style={{ marginTop: 8 }} />
            </View>
          </View>
        </View>
      </View>

      {/* Terms */}
      <View className="mt-6">
        <Skeleton height={20} width={"40%"} />
        <View
          className="rounded-2xl p-4 mt-3"
          style={{ backgroundColor: theme.surface }}
        >
          <Skeleton height={14} width={"70%"} />
          <Skeleton height={12} width={"50%"} style={{ marginTop: 10 }} />
          <Skeleton height={12} width={"55%"} style={{ marginTop: 6 }} />
          <Skeleton height={12} width={"45%"} style={{ marginTop: 6 }} />
        </View>
      </View>
    </ScreenWrapper>
  );
}

// ── Signature Card ──────────────────────────────────────────────────────────

interface SignatureCardProps {
  contractId: string;
  role: ContractSignatureRole;
  signature: SignatureData | null;
  /** Party label shown while awaiting signature (e.g. "Client" / "Agent"). */
  pendingLabel: string;
  testID: string;
}

const SIGNATURE_WIDTH = 120;
const SIGNATURE_HEIGHT = 70;

function SignatureCard({
  contractId,
  role,
  signature,
  pendingLabel,
  testID,
}: SignatureCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  // Only fetch the signed-URL once the party has actually signed.
  const { data: signatureData } = useContractSignatureUrl(
    signature ? contractId : undefined,
    role,
  );
  const signatureUrl = signatureData?.url ?? null;

  return (
    <View className="flex-1" testID={testID}>
      <View
        style={{ backgroundColor: theme.surface, minHeight: 96 }}
        className="rounded-xl p-4 items-center justify-center"
      >
        {signature ? (
          <>
            {signatureUrl ? (
              <View
                style={{
                  width: SIGNATURE_WIDTH,
                  height: SIGNATURE_HEIGHT,
                  backgroundColor: theme.surfaceTertiary,
                }}
                className="rounded-md items-center justify-center overflow-hidden mb-2"
                testID={`${testID}-image`}
              >
                <SvgUri
                  uri={signatureUrl}
                  width={SIGNATURE_WIDTH}
                  height={SIGNATURE_HEIGHT}
                />
              </View>
            ) : (
              <CheckCircle size={24} color={theme.success} />
            )}
            <Text
              variant="bodySmall"
              color={theme.success}
              className="mt-2"
              align="center"
            >
              {t("contracts.detail.signedBy", "Signé par")}
            </Text>
            <Text variant="bodySmall" align="center" numberOfLines={1}>
              {signature.signerName}
            </Text>
          </>
        ) : (
          <>
            <Clock size={24} color={theme.warning} />
            <Text
              variant="bodySmall"
              color={theme.warning}
              className="mt-2"
              align="center"
            >
              {pendingLabel}
            </Text>
            <Text variant="bodySmall" color={theme.textTertiary} align="center">
              {t("contracts.detail.awaitingSignature", "En attente")}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

// ── Main Screen ─────────────────────────────────────────────────────────────

export default function ContractDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const showToast = useToastStore((s) => s.show);

  const { data: contract, isLoading } = useContract(id);
  const { data: pdfData } = useContractPdfUrl(contract?.id);
  const pdfUrl = pdfData?.url ?? null;

  if (isLoading && !contract) {
    return <ContractDetailSkeleton />;
  }

  if (!contract) {
    return (
      <ScreenWrapper scroll>
        <View className="flex-1 items-center justify-center py-20">
          <EmptyState
            icon={FileText}
            title={t("contracts.notFound", "Contrat introuvable")}
            subtitle={t(
              "contracts.notFoundDesc",
              "Le contrat que vous recherchez n'existe pas.",
            )}
            actionLabel={t("common.back", "Retour")}
            onAction={() => router.back()}
          />
        </View>
      </ScreenWrapper>
    );
  }

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
            {t("contracts.detail.title", "Contrat")}
          </Text>
          <Text variant="bodySmall" color={theme.textTertiary}>
            {contract.reference}
          </Text>
        </View>
      </Animated.View>

      {/* ── Status Card ─────────────────────────────────────────── */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(80)}
        className="mt-4"
      >
        <Card>
          <View className="flex-row items-center justify-between">
            <Badge variant={statusBadgeVariant(contract.status)} size="lg">
              {statusLabel(contract.status)}
            </Badge>
          </View>
          <Text variant="headlineMedium" className="mt-3">
            {contract.reference}
          </Text>
          <Text variant="bodySmall" color={theme.textTertiary} className="mt-1">
            {t("contracts.detail.createdAt", "Créé le")}{" "}
            {formatDate(contract.createdAt)}
          </Text>
        </Card>
      </Animated.View>

      {/* ── Parties Section ─────────────────────────────────────── */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(160)}
        className="mt-4"
      >
        <Text variant="headlineSmall" className="mb-3">
          {t("contracts.detail.parties", "Parties")}
        </Text>

        {/* Lessor */}
        <Card className="mb-3">
          <View className="flex-row items-center mb-3">
            <View
              style={{ backgroundColor: theme.surfaceTertiary }}
              className="w-10 h-10 rounded-full items-center justify-center"
            >
              <Building2 size={20} color={theme.accent} />
            </View>
            <Text variant="titleMedium" className="ml-3">
              {t("contracts.detail.lessor", "Loueur")}
            </Text>
          </View>
          <Text variant="titleSmall">{contract.lessor.name}</Text>
          <Text
            variant="bodySmall"
            color={theme.textSecondary}
            className="mt-1"
          >
            {contract.lessor.address}
          </Text>
          <Text
            variant="bodySmall"
            color={theme.textSecondary}
            className="mt-1"
          >
            {contract.lessor.phone}
          </Text>
          <Text
            variant="bodySmall"
            color={theme.textSecondary}
            className="mt-1"
          >
            {contract.lessor.email}
          </Text>
        </Card>

        {/* Lessee */}
        <Card>
          <View className="flex-row items-center mb-3">
            <View
              style={{ backgroundColor: theme.surfaceTertiary }}
              className="w-10 h-10 rounded-full items-center justify-center"
            >
              <User size={20} color={theme.accent} />
            </View>
            <Text variant="titleMedium" className="ml-3">
              {t("contracts.detail.lessee", "Locataire")}
            </Text>
          </View>
          <Text variant="titleSmall">{contract.lessee.name}</Text>
          <Text
            variant="bodySmall"
            color={theme.textSecondary}
            className="mt-1"
          >
            {contract.lessee.address}
          </Text>
          <Text
            variant="bodySmall"
            color={theme.textSecondary}
            className="mt-1"
          >
            {contract.lessee.phone}
          </Text>
          <Text
            variant="bodySmall"
            color={theme.textSecondary}
            className="mt-1"
          >
            {contract.lessee.email}
          </Text>
          {contract.lessee.idNumber ? (
            <Text
              variant="bodySmall"
              color={theme.textSecondary}
              className="mt-1"
            >
              {t("contracts.detail.idNumber", "N° pièce")}:{" "}
              {contract.lessee.idNumber}
            </Text>
          ) : null}
        </Card>
      </Animated.View>

      {/* ── Vehicle Section ─────────────────────────────────────── */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(240)}
        className="mt-4"
      >
        <Text variant="headlineSmall" className="mb-3">
          {t("contracts.detail.vehicle", "Véhicule")}
        </Text>
        <Card>
          <View className="flex-row items-center mb-3">
            <View
              style={{ backgroundColor: theme.surfaceTertiary }}
              className="w-[60px] h-[60px] rounded-xl items-center justify-center"
            >
              <Car size={28} color={theme.textTertiary} />
            </View>
            <View className="ml-4 flex-1">
              <Text variant="titleLarge">{contract.vehicleInfo.model}</Text>
              <Text
                variant="bodySmall"
                color={theme.textSecondary}
                className="mt-1"
              >
                {contract.vehicleInfo.year} &middot;{" "}
                {contract.vehicleInfo.licensePlate ||
                  t("contracts.detail.noPlate", "N/A")}
              </Text>
            </View>
          </View>
          <Divider className="my-3" />
          <View className="flex-row justify-between mb-2">
            <Text variant="bodySmall" color={theme.textSecondary}>
              {t("contracts.detail.mileagePickup", "Kilométrage départ")}
            </Text>
            <Text variant="bodySmall">
              {formatNumber(contract.vehicleInfo.mileageAtPickup)} km
            </Text>
          </View>
          <View className="flex-row justify-between">
            <Text variant="bodySmall" color={theme.textSecondary}>
              {t("contracts.detail.fuelLevel", "Niveau carburant")}
            </Text>
            <Text variant="bodySmall">
              {contract.vehicleInfo.fuelLevelAtPickup}%
            </Text>
          </View>
        </Card>
      </Animated.View>

      {/* ── Rental Terms ────────────────────────────────────────── */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(320)}
        className="mt-4"
      >
        <Text variant="headlineSmall" className="mb-3">
          {t("contracts.detail.rentalTerms", "Conditions de location")}
        </Text>
        <Card>
          {/* Dates */}
          <View className="flex-row items-center mb-3">
            <CalendarRange size={16} color={theme.textSecondary} />
            <Text variant="bodyMedium" className="ml-2">
              {formatDate(contract.startDate)} → {formatDate(contract.endDate)}
            </Text>
          </View>

          <Divider className="my-3" />

          {/* Daily rate */}
          <View className="flex-row justify-between mb-2">
            <Text variant="bodySmall" color={theme.textSecondary}>
              {t("contracts.detail.dailyRate", "Tarif journalier")}
            </Text>
            <Text variant="bodySmall">
              {formatCurrency(contract.dailyRate)}/jour
            </Text>
          </View>

          {/* Total */}
          <View className="flex-row justify-between mb-2">
            <Text variant="bodySmall" color={theme.textSecondary}>
              {t("contracts.detail.total", "Total")}
            </Text>
            <Text variant="titleSmall" color={theme.accent}>
              {formatCurrency(contract.totalAmount)}
            </Text>
          </View>

          {/* Deposit */}
          <View className="flex-row justify-between mb-2">
            <Text variant="bodySmall" color={theme.textSecondary}>
              {t("contracts.detail.deposit", "Caution")}
            </Text>
            <Text variant="bodySmall">{formatCurrency(contract.deposit)}</Text>
          </View>

          <Divider className="my-3" />

          {/* Locations */}
          <View className="flex-row items-start mb-2">
            <MapPin size={14} color={theme.textSecondary} />
            <View className="ml-2 flex-1">
              <Text variant="bodySmall" color={theme.textTertiary}>
                {t("contracts.detail.pickup", "Lieu de prise en charge")}
              </Text>
              <Text variant="bodySmall" className="mt-1">
                {contract.pickupLocation}
              </Text>
            </View>
          </View>
          <View className="flex-row items-start">
            <MapPin size={14} color={theme.textSecondary} />
            <View className="ml-2 flex-1">
              <Text variant="bodySmall" color={theme.textTertiary}>
                {t("contracts.detail.returnLocation", "Lieu de restitution")}
              </Text>
              <Text variant="bodySmall" className="mt-1">
                {contract.returnLocation}
              </Text>
            </View>
          </View>
        </Card>
      </Animated.View>

      {/* ── Contract Clauses ────────────────────────────────────── */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(400)}
        className="mt-4"
      >
        <Text variant="headlineSmall" className="mb-3">
          {t("contracts.detail.generalConditions", "Conditions générales")}
        </Text>
        <Card>
          {contract.clauses.map((clause: ContractClause, index: number) => (
            <View key={clause.id} className={index > 0 ? "mt-4" : ""}>
              <Text variant="titleSmall">
                Article {index + 1}: {clause.title}
              </Text>
              <Text
                variant="bodySmall"
                color={theme.textSecondary}
                className="mt-1"
              >
                {clause.content}
              </Text>
              {index < contract.clauses.length - 1 && (
                <Divider className="mt-4" />
              )}
            </View>
          ))}
        </Card>
      </Animated.View>

      {/* ── Signatures Section ──────────────────────────────────── */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(480)}
        className="mt-4"
      >
        <Text variant="headlineSmall" className="mb-3">
          {t("contracts.detail.signatures", "Signatures")}
        </Text>
        <View className="flex-row gap-3">
          {/* Client (lessee) Signature */}
          <SignatureCard
            contractId={contract.id}
            role="client"
            signature={contract.clientSignature}
            pendingLabel={t("contracts.detail.clientLabel", "Client")}
            testID="contract-signature-client"
          />

          {/* Agent (lessor) Signature */}
          <SignatureCard
            contractId={contract.id}
            role="agent"
            signature={contract.agentSignature}
            pendingLabel={t("contracts.detail.agentLabel", "Agent")}
            testID="contract-signature-agent"
          />
        </View>
      </Animated.View>

      {/* ── Action Buttons ──────────────────────────────────────── */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(560)}
        className="mt-6"
      >
        <ActionButtons
          contract={contract}
          pdfUrl={pdfUrl}
          showToast={showToast}
          t={t}
        />
      </Animated.View>

      {/* ── View Booking Link ───────────────────────────────────── */}
      {contract.bookingId ? (
        <Animated.View
          entering={FadeInDown.duration(400).delay(600)}
          className="mt-4"
        >
          <Button
            variant="ghost"
            fullWidth
            leftIcon={Eye}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push(`/(app)/(bookings)/${contract.bookingId}`);
            }}
          >
            {t("contracts.detail.viewBooking", "Voir la réservation")}
          </Button>
        </Animated.View>
      ) : null}

      {/* ── Notes ───────────────────────────────────────────────── */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(640)}
        className="mt-4 mb-8"
      >
        <Text variant="headlineSmall" className="mb-3">
          {t("contracts.detail.notes", "Notes")}
        </Text>
        <Card>
          {contract.notes ? (
            <View className="flex-row items-start">
              <StickyNote size={16} color={theme.textSecondary} />
              <Text
                variant="bodyMedium"
                color={theme.textSecondary}
                className="ml-2 flex-1"
              >
                {contract.notes}
              </Text>
            </View>
          ) : (
            <Text variant="bodyMedium" color={theme.textTertiary}>
              {t("contracts.detail.noNotes", "Aucune note")}
            </Text>
          )}
        </Card>
      </Animated.View>
    </ScreenWrapper>
  );
}

// ── Action Buttons Component ────────────────────────────────────────────────

interface ActionButtonsProps {
  contract: Contract;
  pdfUrl: string | null;
  showToast: ShowToastFn;
  t: ReturnType<typeof useTranslation>["t"];
}

function ActionButtons({ contract, pdfUrl, showToast, t }: ActionButtonsProps) {
  const router = useRouter();
  const isAdmin = useAuthStore((s) => s.user?.role) === "admin";
  const regenerate = useRegenerateContract();

  const viewPdf = () => {
    if (!pdfUrl) {
      showToast({
        variant: "info",
        title: t("contracts.detail.pdfPending", "PDF non disponible"),
        message: t(
          "contracts.detail.pdfPendingMsg",
          "Le PDF sera généré une fois le contrat signé par les deux parties.",
        ),
      });
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: "/(app)/pdf-viewer",
      params: {
        url: pdfUrl,
        title: t("contracts.detail.pdfTitle", {
          defaultValue: "Contract {{ref}}",
          ref: contract.reference,
        }),
        filename: `contract-${contract.reference}.pdf`,
      },
    });
  };

  const handleRegenerate = () => {
    Alert.alert(
      t("contracts.detail.regenerateTitle", {
        defaultValue: "Regenerate PDF?",
      }),
      t("contracts.detail.regenerateMessage", {
        defaultValue:
          "Re-render the contract PDF using the latest agency profile and signature data. The client will not be re-emailed.",
      }),
      [
        { text: t("common.cancel", "Cancel"), style: "cancel" },
        {
          text: t("contracts.detail.regenerate", {
            defaultValue: "Regenerate",
          }),
          style: "destructive",
          onPress: () => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            regenerate.mutate(contract.id, {
              onSuccess: () => {
                showToast({
                  variant: "success",
                  title: t("contracts.detail.regenerated", {
                    defaultValue: "Contract PDF regenerated",
                  }),
                });
              },
              onError: (err) => {
                showToast({
                  variant: "error",
                  title: t("contracts.detail.regenerateFailed", {
                    defaultValue: "Couldn't regenerate PDF",
                  }),
                  message: err instanceof Error ? err.message : undefined,
                });
              },
            });
          },
        },
      ],
    );
  };

  const isPendingClientSig =
    contract.status === "pending-signature" && !contract.clientSignature;

  return (
    <View className="gap-3">
      {isPendingClientSig && (
        <Text variant="bodySmall" align="center">
          {t(
            "contracts.detail.signedViaPickup",
            "La signature client est capturée pendant la prise en charge.",
          )}
        </Text>
      )}
      <Button
        variant="primary"
        fullWidth
        leftIcon={Eye}
        disabled={!pdfUrl}
        onPress={viewPdf}
      >
        {t("contracts.detail.viewPdf", { defaultValue: "View PDF" })}
      </Button>
      {isAdmin && (
        <Button
          variant="secondary"
          fullWidth
          leftIcon={RefreshCw}
          loading={regenerate.isPending}
          disabled={regenerate.isPending}
          onPress={handleRegenerate}
        >
          {t("contracts.detail.regeneratePdf", {
            defaultValue: "Regenerate PDF",
          })}
        </Button>
      )}
    </View>
  );
}
