import React, { useMemo, useState } from "react";
import {
  Dimensions,
  FlatList,
  View,
  Pressable,
  ScrollView,
} from "react-native";
import { Image } from "@/components/ui/Image";
import { LinearGradient } from "expo-linear-gradient";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import { useRouter, useLocalSearchParams } from "expo-router";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  ChevronLeft,
  ChevronRight,
  Car,
  Users,
  Cog,
  Fuel,
  CheckCircle,
  FileText,
  ClipboardList,
  ImageIcon,
  Film,
  ClipboardCheck,
  Pencil,
} from "lucide-react-native";

import { Text } from "@/components/ui/Text";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { VideoPlayer } from "@/components/vehicle/VideoPlayer";
import { useAuthStore } from "@/stores/useAuthStore";
import { useTheme } from "@/hooks/useTheme";
import { useVehicle } from "@/hooks/useFleet";
import { useAgency } from "@/hooks/useAgency";
import { fontFamilies } from "@/theme/typography";
import type { Vehicle, FuelType, DamageRecord } from "@/types/vehicle";
import { formatCurrency } from "@/utils/format";

type TabKey = "overview" | "damages" | "rentals" | "documents";
type MediaTab = "photos" | "video";

const SCREEN_WIDTH = Dimensions.get("window").width;
const HERO_HEIGHT = Math.round(SCREEN_WIDTH * 0.75);

function formatMileage(km: number): string {
  return km.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " km";
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function fuelLabel(fuel: FuelType): string {
  const map: Record<FuelType, string> = {
    gasoline: "Essence",
    diesel: "Diesel",
    electric: "Electric",
    hybrid: "Hybrid",
    "plug-in-hybrid": "Plug-in Hybrid",
  };
  return map[fuel];
}

function rentalStatusVariant(
  status: string,
): "info" | "warning" | "danger" | "success" {
  switch (status) {
    case "active":
      return "success";
    case "pending":
    case "confirmed":
      return "info";
    case "completed":
      return "success";
    case "cancelled":
      return "danger";
    default:
      return "info";
  }
}

function severityVariant(
  severity: DamageRecord["severity"],
): "info" | "warning" | "danger" {
  const map: Record<DamageRecord["severity"], "info" | "warning" | "danger"> = {
    minor: "info",
    moderate: "warning",
    severe: "danger",
  };
  return map[severity];
}

function daysBetween(start: string, end: string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return Math.max(0, Math.round((e - s) / (1000 * 60 * 60 * 24)));
}

function daysSince(start: string): number {
  const s = new Date(start).getTime();
  const now = Date.now();
  return Math.max(0, Math.round((now - s) / (1000 * 60 * 60 * 24)));
}

// ── Photo Carousel ──────────────────────────────────────────────────────────

function PhotoCarousel({
  vehicle,
  theme,
  height,
}: {
  vehicle: Vehicle;
  theme: ReturnType<typeof useTheme>;
  height: number;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const images = vehicle.images ?? [];

  if (images.length > 0) {
    return (
      <View>
        <FlatList
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(
              e.nativeEvent.contentOffset.x / SCREEN_WIDTH,
            );
            setActiveIndex(idx);
          }}
          renderItem={({ item }) => (
            <Image
              source={{ uri: item.url }}
              style={{ width: SCREEN_WIDTH, height }}
              contentFit="cover"
              transition={300}
            />
          )}
          keyExtractor={(item) => item.angle}
        />
        {images.length > 1 && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              bottom: 44,
              left: 0,
              right: 0,
              flexDirection: "row",
              justifyContent: "center",
              gap: 6,
            }}
          >
            {images.map((_, i) => (
              <View
                key={i}
                style={{
                  width: i === activeIndex ? 18 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor:
                    i === activeIndex ? "#FFFFFF" : "rgba(255,255,255,0.55)",
                }}
              />
            ))}
          </View>
        )}
      </View>
    );
  }

  return (
    <View
      className="flex-1 items-center justify-center"
      style={{ height, backgroundColor: theme.surfaceTertiary }}
    >
      <Car size={56} color={theme.textTertiary} strokeWidth={1.3} />
      <Text variant="titleLarge" color={theme.textTertiary} className="mt-3">
        {vehicle.brand}
      </Text>
    </View>
  );
}

// ── Main Screen ─────────────────────────────────────────────────────────────

export default function VehicleDetailScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: vehicle, isLoading } = useVehicle(id);
  const { data: agency } = useAgency();
  const currency = agency?.currency ?? "EUR";
  const canManageFleet =
    useAuthStore((s) => s.user?.role === "admin" || s.user?.role === "employee");
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [mediaTab, setMediaTab] = useState<MediaTab>("photos");

  // Pick the rental that's actually live today, not the most recent by start
  // date — `rentalHistory` is sorted desc, so [0] could be a future booking
  // sitting alongside an active one. Hooks must run before any early return.
  const currentRental = useMemo(() => {
    if (vehicle?.status !== "rented") return null;
    const today = new Date().toISOString().slice(0, 10);
    return (
      (vehicle.rentalHistory ?? []).find(
        (r) =>
          r.status === "active" || (r.startDate <= today && today <= r.endDate),
      ) ?? null
    );
  }, [vehicle?.status, vehicle?.rentalHistory]);

  if (isLoading) {
    return (
      <VehicleDetailSkeleton
        theme={theme}
        insets={insets}
        onBack={() => router.back()}
      />
    );
  }

  if (!vehicle) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View className="flex-1 items-center justify-center px-4 py-20">
          <EmptyState
            icon={Car}
            title={t("fleet.detail.notFound", "Vehicle not found")}
            subtitle={t(
              "fleet.detail.notFoundDesc",
              "The vehicle you are looking for does not exist.",
            )}
            actionLabel={t("common.back", "Back")}
            onAction={() => router.back()}
          />
        </View>
      </SafeAreaView>
    );
  }

  const media = vehicle.media;
  const hasVideo = !!media?.hasVideo;

  const photoCount = vehicle.images?.length || media?.photos.length || 0;
  const videoCount = media?.videos.length ?? 0;
  const mediaBadgeText = hasVideo
    ? `${photoCount || 1} Photos \u00B7 ${videoCount} Video`
    : `${photoCount || 1} Photos`;

  const heroTotalHeight = HERO_HEIGHT + insets.top;

  const TABS: { key: TabKey; label: string }[] = [
    { key: "overview", label: t("fleet.detail.tabs.overview", "Overview") },
    { key: "damages", label: t("fleet.detail.tabs.damages", "Damages") },
    { key: "rentals", label: t("fleet.detail.tabs.rentals", "Rentals") },
    { key: "documents", label: t("fleet.detail.tabs.documents", "Documents") },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar style="light" />
      <ScrollView
        bounces
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}
      >
        {/* ── Hero ──────────────────────────────────────────────────── */}
        <Animated.View entering={FadeIn.duration(400)}>
          <View
            style={{
              width: SCREEN_WIDTH,
              height: heroTotalHeight,
              backgroundColor: theme.surfaceTertiary,
            }}
          >
            {mediaTab === "photos" ? (
              <PhotoCarousel
                vehicle={vehicle}
                theme={theme}
                height={heroTotalHeight}
              />
            ) : media ? (
              <VideoPlayer
                source={media.videos[0]}
                posterSource={media.thumbnail ?? undefined}
              />
            ) : null}

            {/* Top gradient for legibility under notch */}
            <LinearGradient
              colors={["rgba(0,0,0,0.45)", "rgba(0,0,0,0)"]}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: insets.top + 90,
              }}
              pointerEvents="none"
            />

            {/* Back */}
            <Pressable
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.back();
              }}
              hitSlop={10}
              style={{
                position: "absolute",
                top: insets.top + 8,
                left: 16,
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "rgba(255,255,255,0.92)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ChevronLeft size={22} color="#111" strokeWidth={2.2} />
            </Pressable>

            {/* Top-right cluster: media count pill + admin edit pencil */}
            <View
              style={{
                position: "absolute",
                top: insets.top + 8,
                right: 16,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              {canManageFleet && (
                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push(`/(app)/(fleet)/edit/${vehicle.id}` as never);
                  }}
                  hitSlop={10}
                  style={({ pressed }) => ({
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(0,0,0,0.55)",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.18)",
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <Pencil size={14} color="#FFFFFF" strokeWidth={2.2} />
                </Pressable>
              )}
              <View
                style={{
                  height: 32,
                  paddingHorizontal: 12,
                  borderRadius: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: "rgba(0,0,0,0.55)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.18)",
                }}
              >
                {hasVideo ? (
                  <Film size={13} color="#FFFFFF" strokeWidth={2.2} />
                ) : (
                  <ImageIcon size={13} color="#FFFFFF" strokeWidth={2.2} />
                )}
                <Text
                  variant="labelSmall"
                  color="#FFFFFF"
                  style={{
                    fontFamily: fontFamilies.semiBold,
                    fontSize: 12,
                    lineHeight: 14,
                  }}
                >
                  {mediaBadgeText}
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* ── Photo/Video capsule ──────────────────────────────────── */}
        {hasVideo && (
          <Animated.View
            entering={FadeInDown.duration(350).delay(60)}
            style={{ marginTop: 14, marginHorizontal: 16 }}
          >
            <View
              style={{
                flexDirection: "row",
                padding: 4,
                borderRadius: 9999,
                backgroundColor: theme.surfaceTertiary,
              }}
            >
              <MediaTabPill
                active={mediaTab === "photos"}
                icon={ImageIcon}
                label={t("fleet.detail.photos", "Photos")}
                theme={theme}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setMediaTab("photos");
                }}
              />
              <MediaTabPill
                active={mediaTab === "video"}
                icon={Film}
                label={t("fleet.detail.interiorVideo", "Interior Video")}
                theme={theme}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setMediaTab("video");
                }}
              />
            </View>
          </Animated.View>
        )}

        {/* ── Floating info card ────────────────────────────────────── */}
        <Animated.View
          entering={FadeInDown.duration(420).delay(hasVideo ? 120 : 80)}
          style={{
            marginTop: hasVideo ? 12 : -28,
            marginHorizontal: 16,
            backgroundColor: theme.surface,
            borderRadius: 24,
            padding: 18,
            borderWidth: 1,
            borderColor: theme.borderLight,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.08,
            shadowRadius: 16,
            elevation: 6,
          }}
        >
          <View className="flex-row items-start">
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text
                variant="headlineMedium"
                style={{
                  fontFamily: fontFamilies.bold,
                  fontSize: 22,
                  lineHeight: 26,
                }}
                numberOfLines={1}
              >
                {vehicle.name}
              </Text>
              <Text
                variant="bodySmall"
                color={theme.textTertiary}
                style={{ marginTop: 4, fontSize: 12 }}
                numberOfLines={1}
              >
                {vehicle.brand} {"\u00B7"} {vehicle.year}
              </Text>
              <View style={{ marginTop: 10, alignSelf: "flex-start" }}>
                <StatusBadge status={vehicle.status} size="sm" />
              </View>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text
                variant="headlineMedium"
                color={theme.accent}
                style={{
                  fontFamily: fontFamilies.bold,
                  fontSize: 20,
                  lineHeight: 24,
                }}
              >
                {formatCurrency(vehicle.dailyRate, currency)}
              </Text>
              <Text
                variant="caption"
                color={theme.textTertiary}
                style={{ fontSize: 11, marginTop: 2 }}
              >
                / {t("bookings.detail.perDay", "day")}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* ── Quick specs ──────────────────────────────────────────── */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(160)}
          style={{ marginTop: 14, marginHorizontal: 16 }}
        >
          <View className="flex-row" style={{ gap: 10 }}>
            {(
              [
                {
                  icon: Users,
                  value: String(vehicle.seats),
                  label: t("fleet.detail.seats", "Seats"),
                },
                {
                  icon: Cog,
                  value: capitalize(vehicle.transmission),
                  label: t("fleet.detail.gearbox", "Gearbox"),
                },
                {
                  icon: Fuel,
                  value: fuelLabel(vehicle.fuelType),
                  label: t("fleet.detail.fuel", "Fuel"),
                },
                {
                  icon: Car,
                  value: vehicle.category,
                  label: t("fleet.detail.type", "Type"),
                },
              ] as const
            ).map((spec) => {
              const Icon = spec.icon;
              return (
                <View
                  key={spec.label}
                  style={{
                    flex: 1,
                    backgroundColor: theme.surface,
                    borderRadius: 16,
                    paddingVertical: 12,
                    paddingHorizontal: 8,
                    borderWidth: 1,
                    borderColor: theme.borderLight,
                    alignItems: "center",
                  }}
                >
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: theme.accentSoft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon size={14} color={theme.accent} strokeWidth={2} />
                  </View>
                  <Text
                    variant="labelSmall"
                    style={{
                      fontFamily: fontFamilies.semiBold,
                      fontSize: 12,
                      marginTop: 6,
                      color: theme.textPrimary,
                    }}
                    numberOfLines={1}
                  >
                    {spec.value}
                  </Text>
                  <Text
                    variant="caption"
                    color={theme.textTertiary}
                    style={{ fontSize: 10, marginTop: 2 }}
                    numberOfLines={1}
                  >
                    {spec.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </Animated.View>

        {/* ── Action buttons ───────────────────────────────────────── */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(220)}
          style={{ marginTop: 18, marginHorizontal: 16 }}
        >
          {vehicle.status === "available" && (
            <View className="flex-row" style={{ gap: 10 }}>
              <Button
                variant="primary"
                className="flex-1"
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({
                    pathname: "/(app)/(bookings)/new",
                    params: { vehicleId: vehicle.id },
                  });
                }}
              >
                {t("fleet.detail.bookNow", "Book Now")}
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({
                    pathname: "/(app)/(inspections)/new",
                    params: { vehicleId: vehicle.id },
                  });
                }}
              >
                {t("fleet.detail.inspect", "Inspect")}
              </Button>
            </View>
          )}

          {vehicle.status === "rented" && (
            <>
              <Button variant="primary" disabled fullWidth>
                {t("fleet.detail.currentlyRented", "Currently Rented")}
              </Button>
              {currentRental && (
                <View
                  style={{
                    marginTop: 14,
                    backgroundColor: theme.surface,
                    borderRadius: 18,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: theme.borderLight,
                  }}
                >
                  <View className="flex-row items-center">
                    <Avatar name={currentRental.clientName} size="md" />
                    <View className="ml-3 flex-1">
                      <Text
                        variant="titleMedium"
                        style={{
                          fontFamily: fontFamilies.semiBold,
                          fontSize: 14,
                        }}
                      >
                        {currentRental.clientName}
                      </Text>
                      <Text
                        variant="bodySmall"
                        color={theme.textSecondary}
                        style={{ fontSize: 12, marginTop: 2 }}
                      >
                        {currentRental.startDate} {"\u2192"}{" "}
                        {currentRental.endDate}
                      </Text>
                    </View>
                  </View>
                  <View style={{ marginTop: 12 }}>
                    <ProgressBar
                      progress={Math.min(
                        1,
                        daysSince(currentRental.startDate) /
                          daysBetween(
                            currentRental.startDate,
                            currentRental.endDate,
                          ),
                      )}
                      label={`${daysSince(currentRental.startDate)} / ${daysBetween(currentRental.startDate, currentRental.endDate)} days`}
                      showPercentage
                      color={theme.accent}
                    />
                  </View>
                </View>
              )}
            </>
          )}

          {vehicle.status === "maintenance" && (
            <Button variant="danger" disabled fullWidth>
              {t("fleet.detail.inMaintenance", "In Maintenance")}
            </Button>
          )}

          {vehicle.status === "reserved" && (
            <Button variant="secondary" disabled fullWidth>
              {t("fleet.detail.reserved", "Reserved")}
            </Button>
          )}

          {vehicle.status === "retired" && (
            <Button variant="secondary" disabled fullWidth>
              {t("fleet.detail.retired", "Retired")}
            </Button>
          )}
        </Animated.View>

        {/* ── Pill tab selector ────────────────────────────────────── */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(280)}
          style={{ marginTop: 22, marginHorizontal: 16 }}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setActiveTab(tab.key);
                  }}
                  style={({ pressed }) => ({
                    paddingHorizontal: 16,
                    paddingVertical: 9,
                    borderRadius: 9999,
                    backgroundColor: isActive ? theme.accent : theme.surface,
                    borderWidth: 1,
                    borderColor: isActive ? theme.accent : theme.borderLight,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  })}
                >
                  <Text
                    variant="labelSmall"
                    color={isActive ? "#FFFFFF" : theme.textSecondary}
                    style={{
                      fontFamily: fontFamilies.semiBold,
                      fontSize: 12,
                    }}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* ── Tab content ──────────────────────────────────────────── */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(340)}
          style={{ marginTop: 14, marginHorizontal: 16 }}
        >
          {activeTab === "overview" && (
            <OverviewTab
              vehicle={vehicle}
              theme={theme}
              t={t}
              currency={currency}
            />
          )}
          {activeTab === "damages" && (
            <DamagesTab
              vehicle={vehicle}
              theme={theme}
              t={t}
              currency={currency}
            />
          )}
          {activeTab === "rentals" && (
            <RentalsTab
              vehicle={vehicle}
              theme={theme}
              t={t}
              currency={currency}
            />
          )}
          {activeTab === "documents" && <DocumentsTab t={t} />}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ── MediaTabPill ──────────────────────────────────────────────────────────────

function MediaTabPill({
  active,
  icon: Icon,
  label,
  theme,
  onPress,
}: {
  active: boolean;
  icon: React.ComponentType<{
    size?: number;
    color?: string;
    strokeWidth?: number;
  }>;
  label: string;
  theme: ReturnType<typeof useTheme>;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 9,
        borderRadius: 9999,
        backgroundColor: active ? theme.surface : "transparent",
        gap: 6,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <Icon
        size={14}
        color={active ? theme.accent : theme.textTertiary}
        strokeWidth={2}
      />
      <Text
        variant="labelSmall"
        color={active ? theme.accent : theme.textTertiary}
        style={{ fontFamily: fontFamilies.semiBold, fontSize: 12 }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({
  theme,
  children,
}: {
  theme: ReturnType<typeof useTheme>;
  children: React.ReactNode;
}) {
  return (
    <Text
      variant="bodySmall"
      color={theme.textTertiary}
      style={{
        fontFamily: fontFamilies.medium,
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: 8,
        marginLeft: 4,
      }}
    >
      {children}
    </Text>
  );
}

/* ====================================================================
   OVERVIEW TAB
   ==================================================================== */
interface TabProps {
  vehicle: Vehicle;
  theme: ReturnType<typeof useTheme>;
  t: ReturnType<typeof useTranslation>["t"];
  currency: string;
}

function OverviewTab({ vehicle, theme, t }: TabProps) {
  const specs: { label: string; value: string }[] = [
    {
      label: t("fleet.detail.licensePlate", "License Plate"),
      value: vehicle.licensePlate,
    },
    { label: t("fleet.detail.color", "Color"), value: vehicle.color },
    { label: t("fleet.detail.year", "Year"), value: String(vehicle.year) },
    {
      label: t("fleet.detail.mileage", "Mileage"),
      value: formatMileage(vehicle.mileage),
    },
    {
      label: t("fleet.detail.fuel", "Fuel"),
      value: fuelLabel(vehicle.fuelType),
    },
    {
      label: t("fleet.detail.transmission", "Transmission"),
      value: capitalize(vehicle.transmission),
    },
    { label: t("fleet.detail.seats", "Seats"), value: String(vehicle.seats) },
    { label: t("fleet.detail.category", "Category"), value: vehicle.category },
  ];

  return (
    <View>
      <View
        style={{
          backgroundColor: theme.surface,
          borderRadius: 18,
          padding: 4,
          borderWidth: 1,
          borderColor: theme.borderLight,
        }}
      >
        {specs.map((spec, index) => {
          const isLast = index === specs.length - 1;
          return (
            <View
              key={spec.label}
              className="flex-row justify-between items-center"
              style={{
                paddingVertical: 12,
                paddingHorizontal: 12,
                borderBottomWidth: isLast ? 0 : 0.5,
                borderBottomColor: theme.border,
              }}
            >
              <Text
                variant="bodySmall"
                color={theme.textSecondary}
                style={{ fontSize: 13 }}
              >
                {spec.label}
              </Text>
              <Text
                variant="bodyMedium"
                style={{
                  fontFamily: fontFamilies.semiBold,
                  fontSize: 13,
                  color: theme.textPrimary,
                }}
              >
                {spec.value}
              </Text>
            </View>
          );
        })}
      </View>

      {vehicle.features.length > 0 && (
        <View style={{ marginTop: 18 }}>
          <SectionLabel theme={theme}>
            {t("fleet.detail.features", "Features")}
          </SectionLabel>
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {vehicle.features.map((feature) => (
              <View
                key={feature}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
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
                  {feature}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

/* ====================================================================
   DAMAGES TAB
   ==================================================================== */
function DamagesTab({ vehicle, theme, t }: TabProps) {
  const router = useRouter();
  const damageRecords = vehicle.damageRecords ?? [];
  if (damageRecords.length === 0) {
    return (
      <View className="py-12">
        <EmptyState
          icon={CheckCircle}
          title={t("fleet.detail.noDamage", "No damage recorded")}
          subtitle={t(
            "fleet.detail.noDamageDesc",
            "This vehicle has no reported damages.",
          )}
        />
      </View>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      {damageRecords.map((damage) => (
        <Pressable
          key={damage.id}
          disabled={!damage.inspectionId}
          onPress={() => {
            if (!damage.inspectionId) return;
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push({
              pathname: "/(app)/(inspections)/[id]",
              params: { id: damage.inspectionId },
            });
          }}
          style={({ pressed }) => ({
            backgroundColor: theme.surface,
            borderRadius: 16,
            padding: 14,
            borderWidth: 1,
            borderColor: theme.borderLight,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <View className="flex-row items-center justify-between">
            <Text
              variant="bodySmall"
              color={theme.textTertiary}
              style={{ fontSize: 12 }}
            >
              {damage.date}
            </Text>
            <Badge variant={severityVariant(damage.severity)} size="sm">
              {capitalize(damage.severity)}
            </Badge>
          </View>
          <View
            className="flex-row items-center justify-between"
            style={{ marginTop: 6 }}
          >
            <Text
              variant="titleMedium"
              style={{
                fontFamily: fontFamilies.semiBold,
                fontSize: 14,
                flex: 1,
              }}
            >
              {capitalize(damage.type)}
            </Text>
            <ChevronRight size={16} color={theme.textTertiary} />
          </View>
          {damage.description ? (
            <Text
              variant="bodySmall"
              color={theme.textSecondary}
              style={{ fontSize: 12, marginTop: 3, lineHeight: 17 }}
            >
              {damage.description}
            </Text>
          ) : null}
          <View
            className="flex-row items-center"
            style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}
          >
            {damage.inspectionId ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 9999,
                  backgroundColor: theme.surfaceTertiary,
                }}
              >
                <ClipboardCheck size={11} color={theme.textSecondary} />
                <Text
                  variant="caption"
                  color={theme.textSecondary}
                  style={{ fontSize: 11, fontFamily: fontFamilies.medium }}
                >
                  {t("fleet.detail.inspection", "Inspection")} #
                  {damage.inspectionId.slice(0, 8)}
                </Text>
              </View>
            ) : null}
            {damage.inspectorName ? (
              <Text
                variant="caption"
                color={theme.textTertiary}
                style={{ fontSize: 11 }}
              >
                {t("fleet.detail.by", "by")} {damage.inspectorName}
              </Text>
            ) : null}
          </View>
          <View className="flex-row items-center" style={{ marginTop: 8 }}>
            {damage.resolved ? (
              <>
                <CheckCircle size={13} color={theme.success} />
                <Text
                  variant="bodySmall"
                  color={theme.success}
                  style={{ marginLeft: 6, fontSize: 12 }}
                >
                  {t("fleet.detail.resolved", "Resolved")}
                </Text>
              </>
            ) : (
              <>
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: theme.danger,
                  }}
                />
                <Text
                  variant="bodySmall"
                  color={theme.danger}
                  style={{ marginLeft: 6, fontSize: 12 }}
                >
                  {t("fleet.detail.unresolved", "Unresolved")}
                </Text>
              </>
            )}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

/* ====================================================================
   RENTALS TAB
   ==================================================================== */
function RentalsTab({ vehicle, theme, t, currency }: TabProps) {
  const router = useRouter();
  const rentalHistory = vehicle.rentalHistory ?? [];
  const totalRevenue = rentalHistory.reduce((sum, r) => sum + r.revenue, 0);

  if (rentalHistory.length === 0) {
    return (
      <View className="py-12">
        <EmptyState
          icon={ClipboardList}
          title={t("fleet.detail.noRentals", "No rental history")}
          subtitle={t(
            "fleet.detail.noRentalsDesc",
            "This vehicle has not been rented yet.",
          )}
        />
      </View>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      <View
        style={{
          backgroundColor: theme.accentSoft,
          borderRadius: 16,
          padding: 14,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View>
          <Text
            variant="caption"
            color={theme.accent}
            style={{ fontSize: 11, fontFamily: fontFamilies.medium }}
          >
            {t("fleet.detail.totalRentals", "Total Rentals")}
          </Text>
          <Text
            variant="headlineSmall"
            color={theme.accent}
            style={{
              fontFamily: fontFamilies.bold,
              fontSize: 20,
              marginTop: 2,
            }}
          >
            {rentalHistory.length}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text
            variant="caption"
            color={theme.accent}
            style={{ fontSize: 11, fontFamily: fontFamilies.medium }}
          >
            {t("fleet.detail.revenue", "Revenue")}
          </Text>
          <Text
            variant="headlineSmall"
            color={theme.accent}
            style={{
              fontFamily: fontFamilies.bold,
              fontSize: 20,
              marginTop: 2,
            }}
          >
            {formatCurrency(totalRevenue, currency)}
          </Text>
        </View>
      </View>

      {rentalHistory.map((rental) => (
        <Pressable
          key={rental.id}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push({
              pathname: "/(app)/(bookings)/[id]",
              params: { id: rental.id },
            });
          }}
          style={({ pressed }) => ({
            backgroundColor: theme.surface,
            borderRadius: 16,
            padding: 14,
            borderWidth: 1,
            borderColor: theme.borderLight,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <View className="flex-row items-center">
            <Avatar name={rental.clientName} size="sm" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text
                variant="titleMedium"
                style={{ fontFamily: fontFamilies.semiBold, fontSize: 14 }}
                numberOfLines={1}
              >
                {rental.clientName}
              </Text>
              <Text
                variant="caption"
                color={theme.textTertiary}
                style={{ fontSize: 11, marginTop: 1 }}
              >
                {t("fleet.detail.booking", "Booking")} #{rental.id.slice(0, 8)}
              </Text>
            </View>
            <Text
              variant="titleMedium"
              color={theme.accent}
              style={{ fontFamily: fontFamilies.bold, fontSize: 14 }}
            >
              {formatCurrency(rental.revenue, currency)}
            </Text>
            <ChevronRight
              size={16}
              color={theme.textTertiary}
              style={{ marginLeft: 6 }}
            />
          </View>
          <View
            className="flex-row items-center justify-between"
            style={{ marginTop: 10 }}
          >
            <Text
              variant="bodySmall"
              color={theme.textSecondary}
              style={{ fontSize: 12 }}
            >
              {rental.startDate} {"\u2192"} {rental.endDate}
            </Text>
            <Text
              variant="bodySmall"
              color={theme.textTertiary}
              style={{ fontSize: 12 }}
            >
              {rental.duration} {t("bookings.detail.days", "days")}
            </Text>
          </View>
          {rental.status ? (
            <View style={{ marginTop: 8, alignSelf: "flex-start" }}>
              <Badge variant={rentalStatusVariant(rental.status)} size="sm">
                {capitalize(rental.status)}
              </Badge>
            </View>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

/* ====================================================================
   DETAIL SKELETON
   ==================================================================== */
function VehicleDetailSkeleton({
  theme,
  insets,
  onBack,
}: {
  theme: ReturnType<typeof useTheme>;
  insets: { top: number; bottom: number; left: number; right: number };
  onBack: () => void;
}) {
  const heroTotalHeight = HERO_HEIGHT + insets.top;
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar style="light" />
      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}
      >
        {/* Hero placeholder */}
        <View
          style={{
            width: SCREEN_WIDTH,
            height: heroTotalHeight,
            backgroundColor: theme.surfaceTertiary,
          }}
        >
          <Skeleton width={"100%"} height={heroTotalHeight} radius={0} />
          {/* Back button stays visible so user can leave */}
          <Pressable
            onPress={onBack}
            hitSlop={10}
            style={{
              position: "absolute",
              top: insets.top + 8,
              left: 16,
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "rgba(255,255,255,0.92)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ChevronLeft size={22} color="#111" strokeWidth={2.2} />
          </Pressable>
        </View>

        {/* Floating info card */}
        <View
          style={{
            marginTop: -28,
            marginHorizontal: 16,
            backgroundColor: theme.surface,
            borderRadius: 24,
            padding: 18,
            borderWidth: 1,
            borderColor: theme.borderLight,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.08,
            shadowRadius: 16,
            elevation: 6,
          }}
        >
          <View className="flex-row items-start">
            <View style={{ flex: 1, gap: 8, paddingRight: 12 }}>
              <Skeleton height={22} width={"75%"} />
              <Skeleton height={12} width={"45%"} />
              <Skeleton
                height={20}
                width={80}
                radius={9999}
                style={{ marginTop: 4 }}
              />
            </View>
            <View style={{ alignItems: "flex-end", gap: 6 }}>
              <Skeleton height={20} width={84} />
              <Skeleton height={11} width={48} />
            </View>
          </View>
        </View>

        {/* Quick specs */}
        <View
          style={{ marginTop: 14, marginHorizontal: 16 }}
          className="flex-row"
        >
          <View className="flex-row" style={{ gap: 10, flex: 1 }}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  backgroundColor: theme.surface,
                  borderRadius: 16,
                  paddingVertical: 12,
                  paddingHorizontal: 8,
                  borderWidth: 1,
                  borderColor: theme.borderLight,
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Skeleton width={28} height={28} radius={14} />
                <Skeleton height={12} width={"70%"} />
                <Skeleton height={10} width={"50%"} />
              </View>
            ))}
          </View>
        </View>

        {/* Action button */}
        <View style={{ marginTop: 18, marginHorizontal: 16 }}>
          <Skeleton height={48} width={"100%"} radius={9999} />
        </View>

        {/* Tab pills */}
        <View
          style={{ marginTop: 22, marginHorizontal: 16 }}
          className="flex-row"
        >
          <View className="flex-row" style={{ gap: 8 }}>
            {[64, 80, 72, 92].map((w, i) => (
              <Skeleton key={i} height={34} width={w} radius={9999} />
            ))}
          </View>
        </View>

        {/* Tab content rows */}
        <View style={{ marginTop: 14, marginHorizontal: 16, gap: 8 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                paddingVertical: 12,
                paddingHorizontal: 12,
                backgroundColor: theme.surface,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme.borderLight,
              }}
            >
              <Skeleton height={13} width={"30%"} />
              <Skeleton height={13} width={"40%"} />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

/* ====================================================================
   DOCUMENTS TAB
   ==================================================================== */
function DocumentsTab({ t }: { t: ReturnType<typeof useTranslation>["t"] }) {
  return (
    <View className="py-12">
      <EmptyState
        icon={FileText}
        title={t("fleet.detail.noDocuments", "No documents uploaded")}
        subtitle={t(
          "fleet.detail.noDocumentsDesc",
          "Vehicle documents will appear here.",
        )}
      />
    </View>
  );
}
