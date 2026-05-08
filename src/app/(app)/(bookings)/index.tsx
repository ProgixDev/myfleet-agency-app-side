import React, { useState, useCallback, useMemo, useEffect } from "react";
import { View, Pressable, FlatList, RefreshControl } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  CalendarPlus,
  CalendarDays,
  CalendarOff,
  Car,
} from "lucide-react-native";

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
import { useBookings } from "@/hooks/useBookings";
import { useVehicles } from "@/hooks/useFleet";
import { Image } from "@/components/ui/Image";
import { resolveVehicleImageSource } from "@/data/vehicleImages";
import type { Booking, BookingStatus } from "@/types/booking";
import type { Vehicle } from "@/types/vehicle";

type FilterValue = BookingStatus | "upcoming" | "conflict" | null;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type StatusBadgeVariant = "success" | "info" | "warning" | "neutral" | "danger";

function getStatusBadge(status: BookingStatus): {
  label: string;
  variant: StatusBadgeVariant;
} {
  switch (status) {
    case "active":
      return { label: "Active", variant: "success" };
    case "confirmed":
      return { label: "Confirmed", variant: "info" };
    case "pending":
      return { label: "Pending", variant: "warning" };
    case "completed":
      return { label: "Completed", variant: "neutral" };
    case "cancelled":
      return { label: "Cancelled", variant: "danger" };
  }
}

function getStripColor(
  status: BookingStatus,
  theme: ReturnType<typeof useTheme>,
): string {
  switch (status) {
    case "active":
      return theme.success;
    case "pending":
    case "confirmed":
      return theme.info;
    case "completed":
      return theme.textTertiary;
    case "cancelled":
      return theme.danger;
  }
}

function getDaysBetween(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
}

function matchesUpcoming(status: BookingStatus): boolean {
  return status === "pending" || status === "confirmed";
}

interface BookingCardProps {
  booking: Booking;
  vehicle: Vehicle | undefined;
  index: number;
  onPress: () => void;
}

function BookingCard({ booking, vehicle, index, onPress }: BookingCardProps) {
  const theme = useTheme();
  const statusBadge = getStatusBadge(booking.status);
  const stripColor = getStripColor(booking.status, theme);
  const days = getDaysBetween(booking.startDate, booking.endDate);
  const thumb = resolveVehicleImageSource(vehicle ?? { id: booking.vehicleId });

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
      className="rounded-xl overflow-hidden mb-3"
      style={{ backgroundColor: theme.surface }}
    >
      <View className="flex-row">
        {/* Left colour strip */}
        <View style={{ width: 4, backgroundColor: stripColor }} />

        {/* Content */}
        <View className="flex-1 flex-row p-3">
          {/* Vehicle thumbnail */}
          <View
            className="rounded-xl items-center justify-center mr-3 overflow-hidden"
            style={{
              width: 48,
              height: 48,
              backgroundColor: theme.surfaceTertiary,
            }}
          >
            {thumb ? (
              <Image
                source={thumb}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <Car size={22} color={theme.textTertiary} />
            )}
          </View>

          {/* Middle column */}
          <View className="flex-1 mr-2 justify-center">
            <Text variant="titleMedium" numberOfLines={1}>
              {booking.vehicleName}
            </Text>
            <Text
              variant="bodySmall"
              color={theme.textSecondary}
              numberOfLines={1}
              className="mt-0.5"
            >
              {booking.clientName}
            </Text>
            <Text
              variant="bodySmall"
              color={theme.textTertiary}
              className="mt-0.5"
            >
              {formatDate(booking.startDate, "short")} {"\u2192"}{" "}
              {formatDate(booking.endDate, "short")}
            </Text>
          </View>

          {/* Right column */}
          <View className="items-end justify-between">
            <Badge variant="neutral" size="sm">
              {days}j
            </Badge>
            <Text variant="titleMedium" color={theme.accent}>
              {formatCurrency(booking.totalAmount)}
            </Text>
            <Badge variant={statusBadge.variant} size="sm">
              {statusBadge.label}
            </Badge>
          </View>
        </View>
      </View>
    </AnimatedPressable>
  );
}

function BookingCardSkeleton() {
  const theme = useTheme();
  return (
    <View
      className="rounded-xl overflow-hidden mb-3"
      style={{ backgroundColor: theme.surface }}
    >
      <View className="flex-row">
        <View style={{ width: 4, backgroundColor: theme.surfaceTertiary }} />
        <View className="flex-1 flex-row p-3">
          <Skeleton
            width={48}
            height={48}
            radius={12}
            style={{ marginRight: 12 }}
          />
          <View className="flex-1 mr-2 justify-center">
            <Skeleton height={16} width={"60%"} />
            <Skeleton height={12} width={"45%"} style={{ marginTop: 8 }} />
            <Skeleton height={12} width={"55%"} style={{ marginTop: 6 }} />
          </View>
          <View className="items-end justify-between" style={{ minWidth: 64 }}>
            <Skeleton height={18} width={36} radius={9} />
            <Skeleton height={16} width={56} />
            <Skeleton height={18} width={64} radius={9} />
          </View>
        </View>
      </View>
    </View>
  );
}

const SKELETON_PLACEHOLDERS = Array.from({ length: 6 }, (_, i) => i);

export default function BookingsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ filter?: string }>();
  const {
    data: bookings = [],
    refetch,
    isRefetching,
    isLoading,
  } = useBookings();
  const { data: vehicles = [] } = useVehicles();
  const vehicleById = useMemo(
    () => new Map(vehicles.map((v) => [v.id, v])),
    [vehicles],
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterValue>(null);

  // Honour deep-link filter query param (e.g. from the dashboard's conflict card
  // or the statistics tiles — accepts any of the chip filter values).
  useEffect(() => {
    const valid: FilterValue[] = [
      "conflict",
      "active",
      "upcoming",
      "completed",
      "cancelled",
      "pending",
      "confirmed",
    ];
    if (params.filter && (valid as string[]).includes(params.filter)) {
      setFilter(params.filter as FilterValue);
    }
  }, [params.filter]);

  // Sort newest createdAt first
  const sortedBookings = useMemo(
    () =>
      [...bookings].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [bookings],
  );

  // Apply search filter on sorted bookings (used for chip counts)
  const searchFiltered = useMemo(() => {
    if (searchQuery.trim().length === 0) return sortedBookings;
    const q = searchQuery.trim().toLowerCase();
    return sortedBookings.filter(
      (b) =>
        b.clientName.toLowerCase().includes(q) ||
        b.vehicleName.toLowerCase().includes(q) ||
        b.id.toLowerCase().includes(q),
    );
  }, [sortedBookings, searchQuery]);

  // Apply status/category filter
  const filteredBookings = useMemo(() => {
    if (filter === null) return searchFiltered;
    if (filter === "upcoming") {
      return searchFiltered.filter((b) => matchesUpcoming(b.status));
    }
    if (filter === "conflict") {
      return searchFiltered.filter(
        (b) => b.conflict && b.conflict.withBookingIds.length > 0,
      );
    }
    return searchFiltered.filter((b) => b.status === filter);
  }, [searchFiltered, filter]);

  // Counts for chips
  const counts = useMemo(
    () => ({
      all: searchFiltered.length,
      active: searchFiltered.filter((b) => b.status === "active").length,
      upcoming: searchFiltered.filter((b) => matchesUpcoming(b.status)).length,
      completed: searchFiltered.filter((b) => b.status === "completed").length,
      cancelled: searchFiltered.filter((b) => b.status === "cancelled").length,
      conflict: searchFiltered.filter(
        (b) => b.conflict && b.conflict.withBookingIds.length > 0,
      ).length,
    }),
    [searchFiltered],
  );

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleFilterPress = useCallback((value: FilterValue) => {
    setFilter((prev) => (prev === value ? null : value));
  }, []);

  const handleRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void refetch();
  }, [refetch]);

  const handleCardPress = useCallback(
    (id: string) => {
      router.push(`/(bookings)/${id}`);
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Booking; index: number }) => (
      <BookingCard
        booking={item}
        vehicle={vehicleById.get(item.vehicleId)}
        index={index}
        onPress={() => handleCardPress(item.id)}
      />
    ),
    [handleCardPress, vehicleById],
  );

  const keyExtractor = useCallback((item: Booking) => item.id, []);

  const ListHeaderComponent = useMemo(
    () => (
      <View>
        {/* Header row */}
        <View className="flex-row items-center justify-between pt-6 pb-4">
          <Text variant="headlineLarge">
            {t("bookings.title", "R\u00E9servations")}
          </Text>
          <View className="flex-row items-center gap-2">
            <IconButton
              icon={CalendarDays}
              variant="ghost"
              size="md"
              onPress={() => router.push("/(app)/(bookings)/calendar")}
            />
            <IconButton
              icon={CalendarPlus}
              variant="filled"
              size="md"
              onPress={() => router.push("/(app)/(bookings)/new")}
            />
          </View>
        </View>

        {/* Search */}
        <SearchBar
          placeholder={t(
            "bookings.search",
            "Rechercher client, v\u00E9hicule...",
          )}
          onSearch={handleSearch}
          className="mb-3"
        />

        {/* Filter Chips */}
        <ChipGroup className="mb-4">
          <Chip
            label={`${t("bookings.all", "Tous")} (${counts.all})`}
            selected={filter === null}
            onPress={() => handleFilterPress(null)}
          />
          <Chip
            label={`${t("bookings.active", "Actifs")} (${counts.active})`}
            selected={filter === "active"}
            onPress={() => handleFilterPress("active")}
          />
          <Chip
            label={`${t("bookings.upcoming", "\u00C0 venir")} (${counts.upcoming})`}
            selected={filter === "upcoming"}
            onPress={() => handleFilterPress("upcoming")}
          />
          <Chip
            label={`${t("bookings.completed", "Termin\u00E9s")} (${counts.completed})`}
            selected={filter === "completed"}
            onPress={() => handleFilterPress("completed")}
          />
          <Chip
            label={`${t("bookings.cancelled", "Annul\u00E9s")} (${counts.cancelled})`}
            selected={filter === "cancelled"}
            onPress={() => handleFilterPress("cancelled")}
          />
          {counts.conflict > 0 && (
            <Chip
              label={`${t("bookings.conflict.filterChip", "Conflicts")} (${counts.conflict})`}
              selected={filter === "conflict"}
              onPress={() => handleFilterPress("conflict")}
            />
          )}
        </ChipGroup>
      </View>
    ),
    [t, counts, filter, handleSearch, handleFilterPress, router],
  );

  const ListEmptyComponent = useMemo(
    () => (
      <EmptyState
        icon={CalendarOff}
        title={t("bookings.emptyTitle", "Aucune r\u00E9servation trouv\u00E9e")}
        subtitle={t(
          "bookings.emptySubtitle",
          "Essayez de modifier votre recherche ou vos filtres.",
        )}
        className="mt-16"
      />
    ),
    [t],
  );

  const ListLoadingComponent = useMemo(
    () => (
      <View>
        {SKELETON_PLACEHOLDERS.map((i) => (
          <BookingCardSkeleton key={i} />
        ))}
      </View>
    ),
    [],
  );

  const showLoading = isLoading && bookings.length === 0;

  return (
    <ScreenWrapper>
      <FlatList
        data={showLoading ? [] : filteredBookings}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={
          showLoading ? ListLoadingComponent : ListEmptyComponent
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={theme.accent}
          />
        }
      />
    </ScreenWrapper>
  );
}
