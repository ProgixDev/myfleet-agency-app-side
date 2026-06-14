import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  View,
  Pressable,
  ScrollView,
  TextInput,
  Modal,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import Animated, {
  FadeInDown,
  FadeInRight,
  FadeInLeft,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Image } from "@/components/ui/Image";
import {
  ChevronLeft,
  Camera,
  ScanLine,
  ClipboardCheck,
  Wrench,
  Gauge,
  Fuel,
  Check,
  Search,
  X,
  type LucideIcon,
} from "lucide-react-native";

import { Text } from "@/components/ui/Text";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Input } from "@/components/ui/Input";
import { StickyButton } from "@/components/ui/StickyButton";
import { useToastStore } from "@/components/ui/Toast";
import { useTheme } from "@/hooks/useTheme";
import { useVehicles } from "@/hooks/useFleet";
import {
  useCreateInspection,
  usePatchInspection,
} from "@/hooks/useInspections";
import { fontFamilies } from "@/theme/typography";
import type { Vehicle } from "@/types/vehicle";
import type { InspectionType, PhotoAngle } from "@/types/inspection";

import {
  VehiclePhotoCapture,
  type CapturedVehiclePhoto,
} from "@/components/vehicle/VehiclePhotoCapture";
import { PhotoAngleTagger } from "@/components/vehicle/PhotoAngleTagger";
import { PhotoSection } from "@/components/vehicle/PhotoSection";
import type { ManagedPhoto } from "@/components/vehicle/useVehiclePhotoUploads";
import { useInspectionPhotoUploads } from "@/components/inspection/useInspectionPhotoUploads";

// ── Constants ────────────────────────────────────────────────────────────────

const FUEL_LEVELS = [0, 25, 50, 75, 100] as const;

interface InspectionTypeOption {
  type: InspectionType;
  icon: LucideIcon;
  titleKey: string;
  titleFallback: string;
  subtitleKey: string;
  subtitleFallback: string;
}

const INSPECTION_TYPES: InspectionTypeOption[] = [
  {
    type: "pre-rental",
    icon: ScanLine,
    titleKey: "inspections.new.typePreRental.title",
    titleFallback: "Pre-rental",
    subtitleKey: "inspections.new.typePreRental.subtitle",
    subtitleFallback: "Before handing to client",
  },
  {
    type: "post-rental",
    icon: ClipboardCheck,
    titleKey: "inspections.new.typePostRental.title",
    titleFallback: "Post-rental",
    subtitleKey: "inspections.new.typePostRental.subtitle",
    subtitleFallback: "When client returns vehicle",
  },
  {
    type: "routine",
    icon: Wrench,
    titleKey: "inspections.new.typeRoutine.title",
    titleFallback: "Routine",
    subtitleKey: "inspections.new.typeRoutine.subtitle",
    subtitleFallback: "Periodic maintenance check",
  },
];

// ── Stepper ──────────────────────────────────────────────────────────────────

interface StepperProps {
  currentStep: number;
  steps: readonly string[];
  theme: ReturnType<typeof useTheme>;
}

function Stepper({ currentStep, steps, theme }: StepperProps) {
  return (
    <View
      className="flex-row items-center"
      style={{ paddingHorizontal: 4, paddingVertical: 10 }}
    >
      {steps.map((label, index) => {
        const isCompleted = index < currentStep;
        const isActive = index === currentStep;
        const done = isCompleted || isActive;

        return (
          <React.Fragment key={label}>
            {index > 0 && (
              <View
                style={{
                  flex: 1,
                  height: 2,
                  backgroundColor: done ? theme.accent : theme.surfaceTertiary,
                  marginHorizontal: 6,
                  borderRadius: 1,
                }}
              />
            )}
            <View style={{ alignItems: "center" }}>
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: done ? theme.accent : theme.surfaceTertiary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isCompleted ? (
                  <Check size={14} color="#FFFFFF" strokeWidth={3} />
                ) : (
                  <Text
                    variant="labelSmall"
                    color={isActive ? "#FFFFFF" : theme.textTertiary}
                    style={{
                      fontFamily: fontFamilies.bold,
                      fontSize: 12,
                    }}
                  >
                    {index + 1}
                  </Text>
                )}
              </View>
              <Text
                variant="caption"
                color={isActive ? theme.accent : theme.textTertiary}
                style={{
                  fontFamily: isActive
                    ? fontFamilies.semiBold
                    : fontFamilies.medium,
                  fontSize: 11,
                  marginTop: 6,
                }}
              >
                {label}
              </Text>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function NewInspectionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ vehicleId?: string }>();
  const preselectVehicleId = params.vehicleId ?? null;
  const { t } = useTranslation();
  const theme = useTheme();
  const showToast = useToastStore((s) => s.show);

  const STEPS = [
    t("inspections.new.steps.vehicle", "Vehicle"),
    t("inspections.new.steps.type", "Type"),
    t("inspections.new.steps.details", "Details"),
    t("inspections.new.steps.photos", "Photos"),
  ] as const;

  const [currentStep, setCurrentStep] = useState(0);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  const [selectedType, setSelectedType] = useState<InspectionType | null>(null);

  const [mileage, setMileage] = useState("");
  const [fuelLevel, setFuelLevel] = useState<number>(100);
  const [notes, setNotes] = useState("");

  const [direction, setDirection] = useState<"forward" | "backward">("forward");

  const {
    data: vehicles = [],
    isLoading: vehiclesLoading,
    isError: vehiclesError,
    refetch: refetchVehicles,
  } = useVehicles();

  // Pre-select a vehicle and skip step 0 when navigated with ?vehicleId=...
  useEffect(() => {
    if (!preselectVehicleId || selectedVehicle) return;
    const match = vehicles.find((v) => v.id === preselectVehicleId);
    if (match) {
      setSelectedVehicle(match);
      setMileage(String(match.mileage));
      setCurrentStep((s) => (s === 0 ? 1 : s));
    }
  }, [preselectVehicleId, vehicles, selectedVehicle]);

  const filteredVehicles = useMemo(() => {
    if (!searchQuery.trim()) return vehicles;
    const q = searchQuery.toLowerCase();
    return vehicles.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.brand.toLowerCase().includes(q) ||
        v.licensePlate.toLowerCase().includes(q),
    );
  }, [searchQuery, vehicles]);

  // ── Inspection lifecycle (draft-then-finalize) ─────────────────────────

  const [inspectionId, setInspectionId] = useState<string | null>(null);
  const createInspection = useCreateInspection();
  const patchInspection = usePatchInspection();

  const {
    photos,
    enqueueUpload,
    cancelUpload,
    retryUpload,
    removePhoto,
    awaitAll,
    snapshot,
  } = useInspectionPhotoUploads(inspectionId);

  // Photo-capture UI state (mirrors fleet/add.tsx)
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
  const memoLibraryAssets = useMemo(() => libraryAssets, [libraryAssets]);

  // Cast to PhotoSection's expected ManagedPhoto[] shape (structurally identical).
  const photosForSection = photos as unknown as ManagedPhoto[];

  // ── Step transitions ────────────────────────────────────────────────────

  const goNext = useCallback(async () => {
    setDirection("forward");
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Transition from Details (step 2) → Photos (step 3): create the
    // inspection as a draft so subsequent photo uploads have a target id.
    if (currentStep === 2 && inspectionId == null) {
      if (!selectedVehicle || !selectedType) return;
      try {
        const parsedMileage = parseInt(mileage, 10);
        const created = await createInspection.mutateAsync({
          vehicleId: selectedVehicle.id,
          type: selectedType,
          mileage: isNaN(parsedMileage) ? 0 : parsedMileage,
          fuelLevel,
          notes: notes.trim() || undefined,
        });
        setInspectionId(created.id);
        setCurrentStep(3);
      } catch (err: any) {
        showToast({
          variant: "error",
          title: t("inspections.new.createFailed", "Couldn't start inspection"),
          message: err?.message ?? "Please try again.",
        });
      }
      return;
    }

    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  }, [
    currentStep,
    inspectionId,
    selectedVehicle,
    selectedType,
    mileage,
    fuelLevel,
    notes,
    createInspection,
    showToast,
    t,
    STEPS.length,
  ]);

  const goBack = useCallback(() => {
    if (currentStep === 0) {
      router.back();
      return;
    }
    setDirection("backward");
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, [currentStep, router]);

  const handleSelectVehicle = useCallback((vehicle: Vehicle) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedVehicle((prev) => (prev?.id === vehicle.id ? null : vehicle));
    setMileage(String(vehicle.mileage));
  }, []);

  const handleSelectType = useCallback((type: InspectionType) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedType((prev) => (prev === type ? null : type));
  }, []);

  const handleFuelLevel = useCallback((level: number) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFuelLevel(level);
  }, []);

  // ── Photo handlers (mirror add.tsx) ─────────────────────────────────────

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
      if (previousAngle) {
        removePhoto(previousAngle);
      }
      if (angle) {
        enqueueUpload({ uri, angle: angle as PhotoAngle });
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

  // ── Final submit (complete the inspection) ──────────────────────────────

  const handleComplete = useCallback(async () => {
    if (inspectionId == null) return;
    try {
      await awaitAll();
      const current = snapshot();

      if (current.length === 0) {
        showToast({
          variant: "error",
          title: t("inspections.new.noPhotosTitle", "No photos"),
          message: t(
            "inspections.new.noPhotosMessage",
            "Capture at least one photo before completing.",
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

      await patchInspection.mutateAsync({
        id: inspectionId,
        patch: { status: "completed" },
      });

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast({
        variant: "success",
        title: t("inspections.new.successTitle", "Inspection completed"),
        message: t(
          "inspections.new.successMessage",
          "The inspection has been saved.",
        ),
      });
      router.replace(`/(app)/(inspections)/${inspectionId}`);
    } catch (err: any) {
      showToast({
        variant: "error",
        title: t("inspections.new.completeFailed", "Couldn't complete"),
        message: err?.message ?? "Please try again.",
      });
    }
  }, [inspectionId, awaitAll, snapshot, patchInspection, showToast, t, router]);

  // ── Cleanup: if the user backs out without completing, the draft stays
  // on the server. We could invoke a delete endpoint here later; for now
  // the inspections list will just show a draft row.

  const canGoNext = useMemo(() => {
    if (currentStep === 0) return selectedVehicle !== null;
    if (currentStep === 1) return selectedType !== null;
    if (currentStep === 2) return true;
    return false;
  }, [currentStep, selectedVehicle, selectedType]);

  const enteringAnim =
    direction === "forward"
      ? FadeInRight.duration(320)
      : FadeInLeft.duration(320);

  // ── Render step content ────────────────────────────────────────────────

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <Animated.View
            key="step-0"
            entering={enteringAnim}
            style={{ flex: 1 }}
          >
            <Text
              variant="headlineMedium"
              style={{
                fontFamily: fontFamilies.bold,
                fontSize: 22,
                marginBottom: 4,
              }}
            >
              {t("inspections.new.selectVehicle", "Select Vehicle")}
            </Text>
            <Text
              variant="bodyMedium"
              color={theme.textSecondary}
              style={{ fontSize: 13, marginBottom: 14 }}
            >
              {t(
                "inspections.new.selectVehicleHint",
                "Choose the vehicle to inspect",
              )}
            </Text>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 9999,
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.borderLight,
                marginBottom: 12,
              }}
            >
              <Search size={16} color={theme.textTertiary} strokeWidth={2} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={t(
                  "inspections.new.searchPlaceholder",
                  "Search by name, brand, or plate...",
                )}
                placeholderTextColor={theme.textTertiary}
                style={{
                  flex: 1,
                  marginLeft: 8,
                  fontSize: 14,
                  color: theme.textPrimary,
                  fontFamily: fontFamilies.regular,
                  padding: 0,
                }}
              />
              {searchQuery.length > 0 && (
                <Pressable
                  testID="inspections-new-search-clear-button"
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  onPress={() => setSearchQuery("")}
                  hitSlop={8}
                >
                  <X size={14} color={theme.textTertiary} />
                </Pressable>
              )}
            </View>

            <View style={{ gap: 10 }}>
              {vehiclesLoading && vehicles.length === 0 ? (
                [0, 1, 2, 3].map((i) => (
                  <View
                    key={i}
                    style={{
                      height: 84,
                      borderRadius: 18,
                      backgroundColor: theme.surface,
                      borderWidth: 1,
                      borderColor: theme.borderLight,
                      opacity: 0.6,
                    }}
                  />
                ))
              ) : vehiclesError && vehicles.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 32 }}>
                  <Text
                    variant="bodyMedium"
                    color={theme.textSecondary}
                    style={{ marginBottom: 12 }}
                  >
                    {t(
                      "inspections.new.vehiclesError",
                      "Couldn't load vehicles.",
                    )}
                  </Text>
                  <Pressable
                    testID="inspections-new-vehicles-retry-button"
                    accessibilityRole="button"
                    accessibilityLabel={t("common.retry", "Retry")}
                    onPress={() => {
                      void Haptics.impactAsync(
                        Haptics.ImpactFeedbackStyle.Light,
                      );
                      void refetchVehicles();
                    }}
                    style={{
                      paddingHorizontal: 18,
                      paddingVertical: 10,
                      borderRadius: 9999,
                      backgroundColor: theme.accent,
                    }}
                  >
                    <Text
                      variant="labelSmall"
                      color="#FFFFFF"
                      style={{
                        fontFamily: fontFamilies.semiBold,
                        fontSize: 12,
                      }}
                    >
                      {t("common.retry", "Retry")}
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  {filteredVehicles.map((vehicle, index) => (
                    <VehicleRow
                      key={vehicle.id}
                      vehicle={vehicle}
                      index={index}
                      selected={selectedVehicle?.id === vehicle.id}
                      theme={theme}
                      onPress={() => handleSelectVehicle(vehicle)}
                    />
                  ))}
                  {filteredVehicles.length === 0 && (
                    <View style={{ alignItems: "center", paddingVertical: 32 }}>
                      <Text variant="bodyMedium" color={theme.textTertiary}>
                        {t("inspections.new.noVehicles", "No vehicle found")}
                      </Text>
                    </View>
                  )}
                </>
              )}
            </View>
          </Animated.View>
        );

      case 1:
        return (
          <Animated.View
            key="step-1"
            entering={enteringAnim}
            style={{ flex: 1 }}
          >
            <Text
              variant="headlineMedium"
              style={{
                fontFamily: fontFamilies.bold,
                fontSize: 22,
                marginBottom: 4,
              }}
            >
              {t("inspections.new.inspectionType", "Inspection Type")}
            </Text>
            <Text
              variant="bodyMedium"
              color={theme.textSecondary}
              style={{ fontSize: 13, marginBottom: 18 }}
            >
              {t(
                "inspections.new.typeHint",
                "Select the type of inspection to perform",
              )}
            </Text>

            <View style={{ gap: 12 }}>
              {INSPECTION_TYPES.map((option, index) => (
                <TypeRow
                  key={option.type}
                  option={option}
                  index={index}
                  selected={selectedType === option.type}
                  theme={theme}
                  t={t}
                  onPress={() => handleSelectType(option.type)}
                />
              ))}
            </View>
          </Animated.View>
        );

      case 2:
        return (
          <Animated.View
            key="step-2"
            entering={enteringAnim}
            style={{ flex: 1 }}
          >
            <Text
              variant="headlineMedium"
              style={{
                fontFamily: fontFamilies.bold,
                fontSize: 22,
                marginBottom: 4,
              }}
            >
              {t("inspections.new.vehicleDetails", "Vehicle Details")}
            </Text>
            <Text
              variant="bodyMedium"
              color={theme.textSecondary}
              style={{ fontSize: 13, marginBottom: 20 }}
            >
              {t(
                "inspections.new.detailsHint",
                "Enter current vehicle information",
              )}
            </Text>

            <Input
              label={t("inspections.new.mileage", "Current Mileage")}
              placeholder="0"
              value={mileage}
              onChangeText={setMileage}
              keyboardType="number-pad"
              leftIcon={Gauge}
              className="mb-5"
            />

            <View style={{ marginBottom: 20 }}>
              <Text
                variant="bodySmall"
                color={theme.textSecondary}
                style={{
                  fontSize: 12,
                  marginBottom: 8,
                  fontFamily: fontFamilies.medium,
                }}
              >
                {t("inspections.new.fuelLevel", "Fuel Level")}
              </Text>
              <View className="flex-row items-center" style={{ gap: 6 }}>
                <Fuel size={16} color={theme.textTertiary} />
                {FUEL_LEVELS.map((level) => {
                  const isActive = fuelLevel === level;
                  return (
                    <Pressable
                      key={level}
                      testID={`inspections-new-fuel-level-${level}`}
                      accessibilityRole="button"
                      accessibilityLabel={`${level}%`}
                      onPress={() => handleFuelLevel(level)}
                      style={({ pressed }) => ({
                        flex: 1,
                        alignItems: "center",
                        paddingVertical: 9,
                        borderRadius: 9999,
                        backgroundColor: isActive
                          ? theme.accent
                          : theme.surface,
                        borderWidth: 1,
                        borderColor: isActive
                          ? theme.accent
                          : theme.borderLight,
                        transform: [{ scale: pressed ? 0.97 : 1 }],
                      })}
                    >
                      <Text
                        variant="labelSmall"
                        color={isActive ? "#FFFFFF" : theme.textSecondary}
                        style={{
                          fontFamily: fontFamilies.semiBold,
                          fontSize: 12,
                        }}
                      >
                        {level}%
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Input
              label={t("inspections.new.notes", "Notes (optional)")}
              placeholder={t(
                "inspections.new.notesPlaceholder",
                "Additional observations...",
              )}
              value={notes}
              onChangeText={setNotes}
              multiline
              className="mb-4"
            />
          </Animated.View>
        );

      case 3:
        return (
          <Animated.View
            key="step-3"
            entering={enteringAnim}
            style={{ flex: 1 }}
          >
            <Text
              variant="headlineMedium"
              style={{
                fontFamily: fontFamilies.bold,
                fontSize: 22,
                marginBottom: 4,
              }}
            >
              {t("inspections.new.photosTitle", "Vehicle Photos")}
            </Text>
            <Text
              variant="bodyMedium"
              color={theme.textSecondary}
              style={{ fontSize: 13, marginBottom: 20 }}
            >
              {t(
                "inspections.new.photosHint",
                "Capture or upload photos of all 8 angles. They upload in the background.",
              )}
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
              sectionTitle={t("inspections.new.photos", "Photos")}
              addLabel={t("inspections.new.addPhotos", "Add Photos")}
            />
          </Animated.View>
        );

      default:
        return null;
    }
  };

  const showNextButton = canGoNext && currentStep < STEPS.length - 1;
  const showCompleteButton = currentStep === 3;
  const isCreatingDraft = createInspection.isPending;
  const isCompleting = patchInspection.isPending;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar style="dark" />
      <View style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 16,
            paddingBottom: showNextButton || showCompleteButton ? 180 : 120,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <Animated.View
            entering={FadeInDown.duration(350)}
            className="flex-row items-center"
            style={{ paddingTop: 12, paddingBottom: 6 }}
          >
            <Pressable
              testID="inspections-new-back-button"
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={goBack}
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
                marginRight: 12,
              }}
            >
              <ChevronLeft
                size={20}
                color={theme.textPrimary}
                strokeWidth={2}
              />
            </Pressable>
            <Text
              variant="headlineLarge"
              style={{ fontFamily: fontFamilies.bold, fontSize: 22 }}
            >
              {t("inspections.new.title", "New Inspection")}
            </Text>
          </Animated.View>

          {/* Stepper */}
          <Animated.View entering={FadeInDown.delay(60).duration(350)}>
            <Stepper currentStep={currentStep} steps={STEPS} theme={theme} />
          </Animated.View>

          {/* Selected vehicle header (steps 1-3) */}
          {selectedVehicle && currentStep > 0 && (
            <SelectedVehicleHeader
              vehicle={selectedVehicle}
              theme={theme}
              onChange={
                preselectVehicleId
                  ? undefined
                  : () => {
                      void Haptics.impactAsync(
                        Haptics.ImpactFeedbackStyle.Light,
                      );
                      setDirection("backward");
                      setCurrentStep(0);
                    }
              }
              changeLabel={t("inspections.new.changeVehicle", "Change")}
            />
          )}

          {/* Content */}
          <View style={{ flex: 1, minHeight: 400, marginTop: 8 }}>
            {renderStepContent()}
          </View>
        </ScrollView>

        {showNextButton && (
          <StickyButton
            variant="primary"
            onPress={goNext}
            disabled={isCreatingDraft}
          >
            {isCreatingDraft
              ? t("inspections.new.starting", "Starting...")
              : currentStep === 2
                ? t("inspections.new.startCapture", "Start Capture")
                : t("inspections.new.next", "Next")}
          </StickyButton>
        )}
        {showCompleteButton && (
          <StickyButton
            variant="primary"
            onPress={handleComplete}
            leftIcon={Check}
            disabled={isCompleting || photos.length === 0}
          >
            {isCompleting
              ? t("inspections.new.completing", "Completing...")
              : t("inspections.new.complete", "Complete Inspection")}
          </StickyButton>
        )}
      </View>

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
            testID="inspections-new-photo-preview-backdrop"
            accessibilityRole="button"
            accessibilityLabel="Close preview"
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
            testID="inspections-new-photo-preview-close-button"
            accessibilityRole="button"
            accessibilityLabel="Close preview"
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
    </SafeAreaView>
  );
}

// ── Vehicle row ───────────────────────────────────────────────────────────────

function VehicleRow({
  vehicle,
  index,
  selected,
  theme,
  onPress,
}: {
  vehicle: Vehicle;
  index: number;
  selected: boolean;
  theme: ReturnType<typeof useTheme>;
  onPress: () => void;
}) {
  const imageUri = vehicle.thumbnailUrl ?? vehicle.images?.[0]?.url ?? null;
  return (
    <Animated.View entering={FadeInDown.delay(index * 30).duration(300)}>
      <Pressable
        testID={`inspections-new-vehicle-row-${vehicle.id}`}
        accessibilityRole="button"
        accessibilityLabel={vehicle.name}
        onPress={onPress}
        style={({ pressed }) => ({
          backgroundColor: selected ? theme.accentSoft : theme.surface,
          borderRadius: 18,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? theme.accent : theme.borderLight,
          padding: 12,
          flexDirection: "row",
          alignItems: "center",
          transform: [{ scale: pressed ? 0.99 : 1 }],
        })}
      >
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            overflow: "hidden",
            backgroundColor: theme.surfaceTertiary,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={{ width: 56, height: 56 }}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <Camera size={20} color={theme.textTertiary} strokeWidth={1.5} />
          )}
        </View>

        <View style={{ flex: 1, marginRight: 10 }}>
          <Text
            variant="titleMedium"
            style={{ fontFamily: fontFamilies.semiBold, fontSize: 14 }}
            numberOfLines={1}
          >
            {vehicle.name}
          </Text>
          <Text
            variant="bodySmall"
            color={theme.textSecondary}
            style={{ fontSize: 12, marginTop: 2 }}
            numberOfLines={1}
          >
            {vehicle.brand} · {vehicle.licensePlate}
          </Text>
          <View style={{ marginTop: 6, alignSelf: "flex-start" }}>
            <StatusBadge status={vehicle.status} size="sm" />
          </View>
        </View>

        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: selected ? theme.accent : theme.border,
            backgroundColor: selected ? theme.accent : "transparent",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {selected && (
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: "#FFFFFF",
              }}
            />
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ── Selected vehicle header ───────────────────────────────────────────────────

function SelectedVehicleHeader({
  vehicle,
  theme,
  onChange,
  changeLabel,
}: {
  vehicle: Vehicle;
  theme: ReturnType<typeof useTheme>;
  onChange?: () => void;
  changeLabel: string;
}) {
  const imageUri = vehicle.thumbnailUrl ?? vehicle.images?.[0]?.url ?? null;
  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        padding: 10,
        marginTop: 8,
        borderRadius: 16,
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.borderLight,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          overflow: "hidden",
          backgroundColor: theme.surfaceTertiary,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 10,
        }}
      >
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={{ width: 44, height: 44 }}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <Camera size={18} color={theme.textTertiary} strokeWidth={1.5} />
        )}
      </View>

      <View style={{ flex: 1, marginRight: 8 }}>
        <Text
          variant="titleMedium"
          style={{ fontFamily: fontFamilies.semiBold, fontSize: 13 }}
          numberOfLines={1}
        >
          {vehicle.name}
        </Text>
        <Text
          variant="bodySmall"
          color={theme.textSecondary}
          style={{ fontSize: 11, marginTop: 1 }}
          numberOfLines={1}
        >
          {vehicle.brand} · {vehicle.licensePlate}
        </Text>
      </View>

      <View style={{ marginRight: onChange ? 8 : 0 }}>
        <StatusBadge status={vehicle.status} size="sm" />
      </View>

      {onChange && (
        <Pressable
          testID="inspections-new-change-vehicle-button"
          accessibilityRole="button"
          accessibilityLabel={changeLabel}
          onPress={onChange}
          hitSlop={6}
          style={({ pressed }) => ({
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 9999,
            backgroundColor: theme.accentSoft,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          })}
        >
          <Text
            variant="labelSmall"
            color={theme.accent}
            style={{ fontFamily: fontFamilies.semiBold, fontSize: 11 }}
          >
            {changeLabel}
          </Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

// ── Type row ──────────────────────────────────────────────────────────────────

function TypeRow({
  option,
  index,
  selected,
  theme,
  t,
  onPress,
}: {
  option: InspectionTypeOption;
  index: number;
  selected: boolean;
  theme: ReturnType<typeof useTheme>;
  t: ReturnType<typeof useTranslation>["t"];
  onPress: () => void;
}) {
  const Icon = option.icon;
  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(350)}>
      <Pressable
        testID={`inspections-new-type-${option.type}`}
        accessibilityRole="button"
        accessibilityLabel={t(option.titleKey, option.titleFallback)}
        onPress={onPress}
        style={({ pressed }) => ({
          backgroundColor: selected ? theme.accentSoft : theme.surface,
          borderRadius: 18,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? theme.accent : theme.borderLight,
          padding: 16,
          flexDirection: "row",
          alignItems: "center",
          transform: [{ scale: pressed ? 0.99 : 1 }],
        })}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: selected ? theme.accent : theme.accentSoft,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 14,
          }}
        >
          <Icon
            size={20}
            color={selected ? "#FFFFFF" : theme.accent}
            strokeWidth={2}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text
            variant="titleMedium"
            style={{ fontFamily: fontFamilies.semiBold, fontSize: 15 }}
          >
            {t(option.titleKey, option.titleFallback)}
          </Text>
          <Text
            variant="bodySmall"
            color={theme.textSecondary}
            style={{ fontSize: 12, marginTop: 2 }}
          >
            {t(option.subtitleKey, option.subtitleFallback)}
          </Text>
        </View>

        {selected && (
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: theme.accent,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Check size={14} color="#FFFFFF" strokeWidth={3} />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}
