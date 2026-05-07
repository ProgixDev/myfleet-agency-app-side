import React, { useState } from "react";
import {
  View,
  Modal,
  Pressable,
  ScrollView,
  type LayoutChangeEvent,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "@/components/ui/Image";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Camera, X as XIcon, PenTool } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/hooks/useTheme";
import { fontFamilies } from "@/theme/typography";
import { useToastStore } from "@/components/ui/Toast";
import { addAnnotation } from "@/services/inspectionService";
import { inspectionKeys } from "@/hooks/useInspections";
import type {
  CapturedPhoto,
  DamageSeverity,
  DamageType,
  PhotoAngle,
} from "@/types/inspection";

const DAMAGE_TYPES: DamageType[] = [
  "scratch",
  "dent",
  "crack",
  "paint",
  "stain",
  "other",
];
const SEVERITIES: DamageSeverity[] = ["minor", "moderate", "severe"];

interface Props {
  inspectionId: string;
  angle: PhotoAngle | null;
  angleLabel: string;
  postPhoto: CapturedPhoto | undefined;
  prePhoto: CapturedPhoto | undefined;
  onClose: () => void;
}

export function ManualAngleReviewModal({
  inspectionId,
  angle,
  angleLabel,
  postPhoto,
  prePhoto,
  onClose,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const showToast = useToastStore((s) => s.show);

  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [type, setType] = useState<DamageType>("scratch");
  const [severity, setSeverity] = useState<DamageSeverity>("minor");
  const [description, setDescription] = useState("");
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);

  const visible = angle !== null;

  const reset = () => {
    setPendingPin(null);
    setType("scratch");
    setSeverity("minor");
    setDescription("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!angle || !pendingPin) throw new Error("No annotation in progress");
      const res = await addAnnotation(inspectionId, angle, {
        x: pendingPin.x,
        y: pendingPin.y,
        type,
        severity,
        description,
      });
      if (!res.data) throw new Error("Failed to save annotation");
      return res.data;
    },
    onSuccess: (data) => {
      qc.setQueryData(inspectionKeys.detail(inspectionId), data);
      void qc.invalidateQueries({ queryKey: inspectionKeys.all });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast({
        variant: "success",
        title: t("inspections.detail.manual.savedTitle", "Damage saved"),
      });
      reset();
    },
    onError: (err) => {
      showToast({
        variant: "error",
        title: t("inspections.detail.manual.errorTitle", "Save failed"),
        message: err instanceof Error ? err.message : String(err),
      });
    },
  });

  const onImageLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setImgSize({ w: width, h: height });
  };

  const onImagePress = (evt: {
    nativeEvent: { locationX: number; locationY: number };
  }) => {
    if (!imgSize) return;
    const x = Math.max(0, Math.min(1, evt.nativeEvent.locationX / imgSize.w));
    const y = Math.max(0, Math.min(1, evt.nativeEvent.locationY / imgSize.h));
    setPendingPin({ x, y });
    void Haptics.selectionAsync();
  };

  const annotations = postPhoto?.annotations ?? [];
  const photoSrc = postPhoto?.url ?? postPhoto?.uri;
  const preSrc = prePhoto?.url ?? prePhoto?.uri;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
      transparent={false}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: theme.background,
          paddingTop: insets.top,
        }}
      >
        {/* Header */}
        <View
          className="flex-row items-center"
          style={{
            paddingHorizontal: 14,
            paddingVertical: 10,
            justifyContent: "space-between",
          }}
        >
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <PenTool size={16} color={theme.accent} />
            <Text
              variant="titleMedium"
              style={{ fontFamily: fontFamilies.semiBold, fontSize: 15 }}
            >
              {t("inspections.detail.manual.title", "Manual review")} ·{" "}
              {angleLabel}
            </Text>
          </View>
          <Pressable
            onPress={handleClose}
            hitSlop={10}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: theme.surfaceTertiary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <XIcon size={18} color={theme.textPrimary} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Post photo with overlay */}
          <View
            style={{
              marginHorizontal: 14,
              borderRadius: 16,
              overflow: "hidden",
              backgroundColor: theme.surfaceTertiary,
              aspectRatio: 4 / 3,
            }}
            onLayout={onImageLayout}
          >
            {photoSrc ? (
              <Pressable onPress={onImagePress} style={{ flex: 1 }}>
                <Image
                  source={{ uri: photoSrc }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                  transition={200}
                />
                {annotations.map((a) => (
                  <Marker
                    key={a.id}
                    x={a.x}
                    y={a.y}
                    color={severityColor(a.severity, theme)}
                  />
                ))}
                {pendingPin && (
                  <Marker
                    x={pendingPin.x}
                    y={pendingPin.y}
                    color={theme.accent}
                    pulse
                  />
                )}
              </Pressable>
            ) : (
              <View className="flex-1 items-center justify-center">
                <Camera size={32} color={theme.border} />
              </View>
            )}
          </View>

          {/* Pre photo thumbnail for reference */}
          {preSrc && (
            <View
              style={{
                marginTop: 10,
                marginHorizontal: 14,
                flexDirection: "row",
                gap: 10,
                alignItems: "center",
              }}
            >
              <View
                style={{
                  width: 56,
                  height: 42,
                  borderRadius: 8,
                  overflow: "hidden",
                  backgroundColor: theme.surfaceTertiary,
                }}
              >
                <Image
                  source={{ uri: preSrc }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                />
              </View>
              <Text
                variant="caption"
                color={theme.textTertiary}
                style={{ fontSize: 11, flex: 1 }}
              >
                {t(
                  "inspections.detail.manual.preReference",
                  "Pre-rental reference. Tap on the post photo to drop a damage marker.",
                )}
              </Text>
            </View>
          )}

          {/* Annotation editor (only when a pin is placed) */}
          {pendingPin ? (
            <View
              style={{
                margin: 14,
                padding: 14,
                borderRadius: 16,
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.borderLight,
                gap: 12,
              }}
            >
              <Text
                variant="titleSmall"
                style={{ fontFamily: fontFamilies.semiBold, fontSize: 13 }}
              >
                {t("inspections.detail.manual.newDamage", "New damage")}
              </Text>

              <View>
                <Text
                  variant="caption"
                  color={theme.textTertiary}
                  style={{ fontSize: 11, marginBottom: 6 }}
                >
                  {t("inspections.detail.manual.type", "Type")}
                </Text>
                <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                  {DAMAGE_TYPES.map((dt) => (
                    <SelectChip
                      key={dt}
                      label={t(`inspections.detail.manual.types.${dt}`, dt)}
                      active={type === dt}
                      onPress={() => setType(dt)}
                    />
                  ))}
                </View>
              </View>

              <View>
                <Text
                  variant="caption"
                  color={theme.textTertiary}
                  style={{ fontSize: 11, marginBottom: 6 }}
                >
                  {t("inspections.detail.manual.severity", "Severity")}
                </Text>
                <View className="flex-row" style={{ gap: 6 }}>
                  {SEVERITIES.map((s) => (
                    <SelectChip
                      key={s}
                      label={t(`inspections.detail.manual.severities.${s}`, s)}
                      active={severity === s}
                      onPress={() => setSeverity(s)}
                      tone={severityColor(s, theme)}
                    />
                  ))}
                </View>
              </View>

              <Input
                placeholder={t(
                  "inspections.detail.manual.descriptionPlaceholder",
                  "Description (optional)",
                )}
                value={description}
                onChangeText={setDescription}
                multiline
              />

              <View className="flex-row" style={{ gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Button
                    variant="secondary"
                    fullWidth
                    size="md"
                    onPress={() => setPendingPin(null)}
                    disabled={mutation.isPending}
                  >
                    {t("common.cancel", "Cancel")}
                  </Button>
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    variant="primary"
                    fullWidth
                    size="md"
                    onPress={() => mutation.mutate()}
                    disabled={mutation.isPending}
                  >
                    {mutation.isPending
                      ? t("common.saving", "Saving…")
                      : t("inspections.detail.manual.save", "Save damage")}
                  </Button>
                </View>
              </View>
            </View>
          ) : (
            <Text
              variant="caption"
              color={theme.textTertiary}
              style={{
                textAlign: "center",
                marginTop: 14,
                fontSize: 12,
              }}
            >
              {t(
                "inspections.detail.manual.tapToAdd",
                "Tap on the photo to add a damage marker.",
              )}
            </Text>
          )}

          {/* Existing annotations list */}
          {annotations.length > 0 && (
            <View style={{ marginTop: 18, marginHorizontal: 14, gap: 6 }}>
              <Text
                variant="caption"
                color={theme.textTertiary}
                style={{ fontSize: 11 }}
              >
                {t(
                  "inspections.detail.manual.existing",
                  "Existing annotations",
                )}
              </Text>
              {annotations.map((a) => (
                <View
                  key={a.id}
                  style={{
                    backgroundColor: theme.surface,
                    borderRadius: 10,
                    padding: 10,
                    borderWidth: 1,
                    borderColor: theme.borderLight,
                    flexDirection: "row",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: severityColor(
                        a.severity as DamageSeverity,
                        theme,
                      ),
                    }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      variant="bodySmall"
                      style={{ fontSize: 12 }}
                      numberOfLines={1}
                    >
                      {a.type} · {a.severity}
                    </Text>
                    {a.description?.length > 0 && (
                      <Text
                        variant="caption"
                        color={theme.textSecondary}
                        style={{ fontSize: 11 }}
                        numberOfLines={2}
                      >
                        {a.description}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function Marker({
  x,
  y,
  color,
  pulse,
}: {
  x: number;
  y: number;
  color: string;
  pulse?: boolean;
}) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        width: 22,
        height: 22,
        marginLeft: -11,
        marginTop: -11,
        borderRadius: 11,
        backgroundColor: pulse ? `${color}55` : `${color}33`,
        borderWidth: 2,
        borderColor: color,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

function SelectChip({
  label,
  active,
  onPress,
  tone,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  tone?: string;
}) {
  const theme = useTheme();
  const fg = active ? "#FFFFFF" : theme.textSecondary;
  const bg = active ? (tone ?? theme.accent) : theme.surfaceTertiary;
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 9999,
        backgroundColor: bg,
      }}
    >
      <Text
        variant="labelSmall"
        color={fg}
        style={{ fontSize: 12, fontFamily: fontFamilies.semiBold }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function severityColor(
  severity: DamageSeverity,
  theme: ReturnType<typeof useTheme>,
): string {
  switch (severity) {
    case "minor":
      return theme.info;
    case "moderate":
      return theme.warning;
    case "severe":
      return theme.danger;
  }
}
