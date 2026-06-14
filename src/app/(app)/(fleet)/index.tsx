import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Pressable,
  FlatList,
  ScrollView,
  RefreshControl,
  TextInput,
  type ListRenderItemInfo,
} from "react-native";
import { Image } from "@/components/ui/Image";
import { useTranslation } from "react-i18next";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  Car,
  Plus,
  LayoutGrid,
  List,
  ChevronRight,
  SearchX,
  Search,
  X,
} from "lucide-react-native";

import { ScreenWrapper } from "@/components/ui/ScreenWrapper";
import { Text } from "@/components/ui/Text";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/stores/useAuthStore";
import { useVehicles } from "@/hooks/useFleet";
import { useAgency } from "@/hooks/useAgency";
import { useFleetStore } from "@/stores/useFleetStore";
import { matchesVehicleQuery } from "@/utils/vehicleSearch";
import { formatCurrency } from "@/utils/format";
import { fontFamilies } from "@/theme/typography";
import type { Vehicle, VehicleStatus, VehicleBrand } from "@/types/vehicle";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getAllBrands(vehicles: Vehicle[]): VehicleBrand[] {
  return Array.from(
    new Set(vehicles.map((v) => v.brand)),
  ).sort() as VehicleBrand[];
}

// Filter chip labels for every VehicleStatus value. The `satisfies` clause
// forces this map to stay exhaustive — adding a new status to the
// VehicleStatus union becomes a compile error here, so the filter list,
// translation fallbacks, and ordering can never silently drift apart.
const STATUS_FALLBACK_LABELS = {
  available: "Available",
  rented: "Rented",
  reserved: "Reserved",
  maintenance: "Maintenance",
  retired: "Retired",
} satisfies Record<VehicleStatus, string>;

// Insertion order from STATUS_FALLBACK_LABELS drives the chip order in the UI.
const VEHICLE_STATUSES = Object.keys(STATUS_FALLBACK_LABELS) as VehicleStatus[];

function countByStatus(
  vehicles: Vehicle[],
  status: VehicleStatus | null,
): number {
  if (status === null) return vehicles.length;
  return vehicles.filter((v) => v.status === status).length;
}

function countByBrand(vehicles: Vehicle[], brand: VehicleBrand | null): number {
  if (brand === null) return vehicles.length;
  return vehicles.filter((v) => v.brand === brand).length;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function FleetScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { data: agency } = useAgency();
  const currency = agency?.currency ?? "EUR";
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin";
  const params = useLocalSearchParams<{ status?: string }>();

  const { data: vehicles = [], isLoading, refetch } = useVehicles();

  const [search, setSearch] = useState("");
  // Filters and layout are persisted via zustand so they survive app restarts.
  const statusFilter = useFleetStore((s) => s.statusFilter);
  const brandFilter = useFleetStore((s) => s.brandFilter);
  const viewMode = useFleetStore((s) => s.viewMode);
  const setStatusFilter = useFleetStore((s) => s.setStatusFilter);
  const setBrandFilter = useFleetStore((s) => s.setBrandFilter);
  const toggleViewMode = useFleetStore((s) => s.toggleViewMode);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (
      params.status &&
      (VEHICLE_STATUSES as readonly string[]).includes(params.status)
    ) {
      setStatusFilter(params.status as VehicleStatus);
    }
  }, [params.status, setStatusFilter]);

  const filtered = useMemo(() => {
    return vehicles.filter((v) => {
      if (statusFilter && v.status !== statusFilter) return false;
      if (brandFilter && v.brand !== brandFilter) return false;
      return matchesVehicleQuery(v, search);
    });
  }, [vehicles, statusFilter, brandFilter, search]);

  const brands = useMemo(() => getAllBrands(vehicles), [vehicles]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleToggleView = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleViewMode();
  }, [toggleViewMode]);

  const handleAddVehicle = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/(app)/(fleet)/add");
  }, [router]);

  const navigateToVehicle = useCallback(
    (id: string) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push(`/(app)/(fleet)/${id}`);
    },
    [router],
  );

  const statusOptions: { label: string; value: VehicleStatus | null }[] =
    useMemo(
      () => [
        { label: t("fleet.filter.all", "All"), value: null },
        ...VEHICLE_STATUSES.map((value) => ({
          value,
          label: t(`fleet.filter.${value}`, STATUS_FALLBACK_LABELS[value]),
        })),
      ],
      [t],
    );

  // ── Grid Card ──────────────────────────────────────────────────────────────

  const renderGridCard = useCallback(
    ({ item, index }: ListRenderItemInfo<Vehicle>) => (
      <Animated.View
        entering={FadeInDown.delay(index * 40).duration(350)}
        style={{ flex: 1 }}
      >
        <Pressable
          testID={`fleet-vehicle-card-${item.id}`}
          accessibilityRole="button"
          accessibilityLabel={item.name}
          onPress={() => navigateToVehicle(item.id)}
          style={({ pressed }) => ({
            backgroundColor: theme.surface,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: theme.borderLight,
            overflow: "hidden",
            transform: [{ scale: pressed ? 0.98 : 1 }],
          })}
        >
          <View
            style={{
              height: 120,
              backgroundColor: theme.surfaceTertiary,
            }}
          >
            {(() => {
              const uri = item.thumbnailUrl ?? item.images?.[0]?.url ?? null;
              return uri ? (
                <Image
                  source={{ uri }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <View className="flex-1 items-center justify-center">
                  <Car size={32} color={theme.textTertiary} strokeWidth={1.4} />
                </View>
              );
            })()}
          </View>

          <View style={{ padding: 12 }}>
            <Text
              variant="titleMedium"
              style={{ fontFamily: fontFamilies.semiBold, fontSize: 14 }}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <Text
              variant="caption"
              color={theme.textTertiary}
              style={{ fontSize: 11, marginTop: 1 }}
              numberOfLines={1}
            >
              {item.category}
            </Text>
            <Text
              variant="caption"
              color={theme.textSecondary}
              style={{
                fontFamily: fontFamilies.medium,
                fontSize: 11,
                marginTop: 2,
              }}
              numberOfLines={1}
            >
              {item.licensePlate}
            </Text>
            <View style={{ marginTop: 8 }}>
              <StatusBadge status={item.status} size="sm" />
            </View>
            <Text
              variant="bodySmall"
              color={theme.accent}
              style={{
                fontFamily: fontFamilies.bold,
                fontSize: 13,
                marginTop: 8,
              }}
            >
              {formatCurrency(item.dailyRate, currency)}
              <Text
                variant="caption"
                color={theme.textTertiary}
                style={{ fontFamily: fontFamilies.medium, fontSize: 10 }}
              >
                {" "}
                / {t("bookings.detail.perDay", "day")}
              </Text>
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    ),
    [navigateToVehicle, theme, t, currency],
  );

  // ── List Row ───────────────────────────────────────────────────────────────

  const renderListRow = useCallback(
    ({ item, index }: ListRenderItemInfo<Vehicle>) => (
      <Animated.View entering={FadeInDown.delay(index * 30).duration(300)}>
        <Pressable
          testID={`fleet-vehicle-row-${item.id}`}
          accessibilityRole="button"
          accessibilityLabel={item.name}
          onPress={() => navigateToVehicle(item.id)}
          style={({ pressed }) => ({
            backgroundColor: theme.surface,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: theme.borderLight,
            flexDirection: "row",
            padding: 10,
            marginBottom: 10,
            alignItems: "center",
            transform: [{ scale: pressed ? 0.99 : 1 }],
          })}
        >
          <View
            style={{
              width: 76,
              height: 56,
              borderRadius: 12,
              backgroundColor: theme.surfaceTertiary,
              overflow: "hidden",
            }}
          >
            {(() => {
              const uri = item.thumbnailUrl ?? item.images?.[0]?.url ?? null;
              return uri ? (
                <Image
                  source={{ uri }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <View className="flex-1 items-center justify-center">
                  <Car size={22} color={theme.textTertiary} strokeWidth={1.5} />
                </View>
              );
            })()}
          </View>

          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text
              variant="titleMedium"
              style={{ fontFamily: fontFamilies.semiBold, fontSize: 14 }}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <Text
              variant="bodySmall"
              color={theme.textSecondary}
              style={{ fontSize: 12, marginTop: 1 }}
              numberOfLines={1}
            >
              {item.brand} {"\u00B7"} {item.category}
            </Text>
            <Text
              variant="caption"
              color={theme.textTertiary}
              style={{
                fontFamily: fontFamilies.medium,
                fontSize: 11,
                marginTop: 2,
              }}
              numberOfLines={1}
            >
              {item.licensePlate}
            </Text>
          </View>

          <View style={{ alignItems: "flex-end", marginLeft: 8 }}>
            <Text
              variant="bodySmall"
              color={theme.accent}
              style={{ fontFamily: fontFamilies.bold, fontSize: 13 }}
            >
              {formatCurrency(item.dailyRate, currency)}
            </Text>
            <View style={{ marginTop: 4 }}>
              <StatusBadge status={item.status} size="sm" />
            </View>
          </View>
          <ChevronRight
            size={16}
            color={theme.textTertiary}
            style={{ marginLeft: 6 }}
          />
        </Pressable>
      </Animated.View>
    ),
    [navigateToVehicle, theme, currency],
  );

  // ── Header ─────────────────────────────────────────────────────────────────

  const ListHeader = useMemo(
    () => (
      <View>
        {/* Title bar */}
        <Animated.View
          entering={FadeInDown.duration(350)}
          className="flex-row items-center justify-between"
          style={{ paddingTop: 12, paddingBottom: 12 }}
        >
          <View className="flex-row items-center" style={{ gap: 10 }}>
            <Text
              variant="headlineLarge"
              style={{ fontFamily: fontFamilies.bold, fontSize: 22 }}
            >
              {t("fleet.title", "Flotte")}
            </Text>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 3,
                borderRadius: 9999,
                backgroundColor: theme.accentSoft,
              }}
            >
              <Text
                variant="labelSmall"
                color={theme.accent}
                style={{ fontFamily: fontFamilies.semiBold, fontSize: 11 }}
              >
                {vehicles.length}
              </Text>
            </View>
          </View>

          <View className="flex-row" style={{ gap: 8 }}>
            <Pressable
              testID="fleet-toggle-view-button"
              accessibilityRole="button"
              accessibilityLabel="Toggle view"
              onPress={handleToggleView}
              hitSlop={8}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.borderLight,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {viewMode === "grid" ? (
                <List size={18} color={theme.textPrimary} strokeWidth={2} />
              ) : (
                <LayoutGrid
                  size={18}
                  color={theme.textPrimary}
                  strokeWidth={2}
                />
              )}
            </Pressable>
            {isAdmin && (
              <Pressable
                testID="fleet-add-vehicle-button"
                accessibilityRole="button"
                accessibilityLabel={t("fleet.addVehicle", "Add Vehicle")}
                onPress={handleAddVehicle}
                hitSlop={8}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: theme.accent,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Plus size={18} color="#FFFFFF" strokeWidth={2.4} />
              </Pressable>
            )}
          </View>
        </Animated.View>

        {/* Stats card — total / available / rented breakdown */}
        <Animated.View
          entering={FadeInDown.delay(40).duration(400)}
          style={{
            backgroundColor: theme.surface,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: theme.borderLight,
            flexDirection: "row",
            paddingVertical: 16,
            marginBottom: 14,
          }}
        >
          <StatCell
            value={vehicles.length}
            label={t("fleet.stats.total", "vehicles")}
            color={theme.textPrimary}
            theme={theme}
          />
          <View
            style={{
              width: 1,
              backgroundColor: theme.border,
              marginVertical: 6,
            }}
          />
          <StatCell
            value={countByStatus(vehicles, "available")}
            label={t("fleet.stats.available", "available")}
            color={theme.success}
            theme={theme}
          />
          <View
            style={{
              width: 1,
              backgroundColor: theme.border,
              marginVertical: 6,
            }}
          />
          <StatCell
            value={countByStatus(vehicles, "rented")}
            label={t("fleet.stats.rented", "rented")}
            color={theme.warning}
            theme={theme}
          />
        </Animated.View>

        {/* Search pill */}
        <Animated.View
          entering={FadeInDown.delay(60).duration(350)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 9999,
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: theme.borderLight,
          }}
        >
          <Search size={16} color={theme.textTertiary} strokeWidth={2} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t(
              "fleet.searchPlaceholder",
              "Search by name, model or plate",
            )}
            placeholderTextColor={theme.textTertiary}
            style={{
              flex: 1,
              marginLeft: 8,
              fontSize: 14,
              color: theme.textPrimary,
              fontFamily: fontFamilies.regular,
              padding: 0,
            }}
          />
          {search.length > 0 && (
            <Pressable
              testID="fleet-search-clear-button"
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => setSearch("")}
              hitSlop={8}
            >
              <X size={14} color={theme.textTertiary} />
            </Pressable>
          )}
        </Animated.View>

        {/* Status rail */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(350)}
          style={{ marginTop: 14 }}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingRight: 4 }}
          >
            {statusOptions.map((opt) => {
              const selected = statusFilter === opt.value;
              return (
                <FilterPill
                  key={opt.label}
                  testID={`fleet-status-filter-${opt.value ?? "all"}`}
                  label={`${opt.label} (${countByStatus(vehicles, opt.value)})`}
                  selected={selected}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setStatusFilter(opt.value);
                  }}
                  theme={theme}
                />
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* Brand rail */}
        {brands.length > 0 && (
          <Animated.View
            entering={FadeInDown.delay(140).duration(350)}
            style={{ marginTop: 10 }}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingRight: 4 }}
            >
              <FilterPill
                testID="fleet-brand-filter-all"
                label={`${t("fleet.filter.all", "All")} (${countByBrand(vehicles, null)})`}
                selected={brandFilter === null}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setBrandFilter(null);
                }}
                theme={theme}
              />
              {brands.map((brand) => (
                <FilterPill
                  key={brand}
                  testID={`fleet-brand-filter-${brand}`}
                  label={`${brand} (${countByBrand(vehicles, brand)})`}
                  selected={brandFilter === brand}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setBrandFilter(brand);
                  }}
                  theme={theme}
                />
              ))}
            </ScrollView>
          </Animated.View>
        )}

        <View style={{ height: 14 }} />
      </View>
    ),
    [
      t,
      viewMode,
      isAdmin,
      search,
      statusFilter,
      brandFilter,
      statusOptions,
      handleToggleView,
      handleAddVehicle,
      theme,
      vehicles,
      brands,
      setStatusFilter,
      setBrandFilter,
    ],
  );

  const ListEmpty = useMemo(
    () => (
      <View className="flex-1 pt-16">
        <EmptyState
          icon={SearchX}
          title={t("fleet.noVehicles", "No vehicles found")}
          subtitle={t(
            "fleet.noVehiclesSubtitle",
            "Try adjusting your search or filters",
          )}
        />
      </View>
    ),
    [t],
  );

  // Initial loading: show skeletons matching the current view mode.
  const showSkeletons = isLoading && vehicles.length === 0;
  const skeletonCount = 6;
  const skeletonData = useMemo(
    () =>
      Array.from({ length: skeletonCount }, (_, i) => ({
        id: `__skel_${i}`,
      })) as { id: string }[],
    [skeletonCount],
  );

  const renderSkeleton = useCallback(
    () =>
      viewMode === "grid" ? (
        <View style={{ flex: 1 }}>
          <VehicleGridSkeleton theme={theme} />
        </View>
      ) : (
        <VehicleRowSkeleton theme={theme} />
      ),
    [viewMode, theme],
  );

  const contentContainerStyle = {
    paddingHorizontal: 16,
    paddingBottom: 110,
    flexGrow: 1,
  };
  const columnWrapperStyle =
    viewMode === "grid" ? { gap: 12, marginBottom: 12 } : undefined;
  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={handleRefresh}
      tintColor={theme.accent}
    />
  );

  return (
    <ScreenWrapper padded={false}>
      {showSkeletons ? (
        <FlatList<{ id: string }>
          data={skeletonData}
          renderItem={renderSkeleton}
          keyExtractor={(item) => item.id}
          numColumns={viewMode === "grid" ? 2 : 1}
          key={`skel-${viewMode}`}
          ListHeaderComponent={ListHeader}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={contentContainerStyle}
          columnWrapperStyle={columnWrapperStyle}
          refreshControl={refreshControl}
        />
      ) : (
        <FlatList<Vehicle>
          data={filtered}
          renderItem={viewMode === "grid" ? renderGridCard : renderListRow}
          keyExtractor={(item) => item.id}
          numColumns={viewMode === "grid" ? 2 : 1}
          key={viewMode}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={ListEmpty}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={contentContainerStyle}
          columnWrapperStyle={columnWrapperStyle}
          refreshControl={refreshControl}
        />
      )}
    </ScreenWrapper>
  );
}

// ── Skeleton primitives ──────────────────────────────────────────────────────

function VehicleGridSkeleton({
  theme,
}: {
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.surface,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: theme.borderLight,
        overflow: "hidden",
      }}
    >
      <Skeleton height={120} radius={0} width={"100%"} />
      <View style={{ padding: 12, gap: 6 }}>
        <Skeleton height={14} width={"70%"} />
        <Skeleton height={11} width={"45%"} />
        <Skeleton height={11} width={"55%"} />
        <Skeleton
          height={18}
          width={64}
          radius={9999}
          style={{ marginTop: 4 }}
        />
        <Skeleton height={13} width={"40%"} style={{ marginTop: 4 }} />
      </View>
    </View>
  );
}

function VehicleRowSkeleton({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: theme.borderLight,
        flexDirection: "row",
        padding: 10,
        marginBottom: 10,
        alignItems: "center",
      }}
    >
      <Skeleton width={76} height={56} radius={12} />
      <View style={{ flex: 1, marginLeft: 12, gap: 6 }}>
        <Skeleton height={14} width={"60%"} />
        <Skeleton height={12} width={"75%"} />
        <Skeleton height={11} width={"40%"} />
      </View>
      <View style={{ alignItems: "flex-end", marginLeft: 8, gap: 6 }}>
        <Skeleton height={13} width={48} />
        <Skeleton height={18} width={64} radius={9999} />
      </View>
    </View>
  );
}

// ── FilterPill ────────────────────────────────────────────────────────────────

interface FilterPillProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
  testID?: string;
}

function FilterPill({ label, selected, onPress, theme, testID }: FilterPillProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 9999,
        backgroundColor: selected ? theme.accent : theme.surface,
        borderWidth: 1,
        borderColor: selected ? theme.accent : theme.borderLight,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <Text
        variant="labelSmall"
        color={selected ? "#FFFFFF" : theme.textSecondary}
        style={{ fontFamily: fontFamilies.semiBold, fontSize: 12 }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ── StatCell ───────────────────────────────────────────────────────────────

function StatCell({
  value,
  label,
  color,
  theme,
}: {
  value: number;
  label: string;
  color: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text
        variant="headlineMedium"
        color={color}
        style={{ fontFamily: fontFamilies.bold, fontSize: 22 }}
      >
        {value}
      </Text>
      <Text
        variant="caption"
        color={theme.textTertiary}
        style={{ fontSize: 11, marginTop: 2 }}
      >
        {label}
      </Text>
    </View>
  );
}
