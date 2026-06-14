import React from "react";
import {
  View,
  Pressable,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import { Image } from "@/components/ui/Image";
import { LinearGradient } from "expo-linear-gradient";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { useTranslation } from "react-i18next";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  ChevronLeft,
  Car,
  Phone,
  Mail,
  MapPin,
  Clock,
  Calendar,
  CalendarCheck,
  CalendarX,
  FileText,
  FileSignature,
  FilePlus,
  ArrowRight,
  RefreshCw,
  ClipboardList,
  Timer,
  AlertTriangle,
  MoreVertical,
  Share2,
  Trash2,
} from "lucide-react-native";

import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { BookingChat } from "@/components/booking/BookingChat";
import { Divider } from "@/components/ui/Divider";
import { Avatar } from "@/components/ui/Avatar";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { getPickupEligibility } from "@/utils/pickupEligibility";
import { formatCurrency } from "@/utils/format";
import { useTheme } from "@/hooks/useTheme";
import { useToastStore } from "@/components/ui/Toast";
import {
  useAuthorizeDeposit,
  useBooking,
  useBookings,
  useCancelBooking,
  useCaptureDeposit,
  useDeleteBooking,
  useExtendBooking,
  useReleaseDeposit,
  useUpdateBooking,
} from "@/hooks/useBookings";
import { centsToUnits, unitsToCents } from "@/utils/money";
import { useAuthStore } from "@/stores/useAuthStore";
import { resolveVehicleImageSource } from "@/data/vehicleImages";
import { useVehicle } from "@/hooks/useFleet";
import type { Booking, BookingStatus, TimelineStep } from "@/types/booking";
import { mockClients } from "@/data/clients";
import { fontFamilies } from "@/theme/typography";

const SCREEN_WIDTH = Dimensions.get("window").width;
const HERO_HEIGHT = Math.round(SCREEN_WIDTH * 0.72);

// ── Helpers ─────────────────────────────────────────────────────────────────

function daysBetween(start: string, end: string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)));
}

function daysElapsed(start: string): number {
  const s = new Date(start).getTime();
  const now = Date.now();
  return Math.max(0, Math.round((now - s) / (1000 * 60 * 60 * 24)));
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type StatusTone = "success" | "info" | "warning" | "neutral" | "danger";

function statusTone(status: BookingStatus): StatusTone {
  const map: Record<BookingStatus, StatusTone> = {
    active: "success",
    confirmed: "info",
    pending: "warning",
    completed: "neutral",
    cancelled: "danger",
  };
  return map[status];
}

function toneColors(
  tone: StatusTone,
  theme: ReturnType<typeof useTheme>,
): { fg: string; bg: string } {
  const map: Record<StatusTone, { fg: string; bg: string }> = {
    success: { fg: theme.success, bg: theme.successSoft },
    info: { fg: theme.info, bg: theme.infoSoft },
    warning: { fg: theme.warning, bg: theme.warningSoft },
    neutral: { fg: theme.textSecondary, bg: theme.surfaceTertiary },
    danger: { fg: theme.danger, bg: theme.dangerSoft },
  };
  return map[tone];
}

function statusLabel(status: BookingStatus): string {
  const map: Record<BookingStatus, string> = {
    active: "Active",
    confirmed: "Confirmed",
    pending: "Pending",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  return map[status];
}

function buildTimeline(booking: Booking): TimelineStep[] {
  const { status, createdAt, workflow } = booking;

  const isConfirmedOrLater =
    status === "confirmed" || status === "active" || status === "completed";
  const isActiveOrLater = status === "active" || status === "completed";
  const isCompleted = status === "completed";

  const steps: TimelineStep[] = [
    {
      key: "created",
      label: "Created",
      date: createdAt,
      completed: true,
      active: false,
    },
    {
      key: "confirmed",
      label: "Confirmed",
      date: isConfirmedOrLater ? createdAt : null,
      completed: isConfirmedOrLater,
      active: status === "confirmed",
    },
  ];

  // Lifecycle events emitted by the server. Only render the row if the
  // event has fired (or is the next reasonable step) — keeps the timeline
  // accurate for both agency-initiated (in-person signing) and
  // client-initiated (online signing) bookings.
  if (workflow?.contractSignedAt || workflow?.contractSentAt) {
    steps.push({
      key: "contract_signed",
      label: workflow.contractSignedAt
        ? "Contract Signed"
        : "Contract Sent for Signing",
      date: workflow.contractSignedAt ?? workflow.contractSentAt ?? null,
      completed: !!workflow.contractSignedAt,
      active: !workflow.contractSignedAt && !!workflow.contractSentAt,
    });
  }
  if (workflow?.invoiceSentAt) {
    steps.push({
      key: "invoice_sent",
      label: "Invoice Sent",
      date: workflow.invoiceSentAt,
      completed: true,
      active: false,
    });
  }
  if (workflow?.paymentReceivedAt) {
    steps.push({
      key: "payment_received",
      label: "Payment Received",
      date: workflow.paymentReceivedAt,
      completed: true,
      active: false,
    });
  }

  steps.push(
    {
      key: "picked_up",
      label: "Vehicle Picked Up",
      date: isActiveOrLater ? booking.startDate : null,
      completed: isActiveOrLater,
      active: false,
    },
    {
      key: "in_progress",
      label: "In Progress",
      date: isActiveOrLater ? booking.startDate : null,
      completed: isCompleted,
      active: status === "active",
    },
    {
      key: "returned",
      label: "Returned",
      date: isCompleted ? booking.endDate : null,
      completed: isCompleted,
      active: false,
    },
    {
      key: "closed",
      label: "Closed",
      date: isCompleted ? booking.endDate : null,
      completed: isCompleted,
      active: false,
    },
  );
  return steps;
}

// ── Main Screen ─────────────────────────────────────────────────────────────

export default function BookingDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const showToast = useToastStore((s) => s.show);
  const isAdmin = useAuthStore((s) => s.user?.role) === "admin";
  const deleteBookingMut = useDeleteBooking();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const { data: booking, isLoading, isError, refetch } = useBooking(id);
  const { data: vehicle } = useVehicle(booking?.vehicleId ?? "");
  // For the conflict banner we need to resolve referenced booking ids; only fetch
  // the list when the current booking actually has conflicts.
  const { data: allBookings = [] } = useBookings(
    booking?.conflict ? undefined : undefined,
  );
  const bookings = booking?.conflict ? allBookings : [];

  if (isLoading && !booking) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" color={theme.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (isError && !booking) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View className="flex-1 items-center justify-center px-4 py-20">
          <EmptyState
            icon={ClipboardList}
            title={t("common.errorTitle", "Something went wrong")}
            subtitle={t(
              "common.errorRetry",
              "Please check your connection and try again.",
            )}
            actionLabel={t("common.retry", "Retry")}
            onAction={() => void refetch()}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View className="flex-1 items-center justify-center px-4 py-20">
          <EmptyState
            icon={ClipboardList}
            title={t("bookings.detail.notFound", "Booking not found")}
            subtitle={t(
              "bookings.detail.notFoundDesc",
              "The booking you are looking for does not exist.",
            )}
            actionLabel={t("common.back", "Back")}
            onAction={() => router.back()}
          />
        </View>
      </SafeAreaView>
    );
  }

  const client = mockClients.find((c) => c.id === booking.clientId);
  const totalDays = daysBetween(booking.startDate, booking.endDate);
  const elapsed = daysElapsed(booking.startDate);
  const remaining = Math.max(0, totalDays - elapsed);
  const timeline = buildTimeline(booking);

  const enabledOptions = booking.options.filter((o) => o.enabled);
  const deliveryOption = enabledOptions.find(
    (o) => o.id === "delivery" && o.deliveryDetails,
  );
  const perDayOptions = enabledOptions.filter((o) => o.id !== "delivery");
  const subtotal = booking.dailyRate * totalDays;
  const optionsTotal = perDayOptions.reduce(
    (s, o) => s + o.price * totalDays,
    0,
  );
  const deliveryFee = deliveryOption?.deliveryDetails?.fee ?? 0;
  const total = subtotal + optionsTotal + deliveryFee;

  const tone = toneColors(statusTone(booking.status), theme);
  const heroImage = resolveVehicleImageSource(
    vehicle ?? { id: booking.vehicleId },
  );
  const heroTotalHeight = HERO_HEIGHT + insets.top;

  const handleShare = () => {
    setMenuOpen(false);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showToast({
      variant: "info",
      title: t("bookings.detail.comingSoon", "Coming soon"),
      message: t(
        "bookings.detail.shareMessage",
        "Booking sharing will be available soon.",
      ),
    });
  };

  const handleDelete = () => {
    setMenuOpen(false);
    Alert.alert(
      t("bookings.detail.deleteTitle", "Delete booking?"),
      t(
        "bookings.detail.deleteMessage",
        "This will permanently delete this booking and its workflow data. This action cannot be undone.",
      ),
      [
        { text: t("common.cancel", "Cancel"), style: "cancel" },
        {
          text: t("common.delete", "Delete"),
          style: "destructive",
          onPress: () => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            deleteBookingMut.mutate(booking.id, {
              onSuccess: () => {
                showToast({
                  variant: "success",
                  title: t("bookings.detail.deleted", "Booking deleted"),
                });
                router.back();
              },
              onError: (err) => {
                showToast({
                  variant: "error",
                  title: t(
                    "bookings.detail.deleteError",
                    "Failed to delete booking",
                  ),
                  message: err instanceof Error ? err.message : String(err),
                });
              },
            });
          },
        },
      ],
    );
  };

  const menuModal = (
    <Modal
      visible={menuOpen}
      transparent
      animationType="fade"
      onRequestClose={() => setMenuOpen(false)}
    >
      <Pressable
        onPress={() => setMenuOpen(false)}
        testID="bookings-detail-menu-backdrop"
        accessibilityRole="button"
        accessibilityLabel={t("common.close", "Close")}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.25)" }}
      >
        <View
          style={{
            position: "absolute",
            top: insets.top + 54,
            right: 16,
            minWidth: 200,
            backgroundColor: theme.surface,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: theme.borderLight,
            paddingVertical: 6,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.18,
            shadowRadius: 16,
            elevation: 8,
          }}
        >
          <Pressable
            onPress={handleShare}
            testID="bookings-detail-share-menu-item"
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingHorizontal: 14,
              paddingVertical: 12,
              backgroundColor: pressed ? theme.surfaceTertiary : "transparent",
            })}
          >
            <Share2 size={16} color={theme.textPrimary} strokeWidth={2} />
            <Text
              variant="bodyMedium"
              style={{ fontFamily: fontFamilies.medium, fontSize: 14 }}
            >
              {t("bookings.detail.shareReport", "Share Report")}
            </Text>
          </Pressable>
          {isAdmin && (
            <>
              <View
                style={{
                  height: 1,
                  backgroundColor: theme.borderLight,
                  marginVertical: 2,
                }}
              />
              <Pressable
                onPress={handleDelete}
                testID="bookings-detail-delete-menu-item"
                accessibilityRole="button"
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  backgroundColor: pressed ? theme.dangerSoft : "transparent",
                })}
              >
                <Trash2 size={16} color={theme.danger} strokeWidth={2} />
                <Text
                  variant="bodyMedium"
                  color={theme.danger}
                  style={{ fontFamily: fontFamilies.semiBold, fontSize: 14 }}
                >
                  {t("bookings.detail.delete", "Delete booking")}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </Pressable>
    </Modal>
  );

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
            {heroImage ? (
              <Image
                source={heroImage}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
                transition={300}
              />
            ) : (
              <View className="flex-1 items-center justify-center">
                <Car size={72} color={theme.textTertiary} strokeWidth={1.3} />
              </View>
            )}

            {/* Top gradient for icon legibility under the notch */}
            <LinearGradient
              colors={["rgba(0,0,0,0.45)", "rgba(0,0,0,0)"]}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: insets.top + 110,
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
              testID="bookings-detail-back-button"
              accessibilityRole="button"
              accessibilityLabel={t("common.back", "Back")}
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

            {/* More menu */}
            <Pressable
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setMenuOpen(true);
              }}
              hitSlop={10}
              testID="bookings-detail-menu-button"
              accessibilityRole="button"
              accessibilityLabel="More"
              style={{
                position: "absolute",
                top: insets.top + 8,
                right: 16,
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "rgba(255,255,255,0.92)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MoreVertical size={20} color="#111" strokeWidth={2.2} />
            </Pressable>

            {/* Status chip */}
            <View
              style={{
                position: "absolute",
                top: insets.top + 56,
                right: 16,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 9999,
                backgroundColor: tone.bg,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: tone.fg,
                }}
              />
              <Text
                variant="labelSmall"
                color={tone.fg}
                style={{ fontFamily: fontFamilies.semiBold, fontSize: 11 }}
              >
                {statusLabel(booking.status)}
              </Text>
            </View>

            {/* Ref chip */}
            <View
              style={{
                position: "absolute",
                bottom: 40,
                alignSelf: "center",
                paddingHorizontal: 12,
                paddingVertical: 4,
                borderRadius: 9999,
                backgroundColor: "rgba(0,0,0,0.55)",
              }}
            >
              <Text
                variant="labelSmall"
                color="#FFFFFF"
                style={{ fontFamily: fontFamilies.semiBold, fontSize: 11 }}
              >
                #{booking.id}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* ── Floating info card ────────────────────────────────────── */}
        <Animated.View
          entering={FadeInDown.duration(450).delay(80)}
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
                {booking.vehicleName}
              </Text>
              <Text
                variant="bodySmall"
                color={theme.textTertiary}
                style={{ marginTop: 4, fontSize: 12 }}
                numberOfLines={1}
              >
                {booking.clientName}
              </Text>
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
                {formatCurrency(booking.dailyRate)}
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

          {/* Stat chips */}
          <View className="flex-row" style={{ gap: 8, marginTop: 14 }}>
            <StatChip
              icon={Calendar}
              label={`${totalDays} ${t("bookings.detail.days", "days")}`}
              color={theme.accent}
              bg={theme.accentSoft}
              theme={theme}
            />
            <StatChip
              icon={Timer}
              label={
                booking.status === "active"
                  ? `${remaining}d ${t("bookings.detail.left", "left")}`
                  : formatCurrency(total)
              }
              color={theme.success}
              bg={theme.successSoft}
              theme={theme}
            />
            <StatChip
              icon={FileText}
              label={formatCurrency(booking.deposit)}
              color={theme.info}
              bg={theme.infoSoft}
              theme={theme}
            />
          </View>
        </Animated.View>

        {/* ── Conflict Banner ───────────────────────────────────────── */}
        {booking.conflict && booking.conflict.withBookingIds.length > 0 && (
          <Animated.View
            entering={FadeInDown.duration(400).delay(140)}
            style={{ marginTop: 16, marginHorizontal: 16 }}
          >
            <View
              style={{
                backgroundColor: theme.dangerSoft,
                borderLeftWidth: 4,
                borderLeftColor: theme.danger,
                borderRadius: 16,
                padding: 14,
              }}
            >
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <AlertTriangle size={16} color={theme.danger} />
                <Text
                  variant="titleMedium"
                  color={theme.danger}
                  style={{ fontFamily: fontFamilies.semiBold }}
                >
                  {t(
                    "bookings.conflict.bannerTitle",
                    "Double-booking detected",
                  )}
                </Text>
              </View>
              <Text variant="bodySmall" color={theme.danger} className="mt-1">
                {t(
                  "bookings.conflict.bannerSubtitle",
                  "This vehicle is also booked on:",
                )}
              </Text>
              <View className="flex-row flex-wrap mt-2" style={{ gap: 6 }}>
                {booking.conflict.withBookingIds.map((refId) => {
                  const other = bookings.find((b) => b.id === refId);
                  return (
                    <Pressable
                      key={refId}
                      onPress={() => {
                        void Haptics.impactAsync(
                          Haptics.ImpactFeedbackStyle.Light,
                        );
                        router.push({
                          pathname: "/(app)/(bookings)/[id]",
                          params: { id: refId },
                        });
                      }}
                      testID={`bookings-detail-conflict-chip-${refId}`}
                      accessibilityRole="button"
                      style={{
                        backgroundColor: theme.surface,
                        borderWidth: 1,
                        borderColor: theme.danger,
                        borderRadius: 9999,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                      }}
                    >
                      <Text
                        variant="labelSmall"
                        color={theme.danger}
                        style={{ fontFamily: fontFamilies.semiBold }}
                      >
                        #{refId}
                        {other
                          ? ` · ${other.startDate} → ${other.endDate}`
                          : ""}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </Animated.View>
        )}

        {/* ── Client ────────────────────────────────────────────────── */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(200)}
          style={{ marginTop: 18, marginHorizontal: 16 }}
        >
          <SectionLabel theme={theme}>
            {t("bookings.detail.client", "Client")}
          </SectionLabel>
          <View
            style={{
              backgroundColor: theme.surface,
              borderRadius: 18,
              padding: 14,
              borderWidth: 1,
              borderColor: theme.borderLight,
            }}
          >
            <View className="flex-row items-center">
              <Avatar name={booking.clientName} size="md" />
              <View className="ml-3 flex-1">
                <Text
                  variant="titleMedium"
                  style={{ fontFamily: fontFamilies.semiBold, fontSize: 14 }}
                  numberOfLines={1}
                >
                  {booking.clientName}
                </Text>
                {client?.phone ? (
                  <Text
                    variant="bodySmall"
                    color={theme.textSecondary}
                    style={{ fontSize: 12, marginTop: 2 }}
                    numberOfLines={1}
                  >
                    {client.phone}
                  </Text>
                ) : null}
                {client?.email ? (
                  <Text
                    variant="bodySmall"
                    color={theme.textTertiary}
                    style={{ fontSize: 11 }}
                    numberOfLines={1}
                  >
                    {client.email}
                  </Text>
                ) : null}
              </View>
              <View className="flex-row" style={{ gap: 8 }}>
                <ContactButton
                  icon={Phone}
                  theme={theme}
                  disabled={!client?.phone}
                  testID="booking-call-button"
                  accessibilityLabel="Call"
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    const phone = client?.phone;
                    if (!phone) {
                      showToast({
                        variant: "info",
                        title: t(
                          "bookings.detail.noPhone",
                          "No phone number on file",
                        ),
                        message: booking.clientName,
                      });
                      return;
                    }
                    void Linking.openURL(`tel:${phone}`).catch(() => {
                      showToast({
                        variant: "error",
                        title: t(
                          "bookings.detail.callFailed",
                          "Unable to start call",
                        ),
                        message: phone,
                      });
                    });
                  }}
                />
                <ContactButton
                  icon={Mail}
                  theme={theme}
                  disabled={!client?.email}
                  testID="booking-email-button"
                  accessibilityLabel="Email"
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    const email = client?.email;
                    if (!email) {
                      showToast({
                        variant: "info",
                        title: t(
                          "bookings.detail.noEmail",
                          "No email address on file",
                        ),
                        message: booking.clientName,
                      });
                      return;
                    }
                    void Linking.openURL(`mailto:${email}`).catch(() => {
                      showToast({
                        variant: "error",
                        title: t(
                          "bookings.detail.emailFailed",
                          "Unable to open email",
                        ),
                        message: email,
                      });
                    });
                  }}
                />
              </View>
            </View>
          </View>
        </Animated.View>

        {/* ── Dates & Duration ─────────────────────────────────────── */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(260)}
          style={{ marginTop: 18, marginHorizontal: 16 }}
        >
          <SectionLabel theme={theme}>
            {t("bookings.detail.datesTitle", "Rental period")}
          </SectionLabel>
          <View
            style={{
              backgroundColor: theme.surface,
              borderRadius: 18,
              padding: 16,
              borderWidth: 1,
              borderColor: theme.borderLight,
            }}
          >
            <View className="flex-row items-center">
              <View style={{ flex: 1 }}>
                <Text
                  variant="caption"
                  color={theme.textTertiary}
                  style={{ fontSize: 11 }}
                >
                  {t("bookings.detail.startDate", "Start")}
                </Text>
                <Text
                  variant="titleMedium"
                  style={{
                    fontFamily: fontFamilies.semiBold,
                    marginTop: 3,
                    fontSize: 15,
                  }}
                >
                  {formatDate(booking.startDate)}
                </Text>
              </View>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: theme.surfaceTertiary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ArrowRight
                  size={14}
                  color={theme.textSecondary}
                  strokeWidth={2}
                />
              </View>
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <Text
                  variant="caption"
                  color={theme.textTertiary}
                  style={{ fontSize: 11 }}
                >
                  {t("bookings.detail.endDate", "End")}
                </Text>
                <Text
                  variant="titleMedium"
                  style={{
                    fontFamily: fontFamilies.semiBold,
                    marginTop: 3,
                    fontSize: 15,
                  }}
                >
                  {formatDate(booking.endDate)}
                </Text>
              </View>
            </View>

            <View style={{ marginTop: 10, alignSelf: "flex-start" }}>
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 4,
                  borderRadius: 9999,
                  backgroundColor: theme.accentSoft,
                }}
              >
                <Text
                  variant="labelSmall"
                  color={theme.accent}
                  style={{ fontFamily: fontFamilies.semiBold, fontSize: 11 }}
                >
                  {totalDays} {t("bookings.detail.days", "days")}
                </Text>
              </View>
            </View>

            <Divider className="my-3" />

            <DetailRow
              icon={Clock}
              label={`${t("bookings.detail.pickup", "Pickup")}: ${booking.pickupTime}`}
              theme={theme}
            />
            <DetailRow
              icon={Clock}
              label={`${t("bookings.detail.return", "Return")}: ${booking.returnTime}`}
              theme={theme}
            />
            <DetailRow
              icon={MapPin}
              label={booking.pickupLocation}
              theme={theme}
            />
            {booking.returnLocation !== booking.pickupLocation && (
              <DetailRow
                icon={MapPin}
                label={booking.returnLocation}
                theme={theme}
              />
            )}

            {booking.status === "active" && (
              <View style={{ marginTop: 14 }}>
                <Text
                  variant="bodySmall"
                  color={theme.textSecondary}
                  style={{ marginBottom: 6, fontSize: 12 }}
                >
                  {remaining}{" "}
                  {t("bookings.detail.daysRemaining", "days remaining")}
                </Text>
                <ProgressBar
                  progress={Math.min(1, elapsed / totalDays)}
                  label={`${elapsed} / ${totalDays} ${t("bookings.detail.days", "days")}`}
                  showPercentage
                  color={theme.accent}
                />
              </View>
            )}
          </View>
        </Animated.View>

        {/* ── Timeline ──────────────────────────────────────────────── */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(320)}
          style={{ marginTop: 18, marginHorizontal: 16 }}
        >
          <SectionLabel theme={theme}>
            {t("bookings.detail.timeline", "Timeline")}
          </SectionLabel>
          <View
            style={{
              backgroundColor: theme.surface,
              borderRadius: 18,
              padding: 16,
              borderWidth: 1,
              borderColor: theme.borderLight,
            }}
          >
            {timeline.map((step, index) => {
              const isLast = index === timeline.length - 1;
              const dotColor = step.completed
                ? theme.success
                : step.active
                  ? theme.accent
                  : theme.border;
              const dotBorderOnly = !step.completed && !step.active;

              return (
                <View key={step.key} className="flex-row">
                  <View className="items-center" style={{ width: 22 }}>
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: dotBorderOnly
                          ? "transparent"
                          : dotColor,
                        borderWidth: dotBorderOnly ? 2 : 0,
                        borderColor: dotBorderOnly
                          ? theme.border
                          : "transparent",
                        marginTop: 4,
                      }}
                    />
                    {!isLast && (
                      <View
                        style={{
                          width: 2,
                          flex: 1,
                          backgroundColor: step.completed
                            ? theme.success
                            : theme.border,
                        }}
                      />
                    )}
                  </View>
                  <View className="ml-3 pb-4 flex-1">
                    <Text
                      variant="titleSmall"
                      color={
                        step.completed
                          ? theme.textPrimary
                          : step.active
                            ? theme.accent
                            : theme.textTertiary
                      }
                      style={{
                        fontFamily:
                          step.active || step.completed
                            ? fontFamilies.semiBold
                            : fontFamilies.medium,
                        fontSize: 13,
                      }}
                    >
                      {step.label}
                    </Text>
                    {step.date ? (
                      <Text
                        variant="caption"
                        color={theme.textTertiary}
                        style={{ fontSize: 11, marginTop: 2 }}
                      >
                        {formatDate(step.date)}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        </Animated.View>

        {/* ── Pricing ───────────────────────────────────────────────── */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(380)}
          style={{ marginTop: 18, marginHorizontal: 16 }}
        >
          <SectionLabel theme={theme}>
            {t("bookings.detail.pricing", "Pricing")}
          </SectionLabel>
          <View
            style={{
              backgroundColor: theme.surface,
              borderRadius: 18,
              padding: 16,
              borderWidth: 1,
              borderColor: theme.borderLight,
            }}
          >
            <PriceRow
              label={`${formatCurrency(booking.dailyRate)} x ${totalDays} ${t("bookings.detail.days", "days")}`}
              value={formatCurrency(subtotal)}
              theme={theme}
            />
            {perDayOptions.map((opt) => (
              <PriceRow
                key={opt.id}
                label={`${opt.label} (${formatCurrency(opt.price)}/day)`}
                value={formatCurrency(opt.price * totalDays)}
                theme={theme}
              />
            ))}
            {deliveryOption?.deliveryDetails && (
              <>
                <PriceRow
                  label={t(
                    "bookings.new.delivery.optionLabel",
                    "Home delivery",
                  )}
                  value={formatCurrency(deliveryOption.deliveryDetails.fee)}
                  theme={theme}
                />
                <Text
                  variant="caption"
                  color={theme.textTertiary}
                  style={{ fontSize: 11, marginTop: -4, marginBottom: 4 }}
                  numberOfLines={2}
                >
                  {deliveryOption.deliveryDetails.address} ·{" "}
                  {deliveryOption.deliveryDetails.distanceKm.toFixed(2)}{" "}
                  {t("bookings.mileage.unit", "km")}
                </Text>
              </>
            )}

            <Divider className="my-3" />

            <PriceRow
              label={t("bookings.detail.deposit", "Deposit")}
              value={formatCurrency(booking.deposit)}
              theme={theme}
            />

            <View className="flex-row justify-between" style={{ marginTop: 8 }}>
              <Text
                variant="titleMedium"
                style={{ fontFamily: fontFamilies.semiBold, fontSize: 15 }}
              >
                {t("bookings.detail.total", "Total")}
              </Text>
              <Text
                variant="titleMedium"
                color={theme.accent}
                style={{ fontFamily: fontFamilies.bold, fontSize: 18 }}
              >
                {formatCurrency(total)}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* ── Deposit ───────────────────────────────────────────────── */}
        {(() => {
          // Show the deposit card when there is an active/terminal deposit
          // state, OR when a non-cash confirmed/active booking has a deposit
          // amount but no hold yet (so staff can optionally authorize one).
          const ds = booking.depositStatus;
          const canOfferAuthorize =
            (ds == null || ds === "none") &&
            booking.deposit > 0 &&
            booking.paymentMethod !== "cash" &&
            (booking.status === "confirmed" || booking.status === "active");
          return ds && ds !== "none" ? true : canOfferAuthorize;
        })() && (
          <Animated.View
            entering={FadeInDown.duration(400).delay(440)}
            style={{ marginTop: 18, marginHorizontal: 16 }}
          >
            <SectionLabel theme={theme}>
              {t("booking.payment.title", "Payment")}
            </SectionLabel>
            <View
              style={{
                backgroundColor: theme.surface,
                borderRadius: 18,
                padding: 16,
                borderWidth: 1,
                borderColor: theme.borderLight,
              }}
            >
              <View className="flex-row items-center justify-between">
                <Text
                  variant="bodyMedium"
                  color={theme.textSecondary}
                  style={{ fontSize: 13 }}
                >
                  {t("booking.deposit.status.label", "Deposit")}
                </Text>
                {(() => {
                  const ds = booking.depositStatus ?? "none";
                  const tone =
                    ds === "captured"
                      ? toneColors("success", theme)
                      : ds === "held" || ds === "partially_captured"
                        ? toneColors("info", theme)
                        : ds === "released"
                          ? toneColors("success", theme)
                          : ds === "failed" || ds === "forfeited"
                            ? toneColors("danger", theme)
                            : toneColors("warning", theme);
                  return (
                    <View
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 9999,
                        backgroundColor: tone.bg,
                      }}
                    >
                      <Text
                        variant="labelSmall"
                        color={tone.fg}
                        style={{
                          fontFamily: fontFamilies.semiBold,
                          fontSize: 11,
                        }}
                      >
                        {t(`booking.deposit.status.${ds}`, ds)}
                      </Text>
                    </View>
                  );
                })()}
              </View>

              {booking.depositCapturedAmount != null &&
                booking.depositCapturedAmount > 0 && (
                  <View
                    className="flex-row items-center justify-between"
                    style={{ marginTop: 8 }}
                  >
                    <Text
                      variant="bodyMedium"
                      color={theme.textSecondary}
                      style={{ fontSize: 13 }}
                    >
                      {t("booking.deposit.captured", "Captured")}
                    </Text>
                    <Text variant="bodySmall">
                      {formatCurrency(booking.depositCapturedAmount)}
                      {" / "}
                      {formatCurrency(booking.deposit)}
                    </Text>
                  </View>
                )}

              {booking.depositStatus === "failed" &&
                booking.depositFailureReason && (
                  <Text
                    variant="bodySmall"
                    color={theme.danger}
                    style={{ marginTop: 8, fontSize: 12 }}
                  >
                    {t("booking.deposit.failureReason", {
                      defaultValue: "Reason: {{reason}}",
                      reason: booking.depositFailureReason,
                    })}
                  </Text>
                )}

              {booking.autoCancelAt && booking.depositStatus !== "held" && (
                <View
                  className="flex-row items-center"
                  style={{
                    marginTop: 12,
                    borderRadius: 12,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    backgroundColor: theme.warningSoft,
                  }}
                >
                  <Timer size={14} color={theme.warning} />
                  <Text
                    variant="bodySmall"
                    color={theme.warning}
                    style={{ marginLeft: 6, fontSize: 12 }}
                  >
                    {t("booking.autoCancelIn", {
                      defaultValue: "Auto-cancels in {{time}}",
                      time: "soon",
                    })}
                  </Text>
                </View>
              )}

              <DepositControls booking={booking} />
            </View>
          </Animated.View>
        )}

        {/* ── Insurance ─────────────────────────────────────────────── */}
        {booking.insurance && (
          <Animated.View
            entering={FadeInDown.duration(400).delay(480)}
            style={{ marginTop: 18, marginHorizontal: 16 }}
          >
            <SectionLabel theme={theme}>
              {t("insurance.title", "Insurance")}
            </SectionLabel>
            <View
              style={{
                backgroundColor: theme.surface,
                borderRadius: 18,
                padding: 16,
                borderWidth: 1,
                borderColor: theme.borderLight,
              }}
            >
              <View className="flex-row items-center justify-between">
                <Text
                  variant="titleMedium"
                  style={{ fontFamily: fontFamilies.semiBold, fontSize: 14 }}
                >
                  {booking.insurance.tier === "all_inclusive"
                    ? t("insurance.allInclusive.title", "All-Inclusive")
                    : t("insurance.basic.title", "Basic Insurance")}
                </Text>
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 9999,
                    backgroundColor:
                      booking.insurance.tier === "all_inclusive"
                        ? theme.accentSoft
                        : theme.successSoft,
                  }}
                >
                  <Text
                    variant="labelSmall"
                    color={
                      booking.insurance.tier === "all_inclusive"
                        ? theme.accent
                        : theme.success
                    }
                    style={{ fontFamily: fontFamilies.semiBold, fontSize: 11 }}
                  >
                    {booking.insurance.tier === "all_inclusive"
                      ? `CHF ${booking.insurance.totalCost}`
                      : t("insurance.basic.included", "Included")}
                  </Text>
                </View>
              </View>
              <Text
                variant="bodySmall"
                color={theme.textTertiary}
                style={{ marginTop: 8, fontSize: 12 }}
              >
                Excess: {formatCurrency(booking.insurance.excess)}
              </Text>
            </View>
          </Animated.View>
        )}

        {/* ── Mileage (completed) ──────────────────────────────────── */}
        {booking.status === "completed" && booking.startMileage != null && (
          <Animated.View
            entering={FadeInDown.duration(400).delay(520)}
            style={{ marginTop: 18, marginHorizontal: 16 }}
          >
            <SectionLabel theme={theme}>
              {t("bookings.mileage.sectionTitle", "Mileage")}
            </SectionLabel>
            <View
              style={{
                backgroundColor: theme.surface,
                borderRadius: 18,
                padding: 16,
                borderWidth: 1,
                borderColor: theme.borderLight,
              }}
            >
              <PriceRow
                label={t(
                  "bookings.mileage.startMileageReadonly",
                  "Departure mileage",
                )}
                value={`${booking.startMileage.toLocaleString()} ${t("bookings.mileage.unit", "km")}`}
                theme={theme}
              />
              {booking.returnMileage != null && (
                <PriceRow
                  label={t(
                    "bookings.mileage.returnMileageStored",
                    "Return mileage",
                  )}
                  value={`${booking.returnMileage.toLocaleString()} ${t("bookings.mileage.unit", "km")}`}
                  theme={theme}
                />
              )}
              {booking.kmDriven != null && (
                <PriceRow
                  label={t("bookings.mileage.kmDriven", "Km driven")}
                  value={`${booking.kmDriven.toLocaleString()} ${t("bookings.mileage.unit", "km")}`}
                  theme={theme}
                  accent
                />
              )}
              {booking.includedKm != null && (
                <PriceRow
                  label={t("bookings.mileage.includedKm", "Included km")}
                  value={`${booking.includedKm.toLocaleString()} ${t("bookings.mileage.unit", "km")}`}
                  theme={theme}
                />
              )}

              {((booking.kmOverage ?? 0) > 0 ||
                (booking.overageCost ?? 0) > 0) && (
                <>
                  <Divider className="my-2" />
                  <View
                    className="flex-row justify-between items-center"
                    style={{
                      borderRadius: 12,
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                      backgroundColor: theme.warningSoft,
                      marginTop: 4,
                    }}
                  >
                    <Text
                      variant="bodyMedium"
                      color={theme.warning}
                      style={{ fontSize: 13 }}
                    >
                      {t("bookings.mileage.overage", "Overage")}
                    </Text>
                    <Text
                      variant="bodyMedium"
                      color={theme.warning}
                      style={{
                        fontFamily: fontFamilies.semiBold,
                        fontSize: 13,
                      }}
                    >
                      {(booking.kmOverage ?? 0).toLocaleString()}{" "}
                      {t("bookings.mileage.unit", "km")} · CHF{" "}
                      {(booking.overageCost ?? 0).toFixed(2)}
                    </Text>
                  </View>
                </>
              )}
            </View>
          </Animated.View>
        )}

        {/* ── Actions ───────────────────────────────────────────────── */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(560)}
          style={{ marginTop: 22, marginHorizontal: 16 }}
        >
          <ActionButtons
            booking={booking}
            theme={theme}
            router={router}
            showToast={showToast}
            t={t}
          />
        </Animated.View>

        {/* ── Notes ─────────────────────────────────────────────────── */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(620)}
          style={{ marginTop: 18, marginHorizontal: 16, marginBottom: 12 }}
        >
          <SectionLabel theme={theme}>
            {t("bookings.detail.notes", "Notes")}
          </SectionLabel>
          <View
            style={{
              backgroundColor: theme.surface,
              borderRadius: 18,
              padding: 14,
              borderWidth: 1,
              borderColor: theme.borderLight,
            }}
          >
            {booking.notes ? (
              <Text
                variant="bodyMedium"
                color={theme.textSecondary}
                style={{ fontSize: 13, lineHeight: 19 }}
              >
                {booking.notes}
              </Text>
            ) : (
              <Text
                variant="bodyMedium"
                color={theme.textTertiary}
                style={{ fontSize: 13 }}
              >
                {t("bookings.detail.noNotes", "No notes")}
              </Text>
            )}
          </View>
        </Animated.View>

        {/* ── Messages ──────────────────────────────────────────────── */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(680)}
          style={{ marginTop: 18, marginHorizontal: 16, marginBottom: 12 }}
        >
          <SectionLabel theme={theme}>
            {t("bookings.chat.title", "Messages")}
          </SectionLabel>
          <BookingChat bookingId={booking.id} />
        </Animated.View>
      </ScrollView>
      {menuModal}
    </View>
  );
}

// ── Subcomponents ──────────────────────────────────────────────────────────

// Deposit lifecycle controls (Stripe manual-capture). Rendered inside the
// Payment card on the booking detail. Controls vary by depositStatus:
//   held / partially_captured -> Capture (remaining) + Release
//   none/undefined (eligible)  -> optional Authorize hold
//   terminal states           -> display only (handled by the card chrome)
function DepositControls({ booking }: { booking: Booking }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const showToast = useToastStore((s) => s.show);

  const captureMut = useCaptureDeposit();
  const releaseMut = useReleaseDeposit();
  const authorizeMut = useAuthorizeDeposit();

  const ds = booking.depositStatus ?? "none";
  const captured = booking.depositCapturedAmount ?? 0;
  // Cents still capturable from the held authorization.
  const remainingCents = Math.max(0, booking.deposit - captured);

  const [mode, setMode] = React.useState<"none" | "capture" | "release">(
    "none",
  );
  // Decimal-pad input is in whole currency units; converted to cents on submit.
  const [amount, setAmount] = React.useState("");
  const [reason, setReason] = React.useState("");

  const openCapture = React.useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAmount(String(centsToUnits(remainingCents)));
    setReason("");
    setMode("capture");
  }, [remainingCents]);

  const openRelease = React.useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReason("");
    setMode("release");
  }, []);

  const closePanel = React.useCallback(() => {
    setMode("none");
    setAmount("");
    setReason("");
  }, []);

  const submitCapture = React.useCallback(() => {
    const units = parseFloat(amount.replace(",", "."));
    const amountCents = unitsToCents(units);
    if (
      !Number.isFinite(amountCents) ||
      amountCents < 1 ||
      amountCents > remainingCents
    ) {
      showToast({
        variant: "error",
        title: t("booking.deposit.errorAmount", {
          defaultValue: "Enter an amount between {{min}} and {{max}}",
          min: formatCurrency(1),
          max: formatCurrency(remainingCents),
        }),
      });
      return;
    }
    captureMut.mutate(
      { id: booking.id, amount: amountCents },
      {
        onSuccess: () => {
          void Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          );
          showToast({
            variant: "success",
            title: t("booking.deposit.captureSuccess", "Deposit captured"),
          });
          closePanel();
        },
        onError: (err) => {
          showToast({
            variant: "error",
            title: t("booking.deposit.captureError", "Could not capture deposit"),
            message: err instanceof Error ? err.message : undefined,
          });
        },
      },
    );
  }, [amount, remainingCents, captureMut, booking.id, showToast, t, closePanel]);

  const submitRelease = React.useCallback(() => {
    releaseMut.mutate(
      { id: booking.id, reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          void Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          );
          showToast({
            variant: "success",
            title: t("booking.deposit.releaseSuccess", "Deposit released"),
          });
          closePanel();
        },
        onError: (err) => {
          showToast({
            variant: "error",
            title: t("booking.deposit.releaseError", "Could not release deposit"),
            message: err instanceof Error ? err.message : undefined,
          });
        },
      },
    );
  }, [releaseMut, booking.id, reason, showToast, t, closePanel]);

  const submitAuthorize = React.useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    authorizeMut.mutate(
      { id: booking.id },
      {
        onSuccess: () => {
          void Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          );
          showToast({
            variant: "success",
            title: t(
              "booking.deposit.authorizeSuccess",
              "Deposit hold authorized",
            ),
          });
        },
        onError: (err) => {
          showToast({
            variant: "error",
            title: t(
              "booking.deposit.authorizeError",
              "Could not authorize deposit",
            ),
            message: err instanceof Error ? err.message : undefined,
          });
        },
      },
    );
  }, [authorizeMut, booking.id, showToast, t]);

  const canCapture = ds === "held" || ds === "partially_captured";
  const canRelease = ds === "held" || ds === "partially_captured";
  const canAuthorize = ds === "none";

  // Terminal / non-actionable states render nothing (card chrome shows status).
  if (!canCapture && !canRelease && !canAuthorize) return null;

  return (
    <View style={{ marginTop: 14 }}>
      {canCapture && (ds === "partially_captured" || captured > 0) && (
        <View
          className="flex-row items-center justify-between"
          style={{ marginBottom: 10 }}
        >
          <Text
            variant="bodyMedium"
            color={theme.textSecondary}
            style={{ fontSize: 13 }}
          >
            {t("booking.deposit.remaining", "Remaining to capture")}
          </Text>
          <Text variant="bodySmall">{formatCurrency(remainingCents)}</Text>
        </View>
      )}

      {mode === "capture" ? (
        <View>
          <Text
            variant="bodySmall"
            color={theme.textSecondary}
            style={{ fontSize: 12, marginBottom: 6 }}
          >
            {t("booking.deposit.amountLabel", "Amount to capture")}
          </Text>
          <View
            className="flex-row items-center"
            style={{
              backgroundColor: theme.surfaceTertiary,
              borderRadius: 12,
              paddingHorizontal: 12,
              marginBottom: 12,
            }}
          >
            <TextInput
              testID="deposit-capture-amount-input"
              value={amount}
              onChangeText={setAmount}
              placeholder={t("booking.deposit.amountPlaceholder", {
                defaultValue: "Max {{max}}",
                max: formatCurrency(remainingCents),
              })}
              placeholderTextColor={theme.textTertiary}
              keyboardType="decimal-pad"
              style={{
                flex: 1,
                fontFamily: fontFamilies.regular,
                fontSize: 14,
                color: theme.textPrimary,
                paddingVertical: 12,
              }}
            />
          </View>
          <View className="flex-row" style={{ gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Button
                testID="deposit-capture-cancel-button"
                variant="ghost"
                fullWidth
                onPress={closePanel}
              >
                {t("booking.deposit.cancel", "Cancel")}
              </Button>
            </View>
            <View style={{ flex: 1 }}>
              <Button
                testID="deposit-capture-confirm-button"
                variant="primary"
                fullWidth
                loading={captureMut.isPending}
                onPress={submitCapture}
              >
                {t("booking.deposit.confirmCapture", "Confirm capture")}
              </Button>
            </View>
          </View>
        </View>
      ) : mode === "release" ? (
        <View>
          <Text
            variant="bodySmall"
            color={theme.textSecondary}
            style={{ fontSize: 12, marginBottom: 6 }}
          >
            {t("booking.deposit.reasonLabel", "Reason (optional)")}
          </Text>
          <View
            className="flex-row items-center"
            style={{
              backgroundColor: theme.surfaceTertiary,
              borderRadius: 12,
              paddingHorizontal: 12,
              marginBottom: 12,
            }}
          >
            <TextInput
              testID="deposit-release-reason-input"
              value={reason}
              onChangeText={setReason}
              placeholder={t(
                "booking.deposit.reasonPlaceholder",
                "e.g. fully refunded",
              )}
              placeholderTextColor={theme.textTertiary}
              style={{
                flex: 1,
                fontFamily: fontFamilies.regular,
                fontSize: 14,
                color: theme.textPrimary,
                paddingVertical: 12,
              }}
            />
          </View>
          <View className="flex-row" style={{ gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Button
                testID="deposit-release-cancel-button"
                variant="ghost"
                fullWidth
                onPress={closePanel}
              >
                {t("booking.deposit.cancel", "Cancel")}
              </Button>
            </View>
            <View style={{ flex: 1 }}>
              <Button
                testID="deposit-release-confirm-button"
                variant="danger"
                fullWidth
                loading={releaseMut.isPending}
                onPress={submitRelease}
              >
                {t("booking.deposit.confirmRelease", "Confirm release")}
              </Button>
            </View>
          </View>
        </View>
      ) : (
        <View className="flex-row" style={{ gap: 10 }}>
          {canCapture && (
            <View style={{ flex: 1 }}>
              <Button
                testID="deposit-capture-button"
                variant="primary"
                fullWidth
                onPress={openCapture}
              >
                {ds === "partially_captured"
                  ? t("booking.deposit.captureRemaining", "Capture remaining")
                  : t("booking.deposit.capture", "Capture")}
              </Button>
            </View>
          )}
          {canRelease && (
            <View style={{ flex: 1 }}>
              <Button
                testID="deposit-release-button"
                variant="ghost"
                fullWidth
                onPress={openRelease}
              >
                {t("booking.deposit.release", "Release")}
              </Button>
            </View>
          )}
          {canAuthorize && (
            <View style={{ flex: 1 }}>
              <Button
                testID="deposit-authorize-button"
                variant="secondary"
                fullWidth
                loading={authorizeMut.isPending}
                onPress={submitAuthorize}
              >
                {t("booking.deposit.authorize", "Authorize hold")}
              </Button>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

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

interface StatChipProps {
  icon: React.ComponentType<{
    size?: number;
    color?: string;
    strokeWidth?: number;
  }>;
  label: string;
  color: string;
  bg: string;
  theme: ReturnType<typeof useTheme>;
}

function StatChip({ icon: Icon, label, color, bg, theme }: StatChipProps) {
  return (
    <View
      style={{
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: theme.surfaceTertiary,
      }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={12} color={color} strokeWidth={2.2} />
      </View>
      <Text
        variant="labelSmall"
        style={{
          fontFamily: fontFamilies.semiBold,
          fontSize: 12,
          color: theme.textPrimary,
          flexShrink: 1,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

function ContactButton({
  icon: Icon,
  theme,
  onPress,
  disabled = false,
  testID,
  accessibilityLabel,
}: {
  icon: React.ComponentType<{
    size?: number;
    color?: string;
    strokeWidth?: number;
  }>;
  theme: ReturnType<typeof useTheme>;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: theme.surfaceTertiary,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.4 : 1,
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      <Icon size={16} color={theme.accent} strokeWidth={2} />
    </Pressable>
  );
}

function DetailRow({
  icon: Icon,
  label,
  theme,
}: {
  icon: React.ComponentType<{
    size?: number;
    color?: string;
    strokeWidth?: number;
  }>;
  label: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View className="flex-row items-center" style={{ marginTop: 6 }}>
      <Icon size={13} color={theme.textTertiary} strokeWidth={2} />
      <Text
        variant="bodySmall"
        color={theme.textSecondary}
        style={{ marginLeft: 8, fontSize: 12, flex: 1 }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

function PriceRow({
  label,
  value,
  theme,
  accent,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>;
  accent?: boolean;
}) {
  return (
    <View className="flex-row justify-between" style={{ marginBottom: 8 }}>
      <Text
        variant="bodyMedium"
        color={theme.textSecondary}
        style={{ fontSize: 13, flex: 1, paddingRight: 8 }}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Text
        variant="bodyMedium"
        color={accent ? theme.accent : theme.textPrimary}
        style={{
          fontFamily: accent ? fontFamilies.bold : fontFamilies.semiBold,
          fontSize: 13,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

// ── Action Buttons Component ────────────────────────────────────────────────

type ShowToastFn = (toast: {
  variant: "success" | "error" | "warning" | "info";
  title: string;
  message?: string;
  duration?: number;
}) => void;

interface ActionButtonsProps {
  booking: Booking;
  theme: ReturnType<typeof useTheme>;
  router: ReturnType<typeof useRouter>;
  showToast: ShowToastFn;
  t: ReturnType<typeof useTranslation>["t"];
}

function ActionButtons({ booking, router, showToast, t }: ActionButtonsProps) {
  const cancelMutation = useCancelBooking();
  const updateMutation = useUpdateBooking();
  const extendMutation = useExtendBooking();

  const handleCancel = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    cancelMutation.mutate(booking.id, {
      onSuccess: () =>
        showToast({
          variant: "success",
          title: t("bookings.detail.cancelled", "Booking cancelled"),
          message: t(
            "bookings.detail.cancelledMsg",
            "The booking has been cancelled.",
          ),
        }),
      onError: (err) =>
        showToast({
          variant: "error",
          title: t("common.errorTitle", "Something went wrong"),
          message: err instanceof Error ? err.message : undefined,
        }),
    });
  };

  const handleExtend = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const submit = (extraDays: number) => {
      const current = new Date(booking.endDate + "T00:00:00Z");
      current.setUTCDate(current.getUTCDate() + extraDays);
      const newEndDate = current.toISOString().slice(0, 10);
      extendMutation.mutate(
        { id: booking.id, payload: { newEndDate } },
        {
          onSuccess: (result) => {
            if (result.conflict) {
              showToast({
                variant: "error",
                title: t(
                  "bookings.detail.extendConflict",
                  "Extension conflicts with another booking",
                ),
              });
            } else {
              showToast({
                variant: "success",
                title: t("bookings.detail.extended", "Rental extended"),
                message: `+${extraDays} ${t("bookings.detail.days", "days")}`,
              });
            }
          },
          onError: (err) =>
            showToast({
              variant: "error",
              title: t("common.errorTitle", "Something went wrong"),
              message: err instanceof Error ? err.message : undefined,
            }),
        },
      );
    };
    Alert.alert(
      t("bookings.detail.extendRental", "Extend Rental"),
      t("bookings.detail.extendPrompt", "Extend this rental by:"),
      [
        { text: "+3 days", onPress: () => submit(3) },
        { text: "+7 days", onPress: () => submit(7) },
        { text: t("common.cancel", "Cancel"), style: "cancel" },
      ],
    );
  };

  switch (booking.status) {
    case "pending":
      return (
        <View className="gap-3">
          <Button
            testID="bookings-detail-confirm-button"
            variant="primary"
            fullWidth
            leftIcon={CalendarCheck}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              updateMutation.mutate(
                { id: booking.id, patch: { status: "confirmed" } },
                {
                  onSuccess: () =>
                    showToast({
                      variant: "success",
                      title: t(
                        "bookings.detail.confirmed",
                        "Booking confirmed",
                      ),
                    }),
                  onError: (err) =>
                    showToast({
                      variant: "error",
                      title: t("common.errorTitle", "Something went wrong"),
                      message: err instanceof Error ? err.message : undefined,
                    }),
                },
              );
            }}
          >
            {t("bookings.detail.confirm", "Confirm")}
          </Button>
          <Button
            testID="bookings-detail-cancel-pending-button"
            variant="danger"
            fullWidth
            leftIcon={CalendarX}
            onPress={handleCancel}
          >
            {t("bookings.detail.cancel", "Cancel")}
          </Button>
        </View>
      );

    case "confirmed": {
      const eligibility = getPickupEligibility(booking);
      const isTooEarly = eligibility.kind === "too-early";
      return (
        <View className="gap-3">
          <Button
            testID="bookings-detail-start-pickup-button"
            variant="primary"
            fullWidth
            leftIcon={Car}
            disabled={isTooEarly}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push(`/(app)/(bookings)/pickup/${booking.id}` as never);
            }}
          >
            {t("pickup.title", "Start Pickup")}
          </Button>
          {isTooEarly && (
            <Text variant="bodySmall" align="center" color="#92400E">
              {t("pickup.gate.notYet", {
                defaultValue: "Pickup opens {{at}}",
                at: eligibility.earliestAt.toLocaleString(),
              })}
            </Text>
          )}
          <Button
            testID="bookings-detail-cancel-confirmed-button"
            variant="danger"
            fullWidth
            leftIcon={CalendarX}
            onPress={handleCancel}
          >
            {t("bookings.detail.cancel", "Cancel")}
          </Button>
        </View>
      );
    }

    case "active":
      return (
        <View className="gap-3">
          <Button
            testID="bookings-detail-start-return-button"
            variant="primary"
            fullWidth
            leftIcon={ClipboardList}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push(`/(app)/(bookings)/return/${booking.id}` as never);
            }}
          >
            {t("return.title", "Start Return")}
          </Button>
          <Button
            testID="bookings-detail-extend-button"
            variant="secondary"
            fullWidth
            leftIcon={Calendar}
            onPress={handleExtend}
          >
            {t("bookings.detail.extendRental", "Extend Rental")}
          </Button>
        </View>
      );

    case "completed": {
      const invoiceId = booking.workflow?.invoiceId;
      const inspectionId =
        booking.workflow?.postInspectionId ?? booking.workflow?.preInspectionId;
      const contractId = booking.workflow?.contractId;
      return (
        <View className="gap-3">
          {invoiceId && (
            <Button
              testID="bookings-detail-view-invoice-button"
              variant="primary"
              fullWidth
              leftIcon={FileText}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(`/(app)/(more)/billing/${invoiceId}` as never);
              }}
            >
              {t("bookings.detail.viewInvoice", "View Invoice")}
            </Button>
          )}
          {contractId && (
            <Button
              testID="bookings-detail-view-contract-button"
              variant="secondary"
              fullWidth
              leftIcon={FileSignature}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(`/(app)/(more)/contracts/${contractId}` as never);
              }}
            >
              {t("bookings.detail.viewContract", "View Contract")}
            </Button>
          )}
          {inspectionId && (
            <Button
              testID="bookings-detail-view-inspection-button"
              variant="secondary"
              fullWidth
              leftIcon={ClipboardList}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(`/(app)/(inspections)/${inspectionId}` as never);
              }}
            >
              {t("bookings.detail.viewInspection", "View Inspection")}
            </Button>
          )}
          <Button
            testID="bookings-detail-new-invoice-button"
            variant="ghost"
            fullWidth
            leftIcon={FilePlus}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push(
                `/(app)/(more)/billing/new?bookingId=${booking.id}` as never,
              );
            }}
          >
            {t("bookings.detail.newInvoice", "New Invoice")}
          </Button>
        </View>
      );
    }

    case "cancelled":
      return (
        <View className="gap-3">
          <Button
            testID="bookings-detail-rebook-button"
            variant="primary"
            fullWidth
            leftIcon={RefreshCw}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              showToast({
                variant: "info",
                title: t("bookings.detail.rebook", "Rebook"),
                message: t(
                  "bookings.detail.rebookMsg",
                  "Rebooking will be available soon.",
                ),
              });
            }}
          >
            {t("bookings.detail.rebook", "Rebook")}
          </Button>
        </View>
      );

    default:
      return null;
  }
}
