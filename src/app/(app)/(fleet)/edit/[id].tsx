import React, { useState, useCallback, useMemo, useEffect } from "react";
import { View, Pressable, Modal, Dimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter, useLocalSearchParams } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ChevronLeft, X } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { Image } from "@/components/ui/Image";

import { ScreenWrapper } from "@/components/ui/ScreenWrapper";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { Divider } from "@/components/ui/Divider";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToastStore } from "@/components/ui/Toast";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/stores/useAuthStore";
import { useVehicle, useUpdateVehicle } from "@/hooks/useFleet";
import { type AngleKey, type VehicleImageInput } from "@/services/fleetService";
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
  VehicleStatus,
} from "@/types/vehicle";
import { Wrench, Archive, CheckCircle } from "lucide-react-native";
import { fontFamilies } from "@/theme/typography";
import { Chip, ChipGroup } from "@/components/ui/Chip";

const stagger = (index: number) =>
  FadeInDown.delay(index * 60)
    .duration(400)
    .springify();

export default function EditVehicleScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const showToast = useToastStore((s) => s.show);
  const canManageFleet =
    user?.role === "admin" || user?.role === "employee";

  const { data: vehicle, isLoading } = useVehicle(id);
  const updateVehicle = useUpdateVehicle();

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
  const [status, setStatus] = useState<VehicleStatus>("available");

  const {
    photos,
    enqueueUpload,
    cancelUpload,
    retryUpload,
    removePhoto,
    seedExisting,
    awaitAll,
    snapshot,
  } = useVehiclePhotoUploads();

  // Seed form + photos from the loaded vehicle once.
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (seeded || !vehicle) return;
    setName(vehicle.name);
    setBrand(vehicle.brand);
    setCategory(vehicle.category);
    setYear(String(vehicle.year));
    setColor(vehicle.color);
    setLicensePlate(vehicle.licensePlate);
    setMileage(String(vehicle.mileage));
    setFuelType(vehicle.fuelType);
    setTransmission(vehicle.transmission);
    setSeats(String(vehicle.seats));
    setDailyRate(String(centsToUnits(vehicle.dailyRate ?? 0)));
    setDeposit(String(centsToUnits(vehicle.deposit ?? 0)));
    setFeatures(vehicle.features ?? []);
    setStatus(vehicle.status);
    if (vehicle.images?.length) {
      seedExisting(
        vehicle.images.map((img) => ({
          uri: img.url,
          angle: img.angle,
          imageKey: img.imageKey,
        })),
      );
    }
    setSeeded(true);
  }, [vehicle, seeded, seedExisting]);

  const [showPhotoSheet, setShowPhotoSheet] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showTagger, setShowTagger] = useState(false);
  const [taggerLoading, setTaggerLoading] = useState(false);
  const [libraryAssets, setLibraryAssets] = useState<{ uri: string }[]>([]);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [cameraFocusAngle, setCameraFocusAngle] = useState<
    string | undefined
  >();

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

      // Build the images payload only if it's been touched, otherwise omit
      // so the backend keeps existing photos untouched.
      const images: VehicleImageInput[] = current.map((p) =>
        p.tempKey
          ? { tempKey: p.tempKey, angle: p.angle }
          : { imageKey: p.imageKey!, angle: p.angle },
      );

      const originalKeys = (vehicle?.images ?? [])
        .map((i) => i.imageKey)
        .sort();
      const currentKeys = current
        .map((p) => p.imageKey)
        .filter((k): k is string => !!k)
        .sort();
      const photosUnchanged =
        current.every((p) => !p.tempKey) &&
        originalKeys.length === currentKeys.length &&
        originalKeys.every((k, i) => k === currentKeys[i]);

      await updateVehicle.mutateAsync({
        id: id!,
        data: {
          ...parsed.data,
          ...(photosUnchanged ? {} : { images }),
          ...(status !== vehicle?.status ? { status } : {}),
        },
      });

      showToast({
        variant: "success",
        title: "Vehicle updated",
        message: "Changes saved.",
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
        message: err?.message || "Failed to update vehicle",
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
    status,
    awaitAll,
    snapshot,
    updateVehicle,
    router,
    showToast,
    id,
    vehicle,
  ]);

  // ── Unauthorized ────────────────────────────────────────────────────────
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

  // ── Loading / Not found ─────────────────────────────────────────────────
  if (isLoading || !vehicle) {
    return (
      <ScreenWrapper scroll>
        <View className="pt-4 mb-6">
          <Skeleton height={28} width={"50%"} />
        </View>
        <View style={{ gap: 12 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} height={48} width={"100%"} />
          ))}
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
          pointerEvents={updateVehicle.isPending ? "none" : "auto"}
          style={{ opacity: updateVehicle.isPending ? 0.5 : 1 }}
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
              {t("fleet.editVehicle", { defaultValue: "Edit Vehicle" })}
            </Text>
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

          {/* ── Status ─────────────────────────────────────────────────── */}
          <Animated.View entering={stagger(sectionIndex++)} className="mb-2">
            <Text
              variant="labelLarge"
              color={theme.textSecondary}
              className="mb-3"
            >
              {t("fleet.status.label", { defaultValue: "Status" })}
            </Text>
          </Animated.View>

          <Animated.View entering={stagger(sectionIndex++)} className="mb-6">
            <StatusChips
              value={status}
              currentVehicleStatus={vehicle.status}
              onChange={setStatus}
              theme={theme}
              t={t}
            />
          </Animated.View>

          <Animated.View entering={stagger(sectionIndex++)}>
            <Divider className="my-4" />
          </Animated.View>

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
            isSaving={updateVehicle.isPending}
            defaultLabel={t("fleet.saveChanges", {
              defaultValue: "Save Changes",
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

// ── StatusChips ────────────────────────────────────────────────────────────
//
// Three-way picker for available / maintenance / retired. The booking-driven
// statuses (rented, reserved) aren't selectable — when the vehicle is in one
// of those, the picker shows a read-only note explaining that the booking
// lifecycle controls status until the rental ends.

const SELECTABLE_STATUSES: {
  key: "available" | "maintenance" | "retired";
  label: string;
  fallback: string;
  icon: typeof CheckCircle;
}[] = [
  {
    key: "available",
    label: "fleet.status.available",
    fallback: "Available",
    icon: CheckCircle,
  },
  {
    key: "maintenance",
    label: "fleet.status.maintenance",
    fallback: "Maintenance",
    icon: Wrench,
  },
  {
    key: "retired",
    label: "fleet.status.retired",
    fallback: "Retired",
    icon: Archive,
  },
];

function StatusChips({
  value,
  currentVehicleStatus,
  onChange,
  theme,
  t,
}: {
  value: VehicleStatus;
  currentVehicleStatus: VehicleStatus;
  onChange: (next: VehicleStatus) => void;
  theme: ReturnType<typeof useTheme>;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const lockedByBooking =
    currentVehicleStatus === "rented" || currentVehicleStatus === "reserved";

  if (lockedByBooking) {
    return (
      <View
        style={{
          padding: 14,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: theme.borderLight,
          backgroundColor: theme.surfaceTertiary,
        }}
      >
        <Text
          variant="bodySmall"
          color={theme.textSecondary}
          style={{ fontFamily: fontFamilies.medium, fontSize: 13 }}
        >
          {t("fleet.status.lockedTitle", {
            defaultValue: `Currently ${currentVehicleStatus}`,
          })}
        </Text>
        <Text
          variant="caption"
          color={theme.textTertiary}
          style={{ fontSize: 12, marginTop: 4 }}
        >
          {t("fleet.status.lockedBody", {
            defaultValue:
              "Status is managed by the active booking and can't be changed manually until the rental ends.",
          })}
        </Text>
      </View>
    );
  }

  return (
    <ChipGroup>
      {SELECTABLE_STATUSES.map((opt) => (
        <Chip
          key={opt.key}
          label={t(opt.label, { defaultValue: opt.fallback })}
          selected={value === opt.key}
          leftIcon={opt.icon}
          onPress={() => onChange(opt.key)}
        />
      ))}
    </ChipGroup>
  );
}
