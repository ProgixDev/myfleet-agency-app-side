import React, { useState, useCallback, useMemo } from "react";
import { View, Pressable, FlatList, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  ChevronLeft,
  Plus,
  Gauge,
  ParkingSquare,
  CircleAlert,
  AlertTriangle,
  ShieldAlert,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";

import { ScreenWrapper } from "@/components/ui/ScreenWrapper";
import { Text } from "@/components/ui/Text";
import { SearchBar } from "@/components/ui/SearchBar";
import { Chip, ChipGroup } from "@/components/ui/Chip";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { useTheme } from "@/hooks/useTheme";
import { formatCurrency, formatDate } from "@/utils/format";
import {
  useViolations,
  useViolationsSummary,
  violationKeys,
} from "@/hooks/useViolations";
import { useQueryClient } from "@tanstack/react-query";
import type {
  Violation,
  ViolationType,
  ViolationStatus,
} from "@/types/violation";

// ── Helpers ────────────────────────────────────────────────────────────────

type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral";

interface StatusConfig {
  label: string;
  variant: BadgeVariant;
}

function getStatusConfig(status: ViolationStatus): StatusConfig {
  switch (status) {
    case "received":
      return { label: "Reçue", variant: "neutral" };
    case "client-identified":
      return { label: "Client identifié", variant: "info" };
    case "forwarded":
      return { label: "Transmise", variant: "warning" };
    case "paid":
      return { label: "Payée", variant: "success" };
    case "disputed":
      return { label: "Contestée", variant: "danger" };
  }
}

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

type FilterKey = "all" | "received" | "forwarded" | "paid" | "disputed";

// ── Animated card wrapper ──────────────────────────────────────────────────

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ── Violation Card ─────────────────────────────────────────────────────────

interface ViolationCardProps {
  violation: Violation;
  index: number;
  onPress: () => void;
}

function ViolationCard({ violation, index, onPress }: ViolationCardProps) {
  const theme = useTheme();
  const statusCfg = getStatusConfig(violation.status);
  const TypeIcon = getTypeIcon(violation.type);

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
      {/* Top row: type icon + type label + date + status */}
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center flex-1">
          <View
            className="w-9 h-9 rounded-lg items-center justify-center mr-3"
            style={{ backgroundColor: theme.surfaceTertiary }}
          >
            <TypeIcon size={18} color={theme.accent} />
          </View>
          <View className="flex-1">
            <Text variant="titleSmall">{getTypeLabel(violation.type)}</Text>
            <Text variant="bodySmall" color={theme.textTertiary}>
              {formatDate(violation.date, "short")}
            </Text>
          </View>
        </View>
        <Badge variant={statusCfg.variant} size="sm">
          {statusCfg.label}
        </Badge>
      </View>

      {/* Vehicle + plate */}
      <View className="flex-row items-center justify-between mt-1">
        <Text variant="bodySmall" color={theme.textSecondary} numberOfLines={1}>
          {violation.vehicleName} {"\u00B7"} {violation.licensePlate}
        </Text>
      </View>

      {/* Client + total */}
      <View className="flex-row items-center justify-between mt-1">
        {violation.clientName ? (
          <Text
            variant="bodySmall"
            color={theme.textSecondary}
            numberOfLines={1}
          >
            {violation.clientName}
          </Text>
        ) : (
          <Badge variant="warning" size="sm">
            Non identifié
          </Badge>
        )}
        <Text variant="titleSmall" color={theme.accent}>
          {formatCurrency(violation.totalCharge)}
        </Text>
      </View>
    </AnimatedPressable>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────

export default function ViolationsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

  const queryClient = useQueryClient();
  const { data: violations = [] } = useViolations();
  const { data: summary } = useViolationsSummary();

  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [refreshing, setRefreshing] = useState(false);

  // Sort newest first
  const sortedViolations = useMemo(
    () =>
      [...violations].sort(
        (a, b) =>
          new Date(b.receivedDate).getTime() -
          new Date(a.receivedDate).getTime(),
      ),
    [violations],
  );

  // Apply search
  const searchFiltered = useMemo(() => {
    if (searchQuery.trim().length === 0) return sortedViolations;
    const q = searchQuery.trim().toLowerCase();
    return sortedViolations.filter(
      (v) =>
        v.licensePlate.toLowerCase().includes(q) ||
        (v.clientName?.toLowerCase().includes(q) ?? false) ||
        v.reference.toLowerCase().includes(q),
    );
  }, [sortedViolations, searchQuery]);

  // Apply status filter
  const filteredViolations = useMemo(() => {
    if (filter === "all") return searchFiltered;
    if (filter === "received")
      return searchFiltered.filter(
        (v) => v.status === "received" || v.status === "client-identified",
      );
    return searchFiltered.filter((v) => v.status === filter);
  }, [searchFiltered, filter]);

  // Counts
  const counts = useMemo(
    () => ({
      all: searchFiltered.length,
      received: searchFiltered.filter(
        (v) => v.status === "received" || v.status === "client-identified",
      ).length,
      forwarded: searchFiltered.filter((v) => v.status === "forwarded").length,
      paid: searchFiltered.filter((v) => v.status === "paid").length,
      disputed: searchFiltered.filter((v) => v.status === "disputed").length,
    }),
    [searchFiltered],
  );

  // Summary
  const totalCount = summary?.total ?? violations.length;
  const pendingCount = summary?.pendingCount ?? 0;
  const totalFines = summary?.totalFines ?? 0;

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleFilterPress = useCallback((value: FilterKey) => {
    setFilter((prev) => (prev === value ? "all" : value));
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: violationKeys.lists() }),
      queryClient.invalidateQueries({ queryKey: violationKeys.summary() }),
    ]);
    setRefreshing(false);
  }, [queryClient]);

  const handleCardPress = useCallback(
    (id: string) => {
      router.push(`/(app)/(more)/violations/${id}`);
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Violation; index: number }) => (
      <ViolationCard
        violation={item}
        index={index}
        onPress={() => handleCardPress(item.id)}
      />
    ),
    [handleCardPress],
  );

  const keyExtractor = useCallback((item: Violation) => item.id, []);

  const ListHeaderComponent = useMemo(
    () => (
      <View>
        {/* Header */}
        <View className="flex-row items-center pt-6 pb-4">
          <Pressable onPress={() => router.back()} className="mr-3">
            <ChevronLeft size={24} color={theme.textPrimary} strokeWidth={2} />
          </Pressable>
          <Text variant="headlineLarge" className="flex-1">
            {t("violations.title", { defaultValue: "Infractions" })}
          </Text>
          <IconButton
            icon={Plus}
            variant="filled"
            size="md"
            onPress={() => router.push("/(app)/(more)/violations/new")}
          />
        </View>

        {/* Summary Bar */}
        <Animated.View
          entering={FadeInDown.duration(400).springify()}
          className="flex-row p-4 rounded-2xl mb-4"
          style={{ backgroundColor: theme.surface }}
        >
          {/* Total */}
          <View className="flex-1 items-center">
            <Badge variant="accent" size="lg">
              {totalCount}
            </Badge>
            <Text
              variant="bodySmall"
              color={theme.textSecondary}
              className="mt-1"
            >
              Total
            </Text>
          </View>

          {/* Pending */}
          <View className="flex-1 items-center">
            <Badge variant="warning" size="lg">
              {pendingCount}
            </Badge>
            <Text
              variant="bodySmall"
              color={theme.textSecondary}
              className="mt-1"
              align="center"
            >
              Résolution en cours
            </Text>
          </View>

          {/* Total fines */}
          <View className="flex-1 items-center">
            <Text variant="titleSmall" color={theme.accent}>
              {formatCurrency(totalFines)}
            </Text>
            <Text
              variant="bodySmall"
              color={theme.textSecondary}
              className="mt-1"
            >
              Amendes totales
            </Text>
          </View>
        </Animated.View>

        {/* Search */}
        <SearchBar
          placeholder={t(
            "violations.search",
            "Rechercher plaque, client, référence...",
          )}
          onSearch={handleSearch}
          className="mb-3"
        />

        {/* Filter Chips */}
        <ChipGroup className="mb-4">
          <Chip
            label={`Tous (${counts.all})`}
            selected={filter === "all"}
            onPress={() => handleFilterPress("all")}
          />
          <Chip
            label={`Reçues (${counts.received})`}
            selected={filter === "received"}
            onPress={() => handleFilterPress("received")}
          />
          <Chip
            label={`Transmises (${counts.forwarded})`}
            selected={filter === "forwarded"}
            onPress={() => handleFilterPress("forwarded")}
          />
          <Chip
            label={`Payées (${counts.paid})`}
            selected={filter === "paid"}
            onPress={() => handleFilterPress("paid")}
          />
          <Chip
            label={`Contestées (${counts.disputed})`}
            selected={filter === "disputed"}
            onPress={() => handleFilterPress("disputed")}
          />
        </ChipGroup>
      </View>
    ),
    [
      t,
      theme,
      counts,
      filter,
      totalCount,
      pendingCount,
      totalFines,
      handleSearch,
      handleFilterPress,
      router,
    ],
  );

  const ListEmptyComponent = useMemo(
    () => (
      <EmptyState
        icon={ShieldAlert}
        title={t("violations.emptyTitle", "Aucune infraction trouvée")}
        subtitle={t(
          "violations.emptySubtitle",
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
        data={filteredViolations}
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
