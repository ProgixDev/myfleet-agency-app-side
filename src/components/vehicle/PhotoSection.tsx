import React, { useCallback } from "react";
import {
  View,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Image } from "@/components/ui/Image";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  Camera,
  X,
  ImageIcon,
  Check,
  AlertCircle,
  RotateCcw,
} from "lucide-react-native";

import { Text } from "@/components/ui/Text";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useTheme } from "@/hooks/useTheme";
import { fontFamilies } from "@/theme/typography";
import type { ManagedPhoto } from "./useVehiclePhotoUploads";

interface PhotoSectionProps {
  photos: ManagedPhoto[];
  onRetry: (angle: string, uri: string) => void;
  onPreview: (uri: string) => void;
  onRemove: (angle: string) => void;
  onRetake: (angle: string) => void;
  showSheet: boolean;
  onOpenSheet: () => void;
  onCloseSheet: () => void;
  onTakePhotos: () => void;
  onUploadFromLibrary: () => void;
  sectionTitle: string;
  addLabel: string;
}

export function PhotoSection({
  photos,
  onRetry,
  onPreview,
  onRemove,
  onRetake,
  showSheet,
  onOpenSheet,
  onCloseSheet,
  onTakePhotos,
  onUploadFromLibrary,
  sectionTitle,
  addLabel,
}: PhotoSectionProps) {
  const theme = useTheme();

  const handleRemovePhoto = useCallback(
    (photo: ManagedPhoto) => {
      Alert.alert(photo.angle, "Remove this photo or retake it?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => onRemove(photo.angle),
        },
        { text: "Retake", onPress: () => onRetake(photo.angle) },
      ]);
    },
    [onRemove, onRetake],
  );

  return (
    <>
      <Animated.View className="mb-2">
        <View className="flex-row items-center justify-between">
          <Text
            variant="labelLarge"
            color={theme.textSecondary}
            className="mb-3"
          >
            {sectionTitle}
          </Text>
          {photos.length > 0 && (
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 9999,
                backgroundColor: theme.accentSoft,
                marginBottom: 12,
              }}
            >
              <Text
                variant="labelSmall"
                color={theme.accent}
                style={{ fontFamily: fontFamilies.semiBold, fontSize: 11 }}
              >
                {photos.length}
              </Text>
            </View>
          )}
        </View>
      </Animated.View>

      {photos.length > 0 && (
        <Animated.View entering={FadeInDown.delay(100).duration(300)}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingRight: 4 }}
            className="mb-3"
          >
            {photos.map((photo) => {
              const isUploading = photo.status === "uploading";
              const isFailed = photo.status === "failed";
              const isUploaded = photo.status === "uploaded";
              const borderColor = isFailed
                ? theme.danger
                : isUploaded
                  ? theme.success
                  : "transparent";
              return (
                <View
                  key={`${photo.angle}-${photo.uri}`}
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: 14,
                    overflow: "hidden",
                    backgroundColor: theme.surfaceTertiary,
                    borderWidth: 1.5,
                    borderColor,
                  }}
                >
                  <Pressable
                    onPress={() =>
                      isFailed
                        ? onRetry(photo.angle, photo.uri)
                        : onPreview(photo.uri)
                    }
                    style={{ width: "100%", height: "100%" }}
                  >
                    <Image
                      source={{ uri: photo.uri }}
                      style={{
                        width: "100%",
                        height: "100%",
                        opacity: isUploading || isFailed ? 0.6 : 1,
                      }}
                      contentFit="cover"
                    />
                  </Pressable>

                  {isUploading && (
                    <>
                      <View
                        style={{
                          position: "absolute",
                          inset: 0,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <ActivityIndicator size="small" color="#fff" />
                        <Text
                          variant="caption"
                          color="#fff"
                          style={{
                            marginTop: 4,
                            fontFamily: fontFamilies.semiBold,
                            fontSize: 10,
                          }}
                        >
                          {Math.round(photo.progress * 100)}%
                        </Text>
                      </View>
                      <View
                        style={{
                          position: "absolute",
                          bottom: 0,
                          left: 0,
                          right: 0,
                          height: 3,
                          backgroundColor: "rgba(255,255,255,0.25)",
                        }}
                      >
                        <View
                          style={{
                            height: "100%",
                            width: `${Math.round(photo.progress * 100)}%`,
                            backgroundColor: theme.accent,
                          }}
                        />
                      </View>
                    </>
                  )}

                  {isFailed && (
                    <View
                      style={{
                        position: "absolute",
                        inset: 0,
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                      }}
                    >
                      <AlertCircle
                        size={22}
                        color={theme.danger}
                        strokeWidth={2.5}
                      />
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        <RotateCcw size={10} color="#fff" strokeWidth={2.5} />
                        <Text
                          variant="caption"
                          color="#fff"
                          style={{
                            fontFamily: fontFamilies.semiBold,
                            fontSize: 9,
                          }}
                        >
                          Retry
                        </Text>
                      </View>
                    </View>
                  )}

                  {isUploaded && (
                    <View
                      style={{
                        position: "absolute",
                        top: 4,
                        left: 4,
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        backgroundColor: theme.success,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Check size={11} color="#fff" strokeWidth={3} />
                    </View>
                  )}

                  <View
                    style={{
                      position: "absolute",
                      bottom: 6,
                      left: 6,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 9999,
                      backgroundColor: "rgba(0,0,0,0.6)",
                    }}
                  >
                    <Text
                      variant="caption"
                      color="#fff"
                      style={{
                        fontFamily: fontFamilies.semiBold,
                        fontSize: 10,
                        textTransform: "capitalize",
                      }}
                    >
                      {photo.angle}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => handleRemovePhoto(photo)}
                    hitSlop={6}
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: "rgba(0,0,0,0.55)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <X size={12} color="#fff" strokeWidth={2.5} />
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>
        </Animated.View>
      )}

      {photos.length < 8 && (
        <Animated.View className="mb-3">
          <Pressable
            onPress={onOpenSheet}
            className="items-center justify-center rounded-xl py-8"
            style={{
              borderWidth: 1.5,
              borderStyle: "dashed",
              borderColor: theme.border,
              backgroundColor: theme.surfaceTertiary,
            }}
          >
            <Camera size={32} color={theme.textTertiary} />
            <Text
              variant="bodyMedium"
              color={theme.textTertiary}
              className="mt-2"
            >
              {photos.length > 0 ? "Add More Photos" : addLabel}
            </Text>
          </Pressable>
        </Animated.View>
      )}

      <BottomSheet
        visible={showSheet}
        onClose={onCloseSheet}
        snapPoints={[30]}
        title="Add Photos"
      >
        <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 8 }}>
          <SheetOption
            icon={Camera}
            label="Take Guided Photos"
            onPress={onTakePhotos}
            theme={theme}
          />
          <SheetOption
            icon={ImageIcon}
            label="Upload from Library"
            onPress={onUploadFromLibrary}
            theme={theme}
          />
        </View>
      </BottomSheet>
    </>
  );
}

function SheetOption({
  icon: Icon,
  label,
  onPress,
  theme,
}: {
  icon: React.ComponentType<{
    size?: number;
    color?: string;
    strokeWidth?: number;
  }>;
  label: string;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 16,
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.borderLight,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <Icon size={22} color={theme.accent} strokeWidth={1.8} />
      <Text variant="bodyMedium" style={{ fontFamily: fontFamilies.medium }}>
        {label}
      </Text>
    </Pressable>
  );
}
