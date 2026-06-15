import React from "react";
import { View, Pressable, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { Check, X, Sparkles } from "lucide-react-native";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/hooks/useTheme";
import { fontFamilies } from "@/theme/typography";
import { PHOTO_ANGLES, type Inspection } from "@/types/inspection";

type Verdict = "confirm" | "reject";

/**
 * Data flywheel UI: lists each AI damage finding and lets the inspector confirm
 * ("real damage") or reject ("not damage"). Each verdict is sent to the backend
 * as a labelled example that trains + evaluates the model. Confirming/rejecting
 * teaches the AI on THIS agency's real cars over time.
 */
export function AiFindingsReview({
  inspection,
  pending,
  onFeedback,
}: {
  inspection: Inspection;
  pending: Set<string>;
  onFeedback: (markerId: string, verdict: Verdict) => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  const angleLabel = (angle: string) =>
    PHOTO_ANGLES.find((a) => a.key === angle)?.label ?? angle;

  const rows = inspection.photos.flatMap((p) =>
    (p.aiResult?.markers ?? [])
      .filter((m) => m.id)
      .map((m) => ({ marker: m, angle: p.angle })),
  );

  if (rows.length === 0) return null;

  return (
    <View style={{ marginTop: 22, marginHorizontal: 16 }} testID="ai-findings-review">
      <View
        className="flex-row items-center"
        style={{ gap: 6, marginBottom: 8 }}
      >
        <Sparkles size={14} color={theme.accent} />
        <Text
          variant="labelSmall"
          style={{
            fontFamily: fontFamilies.semiBold,
            textTransform: "uppercase",
            letterSpacing: 0.6,
            fontSize: 11,
            color: theme.textSecondary,
          }}
        >
          {t("inspections.detail.ai.reviewTitle", "Review AI findings")}
        </Text>
      </View>
      <Text
        variant="bodySmall"
        color={theme.textTertiary}
        style={{ fontSize: 11, lineHeight: 15, marginBottom: 10 }}
      >
        {t(
          "inspections.detail.ai.reviewHint",
          "Confirm real damage or reject false alarms — it trains the AI on your fleet.",
        )}
      </Text>

      <View style={{ gap: 8 }}>
        {rows.map(({ marker, angle }) => {
          const id = marker.id as string;
          const isPending = pending.has(id);
          return (
            <View
              key={id}
              style={{
                backgroundColor: theme.surface,
                borderRadius: 14,
                padding: 12,
                borderWidth: 1,
                borderColor: theme.borderLight,
                gap: 10,
              }}
            >
              <View style={{ gap: 2 }}>
                <Text
                  variant="titleSmall"
                  style={{ fontFamily: fontFamilies.semiBold, fontSize: 13 }}
                >
                  {angleLabel(angle)}
                  {marker.damageClass ? ` · ${marker.damageClass}` : ""}
                </Text>
                {marker.description ? (
                  <Text
                    variant="bodySmall"
                    color={theme.textSecondary}
                    style={{ fontSize: 12, lineHeight: 16 }}
                    numberOfLines={3}
                  >
                    {marker.description}
                  </Text>
                ) : null}
              </View>

              <View className="flex-row" style={{ gap: 8 }}>
                <FeedbackButton
                  label={t("inspections.detail.ai.confirmDamage", "Real damage")}
                  icon={Check}
                  tone="confirm"
                  disabled={isPending}
                  pending={isPending}
                  onPress={() => onFeedback(id, "confirm")}
                  testID={`ai-confirm-${id}`}
                />
                <FeedbackButton
                  label={t("inspections.detail.ai.rejectDamage", "Not damage")}
                  icon={X}
                  tone="reject"
                  disabled={isPending}
                  onPress={() => onFeedback(id, "reject")}
                  testID={`ai-reject-${id}`}
                />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function FeedbackButton({
  label,
  icon: Icon,
  tone,
  onPress,
  disabled,
  pending,
  testID,
}: {
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  tone: "confirm" | "reject";
  onPress: () => void;
  disabled?: boolean;
  pending?: boolean;
  testID?: string;
}) {
  const theme = useTheme();
  const fg = tone === "confirm" ? theme.success : theme.danger;
  const bg = tone === "confirm" ? theme.successSoft : theme.dangerSoft;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
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
        <Icon size={15} color={fg} />
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
