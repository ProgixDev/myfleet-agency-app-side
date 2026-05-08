import React, { useState, useCallback, useMemo } from "react";
import { View, Pressable, FlatList, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { ChevronLeft, FileText, Plus } from "lucide-react-native";

import { ScreenWrapper } from "@/components/ui/ScreenWrapper";
import { Text } from "@/components/ui/Text";
import { SearchBar } from "@/components/ui/SearchBar";
import { Chip, ChipGroup } from "@/components/ui/Chip";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTheme } from "@/hooks/useTheme";
import { formatCurrency, formatDate } from "@/utils/format";
import { useContracts } from "@/hooks/useContracts";
import type { Contract, ContractStatus } from "@/types/contract";

// ── Status helpers ──────────────────────────────────────────────────────────

type BadgeVariant = "success" | "warning" | "info" | "neutral" | "danger";

interface StatusConfig {
  label: string;
  variant: BadgeVariant;
}

function getStatusConfig(status: ContractStatus): StatusConfig {
  switch (status) {
    case "draft":
      return { label: "Brouillon", variant: "neutral" };
    case "pending-signature":
      return { label: "En attente", variant: "warning" };
    case "active":
      return { label: "Actif", variant: "success" };
    case "expired":
      return { label: "Expiré", variant: "info" };
    case "terminated":
      return { label: "Résilié", variant: "danger" };
  }
}

// ── Animated card wrapper ───────────────────────────────────────────────────

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ── Contract Card ───────────────────────────────────────────────────────────

interface ContractCardProps {
  contract: Contract;
  index: number;
  onPress: () => void;
}

function ContractCard({ contract, index, onPress }: ContractCardProps) {
  const theme = useTheme();
  const statusCfg = getStatusConfig(contract.status);

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
          {contract.reference}
        </Text>
        <Badge variant={statusCfg.variant} size="sm">
          {statusCfg.label}
        </Badge>
      </View>

      {/* Vehicle + client */}
      <Text variant="titleMedium" numberOfLines={1}>
        {contract.vehicleName}
      </Text>
      <Text
        variant="bodySmall"
        color={theme.textSecondary}
        numberOfLines={1}
        className="mt-0.5"
      >
        {contract.clientName}
      </Text>

      {/* Date range + amount */}
      <View className="flex-row items-center justify-between mt-2">
        <Text variant="bodySmall" color={theme.textTertiary}>
          {formatDate(contract.startDate, "short")} {"\u2192"}{" "}
          {formatDate(contract.endDate, "short")}
        </Text>
        <Text variant="bodySmall" color={theme.accent}>
          {formatCurrency(contract.totalAmount)}
        </Text>
      </View>
    </AnimatedPressable>
  );
}

// ── Skeleton ────────────────────────────────────────────────────────────────

function ContractCardSkeleton() {
  const theme = useTheme();
  return (
    <View
      className="rounded-2xl p-4 mb-3"
      style={{ backgroundColor: theme.surface }}
    >
      <View className="flex-row items-center justify-between mb-2">
        <Skeleton height={12} width={"30%"} />
        <Skeleton height={20} width={64} radius={12} />
      </View>
      <Skeleton height={16} width={"65%"} />
      <Skeleton height={12} width={"45%"} style={{ marginTop: 6 }} />
      <View className="flex-row items-center justify-between mt-3">
        <Skeleton height={12} width={"40%"} />
        <Skeleton height={12} width={48} />
      </View>
    </View>
  );
}

// ── Main Screen ─────────────────────────────────────────────────────────────

export default function ContractsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

  const {
    data: contracts = [],
    isLoading,
    isFetching,
    refetch,
  } = useContracts();

  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<ContractStatus | null>(null);

  // Sort newest first
  const sortedContracts = useMemo(
    () =>
      [...contracts].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [contracts],
  );

  // Apply search
  const searchFiltered = useMemo(() => {
    if (searchQuery.trim().length === 0) return sortedContracts;
    const q = searchQuery.trim().toLowerCase();
    return sortedContracts.filter(
      (c) =>
        c.clientName.toLowerCase().includes(q) ||
        c.vehicleName.toLowerCase().includes(q) ||
        c.reference.toLowerCase().includes(q),
    );
  }, [sortedContracts, searchQuery]);

  // Apply status filter
  const filteredContracts = useMemo(() => {
    if (filter === null) return searchFiltered;
    return searchFiltered.filter((c) => c.status === filter);
  }, [searchFiltered, filter]);

  // Counts for chips
  const counts = useMemo(
    () => ({
      all: searchFiltered.length,
      active: searchFiltered.filter((c) => c.status === "active").length,
      pending: searchFiltered.filter((c) => c.status === "pending-signature")
        .length,
      expired: searchFiltered.filter((c) => c.status === "expired").length,
    }),
    [searchFiltered],
  );

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleFilterPress = useCallback((value: ContractStatus | null) => {
    setFilter((prev) => (prev === value ? null : value));
  }, []);

  const handleRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void refetch();
  }, [refetch]);

  const handleCardPress = useCallback(
    (id: string) => {
      router.push(`/(app)/(more)/contracts/${id}`);
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Contract; index: number }) => (
      <ContractCard
        contract={item}
        index={index}
        onPress={() => handleCardPress(item.id)}
      />
    ),
    [handleCardPress],
  );

  // Initial loading: show skeletons matching contract card layout.
  const showSkeletons = isLoading && contracts.length === 0;
  const skeletonData = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) => ({ id: `__skel_${i}` })) as {
        id: string;
      }[],
    [],
  );

  const ListHeaderComponent = useMemo(
    () => (
      <View>
        {/* Header */}
        <View className="flex-row items-center pt-6 pb-4">
          <Pressable onPress={() => router.back()} className="mr-3">
            <ChevronLeft size={24} color={theme.textPrimary} strokeWidth={2} />
          </Pressable>
          <Text variant="headlineLarge" className="flex-1">
            {t("contracts.title", { defaultValue: "Contrats" })}
          </Text>
          <IconButton
            icon={Plus}
            variant="filled"
            size="md"
            onPress={() => router.push("/(app)/(more)/contracts/new")}
          />
        </View>

        {/* Search */}
        <SearchBar
          placeholder={t(
            "contracts.search",
            "Rechercher client, véhicule, référence...",
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
            label={`Actifs (${counts.active})`}
            selected={filter === "active"}
            onPress={() => handleFilterPress("active")}
          />
          <Chip
            label={`En attente (${counts.pending})`}
            selected={filter === "pending-signature"}
            onPress={() => handleFilterPress("pending-signature")}
          />
          <Chip
            label={`Expirés (${counts.expired})`}
            selected={filter === "expired"}
            onPress={() => handleFilterPress("expired")}
          />
        </ChipGroup>
      </View>
    ),
    [t, theme, counts, filter, handleSearch, handleFilterPress, router],
  );

  const ListEmptyComponent = useMemo(
    () => (
      <EmptyState
        icon={FileText}
        title={t("contracts.emptyTitle", "Aucun contrat trouvé")}
        subtitle={t(
          "contracts.emptySubtitle",
          "Essayez de modifier votre recherche ou vos filtres.",
        )}
        className="mt-16"
      />
    ),
    [t],
  );

  return (
    <ScreenWrapper>
      <FlatList<Contract | { id: string }>
        data={showSkeletons ? skeletonData : filteredContracts}
        renderItem={
          showSkeletons
            ? () => <ContractCardSkeleton />
            : (info) => renderItem(info as { item: Contract; index: number })
        }
        keyExtractor={(item) => (item as { id: string }).id}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={showSkeletons ? null : ListEmptyComponent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={handleRefresh}
            tintColor={theme.accent}
          />
        }
      />
    </ScreenWrapper>
  );
}
