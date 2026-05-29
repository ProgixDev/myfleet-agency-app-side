import React, { useState, useCallback, useMemo } from "react";
import { View, Pressable, Modal, Dimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ChevronLeft, X } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { Image } from "@/components/ui/Image";

import { ScreenWrapper } from "@/components/ui/ScreenWrapper";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { Divider } from "@/components/ui/Divider";
import { useToastStore } from "@/components/ui/Toast";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/stores/useAuthStore";
import { useCreateVehicle } from "@/hooks/useFleet";
import { type AngleKey } from "@/services/fleetService";
import {
  VehiclePhotoCapture,
  type CapturedVehiclePhoto,
} from "@/components/vehicle/VehiclePhotoCapture";
import { PhotoAngleTagger } from "@/components/vehicle/PhotoAngleTagger";
import { PhotoSection } from "@/components/vehicle/PhotoSection";
import { SubmitButton } from "@/components/vehicle/SubmitButton";
import {
  VehicleFormFields,
  VEHICLE_FORM_FIELDS_STAGGER_COUNT,
} from "@/components/vehicle/VehicleFormFields";
import { useVehiclePhotoUploads } from "@/components/vehicle/useVehiclePhotoUploads";
import { vehicleFormSchema } from "@/types/vehicleSchema";
import { centsToUnits } from "@/utils/money";
import type {
  VehicleBrand,
  VehicleCategory,
  FuelType,
  Transmission,
} from "@/types/vehicle";
import { mockVehicles } from "@/data/vehicles";

const stagger = (index: number) =>
  FadeInDown.delay(index * 60)
    .duration(400)
    .springify();

// ── Component ───────────────────────────────────────────────────────────────

export default function AddVehicleScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const showToast = useToastStore((s) => s.show);
  const canManageFleet =
    user?.role === "admin" || user?.role === "employee";

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const clearFieldError = useCallback((key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const [name, setName] = useState("");
  const [brand, setBrand] = useState<VehicleBrand | null>(null);
  const [category, setCategory] = useState<VehicleCategory | null>(null);
  const [year, setYear] = useState("");
  const [color, setColor] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [mileage, setMileage] = useState("");
  const [fuelType, setFuelType] = useState<FuelType | null>(null);
  const [transmission, setTransmission] = useState<Transmission | null>(null);
  const [seats, setSeats] = useState("");
  const [dailyRate, setDailyRate] = useState("");
  const [deposit, setDeposit] = useState("");
  const [features, setFeatures] = useState<string[]>([]);
  const createVehicle = useCreateVehicle();

  const {
    photos,
    enqueueUpload,
    cancelUpload,
    retryUpload,
    removePhoto,
    awaitAll,
    snapshot,
  } = useVehiclePhotoUploads();

  const [showPhotoSheet, setShowPhotoSheet] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showTagger, setShowTagger] = useState(false);
  const [taggerLoading, setTaggerLoading] = useState(false);
  const [libraryAssets, setLibraryAssets] = useState<{ uri: string }[]>([]);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [cameraFocusAngle, setCameraFocusAngle] = useState<
    string | undefined
  >();

  // Stable identities for child props — prevents PhotoAngleTagger /
  // VehiclePhotoCapture from reseeding state on parent re-renders.
  const existingPhotosForCamera = useMemo(
    () => photos.map((p) => ({ uri: p.uri, angle: p.angle })),
    [photos],
  );
  const takenAnglesForTagger = useMemo(
    () => photos.map((p) => p.angle),
    [photos],
  );
  const memoLibraryAssets = useMemo(() => libraryAssets, [libraryAssets]);

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleOpenPhotoSheet = useCallback(() => setShowPhotoSheet(true), []);
  const handleClosePhotoSheet = useCallback(() => setShowPhotoSheet(false), []);

  const handleTakePhotos = useCallback(() => {
    setShowPhotoSheet(false);
    setCameraFocusAngle(undefined);
    setShowCamera(true);
  }, []);

  const handleUploadFromLibrary = useCallback(async () => {
    setShowPhotoSheet(false);
    // Open the tagger up-front in a loading state so the user gets immediate
    // feedback while the OS picker (and its post-pick processing) runs.
    setLibraryAssets([]);
    setTaggerLoading(true);
    setShowTagger(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        quality: 0.9,
      });
      if (!result.canceled && result.assets.length > 0) {
        setLibraryAssets(result.assets.map((a) => ({ uri: a.uri })));
      } else {
        setShowTagger(false);
      }
    } catch {
      setShowTagger(false);
    } finally {
      setTaggerLoading(false);
    }
  }, []);

  const handleCameraComplete = useCallback(() => {
    setShowCamera(false);
    setCameraFocusAngle(undefined);
  }, []);

  const handleCameraPhotoKept = useCallback(
    (p: CapturedVehiclePhoto) => {
      enqueueUpload({ uri: p.uri, angle: p.angle as AngleKey });
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
      if (previousAngle) {
        removePhoto(previousAngle);
      }
      if (angle) {
        enqueueUpload({ uri, angle: angle as AngleKey });
      }
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

  const handleDevFillRandom = useCallback(() => {
    const sample =
      mockVehicles[Math.floor(Math.random() * mockVehicles.length)];
    if (!sample) return;
    setName(sample.name);
    setBrand(sample.brand);
    setCategory(sample.category);
    setYear(String(sample.year));
    setColor(sample.color);
    // Append a random suffix so repeated fills don't collide on the unique plate.
    const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
    setLicensePlate(`${sample.licensePlate}-${suffix}`);
    setMileage(String(sample.mileage));
    setFuelType(sample.fuelType);
    setTransmission(sample.transmission);
    setSeats(String(sample.seats));
    setDailyRate(String(centsToUnits(sample.dailyRate ?? 0)));
    setDeposit(String(centsToUnits(sample.deposit ?? 0)));
    setFieldErrors({});
    showToast({
      variant: "success",
      title: "Form filled",
      message: `Seeded with ${sample.brand} ${sample.name}`,
    });
  }, [showToast]);

  const handleSubmit = useCallback(async () => {
    const parsed = vehicleFormSchema.safeParse({
      name,
      brand: brand ?? "",
      category: category ?? "",
      year,
      color,
      licensePlate,
      mileage: mileage.trim() === "" ? 0 : mileage,
      fuelType: fuelType ?? undefined,
      transmission: transmission ?? undefined,
      seats,
      dailyRate,
      deposit: deposit.trim() === "" ? 0 : deposit,
      features,
      images: [],
      quantity: 1,
    });

    if (!parsed.success) {
      const fieldErrs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        if (key && !fieldErrs[key]) fieldErrs[key] = issue.message;
      }
      setFieldErrors(fieldErrs);
      const first = Object.values(fieldErrs)[0];
      if (first) {
        showToast({
          variant: "error",
          title: "Check the form",
          message: first,
        });
      }
      return;
    }
    setFieldErrors({});

    try {
      // Wait for any in-flight uploads, then snapshot the latest state.
      await awaitAll();
      const current = snapshot();

      const failed = current.filter((p) => p.status === "failed");
      if (failed.length > 0) {
        showToast({
          variant: "error",
          title: "Upload failed",
          message: `${failed.length} photo${failed.length > 1 ? "s" : ""} failed to upload. Tap them to retry.`,
        });
        return;
      }

      const stillUploading = current.filter((p) => p.status === "uploading");
      if (stillUploading.length > 0) {
        showToast({
          variant: "error",
          title: "Uploads in progress",
          message: "Please wait for uploads to finish.",
        });
        return;
      }

      const uploadedImages = current
        .filter((p) => p.status === "uploaded" && p.tempKey)
        .map((p) => ({ tempKey: p.tempKey!, angle: p.angle }));

      // Verify every photo made it through.
      if (uploadedImages.length !== current.length) {
        showToast({
          variant: "error",
          title: "Upload mismatch",
          message: "Some photos failed to upload. Please try again.",
        });
        return;
      }

      await createVehicle.mutateAsync({
        ...parsed.data,
        images: uploadedImages,
      });

      showToast({
        variant: "success",
        title: "Vehicle added",
        message: "The vehicle has been added to the fleet.",
      });
      router.back();
    } catch (err: any) {
      const serverFieldErrors = err?.details?.fieldErrors as
        | Record<string, string>
        | undefined;
      if (serverFieldErrors && Object.keys(serverFieldErrors).length > 0) {
        setFieldErrors(serverFieldErrors);
        const first = Object.values(serverFieldErrors)[0];
        showToast({
          variant: "error",
          title: "Validation failed",
          message: first,
        });
        return;
      }
      showToast({
        variant: "error",
        title: "Error",
        message: err?.message || "Failed to add vehicle",
      });
    }
  }, [
    name,
    brand,
    category,
    year,
    color,
    licensePlate,
    mileage,
    fuelType,
    transmission,
    seats,
    dailyRate,
    deposit,
    features,
    awaitAll,
    snapshot,
    createVehicle,
    router,
    showToast,
  ]);

  // ── Unauthorized state ──────────────────────────────────────────────────

  if (!canManageFleet) {
    return (
      <ScreenWrapper>
        <View className="flex-1 items-center justify-center gap-4">
          <Text variant="headlineSmall" color={theme.danger}>
            {t("common.unauthorized", { defaultValue: "Unauthorized" })}
          </Text>
          <Text variant="bodyMedium" color={theme.textSecondary} align="center">
            {t("common.adminOnly", {
              defaultValue:
                "You need agency staff permissions to access this page.",
            })}
          </Text>
          <Button variant="secondary" onPress={() => router.back()}>
            {t("common.goBack", { defaultValue: "Go Back" })}
          </Button>
        </View>
      </ScreenWrapper>
    );
  }

  // ── Main form ───────────────────────────────────────────────────────────

  let sectionIndex = 0;

  return (
    <>
      <ScreenWrapper scroll>
        <View
          pointerEvents={createVehicle.isPending ? "none" : "auto"}
          style={{ opacity: createVehicle.isPending ? 0.5 : 1 }}
        >
          <Animated.View
            entering={stagger(sectionIndex++)}
            className="pt-4 mb-6"
          >
            <Pressable
              onPress={() => router.back()}
              className="flex-row items-center mb-4"
            >
              <ChevronLeft size={24} color={theme.accent} />
              <Text variant="bodyMedium" color={theme.accent}>
                {t("common.back", { defaultValue: "Back" })}
              </Text>
            </Pressable>
            <Text variant="headlineLarge">
              {t("fleet.addVehicle", { defaultValue: "Add Vehicle" })}
            </Text>
            {__DEV__ && (
              <Pressable
                onPress={handleDevFillRandom}
                style={({ pressed }) => ({
                  alignSelf: "flex-start",
                  marginTop: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 9999,
                  borderWidth: 1,
                  borderStyle: "dashed",
                  borderColor: theme.accent,
                  backgroundColor: pressed ? theme.accentSoft : "transparent",
                })}
              >
                <Text
                  variant="labelSmall"
                  color={theme.accent}
                  style={{ fontSize: 11 }}
                >
                  DEV · Fill with random vehicle
                </Text>
              </Pressable>
            )}
          </Animated.View>

          <VehicleFormFields
            startIndex={sectionIndex}
            state={{
              name,
              brand,
              category,
              year,
              color,
              licensePlate,
              mileage,
              fuelType,
              transmission,
              seats,
              dailyRate,
              deposit,
              features,
            }}
            setState={{
              setName,
              setBrand,
              setCategory,
              setYear,
              setColor,
              setLicensePlate,
              setMileage,
              setFuelType,
              setTransmission,
              setSeats,
              setDailyRate,
              setDeposit,
              setFeatures,
            }}
            fieldErrors={fieldErrors}
            clearFieldError={clearFieldError}
          />
          {(() => {
            sectionIndex += VEHICLE_FORM_FIELDS_STAGGER_COUNT;
            return null;
          })()}

          <Animated.View entering={stagger(sectionIndex++)}>
            <Divider className="my-4" />
          </Animated.View>

          {/* ── Photos ────────────────────────────────────────────────────── */}
          <Animated.View entering={stagger(sectionIndex++)}>
            <PhotoSection
              photos={photos}
              onRetry={retryUpload}
              onPreview={setPreviewUri}
              onRemove={removePhoto}
              onRetake={handleRetake}
              showSheet={showPhotoSheet}
              onOpenSheet={handleOpenPhotoSheet}
              onCloseSheet={handleClosePhotoSheet}
              onTakePhotos={handleTakePhotos}
              onUploadFromLibrary={handleUploadFromLibrary}
              sectionTitle={t("fleet.photos", { defaultValue: "Photos" })}
              addLabel={t("fleet.addPhotos", { defaultValue: "Add Photos" })}
            />
          </Animated.View>
        </View>

        <Animated.View entering={stagger(sectionIndex++)} className="mb-8">
          <SubmitButton
            photos={photos}
            isSaving={createVehicle.isPending}
            defaultLabel={t("fleet.addVehicle", {
              defaultValue: "Add Vehicle",
            })}
            onPress={handleSubmit}
          />
        </Animated.View>
      </ScreenWrapper>

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
        assets={memoLibraryAssets}
        loading={taggerLoading}
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
    </>
  );
}
