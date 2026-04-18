import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Pressable,
  FlatList,
  RefreshControl,
  ScrollView,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ScanLine, Plus, Camera, Search, X } from 'lucide-react-native';
import { Image } from 'expo-image';

import { ScreenWrapper } from '@/components/ui/ScreenWrapper';
import { Text } from '@/components/ui/Text';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTheme } from '@/hooks/useTheme';
import { formatDate } from '@/utils/format';
import { mockInspections } from '@/data/inspections';
import { getVehicleImage } from '@/data/vehicleImages';
import { fontFamilies } from '@/theme/typography';
import type { Inspection, InspectionType } from '@/types/inspection';

type TypeTone = { fg: string; bg: string };

function getTypeTone(
  type: InspectionType,
  theme: ReturnType<typeof useTheme>,
): TypeTone {
  switch (type) {
    case 'pre-rental':
      return { fg: theme.info, bg: theme.infoSoft };
    case 'post-rental':
      return { fg: theme.warning, bg: theme.warningSoft };
    case 'routine':
      return { fg: theme.accent, bg: theme.accentSoft };
  }
}

function getTypeLabel(
  type: InspectionType,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  switch (type) {
    case 'pre-rental':
      return t('inspections.preRental', 'Pre-rental');
    case 'post-rental':
      return t('inspections.postRental', 'Post-rental');
    case 'routine':
      return t('inspections.routine', 'Routine');
  }
}

// ── Inspection card ──────────────────────────────────────────────────────────

interface InspectionCardProps {
  inspection: Inspection;
  index: number;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
  t: ReturnType<typeof useTranslation>['t'];
}

function InspectionCard({
  inspection,
  index,
  onPress,
  theme,
  t,
}: InspectionCardProps) {
  const typeTone = getTypeTone(inspection.type, theme);
  const totalDamages = inspection.totalDamagesAI + inspection.totalDamagesManual;
  const vehicleImageUri = getVehicleImage(inspection.vehicleId);

  const handlePress = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  const statusTone = inspection.status === 'draft'
    ? { fg: theme.warning, bg: theme.warningSoft }
    : { fg: theme.success, bg: theme.successSoft };

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 40).duration(350)}
    >
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => ({
          backgroundColor: theme.surface,
          borderRadius: 18,
          padding: 12,
          borderWidth: 1,
          borderColor: theme.borderLight,
          flexDirection: 'row',
          alignItems: 'flex-start',
          transform: [{ scale: pressed ? 0.99 : 1 }],
        })}
      >
        {/* Vehicle thumbnail */}
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 14,
            overflow: 'hidden',
            backgroundColor: theme.surfaceTertiary,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
        >
          {vehicleImageUri ? (
            <Image
              source={vehicleImageUri}
              style={{ width: 64, height: 64 }}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <Camera size={22} color={theme.textTertiary} strokeWidth={1.5} />
          )}
        </View>

        <View style={{ flex: 1 }}>
          <View className="flex-row items-center justify-between">
            <Text
              variant="titleMedium"
              style={{
                flex: 1,
                marginRight: 8,
                fontFamily: fontFamilies.semiBold,
                fontSize: 14,
              }}
              numberOfLines={1}
            >
              {inspection.vehicleName}
            </Text>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 3,
                borderRadius: 9999,
                backgroundColor: typeTone.bg,
              }}
            >
              <Text
                variant="labelSmall"
                color={typeTone.fg}
                style={{
                  fontFamily: fontFamilies.semiBold,
                  fontSize: 10,
                }}
              >
                {getTypeLabel(inspection.type, t)}
              </Text>
            </View>
          </View>

          <Text
            variant="bodySmall"
            color={theme.textSecondary}
            style={{ fontSize: 12, marginTop: 3 }}
            numberOfLines={1}
          >
            {formatDate(inspection.date, 'short')} {'\u00B7'}{' '}
            {inspection.inspectorName}
          </Text>

          {inspection.clientName != null && (
            <Text
              variant="bodySmall"
              color={theme.textTertiary}
              style={{ fontSize: 11, marginTop: 2 }}
              numberOfLines={1}
            >
              {t('inspections.client', 'Client')}: {inspection.clientName}
            </Text>
          )}

          <View
            className="flex-row items-center justify-between"
            style={{ marginTop: 10 }}
          >
            <View className="flex-row items-center" style={{ gap: 6 }}>
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor:
                    totalDamages === 0 ? theme.success : theme.danger,
                }}
              />
              <Text
                variant="bodySmall"
                color={totalDamages === 0 ? theme.success : theme.danger}
                style={{
                  fontFamily: fontFamilies.semiBold,
                  fontSize: 12,
                }}
              >
                {totalDamages === 0
                  ? t('inspections.clean', 'Clean')
                  : `${totalDamages} ${t('inspections.damages', 'damages')}`}
              </Text>
            </View>

            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 3,
                borderRadius: 9999,
                backgroundColor: statusTone.bg,
              }}
            >
              <Text
                variant="labelSmall"
                color={statusTone.fg}
                style={{
                  fontFamily: fontFamilies.semiBold,
                  fontSize: 10,
                }}
              >
                {inspection.status === 'draft'
                  ? t('inspections.draft', 'Draft')
                  : t('inspections.completed', 'Completed')}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ── Filter pill ───────────────────────────────────────────────────────────────

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

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function InspectionsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<InspectionType | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const sortedInspections = useMemo(
    () =>
      [...mockInspections].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    [],
  );

  const filteredInspections = useMemo(() => {
    let result = sortedInspections;
    if (typeFilter != null) {
      result = result.filter((i) => i.type === typeFilter);
    }
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (i) =>
          i.vehicleName.toLowerCase().includes(q) ||
          (i.clientName != null && i.clientName.toLowerCase().includes(q)),
      );
    }
    return result;
  }, [sortedInspections, typeFilter, searchQuery]);

  const counts = useMemo(() => {
    const base =
      searchQuery.trim().length > 0
        ? sortedInspections.filter((i) => {
            const q = searchQuery.trim().toLowerCase();
            return (
              i.vehicleName.toLowerCase().includes(q) ||
              (i.clientName != null && i.clientName.toLowerCase().includes(q))
            );
          })
        : sortedInspections;

    return {
      all: base.length,
      'pre-rental': base.filter((i) => i.type === 'pre-rental').length,
      'post-rental': base.filter((i) => i.type === 'post-rental').length,
      routine: base.filter((i) => i.type === 'routine').length,
    };
  }, [sortedInspections, searchQuery]);

  const heroStats = useMemo(() => {
    const total = mockInspections.length;
    const clean = mockInspections.filter(
      (i) => i.totalDamagesAI + i.totalDamagesManual === 0,
    ).length;
    const issues = total - clean;
    return { total, clean, issues };
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => setRefreshing(false), 700);
  }, []);

  const handleCardPress = useCallback(
    (id: string) => {
      router.push(`/(inspections)/${id}`);
    },
    [router],
  );

  const handleNewInspection = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(inspections)/new');
  }, [router]);

  const renderItem = useCallback(
    ({ item, index }: { item: Inspection; index: number }) => (
      <InspectionCard
        inspection={item}
        index={index}
        onPress={() => handleCardPress(item.id)}
        theme={theme}
        t={t}
      />
    ),
    [handleCardPress, theme, t],
  );

  const keyExtractor = useCallback((item: Inspection) => item.id, []);

  const ListHeaderComponent = useMemo(
    () => (
      <View>
        {/* Title row */}
        <Animated.View
          entering={FadeInDown.duration(350)}
          className="flex-row items-center justify-between"
          style={{ paddingTop: 12, paddingBottom: 14 }}
        >
          <View className="flex-row items-center" style={{ gap: 10 }}>
            <Text
              variant="headlineLarge"
              style={{ fontFamily: fontFamilies.bold, fontSize: 22 }}
            >
              {t('inspections.title', 'Inspections')}
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
                {heroStats.total}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={handleNewInspection}
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
        </Animated.View>

        {/* Stats card */}
        <Animated.View
          entering={FadeInDown.delay(60).duration(400)}
          style={{
            backgroundColor: theme.surface,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: theme.borderLight,
            flexDirection: 'row',
            paddingVertical: 16,
          }}
        >
          <StatCell
            value={heroStats.total}
            label={t('inspections.stats.total', 'inspections')}
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
            value={heroStats.clean}
            label={t('inspections.stats.clean', 'no damage')}
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
            value={heroStats.issues}
            label={t('inspections.stats.damages', 'damages found')}
            color={theme.danger}
            theme={theme}
          />
        </Animated.View>

        {/* Search pill */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(400)}
          style={{
            marginTop: 14,
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
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('inspections.search', 'Search vehicle or client...')}
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
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <X size={14} color={theme.textTertiary} />
            </Pressable>
          )}
        </Animated.View>

        {/* Filter rail */}
        <Animated.View
          entering={FadeInDown.delay(140).duration(400)}
          style={{ marginTop: 12, marginBottom: 14 }}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingRight: 4 }}
          >
            <FilterPill
              label={`${t('inspections.all', 'All')} (${counts.all})`}
              selected={typeFilter === null}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setTypeFilter(null);
              }}
              theme={theme}
            />
            <FilterPill
              label={`${t('inspections.preRental', 'Pre-rental')} (${counts['pre-rental']})`}
              selected={typeFilter === 'pre-rental'}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setTypeFilter((prev) =>
                  prev === 'pre-rental' ? null : 'pre-rental',
                );
              }}
              theme={theme}
            />
            <FilterPill
              label={`${t('inspections.postRental', 'Post-rental')} (${counts['post-rental']})`}
              selected={typeFilter === 'post-rental'}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setTypeFilter((prev) =>
                  prev === 'post-rental' ? null : 'post-rental',
                );
              }}
              theme={theme}
            />
            <FilterPill
              label={`${t('inspections.routine', 'Routine')} (${counts.routine})`}
              selected={typeFilter === 'routine'}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setTypeFilter((prev) => (prev === 'routine' ? null : 'routine'));
              }}
              theme={theme}
            />
          </ScrollView>
        </Animated.View>
      </View>
    ),
    [t, counts, typeFilter, heroStats, searchQuery, theme, handleNewInspection],
  );

  const ListEmptyComponent = useMemo(
    () => (
      <EmptyState
        icon={ScanLine}
        title={t('inspections.emptyTitle', 'No inspections found')}
        subtitle={t(
          'inspections.emptySubtitle',
          'Try adjusting your search or filters.',
        )}
        className="mt-16"
      />
    ),
    [t],
  );

  return (
    <ScreenWrapper>
      <FlatList
        data={filteredInspections}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: 32,
          gap: 10,
        }}
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

// ── StatCell ──────────────────────────────────────────────────────────────────

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
    <View style={{ flex: 1, alignItems: 'center' }}>
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
