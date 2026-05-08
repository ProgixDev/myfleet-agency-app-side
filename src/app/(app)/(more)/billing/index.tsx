import React, { useState, useCallback, useMemo } from "react";
import { View, Pressable, FlatList, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { ChevronLeft, Receipt } from "lucide-react-native";

import { ScreenWrapper } from "@/components/ui/ScreenWrapper";
import { Text } from "@/components/ui/Text";
import { SearchBar } from "@/components/ui/SearchBar";
import { Chip, ChipGroup } from "@/components/ui/Chip";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import {
  useInvoices,
  useInvoicesSummary,
  invoiceKeys,
} from "@/hooks/useInvoices";
import { useQueryClient } from "@tanstack/react-query";
import type { Invoice, InvoiceStatus } from "@/types/billing";
import { centsToUnits } from "@/utils/money";

// ── Status helpers ──────────────────────────────────────────────────────────

type BadgeVariant = "success" | "warning" | "danger" | "info";

interface StatusConfig {
  label: string;
  variant: BadgeVariant;
}

function getStatusConfig(status: InvoiceStatus): StatusConfig {
  switch (status) {
    case "pending":
      return { label: "En attente", variant: "warning" };
    case "paid":
      return { label: "Pay\u00E9e", variant: "success" };
    case "overdue":
      return { label: "En retard", variant: "danger" };
    case "partially-paid":
      return { label: "Partiel", variant: "info" };
    case "refund_pending":
      return { label: "Remb. en attente", variant: "warning" };
    case "refunded":
      return { label: "Remboursé", variant: "success" };
    case "void":
      return { label: "Annulée", variant: "danger" };
  }
}

// ── Format helpers ──────────────────────────────────────────────────────────

function formatEuro(cents: number): string {
  return (
    new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(centsToUnits(cents)) + " \u20AC"
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

// ── Filter type ─────────────────────────────────────────────────────────────

type FilterValue = InvoiceStatus | null;

// ── Animated card wrapper ───────────────────────────────────────────────────

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ── Invoice Card ────────────────────────────────────────────────────────────

interface InvoiceCardProps {
  invoice: Invoice;
  index: number;
  onPress: () => void;
}

function InvoiceCard({ invoice, index, onPress }: InvoiceCardProps) {
  const theme = useTheme();
  const statusCfg = getStatusConfig(invoice.status);
  const daysOverdue =
    invoice.status === "overdue" ? getDaysOverdue(invoice.dueDate) : 0;

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  return (
    <AnimatedPressable
      entering={FadeInDown.delay(index * 50)
        .duration(400)
        .springify()}
      onPress={handlePress}
      className="rounded-2xl p-4 mb-3"
      style={{ backgroundColor: theme.surface }}
    >
      {/* Top row: reference + badge */}
      <View className="flex-row items-center justify-between mb-2">
        <Text variant="titleSmall" color={theme.textTertiary}>
          {invoice.reference}
        </Text>
        <Badge variant={statusCfg.variant} size="sm">
          {statusCfg.label}
        </Badge>
      </View>

      {/* Vehicle + client */}
      <Text variant="titleMedium" numberOfLines={1}>
        {invoice.vehicleName}
      </Text>
      <Text
        variant="bodySmall"
        color={theme.textSecondary}
        numberOfLines={1}
        className="mt-0.5"
      >
        {invoice.clientName}
      </Text>

      {/* Dates row */}
      <View className="flex-row items-center mt-2 flex-wrap">
        <Text variant="bodySmall" color={theme.textTertiary}>
          {formatDate(invoice.issuedDate)}
        </Text>
        <Text variant="bodySmall" color={theme.textTertiary} className="mx-1">
          {"\u2022"}
        </Text>
        <Text variant="bodySmall" color={theme.textTertiary}>
          {"\u00C9"}ch{"\u00E9"}ance: {formatDate(invoice.dueDate)}
        </Text>
      </View>

      {/* Overdue warning */}
      {invoice.status === "overdue" && daysOverdue > 0 ? (
        <Text variant="bodySmall" color={theme.danger} className="mt-1">
          {daysOverdue} jour{daysOverdue > 1 ? "s" : ""} de retard
        </Text>
      ) : null}

      {/* Total amount */}
      <Text variant="headlineSmall" color={theme.accent} className="mt-2">
        {formatEuro(invoice.totalDue)}
      </Text>
    </AnimatedPressable>
  );
}

// ── Main Screen ─────────────────────────────────────────────────────────────

export default function BillingScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

  const queryClient = useQueryClient();
  const { data: invoices = [] } = useInvoices();
  const { data: summary } = useInvoicesSummary();

  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterValue>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Summary values (server returns cents; UI's formatEuro takes whole units)
  const monthlyRevenue = summary?.monthlyRevenueCents ?? 0;
  const pendingAmount = summary?.pendingCents ?? 0;
  const overdueAmount = summary?.overdueCents ?? 0;

  // Sort newest first
  const sortedInvoices = useMemo(
    () =>
      [...invoices].sort(
        (a, b) =>
          new Date(b.issuedDate).getTime() - new Date(a.issuedDate).getTime(),
      ),
    [invoices],
  );

  // Apply search
  const searchFiltered = useMemo(() => {
    if (searchQuery.trim().length === 0) return sortedInvoices;
    const q = searchQuery.trim().toLowerCase();
    return sortedInvoices.filter(
      (inv) =>
        inv.clientName.toLowerCase().includes(q) ||
        inv.vehicleName.toLowerCase().includes(q) ||
        inv.reference.toLowerCase().includes(q),
    );
  }, [sortedInvoices, searchQuery]);

  // Apply status filter
  const filteredInvoices = useMemo(() => {
    if (filter === null) return searchFiltered;
    return searchFiltered.filter((inv) => inv.status === filter);
  }, [searchFiltered, filter]);

  // Counts for chips
  const counts = useMemo(
    () => ({
      all: searchFiltered.length,
      pending: searchFiltered.filter((inv) => inv.status === "pending").length,
      paid: searchFiltered.filter((inv) => inv.status === "paid").length,
      overdue: searchFiltered.filter((inv) => inv.status === "overdue").length,
    }),
    [searchFiltered],
  );

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleFilterPress = useCallback((value: FilterValue) => {
    setFilter((prev) => (prev === value ? null : value));
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() }),
      queryClient.invalidateQueries({ queryKey: invoiceKeys.summary() }),
    ]);
    setRefreshing(false);
  }, [queryClient]);

  const handleCardPress = useCallback(
    (id: string) => {
      router.push(`/(app)/(more)/billing/${id}`);
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Invoice; index: number }) => (
      <InvoiceCard
        invoice={item}
        index={index}
        onPress={() => handleCardPress(item.id)}
      />
    ),
    [handleCardPress],
  );

  const keyExtractor = useCallback((item: Invoice) => item.id, []);

  const ListHeaderComponent = useMemo(
    () => (
      <View>
        {/* Header */}
        <View className="flex-row items-center pt-6 pb-4">
          <Pressable onPress={() => router.back()} className="mr-3">
            <ChevronLeft size={24} color={theme.textPrimary} strokeWidth={2} />
          </Pressable>
          <Text variant="headlineLarge" className="flex-1">
            {t("billing.title", { defaultValue: "Facturation" })}
          </Text>
        </View>

        {/* Summary Card */}
        <Animated.View
          entering={FadeInDown.duration(400)}
          className="rounded-2xl p-4 mb-4"
          style={{ backgroundColor: theme.surface }}
        >
          <View className="flex-row justify-between">
            {/* Monthly Revenue */}
            <View className="flex-1 items-center">
              <Text
                variant="bodySmall"
                color={theme.textTertiary}
                align="center"
              >
                Revenus du mois
              </Text>
              <Text variant="titleMedium" color={theme.accent} className="mt-1">
                {formatEuro(monthlyRevenue)}
              </Text>
            </View>

            {/* Pending */}
            <View className="flex-1 items-center">
              <Text
                variant="bodySmall"
                color={theme.textTertiary}
                align="center"
              >
                En attente
              </Text>
              <Text
                variant="titleMedium"
                color={theme.warning}
                className="mt-1"
              >
                {formatEuro(pendingAmount)}
              </Text>
            </View>

            {/* Overdue */}
            <View className="flex-1 items-center">
              <Text
                variant="bodySmall"
                color={theme.textTertiary}
                align="center"
              >
                En retard
              </Text>
              <Text variant="titleMedium" color={theme.danger} className="mt-1">
                {formatEuro(overdueAmount)}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Search */}
        <SearchBar
          placeholder={t(
            "billing.search",
            "Rechercher client, v\u00E9hicule, r\u00E9f\u00E9rence...",
          )}
          onSearch={handleSearch}
          className="mb-3"
        />

        {/* Filter Chips */}
        <ChipGroup className="mb-4">
          <Chip
            label={`Tous (${counts.all})`}
            selected={filter === null}
            onPress={() => handleFilterPress(null)}
          />
          <Chip
            label={`En attente (${counts.pending})`}
            selected={filter === "pending"}
            onPress={() => handleFilterPress("pending")}
          />
          <Chip
            label={`Pay\u00E9es (${counts.paid})`}
            selected={filter === "paid"}
            onPress={() => handleFilterPress("paid")}
          />
          <Chip
            label={`En retard (${counts.overdue})`}
            selected={filter === "overdue"}
            onPress={() => handleFilterPress("overdue")}
          />
        </ChipGroup>
      </View>
    ),
    [
      t,
      theme,
      counts,
      filter,
      monthlyRevenue,
      pendingAmount,
      overdueAmount,
      handleSearch,
      handleFilterPress,
      router,
    ],
  );

  const ListEmptyComponent = useMemo(
    () => (
      <EmptyState
        icon={Receipt}
        title={t("billing.emptyTitle", "Aucune facture trouv\u00E9e")}
        subtitle={t(
          "billing.emptySubtitle",
          "Essayez de modifier votre recherche ou vos filtres.",
        )}
        className="mt-16"
      />
    ),
    [t],
  );

  return (
    <ScreenWrapper>
      <FlatList
        data={filteredInvoices}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.accent}
          />
        }
      />
    </ScreenWrapper>
  );
}
