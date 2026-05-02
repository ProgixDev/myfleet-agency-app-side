import React, { useState, useCallback, useEffect } from "react";
import { View, Pressable, Switch, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import {
  ChevronLeft,
  Lock,
  MapPin,
  Phone,
  Mail,
  Globe,
  Crown,
  UserPlus,
  Clock,
  Banknote,
  Bell,
  CalendarX,
  Truck,
  Search,
  CheckCircle2,
  AlertCircle,
  Pencil,
  Camera,
  ImageIcon,
  X,
  Check,
  FileText,
  Upload,
  Download,
  RefreshCw,
} from "lucide-react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as Linking from "expo-linking";
import DateTimePicker from "@react-native-community/datetimepicker";

import { ScreenWrapper } from "@/components/ui/ScreenWrapper";
import { Text } from "@/components/ui/Text";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Divider } from "@/components/ui/Divider";
import { Avatar } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Input";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/stores/useAuthStore";
import { useToastStore } from "@/components/ui/Toast";
import { type AutoCancelHours } from "@/stores/useAgencySettingsStore";
import { useCurrentAgency } from "@/stores/useAgencyStore";
import {
  useAgency,
  useAgencyDocuments,
  useAgencySettings,
  useTeam,
  useUpdateAgency,
  useUpdateAgencyDocument,
  useUpdateAgencySettings,
} from "@/hooks/useAgency";
import { formatCurrency, formatDate } from "@/utils/format";
import { getSignedDocumentUrl } from "@/services/agencyService";
import type { AgencyDocumentType } from "@/types/agency";
import {
  geocodeAddress,
  buildStaticMapUrl,
  MapsApiKeyMissingError,
  GeocodingError,
} from "@/services/mapsService";

// ── Auto-cancel options ─────────────────────────────────────────────────────

const AUTO_CANCEL_OPTIONS: { label: string; hours: AutoCancelHours }[] = [
  { label: "24h", hours: 24 },
  { label: "48h", hours: 48 },
  { label: "3 days", hours: 72 },
  { label: "7 days", hours: 168 },
];

// ── Component ───────────────────────────────────────────────────────────────

export default function AgencyScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const showToast = useToastStore((s) => s.show);
  const { data: agency, isLoading } = useAgency();
  const { data: team, isLoading: isTeamLoading } = useTeam();
  const updateAgency = useUpdateAgency();

  const { data: settings, isLoading: isSettingsLoading } = useAgencySettings();
  const updateAgencySettings = useUpdateAgencySettings();

  const { data: documents } = useAgencyDocuments();
  const updateDocument = useUpdateAgencyDocument();

  const delivery = settings?.delivery ?? {
    enabled: false,
    basePointLabel: "",
    basePointAddress: "",
    basePointLat: 0,
    basePointLng: 0,
    ratePerKm: 0,
    currency: "EUR",
  };
  const autoCancelEnabled = settings?.bookingPolicies?.autoCancelUnpaid ?? true;
  const autoCancelHours =
    (settings?.bookingPolicies?.autoCancelAfterHours as AutoCancelHours) ?? 48;
  const autoReminders = settings?.autoReminders ?? true;

  // ── Tenant switcher (dev only) ─────────────────────────────────────
  const currentAgency = useCurrentAgency();

  const [deliveryLabel, setDeliveryLabel] = useState(delivery.basePointLabel);
  const [deliveryAddress, setDeliveryAddress] = useState(
    delivery.basePointAddress,
  );
  const [resolvedLat, setResolvedLat] = useState<number>(delivery.basePointLat);
  const [resolvedLng, setResolvedLng] = useState<number>(delivery.basePointLng);
  const [resolvedAddress, setResolvedAddress] = useState<string>(
    delivery.basePointAddress && delivery.basePointLat !== 0
      ? delivery.basePointAddress
      : "",
  );
  const [deliveryRate, setDeliveryRateInput] = useState(
    delivery.ratePerKm > 0 ? String(delivery.ratePerKm / 100) : "",
  );
  const [deliveryMinFee, setDeliveryMinFeeInput] = useState(
    delivery.minFee != null ? String(delivery.minFee) : "",
  );
  const [deliveryMaxDistance, setDeliveryMaxDistanceInput] = useState(
    delivery.maxDistanceKm != null ? String(delivery.maxDistanceKm) : "",
  );
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // ── Agency branding edit state ────────────────────────────────────
  const [isEditingAgency, setIsEditingAgency] = useState(false);
  const [editName, setEditName] = useState(agency?.name ?? "");
  const [editAddress, setEditAddress] = useState(agency?.address ?? "");
  const [editPhone, setEditPhone] = useState(agency?.phone ?? "");
  const [editEmail, setEditEmail] = useState(agency?.email ?? "");
  const [editWebsite, setEditWebsite] = useState(agency?.website ?? "");
  const [selectedLogoFile, setSelectedLogoFile] = useState<{
    uri: string;
    name: string;
    mimeType: string;
  } | null>(null);
  const [showLogoSheet, setShowLogoSheet] = useState(false);

  // ── Business settings edit state ──────────────────────────────────
  const [isEditingBusiness, setIsEditingBusiness] = useState(false);
  const [editAdminFee, setEditAdminFee] = useState(
    settings?.adminFee != null ? String(settings.adminFee / 100) : "",
  );
  const [editWorkingHoursStart, setEditWorkingHoursStart] = useState(
    settings?.workingHoursStart ?? "",
  );
  const [editWorkingHoursEnd, setEditWorkingHoursEnd] = useState(
    settings?.workingHoursEnd ?? "",
  );
  const [businessFieldErrors, setBusinessFieldErrors] = useState<
    Record<string, string>
  >({});
  const [timePickerField, setTimePickerField] = useState<
    "start" | "end" | null
  >(null);

  // ── Time helpers ──────────────────────────────────────────────────
  const parseTimeString = useCallback((time: string): Date => {
    const [hours, minutes] = time.split(":").map(Number);
    const d = new Date();
    d.setHours(hours ?? 9, minutes ?? 0, 0, 0);
    return d;
  }, []);

  const formatTime = useCallback((date: Date): string => {
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }, []);

  // ── Field-level validation errors ─────────────────────────────────
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validateField = useCallback(
    (field: string, value: string) => {
      let error = "";
      switch (field) {
        case "name":
          if (!value.trim()) {
            error = t("agency.errors.nameRequired", "Agency name is required");
          } else if (value.trim().length > 255) {
            error = t(
              "agency.errors.nameTooLong",
              "Agency name must be under 255 characters",
            );
          }
          break;
        case "address":
          if (value.trim().length > 500) {
            error = t(
              "agency.errors.addressTooLong",
              "Address must be under 500 characters",
            );
          }
          break;
        case "phone":
          if (
            value.trim() &&
            !/^[\d\s\+\-\(\)]{3,50}$/.test(value.trim())
          ) {
            error = t(
              "agency.errors.phoneInvalid",
              "Please enter a valid phone number",
            );
          }
          break;
        case "email":
          if (
            value.trim() &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
          ) {
            error = t(
              "agency.errors.emailInvalid",
              "Please enter a valid email address",
            );
          }
          break;
        case "website":
          if (
            value.trim() &&
            !/^(https?:\/\/)?([\w\-]+\.)+[\w\-]+(\/[^\s]*)?$/.test(
              value.trim(),
            )
          ) {
            error = t(
              "agency.errors.websiteInvalid",
              "Please enter a valid website URL",
            );
          }
          break;
      }
      setFieldErrors((prev) => ({ ...prev, [field]: error }));
      return error === "";
    },
    [t],
  );

  const isFormValid = useCallback(() => {
    const nameValid = validateField("name", editName);
    const addressValid = validateField("address", editAddress);
    const phoneValid = validateField("phone", editPhone);
    const emailValid = validateField("email", editEmail);
    const websiteValid = validateField("website", editWebsite);
    return nameValid && addressValid && phoneValid && emailValid && websiteValid;
  }, [
    validateField,
    editName,
    editAddress,
    editPhone,
    editEmail,
    editWebsite,
  ]);

  // Reset the editable form when switching tenants so the inputs reflect the
  // newly-selected agency's persisted values.
  useEffect(() => {
    setDeliveryLabel(delivery.basePointLabel);
    setDeliveryAddress(delivery.basePointAddress);
    setResolvedLat(delivery.basePointLat);
    setResolvedLng(delivery.basePointLng);
    setResolvedAddress(
      delivery.basePointAddress && delivery.basePointLat !== 0
        ? delivery.basePointAddress
        : "",
    );
    setDeliveryRateInput(
      delivery.ratePerKm > 0 ? String(delivery.ratePerKm / 100) : "",
    );
    setDeliveryMinFeeInput(
      delivery.minFee != null ? String(delivery.minFee / 100) : "",
    );
    setDeliveryMaxDistanceInput(
      delivery.maxDistanceKm != null ? String(delivery.maxDistanceKm) : "",
    );
    setSearchError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.delivery?.basePointLabel, settings?.delivery?.basePointAddress]);

  // Reset agency edit form when agency data changes.
  useEffect(() => {
    setEditName(agency?.name ?? "");
    setEditAddress(agency?.address ?? "");
    setEditPhone(agency?.phone ?? "");
    setEditEmail(agency?.email ?? "");
    setEditWebsite(agency?.website ?? "");
    setSelectedLogoFile(null);
    setIsEditingAgency(false);
  }, [agency?.id]);

  // Reset business edit form when settings change.
  useEffect(() => {
    setEditAdminFee(
      settings?.adminFee != null ? String(settings.adminFee / 100) : "",
    );
    setEditWorkingHoursStart(settings?.workingHoursStart ?? "");
    setEditWorkingHoursEnd(settings?.workingHoursEnd ?? "");
    setBusinessFieldErrors({});
    setIsEditingBusiness(false);
  }, [settings?.adminFee, settings?.workingHoursStart, settings?.workingHoursEnd]);

  const hasResolved = resolvedLat !== 0 || resolvedLng !== 0;
  const staticMapUrl = hasResolved
    ? buildStaticMapUrl(resolvedLat, resolvedLng, { width: 600, height: 240 })
    : null;

  const handleSearchAddress = useCallback(async () => {
    if (!deliveryAddress.trim()) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSearching(true);
    setSearchError(null);
    try {
      const result = await geocodeAddress(deliveryAddress);
      setResolvedLat(result.lat);
      setResolvedLng(result.lng);
      setResolvedAddress(result.formattedAddress);
    } catch (err) {
      let key = "settings.delivery.errorUnknown";
      if (err instanceof MapsApiKeyMissingError) {
        key = "settings.delivery.apiKeyMissing";
      } else if (err instanceof GeocodingError) {
        key =
          err.code === "ZERO_RESULTS"
            ? "settings.delivery.errorZeroResults"
            : err.code === "OVER_QUERY_LIMIT"
              ? "settings.delivery.errorQuota"
              : err.code === "REQUEST_DENIED"
                ? "settings.delivery.errorRequestDenied"
                : err.code === "NETWORK"
                  ? "settings.delivery.errorNetwork"
                  : "settings.delivery.errorUnknown";
      }
      const message = t(key, "Error");
      setSearchError(message);
      showToast({ variant: "error", title: message });
    } finally {
      setSearching(false);
    }
  }, [deliveryAddress, showToast, t]);

  const handleSaveDelivery = useCallback(async () => {
    const rate = Number.parseFloat(deliveryRate.replace(",", "."));
    if (!Number.isFinite(rate) || rate <= 0) {
      showToast({
        variant: "error",
        title: t("settings.delivery.rateInvalid", "Invalid rate per km"),
      });
      return;
    }

    const parsedMinFee = deliveryMinFee.trim()
      ? Number.parseFloat(deliveryMinFee.replace(",", "."))
      : undefined;
    const parsedMaxDistance = deliveryMaxDistance.trim()
      ? Number.parseFloat(deliveryMaxDistance.replace(",", "."))
      : undefined;

    try {
      await updateAgencySettings.mutateAsync({
        deliveryEnabled: true,
        deliveryBasePointLabel: deliveryLabel.trim(),
        deliveryBasePointAddress: resolvedAddress || deliveryAddress.trim(),
        deliveryBasePointLat: resolvedLat,
        deliveryBasePointLng: resolvedLng,
        deliveryRatePerKm: Math.round(rate * 100),
        deliveryMinFee:
          parsedMinFee != null &&
          Number.isFinite(parsedMinFee) &&
          parsedMinFee >= 0
            ? Math.round(parsedMinFee * 100)
            : undefined,
        deliveryMaxDistanceKm:
          parsedMaxDistance != null &&
          Number.isFinite(parsedMaxDistance) &&
          parsedMaxDistance > 0
            ? Math.round(parsedMaxDistance)
            : undefined,
      });

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast({
        variant: "success",
        title: t("settings.delivery.saved", "Delivery settings saved"),
      });
    } catch (err: any) {
      showToast({
        variant: "error",
        title: err?.message ?? t("settings.delivery.saveFailed", "Failed to save delivery settings"),
      });
    }
  }, [
    deliveryAddress,
    deliveryLabel,
    deliveryMaxDistance,
    deliveryMinFee,
    deliveryRate,
    resolvedAddress,
    resolvedLat,
    resolvedLng,
    updateAgencySettings,
    showToast,
    t,
  ]);

  const comingSoon = () => {
    showToast({
      variant: "info",
      title: "Coming soon",
      message: "Cette fonctionnalité sera disponible prochainement.",
    });
  };

  // ── Agency branding handlers ─────────────────────────────────────
  const handlePickLogoFromLibrary = async () => {
    setShowLogoSheet(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setSelectedLogoFile({
        uri: asset.uri,
        name: asset.fileName ?? `logo-${Date.now()}.jpg`,
        mimeType: asset.mimeType ?? "image/jpeg",
      });
    }
  };

  const handleTakeLogoPhoto = async () => {
    setShowLogoSheet(false);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      showToast({
        variant: "error",
        title: "Permission refusée",
        message: "L'accès à la caméra est nécessaire pour prendre une photo.",
      });
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setSelectedLogoFile({
        uri: asset.uri,
        name: asset.fileName ?? `logo-${Date.now()}.jpg`,
        mimeType: asset.mimeType ?? "image/jpeg",
      });
    }
  };

  const handleSaveAgency = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!isFormValid()) {
      showToast({
        variant: "error",
        title: t("agency.errors.fixFields", "Please fix the errors above"),
      });
      return;
    }

    try {
      await updateAgency.mutateAsync({
        name: editName.trim(),
        address: editAddress.trim() || undefined,
        phone: editPhone.trim() || undefined,
        email: editEmail.trim() || undefined,
        website: editWebsite.trim() || undefined,
        logoFile: selectedLogoFile,
      });

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast({
        variant: "success",
        title: t("agency.saved", "Agency information saved"),
      });
      setSelectedLogoFile(null);
      setFieldErrors({});
      setIsEditingAgency(false);
    } catch (err: any) {
      showToast({
        variant: "error",
        title:
          err?.message ?? t("agency.saveFailed", "Failed to save agency info"),
      });
    }
  };

  const handleCancelEdit = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditName(agency?.name ?? "");
    setEditAddress(agency?.address ?? "");
    setEditPhone(agency?.phone ?? "");
    setEditEmail(agency?.email ?? "");
    setEditWebsite(agency?.website ?? "");
    setSelectedLogoFile(null);
    setFieldErrors({});
    setIsEditingAgency(false);
  };

  // ── Business settings handlers ────────────────────────────────────
  const validateBusinessFields = useCallback(() => {
    const errors: Record<string, string> = {};

    if (editAdminFee.trim()) {
      const val = Number.parseFloat(editAdminFee.replace(",", "."));
      if (!Number.isFinite(val) || val < 0) {
        errors.adminFee = t(
          "agency.errors.adminFeeInvalid",
          "Please enter a valid amount",
        );
      }
    }

    setBusinessFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [editAdminFee, t]);

  const handleSaveBusiness = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!validateBusinessFields()) {
      showToast({
        variant: "error",
        title: t("agency.errors.fixFields", "Please fix the errors above"),
      });
      return;
    }

    const payload: Record<string, unknown> = {};
    if (editAdminFee.trim()) {
      const fee = Number.parseFloat(editAdminFee.replace(",", "."));
      if (Number.isFinite(fee) && fee >= 0) {
        payload.adminFee = Math.round(fee * 100);
      }
    }
    if (editWorkingHoursStart.trim()) {
      payload.workingHoursStart = editWorkingHoursStart.trim();
    }
    if (editWorkingHoursEnd.trim()) {
      payload.workingHoursEnd = editWorkingHoursEnd.trim();
    }

    if (Object.keys(payload).length === 0) {
      setIsEditingBusiness(false);
      return;
    }

    try {
      await updateAgencySettings.mutateAsync(payload);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast({
        variant: "success",
        title: t("agency.businessSaved", "Business settings saved"),
      });
      setIsEditingBusiness(false);
    } catch (err: any) {
      showToast({
        variant: "error",
        title:
          err?.message ??
          t("agency.businessSaveFailed", "Failed to save business settings"),
      });
    }
  };

  const handleCancelBusinessEdit = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditAdminFee(
      settings?.adminFee != null ? String(settings.adminFee / 100) : "",
    );
    setEditWorkingHoursStart(settings?.workingHoursStart ?? "");
    setEditWorkingHoursEnd(settings?.workingHoursEnd ?? "");
    setBusinessFieldErrors({});
    setIsEditingBusiness(false);
  };

  // ── Document handlers ─────────────────────────────────────────
  const handleUploadDocument = async (type: AgencyDocumentType) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0)
        return;

      const asset = result.assets[0];
      await updateDocument.mutateAsync({
        type,
        file: {
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType ?? "application/octet-stream",
        },
      });

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast({
        variant: "success",
        title: t("agency.documentUpdated", "Document updated"),
      });
    } catch (err: any) {
      showToast({
        variant: "error",
        title:
          err?.message ?? t("agency.documentUpdateFailed", "Upload failed"),
      });
    }
  };

  const handleDownloadDocument = async (key: string) => {
    try {
      const url = await getSignedDocumentUrl(key);
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        showToast({
          variant: "error",
          title: t("agency.cannotOpenUrl", "Cannot open document URL"),
        });
      }
    } catch (err: any) {
      showToast({
        variant: "error",
        title:
          err?.message ?? t("agency.documentDownloadFailed", "Download failed"),
      });
    }
  };

  // ── Admin guard ───────────────────────────────────────────────
  if (role !== "admin") {
    return (
      <ScreenWrapper>
        <View className="flex-row items-center pt-6 pb-4">
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            className="mr-3"
          >
            <ChevronLeft size={24} color={theme.textPrimary} strokeWidth={2} />
          </Pressable>
          <Text variant="headlineLarge" className="flex-1">
            Agence
          </Text>
        </View>

        <View className="flex-1 items-center justify-center pb-20">
          <Lock size={64} color={theme.danger} strokeWidth={1} />
          <Text variant="headlineMedium" color={theme.danger} className="mt-4">
            Accès administrateur requis
          </Text>
          <Text
            variant="bodyMedium"
            color={theme.textSecondary}
            align="center"
            className="mt-2 px-8"
          >
            Cette section est réservée aux administrateurs.
          </Text>
          <View className="mt-6">
            <Button variant="secondary" onPress={() => router.back()}>
              Retour
            </Button>
          </View>
        </View>
      </ScreenWrapper>
    );
  }

  // ── Loading state ─────────────────────────────────────────────
  if (isLoading) {
    return (
      <ScreenWrapper>
        <View className="flex-row items-center pt-6 pb-4">
          <Pressable onPress={() => router.back()} className="mr-3">
            <ChevronLeft size={24} color={theme.textPrimary} strokeWidth={2} />
          </Pressable>
          <Text variant="headlineLarge" className="flex-1">
            Agence
          </Text>
        </View>
        <View className="flex-1 items-center justify-center pb-20">
          <ActivityIndicator size="large" color={theme.accent} />
          <Text
            variant="bodyMedium"
            color={theme.textSecondary}
            className="mt-4"
          >
            Chargement...
          </Text>
        </View>
      </ScreenWrapper>
    );
  }

  // ── Admin view ────────────────────────────────────────────────
  return (
    <ScreenWrapper scroll>
      {/* Header */}
      <Animated.View
        entering={FadeInDown.duration(400)}
        className="flex-row items-center pt-6 pb-4"
      >
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          className="mr-3"
        >
          <ChevronLeft size={24} color={theme.textPrimary} strokeWidth={2} />
        </Pressable>
        <Text variant="headlineLarge" className="flex-1">
          Agence
        </Text>
      </Animated.View>

      {/* Agency Info Card */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(50)}
        className="mb-4"
      >
        <Card>
          {!isEditingAgency ? (
            <>
              <View className="flex-row items-center mb-3">
                {(agency?.logo || selectedLogoFile) && (
                  <Image
                    source={selectedLogoFile?.uri ?? agency?.logo}
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 12,
                      marginRight: 12,
                    }}
                    contentFit="cover"
                    transition={200}
                  />
                )}
                <View className="flex-1">
                  <Text variant="headlineMedium">
                    {agency?.name || currentAgency.name || "—"}
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(
                      Haptics.ImpactFeedbackStyle.Light,
                    );
                    setIsEditingAgency(true);
                  }}
                  style={{
                    padding: 8,
                    borderRadius: 9999,
                    backgroundColor: theme.surfaceSecondary,
                  }}
                >
                  <Pencil
                    size={18}
                    color={theme.textSecondary}
                    strokeWidth={2}
                  />
                </Pressable>
              </View>

              <View className="flex-row items-center mb-2">
                <MapPin
                  size={16}
                  color={theme.textSecondary}
                  strokeWidth={1.8}
                />
                <Text
                  variant="bodyMedium"
                  color={theme.textSecondary}
                  className="ml-2"
                >
                  {agency?.address || "—"}
                </Text>
              </View>

              <View className="flex-row items-center mb-2">
                <Phone
                  size={16}
                  color={theme.textSecondary}
                  strokeWidth={1.8}
                />
                <Text
                  variant="bodyMedium"
                  color={theme.textSecondary}
                  className="ml-2"
                >
                  {agency?.phone || "—"}
                </Text>
              </View>

              <View className="flex-row items-center mb-2">
                <Mail
                  size={16}
                  color={theme.textSecondary}
                  strokeWidth={1.8}
                />
                <Text
                  variant="bodyMedium"
                  color={theme.textSecondary}
                  className="ml-2"
                >
                  {agency?.email || "—"}
                </Text>
              </View>

              <View className="flex-row items-center">
                <Globe
                  size={16}
                  color={theme.textSecondary}
                  strokeWidth={1.8}
                />
                <Text variant="bodyMedium" color={theme.accent} className="ml-2">
                  {agency?.website || "—"}
                </Text>
              </View>
            </>
          ) : (
            <View style={{ gap: 14 }}>
              {/* Logo section */}
              <View className="items-center">
                <View
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 16,
                    backgroundColor: theme.surfaceSecondary,
                    overflow: "hidden",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  {selectedLogoFile || agency?.logo ? (
                    <Image
                      source={selectedLogoFile?.uri ?? agency?.logo}
                      style={{ width: 96, height: 96 }}
                      contentFit="cover"
                      transition={200}
                    />
                  ) : (
                    <Text
                      variant="headlineLarge"
                      color={theme.textTertiary}
                    >
                      {(editName || "A").charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>
                <View className="flex-row mt-3" style={{ gap: 10 }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={ImageIcon}
                    onPress={() => setShowLogoSheet(true)}
                  >
                    {t("agency.changeLogo", "Change logo")}
                  </Button>
                </View>
              </View>

              <Input
                label={t("agency.name", "Agency name")}
                placeholder={t("agency.namePlaceholder", "My Fleet SAS")}
                value={editName}
                onChangeText={(text) => {
                  setEditName(text);
                  validateField("name", text);
                }}
                error={fieldErrors.name}
              />

              <Input
                label={t("agency.address", "Address")}
                placeholder={t(
                  "agency.addressPlaceholder",
                  "14 Rue de la Paix, 75002 Paris",
                )}
                value={editAddress}
                onChangeText={(text) => {
                  setEditAddress(text);
                  validateField("address", text);
                }}
                leftIcon={MapPin}
                error={fieldErrors.address}
              />

              <Input
                label={t("agency.phone", "Phone")}
                placeholder={t(
                  "agency.phonePlaceholder",
                  "+33 1 42 00 00 00",
                )}
                value={editPhone}
                onChangeText={(text) => {
                  setEditPhone(text);
                  validateField("phone", text);
                }}
                leftIcon={Phone}
                keyboardType="phone-pad"
                error={fieldErrors.phone}
              />

              <Input
                label={t("agency.email", "Email")}
                placeholder={t(
                  "agency.emailPlaceholder",
                  "contact@myfleet.fr",
                )}
                value={editEmail}
                onChangeText={(text) => {
                  setEditEmail(text);
                  validateField("email", text);
                }}
                leftIcon={Mail}
                keyboardType="email-address"
                autoCapitalize="none"
                error={fieldErrors.email}
              />

              <Input
                label={t("agency.website", "Website")}
                placeholder={t(
                  "agency.websitePlaceholder",
                  "www.myfleet.fr",
                )}
                value={editWebsite}
                onChangeText={(text) => {
                  setEditWebsite(text);
                  validateField("website", text);
                }}
                leftIcon={Globe}
                autoCapitalize="none"
                error={fieldErrors.website}
              />

              <View className="flex-row" style={{ gap: 10 }}>
                <View className="flex-1">
                  <Button
                    variant="secondary"
                    fullWidth
                    leftIcon={X}
                    onPress={handleCancelEdit}
                  >
                    {t("common.cancel", "Cancel")}
                  </Button>
                </View>
                <View className="flex-1">
                  <Button
                    variant="primary"
                    fullWidth
                    leftIcon={Check}
                    disabled={updateAgency.isPending}
                    onPress={handleSaveAgency}
                  >
                    {updateAgency.isPending
                      ? t("common.saving", "Saving...")
                      : t("common.save", "Save")}
                  </Button>
                </View>
              </View>
            </View>
          )}
        </Card>
      </Animated.View>

      {/* Plan Card */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(100)}
        className="mb-4"
      >
        <Card>
          <View className="flex-row items-center mb-3">
            <Crown size={20} color={theme.accent} strokeWidth={1.8} />
            <Text variant="headlineSmall" className="ml-2 flex-1">
              Abonnement
            </Text>
            <Badge variant="accent" size="md">
              {agency?.plan
                ? agency.plan.charAt(0).toUpperCase() + agency.plan.slice(1)
                : "—"}
            </Badge>
          </View>
          <Divider className="mb-3" />
          <View className="flex-row justify-between mb-2">
            <Text variant="bodyMedium" color={theme.textSecondary}>
              Tarif mensuel
            </Text>
            <Text variant="titleMedium">
              {agency?.subscription?.monthlyPrice != null
                ? `${formatCurrency(agency.subscription.monthlyPrice / 100, agency.currency)}/mois`
                : "—"}
            </Text>
          </View>
          <View className="flex-row justify-between mb-4">
            <Text variant="bodyMedium" color={theme.textSecondary}>
              Prochaine facturation
            </Text>
            <Text variant="titleMedium">
              {agency?.subscription?.nextBillingDate
                ? formatDate(agency.subscription.nextBillingDate, "long")
                : "—"}
            </Text>
          </View>
          <Button fullWidth variant="secondary" onPress={comingSoon}>
            Mettre à niveau
          </Button>
        </Card>
      </Animated.View>

      {/* Users List */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(150)}
        className="mb-4"
      >
        <Card>
          <Text variant="headlineSmall" className="mb-3">
            Équipe
          </Text>
          {isTeamLoading ? (
            <ActivityIndicator color={theme.accent} />
          ) : (
            (team ?? []).map((member, index) => (
              <React.Fragment key={member.id}>
                {index > 0 && <Divider className="my-2.5" />}
                <View className="flex-row items-center">
                  <Avatar name={member.name} size="sm" />
                  <View className="flex-1 ml-3">
                    <Text variant="titleMedium">{member.name}</Text>
                    <Text variant="bodySmall" color={theme.textTertiary}>
                      {member.lastActive
                        ? formatDate(member.lastActive, "relative")
                        : "—"}
                    </Text>
                  </View>
                  <Badge
                    variant={member.role === "admin" ? "accent" : "neutral"}
                    size="sm"
                  >
                    {member.role === "admin" ? "Admin" : "Employé"}
                  </Badge>
                </View>
              </React.Fragment>
            ))
          )}
          <View className="mt-4">
            <Button
              fullWidth
              variant="secondary"
              leftIcon={UserPlus}
              onPress={comingSoon}
            >
              Inviter un utilisateur
            </Button>
          </View>
        </Card>
      </Animated.View>

      {/* Business Settings */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(200)}
        className="mb-4"
      >
        <Card>
          <View className="flex-row items-center mb-3">
            <Text variant="headlineSmall" className="flex-1">
              Paramètres de l&apos;agence
            </Text>
            {!isEditingBusiness && (
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setIsEditingBusiness(true);
                }}
                style={{
                  padding: 8,
                  borderRadius: 9999,
                  backgroundColor: theme.surfaceSecondary,
                }}
              >
                <Pencil
                  size={18}
                  color={theme.textSecondary}
                  strokeWidth={2}
                />
              </Pressable>
            )}
          </View>

          {!isEditingBusiness ? (
            <>
              <View className="flex-row items-center mb-3">
                <Banknote size={18} color={theme.textSecondary} strokeWidth={1.8} />
                <Text variant="bodyMedium" className="flex-1 ml-3">
                  Frais administratifs
                </Text>
                <Text variant="titleMedium" color={theme.accent}>
                  {settings?.adminFee != null
                    ? formatCurrency(
                        settings.adminFee / 100,
                        agency?.currency,
                      )
                    : "—"}
                </Text>
              </View>

              <Divider className="mb-3" />

              <View className="flex-row items-center mb-3">
                <Clock size={18} color={theme.textSecondary} strokeWidth={1.8} />
                <Text variant="bodyMedium" className="flex-1 ml-3">
                  Horaires de travail
                </Text>
                <Text variant="titleMedium" color={theme.textSecondary}>
                  {settings?.workingHoursStart &&
                  settings?.workingHoursEnd
                    ? `${settings.workingHoursStart} - ${settings.workingHoursEnd}`
                    : "—"}
                </Text>
              </View>

              <Divider className="mb-3" />

              <View className="flex-row items-center">
                <Bell size={18} color={theme.textSecondary} strokeWidth={1.8} />
                <Text variant="bodyMedium" className="flex-1 ml-3">
                  Rappels automatiques
                </Text>
                <Switch
                  value={autoReminders}
                  onValueChange={(val) => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    updateAgencySettings.mutate({ autoReminders: val });
                  }}
                  trackColor={{
                    false: theme.surfaceTertiary,
                    true: theme.accentSoft,
                  }}
                  thumbColor={autoReminders ? theme.accent : theme.textTertiary}
                />
              </View>
            </>
          ) : (
            <View style={{ gap: 14 }}>
              <Input
                label={t("agency.adminFee", "Admin fee")}
                placeholder={t("agency.adminFeePlaceholder", "E.g. 25.00")}
                value={editAdminFee}
                onChangeText={(text) =>
                  setEditAdminFee(text.replace(/[^0-9.,]/g, ""))
                }
                keyboardType="decimal-pad"
                leftIcon={Banknote}
                error={businessFieldErrors.adminFee}
              />

              <View className="flex-row" style={{ gap: 10 }}>
                <View className="flex-1">
                  <Pressable
                    onPress={() => setTimePickerField("start")}
                    style={{
                      borderWidth: 1,
                      borderColor: businessFieldErrors.workingHoursStart
                        ? theme.danger
                        : theme.border,
                      borderRadius: 14,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      backgroundColor: theme.surface,
                      flexDirection: "row",
                      alignItems: "center",
                    }}
                  >
                    <Clock
                      size={18}
                      color={theme.textSecondary}
                      strokeWidth={1.8}
                    />
                    <View className="ml-3 flex-1">
                      <Text
                        variant="caption"
                        color={theme.textSecondary}
                      >
                        {t("agency.workingHoursStart", "Start")}
                      </Text>
                      <Text variant="bodyMedium">
                        {editWorkingHoursStart || "09:00"}
                      </Text>
                    </View>
                  </Pressable>
                  {businessFieldErrors.workingHoursStart && (
                    <Text
                      variant="caption"
                      color={theme.danger}
                      className="mt-1"
                    >
                      {businessFieldErrors.workingHoursStart}
                    </Text>
                  )}
                </View>
                <View className="flex-1">
                  <Pressable
                    onPress={() => setTimePickerField("end")}
                    style={{
                      borderWidth: 1,
                      borderColor: businessFieldErrors.workingHoursEnd
                        ? theme.danger
                        : theme.border,
                      borderRadius: 14,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      backgroundColor: theme.surface,
                      flexDirection: "row",
                      alignItems: "center",
                    }}
                  >
                    <Clock
                      size={18}
                      color={theme.textSecondary}
                      strokeWidth={1.8}
                    />
                    <View className="ml-3 flex-1">
                      <Text
                        variant="caption"
                        color={theme.textSecondary}
                      >
                        {t("agency.workingHoursEnd", "End")}
                      </Text>
                      <Text variant="bodyMedium">
                        {editWorkingHoursEnd || "18:00"}
                      </Text>
                    </View>
                  </Pressable>
                  {businessFieldErrors.workingHoursEnd && (
                    <Text
                      variant="caption"
                      color={theme.danger}
                      className="mt-1"
                    >
                      {businessFieldErrors.workingHoursEnd}
                    </Text>
                  )}
                </View>
              </View>

              {timePickerField === "start" && (
                <DateTimePicker
                  value={parseTimeString(editWorkingHoursStart || "09:00")}
                  mode="time"
                  is24Hour={true}
                  display="default"
                  onChange={(event, date) => {
                    if (event.type === "dismissed" || !date) {
                      setTimePickerField(null);
                      return;
                    }
                    setEditWorkingHoursStart(formatTime(date));
                    setTimePickerField(null);
                  }}
                />
              )}
              {timePickerField === "end" && (
                <DateTimePicker
                  value={parseTimeString(editWorkingHoursEnd || "18:00")}
                  mode="time"
                  is24Hour={true}
                  display="default"
                  onChange={(event, date) => {
                    if (event.type === "dismissed" || !date) {
                      setTimePickerField(null);
                      return;
                    }
                    setEditWorkingHoursEnd(formatTime(date));
                    setTimePickerField(null);
                  }}
                />
              )}

              <View className="flex-row" style={{ gap: 10 }}>
                <View className="flex-1">
                  <Button
                    variant="secondary"
                    fullWidth
                    leftIcon={X}
                    onPress={handleCancelBusinessEdit}
                  >
                    {t("common.cancel", "Cancel")}
                  </Button>
                </View>
                <View className="flex-1">
                  <Button
                    variant="primary"
                    fullWidth
                    leftIcon={Check}
                    disabled={updateAgencySettings.isPending}
                    onPress={handleSaveBusiness}
                  >
                    {updateAgencySettings.isPending
                      ? t("common.saving", "Saving...")
                      : t("common.save", "Save")}
                  </Button>
                </View>
              </View>
            </View>
          )}
        </Card>
      </Animated.View>

      {/* Documents */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(225)}
        className="mb-4"
      >
        <Card>
          <View className="flex-row items-center mb-3">
            <FileText size={20} color={theme.accent} strokeWidth={1.8} />
            <Text variant="headlineSmall" className="ml-2 flex-1">
              {t("agency.documents", { defaultValue: "Documents" })}
            </Text>
          </View>

          {(
            [
              {
                type: "kbis" as AgencyDocumentType,
                label: t("agency.kbis", { defaultValue: "KBIS" }),
                hint: t("agency.kbisHint", {
                  defaultValue: "Company registration document",
                }),
              },
              {
                type: "license" as AgencyDocumentType,
                label: t("agency.license", { defaultValue: "License" }),
                hint: t("agency.licenseHint", {
                  defaultValue: "Business license",
                }),
              },
              {
                type: "insurance" as AgencyDocumentType,
                label: t("agency.insurance", { defaultValue: "Insurance" }),
                hint: t("agency.insuranceHint", {
                  defaultValue: "Insurance certificate",
                }),
              },
            ] as const
          ).map((docType, index) => {
            const doc = documents?.find((d) => d.type === docType.type);
            const isUploaded = !!doc && doc.size > 0;

            return (
              <View key={docType.type}>
                {index > 0 && <Divider className="my-3" />}
                <View className="flex-row items-center">
                  <View className="flex-1">
                    <Text variant="titleMedium">{docType.label}</Text>
                    <Text
                      variant="bodySmall"
                      color={theme.textSecondary}
                      className="mt-0.5"
                    >
                      {isUploaded ? doc?.originalName : docType.hint}
                    </Text>
                  </View>
                  <Badge
                    variant={isUploaded ? "success" : "warning"}
                    size="sm"
                  >
                    {isUploaded
                      ? t("agency.uploaded", { defaultValue: "Uploaded" })
                      : t("agency.missing", { defaultValue: "Missing" })}
                  </Badge>
                </View>
                <View className="flex-row mt-2.5" style={{ gap: 8 }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={isUploaded ? RefreshCw : Upload}
                    disabled={updateDocument.isPending}
                    onPress={() => handleUploadDocument(docType.type)}
                  >
                    {isUploaded
                      ? t("agency.replace", { defaultValue: "Replace" })
                      : t("agency.upload", { defaultValue: "Upload" })}
                  </Button>
                  {isUploaded && (
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={Download}
                      onPress={() => handleDownloadDocument(doc!.key)}
                    >
                      {t("agency.download", { defaultValue: "Download" })}
                    </Button>
                  )}
                </View>
              </View>
            );
          })}
        </Card>
      </Animated.View>

      {/* Delivery */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(250)}
        className="mb-4"
      >
        <Card>
          <View className="flex-row items-center mb-1">
            <Truck size={20} color={theme.accent} strokeWidth={1.8} />
            <Text variant="headlineSmall" className="ml-2 flex-1">
              {t("settings.delivery.sectionTitle", "Delivery")}
            </Text>
            <Switch
              value={delivery.enabled}
              onValueChange={(val) => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                updateAgencySettings.mutate({ deliveryEnabled: val });
              }}
              trackColor={{
                false: theme.surfaceTertiary,
                true: theme.accentSoft,
              }}
              thumbColor={delivery.enabled ? theme.accent : theme.textTertiary}
            />
          </View>
          <Text
            variant="bodySmall"
            color={theme.textSecondary}
            className="mb-4"
          >
            {t(
              "settings.delivery.sectionSubtitle",
              "Configure base point and per-km rate",
            )}
          </Text>

          {delivery.enabled && (
            <View style={{ gap: 14 }}>
              <Input
                label={t("settings.delivery.basePointLabel", "Base point name")}
                placeholder={t(
                  "settings.delivery.basePointLabelPlaceholder",
                  "E.g. Geneva-Centre agency",
                )}
                value={deliveryLabel}
                onChangeText={setDeliveryLabel}
              />

              <View>
                <Input
                  label={t(
                    "settings.delivery.basePointAddress",
                    "Base address",
                  )}
                  placeholder={t(
                    "settings.delivery.basePointAddressPlaceholder",
                    "Street, number, postcode, city",
                  )}
                  value={deliveryAddress}
                  onChangeText={(text) => {
                    setDeliveryAddress(text);
                    if (searchError) setSearchError(null);
                  }}
                  leftIcon={MapPin}
                  error={searchError ?? undefined}
                />
                <View className="mt-3">
                  <Button
                    variant="secondary"
                    size="md"
                    leftIcon={Search}
                    disabled={searching || deliveryAddress.trim().length === 0}
                    onPress={handleSearchAddress}
                  >
                    {searching
                      ? t("settings.delivery.searching", "Searching…")
                      : t("settings.delivery.search", "Search")}
                  </Button>
                </View>
              </View>

              {searching && (
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <ActivityIndicator color={theme.accent} />
                  <Text variant="bodySmall" color={theme.textSecondary}>
                    {t("settings.delivery.searching", "Searching…")}
                  </Text>
                </View>
              )}

              {!searching && hasResolved && (
                <View
                  style={{
                    backgroundColor: theme.successSoft,
                    borderRadius: 14,
                    padding: 12,
                    gap: 8,
                  }}
                >
                  <View className="flex-row items-center" style={{ gap: 8 }}>
                    <CheckCircle2 size={16} color={theme.success} />
                    <Text variant="titleSmall" color={theme.success}>
                      {t("settings.delivery.resolved", "Address resolved")}
                    </Text>
                  </View>
                  <Text variant="bodySmall" color={theme.textPrimary}>
                    {resolvedAddress || deliveryAddress}
                  </Text>
                  <Text variant="caption" color={theme.textTertiary}>
                    {t("settings.delivery.coordinates", "Coordinates")}:{" "}
                    {resolvedLat.toFixed(6)}, {resolvedLng.toFixed(6)}
                  </Text>
                  {staticMapUrl && (
                    <Image
                      source={staticMapUrl}
                      style={{ width: "100%", height: 140, borderRadius: 10 }}
                      contentFit="cover"
                      transition={200}
                    />
                  )}
                </View>
              )}

              {!searching && !hasResolved && searchError && (
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <AlertCircle size={14} color={theme.danger} />
                  <Text variant="bodySmall" color={theme.danger}>
                    {searchError}
                  </Text>
                </View>
              )}

              <Input
                label={`${t("settings.delivery.ratePerKm", "Rate per km")} (${delivery.currency})`}
                placeholder={t(
                  "settings.delivery.ratePerKmPlaceholder",
                  "E.g. 1.50",
                )}
                value={deliveryRate}
                onChangeText={(text) =>
                  setDeliveryRateInput(text.replace(/[^0-9.,]/g, ""))
                }
                keyboardType="decimal-pad"
                leftIcon={Banknote}
              />

              <View className="flex-row" style={{ gap: 10 }}>
                <View className="flex-1">
                  <Input
                    label={t(
                      "settings.delivery.minFee",
                      "Minimum fee (optional)",
                    )}
                    placeholder={t(
                      "settings.delivery.minFeePlaceholder",
                      "E.g. 10",
                    )}
                    value={deliveryMinFee}
                    onChangeText={(text) =>
                      setDeliveryMinFeeInput(text.replace(/[^0-9.,]/g, ""))
                    }
                    keyboardType="decimal-pad"
                  />
                </View>
                <View className="flex-1">
                  <Input
                    label={t(
                      "settings.delivery.maxDistance",
                      "Max distance in km (optional)",
                    )}
                    placeholder={t(
                      "settings.delivery.maxDistancePlaceholder",
                      "E.g. 50",
                    )}
                    value={deliveryMaxDistance}
                    onChangeText={(text) =>
                      setDeliveryMaxDistanceInput(text.replace(/[^0-9.,]/g, ""))
                    }
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <Button variant="primary" fullWidth onPress={handleSaveDelivery}>
                {t("settings.delivery.save", "Save delivery settings")}
              </Button>
            </View>
          )}
        </Card>
      </Animated.View>

      {/* Booking Policies */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(275)}
        className="mb-8"
      >
        <Card>
          <Text variant="headlineSmall" className="mb-3">
            {t("agency.bookingPolicies", { defaultValue: "Booking Policies" })}
          </Text>

          <View className="flex-row items-center">
            <CalendarX
              size={18}
              color={theme.textSecondary}
              strokeWidth={1.8}
            />
            <Text variant="bodyMedium" className="flex-1 ml-3">
              {t("agency.autoCancelUnpaid", {
                defaultValue: "Auto-cancel unpaid bookings",
              })}
            </Text>
            <Switch
              value={autoCancelEnabled}
              onValueChange={(val) => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                updateAgencySettings.mutate({
                  bookingAutoCancelUnpaid: val,
                });
              }}
              trackColor={{
                false: theme.surfaceTertiary,
                true: theme.accentSoft,
              }}
              thumbColor={autoCancelEnabled ? theme.accent : theme.textTertiary}
            />
          </View>

          {autoCancelEnabled && (
            <View className="mt-3">
              <Text
                variant="bodySmall"
                color={theme.textSecondary}
                className="mb-2"
              >
                {t("agency.cancelAfter", { defaultValue: "Cancel after" })}
              </Text>
              <View className="flex-row gap-2">
                {AUTO_CANCEL_OPTIONS.map((option) => {
                  const isActive = autoCancelHours === option.hours;
                  return (
                      <Pressable
                      key={option.hours}
                      onPress={() => {
                        void Haptics.impactAsync(
                          Haptics.ImpactFeedbackStyle.Light,
                        );
                        updateAgencySettings.mutate({
                          bookingAutoCancelAfterHours: option.hours,
                        });
                      }}
                      style={{
                        flex: 1,
                        paddingVertical: 8,
                        borderRadius: 9999,
                        backgroundColor: isActive
                          ? theme.accent
                          : theme.surfaceSecondary,
                        alignItems: "center",
                      }}
                    >
                      <Text
                        variant="labelSmall"
                        color={isActive ? "#FFFFFF" : theme.textSecondary}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        </Card>
      </Animated.View>

      {/* Logo picker bottom sheet */}
      <BottomSheet
        visible={showLogoSheet}
        onClose={() => setShowLogoSheet(false)}
        title={t("agency.logoOptions", "Logo")}
      >
        <Pressable
          onPress={handlePickLogoFromLibrary}
          className="flex-row items-center py-3"
        >
          <ImageIcon size={22} color={theme.textPrimary} strokeWidth={1.8} />
          <Text variant="bodyMedium" className="ml-3">
            {t("agency.chooseFromLibrary", "Choose from Library")}
          </Text>
        </Pressable>
        <View
          style={{
            height: 1,
            backgroundColor: theme.border,
            marginVertical: 4,
          }}
        />
        <Pressable
          onPress={handleTakeLogoPhoto}
          className="flex-row items-center py-3"
        >
          <Camera size={22} color={theme.textPrimary} strokeWidth={1.8} />
          <Text variant="bodyMedium" className="ml-3">
            {t("agency.takePhoto", "Take Photo")}
          </Text>
        </Pressable>
      </BottomSheet>
    </ScreenWrapper>
  );
}
