import React, { useState, useCallback } from "react";
import { View, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  ChevronLeft,
  Phone,
  Mail,
  CalendarDays,
  Euro,
  Car,
  Activity,
  FileText,
  AlertTriangle,
  Edit,
  Flag,
  FlagOff,
} from "lucide-react-native";

import { ScreenWrapper } from "@/components/ui/ScreenWrapper";
import { Text } from "@/components/ui/Text";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Divider } from "@/components/ui/Divider";
import { EmptyState } from "@/components/ui/EmptyState";
import { Image } from "@/components/ui/Image";
import { useTheme } from "@/hooks/useTheme";
import { useToastStore } from "@/components/ui/Toast";
import { useClient, useUpdateClient } from "@/hooks/useClients";
import { useBookings } from "@/hooks/useBookings";
import { useInvoices } from "@/hooks/useInvoices";
import { useViolations } from "@/hooks/useViolations";
import { useClientDocuments } from "@/hooks/useClientDocuments";
import { formatDate, formatCurrency } from "@/utils/format";
import type { ClientTag } from "@/types/client";
import type { Booking, BookingStatus } from "@/types/booking";
import type { ViolationStatus } from "@/types/violation";
import type { InvoiceStatus } from "@/types/billing";
import type { ClientDocument } from "@/services/clientService";

// ── Tag helpers ────────────────────────────────────────────────────────────

function getTagVariant(
  tag: ClientTag,
): "accent" | "info" | "success" | "neutral" | "danger" {
  switch (tag) {
    case "vip":
      return "accent";
    case "corporate":
      return "info";
    case "frequent":
      return "success";
    case "new":
      return "neutral";
    case "flagged":
      return "danger";
  }
}

function getTagLabel(tag: ClientTag): string {
  switch (tag) {
    case "vip":
      return "VIP";
    case "corporate":
      return "Corporate";
    case "frequent":
      return "Fréquent";
    case "new":
      return "Nouveau";
    case "flagged":
      return "Signalé";
  }
}

// ── Booking status helpers ─────────────────────────────────────────────────

function getBookingStatusVariant(
  status: BookingStatus,
): "success" | "warning" | "info" | "neutral" | "danger" {
  switch (status) {
    case "active":
      return "success";
    case "confirmed":
      return "info";
    case "pending":
      return "warning";
    case "completed":
      return "neutral";
    case "cancelled":
      return "danger";
  }
}

function getBookingStatusLabel(status: BookingStatus): string {
  switch (status) {
    case "active":
      return "Actif";
    case "confirmed":
      return "Confirmé";
    case "pending":
      return "En attente";
    case "completed":
      return "Terminé";
    case "cancelled":
      return "Annulé";
  }
}

// ── Violation status helpers ───────────────────────────────────────────────

function getViolationStatusVariant(
  status: ViolationStatus,
): "success" | "warning" | "info" | "neutral" | "danger" {
  switch (status) {
    case "paid":
      return "success";
    case "received":
      return "warning";
    case "client-identified":
      return "info";
    case "forwarded":
      return "info";
    case "disputed":
      return "danger";
  }
}

function getViolationStatusLabel(status: ViolationStatus): string {
  switch (status) {
    case "paid":
      return "Payé";
    case "received":
      return "Reçu";
    case "client-identified":
      return "Identifié";
    case "forwarded":
      return "Transféré";
    case "disputed":
      return "Contesté";
  }
}

function getViolationTypeLabel(type: string): string {
  switch (type) {
    case "speeding":
      return "Excès de vitesse";
    case "parking":
      return "Stationnement";
    case "redlight":
      return "Feu rouge";
    default:
      return "Autre";
  }
}

// ── Invoice status helpers ─────────────────────────────────────────────────

function getInvoiceStatusVariant(
  status: InvoiceStatus,
): "success" | "warning" | "info" | "neutral" | "danger" {
  switch (status) {
    case "paid":
      return "success";
    case "pending":
      return "warning";
    case "overdue":
      return "danger";
    case "partially-paid":
      return "info";
    case "refund_pending":
      return "warning";
    case "refunded":
      return "success";
    case "void":
      return "danger";
  }
}

function getInvoiceStatusLabel(status: InvoiceStatus): string {
  switch (status) {
    case "paid":
      return "Payé";
    case "pending":
      return "En attente";
    case "overdue":
      return "En retard";
    case "partially-paid":
      return "Partiel";
    case "refund_pending":
      return "Remb. en attente";
    case "refunded":
      return "Remboursé";
    case "void":
      return "Annulée";
  }
}

// ── Tab types ──────────────────────────────────────────────────────────────

type TabKey = "bookings" | "violations" | "invoices" | "documents";

interface TabOption {
  key: TabKey;
  label: string;
}

const TABS: TabOption[] = [
  { key: "bookings", label: "Réservations" },
  { key: "violations", label: "Infractions" },
  { key: "invoices", label: "Factures" },
  { key: "documents", label: "Documents" },
];

// ── Main Screen ────────────────────────────────────────────────────────────

export default function ClientDetailScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const showToast = useToastStore((s) => s.show);

  const { data: client, isLoading } = useClient(id);
  const updateClient = useUpdateClient();

  // Bookings drive the header stat cards (last / active booking). The per-tab
  // lists fetch their own data inside each tab component to keep this screen
  // thin and avoid over-fetching tabs the user never opens.
  const { data: clientBookings = [] } = useBookings({ clientId: id });

  const [activeTab, setActiveTab] = useState<TabKey>("bookings");

  const sortedBookings = [...clientBookings].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
  );

  // Last booking
  const lastBooking =
    sortedBookings.find(
      (b) => b.status === "completed" || b.status === "active",
    ) ?? null;

  // Active booking
  const activeBooking =
    sortedBookings.find(
      (b) =>
        b.status === "active" ||
        b.status === "confirmed" ||
        b.status === "pending",
    ) ?? null;

  const isFlagged = client?.tags.includes("flagged") ?? false;

  const handleToggleFlag = useCallback(() => {
    if (!client) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const nextTags = isFlagged
      ? client.tags.filter((t) => t !== "flagged")
      : [...client.tags, "flagged"];
    const nextFlagReason = isFlagged ? null : "Signalé manuellement";
    updateClient.mutate(
      { id: client.id, data: { tags: nextTags, flagReason: nextFlagReason } },
      {
        onSuccess: () => {
          showToast({
            variant: isFlagged ? "success" : "warning",
            title: isFlagged ? "Signalement retiré" : "Client signalé",
            message: `${client.firstName} ${client.lastName} ${isFlagged ? "n'est plus signalé" : "a été signalé"}.`,
          });
        },
        onError: () => {
          showToast({
            variant: "error",
            title: "Erreur",
            message: "Impossible de mettre à jour le client.",
          });
        },
      },
    );
  }, [client, isFlagged, updateClient, showToast]);

  // ── Loading / Not found ──────────────────────────────────────────────

  if (isLoading && !client) {
    return (
      <ScreenWrapper>
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="small" color={theme.accent} />
        </View>
      </ScreenWrapper>
    );
  }

  if (!client) {
    return (
      <ScreenWrapper scroll>
        <View className="flex-1 items-center justify-center py-20">
          <EmptyState
            icon={AlertTriangle}
            title={t("clients.notFound", "Client introuvable")}
            subtitle={t(
              "clients.notFoundDesc",
              "Le client que vous recherchez n'existe pas.",
            )}
            actionLabel={t("common.back", "Retour")}
            onAction={() => router.back()}
          />
        </View>
      </ScreenWrapper>
    );
  }

  const fullName = `${client.firstName} ${client.lastName}`;

  return (
    <ScreenWrapper scroll>
      {/* ── Header ──────────────────────────────────────────────── */}
      <Animated.View
        entering={FadeInDown.duration(400)}
        className="flex-row items-center pt-6 pb-2"
      >
        <Pressable onPress={() => router.back()} className="mr-3">
          <ChevronLeft size={24} color={theme.textPrimary} strokeWidth={2} />
        </Pressable>
        <Text variant="headlineLarge" className="flex-1" numberOfLines={1}>
          {fullName}
        </Text>
      </Animated.View>

      {/* ── Profile section ─────────────────────────────────────── */}
      <Animated.View
        entering={FadeInDown.delay(80).duration(400).springify()}
        className="items-center mt-4"
      >
        <Avatar name={fullName} size="xl" />
        <Text variant="headlineLarge" className="mt-3" align="center">
          {fullName}
        </Text>

        {/* Tags row */}
        {client.tags.length > 0 && (
          <View className="flex-row flex-wrap gap-1.5 mt-2 justify-center">
            {client.tags.map((tag) => (
              <Badge key={tag} variant={getTagVariant(tag)} size="md">
                {getTagLabel(tag)}
              </Badge>
            ))}
          </View>
        )}

        {/* Phone & email actions */}
        <View className="flex-row items-center gap-4 mt-4">
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              showToast({
                variant: "info",
                title: "Appel simulé",
                message: client.phone,
              });
            }}
            className="flex-row items-center rounded-full px-4 py-2"
            style={{ backgroundColor: theme.surfaceTertiary }}
          >
            <Phone size={16} color={theme.accent} />
            <Text variant="bodySmall" color={theme.accent} className="ml-2">
              {client.phone}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              showToast({
                variant: "info",
                title: "Email simulé",
                message: client.email,
              });
            }}
            className="flex-row items-center rounded-full px-4 py-2"
            style={{ backgroundColor: theme.surfaceTertiary }}
          >
            <Mail size={16} color={theme.accent} />
            <Text
              variant="bodySmall"
              color={theme.accent}
              className="ml-2"
              numberOfLines={1}
            >
              {client.email}
            </Text>
          </Pressable>
        </View>
      </Animated.View>

      {/* ── Stats cards (horizontal scroll) ─────────────────────── */}
      <Animated.View
        entering={FadeInDown.delay(160).duration(400).springify()}
        className="mt-6"
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 12, paddingRight: 4 }}
        >
          {/* Total locations */}
          <Card className="w-[140px]">
            <View className="items-center">
              <Car size={20} color={theme.accent} />
              <Text variant="headlineMedium" className="mt-2">
                {client.totalBookings}
              </Text>
              <Text
                variant="bodySmall"
                color={theme.textTertiary}
                align="center"
              >
                Total locations
              </Text>
            </View>
          </Card>

          {/* Total dépensé */}
          <Card className="w-[140px]">
            <View className="items-center">
              <Euro size={20} color={theme.accent} />
              <Text variant="headlineMedium" className="mt-2">
                {"\u20AC"}
                {client.totalSpent}
              </Text>
              <Text
                variant="bodySmall"
                color={theme.textTertiary}
                align="center"
              >
                Total dépensé
              </Text>
            </View>
          </Card>

          {/* Dernière location */}
          <Card className="w-[140px]">
            <View className="items-center">
              <CalendarDays size={20} color={theme.accent} />
              <Text
                variant="bodyMedium"
                className="mt-2"
                align="center"
                numberOfLines={1}
              >
                {lastBooking
                  ? formatDate(lastBooking.startDate, "short")
                  : "Aucune"}
              </Text>
              <Text
                variant="bodySmall"
                color={theme.textTertiary}
                align="center"
              >
                Dernière location
              </Text>
            </View>
          </Card>

          {/* Réservation active */}
          <Card className="w-[140px]">
            <View className="items-center">
              <Activity
                size={20}
                color={activeBooking ? theme.success : theme.textTertiary}
              />
              <Text
                variant="bodyMedium"
                color={activeBooking ? theme.success : theme.textTertiary}
                className="mt-2"
                align="center"
              >
                {activeBooking ? "Oui" : "Non"}
              </Text>
              <Text
                variant="bodySmall"
                color={theme.textTertiary}
                align="center"
              >
                Réservation active
              </Text>
            </View>
          </Card>
        </ScrollView>
      </Animated.View>

      {/* ── Tabs ────────────────────────────────────────────────── */}
      <Animated.View
        entering={FadeInDown.delay(240).duration(400).springify()}
        className="mt-6"
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 0 }}
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActiveTab(tab.key);
                }}
                className="px-4 py-2.5"
                style={{
                  borderBottomWidth: 2,
                  borderBottomColor: isActive ? theme.accent : "transparent",
                }}
              >
                <Text
                  variant="bodyMedium"
                  color={isActive ? theme.accent : theme.textTertiary}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Divider />
      </Animated.View>

      {/* ── Tab content ─────────────────────────────────────────── */}
      <View className="mt-4">
        {activeTab === "bookings" && <BookingsTab bookings={sortedBookings} />}
        {activeTab === "violations" && <ViolationsTab clientId={id} />}
        {activeTab === "invoices" && <InvoicesTab clientId={id} />}
        {activeTab === "documents" && <DocumentsTab clientId={id} />}
      </View>

      {/* ── Action buttons ──────────────────────────────────────── */}
      <Animated.View
        entering={FadeInDown.delay(320).duration(400).springify()}
        className="mt-6 mb-8 gap-3"
      >
        <Button
          variant="primary"
          fullWidth
          leftIcon={Car}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/(app)/(bookings)/new");
          }}
        >
          Nouvelle réservation
        </Button>

        <Button
          variant="ghost"
          fullWidth
          leftIcon={Edit}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            showToast({
              variant: "info",
              title: "Modification",
              message: "La modification sera bientôt disponible.",
            });
          }}
        >
          Modifier
        </Button>

        <Button
          variant="ghost"
          fullWidth
          leftIcon={isFlagged ? FlagOff : Flag}
          onPress={handleToggleFlag}
        >
          {isFlagged ? "Retirer le signalement" : "Signaler"}
        </Button>
      </Animated.View>
    </ScreenWrapper>
  );
}

// ── Bookings Tab ───────────────────────────────────────────────────────────

interface BookingsTabProps {
  bookings: Booking[];
}

function BookingsTab({ bookings }: BookingsTabProps) {
  const theme = useTheme();

  if (bookings.length === 0) {
    return (
      <EmptyState
        icon={Car}
        title="Aucune réservation"
        subtitle="Ce client n'a pas encore de réservation."
        className="py-8"
      />
    );
  }

  return (
    <View>
      {bookings.map((booking, index) => (
        <Animated.View
          key={booking.id}
          entering={FadeInDown.delay(index * 50)
            .duration(400)
            .springify()}
        >
          <Card className="mb-3">
            <View className="flex-row items-center justify-between mb-2">
              <Text variant="titleSmall" numberOfLines={1} className="flex-1">
                {booking.vehicleName}
              </Text>
              <Badge
                variant={getBookingStatusVariant(booking.status)}
                size="sm"
              >
                {getBookingStatusLabel(booking.status)}
              </Badge>
            </View>
            <Text variant="bodySmall" color={theme.textSecondary}>
              {formatDate(booking.startDate, "short")} {"\u2192"}{" "}
              {formatDate(booking.endDate, "short")}
            </Text>
            <Text variant="bodySmall" color={theme.accent} className="mt-1">
              {formatCurrency(booking.totalAmount)}
            </Text>
          </Card>
        </Animated.View>
      ))}
    </View>
  );
}

// ── Violations Tab ─────────────────────────────────────────────────────────

function ViolationsTab({ clientId }: { clientId: string }) {
  const theme = useTheme();
  const { data = [], isLoading } = useViolations({ clientId });

  if (isLoading) {
    return (
      <View className="items-center justify-center py-10">
        <ActivityIndicator size="small" color={theme.accent} />
      </View>
    );
  }

  const violations = [...data].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  if (violations.length === 0) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Aucune infraction"
        subtitle="Ce client n'a aucune infraction enregistrée."
        className="py-8"
      />
    );
  }

  return (
    <View>
      {violations.map((violation, index) => (
        <Animated.View
          key={violation.id}
          entering={FadeInDown.delay(index * 50)
            .duration(400)
            .springify()}
        >
          <Card className="mb-3">
            <View className="flex-row items-center justify-between mb-2">
              <Text variant="titleSmall" numberOfLines={1} className="flex-1">
                {getViolationTypeLabel(violation.type)}
              </Text>
              <Badge
                variant={getViolationStatusVariant(violation.status)}
                size="sm"
              >
                {getViolationStatusLabel(violation.status)}
              </Badge>
            </View>
            <Text variant="bodySmall" color={theme.textSecondary}>
              {formatDate(violation.date, "short")}
            </Text>
            <Text variant="bodySmall" color={theme.accent} className="mt-1">
              {formatCurrency(violation.totalCharge)}
            </Text>
          </Card>
        </Animated.View>
      ))}
    </View>
  );
}

// ── Invoices Tab ───────────────────────────────────────────────────────────

function InvoicesTab({ clientId }: { clientId: string }) {
  const theme = useTheme();
  const router = useRouter();
  const { data = [], isLoading } = useInvoices({ agencyClientId: clientId });

  if (isLoading) {
    return (
      <View className="items-center justify-center py-10">
        <ActivityIndicator size="small" color={theme.accent} />
      </View>
    );
  }

  const invoices = [...data].sort(
    (a, b) =>
      new Date(b.issuedDate).getTime() - new Date(a.issuedDate).getTime(),
  );

  if (invoices.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Aucune facture"
        subtitle="Ce client n'a aucune facture."
        className="py-8"
      />
    );
  }

  return (
    <View>
      {invoices.map((invoice, index) => (
        <Animated.View
          key={invoice.id}
          entering={FadeInDown.delay(index * 50)
            .duration(400)
            .springify()}
        >
          <Pressable
            testID={`client-invoice-${invoice.id}`}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push(`/(app)/(more)/billing/${invoice.id}` as never);
            }}
          >
            <Card className="mb-3">
              <View className="flex-row items-center justify-between mb-2">
                <Text variant="titleSmall" numberOfLines={1} className="flex-1">
                  {invoice.reference}
                </Text>
                <Badge
                  variant={getInvoiceStatusVariant(invoice.status)}
                  size="sm"
                >
                  {getInvoiceStatusLabel(invoice.status)}
                </Badge>
              </View>
              <Text variant="bodySmall" color={theme.textSecondary}>
                {formatDate(invoice.issuedDate, "short")} {"\u2014"}{" "}
                {invoice.vehicleName}
              </Text>
              <Text variant="bodySmall" color={theme.accent} className="mt-1">
                {formatCurrency(invoice.totalDue)}
              </Text>
            </Card>
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
}

// ── Documents Tab ──────────────────────────────────────────────────────────

const DOCUMENT_TYPE_LABEL: Record<ClientDocument["type"], string> = {
  "id-front": "Pièce d'identité (recto)",
  "id-back": "Pièce d'identité (verso)",
  "license-front": "Permis (recto)",
  "license-back": "Permis (verso)",
  "credit-card-front": "Carte bancaire",
  other: "Autre document",
};

function DocumentsTab({ clientId }: { clientId: string }) {
  const theme = useTheme();
  const { data: documents = [], isLoading } = useClientDocuments(clientId);

  if (isLoading) {
    return (
      <View className="items-center justify-center py-10">
        <ActivityIndicator size="small" color={theme.accent} />
      </View>
    );
  }

  if (documents.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Aucun document"
        subtitle="Les documents du client apparaîtront ici."
        className="py-8"
      />
    );
  }

  return (
    <View>
      {documents.map((doc, index) => (
        <Animated.View
          key={doc.id}
          entering={FadeInDown.delay(index * 50)
            .duration(400)
            .springify()}
        >
          <Card className="mb-3">
            <View className="flex-row items-center">
              {doc.mimeType.startsWith("image/") ? (
                <Image
                  source={{ uri: doc.url }}
                  style={{ width: 48, height: 48, borderRadius: 8 }}
                />
              ) : (
                <View
                  className="items-center justify-center rounded-lg"
                  style={{
                    width: 48,
                    height: 48,
                    backgroundColor: theme.surfaceTertiary,
                  }}
                >
                  <FileText size={20} color={theme.textSecondary} />
                </View>
              )}
              <View className="flex-1 ml-3">
                <Text variant="titleSmall" numberOfLines={1}>
                  {DOCUMENT_TYPE_LABEL[doc.type]}
                </Text>
                <Text
                  variant="bodySmall"
                  color={theme.textSecondary}
                  numberOfLines={1}
                >
                  {doc.uploadedAt
                    ? formatDate(doc.uploadedAt, "short")
                    : doc.originalName}
                </Text>
              </View>
            </View>
          </Card>
        </Animated.View>
      ))}
    </View>
  );
}
