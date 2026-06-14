import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Pressable,
  FlatList,
  RefreshControl,
  ScrollView,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { ScanLine, Plus, Camera, Search, X } from "lucide-react-native";
import { Image } from "@/components/ui/Image";

import { useQueryClient } from "@tanstack/react-query";

import { ScreenWrapper } from "@/components/ui/ScreenWrapper";
import { Text } from "@/components/ui/Text";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useInspections, inspectionKeys } from "@/hooks/useInspections";
import { formatDate } from "@/utils/format";
import { fontFamilies } from "@/theme/typography";
import type { Inspection, InspectionType } from "@/types/inspection";

type TypeTone = { fg: string; bg: string };

function getTypeTone(
  type: InspectionType,
  theme: ReturnType<typeof useTheme>,
): TypeTone {
  switch (type) {
    case "pre-rental":
      return { fg: theme.info, bg: theme.infoSoft };
    case "post-rental":
      return { fg: theme.warning, bg: theme.warningSoft };
    case "routine":
      return { fg: theme.accent, bg: theme.accentSoft };
  }
}

function getTypeLabel(
  type: InspectionType,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  switch (type) {
    case "pre-rental":
      return t("inspections.preRental", "Pre-rental");
    case "post-rental":
      return t("inspections.postRental", "Post-rental");
    case "routine":
      return t("inspections.routine", "Routine");
  }
}

// ── Inspection card ──────────────────────────────────────────────────────────

interface InspectionCardProps {
  inspection: Inspection;
  index: number;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
  t: ReturnType<typeof useTranslation>["t"];
}

function InspectionCard({
  inspection,
  index,
  onPress,
  theme,
  t,
}: InspectionCardProps) {
  const typeTone = getTypeTone(inspection.type, theme);
  const totalDamages =
    inspection.totalDamagesAI + inspection.totalDamagesManual;
  const thumbnailUri =
    inspection.photos.find((p) => p.url)?.url ?? inspection.photos[0]?.uri;

  const handlePress = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  const statusTone =
    inspection.status === "draft"
      ? { fg: theme.warning, bg: theme.warningSoft }
      : { fg: theme.success, bg: theme.successSoft };

  return (
    <Animated.View entering={FadeInDown.delay(index * 40).duration(350)}>
      <Pressable
        testID={`inspections-card-${inspection.id}`}
        accessibilityRole="button"
        accessibilityLabel={inspection.vehicleName}
        onPress={handlePress}
        style={({ pressed }) => ({
          backgroundColor: theme.surface,
          borderRadius: 18,
          padding: 12,
          borderWidth: 1,
          borderColor: theme.borderLight,
          flexDirection: "row",
          alignItems: "flex-start",
          transform: [{ scale: pressed ? 0.99 : 1 }],
        })}
      >
        {/* Vehicle thumbnail */}
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 14,
            overflow: "hidden",
            backgroundColor: theme.surfaceTertiary,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          {thumbnailUri ? (
            <Image
              source={{ uri: thumbnailUri }}
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
            {formatDate(inspection.date, "short")} {"\u00B7"}{" "}
            {inspection.inspectorName}
          </Text>

          {inspection.clientName != null && (
            <Text
              variant="bodySmall"
              color={theme.textTertiary}
              style={{ fontSize: 11, marginTop: 2 }}
              numberOfLines={1}
            >
              {t("inspections.client", "Client")}: {inspection.clientName}
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
                  ? t("inspections.clean", "Clean")
                  : `${totalDamages} ${t("inspections.damages", "damages")}`}
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
                {inspection.status === "draft"
                  ? t("inspections.draft", "Draft")
                  : t("inspections.completed", "Completed")}
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

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function InspectionsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<InspectionType | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const qc = useQueryClient();
  const {
    data: inspections = [],
    isLoading,
    isError,
    refetch,
  } = useInspections();

  const sortedInspections = useMemo(
    () =>
      [...inspections].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    [inspections],
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
      "pre-rental": base.filter((i) => i.type === "pre-rental").length,
      "post-rental": base.filter((i) => i.type === "post-rental").length,
      routine: base.filter((i) => i.type === "routine").length,
    };
  }, [sortedInspections, searchQuery]);

  const heroStats = useMemo(() => {
    const total = inspections.length;
    const clean = inspections.filter(
      (i) => i.totalDamagesAI + i.totalDamagesManual === 0,
    ).length;
    const issues = total - clean;
    return { total, clean, issues };
  }, [inspections]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await qc.invalidateQueries({ queryKey: inspectionKeys.all });
    } finally {
      setRefreshing(false);
    }
  }, [qc]);

  const handleCardPress = useCallback(
    (id: string) => {
      router.push({ pathname: "/(app)/(inspections)/[id]", params: { id } });
    },
    [router],
  );

  const handleNewInspection = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/(app)/(inspections)/new");
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
              {t("inspections.title", "Inspections")}
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
            testID="inspections-new-button"
            accessibilityRole="button"
            accessibilityLabel={t("inspections.new.title", "New Inspection")}
            onPress={handleNewInspection}
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
        </Animated.View>

        {/* Stats card */}
        <Animated.View
          entering={FadeInDown.delay(60).duration(400)}
          style={{
            backgroundColor: theme.surface,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: theme.borderLight,
            flexDirection: "row",
            paddingVertical: 16,
          }}
        >
          <StatCell
            value={heroStats.total}
            label={t("inspections.stats.total", "inspections")}
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
            label={t("inspections.stats.clean", "no damage")}
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
            label={t("inspections.stats.damages", "damages found")}
            color={theme.danger}
            theme={theme}
          />
        </Animated.View>

        {/* Search pill */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(400)}
          style={{
            marginTop: 14,
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
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t("inspections.search", "Search vehicle or client...")}
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
            <Pressable
              testID="inspections-search-clear-button"
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => setSearchQuery("")}
              hitSlop={8}
            >
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
              testID="inspections-filter-all"
              label={`${t("inspections.all", "All")} (${counts.all})`}
              selected={typeFilter === null}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setTypeFilter(null);
              }}
              theme={theme}
            />
            <FilterPill
              testID="inspections-filter-pre-rental"
              label={`${t("inspections.preRental", "Pre-rental")} (${counts["pre-rental"]})`}
              selected={typeFilter === "pre-rental"}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setTypeFilter((prev) =>
                  prev === "pre-rental" ? null : "pre-rental",
                );
              }}
              theme={theme}
            />
            <FilterPill
              testID="inspections-filter-post-rental"
              label={`${t("inspections.postRental", "Post-rental")} (${counts["post-rental"]})`}
              selected={typeFilter === "post-rental"}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setTypeFilter((prev) =>
                  prev === "post-rental" ? null : "post-rental",
                );
              }}
              theme={theme}
            />
            <FilterPill
              testID="inspections-filter-routine"
              label={`${t("inspections.routine", "Routine")} (${counts.routine})`}
              selected={typeFilter === "routine"}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setTypeFilter((prev) =>
                  prev === "routine" ? null : "routine",
                );
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
        title={t("inspections.emptyTitle", "No inspections found")}
        subtitle={t(
          "inspections.emptySubtitle",
          "Try adjusting your search or filters.",
        )}
        className="mt-16"
      />
    ),
    [t],
  );

  if (isLoading && inspections.length === 0) {
    return (
      <ScreenWrapper>
        {ListHeaderComponent}
        <View style={{ gap: 10, paddingTop: 4 }}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={{
                height: 92,
                borderRadius: 18,
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.borderLight,
                opacity: 0.6,
              }}
            />
          ))}
        </View>
      </ScreenWrapper>
    );
  }

  if (isError && inspections.length === 0) {
    return (
      <ScreenWrapper>
        {ListHeaderComponent}
        <View style={{ alignItems: "center", paddingTop: 32 }}>
          <EmptyState
            icon={ScanLine}
            title={t("inspections.errorTitle", "Couldn't load inspections")}
            subtitle={t(
              "inspections.errorSubtitle",
              "Check your connection and try again.",
            )}
          />
          <Pressable
            testID="inspections-error-retry-button"
            accessibilityRole="button"
            accessibilityLabel={t("common.retry", "Retry")}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              void refetch();
            }}
            style={{
              marginTop: 12,
              paddingHorizontal: 18,
              paddingVertical: 10,
              borderRadius: 9999,
              backgroundColor: theme.accent,
            }}
          >
            <Text
              variant="labelSmall"
              color="#FFFFFF"
              style={{ fontFamily: fontFamilies.semiBold, fontSize: 12 }}
            >
              {t("common.retry", "Retry")}
            </Text>
          </Pressable>
        </View>
      </ScreenWrapper>
    );
  }

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
