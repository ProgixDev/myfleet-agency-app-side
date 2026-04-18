import React from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Car,
  CheckCircle,
  ChevronLeft,
  CircleCheck,
  KeyRound,
  TrendingUp,
  Wrench,
} from "lucide-react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import type { LucideIcon } from "lucide-react-native";

import { ScreenWrapper } from "@/components/ui/ScreenWrapper";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/hooks/useTheme";
import { useBookingStore } from "@/stores/useBookingStore";
import { fontFamilies } from "@/theme/typography";
import { fleetStats } from "@/data/dashboard";

export default function StatisticsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const bookings = useBookingStore((s) => s.bookings);
  const active = bookings.filter((b) => b.status === "active").length;
  const upcoming = bookings.filter(
    (b) => b.status === "confirmed" || b.status === "pending",
  ).length;
  const completed = bookings.filter((b) => b.status === "completed").length;

  const total = fleetStats.total || 1;
  const rentedPct = Math.round((fleetStats.rented / total) * 100);
  const availablePct = Math.round((fleetStats.available / total) * 100);
  const maintenancePct = Math.round((fleetStats.maintenance / total) * 100);

  return (
    <ScreenWrapper scroll padded={false}>
      {/* Header */}
      <Animated.View
        entering={FadeInDown.duration(400)}
        className="flex-row items-center px-4 pt-3 pb-4"
      >
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          hitSlop={10}
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
          <ChevronLeft size={20} color={theme.textPrimary} strokeWidth={2} />
        </Pressable>
        <View style={{ marginLeft: 12 }}>
          <Text
            variant="bodySmall"
            color={theme.textTertiary}
            style={{ fontSize: 11 }}
          >
            {t("dashboard.statsScreen.subtitle")}
          </Text>
          <Text
            variant="headlineMedium"
            style={{ fontFamily: fontFamilies.bold }}
          >
            {t("dashboard.statsScreen.title")}
          </Text>
        </View>
      </Animated.View>

      {/* Fleet KPI grid (2×2) */}
      <Animated.View
        entering={FadeInDown.delay(80).duration(400)}
        className="px-4"
      >
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Tile
            icon={Car}
            value={fleetStats.total}
            label={t("dashboard.stats.totalFleet")}
            color={theme.accent}
            bg={theme.accentSoft}
            theme={theme}
            onPress={() => router.push("/(app)/(fleet)")}
          />
          <Tile
            icon={KeyRound}
            value={fleetStats.rented}
            label={t("dashboard.stats.inRental")}
            color={theme.success}
            bg={theme.successSoft}
            theme={theme}
            onPress={() =>
              router.push({
                pathname: "/(app)/(fleet)",
                params: { status: "rented" },
              })
            }
          />
        </View>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
          <Tile
            icon={CircleCheck}
            value={fleetStats.available}
            label={t("dashboard.stats.available")}
            color={theme.info}
            bg={theme.infoSoft}
            theme={theme}
            onPress={() =>
              router.push({
                pathname: "/(app)/(fleet)",
                params: { status: "available" },
              })
            }
          />
          <Tile
            icon={Wrench}
            value={fleetStats.maintenance}
            label={t("dashboard.stats.inRepair")}
            color={theme.warning}
            bg={theme.warningSoft}
            theme={theme}
            onPress={() =>
              router.push({
                pathname: "/(app)/(fleet)",
                params: { status: "maintenance" },
              })
            }
          />
        </View>
      </Animated.View>

      {/* Fleet breakdown bar */}
      <Animated.View
        entering={FadeInDown.delay(130).duration(400)}
        className="mt-5 px-4"
      >
        <Text
          variant="titleMedium"
          style={{ fontFamily: fontFamilies.semiBold, marginBottom: 10 }}
        >
          {t("dashboard.statsScreen.fleetBreakdown")}
        </Text>
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: 18,
            padding: 16,
            borderWidth: 1,
            borderColor: theme.borderLight,
          }}
        >
          {/* Stacked bar */}
          <View
            style={{
              flexDirection: "row",
              height: 10,
              borderRadius: 5,
              overflow: "hidden",
              marginBottom: 14,
            }}
          >
            <View
              style={{
                flex: fleetStats.rented,
                backgroundColor: theme.success,
              }}
            />
            <View
              style={{
                flex: fleetStats.available,
                backgroundColor: theme.info,
              }}
            />
            <View
              style={{
                flex: fleetStats.maintenance,
                backgroundColor: theme.warning,
              }}
            />
          </View>

          <LegendRow
            color={theme.success}
            label={t("dashboard.stats.inRental")}
            value={`${fleetStats.rented} · ${rentedPct}%`}
            theme={theme}
          />
          <LegendRow
            color={theme.info}
            label={t("dashboard.stats.available")}
            value={`${fleetStats.available} · ${availablePct}%`}
            theme={theme}
          />
          <LegendRow
            color={theme.warning}
            label={t("dashboard.stats.inRepair")}
            value={`${fleetStats.maintenance} · ${maintenancePct}%`}
            theme={theme}
            isLast
          />
        </View>
      </Animated.View>

      {/* Bookings snapshot */}
      <Animated.View
        entering={FadeInDown.delay(200).duration(400)}
        className="mt-5 px-4"
      >
        <View className="flex-row items-center justify-between mb-2">
          <Text
            variant="titleMedium"
            style={{ fontFamily: fontFamilies.semiBold }}
          >
            {t("dashboard.statsScreen.bookings")}
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 9999,
              backgroundColor: theme.successSoft,
            }}
          >
            <TrendingUp size={12} color={theme.success} strokeWidth={2.2} />
            <Text
              variant="labelSmall"
              color={theme.success}
              style={{ fontFamily: fontFamilies.semiBold, fontSize: 11 }}
            >
              +12%
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Tile
            icon={KeyRound}
            value={active}
            label={t("dashboard.statsScreen.bookingsActive")}
            color={theme.success}
            bg={theme.successSoft}
            theme={theme}
            onPress={() =>
              router.push({
                pathname: "/(app)/(bookings)",
                params: { filter: "active" },
              })
            }
          />
          <Tile
            icon={CircleCheck}
            value={upcoming}
            label={t("dashboard.statsScreen.bookingsUpcoming")}
            color={theme.info}
            bg={theme.infoSoft}
            theme={theme}
            onPress={() =>
              router.push({
                pathname: "/(app)/(bookings)",
                params: { filter: "upcoming" },
              })
            }
          />
          <Tile
            icon={CheckCircle}
            value={completed}
            label={t("dashboard.statsScreen.bookingsCompleted")}
            color={theme.textTertiary}
            bg={theme.surfaceTertiary}
            theme={theme}
            onPress={() =>
              router.push({
                pathname: "/(app)/(bookings)",
                params: { filter: "completed" },
              })
            }
          />
        </View>
      </Animated.View>
    </ScreenWrapper>
  );
}

interface TileProps {
  icon: LucideIcon;
  value: number;
  label: string;
  color: string;
  bg: string;
  theme: ReturnType<typeof useTheme>;
  onPress?: () => void;
}

function Tile({ icon: Icon, value, label, color, bg, theme, onPress }: TileProps) {
  return (
    <Pressable
      onPress={() => {
        if (!onPress) return;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      disabled={!onPress}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: theme.surface,
        borderRadius: 18,
        padding: 14,
        borderWidth: 1,
        borderColor: theme.borderLight,
        transform: [{ scale: pressed && onPress ? 0.97 : 1 }],
      })}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          backgroundColor: bg,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 10,
        }}
      >
        <Icon size={18} color={color} strokeWidth={2} />
      </View>
      <Text
        variant="headlineSmall"
        style={{
          fontFamily: fontFamilies.bold,
          fontSize: 22,
          lineHeight: 26,
          color: theme.textPrimary,
        }}
      >
        {value}
      </Text>
      <Text
        variant="caption"
        color={theme.textSecondary}
        style={{ fontSize: 11, marginTop: 2 }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

interface LegendRowProps {
  color: string;
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>;
  isLast?: boolean;
}

function LegendRow({ color, label, value, theme, isLast }: LegendRowProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 8,
        borderBottomWidth: isLast ? 0 : 0.5,
        borderBottomColor: theme.border,
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: color,
          marginRight: 10,
        }}
      />
      <Text variant="bodySmall" style={{ flex: 1 }} color={theme.textSecondary}>
        {label}
      </Text>
      <Text
        variant="labelSmall"
        style={{
          fontFamily: fontFamilies.semiBold,
          fontSize: 12,
          color: theme.textPrimary,
        }}
      >
        {value}
      </Text>
    </View>
  );
}
