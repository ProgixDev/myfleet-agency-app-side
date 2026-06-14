import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, View, type ListRenderItem } from "react-native";
import { Image } from "@/components/ui/Image";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CalendarPlus,
  Car,
  CheckCircle2,
  ChevronRight,
  Clock,
  ScanLine,
  Search,
  UserPlus,
} from "lucide-react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import type { LucideIcon } from "lucide-react-native";

import { ScreenWrapper } from "@/components/ui/ScreenWrapper";
import { Text } from "@/components/ui/Text";
import { Avatar } from "@/components/ui/Avatar";
import { FabMenu } from "@/components/ui/FabMenu";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/stores/useAuthStore";
import { fleetKeys, useFleetStats, useVehicles } from "@/hooks/useFleet";
import {
  bookingKeys,
  useActiveRentals,
  useBookingConflicts,
  useUpcomingReturns,
} from "@/hooks/useBookings";
import { fontFamilies } from "@/theme/typography";
import { getVehicleImage } from "@/data/vehicleImages";
import type { Booking } from "@/types/booking";

interface ActiveRental {
  id: string;
  bookingId: string;
  vehicle: { id: string; name: string; licensePlate: string };
  client: { firstName: string; lastName: string };
  returnDate: string;
}

interface UpcomingReturn {
  id: string;
  bookingId: string;
  vehicle: { id: string; name: string };
  client: { firstName: string; lastName: string };
  returnTime: string;
}

function splitName(full: string): { firstName: string; lastName: string } {
  const trimmed = (full ?? "").trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getGreetingKey(): string {
  const h = new Date().getHours();
  if (h < 12) return "dashboard.greeting.morning";
  if (h < 18) return "dashboard.greeting.afternoon";
  return "dashboard.greeting.evening";
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function countOverdue(active: Booking[]): number {
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const nowHHmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return active.filter((b) => {
    if (!b.endDate) return false;
    if (b.endDate < todayIso) return true;
    return b.endDate === todayIso && (b.returnTime ?? "23:59") < nowHHmm;
  }).length;
}

// ── Screen ──────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data: fleetStatsData } = useFleetStats();
  const { data: vehicles = [] } = useVehicles();
  const { data: activeBookings = [] } = useActiveRentals();
  const { data: returnBookings = [] } = useUpcomingReturns();
  const { data: conflicts = [] } = useBookingConflicts();

  const fleetStats = fleetStatsData ?? {
    total: 0,
    rented: 0,
    available: 0,
    maintenance: 0,
  };
  const conflictCount = conflicts.length;

  const vehicleById = useMemo(() => {
    const map = new Map<string, { licensePlate: string }>();
    for (const v of vehicles) {
      map.set(v.id, { licensePlate: v.licensePlate ?? "" });
    }
    return map;
  }, [vehicles]);

  const activeRentals: ActiveRental[] = useMemo(
    () =>
      activeBookings.map((b) => {
        const name = splitName(b.clientName ?? "");
        return {
          id: b.id,
          bookingId: b.id,
          vehicle: {
            id: b.vehicleId,
            name: b.vehicleName ?? "",
            licensePlate: vehicleById.get(b.vehicleId)?.licensePlate ?? "",
          },
          client: name,
          returnDate: b.endDate ?? "",
        };
      }),
    [activeBookings, vehicleById],
  );

  const upcomingReturns: UpcomingReturn[] = useMemo(
    () =>
      returnBookings.map((b) => {
        const name = splitName(b.clientName ?? "");
        return {
          id: b.id,
          bookingId: b.id,
          vehicle: { id: b.vehicleId, name: b.vehicleName ?? "" },
          client: name,
          returnTime: b.returnTime ?? "",
        };
      }),
    [returnBookings],
  );

  const dateStr = useMemo(getFormattedDate, []);
  const overdueCount = useMemo(
    () => countOverdue(activeBookings),
    [activeBookings],
  );
  const returnsToday = upcomingReturns.length;

  const total = fleetStats.total || 1;
  const rentedPct = (fleetStats.rented / total) * 100;
  const availablePct = (fleetStats.available / total) * 100;
  const maintenancePct = (fleetStats.maintenance / total) * 100;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: fleetKeys.all }),
        queryClient.invalidateQueries({ queryKey: bookingKeys.all }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  // ── Callbacks ──────────────────────────────────────────────

  const handleProfilePress = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/(app)/(more)/settings/profile");
  }, [router]);

  const handleNotificationsPress = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/(app)/(more)/notifications");
  }, [router]);

  const handleSearchPress = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/(app)/(bookings)");
  }, [router]);

  const handleFleetPress = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/(app)/(home)/statistics");
  }, [router]);

  const handleActionNewInspection = useCallback(() => {
    router.push("/(app)/(inspections)/new");
  }, [router]);

  const handleActionNewBooking = useCallback(() => {
    router.push("/(app)/(bookings)/new");
  }, [router]);

  const handleActionNewClient = useCallback(() => {
    router.push("/(app)/(more)/clients/new");
  }, [router]);

  const handleReturnPress = useCallback(
    (bookingId: string) => {
      router.push({
        pathname: "/(app)/(bookings)/[id]",
        params: { id: bookingId },
      });
    },
    [router],
  );

  const handleRentalPress = useCallback(
    (bookingId: string) => {
      router.push({
        pathname: "/(app)/(bookings)/[id]",
        params: { id: bookingId },
      });
    },
    [router],
  );

  const renderRentalItem: ListRenderItem<ActiveRental> = useCallback(
    ({ item }) => (
      <RentalCard
        rental={item}
        theme={theme}
        onPress={() => handleRentalPress(item.bookingId)}
      />
    ),
    [theme, handleRentalPress],
  );

  const rentalKeyExtractor = useCallback((item: ActiveRental) => item.id, []);

  // ── Focus card ─────────────────────────────────────────────
  const focus = useMemo(() => {
    if (conflictCount > 0) {
      return {
        tone: "danger" as const,
        label: "Conflits de réservation",
        headline: `${conflictCount}`,
        sub:
          conflictCount === 1
            ? "Une double-réservation à résoudre"
            : "Double-réservations à résoudre",
        route: "/(app)/(bookings)?filter=conflict",
      };
    }
    if (overdueCount > 0) {
      return {
        tone: "warning" as const,
        label: "Retours en retard",
        headline: `${overdueCount}`,
        sub:
          overdueCount === 1
            ? "Un véhicule devait rentrer aujourd'hui"
            : "Véhicules en attente de retour",
        route: "/(app)/(bookings)?filter=active",
      };
    }
    if (returnsToday > 0) {
      return {
        tone: "accent" as const,
        label: "Votre journée",
        headline: `${returnsToday}`,
        sub:
          returnsToday === 1
            ? "Retour prévu aujourd'hui"
            : "Retours prévus aujourd'hui",
        route: "/(app)/(bookings)?filter=active",
      };
    }
    return {
      tone: "success" as const,
      label: "Votre journée",
      headline: "✓",
      sub: "Aucun retour ni alerte · tout va bien",
      route: "/(app)/(bookings)",
    };
  }, [conflictCount, overdueCount, returnsToday]);

  return (
    <>
      <ScreenWrapper
        scroll
        refreshing={refreshing}
        onRefresh={onRefresh}
        padded={false}
      >
        {/* ═══ Top bar ═══════════════════════════════════════════ */}
        <Animated.View
          entering={FadeInDown.duration(350)}
          className="px-5 pt-2 pb-5"
        >
          <View className="flex-row items-center justify-between">
            <View
              className="flex-row items-center"
              style={{ gap: 12, flex: 1 }}
            >
              <Pressable
                onPress={handleProfilePress}
                testID="home-profile-button"
                accessibilityRole="button"
                accessibilityLabel="Profil"
              >
                <Avatar
                  name={user?.name ?? "U"}
                  source={user?.avatar}
                  size="md"
                />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text
                  variant="bodySmall"
                  color={theme.textTertiary}
                  style={{ fontSize: 11, textTransform: "capitalize" }}
                  numberOfLines={1}
                >
                  {dateStr}
                </Text>
                <Text
                  variant="titleLarge"
                  style={{
                    fontFamily: fontFamilies.bold,
                    fontSize: 18,
                    lineHeight: 22,
                    marginTop: 1,
                  }}
                  numberOfLines={1}
                >
                  {t(getGreetingKey())}, {user?.name?.split(" ")[0] ?? "User"}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={handleNotificationsPress}
              testID="home-notifications-button"
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.borderLight,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Bell size={18} color={theme.textSecondary} strokeWidth={1.8} />
              <View
                style={{
                  position: "absolute",
                  top: 9,
                  right: 11,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: theme.danger,
                  borderWidth: 1.5,
                  borderColor: theme.background,
                }}
              />
            </Pressable>
          </View>
        </Animated.View>

        {/* ═══ Hero focus card ═══════════════════════════════════ */}
        <Animated.View
          entering={FadeInDown.delay(60).duration(350)}
          className="px-5"
        >
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push(focus.route as never);
            }}
            testID="home-focus-card"
            accessibilityRole="button"
            style={({ pressed }) => ({
              borderRadius: 28,
              overflow: "hidden",
              transform: [{ scale: pressed ? 0.99 : 1 }],
              shadowColor: focus.tone === "accent" ? theme.accent : "#000",
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: focus.tone === "accent" ? 0.22 : 0.08,
              shadowRadius: 20,
              elevation: 6,
            })}
          >
            <FocusGradient tone={focus.tone} theme={theme} />
            <View style={{ padding: 22 }}>
              <View
                style={{
                  alignSelf: "flex-start",
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 9999,
                  backgroundColor: "rgba(255, 255, 255, 0.18)",
                }}
              >
                <Text
                  variant="labelSmall"
                  style={{
                    fontFamily: fontFamilies.semiBold,
                    fontSize: 10,
                    color: "#FFFFFF",
                    letterSpacing: 1,
                    textTransform: "uppercase",
                  }}
                >
                  {focus.label}
                </Text>
              </View>
              <View className="flex-row items-end mt-3" style={{ gap: 10 }}>
                <Text
                  style={{
                    fontFamily: fontFamilies.bold,
                    fontSize: 56,
                    lineHeight: 58,
                    color: "#FFFFFF",
                    letterSpacing: -2,
                  }}
                >
                  {focus.headline}
                </Text>
              </View>
              <Text
                variant="bodyMedium"
                style={{
                  color: "rgba(255, 255, 255, 0.9)",
                  marginTop: 6,
                  maxWidth: "85%",
                }}
              >
                {focus.sub}
              </Text>
              <View
                style={{
                  position: "absolute",
                  right: 18,
                  bottom: 18,
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: "rgba(255, 255, 255, 0.22)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ChevronRight size={20} color="#FFFFFF" strokeWidth={2.2} />
              </View>
            </View>
          </Pressable>
        </Animated.View>

        {/* ═══ Search pill ═══════════════════════════════════════ */}
        <Animated.View
          entering={FadeInDown.delay(120).duration(350)}
          className="px-5 mt-4"
        >
          <Pressable
            onPress={handleSearchPress}
            testID="home-search-pill"
            accessibilityRole="button"
            accessibilityLabel="Rechercher une réservation, client…"
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderRadius: 9999,
              backgroundColor: theme.surface,
              borderWidth: 1,
              borderColor: theme.borderLight,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Search size={18} color={theme.textTertiary} strokeWidth={2} />
            <Text
              variant="bodyMedium"
              color={theme.textTertiary}
              style={{ flex: 1, fontSize: 14 }}
            >
              Rechercher une réservation, client…
            </Text>
          </Pressable>
        </Animated.View>

        {/* ═══ Fleet pulse ═══════════════════════════════════════ */}
        <Animated.View
          entering={FadeInDown.delay(180).duration(350)}
          className="px-5 mt-4"
        >
          <Pressable
            onPress={handleFleetPress}
            testID="home-fleet-pulse-button"
            accessibilityRole="button"
            style={({ pressed }) => ({
              backgroundColor: theme.surface,
              borderRadius: 22,
              padding: 18,
              borderWidth: 1,
              borderColor: theme.borderLight,
              transform: [{ scale: pressed ? 0.99 : 1 }],
            })}
          >
            <View className="flex-row items-center justify-between mb-3">
              <View>
                <Text
                  variant="bodySmall"
                  color={theme.textTertiary}
                  style={{ fontSize: 11 }}
                >
                  Votre flotte
                </Text>
                <Text
                  variant="headlineSmall"
                  style={{
                    fontFamily: fontFamilies.bold,
                    fontSize: 22,
                    marginTop: 2,
                  }}
                >
                  {fleetStats.total} véhicules
                </Text>
              </View>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: theme.surfaceTertiary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ChevronRight
                  size={16}
                  color={theme.textSecondary}
                  strokeWidth={2}
                />
              </View>
            </View>

            <View
              style={{
                flexDirection: "row",
                height: 10,
                borderRadius: 5,
                overflow: "hidden",
                marginBottom: 12,
                backgroundColor: theme.surfaceTertiary,
              }}
            >
              <View
                style={{ flex: rentedPct, backgroundColor: theme.success }}
              />
              <View
                style={{ flex: availablePct, backgroundColor: theme.info }}
              />
              <View
                style={{ flex: maintenancePct, backgroundColor: theme.warning }}
              />
            </View>

            <View className="flex-row" style={{ gap: 8 }}>
              <LegendChip
                dot={theme.success}
                label={`${fleetStats.rented} loc.`}
                theme={theme}
              />
              <LegendChip
                dot={theme.info}
                label={`${fleetStats.available} dispo.`}
                theme={theme}
              />
              <LegendChip
                dot={theme.warning}
                label={`${fleetStats.maintenance} répar.`}
                theme={theme}
              />
            </View>
          </Pressable>
        </Animated.View>

        {/* ═══ Quick actions ═══════════════════════════════════ */}
        <Animated.View
          entering={FadeInDown.delay(240).duration(350)}
          className="mt-5"
        >
          <View
            style={{
              flexDirection: "row",
              paddingHorizontal: 20,
              gap: 10,
            }}
          >
            <QuickAction
              icon={ScanLine}
              label="Inspection"
              theme={theme}
              onPress={handleActionNewInspection}
            />
            <QuickAction
              icon={CalendarPlus}
              label="Réservation"
              theme={theme}
              onPress={handleActionNewBooking}
            />
            <QuickAction
              icon={UserPlus}
              label="Client"
              theme={theme}
              onPress={handleActionNewClient}
            />
          </View>
        </Animated.View>

        {/* ═══ Returns today ═════════════════════════════════════ */}
        <Animated.View
          entering={FadeInDown.delay(300).duration(350)}
          className="mt-6"
        >
          <View className="flex-row items-end justify-between px-5 mb-3">
            <Text
              variant="titleMedium"
              style={{ fontFamily: fontFamilies.bold, fontSize: 16 }}
            >
              Retours aujourd&apos;hui
            </Text>
            {upcomingReturns.length > 0 && (
              <Text
                variant="bodySmall"
                color={theme.textTertiary}
                style={{ fontSize: 12 }}
              >
                {upcomingReturns.length} prévus
              </Text>
            )}
          </View>
          <View className="px-5">
            {upcomingReturns.length === 0 ? (
              <View
                style={{
                  backgroundColor: theme.surface,
                  borderRadius: 20,
                  padding: 20,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: theme.borderLight,
                }}
              >
                <CheckCircle2
                  size={24}
                  color={theme.success}
                  strokeWidth={1.8}
                />
                <Text
                  variant="bodyMedium"
                  color={theme.textSecondary}
                  style={{ marginTop: 8 }}
                >
                  Aucun retour prévu aujourd&apos;hui
                </Text>
              </View>
            ) : (
              upcomingReturns
                .slice(0, 4)
                .map((ret, idx) => (
                  <ReturnRow
                    key={ret.id}
                    item={ret}
                    isLast={idx === Math.min(upcomingReturns.length, 4) - 1}
                    theme={theme}
                    onPress={() => handleReturnPress(ret.bookingId)}
                  />
                ))
            )}
          </View>
        </Animated.View>

        {/* ═══ Active rentals carousel ═══════════════════════════ */}
        <Animated.View
          entering={FadeInDown.delay(360).duration(350)}
          className="mt-6"
        >
          <View className="flex-row items-end justify-between px-5 mb-3">
            <Text
              variant="titleMedium"
              style={{ fontFamily: fontFamilies.bold, fontSize: 16 }}
            >
              Locations actives
            </Text>
            <Pressable
              onPress={() => router.push("/(app)/(bookings)?filter=active")}
              testID="home-active-rentals-see-all"
              accessibilityRole="button"
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 2,
                paddingVertical: 3,
                paddingHorizontal: 8,
                borderRadius: 9999,
                backgroundColor: pressed ? theme.accentSoft : "transparent",
              })}
            >
              <Text
                variant="bodySmall"
                color={theme.accent}
                style={{ fontFamily: fontFamilies.semiBold, fontSize: 12 }}
              >
                Voir tout
              </Text>
              <ChevronRight size={13} color={theme.accent} strokeWidth={2.2} />
            </Pressable>
          </View>
          <FlatList
            horizontal
            data={activeRentals}
            renderItem={renderRentalItem}
            keyExtractor={rentalKeyExtractor}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 20,
              gap: 12,
              paddingBottom: 2,
            }}
            initialNumToRender={3}
            maxToRenderPerBatch={3}
            windowSize={5}
            removeClippedSubviews={true}
          />
        </Animated.View>
      </ScreenWrapper>

      <FabMenu />
    </>
  );
}

// ── Subcomponents ──────────────────────────────────────────────────────────

const FocusGradient = React.memo(function FocusGradient({
  tone,
  theme,
}: {
  tone: "accent" | "danger" | "warning" | "success";
  theme: ReturnType<typeof useTheme>;
}) {
  const colors: Record<typeof tone, [string, string]> = {
    accent: ["#7C3AED", "#A855F7"],
    danger: ["#DC2626", "#EF4444"],
    warning: ["#D97706", "#F59E0B"],
    success: ["#059669", "#10B981"],
  };
  return (
    <LinearGradient
      colors={colors[tone]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
    />
  );
});

const LegendChip = React.memo(function LegendChip({
  dot,
  label,
  theme,
}: {
  dot: string;
  label: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 9999,
        backgroundColor: theme.surfaceTertiary,
      }}
    >
      <View
        style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dot }}
      />
      <Text
        variant="labelSmall"
        color={theme.textSecondary}
        style={{ fontFamily: fontFamilies.medium, fontSize: 11 }}
      >
        {label}
      </Text>
    </View>
  );
});

interface QuickActionProps {
  icon: LucideIcon;
  label: string;
  theme: ReturnType<typeof useTheme>;
  onPress: () => void;
}

const QuickAction = React.memo(function QuickAction({
  icon: Icon,
  label,
  theme,
  onPress,
}: QuickActionProps) {
  return (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      testID={`home-quick-action-${label.toLowerCase()}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1,
        paddingVertical: 14,
        paddingHorizontal: 10,
        borderRadius: 18,
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.borderLight,
        alignItems: "center",
        gap: 8,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 12,
          backgroundColor: theme.accentSoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={17} color={theme.accent} strokeWidth={2} />
      </View>
      <Text
        variant="labelSmall"
        style={{
          fontFamily: fontFamilies.semiBold,
          fontSize: 12,
          color: theme.textPrimary,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
});

interface ReturnRowProps {
  item: UpcomingReturn;
  isLast: boolean;
  theme: ReturnType<typeof useTheme>;
  onPress: () => void;
}

const ReturnRow = React.memo(function ReturnRow({
  item,
  isLast,
  theme,
  onPress,
}: ReturnRowProps) {
  const imageSource = getVehicleImage(item.vehicle.id);

  return (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      testID={`home-return-row-${item.id}`}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: theme.surface,
        borderRadius: 18,
        padding: 12,
        marginBottom: isLast ? 0 : 8,
        borderWidth: 1,
        borderColor: theme.borderLight,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 14,
          backgroundColor: theme.surfaceTertiary,
          overflow: "hidden",
          marginRight: 12,
        }}
      >
        {imageSource ? (
          <Image
            source={imageSource}
            style={{ width: 42, height: 42 }}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Car size={18} color={theme.textSecondary} strokeWidth={1.5} />
          </View>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          variant="bodyMedium"
          numberOfLines={1}
          style={{ fontFamily: fontFamilies.semiBold, fontSize: 14 }}
        >
          {item.vehicle.name}
        </Text>
        <Text
          variant="caption"
          color={theme.textTertiary}
          style={{ fontSize: 11, marginTop: 1 }}
          numberOfLines={1}
        >
          {item.client.firstName} {item.client.lastName}
        </Text>
      </View>
      <View className="flex-row items-center" style={{ gap: 6 }}>
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 9999,
            backgroundColor: theme.accentSoft,
          }}
        >
          <Text
            variant="labelSmall"
            color={theme.accent}
            style={{
              fontFamily: fontFamilies.semiBold,
              fontSize: 11,
            }}
          >
            {item.returnTime}
          </Text>
        </View>
        <Clock size={14} color={theme.textTertiary} strokeWidth={1.8} />
      </View>
    </Pressable>
  );
});

interface RentalCardProps {
  rental: ActiveRental;
  theme: ReturnType<typeof useTheme>;
  onPress: () => void;
}

const RentalCard = React.memo(function RentalCard({
  rental,
  theme,
  onPress,
}: RentalCardProps) {
  const imageSource = getVehicleImage(rental.vehicle.id);

  return (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      testID={`home-rental-card-${rental.id}`}
      accessibilityRole="button"
      style={({ pressed }) => ({
        width: 260,
        backgroundColor: theme.surface,
        borderRadius: 22,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: theme.borderLight,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <View
        style={{
          height: 140,
          backgroundColor: theme.surfaceTertiary,
          overflow: "hidden",
        }}
      >
        {imageSource ? (
          <Image
            source={imageSource}
            style={{ width: "100%", height: 140 }}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Car size={32} color={theme.textTertiary} strokeWidth={1.2} />
          </View>
        )}
        <View
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 9999,
            backgroundColor: "rgba(0, 0, 0, 0.45)",
          }}
        >
          <Text
            variant="labelSmall"
            color="#FFFFFF"
            style={{ fontFamily: fontFamilies.semiBold, fontSize: 10 }}
            numberOfLines={1}
          >
            {rental.vehicle.licensePlate}
          </Text>
        </View>
      </View>
      <View style={{ padding: 14 }}>
        <Text
          variant="titleMedium"
          numberOfLines={1}
          style={{ fontFamily: fontFamilies.bold, fontSize: 15 }}
        >
          {rental.vehicle.name}
        </Text>
        <View className="flex-row items-center mt-1" style={{ gap: 6 }}>
          <Avatar
            name={`${rental.client.firstName} ${rental.client.lastName}`}
            size="sm"
          />
          <Text
            variant="caption"
            color={theme.textSecondary}
            style={{ fontSize: 12, flex: 1 }}
            numberOfLines={1}
          >
            {rental.client.firstName} {rental.client.lastName}
          </Text>
        </View>
        <View
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTopWidth: 0.5,
            borderTopColor: theme.border,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text
            variant="caption"
            color={theme.textTertiary}
            style={{ fontSize: 11 }}
          >
            Retour
          </Text>
          <Text
            variant="labelSmall"
            style={{
              fontFamily: fontFamilies.semiBold,
              fontSize: 12,
              color: theme.accent,
            }}
          >
            {rental.returnDate}
          </Text>
        </View>
      </View>
    </Pressable>
  );
});
