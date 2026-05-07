import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Pressable,
  Modal,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { Image } from "@/components/ui/Image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { X, Check, ImageIcon } from "lucide-react-native";

import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { useTheme } from "@/hooks/useTheme";
import { fontFamilies } from "@/theme/typography";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const ANGLES = [
  { key: "front", label: "Front" },
  { key: "front-right", label: "Front-Right" },
  { key: "right", label: "Right Side" },
  { key: "rear-right", label: "Rear-Right" },
  { key: "rear", label: "Rear" },
  { key: "rear-left", label: "Rear-Left" },
  { key: "left", label: "Left Side" },
  { key: "front-left", label: "Front-Left" },
];

// ── Types ────────────────────────────────────────────────────────────────────

export interface TaggedVehiclePhoto {
  angle: string;
  uri: string;
}

interface PhotoAngleTaggerProps {
  visible: boolean;
  assets: { uri: string }[];
  onClose: () => void;
  onComplete: (photos: TaggedVehiclePhoto[]) => void;
  /**
   * Fired the instant a photo is tagged with an angle. Lets the parent
   * kick off background uploads while the user keeps tagging the rest.
   * Re-tagging the same photo to a new angle fires twice (untag fires
   * with `null` so callers can cancel any in-flight upload).
   */
  onPhotoTagged?: (photo: {
    uri: string;
    angle: string | null;
    previousAngle: string | null;
  }) => void;
  /**
   * Angles already in use elsewhere (e.g. taken from the camera flow).
   * Hidden from the chip list to prevent duplicate angles in one set.
   */
  takenAngles?: string[];
  /**
   * When true, render the tagger in a loading state regardless of how many
   * assets have arrived. Used to give immediate feedback while the OS image
   * picker is still processing the user's selection.
   */
  loading?: boolean;
}

// ── Component ────────────────────────────────────────────────────────────────

export function PhotoAngleTagger({
  visible,
  assets,
  onClose,
  onComplete,
  onPhotoTagged,
  takenAngles = [],
  loading = false,
}: PhotoAngleTaggerProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [tags, setTags] = useState<(string | null)[]>([]);
  const [isPreparing, setIsPreparing] = useState(false);

  // Reset tags only when the asset count changes (parent passes a new array
  // identity each render; depending on .length keeps tags stable while typing).
  useEffect(() => {
    if (assets.length > 0) {
      setTags(new Array(assets.length).fill(null));
    }
  }, [assets.length]);

  // Warm the image cache when the tagger is opened so thumbnails appear
  // without flashing. Show a spinner while prefetching.
  useEffect(() => {
    if (!visible || assets.length === 0) {
      setIsPreparing(false);
      return;
    }
    let cancelled = false;
    setIsPreparing(true);
    void Promise.all(
      assets.map((a) => Image.prefetch(a.uri).catch(() => undefined)),
    ).finally(() => {
      if (!cancelled) setIsPreparing(false);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, assets]);

  const handleTag = useCallback(
    (index: number, angleKey: string) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const previous = tags[index] ?? null;
      const newAngle = previous === angleKey ? null : angleKey;
      setTags((prev) => {
        const next = [...prev];
        next[index] = newAngle;
        return next;
      });
      onPhotoTagged?.({
        uri: assets[index].uri,
        angle: newAngle,
        previousAngle: previous,
      });
    },
    [tags, assets, onPhotoTagged],
  );

  const allTagged = tags.length > 0 && tags.every((t) => t !== null);

  const handleComplete = useCallback(() => {
    const photos: TaggedVehiclePhoto[] = assets
      .map((asset, i) => {
        const angle = tags[i];
        if (!angle) return null;
        return { angle, uri: asset.uri };
      })
      .filter((p): p is TaggedVehiclePhoto => p !== null);

    onComplete(photos);
    setTags([]);
  }, [assets, tags, onComplete]);

  const handleClose = useCallback(() => {
    setTags([]);
    onClose();
  }, [onClose]);

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <View
        style={{
          flex: 1,
          backgroundColor: theme.background,
        }}
      >
        {/* Header */}
        <View
          style={{
            paddingTop: insets.top + 12,
            paddingHorizontal: 16,
            paddingBottom: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottomWidth: 1,
            borderBottomColor: theme.borderLight,
          }}
        >
          <Pressable
            onPress={handleClose}
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
            <X size={20} color={theme.textPrimary} strokeWidth={2.5} />
          </Pressable>

          <Text
            variant="headlineSmall"
            style={{ fontFamily: fontFamilies.semiBold, fontSize: 17 }}
          >
            Assign Angles
          </Text>

          <View style={{ width: 40 }} />
        </View>

        {/* Content */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: insets.bottom + 100,
            gap: 20,
          }}
        >
          {assets.length === 0 ? (
            loading ? null : (
              <View
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  paddingVertical: 60,
                  gap: 12,
                }}
              >
                <ImageIcon size={40} color={theme.textTertiary} />
                <Text
                  variant="bodyMedium"
                  color={theme.textTertiary}
                  align="center"
                >
                  No images selected
                </Text>
              </View>
            )
          ) : (
            assets.map((asset, index) => (
              <View
                key={`${asset.uri}-${index}`}
                style={{
                  backgroundColor: theme.surface,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: theme.borderLight,
                  overflow: "hidden",
                }}
              >
                {/* Image */}
                <Image
                  source={{ uri: asset.uri }}
                  style={{
                    width: "100%",
                    height: SCREEN_WIDTH * 0.55,
                  }}
                  contentFit="cover"
                />

                {/* Angle selector */}
                <View style={{ padding: 14, gap: 10 }}>
                  <Text
                    variant="bodySmall"
                    color={theme.textSecondary}
                    style={{ fontFamily: fontFamilies.medium }}
                  >
                    Select angle
                  </Text>

                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    {ANGLES.filter((angle) => {
                      // Always show the angle this photo is currently tagged with.
                      if (tags[index] === angle.key) return true;
                      // Hide angles already used externally.
                      if (takenAngles.includes(angle.key)) return false;
                      // Hide angles assigned to OTHER photos in this batch.
                      if (tags.some((t, i) => i !== index && t === angle.key)) {
                        return false;
                      }
                      return true;
                    }).map((angle) => {
                      const selected = tags[index] === angle.key;
                      return (
                        <Pressable
                          key={angle.key}
                          onPress={() => handleTag(index, angle.key)}
                          style={{
                            paddingHorizontal: 16,
                            paddingVertical: 9,
                            borderRadius: 9999,
                            backgroundColor: selected
                              ? theme.accent
                              : theme.surfaceTertiary,
                            borderWidth: 1,
                            borderColor: selected
                              ? theme.accent
                              : theme.borderLight,
                          }}
                        >
                          <Text
                            variant="labelSmall"
                            color={selected ? "#fff" : theme.textSecondary}
                            style={{
                              fontFamily: fontFamilies.semiBold,
                              fontSize: 12,
                            }}
                          >
                            {angle.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* Status */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      marginTop: 4,
                    }}
                  >
                    {tags[index] ? (
                      <>
                        <Check size={14} color={theme.success} />
                        <Text
                          variant="caption"
                          color={theme.success}
                          style={{ fontFamily: fontFamilies.medium }}
                        >
                          {ANGLES.find((a) => a.key === tags[index])?.label}
                        </Text>
                      </>
                    ) : (
                      <Text variant="caption" color={theme.textTertiary}>
                        Tap an angle to tag this photo
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>

        {/* Bottom action */}
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            paddingHorizontal: 16,
            paddingBottom: insets.bottom + 16,
            paddingTop: 12,
            backgroundColor: theme.background,
            borderTopWidth: 1,
            borderTopColor: theme.borderLight,
          }}
        >
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={!allTagged || isPreparing || loading}
            onPress={handleComplete}
          >
            {allTagged
              ? `Save ${assets.length} photo${assets.length > 1 ? "s" : ""}`
              : "Tag all photos"}
          </Button>
        </View>

        {/* Loading overlay while prefetching newly-picked images */}
        {(isPreparing || loading) && (
          <View
            pointerEvents="auto"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.35)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                paddingHorizontal: 22,
                paddingVertical: 18,
                borderRadius: 16,
                backgroundColor: theme.surface,
                alignItems: "center",
                gap: 10,
                minWidth: 160,
              }}
            >
              <ActivityIndicator size="small" color={theme.accent} />
              <Text
                variant="bodySmall"
                color={theme.textSecondary}
                style={{ fontSize: 12, fontFamily: fontFamilies.medium }}
              >
                {loading ? "Loading photos…" : "Preparing photos…"}
              </Text>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}
