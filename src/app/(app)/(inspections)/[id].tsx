import React, { useMemo, useState } from "react";
import {
  View,
  Pressable,
  Modal,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Alert,
  Linking,
  type DimensionValue,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Image } from "@/components/ui/Image";
import * as Haptics from "expo-haptics";
import {
  ChevronLeft,
  Camera,
  CheckCircle,
  AlertTriangle,
  Share2,
  MoreVertical,
  Trash2,
  Play,
  Gauge,
  Fuel,
  ScanLine,
  PenTool,
  FileText,
  GitCompareArrows,
  Sparkles,
  X as XIcon,
  type LucideIcon,
} from "lucide-react-native";

import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useTheme } from "@/hooks/useTheme";
import { useToastStore } from "@/components/ui/Toast";
import { formatDate, formatMileage } from "@/utils/format";
import {
  useInspection,
  useInspections,
  useRunInspectionAngleAi,
  useDeleteInspection,
} from "@/hooks/useInspections";
import { useAuthStore } from "@/stores/useAuthStore";
import { PrePostAngleList } from "@/components/inspections/PrePostAngleList";
import { ManualAngleReviewModal } from "@/components/inspections/ManualAngleReviewModal";
import { getVehicleImage } from "@/data/vehicleImages";
import { fontFamilies } from "@/theme/typography";
import { isInsufficientCredits } from "@/services/apiErrors";
import { WEB_ADMIN_URL } from "@/config/webAdmin";
import type {
  Inspection,
  CapturedPhoto,
  DamageSeverity,
  PhotoAngle,
} from "@/types/inspection";
import { PHOTO_ANGLES } from "@/types/inspection";

const SCREEN_WIDTH = Dimensions.get("window").width;
const HERO_HEIGHT = Math.round(SCREEN_WIDTH * 0.6);

// ── Helpers ─────────────────────────────────────────────────────────────────

type TypeTone = { fg: string; bg: string };

function typeTone(
  type: Inspection["type"],
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

function typeLabel(
  type: Inspection["type"],
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

function severityTone(
  severity: DamageSeverity,
  theme: ReturnType<typeof useTheme>,
): { fg: string; bg: string } {
  switch (severity) {
    case "minor":
      return { fg: theme.info, bg: theme.infoSoft };
    case "moderate":
      return { fg: theme.warning, bg: theme.warningSoft };
    case "severe":
      return { fg: theme.danger, bg: theme.dangerSoft };
  }
}

function severityOrder(severity: DamageSeverity): number {
  return { severe: 0, moderate: 1, minor: 2 }[severity];
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

interface DamageEntry {
  angleLabel: string;
  severity: DamageSeverity;
  description: string;
}

function collectDamages(inspection: Inspection): DamageEntry[] {
  const damages: DamageEntry[] = [];
  for (const photo of inspection.photos) {
    const angleInfo = PHOTO_ANGLES.find((a) => a.key === photo.angle);
    const angleLabel = angleInfo?.label ?? photo.angle;
    for (const annotation of photo.annotations) {
      damages.push({
        angleLabel,
        severity: annotation.severity,
        description: annotation.description,
      });
    }
    if (photo.aiResult && photo.aiResult.damagesFound > 0) {
      const aiOnly = photo.aiResult.damagesFound - photo.annotations.length;
      for (let i = 0; i < Math.max(0, aiOnly); i++) {
        damages.push({
          angleLabel,
          severity: "moderate",
          description: "AI detected",
        });
      }
    }
  }
  damages.sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity));
  return damages;
}

// ── Section label ───────────────────────────────────────────────────────────

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

// ── Chip ────────────────────────────────────────────────────────────────────

function Chip({
  label,
  fg,
  bg,
  icon: Icon,
}: {
  label: string;
  fg: string;
  bg: string;
  icon?: LucideIcon;
}) {
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 9999,
        backgroundColor: bg,
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        alignSelf: "flex-start",
      }}
    >
      {Icon && <Icon size={11} color={fg} strokeWidth={2.2} />}
      <Text
        variant="labelSmall"
        color={fg}
        style={{ fontFamily: fontFamilies.semiBold, fontSize: 11 }}
      >
        {label}
      </Text>
    </View>
  );
}

// ── Main Screen ─────────────────────────────────────────────────────────────

interface FullscreenTarget {
  photo: CapturedPhoto | null;
  angleLabel: string;
}

export default function InspectionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const showToast = useToastStore((s) => s.show);

  const { data: inspection, isLoading, isError, refetch } = useInspection(id);
  const runAngleAi = useRunInspectionAngleAi();
  const deleteInspectionMut = useDeleteInspection();
  const isAdmin = useAuthStore((s) => s.user?.role) === "admin";
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingAiAngles, setPendingAiAngles] = useState<Set<PhotoAngle>>(
    new Set(),
  );
  const [manualReview, setManualReview] = useState<{
    angle: PhotoAngle;
    angleLabel: string;
  } | null>(null);

  const triggerAngleAi = (angle: PhotoAngle) => {
    if (!inspection) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPendingAiAngles((s) => new Set(s).add(angle));
    runAngleAi.mutate(
      { id: inspection.id, angle },
      {
        onError: (err) => {
          if (isInsufficientCredits(err)) {
            Alert.alert(
              t(
                "inspections.detail.ai.insufficientCreditsTitle",
                "Out of AI credits",
              ),
              t(
                "inspections.detail.ai.insufficientCreditsMessage",
                "Your agency has run out of AI inspection credits. Top up on the web admin to keep using AI analysis.",
              ),
              [
                { text: t("common.close", "Close"), style: "cancel" },
                {
                  text: t("common.openWebAdmin", "Buy credits"),
                  onPress: () => {
                    void Linking.openURL(WEB_ADMIN_URL);
                  },
                },
              ],
            );
            return;
          }
          showToast({
            variant: "error",
            title: t("inspections.detail.ai.errorTitle", "AI analysis failed"),
            message: err instanceof Error ? err.message : String(err),
          });
        },
        onSettled: () => {
          setPendingAiAngles((s) => {
            const next = new Set(s);
            next.delete(angle);
            return next;
          });
        },
      },
    );
  };

  const { data: relatedInspections = [] } = useInspections(
    inspection?.bookingId ? { bookingId: inspection.bookingId } : undefined,
  );

  const pair = useMemo(() => {
    if (!inspection?.bookingId) return null;
    const related = relatedInspections.filter(
      (i) => i.bookingId === inspection.bookingId && i.id !== inspection.id,
    );
    if (inspection.type === "pre-rental") {
      const post = related.find((i) => i.type === "post-rental");
      return post ? { pre: inspection, post } : null;
    }
    if (inspection.type === "post-rental") {
      const pre = related.find((i) => i.type === "pre-rental");
      return pre ? { pre, post: inspection } : null;
    }
    return null;
  }, [inspection, relatedInspections]);

  const [compareMode, setCompareMode] = useState(false);
  const [fullscreen, setFullscreen] = useState<FullscreenTarget | null>(null);

  const damages = useMemo(() => {
    if (!inspection) return [];
    return collectDamages(inspection);
  }, [inspection]);

  const severityCounts = useMemo(() => {
    const counts: Record<DamageSeverity, number> = {
      minor: 0,
      moderate: 0,
      severe: 0,
    };
    if (!inspection) return counts;
    for (const d of damages) counts[d.severity]++;
    return counts;
  }, [damages, inspection]);

  const photoByAngle = useMemo(() => {
    const map = new Map<string, CapturedPhoto>();
    if (!inspection) return map;
    for (const p of inspection.photos) map.set(p.angle, p);
    return map;
  }, [inspection]);

  if (!inspection) {
    if (isLoading) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
          <View className="flex-1 items-center justify-center px-4 py-20">
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        </SafeAreaView>
      );
    }
    if (isError) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
          <View className="flex-1 items-center justify-center px-4 py-20">
            <EmptyState
              icon={ScanLine}
              title={t(
                "inspections.detail.errorTitle",
                "Couldn't load inspection",
              )}
              subtitle={t(
                "inspections.detail.errorSubtitle",
                "Check your connection and try again.",
              )}
              actionLabel={t("common.retry", "Retry")}
              onAction={() => {
                void refetch();
              }}
            />
          </View>
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View className="flex-1 items-center justify-center px-4 py-20">
          <EmptyState
            icon={ScanLine}
            title={t("inspections.detail.notFound", "Inspection not found")}
            subtitle={t(
              "inspections.detail.notFoundDesc",
              "The inspection you are looking for does not exist.",
            )}
            actionLabel={t("common.back", "Back")}
            onAction={() => router.back()}
          />
        </View>
      </SafeAreaView>
    );
  }

  const totalDamages =
    inspection.totalDamagesAI + inspection.totalDamagesManual;
  const vehicleImageUri = getVehicleImage(inspection.vehicleId);
  const heroTotalHeight = HERO_HEIGHT + insets.top;

  // ── Photo tile renderer ────────────────────────────────────────────────

  const renderPhotoTile = (
    angleLabel: string,
    photo: CapturedPhoto | undefined,
    width: DimensionValue,
    aspectRatio: number,
  ) => {
    const hasDamages = photo?.aiResult && photo.aiResult.damagesFound > 0;
    const annotationCount = photo?.annotations.length ?? 0;
    return (
      <Pressable
        onPress={() => setFullscreen({ photo: photo ?? null, angleLabel })}
        style={{
          width,
          aspectRatio,
          borderRadius: 14,
          overflow: "hidden",
          backgroundColor: theme.surfaceTertiary,
        }}
      >
        {photo?.url || photo?.uri ? (
          <Image
            source={{ uri: (photo.url ?? photo.uri) as string }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Camera size={26} color={theme.border} strokeWidth={1} />
          </View>
        )}
        <View
          style={{
            position: "absolute",
            top: 6,
            left: 6,
            backgroundColor: "rgba(0,0,0,0.5)",
            borderRadius: 9999,
            paddingHorizontal: 7,
            paddingVertical: 2,
          }}
        >
          <Text
            variant="labelSmall"
            color="#FFFFFF"
            style={{ fontSize: 9, fontFamily: fontFamilies.semiBold }}
            numberOfLines={1}
          >
            {angleLabel}
          </Text>
        </View>
        {photo && (
          <View style={{ position: "absolute", bottom: 6, right: 6 }}>
            {hasDamages ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: theme.dangerSoft,
                  borderRadius: 9999,
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                  gap: 3,
                }}
              >
                <AlertTriangle size={10} color={theme.danger} />
                <Text
                  variant="labelSmall"
                  color={theme.danger}
                  style={{ fontSize: 9, fontFamily: fontFamilies.semiBold }}
                >
                  {photo.aiResult!.damagesFound}
                </Text>
              </View>
            ) : (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: theme.successSoft,
                  borderRadius: 9999,
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                  gap: 3,
                }}
              >
                <CheckCircle size={10} color={theme.success} />
                <Text
                  variant="labelSmall"
                  color={theme.success}
                  style={{ fontSize: 9, fontFamily: fontFamilies.semiBold }}
                >
                  OK
                </Text>
              </View>
            )}
          </View>
        )}
        {annotationCount > 0 && (
          <View
            style={{
              position: "absolute",
              bottom: 6,
              left: 6,
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "rgba(0,0,0,0.5)",
              borderRadius: 9999,
              paddingHorizontal: 6,
              paddingVertical: 2,
              gap: 3,
            }}
          >
            <PenTool size={9} color="#FFFFFF" />
            <Text
              variant="labelSmall"
              color="#FFFFFF"
              style={{ fontSize: 9, fontFamily: fontFamilies.semiBold }}
            >
              {annotationCount}
            </Text>
          </View>
        )}
      </Pressable>
    );
  };

  // ── Inspection section renderer (for paired stacked view) ─────────────

  const renderInspectionSection = (insp: Inspection) => {
    const photoMap = new Map<string, CapturedPhoto>();
    for (const p of insp.photos) photoMap.set(p.angle, p);
    const dmg = collectDamages(insp);

    return (
      <View style={{ gap: 14 }}>
        <Text
          variant="bodySmall"
          color={theme.textSecondary}
          style={{ fontSize: 12 }}
        >
          {formatDate(insp.date, "long")} · {insp.inspectorName}
        </Text>

        <MileageFuelCard inspection={insp} theme={theme} t={t} />

        <View>
          <View
            className="flex-row items-center justify-between"
            style={{ marginBottom: 8 }}
          >
            <Text
              variant="titleMedium"
              style={{ fontFamily: fontFamilies.semiBold, fontSize: 14 }}
            >
              {t("inspections.detail.photosSection", "Photos")}
            </Text>
            <Chip
              label={`${insp.photos.length}/8`}
              fg={theme.accent}
              bg={theme.accentSoft}
            />
          </View>
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {PHOTO_ANGLES.map((a) => (
              <View key={a.key} style={{ width: "48.5%" }}>
                {renderPhotoTile(a.label, photoMap.get(a.key), "100%", 4 / 3)}
              </View>
            ))}
          </View>
        </View>

        <View>
          <Text
            variant="titleMedium"
            style={{
              fontFamily: fontFamilies.semiBold,
              fontSize: 14,
              marginBottom: 8,
            }}
          >
            {t("inspections.detail.damageSummary", "Damage Summary")}
          </Text>
          {dmg.length === 0 ? (
            <View
              style={{
                backgroundColor: theme.successSoft,
                borderRadius: 14,
                padding: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <CheckCircle size={16} color={theme.success} />
              <Text
                variant="bodySmall"
                color={theme.success}
                style={{ fontFamily: fontFamilies.semiBold, fontSize: 12 }}
              >
                {t("inspections.detail.noDamage", "No damage detected")}
              </Text>
            </View>
          ) : (
            <View style={{ gap: 6 }}>
              {dmg.map((d, i) => (
                <DamageRow
                  key={`${insp.id}-${d.angleLabel}-${d.severity}-${i}`}
                  damage={d}
                  theme={theme}
                />
              ))}
            </View>
          )}
        </View>

        {insp.notes.trim().length > 0 && (
          <View
            style={{
              backgroundColor: theme.surface,
              borderRadius: 14,
              padding: 14,
              flexDirection: "row",
              gap: 10,
              borderWidth: 1,
              borderColor: theme.borderLight,
            }}
          >
            <FileText
              size={14}
              color={theme.textTertiary}
              style={{ marginTop: 2 }}
            />
            <Text
              variant="bodySmall"
              color={theme.textSecondary}
              style={{ flex: 1, fontSize: 12, lineHeight: 17 }}
            >
              {insp.notes}
            </Text>
          </View>
        )}
      </View>
    );
  };

  // ── Compare grid renderer ──────────────────────────────────────────────

  const renderCompareView = (pre: Inspection, post: Inspection) => {
    const preMap = new Map<string, CapturedPhoto>();
    for (const p of pre.photos) preMap.set(p.angle, p);
    const postMap = new Map<string, CapturedPhoto>();
    for (const p of post.photos) postMap.set(p.angle, p);

    return (
      <View style={{ gap: 12 }}>
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <View style={{ width: 28 }} />
          <View className="flex-1 items-center">
            <Chip
              label={t("inspections.detail.preRentalTitle", "Before")}
              fg={theme.info}
              bg={theme.infoSoft}
            />
          </View>
          <View className="flex-1 items-center">
            <Chip
              label={t("inspections.detail.postRentalTitle", "After")}
              fg={theme.warning}
              bg={theme.warningSoft}
            />
          </View>
        </View>

        {PHOTO_ANGLES.map((a) => (
          <View
            key={a.key}
            className="flex-row items-center"
            style={{ gap: 8 }}
          >
            <View style={{ width: 28 }}>
              <Text
                variant="caption"
                color={theme.textSecondary}
                style={{
                  fontSize: 10,
                  textAlign: "center",
                  fontFamily: fontFamilies.medium,
                }}
                numberOfLines={2}
              >
                {a.label}
              </Text>
            </View>
            <View className="flex-1">
              {renderPhotoTile(a.label, preMap.get(a.key), "100%", 4 / 3)}
            </View>
            <View className="flex-1">
              {renderPhotoTile(a.label, postMap.get(a.key), "100%", 4 / 3)}
            </View>
          </View>
        ))}

        <View className="flex-row" style={{ gap: 10, marginTop: 4 }}>
          <View style={{ flex: 1 }}>
            <StatDuoCard
              title={formatMileage(pre.mileage)}
              subtitle={`${t("inspections.detail.fuel", "Fuel")}: ${pre.fuelLevel}%`}
              tone="info"
              theme={theme}
              t={t}
            />
          </View>
          <View style={{ flex: 1 }}>
            <StatDuoCard
              title={formatMileage(post.mileage)}
              subtitle={`${t("inspections.detail.fuel", "Fuel")}: ${post.fuelLevel}%`}
              tone="warning"
              theme={theme}
              t={t}
            />
          </View>
        </View>
      </View>
    );
  };

  // ── Fullscreen modal ────────────────────────────────────────────────────

  const manualModal = manualReview ? (
    <ManualAngleReviewModal
      inspectionId={inspection.id}
      angle={manualReview.angle}
      angleLabel={manualReview.angleLabel}
      postPhoto={inspection.photos.find((p) => p.angle === manualReview.angle)}
      prePhoto={pair?.pre.photos.find((p) => p.angle === manualReview.angle)}
      onClose={() => setManualReview(null)}
    />
  ) : null;

  const handleShare = () => {
    setMenuOpen(false);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showToast({
      variant: "info",
      title: t("inspections.detail.comingSoon", "Coming soon"),
      message: t(
        "inspections.detail.shareMessage",
        "Report sharing will be available soon.",
      ),
    });
  };

  const handleDelete = () => {
    setMenuOpen(false);
    Alert.alert(
      t("inspections.detail.deleteTitle", "Delete inspection?"),
      t(
        "inspections.detail.deleteMessage",
        "This will permanently delete this inspection and its photos. This action cannot be undone.",
      ),
      [
        { text: t("common.cancel", "Cancel"), style: "cancel" },
        {
          text: t("common.delete", "Delete"),
          style: "destructive",
          onPress: () => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            deleteInspectionMut.mutate(inspection.id, {
              onSuccess: () => {
                showToast({
                  variant: "success",
                  title: t("inspections.detail.deleted", "Inspection deleted"),
                });
                router.back();
              },
              onError: (err) => {
                showToast({
                  variant: "error",
                  title: t(
                    "inspections.detail.deleteError",
                    "Failed to delete inspection",
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
              {t("inspections.detail.shareReport", "Share Report")}
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
                  {t("inspections.detail.delete", "Delete inspection")}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </Pressable>
    </Modal>
  );

  const fullscreenModal = (
    <Modal
      visible={fullscreen !== null}
      animationType="fade"
      transparent
      onRequestClose={() => setFullscreen(null)}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.92)",
          justifyContent: "center",
        }}
      >
        <View
          className="flex-row items-center justify-between"
          style={{
            paddingHorizontal: 16,
            paddingTop: insets.top + 6,
            paddingBottom: 16,
          }}
        >
          <Text
            variant="titleMedium"
            color="#FFFFFF"
            style={{ fontFamily: fontFamilies.semiBold }}
          >
            {fullscreen?.angleLabel ?? ""}
          </Text>
          <Pressable
            onPress={() => setFullscreen(null)}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "rgba(255,255,255,0.14)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <XIcon size={20} color="#FFFFFF" />
          </Pressable>
        </View>
        <Pressable
          className="flex-1 items-center justify-center"
          onPress={() => setFullscreen(null)}
        >
          <View
            style={{
              width: "90%",
              aspectRatio: 4 / 3,
              borderRadius: 20,
              backgroundColor: "#1f2937",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              overflow: "hidden",
            }}
          >
            {fullscreen?.photo?.url || fullscreen?.photo?.uri ? (
              <Image
                source={{
                  uri: (fullscreen.photo.url ?? fullscreen.photo.uri) as string,
                }}
                style={{ width: "100%", height: "100%" }}
                contentFit="contain"
                transition={200}
              />
            ) : (
              <Camera size={64} color="#FFFFFF" strokeWidth={1.2} />
            )}
            {fullscreen?.photo?.aiResult?.damagesFound ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: "rgba(239,68,68,0.3)",
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 9999,
                }}
              >
                <AlertTriangle size={14} color={theme.danger} />
                <Text
                  variant="bodySmall"
                  color={theme.danger}
                  style={{ fontFamily: fontFamilies.semiBold }}
                >
                  {fullscreen.photo.aiResult.damagesFound} détection(s)
                </Text>
              </View>
            ) : fullscreen?.photo ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: "rgba(16,185,129,0.3)",
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 9999,
                }}
              >
                <CheckCircle size={14} color={theme.success} />
                <Text
                  variant="bodySmall"
                  color={theme.success}
                  style={{ fontFamily: fontFamilies.semiBold }}
                >
                  OK
                </Text>
              </View>
            ) : (
              <Text variant="bodySmall" color="#9CA3AF">
                {t("inspections.detail.noNotes", "No photo available")}
              </Text>
            )}
          </View>
          <Text variant="caption" color="#9CA3AF" className="mt-4">
            {t("inspections.detail.closeFullscreen", "Tap anywhere to close")}
          </Text>
        </Pressable>
      </View>
    </Modal>
  );

  // ── Hero component (shared by single + paired) ─────────────────────────

  const HeroSection = (
    <Animated.View entering={FadeIn.duration(400)}>
      <View
        style={{
          width: SCREEN_WIDTH,
          height: heroTotalHeight,
          backgroundColor: theme.surfaceTertiary,
        }}
      >
        {vehicleImageUri ? (
          <Image
            source={vehicleImageUri}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={300}
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Camera size={60} color={theme.textTertiary} strokeWidth={1.3} />
          </View>
        )}

        <LinearGradient
          colors={["rgba(0,0,0,0.5)", "rgba(0,0,0,0)"]}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: insets.top + 80,
          }}
          pointerEvents="none"
        />

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

        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setMenuOpen(true);
          }}
          hitSlop={10}
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

        <View
          style={{
            position: "absolute",
            bottom: 14,
            alignSelf: "center",
            paddingHorizontal: 12,
            paddingVertical: 5,
            borderRadius: 9999,
            backgroundColor: "rgba(0,0,0,0.55)",
          }}
        >
          <Text
            variant="labelSmall"
            color="#FFFFFF"
            style={{ fontFamily: fontFamilies.semiBold, fontSize: 11 }}
          >
            #{inspection.id.slice(0, 8)}
          </Text>
        </View>
      </View>
    </Animated.View>
  );

  // ── Paired layout ───────────────────────────────────────────────────────

  if (pair) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <StatusBar style="light" />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}
        >
          {HeroSection}

          <Animated.View
            entering={FadeInDown.duration(420).delay(80)}
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
            <Text
              variant="headlineMedium"
              style={{
                fontFamily: fontFamilies.bold,
                fontSize: 22,
                lineHeight: 26,
              }}
              numberOfLines={1}
            >
              {pair.pre.vehicleName}
            </Text>
            <Text
              variant="bodySmall"
              color={theme.textTertiary}
              style={{ fontSize: 12, marginTop: 4 }}
              numberOfLines={1}
            >
              {pair.pre.vehicleId}
              {pair.pre.clientName ? ` · ${pair.pre.clientName}` : ""}
            </Text>
            <View
              className="flex-row flex-wrap"
              style={{ gap: 6, marginTop: 10 }}
            >
              <Chip
                label={t("inspections.preRental", "Pre-rental")}
                fg={theme.info}
                bg={theme.infoSoft}
              />
              <Chip
                label={t("inspections.postRental", "Post-rental")}
                fg={theme.warning}
                bg={theme.warningSoft}
              />
              <Chip
                label={t(
                  "inspections.detail.pairedSubtitle",
                  "Pre + Post-rental",
                )}
                fg={theme.accent}
                bg={theme.accentSoft}
              />
            </View>
          </Animated.View>

          {/* Compare toggle capsule */}
          <Animated.View
            entering={FadeInDown.duration(400).delay(140)}
            style={{ marginTop: 16, marginHorizontal: 16 }}
          >
            <View
              style={{
                flexDirection: "row",
                padding: 4,
                borderRadius: 9999,
                backgroundColor: theme.surfaceTertiary,
              }}
            >
              <CompareModePill
                active={!compareMode}
                label={t("inspections.detail.stackedView", "Stacked")}
                theme={theme}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setCompareMode(false);
                }}
              />
              <CompareModePill
                active={compareMode}
                label={t("inspections.detail.compare", "Compare")}
                icon={GitCompareArrows}
                theme={theme}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setCompareMode(true);
                }}
              />
            </View>
          </Animated.View>

          {/* Body */}
          {compareMode ? (
            <Animated.View
              entering={FadeInDown.duration(400).delay(200)}
              style={{ marginTop: 18, marginHorizontal: 16 }}
            >
              {renderCompareView(pair.pre, pair.post)}
            </Animated.View>
          ) : (
            <>
              <Animated.View
                entering={FadeInDown.duration(400).delay(200)}
                style={{ marginTop: 22, marginHorizontal: 16 }}
              >
                <View
                  className="flex-row items-center"
                  style={{ gap: 8, marginBottom: 10 }}
                >
                  <View
                    style={{
                      width: 4,
                      height: 18,
                      borderRadius: 2,
                      backgroundColor: theme.info,
                    }}
                  />
                  <Text
                    variant="titleMedium"
                    style={{
                      fontFamily: fontFamilies.semiBold,
                      fontSize: 15,
                    }}
                  >
                    {t(
                      "inspections.detail.preRentalTitle",
                      "State before rental",
                    )}
                  </Text>
                </View>
                {renderInspectionSection(pair.pre)}
              </Animated.View>

              <View
                style={{
                  height: 1,
                  backgroundColor: theme.border,
                  marginVertical: 22,
                  marginHorizontal: 16,
                }}
              />

              <Animated.View
                entering={FadeInDown.duration(400).delay(250)}
                style={{ marginHorizontal: 16 }}
              >
                <View
                  className="flex-row items-center"
                  style={{ gap: 8, marginBottom: 10 }}
                >
                  <View
                    style={{
                      width: 4,
                      height: 18,
                      borderRadius: 2,
                      backgroundColor: theme.warning,
                    }}
                  />
                  <Text
                    variant="titleMedium"
                    style={{
                      fontFamily: fontFamilies.semiBold,
                      fontSize: 15,
                    }}
                  >
                    {t(
                      "inspections.detail.postRentalTitle",
                      "State after rental",
                    )}
                  </Text>
                </View>
                {renderInspectionSection(pair.post)}
              </Animated.View>
            </>
          )}

          {/* Per-angle AI + manual review — post-rental only */}
          <Animated.View
            entering={FadeInDown.duration(400).delay(340)}
            style={{ marginTop: 22, marginHorizontal: 16 }}
          >
            <SectionLabel theme={theme}>
              {t("inspections.detail.angleReview.title", "Per-angle review")}
            </SectionLabel>
            {pair.post.aiSummary && pair.post.aiSummary.trim().length > 0 && (
              <View
                style={{
                  backgroundColor: theme.surface,
                  borderRadius: 14,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: theme.borderLight,
                  marginBottom: 12,
                }}
              >
                <View
                  className="flex-row items-center"
                  style={{ gap: 6, marginBottom: 4 }}
                >
                  <Sparkles size={14} color={theme.accent} />
                  <Text
                    variant="titleSmall"
                    style={{
                      fontFamily: fontFamilies.semiBold,
                      fontSize: 12,
                    }}
                  >
                    {t("inspections.detail.ai.summaryTitle", "AI summary")}
                  </Text>
                </View>
                <Text
                  variant="bodySmall"
                  color={theme.textSecondary}
                  style={{ fontSize: 12, lineHeight: 17 }}
                >
                  {pair.post.aiSummary}
                </Text>
              </View>
            )}
            <PrePostAngleList
              pre={pair.pre}
              post={pair.post}
              pendingAngles={pendingAiAngles}
              onRunAi={triggerAngleAi}
              onManualReview={(angle, angleLabel) =>
                setManualReview({ angle, angleLabel })
              }
            />
          </Animated.View>
        </ScrollView>
        {fullscreenModal}
        {manualModal}
        {menuModal}
      </View>
    );
  }

  // ── Single layout ──────────────────────────────────────────────────────

  const tone = typeTone(inspection.type, theme);
  const statusTone =
    inspection.status === "draft"
      ? { fg: theme.warning, bg: theme.warningSoft }
      : { fg: theme.success, bg: theme.successSoft };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar style="light" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}
      >
        {HeroSection}

        {/* Floating info card */}
        <Animated.View
          entering={FadeInDown.duration(420).delay(80)}
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
          <Text
            variant="headlineMedium"
            style={{
              fontFamily: fontFamilies.bold,
              fontSize: 22,
              lineHeight: 26,
            }}
            numberOfLines={1}
          >
            {inspection.vehicleName}
          </Text>
          <Text
            variant="bodySmall"
            color={theme.textTertiary}
            style={{ fontSize: 12, marginTop: 4 }}
            numberOfLines={1}
          >
            {formatDate(inspection.date, "long")} · {inspection.inspectorName}
            {inspection.clientName ? ` · ${inspection.clientName}` : ""}
          </Text>
          <View
            className="flex-row flex-wrap"
            style={{ gap: 6, marginTop: 10 }}
          >
            <Chip
              label={typeLabel(inspection.type, t)}
              fg={tone.fg}
              bg={tone.bg}
            />
            <Chip
              label={
                inspection.status === "draft"
                  ? t("inspections.draft", "Draft")
                  : t("inspections.completed", "Completed")
              }
              fg={statusTone.fg}
              bg={statusTone.bg}
            />
          </View>

          {/* 3-up mini stats */}
          <View className="flex-row" style={{ gap: 8, marginTop: 14 }}>
            <MiniStat
              icon={Camera}
              value={`${inspection.photos.length}/8`}
              label={t("inspections.detail.photos", "Photos")}
              tone={{ fg: theme.accent, bg: theme.accentSoft }}
              theme={theme}
            />
            <MiniStat
              icon={ScanLine}
              value={String(inspection.totalDamagesAI)}
              label={t("inspections.detail.aiDamages", "AI")}
              tone={
                inspection.totalDamagesAI > 0
                  ? { fg: theme.danger, bg: theme.dangerSoft }
                  : { fg: theme.success, bg: theme.successSoft }
              }
              theme={theme}
            />
            <MiniStat
              icon={PenTool}
              value={String(inspection.totalDamagesManual)}
              label={t("inspections.detail.manual", "Manual")}
              tone={{ fg: theme.info, bg: theme.infoSoft }}
              theme={theme}
            />
          </View>

          {/* Total banner */}
          <View
            className="flex-row items-center"
            style={{
              backgroundColor:
                totalDamages === 0 ? theme.successSoft : theme.dangerSoft,
              borderRadius: 14,
              padding: 12,
              marginTop: 14,
              gap: 8,
            }}
          >
            {totalDamages === 0 ? (
              <>
                <CheckCircle size={18} color={theme.success} />
                <Text
                  variant="titleMedium"
                  color={theme.success}
                  style={{ fontFamily: fontFamilies.semiBold, fontSize: 13 }}
                >
                  {t("inspections.detail.clean", "Clean inspection")}
                </Text>
              </>
            ) : (
              <>
                <AlertTriangle size={18} color={theme.danger} />
                <Text
                  variant="titleMedium"
                  color={theme.danger}
                  style={{ fontFamily: fontFamilies.semiBold, fontSize: 13 }}
                >
                  {totalDamages}{" "}
                  {t("inspections.detail.damagesFound", "damages found")}
                </Text>
              </>
            )}
          </View>
        </Animated.View>

        {/* Mileage & fuel */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(140)}
          style={{ marginTop: 16, marginHorizontal: 16 }}
        >
          <SectionLabel theme={theme}>
            {t("inspections.detail.mileageFuel", "Vehicle State")}
          </SectionLabel>
          <MileageFuelCard inspection={inspection} theme={theme} t={t} />
        </Animated.View>

        {/* Photo grid */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(200)}
          style={{ marginTop: 18, marginHorizontal: 16 }}
        >
          <View
            className="flex-row items-center justify-between"
            style={{ marginBottom: 8 }}
          >
            <SectionLabel theme={theme}>
              {t("inspections.detail.photosSection", "Photos")}
            </SectionLabel>
            <View style={{ marginBottom: 8, marginRight: 4 }}>
              <Chip
                label={`${inspection.photos.length}/8`}
                fg={theme.accent}
                bg={theme.accentSoft}
              />
            </View>
          </View>
          <View className="flex-row flex-wrap" style={{ gap: 10 }}>
            {PHOTO_ANGLES.map((angle) => (
              <View key={angle.key} style={{ width: "48.5%" }}>
                {renderPhotoTile(
                  angle.label,
                  photoByAngle.get(angle.key),
                  "100%",
                  4 / 3,
                )}
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Damage summary */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(260)}
          style={{ marginTop: 22, marginHorizontal: 16 }}
        >
          <SectionLabel theme={theme}>
            {t("inspections.detail.damageSummary", "Damage Summary")}
          </SectionLabel>

          {damages.length === 0 ? (
            <View className="py-6">
              <EmptyState
                icon={CheckCircle}
                title={t("inspections.detail.noDamage", "No damage detected")}
                subtitle={t(
                  "inspections.detail.noDamageDesc",
                  "All angles passed AI inspection",
                )}
              />
            </View>
          ) : (
            <View>
              {severityCounts.severe +
                severityCounts.moderate +
                severityCounts.minor >
                0 && (
                <View
                  className="flex-row"
                  style={{ gap: 6, marginBottom: 12, flexWrap: "wrap" }}
                >
                  {severityCounts.severe > 0 && (
                    <Chip
                      label={`${severityCounts.severe} ${t("inspections.detail.severe", "Severe")}`}
                      fg={theme.danger}
                      bg={theme.dangerSoft}
                    />
                  )}
                  {severityCounts.moderate > 0 && (
                    <Chip
                      label={`${severityCounts.moderate} ${t("inspections.detail.moderate", "Moderate")}`}
                      fg={theme.warning}
                      bg={theme.warningSoft}
                    />
                  )}
                  {severityCounts.minor > 0 && (
                    <Chip
                      label={`${severityCounts.minor} ${t("inspections.detail.minor", "Minor")}`}
                      fg={theme.info}
                      bg={theme.infoSoft}
                    />
                  )}
                </View>
              )}

              <View style={{ gap: 8 }}>
                {damages.map((damage, index) => (
                  <DamageRow
                    key={`${damage.angleLabel}-${damage.severity}-${index}`}
                    damage={damage}
                    theme={theme}
                  />
                ))}
              </View>
            </View>
          )}
        </Animated.View>

        {/* Notes */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(320)}
          style={{ marginTop: 22, marginHorizontal: 16 }}
        >
          <SectionLabel theme={theme}>
            {t("inspections.detail.notes", "Notes")}
          </SectionLabel>
          <View
            style={{
              backgroundColor: theme.surface,
              borderRadius: 16,
              padding: 14,
              borderWidth: 1,
              borderColor: theme.borderLight,
            }}
          >
            {inspection.notes.trim().length > 0 ? (
              <Text
                variant="bodyMedium"
                color={theme.textSecondary}
                style={{ fontSize: 13, lineHeight: 19 }}
              >
                {inspection.notes}
              </Text>
            ) : (
              <Text
                variant="bodyMedium"
                color={theme.textTertiary}
                style={{ fontSize: 13 }}
              >
                {t("inspections.detail.noNotes", "No notes added")}
              </Text>
            )}
          </View>
        </Animated.View>

        {/* AI + manual review require a paired pre-rental on the same booking. */}
        {inspection.type === "post-rental" && (
          <Animated.View
            entering={FadeInDown.duration(400).delay(350)}
            style={{ marginTop: 22, marginHorizontal: 16 }}
          >
            <SectionLabel theme={theme}>
              {t("inspections.detail.angleReview.title", "Per-angle review")}
            </SectionLabel>
            <View
              style={{
                backgroundColor: theme.warningSoft,
                borderRadius: 16,
                padding: 14,
                gap: 8,
                borderWidth: 1,
                borderColor: theme.borderLight,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <AlertTriangle size={18} color={theme.warning} />
              <Text
                variant="bodySmall"
                color={theme.warning}
                style={{ flex: 1, fontSize: 12, lineHeight: 17 }}
              >
                {t(
                  "inspections.detail.ai.needsPreRental",
                  "AI and manual review require a pre-rental inspection on the same booking.",
                )}
              </Text>
            </View>
          </Animated.View>
        )}

        {inspection.status === "draft" && (
          <Animated.View
            entering={FadeInDown.duration(400).delay(380)}
            style={{ marginTop: 26, marginHorizontal: 16 }}
          >
            <Button
              variant="secondary"
              fullWidth
              size="lg"
              leftIcon={Play}
              onPress={() => router.push("/(inspections)/new")}
            >
              {t("inspections.detail.resume", "Resume Inspection")}
            </Button>
          </Animated.View>
        )}
      </ScrollView>
      {fullscreenModal}
      {menuModal}
    </View>
  );
}

// ── Subcomponents ──────────────────────────────────────────────────────────

function MiniStat({
  icon: Icon,
  value,
  label,
  tone,
  theme,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
  tone: { fg: string; bg: string };
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.surfaceTertiary,
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 8,
        alignItems: "center",
      }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: tone.bg,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 4,
        }}
      >
        <Icon size={12} color={tone.fg} strokeWidth={2.2} />
      </View>
      <Text
        variant="titleMedium"
        color={tone.fg}
        style={{ fontFamily: fontFamilies.bold, fontSize: 15 }}
      >
        {value}
      </Text>
      <Text
        variant="caption"
        color={theme.textTertiary}
        style={{ fontSize: 10, marginTop: 1 }}
      >
        {label}
      </Text>
    </View>
  );
}

function MileageFuelCard({
  inspection,
  theme,
  t,
}: {
  inspection: Inspection;
  theme: ReturnType<typeof useTheme>;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const fuelColor =
    inspection.fuelLevel <= 25
      ? theme.danger
      : inspection.fuelLevel <= 50
        ? theme.warning
        : theme.success;
  const fuelBg =
    inspection.fuelLevel <= 25
      ? theme.dangerSoft
      : inspection.fuelLevel <= 50
        ? theme.warningSoft
        : theme.successSoft;

  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: theme.borderLight,
        flexDirection: "row",
        gap: 14,
      }}
    >
      <View style={{ flex: 1 }}>
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: theme.accentSoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Gauge size={12} color={theme.accent} strokeWidth={2.2} />
          </View>
          <Text
            variant="caption"
            color={theme.textTertiary}
            style={{ fontSize: 11 }}
          >
            {t("inspections.detail.mileage", "Mileage")}
          </Text>
        </View>
        <Text
          variant="headlineSmall"
          style={{
            fontFamily: fontFamilies.bold,
            fontSize: 18,
            marginTop: 6,
          }}
        >
          {formatMileage(inspection.mileage)}
        </Text>
      </View>
      <View
        style={{
          width: 1,
          backgroundColor: theme.border,
        }}
      />
      <View style={{ flex: 1 }}>
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: fuelBg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Fuel size={12} color={fuelColor} strokeWidth={2.2} />
          </View>
          <Text
            variant="caption"
            color={theme.textTertiary}
            style={{ fontSize: 11 }}
          >
            {t("inspections.detail.fuel", "Fuel Level")}
          </Text>
        </View>
        <Text
          variant="headlineSmall"
          style={{
            fontFamily: fontFamilies.bold,
            fontSize: 18,
            marginTop: 6,
          }}
        >
          {inspection.fuelLevel}%
        </Text>
        <ProgressBar
          progress={inspection.fuelLevel / 100}
          color={fuelColor}
          height={5}
          className="mt-2"
        />
      </View>
    </View>
  );
}

function DamageRow({
  damage,
  theme,
}: {
  damage: DamageEntry;
  theme: ReturnType<typeof useTheme>;
}) {
  const tone = severityTone(damage.severity, theme);
  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: theme.borderLight,
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: tone.fg,
          marginRight: 10,
        }}
      />
      <View style={{ flex: 1, marginRight: 8 }}>
        <Text
          variant="titleSmall"
          style={{ fontFamily: fontFamilies.semiBold, fontSize: 13 }}
          numberOfLines={1}
        >
          {damage.angleLabel}
        </Text>
        <Text
          variant="bodySmall"
          color={theme.textSecondary}
          style={{ fontSize: 12, marginTop: 2 }}
          numberOfLines={2}
        >
          {damage.description}
        </Text>
      </View>
      <Chip label={capitalize(damage.severity)} fg={tone.fg} bg={tone.bg} />
    </View>
  );
}

function CompareModePill({
  active,
  label,
  icon: Icon,
  theme,
  onPress,
}: {
  active: boolean;
  label: string;
  icon?: LucideIcon;
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
      {Icon && (
        <Icon
          size={14}
          color={active ? theme.accent : theme.textTertiary}
          strokeWidth={2}
        />
      )}
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

function StatDuoCard({
  title,
  subtitle,
  tone,
  theme,
  t,
}: {
  title: string;
  subtitle: string;
  tone: "info" | "warning";
  theme: ReturnType<typeof useTheme>;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: theme.borderLight,
      }}
    >
      <Text
        variant="caption"
        color={theme.textTertiary}
        style={{ fontSize: 11 }}
      >
        {t("inspections.detail.mileage", "Mileage")}
      </Text>
      <Text
        variant="titleMedium"
        style={{
          fontFamily: fontFamilies.bold,
          fontSize: 14,
          marginTop: 2,
        }}
      >
        {title}
      </Text>
      <Text
        variant="caption"
        color={tone === "info" ? theme.info : theme.warning}
        style={{
          fontSize: 11,
          marginTop: 6,
          fontFamily: fontFamilies.medium,
        }}
      >
        {subtitle}
      </Text>
    </View>
  );
}
