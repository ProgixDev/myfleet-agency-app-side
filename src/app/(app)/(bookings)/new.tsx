import React, { useState, useMemo, useCallback } from 'react';
import { Platform, View, Pressable, ScrollView, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  ArrowLeft,
  Car,
  User,
  CalendarDays,
  DollarSign,
  ClipboardCheck,
  CheckCircle,
  Clock,
  UserPlus,
  Shield,
  Users,
  Globe2,
  Baby,
  AlertTriangle,
  Truck,
  MapPin,
  Calculator,
  ArrowRight,
  FileText,
  CreditCard,
} from 'lucide-react-native';

import { getVehicleImage } from '@/data/vehicleImages';
import { fontFamilies } from '@/theme/typography';

import { ScreenWrapper } from '@/components/ui/ScreenWrapper';
import { Text } from '@/components/ui/Text';
import { SearchBar } from '@/components/ui/SearchBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StickyButton } from '@/components/ui/StickyButton';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Divider } from '@/components/ui/Divider';
import { Avatar } from '@/components/ui/Avatar';
import { useTheme } from '@/hooks/useTheme';
import { colors } from '@/theme/colors';
import { mockVehicles } from '@/data/vehicles';
import { mockClients } from '@/data/clients';
import { matchesVehicleQuery } from '@/utils/vehicleSearch';
import type { Vehicle } from '@/types/vehicle';
import type { Client } from '@/types/client';
import { useBookingStore, useVehicleAvailable } from '@/stores/useBookingStore';
import { useCurrentAgencySettings } from '@/stores/useAgencySettingsStore';
import { useToastStore } from '@/components/ui/Toast';
import {
  geocodeAddress,
  getDrivingDistance,
  GeocodingError,
  DistanceMatrixError,
  MapsApiKeyMissingError,
} from '@/services/mapsService';
import type { Booking, DeliveryDetails } from '@/types/booking';

// ── Constants ───────────────────────────────────────────────────────────────

const STEP_COUNT = 5;

const STEP_ICONS = [Car, User, CalendarDays, DollarSign, ClipboardCheck] as const;

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DISTANCE_OPTION_IDS = ['delivery', 'custom-pickup'] as const;
const ADDRESS_SUGGESTIONS = [
  '5 Chemin du Pavillon, 1218 Le Grand-Saconnex',
  'Rue du Mont-Blanc 10, 1201 Genève',
  'Quai du Mont-Blanc 17, 1201 Genève',
  'Aéroport de Genève, Route de l’Aéroport 21, 1215 Genève',
  'Place Cornavin 7, 1201 Genève',
] as const;

interface OptionToggle {
  id: string;
  label: string;
  price: number;
  enabled: boolean;
  deliveryDetails?: DeliveryDetails;
}

function isDistanceOption(optionId: string): boolean {
  return DISTANCE_OPTION_IDS.includes(optionId as (typeof DISTANCE_OPTION_IDS)[number]);
}

function getMockRouteDetails(address: string, config: ReturnType<typeof useCurrentAgencySettings>['delivery']): DeliveryDetails {
  const seed = address
    .trim()
    .toLowerCase()
    .split('')
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const distanceKm = Math.round(((seed % 2800) / 100 + 2.4) * 100) / 100;
  const fee = Math.round(Math.max(distanceKm * config.ratePerKm, config.minFee ?? 0) * 100) / 100;

  return {
    address,
    lat: config.basePointLat,
    lng: config.basePointLng,
    distanceKm,
    fee,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function isValidDate(dateStr: string): boolean {
  if (!DATE_REGEX.test(dateStr)) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === dateStr;
}

function calcDays(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  return Math.max(1, Math.ceil((e.getTime() - s.getTime()) / 86_400_000));
}

// ── Step Indicator ──────────────────────────────────────────────────────────

function StepIndicator({
  currentStep,
  theme,
}: {
  currentStep: number;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View className="flex-row items-center justify-center gap-2 py-3">
      {Array.from({ length: STEP_COUNT }, (_, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === currentStep;
        const isCompleted = stepNum < currentStep;
        return (
          <View
            key={i}
            style={{
              width: isActive ? 24 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: isActive || isCompleted ? theme.accent : theme.border,
            }}
          />
        );
      })}
    </View>
  );
}

// ── Success Overlay ─────────────────────────────────────────────────────────

function SuccessOverlay({
  bookingRef,
  onBack,
  theme,
  t,
}: {
  bookingRef: string;
  onBack: () => void;
  theme: ReturnType<typeof useTheme>;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  const checkScale = useSharedValue(0);

  React.useEffect(() => {
    checkScale.value = withSequence(
      withTiming(1.3, { duration: 300 }),
      withSpring(1, { damping: 8, stiffness: 150 }),
    );
  }, [checkScale]);

  const animatedCheckStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  return (
    <View
      className="absolute inset-0 items-center justify-center z-50"
      style={{ backgroundColor: theme.background }}
    >
      <Animated.View
        entering={FadeInDown.duration(400)}
        className="items-center px-8"
      >
        <Animated.View style={animatedCheckStyle} className="mb-6">
          <CheckCircle size={80} color={theme.success} strokeWidth={1.5} />
        </Animated.View>

        <Text variant="headlineLarge" align="center">
          {t('bookings.new.confirmedTitle', 'Booking Confirmed!')}
        </Text>

        <View className="mt-3 mb-2">
          <Text variant="bodyMedium" color={theme.textSecondary} align="center">
            {t('bookings.new.confirmedReference', 'Reference')}
          </Text>
        </View>

        <Badge variant="accent" size="lg">
          {bookingRef}
        </Badge>

        <View className="mt-8 w-full">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onPress={onBack}
          >
            {t('bookings.new.backToBookings', 'Back to Bookings')}
          </Button>
        </View>
      </Animated.View>
    </View>
  );
}

// ── Main Screen ─────────────────────────────────────────────────────────────

export default function NewBookingScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.background === colors.dark.background;
  const pickerTheme = isDark ? 'dark' : 'light';
  const showToast = useToastStore((s) => s.show);
  const bookingStore = useBookingStore();

  // ── Step 1: Vehicle ──────────────────────────────────────────────────
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [vehicleSearch, setVehicleSearch] = useState('');

  // ── Flow State ──────────────────────────────────────────────────────────
  const [step, setStep] = useState<number>(1);

  // Step 2: Client
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [counterClients, setCounterClients] = useState<Client[]>([]);
  const [showCounterClientModal, setShowCounterClientModal] = useState(false);
  const [counterFirstName, setCounterFirstName] = useState('');
  const [counterLastName, setCounterLastName] = useState('');
  const [counterPhone, setCounterPhone] = useState('');
  const [counterEmail, setCounterEmail] = useState('');
  const [counterAddress, setCounterAddress] = useState('');
  const [counterLicense, setCounterLicense] = useState('');

  // Step 3: Dates (native pickers)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [startDateObj, setStartDateObj] = useState<Date>(tomorrow);
  const [endDateObj, setEndDateObj] = useState<Date>(() => {
    const d = new Date(tomorrow);
    d.setDate(d.getDate() + 3);
    return d;
  });
  const [pickupTime, setPickupTime] = useState<Date>(() => {
    const d = new Date(); d.setHours(9, 0, 0, 0); return d;
  });
  const [returnTime, setReturnTime] = useState<Date>(() => {
    const d = new Date(); d.setHours(18, 0, 0, 0); return d;
  });
  const [showPicker, setShowPicker] = useState<'start' | 'end' | 'pickupTime' | 'returnTime' | null>(null);

  // String versions for store/validation
  const startDate = startDateObj.toISOString().slice(0, 10);
  const endDate = endDateObj.toISOString().slice(0, 10);

  const vehicleAvailableForDates = useVehicleAvailable(selectedVehicle?.id ?? '', startDate, endDate);

  // Agency delivery config (used throughout Step 4)
  const agencyDelivery = useCurrentAgencySettings().delivery;
  const hasBasePoint =
    agencyDelivery.enabled &&
    (agencyDelivery.basePointLat !== 0 || agencyDelivery.basePointLng !== 0);

  // Step 4: Options
  const [options, setOptions] = useState<OptionToggle[]>(() => {
    const baseOptions: OptionToggle[] = [
      { id: 'ins', label: 'Insurance Plus', price: 15, enabled: false },
      { id: 'drv', label: 'Additional Driver', price: 10, enabled: false },
      { id: 'foreign-use', label: 'Foreign Use Pass', price: 25, enabled: false },
      { id: 'seat', label: 'Child Seat', price: 5, enabled: false },
    ];
    if (agencyDelivery.enabled) {
      return [
        { id: 'delivery', label: 'Home delivery', price: 0, enabled: false },
        { id: 'custom-pickup', label: 'Custom recovery', price: 0, enabled: false },
        ...baseOptions,
      ];
    }
    return baseOptions;
  });

  // Distance-based option input state
  const [routeAddresses, setRouteAddresses] = useState<Record<string, string>>({});
  const [routeComputing, setRouteComputing] = useState<Record<string, boolean>>({});
  const [routeErrors, setRouteErrors] = useState<Record<string, string | null>>({});

  // Step 5: Confirm
  const [confirmedRef, setConfirmedRef] = useState<string | null>(null);
  const [conflictModal, setConflictModal] = useState<{
    visible: boolean;
    conflicts: Booking[];
  }>({ visible: false, conflicts: [] });

  // ── Derived Data ────────────────────────────────────────────────────────

  const availableVehicles = useMemo(
    () => mockVehicles.filter((v) => v.status === 'available'),
    [],
  );

  const filteredVehicles = useMemo(() => {
    const trimmed = vehicleSearch.trim();
    if (!trimmed) return availableVehicles;
    const q = trimmed.toLowerCase();
    return availableVehicles.filter(
      (v) =>
        matchesVehicleQuery(v, trimmed) || v.category.toLowerCase().includes(q),
    );
  }, [availableVehicles, vehicleSearch]);

  const filteredClients = useMemo(() => {
    const allClients = [...counterClients, ...mockClients];
    const q = clientSearch.toLowerCase().trim();
    if (!q) return allClients;
    return allClients.filter(
      (c) =>
        c.firstName.toLowerCase().includes(q) ||
        c.lastName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.includes(q),
    );
  }, [clientSearch, counterClients]);

  const datesValid = useMemo(() => endDateObj > startDateObj, [startDateObj, endDateObj]);

  const days = useMemo(() => {
    if (!datesValid) return 0;
    return Math.max(1, Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / 86400000));
  }, [startDateObj, endDateObj, datesValid]);

  const unresolvedDistanceOptions = useMemo(
    () => options.filter((o) => isDistanceOption(o.id) && o.enabled && !o.deliveryDetails),
    [options],
  );

  const pricing = useMemo(() => {
    if (!selectedVehicle || days <= 0) {
      return { subtotal: 0, optionsTotal: 0, deliveryFee: 0, deposit: 0, total: 0 };
    }
    const subtotal = selectedVehicle.dailyRate * days;
    const optionsTotal = options
      .filter((o) => o.enabled)
      .reduce((sum, o) => sum + o.price * days, 0);
    const deliveryFee = options
      .filter((o) => o.enabled && o.deliveryDetails)
      .reduce((sum, o) => sum + (o.deliveryDetails?.fee ?? 0), 0);
    const deposit = Math.round(subtotal * 0.4);
    const total = subtotal + optionsTotal + deliveryFee;
    return { subtotal, optionsTotal, deliveryFee, deposit, total };
  }, [selectedVehicle, days, options]);

  // ── Step Validation ─────────────────────────────────────────────────────

  const isStepValid = useMemo((): boolean => {
    switch (step) {
      case 1:
        return selectedVehicle !== null;
      case 2:
        return selectedClient !== null;
      case 3:
        return datesValid && vehicleAvailableForDates;
      case 4:
        if (unresolvedDistanceOptions.length > 0) return false;
        return true;
      case 5:
        return true;
      default:
        return false;
    }
  }, [
    step,
    selectedVehicle,
    selectedClient,
    datesValid,
    vehicleAvailableForDates,
    unresolvedDistanceOptions.length,
  ]);

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleNext = useCallback(() => {
    if (step < STEP_COUNT) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setStep((s) => s + 1);
    }
  }, [step]);

  const handleBack = useCallback(() => {
    if (step > 1) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setStep((s) => s - 1);
    }
  }, [step]);

  const handleClose = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const toggleOption = useCallback((optionId: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOptions((prev) =>
      prev.map((o) => {
        if (o.id !== optionId) return o;
        const next = !o.enabled;
        // Turning off distance-based options clears computed details so the fee disappears
        if (isDistanceOption(o.id) && !next) {
          return { ...o, enabled: false, deliveryDetails: undefined };
        }
        return { ...o, enabled: next };
      }),
    );
    if (isDistanceOption(optionId)) {
      setRouteErrors((prev) => ({ ...prev, [optionId]: null }));
    }
  }, []);

  const clearComputedRoute = useCallback((optionId: string) => {
    setOptions((prev) =>
      prev.map((o) =>
        o.id === optionId ? { ...o, deliveryDetails: undefined } : o,
      ),
    );
  }, []);

  const handleRouteAddressChange = useCallback(
    (optionId: string, text: string) => {
      setRouteAddresses((prev) => ({ ...prev, [optionId]: text }));
      setRouteErrors((prev) => ({ ...prev, [optionId]: null }));
      if (options.find((o) => o.id === optionId)?.deliveryDetails) {
        clearComputedRoute(optionId);
      }
    },
    [clearComputedRoute, options],
  );

  const handleCalculateRoute = useCallback(async (optionId: string) => {
    const trimmed = (routeAddresses[optionId] ?? '').trim();
    const setRouteError = (message: string) => {
      setRouteErrors((prev) => ({ ...prev, [optionId]: message }));
    };

    if (!trimmed) {
      setRouteError(
        t(
          optionId === 'custom-pickup'
            ? 'bookings.new.customPickup.addressRequired'
            : 'bookings.new.delivery.addressRequired',
          optionId === 'custom-pickup'
            ? 'Recovery address required'
            : 'Delivery address required',
        ),
      );
      return;
    }
    if (!hasBasePoint) {
      setRouteError(
        t(
          'bookings.new.delivery.noBasePoint',
          'No agency base address configured',
        ),
      );
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRouteComputing((prev) => ({ ...prev, [optionId]: true }));
    setRouteErrors((prev) => ({ ...prev, [optionId]: null }));
    try {
      const geocoded = await geocodeAddress(trimmed);
      const distance = await getDrivingDistance(
        { lat: agencyDelivery.basePointLat, lng: agencyDelivery.basePointLng },
        { lat: geocoded.lat, lng: geocoded.lng },
      );
      const distanceKm = Math.round((distance.distanceMeters / 1000) * 100) / 100;

      if (
        agencyDelivery.maxDistanceKm != null &&
        distanceKm > agencyDelivery.maxDistanceKm
      ) {
        setRouteError(
          t('bookings.new.delivery.maxDistanceExceeded', {
            defaultValue: 'Distance {{distance}} km exceeds limit {{max}} km',
            distance: distanceKm,
            max: agencyDelivery.maxDistanceKm,
          }),
        );
        return;
      }

      const rawFee = distanceKm * agencyDelivery.ratePerKm;
      const fee = Math.max(rawFee, agencyDelivery.minFee ?? 0);
      const roundedFee = Math.round(fee * 100) / 100;

      const details: DeliveryDetails = {
        address: geocoded.formattedAddress,
        lat: geocoded.lat,
        lng: geocoded.lng,
        distanceKm,
        fee: roundedFee,
      };

      setOptions((prev) =>
        prev.map((o) =>
          o.id === optionId ? { ...o, deliveryDetails: details } : o,
        ),
      );
    } catch (err) {
      if (err instanceof MapsApiKeyMissingError) {
        const details = getMockRouteDetails(trimmed, agencyDelivery);
        setOptions((prev) =>
          prev.map((o) =>
            o.id === optionId ? { ...o, deliveryDetails: details } : o,
          ),
        );
        return;
      }

      let key = 'bookings.new.delivery.errorUnknown';
      if (err instanceof GeocodingError) {
        key =
          err.code === 'ZERO_RESULTS'
            ? 'bookings.new.delivery.errorZeroResults'
            : err.code === 'OVER_QUERY_LIMIT'
              ? 'bookings.new.delivery.errorQuota'
              : err.code === 'REQUEST_DENIED'
                ? 'bookings.new.delivery.errorRequestDenied'
                : err.code === 'NETWORK'
                  ? 'bookings.new.delivery.errorNetwork'
                  : 'bookings.new.delivery.errorUnknown';
      } else if (err instanceof DistanceMatrixError) {
        key =
          err.code === 'OVER_QUERY_LIMIT'
            ? 'bookings.new.delivery.errorQuota'
            : err.code === 'REQUEST_DENIED'
              ? 'bookings.new.delivery.errorRequestDenied'
              : err.code === 'NETWORK'
                ? 'bookings.new.delivery.errorNetwork'
                : 'bookings.new.delivery.errorZeroResults';
      }
      setRouteError(t(key, 'Error'));
    } finally {
      setRouteComputing((prev) => ({ ...prev, [optionId]: false }));
    }
  }, [
    routeAddresses,
    hasBasePoint,
    agencyDelivery.basePointLat,
    agencyDelivery.basePointLng,
    agencyDelivery.ratePerKm,
    agencyDelivery.minFee,
    agencyDelivery.maxDistanceKm,
    t,
  ]);

  const getOptionLabel = useCallback(
    (option: OptionToggle) => {
      if (option.id === 'delivery') {
        return t('bookings.new.delivery.optionLabel', 'Home delivery');
      }
      if (option.id === 'custom-pickup') {
        return t('bookings.new.customPickup.optionLabel', 'Custom recovery');
      }
      return option.label;
    },
    [t],
  );

  const proceedWithCreate = useCallback(() => {
    if (!selectedVehicle) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const booking = bookingStore.createBooking(selectedVehicle.dailyRate);
    if (booking) {
      setConfirmedRef(booking.id);
    } else {
      showToast({
        variant: 'error',
        title: 'Error',
        message: 'Failed to create booking. Please try again.',
      });
    }
  }, [bookingStore, selectedVehicle, showToast]);

  const handleConfirm = useCallback(() => {
    if (!selectedVehicle || !selectedClient) return;

    bookingStore.startDraft();
    bookingStore.updateDraft({
      vehicleId: selectedVehicle.id,
      vehicleName: `${selectedVehicle.brand} ${selectedVehicle.name}`,
      clientId: selectedClient.id,
      clientName: `${selectedClient.firstName} ${selectedClient.lastName}`,
      startDate,
      endDate,
      pickupTime: pickupTime.toTimeString().slice(0, 5),
      returnTime: returnTime.toTimeString().slice(0, 5),
      options: options.map((o) => ({
        id: o.id,
        label: getOptionLabel(o),
        price: o.price,
        enabled: o.enabled,
        ...(o.deliveryDetails ? { deliveryDetails: o.deliveryDetails } : {}),
      })),
    });

    const conflicts = bookingStore.findDraftConflicts();
    if (conflicts.length > 0) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setConflictModal({ visible: true, conflicts });
      return;
    }

    proceedWithCreate();
  }, [
    selectedVehicle,
    selectedClient,
    startDate,
    endDate,
    options,
    getOptionLabel,
    bookingStore,
    proceedWithCreate,
  ]);

  const handleConflictCreateAnyway = useCallback(() => {
    setConflictModal({ visible: false, conflicts: [] });
    proceedWithCreate();
  }, [proceedWithCreate]);

  const handleConflictModifyDates = useCallback(() => {
    setConflictModal({ visible: false, conflicts: [] });
    setStep(3);
  }, []);

  const handleConflictAbandon = useCallback(() => {
    setConflictModal({ visible: false, conflicts: [] });
    bookingStore.discardDraft();
    router.back();
  }, [bookingStore, router]);

  const handleSaveDraft = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showToast({
      variant: 'info',
      title: 'Coming soon',
      message: 'Draft saving will be available soon.',
    });
  }, [showToast]);

  const handleAddNewClient = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowCounterClientModal(true);
  }, []);

  const handleCreateCounterClient = useCallback(() => {
    if (!counterFirstName.trim() || !counterLastName.trim() || !counterPhone.trim()) {
      showToast({
        variant: 'warning',
        title: t('bookings.new.counterClient.missingTitle', 'Informations manquantes'),
        message: t(
          'bookings.new.counterClient.missingMessage',
          'Nom, prénom et téléphone sont nécessaires pour créer le client.',
        ),
      });
      return;
    }

    const newClient: Client = {
      id: `walkin-${Date.now()}`,
      firstName: counterFirstName.trim(),
      lastName: counterLastName.trim(),
      email: counterEmail.trim() || `${Date.now()}@walkin.myfleet.local`,
      phone: counterPhone.trim(),
      address: counterAddress.trim(),
      dateOfBirth: '',
      idType: 'driving-license',
      idNumber: '',
      driverLicense: counterLicense.trim(),
      driverLicenseExpiry: '',
      tags: ['new'],
      flagReason: null,
      totalBookings: 0,
      totalSpent: 0,
      createdAt: new Date().toISOString().slice(0, 10),
      notes: 'Créé au comptoir pendant une réservation.',
      documents: {
        idFront: 'pending',
        idBack: 'pending',
        licenseFront: counterLicense.trim() ? 'captured' : 'pending',
      },
      registrationMethod: 'walk-in',
      registeredAt: new Date().toISOString(),
    };

    setCounterClients((prev) => [newClient, ...prev]);
    setSelectedClient(newClient);
    setShowCounterClientModal(false);
    setCounterFirstName('');
    setCounterLastName('');
    setCounterPhone('');
    setCounterEmail('');
    setCounterAddress('');
    setCounterLicense('');
    showToast({
      variant: 'success',
      title: t('bookings.new.counterClient.createdTitle', 'Client ajouté'),
      message: t(
        'bookings.new.counterClient.createdMessage',
        'Le client a été créé au comptoir et sélectionné pour cette réservation.',
      ),
    });
  }, [
    counterAddress,
    counterEmail,
    counterFirstName,
    counterLastName,
    counterLicense,
    counterPhone,
    showToast,
    t,
  ]);

  const handleCustomOption = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showToast({
      variant: 'info',
      title: t('bookings.new.customOptions.title', 'Options personnalisables'),
      message: t(
        'bookings.new.customOptions.message',
        "Chaque agence pourra gérer ses propres options depuis les paramètres.",
      ),
    });
  }, [showToast, t]);

  const handleBackToBookings = useCallback(() => {
    router.replace('/(app)/(bookings)');
  }, [router]);

  // ── Date/time helpers (must be before any conditional return) ────────────

  const onDateChange = useCallback(
    (pickerKey: 'start' | 'end' | 'pickupTime' | 'returnTime') =>
      (_: DateTimePickerEvent, selected?: Date) => {
        if (Platform.OS === 'android') setShowPicker(null);
        if (!selected) return;
        if (pickerKey === 'start') setStartDateObj(selected);
        else if (pickerKey === 'end') setEndDateObj(selected);
        else if (pickerKey === 'pickupTime') setPickupTime(selected);
        else if (pickerKey === 'returnTime') setReturnTime(selected);
      },
    [],
  );

  const formatDisplayDate = useCallback(
    (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
    [],
  );

  const formatDisplayTime = useCallback(
    (d: Date) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    [],
  );

  // ── Success Overlay ─────────────────────────────────────────────────────

  if (confirmedRef) {
    return (
      <ScreenWrapper>
        <SuccessOverlay
          bookingRef={confirmedRef}
          onBack={handleBackToBookings}
          theme={theme}
          t={t}
        />
      </ScreenWrapper>
    );
  }

  // ── Step Titles ─────────────────────────────────────────────────────────

  const stepTitles: Record<number, string> = {
    1: t('bookings.new.step1', 'Select Vehicle'),
    2: t('bookings.new.step2', 'Select Client'),
    3: t('bookings.new.step3', 'Select Dates'),
    4: t('bookings.new.step4', 'Pricing & Options'),
    5: t('bookings.new.step5', 'Review & Confirm'),
  };

  // ── Option Icons ────────────────────────────────────────────────────────

  const optionIcons: Record<string, typeof Shield> = {
    ins: Shield,
    drv: Users,
    'foreign-use': Globe2,
    'custom-pickup': MapPin,
    seat: Baby,
  };

  // ── Render Steps ────────────────────────────────────────────────────────

  const renderStep1 = () => (
    <Animated.View entering={FadeInDown.duration(400).delay(100)}>
      <SearchBar
        placeholder={t('bookings.new.searchVehicle', 'Search by name, model or plate')}
        value={vehicleSearch}
        onChangeText={setVehicleSearch}
        className="mb-3"
      />

      <Text
        variant="bodySmall"
        color={theme.textTertiary}
        style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, marginLeft: 4 }}
      >
        {filteredVehicles.length} {t('bookings.new.available', 'available')}
      </Text>

      <View style={{ gap: 12 }}>
        {filteredVehicles.map((vehicle, index) => (
          <VehicleHeroCard
            key={vehicle.id}
            vehicle={vehicle}
            index={index}
            selected={selectedVehicle?.id === vehicle.id}
            theme={theme}
            t={t}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedVehicle(vehicle);
            }}
          />
        ))}
      </View>

      {filteredVehicles.length === 0 && (
        <View className="items-center py-8">
          <Text variant="bodyMedium" color={theme.textTertiary}>
            {t('bookings.new.noVehicles', 'No vehicles found')}
          </Text>
        </View>
      )}
    </Animated.View>
  );

  const renderStep2 = () => (
    <Animated.View entering={FadeInDown.duration(400).delay(100)}>
      <Button
        variant="secondary"
        size="md"
        fullWidth
        leftIcon={UserPlus}
        onPress={handleAddNewClient}
        className="mb-4"
      >
        {t('bookings.new.addClient', 'Add New Client')}
      </Button>

      <SearchBar
        placeholder={t('bookings.new.searchClient', 'Search clients...')}
        value={clientSearch}
        onChangeText={setClientSearch}
        className="mb-4"
      />

      {filteredClients.map((client, index) => {
        const isSelected = selectedClient?.id === client.id;
        const fullName = `${client.firstName} ${client.lastName}`;
        return (
          <Animated.View
            key={client.id}
            entering={FadeInDown.duration(300).delay(index * 60)}
          >
            <Pressable
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedClient(client);
              }}
              className="mb-3"
            >
              <View
                className="rounded-2xl p-4"
                style={{
                  backgroundColor: theme.surface,
                  borderWidth: isSelected ? 2 : 0,
                  borderColor: isSelected ? theme.accent : 'transparent',
                }}
              >
                <View className="flex-row items-center">
                  <Avatar name={fullName} size="md" />
                  <View className="ml-3 flex-1">
                    <Text variant="titleMedium">{fullName}</Text>
                    <Text variant="bodySmall" color={theme.textSecondary}>
                      {client.phone}
                    </Text>
                  </View>
                  {isSelected && (
                    <CheckCircle size={20} color={theme.accent} />
                  )}
                </View>
              </View>
            </Pressable>
          </Animated.View>
        );
      })}

      {filteredClients.length === 0 && (
        <View className="items-center py-8">
          <Text variant="bodyMedium" color={theme.textTertiary}>
            {t('bookings.new.noClients', 'No clients found')}
          </Text>
        </View>
      )}
    </Animated.View>
  );

  const renderStep3 = () => {
    return (
      <Animated.View
        entering={FadeInDown.duration(400).delay(100)}
        style={{ gap: 14 }}
      >
        {/* Duration hero chip */}
        {datesValid && (
          <View
            style={{
              backgroundColor: theme.accentSoft,
              borderRadius: 20,
              padding: 18,
              alignItems: 'center',
            }}
          >
            <Text
              variant="caption"
              color={theme.accent}
              style={{
                fontSize: 11,
                fontFamily: fontFamilies.medium,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}
            >
              {t('bookings.new.dailyRate', 'Daily rate')} · €{selectedVehicle?.dailyRate ?? 0}
            </Text>
            <Text
              variant="headlineLarge"
              color={theme.accent}
              style={{
                fontFamily: fontFamilies.bold,
                fontSize: 28,
                marginTop: 4,
              }}
            >
              {t('bookings.new.duration', { count: days, defaultValue: '{{count}} days' })}
            </Text>
          </View>
        )}

        {/* Start / End paired card */}
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: 20,
            padding: 16,
            borderWidth: 1,
            borderColor: theme.borderLight,
          }}
        >
          <View className="flex-row items-center">
            <View style={{ flex: 1 }}>
              <Text
                variant="caption"
                color={theme.textTertiary}
                style={{ fontSize: 11, marginBottom: 4 }}
              >
                {t('bookings.new.startDate', 'Start date')}
              </Text>
              <Pressable
                onPress={() => setShowPicker(showPicker === 'start' ? null : 'start')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor:
                    showPicker === 'start' ? theme.accentSoft : theme.surfaceTertiary,
                  borderRadius: 14,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  gap: 8,
                }}
              >
                <CalendarDays size={15} color={theme.accent} />
                <Text
                  variant="bodyMedium"
                  style={{
                    fontFamily: fontFamilies.semiBold,
                    fontSize: 13,
                    color: theme.textPrimary,
                  }}
                  numberOfLines={1}
                >
                  {formatDisplayDate(startDateObj)}
                </Text>
              </Pressable>
            </View>

            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: theme.surfaceTertiary,
                alignItems: 'center',
                justifyContent: 'center',
                marginHorizontal: 8,
                marginTop: 16,
              }}
            >
              <ArrowRight size={14} color={theme.textSecondary} strokeWidth={2} />
            </View>

            <View style={{ flex: 1 }}>
              <Text
                variant="caption"
                color={theme.textTertiary}
                style={{ fontSize: 11, marginBottom: 4, textAlign: 'right' }}
              >
                {t('bookings.new.endDate', 'End date')}
              </Text>
              <Pressable
                onPress={() => setShowPicker(showPicker === 'end' ? null : 'end')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  backgroundColor:
                    showPicker === 'end' ? theme.accentSoft : theme.surfaceTertiary,
                  borderRadius: 14,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  gap: 8,
                }}
              >
                <CalendarDays size={15} color={theme.accent} />
                <Text
                  variant="bodyMedium"
                  style={{
                    fontFamily: fontFamilies.semiBold,
                    fontSize: 13,
                    color: theme.textPrimary,
                  }}
                  numberOfLines={1}
                >
                  {formatDisplayDate(endDateObj)}
                </Text>
              </Pressable>
            </View>
          </View>

          {showPicker === 'start' && (
            <View className="items-center" style={{ marginTop: 6 }}>
              <DateTimePicker
                value={startDateObj}
                mode="date"
                display="spinner"
                minimumDate={new Date()}
                locale="fr-FR"
                themeVariant={pickerTheme}
                onChange={onDateChange('start')}
              />
            </View>
          )}

          {showPicker === 'end' && (
            <View className="items-center" style={{ marginTop: 6 }}>
              <DateTimePicker
                value={endDateObj}
                mode="date"
                display="spinner"
                minimumDate={startDateObj}
                locale="fr-FR"
                themeVariant={pickerTheme}
                onChange={onDateChange('end')}
              />
            </View>
          )}
        </View>

        {/* Times card */}
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: 20,
            padding: 16,
            borderWidth: 1,
            borderColor: theme.borderLight,
          }}
        >
          <Text
            variant="bodySmall"
            color={theme.textTertiary}
            style={{
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: 1,
              fontFamily: fontFamilies.medium,
              marginBottom: 10,
            }}
          >
            {t('bookings.new.times', 'Schedule')}
          </Text>

          <View className="flex-row" style={{ gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text
                variant="caption"
                color={theme.textTertiary}
                style={{ fontSize: 11, marginBottom: 4 }}
              >
                {t('bookings.new.pickup', 'Pickup')}
              </Text>
              <Pressable
                onPress={() =>
                  setShowPicker(showPicker === 'pickupTime' ? null : 'pickupTime')
                }
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor:
                    showPicker === 'pickupTime'
                      ? theme.accentSoft
                      : theme.surfaceTertiary,
                  borderRadius: 14,
                  paddingVertical: 10,
                  gap: 6,
                }}
              >
                <Clock size={14} color={theme.accent} />
                <Text
                  variant="bodyMedium"
                  style={{
                    fontFamily: fontFamilies.semiBold,
                    fontSize: 13,
                  }}
                >
                  {formatDisplayTime(pickupTime)}
                </Text>
              </Pressable>
            </View>

            <View style={{ flex: 1 }}>
              <Text
                variant="caption"
                color={theme.textTertiary}
                style={{ fontSize: 11, marginBottom: 4 }}
              >
                {t('bookings.new.return', 'Return')}
              </Text>
              <Pressable
                onPress={() =>
                  setShowPicker(showPicker === 'returnTime' ? null : 'returnTime')
                }
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor:
                    showPicker === 'returnTime'
                      ? theme.accentSoft
                      : theme.surfaceTertiary,
                  borderRadius: 14,
                  paddingVertical: 10,
                  gap: 6,
                }}
              >
                <Clock size={14} color={theme.accent} />
                <Text
                  variant="bodyMedium"
                  style={{
                    fontFamily: fontFamilies.semiBold,
                    fontSize: 13,
                  }}
                >
                  {formatDisplayTime(returnTime)}
                </Text>
              </Pressable>
            </View>
          </View>

          {showPicker === 'pickupTime' && (
            <View className="items-center" style={{ marginTop: 6 }}>
              <DateTimePicker
                value={pickupTime}
                mode="time"
                display="spinner"
                minuteInterval={15}
                locale="fr-FR"
                themeVariant={pickerTheme}
                onChange={onDateChange('pickupTime')}
              />
            </View>
          )}
          {showPicker === 'returnTime' && (
            <View className="items-center" style={{ marginTop: 6 }}>
              <DateTimePicker
                value={returnTime}
                mode="time"
                display="spinner"
                minuteInterval={15}
                locale="fr-FR"
                themeVariant={pickerTheme}
                onChange={onDateChange('returnTime')}
              />
            </View>
          )}
        </View>

        {/* Unavailable warning */}
        {datesValid && !vehicleAvailableForDates && (
          <Animated.View entering={FadeInDown.duration(300)}>
            <View
              style={{
                backgroundColor: theme.dangerSoft,
                borderLeftWidth: 4,
                borderLeftColor: theme.danger,
                borderRadius: 16,
                padding: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <AlertTriangle size={18} color={theme.danger} />
              <View className="flex-1">
                <Text
                  variant="titleSmall"
                  color={theme.danger}
                  style={{ fontFamily: fontFamilies.semiBold, fontSize: 13 }}
                >
                  {t('bookings.new.unavailable', 'Vehicle unavailable')}
                </Text>
                <Text
                  variant="bodySmall"
                  color={theme.danger}
                  style={{ fontSize: 12, marginTop: 2 }}
                >
                  {t(
                    'bookings.new.unavailableDesc',
                    'This vehicle is already booked for the selected dates.',
                  )}
                </Text>
              </View>
            </View>
          </Animated.View>
        )}
      </Animated.View>
    );
  };

  const renderStep4 = () => (
    <Animated.View entering={FadeInDown.duration(400).delay(100)}>
      <Card className="mb-4">
        <View className="p-4">
          <Text variant="titleMedium" className="mb-3">
            {t('bookings.new.pricing', 'Tarification')}
          </Text>

          {/* Daily rate line */}
          <View className="flex-row items-center justify-between mb-2">
            <Text variant="bodyMedium" color={theme.textSecondary}>
              {'\u20AC'}{selectedVehicle?.dailyRate ?? 0} {'\u00D7'} {days}{' '}
              {t('bookings.new.days', 'days')}
            </Text>
            <Text variant="bodyMedium">
              {'\u20AC'}{pricing.subtotal}
            </Text>
          </View>

          <Divider className="my-3" />

          {/* Option toggles */}
          <Text variant="titleSmall" color={theme.textSecondary} className="mb-2">
            {t('bookings.new.options', 'Options').toUpperCase()}
          </Text>

          <Pressable
            onPress={handleCustomOption}
            className="rounded-2xl p-3 mb-2 flex-row items-center"
            style={{ backgroundColor: theme.accentSoft }}
          >
            <View
              className="rounded-xl items-center justify-center mr-3"
              style={{ width: 36, height: 36, backgroundColor: theme.surface }}
            >
              <FileText size={17} color={theme.accent} />
            </View>
            <View className="flex-1">
              <Text variant="bodyMedium" color={theme.accent}>
                {t('bookings.new.customOptions.title', 'Options personnalisables')}
              </Text>
              <Text variant="bodySmall" color={theme.textSecondary}>
                {t(
                  'bookings.new.customOptions.subtitle',
                  'Assurances, chauffeur, siège auto et options propres à chaque agence',
                )}
              </Text>
            </View>
          </Pressable>

          {options.map((option) => {
            const isDelivery = option.id === 'delivery';
            const isCustomPickup = option.id === 'custom-pickup';
            const isDistance = isDistanceOption(option.id);
            const optionAddress = routeAddresses[option.id] ?? '';
            const optionComputing = !!routeComputing[option.id];
            const optionError = routeErrors[option.id] ?? null;
            const OptionIcon = isDelivery ? Truck : optionIcons[option.id] ?? Shield;
            const label = getOptionLabel(option);
            return (
              <React.Fragment key={option.id}>
                <Pressable
                  onPress={() => toggleOption(option.id)}
                  className="flex-row items-center justify-between py-3"
                >
                  <View className="flex-row items-center flex-1 gap-3">
                    <View
                      className="rounded-lg items-center justify-center"
                      style={{
                        width: 36,
                        height: 36,
                        backgroundColor: option.enabled
                          ? theme.accentSoft
                          : theme.surfaceTertiary,
                      }}
                    >
                      <OptionIcon
                        size={18}
                        color={option.enabled ? theme.accent : theme.textTertiary}
                      />
                    </View>
                    <View className="flex-1">
                      <Text variant="bodyMedium">{label}</Text>
                      <Text variant="bodySmall" color={theme.textTertiary}>
                        {isDistance
                          ? t('bookings.new.delivery.rateInfo', {
                              defaultValue:
                                'Rate: {{rate}} {{currency}} / km',
                              rate: agencyDelivery.ratePerKm.toFixed(2),
                              currency: agencyDelivery.currency,
                            })
                          : `+${'\u20AC'}${option.price}/day`}
                      </Text>
                    </View>
                  </View>

                  {/* Toggle switch */}
                  <View
                    className="rounded-full"
                    style={{
                      width: 48,
                      height: 28,
                      backgroundColor: option.enabled
                        ? theme.accent
                        : theme.surfaceTertiary,
                      justifyContent: 'center',
                      paddingHorizontal: 2,
                    }}
                  >
                    <View
                      className="rounded-full"
                      style={{
                        width: 24,
                        height: 24,
                        backgroundColor: '#FFFFFF',
                        alignSelf: option.enabled ? 'flex-end' : 'flex-start',
                      }}
                    />
                  </View>
                </Pressable>

                {/* Distance-based option expanded panel */}
                {isDistance && option.enabled && (
                  <View
                    style={{
                      backgroundColor: theme.surfaceSecondary,
                      borderRadius: 14,
                      padding: 12,
                      marginBottom: 8,
                      gap: 10,
                    }}
                  >
                    <Input
                      label={
                        isCustomPickup
                          ? t(
                              'bookings.new.customPickup.addressLabel',
                              'Recovery address',
                            )
                          : t(
                              'bookings.new.delivery.addressLabel',
                              'Delivery address',
                            )
                      }
                      placeholder={
                        isCustomPickup
                          ? t(
                              'bookings.new.customPickup.addressPlaceholder',
                              'Client return address',
                            )
                          : t(
                              'bookings.new.delivery.addressPlaceholder',
                              'Street, number, postcode, city',
                            )
                      }
                      value={optionAddress}
                      onChangeText={(text) => handleRouteAddressChange(option.id, text)}
                      leftIcon={MapPin}
                      error={optionError ?? undefined}
                    />

                    {optionAddress.trim().length > 0 && !option.deliveryDetails && (
                      <View style={{ gap: 6 }}>
                        {ADDRESS_SUGGESTIONS.filter((suggestion) =>
                          suggestion.toLowerCase().includes(optionAddress.trim().toLowerCase().split(' ')[0] ?? ''),
                        )
                          .slice(0, 3)
                          .map((suggestion) => (
                            <Pressable
                              key={`${option.id}-${suggestion}`}
                              onPress={() => handleRouteAddressChange(option.id, suggestion)}
                              className="flex-row items-center rounded-xl px-3 py-2"
                              style={{ backgroundColor: theme.surface }}
                            >
                              <MapPin size={14} color={theme.accent} />
                              <Text
                                variant="bodySmall"
                                color={theme.textSecondary}
                                className="ml-2 flex-1"
                                numberOfLines={1}
                              >
                                {suggestion}
                              </Text>
                            </Pressable>
                          ))}
                      </View>
                    )}

                    <Button
                      variant="secondary"
                      size="md"
                      leftIcon={Calculator}
                      disabled={
                        optionComputing ||
                        optionAddress.trim().length === 0
                      }
                      onPress={() => handleCalculateRoute(option.id)}
                    >
                      {optionComputing
                        ? t('bookings.new.delivery.calculating', 'Calculating…')
                        : option.deliveryDetails
                          ? t('bookings.new.delivery.recalculate', 'Recalculate')
                          : t('bookings.new.delivery.calculate', 'Calculate route')}
                    </Button>

                    {option.deliveryDetails && (
                      <View
                        style={{
                          backgroundColor: theme.surface,
                          borderRadius: 12,
                          padding: 12,
                          gap: 6,
                        }}
                      >
                        <View className="flex-row items-center justify-between">
                          <Text variant="bodySmall" color={theme.textSecondary}>
                            {t('bookings.new.delivery.distance', 'Distance')}
                          </Text>
                          <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                            {option.deliveryDetails.distanceKm.toFixed(2)} km
                          </Text>
                        </View>
                        <View className="flex-row items-center justify-between">
                          <Text variant="bodySmall" color={theme.textSecondary}>
                            {t('bookings.new.delivery.fee', 'Fee')}
                          </Text>
                          <Text
                            variant="bodyMedium"
                            color={theme.accent}
                            style={{ fontWeight: '700' }}
                          >
                            {option.deliveryDetails.fee.toFixed(2)}{' '}
                            {agencyDelivery.currency}
                          </Text>
                        </View>
                        {agencyDelivery.minFee != null &&
                          option.deliveryDetails.distanceKm *
                            agencyDelivery.ratePerKm <
                            agencyDelivery.minFee && (
                            <Text variant="caption" color={theme.textTertiary}>
                              {t(
                                'bookings.new.delivery.minFeeApplied',
                                'Minimum fee applied',
                              )}
                            </Text>
                          )}
                        <Text variant="caption" color={theme.textTertiary} numberOfLines={2}>
                          {option.deliveryDetails.address}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </React.Fragment>
            );
          })}

          <Divider className="my-3" />

          {/* Deposit */}
          <View className="flex-row items-center justify-between mb-2">
            <Text variant="bodyMedium" color={theme.textSecondary}>
              {t('bookings.new.deposit', 'Deposit')}
            </Text>
            <Text variant="bodyMedium">
              {'\u20AC'}{pricing.deposit}
            </Text>
          </View>

          {pricing.deliveryFee > 0 && (
            <View className="flex-row items-center justify-between mb-2">
              <Text variant="bodyMedium" color={theme.textSecondary}>
                {t('bookings.new.distanceFees', 'Delivery / recovery fees')}
              </Text>
              <Text variant="bodyMedium">
                {pricing.deliveryFee.toFixed(2)} {agencyDelivery.currency}
              </Text>
            </View>
          )}

          <Divider className="my-3" />

          {/* Total */}
          <View className="flex-row items-center justify-between">
            <Text variant="headlineMedium">Total</Text>
            <Text variant="headlineMedium" color={theme.accent}>
              {'\u20AC'}{pricing.total}
            </Text>
          </View>
        </View>
      </Card>
    </Animated.View>
  );

  const renderStep5 = () => {
    const enabledOptions = options.filter((o) => o.enabled);
    const heroImage = selectedVehicle ? getVehicleImage(selectedVehicle.id) : null;

    return (
      <Animated.View
        entering={FadeInDown.duration(400).delay(100)}
        style={{ gap: 14 }}
      >
        {/* Vehicle hero banner */}
        {selectedVehicle && (
          <View
            style={{
              borderRadius: 22,
              overflow: 'hidden',
              backgroundColor: theme.surfaceTertiary,
              height: 160,
            }}
          >
            {heroImage ? (
              <Image
                source={heroImage}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                transition={300}
              />
            ) : (
              <View className="flex-1 items-center justify-center">
                <Car size={60} color={theme.textTertiary} strokeWidth={1.3} />
              </View>
            )}
            <LinearGradient
              colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)']}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: 100,
              }}
              pointerEvents="none"
            />
            <View
              style={{
                position: 'absolute',
                left: 16,
                right: 16,
                bottom: 14,
                flexDirection: 'row',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text
                  variant="headlineMedium"
                  color="#FFFFFF"
                  style={{
                    fontFamily: fontFamilies.bold,
                    fontSize: 20,
                    lineHeight: 24,
                  }}
                  numberOfLines={1}
                >
                  {selectedVehicle.name}
                </Text>
                <Text
                  variant="bodySmall"
                  color="rgba(255,255,255,0.85)"
                  style={{ fontSize: 12, marginTop: 2 }}
                  numberOfLines={1}
                >
                  {selectedVehicle.category} · {selectedVehicle.licensePlate}
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: theme.accent,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 9999,
                }}
              >
                <Text
                  variant="labelSmall"
                  color="#FFFFFF"
                  style={{ fontFamily: fontFamilies.bold, fontSize: 12 }}
                >
                  €{selectedVehicle.dailyRate}/{t('bookings.new.perDay', 'day')}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Summary card */}
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: 20,
            padding: 16,
            borderWidth: 1,
            borderColor: theme.borderLight,
          }}
        >
          <Text
            variant="bodySmall"
            color={theme.textTertiary}
            style={{
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: 1,
              fontFamily: fontFamilies.medium,
              marginBottom: 12,
            }}
          >
            {t('bookings.new.summary', 'Booking Summary')}
          </Text>

          {/* Client */}
          <SummaryRow
            label={t('bookings.new.client', 'Client')}
            primary={
              selectedClient
                ? `${selectedClient.firstName} ${selectedClient.lastName}`
                : ''
            }
            secondary={selectedClient?.email}
            theme={theme}
          />

          <View
            style={{
              height: 1,
              backgroundColor: theme.border,
              marginVertical: 10,
            }}
          />

          {/* Dates */}
          <SummaryRow
            label={t('bookings.new.dates', 'Dates')}
            primary={`${formatDisplayDate(startDateObj)} → ${formatDisplayDate(endDateObj)}`}
            secondary={t('bookings.new.duration', {
              count: days,
              defaultValue: '{{count}} days',
            })}
            theme={theme}
          />

          {/* Times */}
          <View
            style={{
              height: 1,
              backgroundColor: theme.border,
              marginVertical: 10,
            }}
          />
          <SummaryRow
            label={t('bookings.new.times', 'Schedule')}
            primary={`${t('bookings.new.pickup', 'Pickup')}: ${formatDisplayTime(
              pickupTime,
            )}`}
            secondary={`${t('bookings.new.return', 'Return')}: ${formatDisplayTime(returnTime)}`}
            theme={theme}
          />

          {/* Options */}
          {enabledOptions.length > 0 && (
            <>
              <View
                style={{
                  height: 1,
                  backgroundColor: theme.border,
                  marginVertical: 10,
                }}
              />
              <Text
                variant="bodySmall"
                color={theme.textTertiary}
                style={{ fontSize: 12, marginBottom: 8 }}
              >
                {t('bookings.new.options', 'Options')}
              </Text>
              <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                {enabledOptions.map((opt) => (
                  <View
                    key={opt.id}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 9999,
                      backgroundColor: theme.accentSoft,
                    }}
                  >
                    <Text
                      variant="labelSmall"
                      color={theme.accent}
                      style={{
                        fontFamily: fontFamilies.semiBold,
                        fontSize: 11,
                      }}
                    >
                      {getOptionLabel(opt)}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Pricing breakdown */}
          <View
            style={{
              height: 1,
              backgroundColor: theme.border,
              marginVertical: 12,
            }}
          />
          <PricingLine
            label={`€${selectedVehicle?.dailyRate ?? 0} × ${days} ${t('bookings.new.days', 'days')}`}
            value={`€${pricing.subtotal}`}
            theme={theme}
          />
          {pricing.optionsTotal > 0 && (
            <PricingLine
              label={t('bookings.new.optionsTotal', 'Options')}
              value={`€${pricing.optionsTotal}`}
              theme={theme}
            />
          )}
          {pricing.deliveryFee > 0 && (
            <PricingLine
              label={t('bookings.new.distanceFees', 'Delivery / recovery fees')}
              value={`€${pricing.deliveryFee.toFixed(2)}`}
              theme={theme}
            />
          )}
          <PricingLine
            label={t('bookings.new.deposit', 'Deposit')}
            value={`€${pricing.deposit}`}
            theme={theme}
          />

          {/* Total */}
          <View
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: theme.border,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text
              variant="titleMedium"
              style={{
                fontFamily: fontFamilies.semiBold,
                fontSize: 15,
              }}
            >
              {t('bookings.new.total', 'Total')}
            </Text>
            <Text
              variant="headlineMedium"
              color={theme.accent}
              style={{ fontFamily: fontFamilies.bold, fontSize: 22 }}
            >
              €{pricing.total}
            </Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={{ gap: 10, marginTop: 4 }}>
          <Pressable
            onPress={handleConfirm}
            style={({ pressed }) => ({
              height: 54,
              borderRadius: 9999,
              backgroundColor: theme.accent,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: theme.accent,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.25,
              shadowRadius: 12,
              elevation: 6,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <Text
              variant="bodyLarge"
              color="#FFFFFF"
              style={{ fontFamily: fontFamilies.semiBold, fontSize: 15 }}
            >
              {t('bookings.new.confirm', 'Confirm Booking')}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleSaveDraft}
            style={({ pressed }) => ({
              height: 52,
              borderRadius: 9999,
              backgroundColor: theme.surface,
              borderWidth: 1.5,
              borderColor: theme.accent,
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <Text
              variant="bodyLarge"
              color={theme.accent}
              style={{ fontFamily: fontFamilies.semiBold, fontSize: 15 }}
            >
              {t('bookings.new.saveDraft', 'Save as Draft')}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    );
  };

  const renderCurrentStep = () => {
    switch (step) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      case 5:
        return renderStep5();
      default:
        return null;
    }
  };

  // ── Main Render ─────────────────────────────────────────────────────────

  const showNextBtn = step < 5 && isStepValid;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar style="dark" />
      <View style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingBottom: showNextBtn ? 180 : 120 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <Animated.View
            entering={FadeInDown.duration(400)}
            className="flex-row items-center justify-between pt-4 pb-2"
          >
            <View className="flex-row items-center gap-3">
              {step > 1 ? (
                <Pressable onPress={handleBack} className="p-1">
                  <ArrowLeft size={24} color={theme.textPrimary} />
                </Pressable>
              ) : (
                <View style={{ width: 26 }} />
              )}
              <View>
                <Text variant="bodySmall" color={theme.textTertiary}>
                  {t('bookings.new.stepOf', 'Step {{current}} of {{total}}', {
                    current: step,
                    total: STEP_COUNT,
                  })}
                </Text>
                <Text variant="headlineSmall">
                  {stepTitles[step]}
                </Text>
              </View>
            </View>

            <Pressable onPress={handleClose} className="p-1">
              <X size={24} color={theme.textPrimary} />
            </Pressable>
          </Animated.View>

          {/* Step Indicator */}
          <StepIndicator currentStep={step} theme={theme} />

          {/* Step Content */}
          <View className="flex-1">
            {renderCurrentStep()}
          </View>
        </ScrollView>

        {/* Sticky bottom button — OUTSIDE ScrollView */}
        {showNextBtn && (
          <StickyButton variant="primary" onPress={handleNext}>
            {t('bookings.new.next', 'Next')}
          </StickyButton>
        )}

        {/* Conflict modal */}
        <Modal
          visible={conflictModal.visible}
          transparent
          animationType="fade"
          onRequestClose={() =>
            setConflictModal({ visible: false, conflicts: [] })
          }
        >
          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.55)',
              justifyContent: 'flex-end',
            }}
          >
            <View
              style={{
                backgroundColor: theme.background,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                padding: 20,
                maxHeight: '80%',
              }}
            >
              <View className="flex-row items-center mb-2" style={{ gap: 10 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: theme.dangerSoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AlertTriangle size={20} color={theme.danger} />
                </View>
                <Text variant="headlineSmall" className="flex-1">
                  {t('bookings.conflict.modalTitle', 'Booking conflict')}
                </Text>
              </View>
              <Text
                variant="bodySmall"
                color={theme.textSecondary}
                className="mb-3"
              >
                {t(
                  'bookings.conflict.modalSubtitle',
                  'This vehicle is already booked over the following periods:',
                )}
              </Text>

              <ScrollView
                style={{ maxHeight: 260 }}
                showsVerticalScrollIndicator={false}
              >
                {conflictModal.conflicts.map((c) => (
                  <View
                    key={c.id}
                    style={{
                      backgroundColor: theme.dangerSoft,
                      borderRadius: 12,
                      padding: 12,
                      marginBottom: 8,
                    }}
                  >
                    <View className="flex-row items-center justify-between">
                      <Text variant="titleSmall" color={theme.danger}>
                        #{c.id}
                      </Text>
                      <Text variant="caption" color={theme.textSecondary}>
                        {c.status}
                      </Text>
                    </View>
                    <Text variant="bodySmall" color={theme.textSecondary}>
                      {c.clientName}
                    </Text>
                    <Text variant="caption" color={theme.textTertiary}>
                      {c.startDate} → {c.endDate}
                    </Text>
                  </View>
                ))}
              </ScrollView>

              <View style={{ gap: 8, marginTop: 12 }}>
                <Button
                  variant="danger"
                  fullWidth
                  onPress={handleConflictCreateAnyway}
                >
                  {t(
                    'bookings.conflict.createAnyway',
                    'Create anyway (conflict)',
                  )}
                </Button>
                <Button
                  variant="secondary"
                  fullWidth
                  onPress={handleConflictModifyDates}
                >
                  {t('bookings.conflict.modifyDates', 'Modify dates')}
                </Button>
                <Pressable
                  onPress={handleConflictAbandon}
                  style={{ paddingVertical: 10, alignItems: 'center' }}
                >
                  <Text variant="titleSmall" color={theme.textSecondary}>
                    {t('bookings.conflict.abandon', 'Cancel')}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Counter client modal */}
        <Modal
          visible={showCounterClientModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowCounterClientModal(false)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.55)',
              justifyContent: 'flex-end',
            }}
          >
            <View
              style={{
                backgroundColor: theme.background,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                padding: 20,
                maxHeight: '88%',
              }}
            >
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-1">
                  <Text variant="headlineSmall">
                    {t('bookings.new.counterClient.title', 'Nouveau client comptoir')}
                  </Text>
                  <Text variant="bodySmall" color={theme.textSecondary}>
                    {t(
                      'bookings.new.counterClient.subtitle',
                      "Créez le client sans quitter la réservation.",
                    )}
                  </Text>
                </View>
                <Pressable onPress={() => setShowCounterClientModal(false)} className="p-2">
                  <X size={22} color={theme.textPrimary} />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View className="flex-row" style={{ gap: 10 }}>
                  <Input
                    className="flex-1"
                    label={t('bookings.new.counterClient.firstName', 'Prénom')}
                    value={counterFirstName}
                    onChangeText={setCounterFirstName}
                    placeholder="Ahmed"
                  />
                  <Input
                    className="flex-1"
                    label={t('bookings.new.counterClient.lastName', 'Nom')}
                    value={counterLastName}
                    onChangeText={setCounterLastName}
                    placeholder="Benali"
                  />
                </View>

                <Input
                  className="mt-3"
                  label={t('bookings.new.counterClient.phone', 'Téléphone')}
                  value={counterPhone}
                  onChangeText={setCounterPhone}
                  keyboardType="phone-pad"
                  placeholder="+41 79 000 00 00"
                />
                <Input
                  className="mt-3"
                  label={t('bookings.new.counterClient.email', 'Email')}
                  value={counterEmail}
                  onChangeText={setCounterEmail}
                  keyboardType="email-address"
                  placeholder="client@email.com"
                />
                <Input
                  className="mt-3"
                  label={t('bookings.new.counterClient.address', 'Adresse complète')}
                  value={counterAddress}
                  onChangeText={setCounterAddress}
                  leftIcon={MapPin}
                  placeholder="Rue, numéro, code postal, ville"
                />
                {counterAddress.trim().length > 0 && (
                  <View className="mt-2" style={{ gap: 6 }}>
                    {ADDRESS_SUGGESTIONS.slice(0, 3).map((suggestion) => (
                      <Pressable
                        key={`client-${suggestion}`}
                        onPress={() => setCounterAddress(suggestion)}
                        className="flex-row items-center rounded-xl px-3 py-2"
                        style={{ backgroundColor: theme.surface }}
                      >
                        <MapPin size={14} color={theme.accent} />
                        <Text variant="bodySmall" color={theme.textSecondary} className="ml-2 flex-1">
                          {suggestion}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
                <Input
                  className="mt-3"
                  label={t('bookings.new.counterClient.license', 'N° permis')}
                  value={counterLicense}
                  onChangeText={setCounterLicense}
                  placeholder="Permis de conduire"
                />

                <View className="mt-4" style={{ gap: 8 }}>
                  {[
                    { icon: FileText, label: t('bookings.new.counterClient.idFront', 'Pièce identité recto') },
                    { icon: FileText, label: t('bookings.new.counterClient.idBack', 'Pièce identité verso') },
                    { icon: CreditCard, label: t('bookings.new.counterClient.card', 'Carte bancaire') },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <View
                        key={item.label}
                        className="flex-row items-center rounded-2xl p-3"
                        style={{ backgroundColor: theme.surface }}
                      >
                        <Icon size={18} color={theme.accent} />
                        <Text variant="bodySmall" className="ml-2 flex-1">
                          {item.label}
                        </Text>
                        <Badge variant="warning" size="sm">
                          {t('bookings.new.counterClient.toCapture', 'À capturer')}
                        </Badge>
                      </View>
                    );
                  })}
                </View>

                <View className="mt-5 mb-2" style={{ gap: 10 }}>
                  <Button variant="primary" fullWidth leftIcon={UserPlus} onPress={handleCreateCounterClient}>
                    {t('bookings.new.counterClient.create', 'Créer et sélectionner')}
                  </Button>
                  <Button variant="ghost" fullWidth onPress={() => setShowCounterClientModal(false)}>
                    {t('common.cancel', 'Annuler')}
                  </Button>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

// ── VehicleHeroCard (Step 1) ─────────────────────────────────────────────────

interface VehicleHeroCardProps {
  vehicle: Vehicle;
  index: number;
  selected: boolean;
  theme: ReturnType<typeof useTheme>;
  t: ReturnType<typeof useTranslation>['t'];
  onPress: () => void;
}

function VehicleHeroCard({
  vehicle,
  index,
  selected,
  theme,
  t,
  onPress,
}: VehicleHeroCardProps) {
  const img = getVehicleImage(vehicle.id);
  return (
    <Animated.View entering={FadeInDown.duration(320).delay(index * 40)}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          borderRadius: 22,
          overflow: 'hidden',
          height: 160,
          backgroundColor: theme.surfaceTertiary,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? theme.accent : theme.borderLight,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        })}
      >
        {img ? (
          <Image
            source={img}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={260}
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Car size={54} color={theme.textTertiary} strokeWidth={1.3} />
          </View>
        )}

        {/* Bottom gradient for legibility */}
        <LinearGradient
          colors={[
            'rgba(0,0,0,0)',
            selected ? 'rgba(124,58,237,0.55)' : 'rgba(0,0,0,0.7)',
          ]}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 120,
          }}
          pointerEvents="none"
        />

        {/* Top-right price pill */}
        <View
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            backgroundColor: theme.accent,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 9999,
            shadowColor: theme.accent,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          <Text
            variant="labelSmall"
            color="#FFFFFF"
            style={{ fontFamily: fontFamilies.bold, fontSize: 12 }}
          >
            €{vehicle.dailyRate}/{t('bookings.new.perDay', 'day')}
          </Text>
        </View>

        {/* Selection checkmark */}
        {selected && (
          <View
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: theme.accent,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: theme.accent,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35,
              shadowRadius: 8,
            }}
          >
            <CheckCircle size={16} color="#FFFFFF" strokeWidth={2.2} />
          </View>
        )}

        {/* Bottom info strip */}
        <View
          style={{
            position: 'absolute',
            left: 14,
            right: 14,
            bottom: 12,
          }}
        >
          <Text
            variant="headlineMedium"
            color="#FFFFFF"
            style={{
              fontFamily: fontFamilies.bold,
              fontSize: 18,
              lineHeight: 22,
            }}
            numberOfLines={1}
          >
            {vehicle.name}
          </Text>
          <Text
            variant="bodySmall"
            color="rgba(255,255,255,0.85)"
            style={{ fontSize: 11, marginTop: 2 }}
            numberOfLines={1}
          >
            {vehicle.category} · {vehicle.licensePlate}
          </Text>
          <View
            className="flex-row flex-wrap"
            style={{ gap: 6, marginTop: 8 }}
          >
            <MiniPill label={String(vehicle.year)} />
            <MiniPill label={vehicle.transmission} />
            <MiniPill label={vehicle.fuelType} />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function MiniPill({ label }: { label: string }) {
  return (
    <View
      style={{
        paddingHorizontal: 9,
        paddingVertical: 3,
        borderRadius: 9999,
        backgroundColor: 'rgba(255,255,255,0.18)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
      }}
    >
      <Text
        variant="labelSmall"
        color="#FFFFFF"
        style={{
          fontFamily: fontFamilies.semiBold,
          fontSize: 10,
          letterSpacing: 0.2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

// ── Summary helpers (Step 5) ─────────────────────────────────────────────────

function SummaryRow({
  label,
  primary,
  secondary,
  theme,
}: {
  label: string;
  primary: string;
  secondary?: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View
      style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}
    >
      <Text
        variant="bodySmall"
        color={theme.textTertiary}
        style={{ fontSize: 12 }}
      >
        {label}
      </Text>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <Text
          variant="bodyMedium"
          style={{
            fontFamily: fontFamilies.semiBold,
            fontSize: 13,
            color: theme.textPrimary,
          }}
          numberOfLines={1}
        >
          {primary}
        </Text>
        {secondary && (
          <Text
            variant="caption"
            color={theme.textTertiary}
            style={{ fontSize: 11, marginTop: 1 }}
            numberOfLines={1}
          >
            {secondary}
          </Text>
        )}
      </View>
    </View>
  );
}

function PricingLine({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
      }}
    >
      <Text
        variant="bodySmall"
        color={theme.textSecondary}
        style={{ fontSize: 12 }}
      >
        {label}
      </Text>
      <Text
        variant="bodyMedium"
        style={{
          fontFamily: fontFamilies.semiBold,
          fontSize: 13,
          color: theme.textPrimary,
        }}
      >
        {value}
      </Text>
    </View>
  );
}
