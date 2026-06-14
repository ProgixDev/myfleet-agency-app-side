import React from "react";
import { View, Pressable, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { Image } from "@/components/ui/Image";
import { Text } from "@/components/ui/Text";
import {
  Camera,
  Sparkles,
  PenTool,
  CheckCircle,
  AlertTriangle,
} from "lucide-react-native";
import { useTheme } from "@/hooks/useTheme";
import { fontFamilies } from "@/theme/typography";
import {
  PHOTO_ANGLES,
  type CapturedPhoto,
  type Inspection,
  type PhotoAngle,
  type AIInspectionStatus,
} from "@/types/inspection";

interface Props {
  // Optional pre-rental baseline. When omitted, each angle renders a single
  // photo (the inspection's own) and the AI runs in absolute-detection mode
  // (no paired pre-rental required).
  pre?: Inspection | null;
  post: Inspection;
  pendingAngles: Set<PhotoAngle>;
  onRunAi: (angle: PhotoAngle) => void;
  onManualReview: (angle: PhotoAngle, angleLabel: string) => void;
}

export function PrePostAngleList({
  pre,
  post,
  pendingAngles,
  onRunAi,
  onManualReview,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation();

  const isPaired = !!pre;
  const preMap = React.useMemo(() => {
    const m = new Map<PhotoAngle, CapturedPhoto>();
    for (const p of pre?.photos ?? []) m.set(p.angle, p);
    return m;
  }, [pre?.photos]);
  const postMap = React.useMemo(() => {
    const m = new Map<PhotoAngle, CapturedPhoto>();
    for (const p of post.photos) m.set(p.angle, p);
    return m;
  }, [post.photos]);

  return (
    <View style={{ gap: 12 }}>
      {PHOTO_ANGLES.map(({ key: angle, label }) => {
        const prePhoto = preMap.get(angle);
        const postPhoto = postMap.get(angle);
        const status: AIInspectionStatus =
          (postPhoto?.aiStatus as AIInspectionStatus | undefined) ?? "idle";
        const isPending =
          pendingAngles.has(angle) ||
          status === "running" ||
          status === "queued";
        const canRunAi = !!postPhoto && !isPending;

        return (
          <View
            key={angle}
            style={{
              backgroundColor: theme.surface,
              borderRadius: 16,
              padding: 12,
              borderWidth: 1,
              borderColor: theme.borderLight,
              gap: 10,
            }}
          >
            <View
              className="flex-row items-center"
              style={{ justifyContent: "space-between" }}
            >
              <Text
                variant="titleSmall"
                style={{ fontFamily: fontFamilies.semiBold, fontSize: 13 }}
                numberOfLines={1}
              >
                {label}
              </Text>
              <StatusPill
                status={status}
                damages={postPhoto?.aiResult?.damagesFound ?? 0}
                annotations={postPhoto?.annotations.length ?? 0}
                error={postPhoto?.aiError ?? null}
              />
            </View>

            <View className="flex-row" style={{ gap: 8 }}>
              {isPaired && (
                <PhotoTile
                  photo={prePhoto}
                  tag={t("inspections.detail.pre", "Pre")}
                  tone={theme.info}
                />
              )}
              <PhotoTile
                photo={postPhoto}
                tag={isPaired ? t("inspections.detail.post", "Post") : undefined}
                tone={theme.warning}
              />
            </View>

            {postPhoto?.aiError && status === "failed" && (
              <Text
                variant="bodySmall"
                color={theme.danger}
                style={{ fontSize: 11, lineHeight: 15 }}
                numberOfLines={3}
              >
                {postPhoto.aiError}
              </Text>
            )}

            <View className="flex-row" style={{ gap: 8 }}>
              <ActionButton
                label={
                  status === "completed"
                    ? t("inspections.detail.angle.rerunAi", "Re-run AI")
                    : t("inspections.detail.angle.runAi", "Run AI")
                }
                icon={Sparkles}
                tone="primary"
                onPress={() => onRunAi(angle)}
                disabled={!canRunAi}
                pending={isPending}
              />
              <ActionButton
                label={t("inspections.detail.angle.manual", "Manual review")}
                icon={PenTool}
                tone="secondary"
                onPress={() => onManualReview(angle, label)}
                disabled={!postPhoto}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function PhotoTile({
  photo,
  tag,
  tone,
}: {
  photo: CapturedPhoto | undefined;
  tag?: string;
  tone: string;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        aspectRatio: 4 / 3,
        borderRadius: 12,
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
          <Camera size={20} color={theme.border} strokeWidth={1.2} />
        </View>
      )}
      {tag ? (
        <View
          style={{
            position: "absolute",
            top: 6,
            left: 6,
            paddingHorizontal: 7,
            paddingVertical: 2,
            borderRadius: 9999,
            backgroundColor: tone,
          }}
        >
          <Text
            variant="labelSmall"
            color="#FFFFFF"
            style={{ fontSize: 9, fontFamily: fontFamilies.semiBold }}
          >
            {tag}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function StatusPill({
  status,
  damages,
  annotations,
  error: _error,
}: {
  status: AIInspectionStatus;
  damages: number;
  annotations: number;
  error: string | null;
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  if (status === "running" || status === "queued") {
    return (
      <View
        className="flex-row items-center"
        style={{
          gap: 5,
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 9999,
          backgroundColor: theme.infoSoft,
        }}
      >
        <ActivityIndicator size="small" color={theme.info} />
        <Text
          variant="labelSmall"
          color={theme.info}
          style={{ fontSize: 10, fontFamily: fontFamilies.semiBold }}
        >
          {t("inspections.detail.angle.status.running", "Running")}
        </Text>
      </View>
    );
  }
  if (status === "failed") {
    return (
      <Pill
        bg={theme.dangerSoft}
        fg={theme.danger}
        icon={<AlertTriangle size={10} color={theme.danger} />}
        label={t("inspections.detail.angle.status.failed", "Failed")}
      />
    );
  }
  if (status === "completed") {
    if (damages > 0) {
      return (
        <Pill
          bg={theme.dangerSoft}
          fg={theme.danger}
          icon={<AlertTriangle size={10} color={theme.danger} />}
          label={`${damages} ${t("inspections.detail.angle.status.damages", "damage")}`}
        />
      );
    }
    return (
      <Pill
        bg={theme.successSoft}
        fg={theme.success}
        icon={<CheckCircle size={10} color={theme.success} />}
        label={t("inspections.detail.angle.status.clean", "Clean")}
      />
    );
  }
  if (annotations > 0) {
    return (
      <Pill
        bg={theme.infoSoft}
        fg={theme.info}
        icon={<PenTool size={10} color={theme.info} />}
        label={`${annotations}`}
      />
    );
  }
  return (
    <Pill
      bg={theme.surfaceTertiary}
      fg={theme.textTertiary}
      label={t("inspections.detail.angle.status.idle", "Not reviewed")}
    />
  );
}

function Pill({
  bg,
  fg,
  icon,
  label,
}: {
  bg: string;
  fg: string;
  icon?: React.ReactNode;
  label: string;
}) {
  return (
    <View
      className="flex-row items-center"
      style={{
        gap: 5,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 9999,
        backgroundColor: bg,
      }}
    >
      {icon}
      <Text
        variant="labelSmall"
        color={fg}
        style={{ fontSize: 10, fontFamily: fontFamilies.semiBold }}
      >
        {label}
      </Text>
    </View>
  );
}

function ActionButton({
  label,
  icon: Icon,
  tone,
  onPress,
  disabled,
  pending,
}: {
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  tone: "primary" | "secondary";
  onPress: () => void;
  disabled?: boolean;
  pending?: boolean;
}) {
  const theme = useTheme();
  const bg =
    tone === "primary"
      ? disabled
        ? theme.accentSoft
        : theme.accent
      : theme.surfaceTertiary;
  const fg = tone === "primary" ? "#FFFFFF" : theme.textPrimary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        flex: 1,
        height: 38,
        borderRadius: 10,
        backgroundColor: bg,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        opacity: disabled ? 0.55 : 1,
        transform: [{ scale: pressed && !disabled ? 0.97 : 1 }],
      })}
    >
      {pending ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <Icon size={14} color={fg} />
      )}
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
