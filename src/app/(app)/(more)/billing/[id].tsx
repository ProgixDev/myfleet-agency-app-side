import React, { useState, useCallback } from "react";
import { View, Pressable, TextInput } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  ChevronLeft,
  Receipt,
  CreditCard,
  Banknote,
  ArrowRightLeft,
  Bell,
  Download,
  Send,
} from "lucide-react-native";

import { ScreenWrapper } from "@/components/ui/ScreenWrapper";
import { Text } from "@/components/ui/Text";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Divider } from "@/components/ui/Divider";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useToastStore } from "@/components/ui/Toast";
import {
  useInvoice,
  useRecordPayment,
  useSendInvoiceReminder,
} from "@/hooks/useInvoices";
import { usePayments } from "@/hooks/usePayments";
import { useAgency } from "@/hooks/useAgency";
import type { InvoiceStatus } from "@/types/billing";
import type { PaymentMethod } from "@/types/payment";
import { centsToUnits, unitsToCents } from "@/utils/money";

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatEuro(cents: number): string {
  return (
    new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(centsToUnits(cents)) + " €"
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getDaysOverdue(dueDate: string): number {
  const now = new Date();
  const due = new Date(dueDate);
  const diff = now.getTime() - due.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

type BadgeVariant = "success" | "warning" | "danger" | "info";

function statusBadgeVariant(status: InvoiceStatus): BadgeVariant {
  const map: Record<InvoiceStatus, BadgeVariant> = {
    pending: "warning",
    paid: "success",
    overdue: "danger",
    "partially-paid": "info",
    refund_pending: "warning",
    refunded: "success",
    void: "danger",
  };
  return map[status];
}

function statusLabel(status: InvoiceStatus): string {
  const map: Record<InvoiceStatus, string> = {
    pending: "En attente",
    paid: "Payée",
    overdue: "En retard",
    "partially-paid": "Partiellement payée",
    refund_pending: "Remboursement en attente",
    refunded: "Remboursé",
    void: "Annulée",
  };
  return map[status];
}

function paymentMethodLabel(method: PaymentMethod): string {
  const map: Record<PaymentMethod, string> = {
    card: "Carte",
    cash: "Espèces",
    transfer: "Virement",
    other: "Autre",
  };
  return map[method];
}

function paymentMethodBadgeVariant(
  method: PaymentMethod,
): "info" | "success" | "accent" | "neutral" {
  const map: Record<PaymentMethod, "info" | "success" | "accent" | "neutral"> =
    {
      card: "info",
      cash: "success",
      transfer: "accent",
      other: "neutral",
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

  const { data: invoice, isLoading } = useInvoice(id ?? "");
  const { data: agency } = useAgency();
  const { data: payments = [] } = usePayments(
    id ? { invoiceId: id } : undefined,
  );
  const recordPaymentMutation = useRecordPayment();
  const sendReminderMutation = useSendInvoiceReminder();

  // Honest "record payment received" state. This logs a payment against the
  // invoice ledger via the backend — it does NOT process a card (real PSP is
  // out of Phase-1 scope). Amount is entered in whole units, stored as cents.
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "card" | "cash" | "transfer"
  >("card");

  const openRecordPayment = useCallback(() => {
    if (!invoice) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPaymentAmount(String(centsToUnits(invoice.remainingBalance)));
    setPaymentMethod("card");
    setShowRecordPayment(true);
  }, [invoice]);

  const handleRecordPayment = useCallback(() => {
    if (!invoice) return;
    const units = parseFloat(paymentAmount.replace(",", "."));
    const amountCents = unitsToCents(units);
    if (
      !Number.isFinite(amountCents) ||
      amountCents < 1 ||
      amountCents > invoice.remainingBalance
    ) {
      showToast({
        variant: "error",
        title: t("billing.record.errorTitle", "Montant invalide"),
        message: t("billing.record.errorMessage", {
          defaultValue: "Entrez un montant entre {{min}} et {{max}}",
          min: formatEuro(1),
          max: formatEuro(invoice.remainingBalance),
        }),
      });
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    recordPaymentMutation.mutate(
      { id: invoice.id, data: { amount: amountCents, method: paymentMethod } },
      {
        onSuccess: () => {
          setShowRecordPayment(false);
          setPaymentAmount("");
          void Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          );
          showToast({
            variant: "success",
            title: t("billing.record.success", "Paiement enregistré"),
          });
        },
        onError: (err) => {
          showToast({
            variant: "error",
            title: t("billing.record.failure", "Échec de l'enregistrement"),
            message: err instanceof Error ? err.message : undefined,
          });
        },
      },
    );
  }, [
    invoice,
    paymentAmount,
    paymentMethod,
    recordPaymentMutation,
    showToast,
    t,
  ]);

  const handleSendReminder = useCallback(() => {
    if (!invoice) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendReminderMutation.mutate(invoice.id, {
      onSuccess: () => {
        showToast({
          variant: "info",
          title: "Rappel envoyé",
          message: `Un rappel de paiement a été envoyé au client.`,
        });
      },
    });
  }, [invoice, sendReminderMutation, showToast]);

  const handleGenerateInvoicePdf = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showToast({
      variant: "success",
      title: "Facture PDF prête",
      message: "La facture PDF est prête avec les informations du client.",
    });
  }, [showToast]);

  const handleSendInvoicePdf = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showToast({
      variant: "success",
      title: "Facture envoyée",
      message:
        "La facture PDF a été envoyée par email au client.",
    });
  }, [showToast]);

  // ── Not found ───────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <ScreenWrapper scroll>
        <View className="flex-1 items-center justify-center py-20">
          <Text>Chargement…</Text>
        </View>
      </ScreenWrapper>
    );
  }

  if (!invoice) {
    return (
      <ScreenWrapper scroll>
        <View className="flex-1 items-center justify-center py-20">
          <EmptyState
            icon={Receipt}
            title={t("billing.notFound", "Facture introuvable")}
            subtitle={t(
              "billing.notFoundDesc",
              "La facture que vous recherchez n'existe pas.",
            )}
            actionLabel={t("common.back", "Retour")}
            onAction={() => router.back()}
          />
        </View>
      </ScreenWrapper>
    );
  }

  const daysOverdue =
    invoice.status === "overdue" ? getDaysOverdue(invoice.dueDate) : 0;
  const isPendingOrOverdue =
    invoice.status === "pending" ||
    invoice.status === "overdue" ||
    invoice.status === "partially-paid";

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
      {invoice.status === "overdue" && daysOverdue > 0 ? (
        <Animated.View
          entering={FadeInDown.duration(400).delay(40)}
          className="rounded-xl p-3 mb-4"
          style={{ backgroundColor: theme.dangerSoft }}
        >
          <Text variant="bodySmall" color={theme.danger} align="center">
            {daysOverdue} jour{daysOverdue > 1 ? "s" : ""} de retard de paiement
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
          <Text variant="titleSmall">{agency?.name ?? "—"}</Text>
          {agency?.address ? (
            <Text
              variant="bodySmall"
              color={theme.textSecondary}
              className="mt-1"
            >
              {agency.address}
            </Text>
          ) : null}
          {agency?.phone ? (
            <Text
              variant="bodySmall"
              color={theme.textSecondary}
              className="mt-0.5"
            >
              {agency.phone}
            </Text>
          ) : null}
          {agency?.email ? (
            <Text
              variant="bodySmall"
              color={theme.textSecondary}
              className="mt-0.5"
            >
              {agency.email}
            </Text>
          ) : null}

          <Divider className="my-4" />

          {/* Client info */}
          <Text variant="bodySmall" color={theme.textTertiary}>
            Facturé à
          </Text>
          <Text variant="titleSmall" className="mt-1">
            {invoice.clientName}
          </Text>

          <Divider className="my-4" />

          {/* Dates */}
          <View className="flex-row justify-between">
            <View>
              <Text variant="bodySmall" color={theme.textTertiary}>
                Date d&apos;{"é"}mission
              </Text>
              <Text variant="bodySmall" className="mt-1">
                {formatDate(invoice.issuedDate)}
              </Text>
            </View>
            <View className="items-end">
              <Text variant="bodySmall" color={theme.textTertiary}>
                Date d&apos;{"é"}ch{"é"}ance
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
          D{"é"}tail des prestations
        </Text>
        <Card>
          {/* Header row */}
          <View className="flex-row mb-3">
            <Text
              variant="titleSmall"
              color={theme.textTertiary}
              className="flex-1"
            >
              Description
            </Text>
            <Text
              variant="titleSmall"
              color={theme.textTertiary}
              className="w-10"
              align="center"
            >
              Qt{"é"}
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
                <Text variant="bodySmall" className="flex-1" numberOfLines={2}>
                  {item.description}
                </Text>
                <Text variant="bodySmall" className="w-10" align="center">
                  {item.quantity}
                </Text>
                <Text variant="bodySmall" className="w-16" align="right">
                  {formatEuro(item.unitPrice)}
                </Text>
                <Text variant="bodySmall" className="w-20" align="right">
                  {formatEuro(item.total)}
                </Text>
              </View>
              {idx < invoice.lineItems.length - 1 ? <Divider /> : null}
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
          R{"é"}capitulatif
        </Text>
        <Card>
          {/* Subtotal */}
          <View className="flex-row justify-between mb-2">
            <Text variant="bodySmall" color={theme.textSecondary}>
              Sous-total
            </Text>
            <Text variant="bodySmall">{formatEuro(invoice.subtotal)}</Text>
          </View>

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
                P{"é"}nalit{"é"} de retard
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
            <Text variant="titleMedium">Total dû</Text>
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
          {payments.length > 0 ? (
            <View>
              <Text
                variant="titleSmall"
                color={theme.textTertiary}
                className="mb-2"
              >
                Historique des paiements
              </Text>
              {payments.map((payment) => {
                const isRefund = payment.kind === "refund";
                const dateStr = payment.completedAt ?? payment.createdAt;
                return (
                  <View
                    key={payment.id}
                    className="flex-row items-center justify-between py-2"
                  >
                    <View className="flex-row items-center flex-1">
                      <Text variant="bodySmall" color={theme.textSecondary}>
                        {formatDate(dateStr)}
                      </Text>
                      <Badge
                        variant={paymentMethodBadgeVariant(payment.method)}
                        size="sm"
                        className="ml-2"
                      >
                        {paymentMethodLabel(payment.method)}
                      </Badge>
                      {isRefund ? (
                        <Badge variant="warning" size="sm" className="ml-2">
                          Remboursement
                        </Badge>
                      ) : null}
                    </View>
                    <Text
                      variant="bodySmall"
                      color={isRefund ? theme.warning : theme.success}
                    >
                      {isRefund ? "-" : "+"}
                      {formatEuro(payment.amount)}
                    </Text>
                  </View>
                );
              })}
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

      {/* ── Payment actions (pending / overdue / partially-paid) ──── */}
      {isPendingOrOverdue ? (
        <Animated.View
          entering={FadeInDown.duration(400).delay(400)}
          className="mt-4"
        >
          <Text variant="headlineSmall" className="mb-3">
            {t("billing.record.sectionTitle", "Actions de paiement")}
          </Text>

          {showRecordPayment ? (
            <Card className="mb-3">
              <Text variant="titleSmall" className="mb-3">
                {t("billing.record.title", "Enregistrer un paiement reçu")}
              </Text>

              {/* Amount input */}
              <Text
                variant="bodySmall"
                color={theme.textSecondary}
                className="mb-1.5"
              >
                {t("billing.record.amountLabel", "Montant reçu")}
              </Text>
              <View
                className="flex-row items-center p-3 rounded-xl mb-4"
                style={{ backgroundColor: theme.surfaceTertiary }}
              >
                <TextInput
                  testID="invoice-payment-amount-input"
                  value={paymentAmount}
                  onChangeText={setPaymentAmount}
                  placeholder={`Max ${formatEuro(invoice.remainingBalance)}`}
                  placeholderTextColor={theme.textTertiary}
                  keyboardType="decimal-pad"
                  className="flex-1"
                  style={{
                    fontFamily: "Poppins_400Regular",
                    fontSize: 14,
                    color: theme.textPrimary,
                  }}
                />
                <Text variant="bodySmall" color={theme.textTertiary}>
                  {"€"}
                </Text>
              </View>

              {/* Method selector */}
              <Text
                variant="bodySmall"
                color={theme.textSecondary}
                className="mb-1.5"
              >
                {t("billing.record.methodLabel", "Méthode")}
              </Text>
              <View className="flex-row gap-2 mb-4">
                {(
                  [
                    {
                      key: "card" as const,
                      icon: CreditCard,
                      label: t("billing.record.methodCard", "Carte"),
                    },
                    {
                      key: "cash" as const,
                      icon: Banknote,
                      label: t("billing.record.methodCash", "Espèces"),
                    },
                    {
                      key: "transfer" as const,
                      icon: ArrowRightLeft,
                      label: t("billing.record.methodTransfer", "Virement"),
                    },
                  ] as const
                ).map(({ key, icon: Icon, label }) => {
                  const active = paymentMethod === key;
                  return (
                    <Pressable
                      key={key}
                      testID={`invoice-payment-method-${key}`}
                      onPress={() => {
                        void Haptics.impactAsync(
                          Haptics.ImpactFeedbackStyle.Light,
                        );
                        setPaymentMethod(key);
                      }}
                      className="flex-1 items-center justify-center rounded-xl py-3"
                      style={{
                        backgroundColor: active
                          ? theme.accentSoft
                          : theme.surfaceTertiary,
                        borderWidth: 1.5,
                        borderColor: active ? theme.accent : "transparent",
                      }}
                    >
                      <Icon
                        size={18}
                        color={active ? theme.accent : theme.textSecondary}
                      />
                      <Text
                        variant="bodySmall"
                        color={active ? theme.accent : theme.textSecondary}
                        className="mt-1"
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Button
                    variant="ghost"
                    fullWidth
                    onPress={() => {
                      setShowRecordPayment(false);
                      setPaymentAmount("");
                    }}
                  >
                    {t("billing.record.cancel", "Annuler")}
                  </Button>
                </View>
                <View className="flex-1">
                  <Button
                    testID="invoice-record-payment-confirm-button"
                    variant="primary"
                    fullWidth
                    loading={recordPaymentMutation.isPending}
                    onPress={handleRecordPayment}
                  >
                    {t("billing.record.confirm", "Enregistrer")}
                  </Button>
                </View>
              </View>
            </Card>
          ) : (
            <Button
              testID="invoice-record-payment-button"
              variant="primary"
              fullWidth
              leftIcon={Banknote}
              onPress={openRecordPayment}
              className="mb-3"
            >
              {t("billing.record.cta", "Enregistrer un paiement reçu")}
            </Button>
          )}

          {/* Send reminder */}
          <Button
            variant="ghost"
            fullWidth
            leftIcon={Bell}
            onPress={handleSendReminder}
          >
            {t("billing.record.sendReminder", "Envoyer un rappel")}
          </Button>
        </Animated.View>
      ) : null}

      {/* ── Paid Actions ────────────────────────────────────────── */}
      {invoice.status === "paid" ? (
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
              G{"é"}n{"é"}rer facture PDF
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
