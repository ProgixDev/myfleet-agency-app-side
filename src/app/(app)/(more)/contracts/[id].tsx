import React from 'react';
import { View, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
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
  Send,
  PenTool,
  XCircle,
  Share2,
  Download,
  ExternalLink,
  StickyNote,
} from 'lucide-react-native';

import { ScreenWrapper } from '@/components/ui/ScreenWrapper';
import { Text } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Divider } from '@/components/ui/Divider';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTheme } from '@/hooks/useTheme';
import { useToastStore } from '@/components/ui/Toast';
import { useContractStore } from '@/stores/useContractStore';
import type { Contract, ContractStatus, ContractClause } from '@/types/contract';

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatNumber(n: number): string {
  return n.toLocaleString('fr-FR');
}

function statusBadgeVariant(
  status: ContractStatus,
): 'neutral' | 'warning' | 'success' | 'info' | 'danger' {
  const map: Record<ContractStatus, 'neutral' | 'warning' | 'success' | 'info' | 'danger'> = {
    draft: 'neutral',
    'pending-signature': 'warning',
    active: 'success',
    expired: 'info',
    terminated: 'danger',
  };
  return map[status];
}

function statusLabel(status: ContractStatus): string {
  const map: Record<ContractStatus, string> = {
    draft: 'Brouillon',
    'pending-signature': 'En attente de signature',
    active: 'Actif',
    expired: 'Expiré',
    terminated: 'Résilié',
  };
  return map[status];
}

// ── Toast helper type ───────────────────────────────────────────────────────

type ShowToastFn = (toast: {
  variant: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}) => void;

// ── Main Screen ─────────────────────────────────────────────────────────────

export default function ContractDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const showToast = useToastStore((s) => s.show);

  const contracts = useContractStore((s) => s.contracts);
  const contract = contracts.find((c) => c.id === id);
  const signContract = useContractStore((s) => s.signContract);
  const updateStatus = useContractStore((s) => s.updateContractStatus);

  if (!contract) {
    return (
      <ScreenWrapper scroll>
        <View className="flex-1 items-center justify-center py-20">
          <EmptyState
            icon={FileText}
            title={t('contracts.notFound', 'Contrat introuvable')}
            subtitle={t(
              'contracts.notFoundDesc',
              'Le contrat que vous recherchez n\'existe pas.',
            )}
            actionLabel={t('common.back', 'Retour')}
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
            {t('contracts.detail.title', 'Contrat')}
          </Text>
          <Text variant="bodySmall" color={theme.textTertiary}>
            {contract.reference}
          </Text>
        </View>
      </Animated.View>

      {/* ── Status Card ─────────────────────────────────────────── */}
      <Animated.View entering={FadeInDown.duration(400).delay(80)} className="mt-4">
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
            {t('contracts.detail.createdAt', 'Créé le')} {formatDate(contract.createdAt)}
          </Text>
        </Card>
      </Animated.View>

      {/* ── Parties Section ─────────────────────────────────────── */}
      <Animated.View entering={FadeInDown.duration(400).delay(160)} className="mt-4">
        <Text variant="headlineSmall" className="mb-3">
          {t('contracts.detail.parties', 'Parties')}
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
              {t('contracts.detail.lessor', 'Loueur')}
            </Text>
          </View>
          <Text variant="titleSmall">{contract.lessor.name}</Text>
          <Text variant="bodySmall" color={theme.textSecondary} className="mt-1">
            {contract.lessor.address}
          </Text>
          <Text variant="bodySmall" color={theme.textSecondary} className="mt-1">
            {contract.lessor.phone}
          </Text>
          <Text variant="bodySmall" color={theme.textSecondary} className="mt-1">
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
              {t('contracts.detail.lessee', 'Locataire')}
            </Text>
          </View>
          <Text variant="titleSmall">{contract.lessee.name}</Text>
          <Text variant="bodySmall" color={theme.textSecondary} className="mt-1">
            {contract.lessee.address}
          </Text>
          <Text variant="bodySmall" color={theme.textSecondary} className="mt-1">
            {contract.lessee.phone}
          </Text>
          <Text variant="bodySmall" color={theme.textSecondary} className="mt-1">
            {contract.lessee.email}
          </Text>
          {contract.lessee.idNumber ? (
            <Text variant="bodySmall" color={theme.textSecondary} className="mt-1">
              {t('contracts.detail.idNumber', 'N° pièce')}: {contract.lessee.idNumber}
            </Text>
          ) : null}
        </Card>
      </Animated.View>

      {/* ── Vehicle Section ─────────────────────────────────────── */}
      <Animated.View entering={FadeInDown.duration(400).delay(240)} className="mt-4">
        <Text variant="headlineSmall" className="mb-3">
          {t('contracts.detail.vehicle', 'Véhicule')}
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
              <Text variant="bodySmall" color={theme.textSecondary} className="mt-1">
                {contract.vehicleInfo.year} &middot; {contract.vehicleInfo.licensePlate || t('contracts.detail.noPlate', 'N/A')}
              </Text>
            </View>
          </View>
          <Divider className="my-3" />
          <View className="flex-row justify-between mb-2">
            <Text variant="bodySmall" color={theme.textSecondary}>
              {t('contracts.detail.mileagePickup', 'Kilométrage départ')}
            </Text>
            <Text variant="bodySmall">
              {formatNumber(contract.vehicleInfo.mileageAtPickup)} km
            </Text>
          </View>
          <View className="flex-row justify-between">
            <Text variant="bodySmall" color={theme.textSecondary}>
              {t('contracts.detail.fuelLevel', 'Niveau carburant')}
            </Text>
            <Text variant="bodySmall">
              {contract.vehicleInfo.fuelLevelAtPickup}%
            </Text>
          </View>
        </Card>
      </Animated.View>

      {/* ── Rental Terms ────────────────────────────────────────── */}
      <Animated.View entering={FadeInDown.duration(400).delay(320)} className="mt-4">
        <Text variant="headlineSmall" className="mb-3">
          {t('contracts.detail.rentalTerms', 'Conditions de location')}
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
              {t('contracts.detail.dailyRate', 'Tarif journalier')}
            </Text>
            <Text variant="bodySmall">
              {'\u20AC'}{formatNumber(contract.dailyRate)}/jour
            </Text>
          </View>

          {/* Total */}
          <View className="flex-row justify-between mb-2">
            <Text variant="bodySmall" color={theme.textSecondary}>
              {t('contracts.detail.total', 'Total')}
            </Text>
            <Text variant="titleSmall" color={theme.accent}>
              {'\u20AC'}{formatNumber(contract.totalAmount)}
            </Text>
          </View>

          {/* Deposit */}
          <View className="flex-row justify-between mb-2">
            <Text variant="bodySmall" color={theme.textSecondary}>
              {t('contracts.detail.deposit', 'Caution')}
            </Text>
            <Text variant="bodySmall">
              {'\u20AC'}{formatNumber(contract.deposit)}
            </Text>
          </View>

          <Divider className="my-3" />

          {/* Locations */}
          <View className="flex-row items-start mb-2">
            <MapPin size={14} color={theme.textSecondary} />
            <View className="ml-2 flex-1">
              <Text variant="bodySmall" color={theme.textTertiary}>
                {t('contracts.detail.pickup', 'Lieu de prise en charge')}
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
                {t('contracts.detail.returnLocation', 'Lieu de restitution')}
              </Text>
              <Text variant="bodySmall" className="mt-1">
                {contract.returnLocation}
              </Text>
            </View>
          </View>
        </Card>
      </Animated.View>

      {/* ── Contract Clauses ────────────────────────────────────── */}
      <Animated.View entering={FadeInDown.duration(400).delay(400)} className="mt-4">
        <Text variant="headlineSmall" className="mb-3">
          {t('contracts.detail.generalConditions', 'Conditions générales')}
        </Text>
        <Card>
          {contract.clauses.map((clause: ContractClause, index: number) => (
            <View key={clause.id} className={index > 0 ? 'mt-4' : ''}>
              <Text variant="titleSmall">
                Article {index + 1}: {clause.title}
              </Text>
              <Text variant="bodySmall" color={theme.textSecondary} className="mt-1">
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
      <Animated.View entering={FadeInDown.duration(400).delay(480)} className="mt-4">
        <Text variant="headlineSmall" className="mb-3">
          {t('contracts.detail.signatures', 'Signatures')}
        </Text>
        <View className="flex-row gap-3">
          {/* Client Signature */}
          <View className="flex-1">
            <View
              style={{ backgroundColor: theme.surface, height: 96 }}
              className="rounded-xl p-4 items-center justify-center"
            >
              {contract.clientSignature ? (
                <>
                  <CheckCircle size={24} color={theme.success} />
                  <Text variant="bodySmall" color={theme.success} className="mt-2" align="center">
                    {t('contracts.detail.signedBy', 'Signé par')}
                  </Text>
                  <Text variant="bodySmall" align="center" numberOfLines={1}>
                    {contract.clientSignature.signerName}
                  </Text>
                </>
              ) : (
                <>
                  <Clock size={24} color={theme.warning} />
                  <Text variant="bodySmall" color={theme.warning} className="mt-2" align="center">
                    {t('contracts.detail.clientLabel', 'Client')}
                  </Text>
                  <Text variant="bodySmall" color={theme.textTertiary} align="center">
                    {t('contracts.detail.awaitingSignature', 'En attente')}
                  </Text>
                </>
              )}
            </View>
          </View>

          {/* Agent Signature */}
          <View className="flex-1">
            <View
              style={{ backgroundColor: theme.surface, height: 96 }}
              className="rounded-xl p-4 items-center justify-center"
            >
              {contract.agentSignature ? (
                <>
                  <CheckCircle size={24} color={theme.success} />
                  <Text variant="bodySmall" color={theme.success} className="mt-2" align="center">
                    {t('contracts.detail.signedBy', 'Signé par')}
                  </Text>
                  <Text variant="bodySmall" align="center" numberOfLines={1}>
                    {contract.agentSignature.signerName}
                  </Text>
                </>
              ) : (
                <>
                  <Clock size={24} color={theme.warning} />
                  <Text variant="bodySmall" color={theme.warning} className="mt-2" align="center">
                    {t('contracts.detail.agentLabel', 'Agent')}
                  </Text>
                  <Text variant="bodySmall" color={theme.textTertiary} align="center">
                    {t('contracts.detail.awaitingSignature', 'En attente')}
                  </Text>
                </>
              )}
            </View>
          </View>
        </View>
      </Animated.View>

      {/* ── Action Buttons ──────────────────────────────────────── */}
      <Animated.View entering={FadeInDown.duration(400).delay(560)} className="mt-6">
        <ActionButtons
          contract={contract}
          theme={theme}
          router={router}
          showToast={showToast}
          signContract={signContract}
          updateStatus={updateStatus}
          t={t}
        />
      </Animated.View>

      {/* ── View Booking Link ───────────────────────────────────── */}
      {contract.bookingId ? (
        <Animated.View entering={FadeInDown.duration(400).delay(600)} className="mt-4">
          <Button
            variant="ghost"
            fullWidth
            leftIcon={ExternalLink}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push(`/(app)/(bookings)/${contract.bookingId}`);
            }}
          >
            {t('contracts.detail.viewBooking', 'Voir la réservation')}
          </Button>
        </Animated.View>
      ) : null}

      {/* ── Notes ───────────────────────────────────────────────── */}
      <Animated.View entering={FadeInDown.duration(400).delay(640)} className="mt-4 mb-8">
        <Text variant="headlineSmall" className="mb-3">
          {t('contracts.detail.notes', 'Notes')}
        </Text>
        <Card>
          {contract.notes ? (
            <View className="flex-row items-start">
              <StickyNote size={16} color={theme.textSecondary} />
              <Text variant="bodyMedium" color={theme.textSecondary} className="ml-2 flex-1">
                {contract.notes}
              </Text>
            </View>
          ) : (
            <Text variant="bodyMedium" color={theme.textTertiary}>
              {t('contracts.detail.noNotes', 'Aucune note')}
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
  theme: ReturnType<typeof useTheme>;
  router: ReturnType<typeof useRouter>;
  showToast: ShowToastFn;
  signContract: (
    contractId: string,
    clientSig: { base64: string; signedAt: string; signerName: string },
    agentSig: { base64: string; signedAt: string; signerName: string },
  ) => void;
  updateStatus: (id: string, status: ContractStatus) => void;
  t: ReturnType<typeof useTranslation>['t'];
}

function ActionButtons({
  contract,
  theme,
  router,
  showToast,
  signContract,
  updateStatus,
  t,
}: ActionButtonsProps) {
  const now = new Date().toISOString();
  const showPdfReady = (mode: 'download' | 'share') => {
    showToast({
      variant: 'success',
      title:
        mode === 'download'
          ? t('contracts.detail.pdfReady', 'PDF prêt')
          : t('contracts.detail.pdfShared', 'Partage préparé'),
      message:
        mode === 'download'
          ? t(
              'contracts.detail.pdfReadyMsg',
              'Le contrat PDF est prêt à être téléchargé.',
            )
          : t(
              'contracts.detail.pdfSharedMsg',
              'Le contrat PDF peut être envoyé au client ou partagé hors app.',
            ),
    });
  };

  switch (contract.status) {
    case 'draft':
      return (
        <View className="gap-3">
          <Button
            variant="primary"
            fullWidth
            leftIcon={Send}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              updateStatus(contract.id, 'pending-signature');
              showToast({
                variant: 'success',
                title: t('contracts.detail.sentForSignature', 'Envoyé pour signature'),
                message: t(
                  'contracts.detail.sentForSignatureMsg',
                  'Le contrat a été envoyé pour signature.',
                ),
              });
            }}
          >
            {t('contracts.detail.sendForSignature', 'Envoyer pour signature')}
          </Button>
        </View>
      );

    case 'pending-signature':
      return (
        <View className="gap-3">
          <Button
            variant="primary"
            fullWidth
            leftIcon={PenTool}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              signContract(
                contract.id,
                {
                  base64: 'mock-client-signature-base64',
                  signedAt: now,
                  signerName: contract.lessee.name,
                },
                {
                  base64: 'mock-agent-signature-base64',
                  signedAt: now,
                  signerName: contract.lessor.name,
                },
              );
              showToast({
                variant: 'success',
                title: t('contracts.detail.signed', 'Contrat signé'),
                message: t(
                  'contracts.detail.signedMsg',
                  'Le contrat a été signé avec succès.',
                ),
              });
            }}
          >
            {t('contracts.detail.signContract', 'Signer le contrat')}
          </Button>
          <Button
            variant="ghost"
            fullWidth
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              updateStatus(contract.id, 'draft');
              showToast({
                variant: 'info',
                title: t('contracts.detail.cancelledSignature', 'Signature annulée'),
                message: t(
                  'contracts.detail.cancelledSignatureMsg',
                  'Le contrat est revenu en brouillon.',
                ),
              });
            }}
          >
            {t('contracts.detail.cancel', 'Annuler')}
          </Button>
        </View>
      );

    case 'active':
      return (
        <View className="gap-3">
          <Button
            variant="danger"
            fullWidth
            leftIcon={XCircle}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              updateStatus(contract.id, 'terminated');
              showToast({
                variant: 'warning',
                title: t('contracts.detail.terminated', 'Contrat résilié'),
                message: t(
                  'contracts.detail.terminatedMsg',
                  'Le contrat a été résilié.',
                ),
              });
            }}
          >
            {t('contracts.detail.terminateContract', 'Résilier le contrat')}
          </Button>
          <Button
            variant="secondary"
            fullWidth
            leftIcon={Share2}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              showPdfReady('share');
            }}
          >
            {t('contracts.detail.share', 'Partager')}
          </Button>
          <Button
            variant="secondary"
            fullWidth
            leftIcon={Download}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              showPdfReady('download');
            }}
          >
            {t('contracts.detail.downloadPdf', 'Télécharger PDF')}
          </Button>
        </View>
      );

    case 'expired':
      return (
        <View className="gap-3">
          <Button
            variant="secondary"
            fullWidth
            leftIcon={Download}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              showPdfReady('download');
            }}
          >
            {t('contracts.detail.downloadPdf', 'Télécharger PDF')}
          </Button>
        </View>
      );

    case 'terminated':
      return (
        <View className="gap-3">
          <Button
            variant="secondary"
            fullWidth
            leftIcon={Download}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              showPdfReady('download');
            }}
          >
            {t('contracts.detail.downloadPdf', 'Télécharger PDF')}
          </Button>
        </View>
      );

    default:
      return null;
  }
}
