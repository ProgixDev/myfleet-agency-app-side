import React, { useState, useCallback } from 'react';
import { View, Pressable, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  ChevronLeft,
  Receipt,
  CreditCard,
  Banknote,
  ArrowRightLeft,
  Bell,
  CheckCircle,
  Download,
  Send,
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
import { useBillingStore } from '@/stores/useBillingStore';
import type { Invoice, InvoiceStatus, PaymentMethod } from '@/types/billing';

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatEuro(amount: number): string {
  return (
    new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount) + ' \u20AC'
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getDaysOverdue(dueDate: string): number {
  const now = new Date();
  const due = new Date(dueDate);
  const diff = now.getTime() - due.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info';

function statusBadgeVariant(status: InvoiceStatus): BadgeVariant {
  const map: Record<InvoiceStatus, BadgeVariant> = {
    pending: 'warning',
    paid: 'success',
    overdue: 'danger',
    'partially-paid': 'info',
  };
  return map[status];
}

function statusLabel(status: InvoiceStatus): string {
  const map: Record<InvoiceStatus, string> = {
    pending: 'En attente',
    paid: 'Pay\u00E9e',
    overdue: 'En retard',
    'partially-paid': 'Partiellement pay\u00E9e',
  };
  return map[status];
}

function paymentMethodLabel(method: PaymentMethod): string {
  const map: Record<PaymentMethod, string> = {
    card: 'Carte',
    cash: 'Esp\u00E8ces',
    transfer: 'Virement',
  };
  return map[method];
}

function paymentMethodBadgeVariant(
  method: PaymentMethod,
): 'info' | 'success' | 'accent' {
  const map: Record<PaymentMethod, 'info' | 'success' | 'accent'> = {
    card: 'info',
    cash: 'success',
    transfer: 'accent',
  };
  return map[method];
}

// ── Main Screen ─────────────────────────────────────────────────────────────

export default function InvoiceDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const showToast = useToastStore((s) => s.show);

  const invoices = useBillingStore((s) => s.invoices);
  const recordPayment = useBillingStore((s) => s.recordPayment);
  const invoice = invoices.find((inv) => inv.id === id);

  // Payment simulation state
  const [showCardPayment, setShowCardPayment] = useState(false);
  const [showCashPayment, setShowCashPayment] = useState(false);
  const [cashAmount, setCashAmount] = useState('');
  const [cardLoading, setCardLoading] = useState(false);
  const [cardSuccess, setCardSuccess] = useState(false);

  const handleCardPayment = useCallback(() => {
    if (!invoice) return;
    setCardLoading(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setTimeout(() => {
      recordPayment(invoice.id, invoice.remainingBalance, 'card');
      setCardLoading(false);
      setCardSuccess(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setTimeout(() => {
        setShowCardPayment(false);
        setCardSuccess(false);
      }, 2000);
    }, 2000);
  }, [invoice, recordPayment]);

  const handleCashPayment = useCallback(() => {
    if (!invoice) return;
    const amount = parseFloat(cashAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0 || amount > invoice.remainingBalance) {
      showToast({
        variant: 'error',
        title: 'Montant invalide',
        message: `Entrez un montant entre 1 et ${formatEuro(invoice.remainingBalance)}`,
      });
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    recordPayment(invoice.id, amount, 'cash');
    setCashAmount('');
    setShowCashPayment(false);
    showToast({
      variant: 'success',
      title: 'Paiement enregistr\u00E9',
      message: `${formatEuro(amount)} re\u00E7u en esp\u00E8ces`,
    });
  }, [invoice, cashAmount, recordPayment, showToast]);

  const handleSendReminder = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showToast({
      variant: 'info',
      title: 'Rappel envoy\u00E9',
      message: `Un rappel de paiement a \u00E9t\u00E9 envoy\u00E9 au client.`,
    });
  }, [showToast]);

  const handleGenerateInvoicePdf = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showToast({
      variant: 'success',
      title: 'Facture PDF pr\u00EAte',
      message: 'La facture PDF est pr\u00EAte avec les informations du client.',
    });
  }, [showToast]);

  const handleSendInvoicePdf = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showToast({
      variant: 'success',
      title: 'Facture envoy\u00E9e',
      message: 'La facture PDF a \u00E9t\u00E9 envoy\u00E9e par email au client.',
    });
  }, [showToast]);

  // ── Not found ───────────────────────────────────────────────────────────

  if (!invoice) {
    return (
      <ScreenWrapper scroll>
        <View className="flex-1 items-center justify-center py-20">
          <EmptyState
            icon={Receipt}
            title={t('billing.notFound', 'Facture introuvable')}
            subtitle={t(
              'billing.notFoundDesc',
              "La facture que vous recherchez n'existe pas.",
            )}
            actionLabel={t('common.back', 'Retour')}
            onAction={() => router.back()}
          />
        </View>
      </ScreenWrapper>
    );
  }

  const daysOverdue =
    invoice.status === 'overdue' ? getDaysOverdue(invoice.dueDate) : 0;
  const isPendingOrOverdue =
    invoice.status === 'pending' ||
    invoice.status === 'overdue' ||
    invoice.status === 'partially-paid';

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
          <Text variant="headlineLarge">Facture</Text>
          <Text variant="bodySmall" color={theme.textTertiary}>
            {invoice.reference}
          </Text>
        </View>
      </Animated.View>

      {/* ── Overdue Banner ──────────────────────────────────────── */}
      {invoice.status === 'overdue' && daysOverdue > 0 ? (
        <Animated.View
          entering={FadeInDown.duration(400).delay(40)}
          className="rounded-xl p-3 mb-4"
          style={{ backgroundColor: theme.dangerSoft }}
        >
          <Text variant="bodySmall" color={theme.danger} align="center">
            {daysOverdue} jour{daysOverdue > 1 ? 's' : ''} de retard de
            paiement
          </Text>
        </Animated.View>
      ) : null}

      {/* ── Invoice Header Card ─────────────────────────────────── */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(80)}
        className="mt-2"
      >
        <Card>
          <Text
            variant="labelSmall"
            color={theme.textTertiary}
            className="mb-1"
          >
            FACTURE
          </Text>
          <Text variant="headlineMedium">{invoice.reference}</Text>

          <Divider className="my-4" />

          {/* Agency info */}
          <Text variant="titleSmall">My Fleet SAS</Text>
          <Text
            variant="bodySmall"
            color={theme.textSecondary}
            className="mt-1"
          >
            12 Boulevard Mohammed V, Casablanca 20000
          </Text>
          <Text
            variant="bodySmall"
            color={theme.textSecondary}
            className="mt-0.5"
          >
            +212 5 22 00 00 00
          </Text>

          <Divider className="my-4" />

          {/* Client info */}
          <Text variant="bodySmall" color={theme.textTertiary}>
            Factur\u00E9 \u00E0
          </Text>
          <Text variant="titleSmall" className="mt-1">
            {invoice.clientName}
          </Text>

          <Divider className="my-4" />

          {/* Dates */}
          <View className="flex-row justify-between">
            <View>
              <Text variant="bodySmall" color={theme.textTertiary}>
                Date d'{'\u00E9'}mission
              </Text>
              <Text variant="bodySmall" className="mt-1">
                {formatDate(invoice.issuedDate)}
              </Text>
            </View>
            <View className="items-end">
              <Text variant="bodySmall" color={theme.textTertiary}>
                Date d'{'\u00E9'}ch{'\u00E9'}ance
              </Text>
              <Text variant="bodySmall" className="mt-1">
                {formatDate(invoice.dueDate)}
              </Text>
            </View>
          </View>
        </Card>
      </Animated.View>

      {/* ── Line Items Section ──────────────────────────────────── */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(160)}
        className="mt-4"
      >
        <Text variant="headlineSmall" className="mb-3">
          D{'\u00E9'}tail des prestations
        </Text>
        <Card>
          {/* Header row */}
          <View className="flex-row mb-3">
            <Text variant="titleSmall" color={theme.textTertiary} className="flex-1">
              Description
            </Text>
            <Text
              variant="titleSmall"
              color={theme.textTertiary}
              className="w-10"
              align="center"
            >
              Qt{'\u00E9'}
            </Text>
            <Text
              variant="titleSmall"
              color={theme.textTertiary}
              className="w-16"
              align="right"
            >
              Unit.
            </Text>
            <Text
              variant="titleSmall"
              color={theme.textTertiary}
              className="w-20"
              align="right"
            >
              Total
            </Text>
          </View>

          <Divider className="mb-3" />

          {/* Line items */}
          {invoice.lineItems.map((item, idx) => (
            <View key={item.id}>
              <View className="flex-row py-2">
                <Text
                  variant="bodySmall"
                  className="flex-1"
                  numberOfLines={2}
                >
                  {item.description}
                </Text>
                <Text
                  variant="bodySmall"
                  className="w-10"
                  align="center"
                >
                  {item.quantity}
                </Text>
                <Text
                  variant="bodySmall"
                  className="w-16"
                  align="right"
                >
                  {item.unitPrice} \u20AC
                </Text>
                <Text
                  variant="bodySmall"
                  className="w-20"
                  align="right"
                >
                  {formatEuro(item.total)}
                </Text>
              </View>
              {idx < invoice.lineItems.length - 1 ? (
                <Divider />
              ) : null}
            </View>
          ))}
        </Card>
      </Animated.View>

      {/* ── Totals Section ──────────────────────────────────────── */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(240)}
        className="mt-4"
      >
        <Text variant="headlineSmall" className="mb-3">
          R{'\u00E9'}capitulatif
        </Text>
        <Card>
          {/* Subtotal */}
          <View className="flex-row justify-between mb-2">
            <Text variant="bodySmall" color={theme.textSecondary}>
              Sous-total
            </Text>
            <Text variant="bodySmall">{formatEuro(invoice.subtotal)}</Text>
          </View>

          {/* Deposit */}
          {invoice.deposit > 0 ? (
            <View className="flex-row justify-between mb-2">
              <Text variant="bodySmall" color={theme.textSecondary}>
                Caution d{'\u00E9'}duite
              </Text>
              <Text variant="bodySmall" color={theme.success}>
                -{formatEuro(invoice.deposit)}
              </Text>
            </View>
          ) : null}

          {/* Damage charges */}
          {invoice.damageCharges > 0 ? (
            <View className="flex-row justify-between mb-2">
              <Text variant="bodySmall" color={theme.textSecondary}>
                Frais de dommages
              </Text>
              <Text variant="bodySmall" color={theme.danger}>
                +{formatEuro(invoice.damageCharges)}
              </Text>
            </View>
          ) : null}

          {/* Late return fee */}
          {invoice.lateReturnFee > 0 ? (
            <View className="flex-row justify-between mb-2">
              <Text variant="bodySmall" color={theme.textSecondary}>
                P{'\u00E9'}nalit{'\u00E9'} de retard
              </Text>
              <Text variant="bodySmall" color={theme.warning}>
                +{formatEuro(invoice.lateReturnFee)}
              </Text>
            </View>
          ) : null}

          {/* Violation charges */}
          {invoice.violationCharges > 0 ? (
            <View className="flex-row justify-between mb-2">
              <Text variant="bodySmall" color={theme.textSecondary}>
                Infractions
              </Text>
              <Text variant="bodySmall">
                +{formatEuro(invoice.violationCharges)}
              </Text>
            </View>
          ) : null}

          <Divider className="my-3" />

          {/* Total due */}
          <View className="flex-row justify-between items-center">
            <Text variant="titleMedium">Total d\u00FB</Text>
            <Text variant="headlineLarge" color={theme.accent}>
              {formatEuro(invoice.totalDue)}
            </Text>
          </View>
        </Card>
      </Animated.View>

      {/* ── Payment Status Section ──────────────────────────────── */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(320)}
        className="mt-4"
      >
        <Text variant="headlineSmall" className="mb-3">
          Statut de paiement
        </Text>
        <Card>
          <View className="flex-row items-center mb-3">
            <Badge variant={statusBadgeVariant(invoice.status)} size="lg">
              {statusLabel(invoice.status)}
            </Badge>
          </View>

          {/* Payment history */}
          {invoice.payments.length > 0 ? (
            <View>
              <Text
                variant="titleSmall"
                color={theme.textTertiary}
                className="mb-2"
              >
                Historique des paiements
              </Text>
              {invoice.payments.map((payment) => (
                <View
                  key={payment.id}
                  className="flex-row items-center justify-between py-2"
                >
                  <View className="flex-row items-center flex-1">
                    <Text variant="bodySmall" color={theme.textSecondary}>
                      {formatDate(payment.date)}
                    </Text>
                    <Badge
                      variant={paymentMethodBadgeVariant(payment.method)}
                      size="sm"
                      className="ml-2"
                    >
                      {paymentMethodLabel(payment.method)}
                    </Badge>
                  </View>
                  <Text variant="bodySmall" color={theme.success}>
                    +{formatEuro(payment.amount)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Remaining balance */}
          {invoice.remainingBalance > 0 ? (
            <View className="mt-3">
              <Divider className="mb-3" />
              <View className="flex-row justify-between items-center">
                <Text variant="bodySmall" color={theme.textSecondary}>
                  Solde restant
                </Text>
                <Text variant="titleMedium" color={theme.warning}>
                  {formatEuro(invoice.remainingBalance)}
                </Text>
              </View>
            </View>
          ) : null}
        </Card>
      </Animated.View>

      {/* ── Stripe Simulation (pending / overdue / partially-paid) ── */}
      {isPendingOrOverdue ? (
        <Animated.View
          entering={FadeInDown.duration(400).delay(400)}
          className="mt-4"
        >
          <Text variant="headlineSmall" className="mb-3">
            Actions de paiement
          </Text>

          {/* Card Payment Section */}
          {showCardPayment ? (
            <Card className="mb-3">
              {cardSuccess ? (
                <Animated.View
                  entering={FadeInDown.duration(600).springify()}
                  className="items-center py-6"
                >
                  <Animated.View
                    entering={FadeInDown.duration(800).springify()}
                  >
                    <CheckCircle
                      size={64}
                      color={theme.success}
                      strokeWidth={1.5}
                    />
                  </Animated.View>
                  <Text
                    variant="titleMedium"
                    color={theme.success}
                    className="mt-3"
                  >
                    Paiement r{'\u00E9'}ussi !
                  </Text>
                  <Text
                    variant="bodySmall"
                    color={theme.textSecondary}
                    className="mt-1"
                  >
                    {formatEuro(invoice.remainingBalance)} d{'\u00E9'}bit
                    {'\u00E9'}
                  </Text>
                </Animated.View>
              ) : (
                <View>
                  <Text variant="titleSmall" className="mb-3">
                    Carte enregistr{'\u00E9'}e
                  </Text>
                  <View
                    className="flex-row items-center p-3 rounded-xl mb-3"
                    style={{ backgroundColor: theme.surfaceTertiary }}
                  >
                    <CreditCard
                      size={20}
                      color={theme.textSecondary}
                    />
                    <Text variant="bodyMedium" className="ml-3">
                      **** **** **** 4242
                    </Text>
                  </View>
                  <View className="flex-row justify-between mb-4">
                    <Text
                      variant="bodySmall"
                      color={theme.textSecondary}
                    >
                      Montant {'\u00E0'} d{'\u00E9'}biter
                    </Text>
                    <Text variant="titleSmall" color={theme.accent}>
                      {formatEuro(invoice.remainingBalance)}
                    </Text>
                  </View>
                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <Button
                        variant="ghost"
                        fullWidth
                        onPress={() => setShowCardPayment(false)}
                      >
                        Annuler
                      </Button>
                    </View>
                    <View className="flex-1">
                      <Button
                        variant="primary"
                        fullWidth
                        loading={cardLoading}
                        onPress={handleCardPayment}
                      >
                        Confirmer
                      </Button>
                    </View>
                  </View>
                </View>
              )}
            </Card>
          ) : (
            <Button
              variant="primary"
              fullWidth
              leftIcon={CreditCard}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowCardPayment(true);
                setShowCashPayment(false);
              }}
              className="mb-3"
            >
              Charger la carte
            </Button>
          )}

          {/* Cash Payment Section */}
          {showCashPayment ? (
            <Card className="mb-3">
              <Text variant="titleSmall" className="mb-3">
                Paiement en esp{'\u00E8'}ces
              </Text>
              <View
                className="flex-row items-center p-3 rounded-xl mb-3"
                style={{ backgroundColor: theme.surfaceTertiary }}
              >
                <Banknote size={20} color={theme.textSecondary} />
                <TextInput
                  value={cashAmount}
                  onChangeText={setCashAmount}
                  placeholder={`Max ${formatEuro(invoice.remainingBalance)}`}
                  placeholderTextColor={theme.textTertiary}
                  keyboardType="decimal-pad"
                  className="flex-1 ml-3"
                  style={{
                    fontFamily: 'Poppins_400Regular',
                    fontSize: 14,
                    color: theme.textPrimary,
                  }}
                />
                <Text variant="bodySmall" color={theme.textTertiary}>
                  {'\u20AC'}
                </Text>
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Button
                    variant="ghost"
                    fullWidth
                    onPress={() => {
                      setShowCashPayment(false);
                      setCashAmount('');
                    }}
                  >
                    Annuler
                  </Button>
                </View>
                <View className="flex-1">
                  <Button
                    variant="primary"
                    fullWidth
                    onPress={handleCashPayment}
                  >
                    Encaisser
                  </Button>
                </View>
              </View>
            </Card>
          ) : (
            <Button
              variant="secondary"
              fullWidth
              leftIcon={Banknote}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowCashPayment(true);
                setShowCardPayment(false);
              }}
              className="mb-3"
            >
              Paiement en esp{'\u00E8'}ces
            </Button>
          )}

          {/* Send reminder */}
          <Button
            variant="ghost"
            fullWidth
            leftIcon={Bell}
            onPress={handleSendReminder}
          >
            Envoyer un rappel
          </Button>
        </Animated.View>
      ) : null}

      {/* ── Paid Actions ────────────────────────────────────────── */}
      {invoice.status === 'paid' ? (
        <Animated.View
          entering={FadeInDown.duration(400).delay(400)}
          className="mt-4"
        >
          <View className="gap-3">
            <Button
              variant="primary"
              fullWidth
              leftIcon={Download}
              onPress={handleGenerateInvoicePdf}
            >
              G{'\u00E9'}n{'\u00E9'}rer facture PDF
            </Button>
            <Button
              variant="secondary"
              fullWidth
              leftIcon={Send}
              onPress={handleSendInvoicePdf}
            >
              Envoyer facture PDF
            </Button>
          </View>
        </Animated.View>
      ) : null}

      {/* ── Notes ───────────────────────────────────────────────── */}
      {invoice.notes ? (
        <Animated.View
          entering={FadeInDown.duration(400).delay(480)}
          className="mt-4 mb-8"
        >
          <Text variant="headlineSmall" className="mb-3">
            Notes
          </Text>
          <Card>
            <Text variant="bodyMedium" color={theme.textSecondary}>
              {invoice.notes}
            </Text>
          </Card>
        </Animated.View>
      ) : (
        <View className="mb-8" />
      )}
    </ScreenWrapper>
  );
}
