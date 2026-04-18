import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Pressable,
  FlatList,
  ScrollView,
  RefreshControl,
  TextInput,
  type ListRenderItemInfo,
} from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  Car,
  Plus,
  LayoutGrid,
  List,
  ChevronRight,
  SearchX,
  Search,
  X,
} from 'lucide-react-native';

import { ScreenWrapper } from '@/components/ui/ScreenWrapper';
import { Text } from '@/components/ui/Text';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores/useAuthStore';
import { mockVehicles } from '@/data/vehicles';
import { getVehicleImage } from '@/data/vehicleImages';
import { matchesVehicleQuery } from '@/utils/vehicleSearch';
import { fontFamilies } from '@/theme/typography';
import type { Vehicle, VehicleStatus, VehicleBrand } from '@/types/vehicle';

// ── Helpers ──────────────────────────────────────────────────────────────────

const ALL_BRANDS = Array.from(
  new Set(mockVehicles.map((v) => v.brand)),
).sort() as VehicleBrand[];

function countByStatus(status: VehicleStatus | null): number {
  if (status === null) return mockVehicles.length;
  return mockVehicles.filter((v) => v.status === status).length;
}

function countByBrand(brand: VehicleBrand | null): number {
  if (brand === null) return mockVehicles.length;
  return mockVehicles.filter((v) => v.brand === brand).length;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function FleetScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const params = useLocalSearchParams<{ status?: string }>();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | null>(null);
  const [brandFilter, setBrandFilter] = useState<VehicleBrand | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const valid: VehicleStatus[] = ['available', 'rented', 'maintenance', 'reserved'];
    if (params.status && (valid as string[]).includes(params.status)) {
      setStatusFilter(params.status as VehicleStatus);
    }
  }, [params.status]);

  const filtered = useMemo(() => {
    return mockVehicles.filter((v) => {
      if (statusFilter && v.status !== statusFilter) return false;
      if (brandFilter && v.brand !== brandFilter) return false;
      return matchesVehicleQuery(v, search);
    });
  }, [statusFilter, brandFilter, search]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const handleToggleView = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setViewMode((prev) => (prev === 'grid' ? 'list' : 'grid'));
  }, []);

  const handleAddVehicle = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const navigateToVehicle = useCallback(
    (id: string) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push(`/(app)/(fleet)/${id}`);
    },
    [router],
  );

  const statusOptions: { label: string; value: VehicleStatus | null }[] = useMemo(
    () => [
      { label: t('fleet.filter.all', 'All'), value: null },
      { label: t('fleet.filter.available', 'Available'), value: 'available' },
      { label: t('fleet.filter.rented', 'Rented'), value: 'rented' },
      { label: t('fleet.filter.maintenance', 'Maintenance'), value: 'maintenance' },
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
          onPress={() => navigateToVehicle(item.id)}
          style={({ pressed }) => ({
            backgroundColor: theme.surface,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: theme.borderLight,
            overflow: 'hidden',
            transform: [{ scale: pressed ? 0.98 : 1 }],
          })}
        >
          <View
            style={{
              height: 120,
              backgroundColor: theme.surfaceTertiary,
            }}
          >
            {getVehicleImage(item.id) ? (
              <Image
                source={getVehicleImage(item.id)!}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View className="flex-1 items-center justify-center">
                <Car size={32} color={theme.textTertiary} strokeWidth={1.4} />
              </View>
            )}
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
              {'\u20AC'}{item.dailyRate}
              <Text
                variant="caption"
                color={theme.textTertiary}
                style={{ fontFamily: fontFamilies.medium, fontSize: 10 }}
              >
                {' '}/ {t('bookings.detail.perDay', 'day')}
              </Text>
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    ),
    [navigateToVehicle, theme, t],
  );

  // ── List Row ───────────────────────────────────────────────────────────────

  const renderListRow = useCallback(
    ({ item, index }: ListRenderItemInfo<Vehicle>) => (
      <Animated.View entering={FadeInDown.delay(index * 30).duration(300)}>
        <Pressable
          onPress={() => navigateToVehicle(item.id)}
          style={({ pressed }) => ({
            backgroundColor: theme.surface,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: theme.borderLight,
            flexDirection: 'row',
            padding: 10,
            marginBottom: 10,
            alignItems: 'center',
            transform: [{ scale: pressed ? 0.99 : 1 }],
          })}
        >
          <View
            style={{
              width: 76,
              height: 56,
              borderRadius: 12,
              backgroundColor: theme.surfaceTertiary,
              overflow: 'hidden',
            }}
          >
            {getVehicleImage(item.id) ? (
              <Image
                source={getVehicleImage(item.id)!}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View className="flex-1 items-center justify-center">
                <Car size={22} color={theme.textTertiary} strokeWidth={1.5} />
              </View>
            )}
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
              {item.brand} {'\u00B7'} {item.category}
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

          <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
            <Text
              variant="bodySmall"
              color={theme.accent}
              style={{ fontFamily: fontFamilies.bold, fontSize: 13 }}
            >
              {'\u20AC'}{item.dailyRate}
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
    [navigateToVehicle, theme],
  );

  const keyExtractor = useCallback((item: Vehicle) => item.id, []);

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
              {t('fleet.title', 'Flotte')}
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
                {mockVehicles.length}
              </Text>
            </View>
          </View>

          <View className="flex-row" style={{ gap: 8 }}>
            <Pressable
              onPress={handleToggleView}
              hitSlop={8}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.borderLight,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {viewMode === 'grid' ? (
                <List size={18} color={theme.textPrimary} strokeWidth={2} />
              ) : (
                <LayoutGrid size={18} color={theme.textPrimary} strokeWidth={2} />
              )}
            </Pressable>
            {isAdmin && (
              <Pressable
                onPress={handleAddVehicle}
                hitSlop={8}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: theme.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Plus size={18} color="#FFFFFF" strokeWidth={2.4} />
              </Pressable>
            )}
          </View>
        </Animated.View>

        {/* Search pill */}
        <Animated.View
          entering={FadeInDown.delay(60).duration(350)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
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
              'fleet.searchPlaceholder',
              'Search by name, model or plate',
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
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
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
                  label={`${opt.label} (${countByStatus(opt.value)})`}
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
              label={`${t('fleet.filter.all', 'All')} (${countByBrand(null)})`}
              selected={brandFilter === null}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setBrandFilter(null);
              }}
              theme={theme}
            />
            {ALL_BRANDS.map((brand) => (
              <FilterPill
                key={brand}
                label={`${brand} (${countByBrand(brand)})`}
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
    ],
  );

  const ListEmpty = useMemo(
    () => (
      <View className="flex-1 pt-16">
        <EmptyState
          icon={SearchX}
          title={t('fleet.noVehicles', 'No vehicles found')}
          subtitle={t(
            'fleet.noVehiclesSubtitle',
            'Try adjusting your search or filters',
          )}
        />
      </View>
    ),
    [t],
  );

  return (
    <ScreenWrapper padded={false}>
      <FlatList
        data={filtered}
        renderItem={viewMode === 'grid' ? renderGridCard : renderListRow}
        keyExtractor={keyExtractor}
        numColumns={viewMode === 'grid' ? 2 : 1}
        key={viewMode}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 110,
          flexGrow: 1,
        }}
        columnWrapperStyle={
          viewMode === 'grid' ? { gap: 12, marginBottom: 12 } : undefined
        }
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

// ── FilterPill ────────────────────────────────────────────────────────────────

interface FilterPillProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}

function FilterPill({ label, selected, onPress, theme }: FilterPillProps) {
  return (
    <Pressable
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
        color={selected ? '#FFFFFF' : theme.textSecondary}
        style={{ fontFamily: fontFamilies.semiBold, fontSize: 12 }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
