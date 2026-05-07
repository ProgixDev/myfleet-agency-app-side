import React, { useEffect, useState, useCallback, useMemo } from "react";
import { View, Modal, Dimensions, Pressable } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Car, Fuel, Gauge, X } from "lucide-react-native";

import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Image } from "@/components/ui/Image";
import { useToastStore } from "@/components/ui/Toast";
import { useTheme } from "@/hooks/useTheme";
import {
  useCreateInspection,
  useInspections,
  usePatchInspection,
} from "@/hooks/useInspections";
import { useTranslation } from "react-i18next";
import {
  VehiclePhotoCapture,
  type CapturedVehiclePhoto,
} from "@/components/vehicle/VehiclePhotoCapture";
import { PhotoAngleTagger } from "@/components/vehicle/PhotoAngleTagger";
import { PhotoSection } from "@/components/vehicle/PhotoSection";
import type { ManagedPhoto } from "@/components/vehicle/useVehiclePhotoUploads";
import { useInspectionPhotoUploads } from "@/components/inspection/useInspectionPhotoUploads";
import type { PhotoAngle } from "@/types/inspection";

export interface BookingInspectionStepProps {
  bookingId: string;
  vehicleId: string;
  vehicleName: string;
  clientName: string;
  type: "pre-rental" | "post-rental";
  existingInspectionId?: string;
  /** Kept for prop-shape compatibility; signatures live on contract step. */
  showSignatures?: boolean;
  continueLabel: string;
  onInspectionReady: (inspectionId: string) => void;
  onContinue: () => void;
  /**
   * Optional controlled mileage input. When provided, the step renders a
   * mileage Card and gates Continue on a valid value. The numeric reading is
   * patched onto the inspection row when the user advances.
   */
  mileageValue?: string;
  onMileageChange?: (value: string) => void;
  mileageLabel?: string;
  /**
   * Optional controlled fuel-level input as a 0..100 percent value. When
   * provided the step renders a 5-step fuel selector and gates Continue on
   * a non-null choice; the value is patched onto the inspection on advance.
   */
  fuelLevelValue?: number | null;
  onFuelLevelChange?: (value: number) => void;
}

const FUEL_LEVELS: { label: string; pct: number }[] = [
  { label: "E", pct: 0 },
  { label: "1/4", pct: 25 },
  { label: "1/2", pct: 50 },
  { label: "3/4", pct: 75 },
  { label: "F", pct: 100 },
];

export function BookingInspectionStep({
  bookingId,
  vehicleId,
  vehicleName,
  clientName,
  type,
  existingInspectionId,
  continueLabel,
  onInspectionReady,
  onContinue,
  mileageValue,
  onMileageChange,
  mileageLabel,
  fuelLevelValue,
  onFuelLevelChange,
}: BookingInspectionStepProps) {
  const mileageEnabled = onMileageChange !== undefined;
  const parsedMileage = mileageEnabled
    ? Number.parseInt((mileageValue ?? "").replace(/[^0-9]/g, ""), 10)
    : NaN;
  const mileageValid =
    !mileageEnabled || (Number.isFinite(parsedMileage) && parsedMileage > 0);
  const fuelEnabled = onFuelLevelChange !== undefined;
  const fuelValid =
    !fuelEnabled || (fuelLevelValue !== null && fuelLevelValue !== undefined);
  const theme = useTheme();
  const { t } = useTranslation();
  const showToast = useToastStore((s) => s.show);
  const ns = type === "pre-rental" ? "pickup" : "return";

  const { data: relatedInspections = [] } = useInspections({ bookingId });
  const createInspection = useCreateInspection();
  const patchInspection = usePatchInspection();
  const [inspectionId, setInspectionId] = useState<string | null>(
    existingInspectionId ?? null,
  );

  // Resolve / create the inspection (with FK to booking) so uploads have a target.
  useEffect(() => {
    if (inspectionId) return;
    if (existingInspectionId) {
      setInspectionId(existingInspectionId);
      onInspectionReady(existingInspectionId);
      return;
    }
    const existing = relatedInspections.find((i) => i.type === type);
    if (existing) {
      setInspectionId(existing.id);
      onInspectionReady(existing.id);
      return;
    }
    if (createInspection.isPending) return;
    createInspection.mutate(
      { vehicleId, bookingId, type },
      {
        onSuccess: (insp) => {
          setInspectionId(insp.id);
          onInspectionReady(insp.id);
        },
        onError: (err) =>
          showToast({
            variant: "error",
            title: t(
              "inspections.new.createFailed",
              "Couldn't start inspection",
            ),
            message: err instanceof Error ? err.message : undefined,
          }),
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId, existingInspectionId, relatedInspections.length]);

  // Upload management — same hook used by (inspections)/new.tsx.
  const {
    photos,
    enqueueUpload,
    cancelUpload,
    retryUpload,
    removePhoto,
    awaitAll,
    snapshot,
  } = useInspectionPhotoUploads(inspectionId);

  // Photo-capture UI state — mirrors new.tsx
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showTagger, setShowTagger] = useState(false);
  const [libraryAssets, setLibraryAssets] = useState<{ uri: string }[]>([]);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [cameraFocusAngle, setCameraFocusAngle] = useState<
    string | undefined
  >();

  const existingPhotosForCamera = useMemo(
    () => photos.map((p) => ({ uri: p.uri, angle: p.angle as string })),
    [photos],
  );
  const takenAnglesForTagger = useMemo(
    () => photos.map((p) => p.angle as string),
    [photos],
  );

  const photosForSection = photos as unknown as ManagedPhoto[];

  const handleOpenPhotoSheet = useCallback(() => setShowPhotoSheet(true), []);
  const handleClosePhotoSheet = useCallback(() => setShowPhotoSheet(false), []);

  const handleTakePhotos = useCallback(() => {
    setShowPhotoSheet(false);
    setCameraFocusAngle(undefined);
    setShowCamera(true);
  }, []);

  const handleUploadFromLibrary = useCallback(async () => {
    setShowPhotoSheet(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.9,
    });
    if (!result.canceled && result.assets.length > 0) {
      setLibraryAssets(result.assets.map((a) => ({ uri: a.uri })));
      setShowTagger(true);
    }
  }, []);

  const handleCameraComplete = useCallback(() => {
    setShowCamera(false);
    setCameraFocusAngle(undefined);
  }, []);

  const handleCameraPhotoKept = useCallback(
    (p: CapturedVehiclePhoto) => {
      enqueueUpload({ uri: p.uri, angle: p.angle as PhotoAngle });
    },
    [enqueueUpload],
  );

  const handleTaggerPhotoTagged = useCallback(
    ({
      uri,
      angle,
      previousAngle,
    }: {
      uri: string;
      angle: string | null;
      previousAngle: string | null;
    }) => {
      if (previousAngle) removePhoto(previousAngle);
      if (angle) enqueueUpload({ uri, angle: angle as PhotoAngle });
    },
    [removePhoto, enqueueUpload],
  );

  const handleTaggerClose = useCallback(() => {
    setShowTagger(false);
    setLibraryAssets([]);
  }, []);

  const handleRetake = useCallback(
    (angle: string) => {
      cancelUpload(angle);
      removePhoto(angle);
      setCameraFocusAngle(angle);
      setShowCamera(true);
    },
    [cancelUpload, removePhoto],
  );

  // Wait for uploads, then mark inspection complete and bubble up.
  const [continuing, setContinuing] = useState(false);
  const handleContinue = useCallback(async () => {
    if (!inspectionId) {
      showToast({
        variant: "error",
        title: t("inspections.new.starting", "Starting..."),
      });
      return;
    }
    setContinuing(true);
    try {
      await awaitAll();
      const current = snapshot();

      if (current.length === 0) {
        showToast({
          variant: "error",
          title: t("inspections.new.noPhotosTitle", "No photos"),
          message: t(
            "inspections.new.noPhotosMessage",
            "Capture at least one photo before continuing.",
          ),
        });
        return;
      }
      const failed = current.filter((p) => p.status === "failed");
      if (failed.length > 0) {
        showToast({
          variant: "error",
          title: t("inspections.new.uploadFailedTitle", "Upload failed"),
          message: t(
            "inspections.new.uploadFailedMessage",
            "{{count}} photo(s) failed. Tap them to retry.",
            { count: failed.length },
          ),
        });
        return;
      }
      const stillUploading = current.filter((p) => p.status === "uploading");
      if (stillUploading.length > 0) {
        showToast({
          variant: "error",
          title: t("inspections.new.uploadingTitle", "Uploads in progress"),
          message: t(
            "inspections.new.uploadingMessage",
            "Please wait for uploads to finish.",
          ),
        });
        return;
      }

      if (mileageEnabled && !mileageValid) {
        showToast({
          variant: "error",
          title: t("bookings.mileage.startMileageRequired", "Mileage required"),
        });
        return;
      }
      if (fuelEnabled && !fuelValid) {
        showToast({
          variant: "error",
          title: t("bookings.fuel.required", "Fuel level required"),
        });
        return;
      }

      await patchInspection.mutateAsync({
        id: inspectionId,
        patch: {
          status: "completed",
          ...(mileageEnabled ? { mileage: parsedMileage } : {}),
          ...(fuelEnabled && fuelLevelValue != null
            ? { fuelLevel: fuelLevelValue }
            : {}),
        },
      });

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onContinue();
    } catch (err) {
      showToast({
        variant: "error",
        title: t("inspections.new.completeFailed", "Couldn't complete"),
        message: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setContinuing(false);
    }
  }, [
    inspectionId,
    awaitAll,
    snapshot,
    patchInspection,
    onContinue,
    showToast,
    t,
    mileageEnabled,
    mileageValid,
    parsedMileage,
    fuelEnabled,
    fuelValid,
    fuelLevelValue,
  ]);

  const bannerDefault =
    type === "pre-rental"
      ? "Pre-departure inspection for"
      : "Post-return inspection for";

  return (
    <Animated.View entering={FadeIn.duration(300)} style={{ gap: 16 }}>
      {/* Banner */}
      <Card variant="accent" padding="md">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Car size={20} color="#FFFFFF" />
          <View style={{ flex: 1 }}>
            <Text variant="bodySmall" color="#FFFFFF" style={{ opacity: 0.8 }}>
              {t(`${ns}.inspection.banner`, { defaultValue: bannerDefault })}
            </Text>
            <Text
              variant="titleMedium"
              color="#FFFFFF"
              style={{ fontWeight: "700" }}
            >
              {vehicleName} — {clientName}
            </Text>
          </View>
        </View>
      </Card>

      {/* Mileage — only when the parent opts in (e.g. pickup pre-rental).
          The reading is patched onto the inspection on Continue and used
          downstream to populate booking.start_mileage / vehicle odometer. */}
      {mileageEnabled && (
        <Card>
          <Text variant="titleLarge" style={{ marginBottom: 4 }}>
            {mileageLabel ??
              t("bookings.mileage.startMileageLabel", "Departure mileage")}
          </Text>
          <Text
            variant="bodySmall"
            color={theme.textSecondary}
            style={{ marginBottom: 12 }}
          >
            {t("bookings.mileage.startMileageRequired", "Mileage required")}
          </Text>
          <Input
            placeholder={t(
              "bookings.mileage.startMileagePlaceholder",
              "Enter mileage",
            )}
            value={mileageValue ?? ""}
            onChangeText={(text) =>
              onMileageChange?.(text.replace(/[^0-9]/g, ""))
            }
            keyboardType="number-pad"
            leftIcon={Gauge}
            helperText={t("bookings.mileage.unit", "km")}
          />
        </Card>
      )}

      {/* Fuel level — five-step selector. Patched onto the inspection on
          Continue (column inspection.fuel_level, 0..100). */}
      {fuelEnabled && (
        <Card>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginBottom: 4,
            }}
          >
            <Fuel size={18} color={theme.accent} strokeWidth={1.8} />
            <Text variant="titleLarge">
              {t("bookings.fuel.label", "Fuel level")}
            </Text>
          </View>
          <Text
            variant="bodySmall"
            color={theme.textSecondary}
            style={{ marginBottom: 12 }}
          >
            {t(
              "bookings.fuel.subtitle",
              "Pick the closest fuel reading at handover.",
            )}
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {FUEL_LEVELS.map((level) => {
              const selected = fuelLevelValue === level.pct;
              return (
                <Pressable
                  key={level.pct}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onFuelLevelChange?.(level.pct);
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 12,
                    borderWidth: selected ? 2 : 1,
                    borderColor: selected ? theme.accent : theme.border,
                    backgroundColor: selected
                      ? theme.accentSoft
                      : theme.surfaceSecondary,
                    alignItems: "center",
                  }}
                >
                  <Text
                    variant="titleMedium"
                    color={selected ? theme.accent : theme.textPrimary}
                  >
                    {level.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
      )}

      {/* Photo capture & upload — backed by /inspections/:id/photos/:angle */}
      <Card>
        <Text variant="titleLarge" style={{ marginBottom: 4 }}>
          {t(`${ns}.inspection.captureTitle`, {
            defaultValue: "Vehicle Photos",
          })}
        </Text>
        <Text
          variant="bodySmall"
          color={theme.textSecondary}
          style={{ marginBottom: 12 }}
        >
          {t(`${ns}.inspection.captureSubtitle`, {
            defaultValue:
              "Capture or upload photos of all 8 angles. They upload in the background.",
          })}
        </Text>

        <PhotoSection
          photos={photosForSection}
          onRetry={retryUpload}
          onPreview={setPreviewUri}
          onRemove={removePhoto}
          onRetake={handleRetake}
          showSheet={showPhotoSheet}
          onOpenSheet={handleOpenPhotoSheet}
          onCloseSheet={handleClosePhotoSheet}
          onTakePhotos={handleTakePhotos}
          onUploadFromLibrary={handleUploadFromLibrary}
          sectionTitle={t(`${ns}.inspection.photos`, {
            defaultValue: "Photos",
          })}
          addLabel={t(`${ns}.inspection.addPhotos`, {
            defaultValue: "Add Photos",
          })}
        />
      </Card>

      <Button
        fullWidth
        onPress={handleContinue}
        disabled={continuing || !inspectionId || !mileageValid || !fuelValid}
      >
        {continuing
          ? t("inspections.new.completing", { defaultValue: "Completing..." })
          : continueLabel}
      </Button>

      <VehiclePhotoCapture
        visible={showCamera}
        onClose={() => {
          setShowCamera(false);
          setCameraFocusAngle(undefined);
        }}
        onComplete={handleCameraComplete}
        onPhotoKept={handleCameraPhotoKept}
        existingPhotos={existingPhotosForCamera}
        focusAngle={cameraFocusAngle}
      />

      <PhotoAngleTagger
        visible={showTagger}
        assets={libraryAssets}
        onClose={handleTaggerClose}
        onComplete={handleTaggerClose}
        onPhotoTagged={handleTaggerPhotoTagged}
        takenAngles={takenAnglesForTagger}
      />

      <Modal
        visible={previewUri !== null}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setPreviewUri(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#000",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Pressable
            onPress={() => setPreviewUri(null)}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1,
            }}
          />
          {previewUri && (
            <Image
              source={{ uri: previewUri }}
              style={{
                width: Dimensions.get("window").width,
                height: Dimensions.get("window").height,
              }}
              contentFit="contain"
            />
          )}
          <Pressable
            onPress={() => setPreviewUri(null)}
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "rgba(0,0,0,0.45)",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2,
            }}
          >
            <X size={20} color="#fff" strokeWidth={2.5} />
          </Pressable>
        </View>
      </Modal>
    </Animated.View>
  );
}
