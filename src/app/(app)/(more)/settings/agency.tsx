import React, { useState, useCallback, useEffect } from 'react';
import { View, Pressable, Switch, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
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
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { ScreenWrapper } from '@/components/ui/ScreenWrapper';
import { Text } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Divider } from '@/components/ui/Divider';
import { Avatar } from '@/components/ui/Avatar';
import { Input } from '@/components/ui/Input';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/components/ui/Toast';
import {
  useAgencySettingsStore,
  useCurrentAgencySettings,
  type AutoCancelHours,
} from '@/stores/useAgencySettingsStore';
import {
  useAgencyStore,
  useAgencyList,
  useCurrentAgency,
} from '@/stores/useAgencyStore';
import {
  geocodeAddress,
  buildStaticMapUrl,
  MapsApiKeyMissingError,
  GeocodingError,
} from '@/services/mapsService';

// ── Mock data ───────────────────────────────────────────────────────────────

const AGENCY_INFO = {
  name: 'My Fleet SAS',
  address: '14 Rue de la Paix, 75002 Paris',
  phone: '+33 1 42 00 00 00',
  email: 'contact@myfleet.fr',
  website: 'www.myfleet.fr',
} as const;

interface TeamMember {
  name: string;
  role: 'admin' | 'employee';
  lastActive: string;
}

const TEAM_MEMBERS: TeamMember[] = [
  { name: 'Ahmed Admin', role: 'admin', lastActive: 'En ligne' },
  { name: 'Marie Dupont', role: 'employee', lastActive: 'Il y a 2h' },
  { name: 'Pierre Laurent', role: 'employee', lastActive: 'Il y a 1j' },
];

// ── Auto-cancel options ─────────────────────────────────────────────────────

const AUTO_CANCEL_OPTIONS: { label: string; hours: AutoCancelHours }[] = [
  { label: '24h', hours: 24 },
  { label: '48h', hours: 48 },
  { label: '3 days', hours: 72 },
  { label: '7 days', hours: 168 },
];

// ── Component ───────────────────────────────────────────────────────────────

export default function AgencyScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const showToast = useToastStore((s) => s.show);
  const [autoReminders, setAutoReminders] = useState(true);

  const currentSettings = useCurrentAgencySettings();
  const autoCancelEnabled = currentSettings.bookingPolicies.autoCancelUnpaid;
  const autoCancelHours = currentSettings.bookingPolicies.autoCancelAfterHours;
  const setAutoCancelEnabled = useAgencySettingsStore((s) => s.setAutoCancelEnabled);
  const setAutoCancelHours = useAgencySettingsStore((s) => s.setAutoCancelHours);

  // ── Delivery settings ──────────────────────────────────────────────
  const delivery = currentSettings.delivery;
  const setDeliveryEnabled = useAgencySettingsStore((s) => s.setDeliveryEnabled);
  const setDeliveryBasePoint = useAgencySettingsStore((s) => s.setDeliveryBasePoint);
  const setDeliveryRate = useAgencySettingsStore((s) => s.setDeliveryRate);
  const setDeliveryMinFee = useAgencySettingsStore((s) => s.setDeliveryMinFee);
  const setDeliveryMaxDistance = useAgencySettingsStore((s) => s.setDeliveryMaxDistance);

  // ── Tenant switcher (dev only) ─────────────────────────────────────
  const currentAgency = useCurrentAgency();
  const allAgencies = useAgencyList();
  const setCurrentAgencyId = useAgencyStore((s) => s.setCurrentAgencyId);

  const [deliveryLabel, setDeliveryLabel] = useState(delivery.basePointLabel);
  const [deliveryAddress, setDeliveryAddress] = useState(delivery.basePointAddress);
  const [resolvedLat, setResolvedLat] = useState<number>(delivery.basePointLat);
  const [resolvedLng, setResolvedLng] = useState<number>(delivery.basePointLng);
  const [resolvedAddress, setResolvedAddress] = useState<string>(
    delivery.basePointAddress && delivery.basePointLat !== 0 ? delivery.basePointAddress : '',
  );
  const [deliveryRate, setDeliveryRateInput] = useState(
    delivery.ratePerKm > 0 ? String(delivery.ratePerKm) : '',
  );
  const [deliveryMinFee, setDeliveryMinFeeInput] = useState(
    delivery.minFee != null ? String(delivery.minFee) : '',
  );
  const [deliveryMaxDistance, setDeliveryMaxDistanceInput] = useState(
    delivery.maxDistanceKm != null ? String(delivery.maxDistanceKm) : '',
  );
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

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
        : '',
    );
    setDeliveryRateInput(delivery.ratePerKm > 0 ? String(delivery.ratePerKm) : '');
    setDeliveryMinFeeInput(delivery.minFee != null ? String(delivery.minFee) : '');
    setDeliveryMaxDistanceInput(
      delivery.maxDistanceKm != null ? String(delivery.maxDistanceKm) : '',
    );
    setSearchError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAgency.id]);

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
      let key = 'settings.delivery.errorUnknown';
      if (err instanceof MapsApiKeyMissingError) {
        key = 'settings.delivery.apiKeyMissing';
      } else if (err instanceof GeocodingError) {
        key =
          err.code === 'ZERO_RESULTS'
            ? 'settings.delivery.errorZeroResults'
            : err.code === 'OVER_QUERY_LIMIT'
              ? 'settings.delivery.errorQuota'
              : err.code === 'REQUEST_DENIED'
                ? 'settings.delivery.errorRequestDenied'
                : err.code === 'NETWORK'
                  ? 'settings.delivery.errorNetwork'
                  : 'settings.delivery.errorUnknown';
      }
      const message = t(key, 'Error');
      setSearchError(message);
      showToast({ variant: 'error', title: message });
    } finally {
      setSearching(false);
    }
  }, [deliveryAddress, showToast, t]);

  const handleSaveDelivery = useCallback(() => {
    const rate = Number.parseFloat(deliveryRate.replace(',', '.'));
    if (!Number.isFinite(rate) || rate <= 0) {
      showToast({
        variant: 'error',
        title: t('settings.delivery.rateInvalid', 'Invalid rate per km'),
      });
      return;
    }

    const parsedMinFee = deliveryMinFee.trim()
      ? Number.parseFloat(deliveryMinFee.replace(',', '.'))
      : undefined;
    const parsedMaxDistance = deliveryMaxDistance.trim()
      ? Number.parseFloat(deliveryMaxDistance.replace(',', '.'))
      : undefined;

    setDeliveryBasePoint({
      label: deliveryLabel.trim(),
      address: resolvedAddress || deliveryAddress.trim(),
      lat: resolvedLat,
      lng: resolvedLng,
    });
    setDeliveryRate(rate);
    setDeliveryMinFee(
      parsedMinFee != null && Number.isFinite(parsedMinFee) && parsedMinFee >= 0
        ? parsedMinFee
        : undefined,
    );
    setDeliveryMaxDistance(
      parsedMaxDistance != null && Number.isFinite(parsedMaxDistance) && parsedMaxDistance > 0
        ? parsedMaxDistance
        : undefined,
    );

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast({
      variant: 'success',
      title: t('settings.delivery.saved', 'Delivery settings saved'),
    });
  }, [
    deliveryAddress,
    deliveryLabel,
    deliveryMaxDistance,
    deliveryMinFee,
    deliveryRate,
    resolvedAddress,
    resolvedLat,
    resolvedLng,
    setDeliveryBasePoint,
    setDeliveryMaxDistance,
    setDeliveryMinFee,
    setDeliveryRate,
    showToast,
    t,
  ]);

  const comingSoon = () => {
    showToast({
      variant: 'info',
      title: 'Coming soon',
      message: 'Cette fonctionnalité sera disponible prochainement.',
    });
  };

  // ── Admin guard ───────────────────────────────────────────────
  if (role !== 'admin') {
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

      {/* Dev-only tenant switcher */}
      {__DEV__ && allAgencies.length > 1 && (
        <Animated.View entering={FadeInDown.duration(400).delay(25)} className="mb-4">
          <Card>
            <View className="flex-row items-center mb-2" style={{ gap: 6 }}>
              <Badge variant="warning" size="sm">
                DEV
              </Badge>
              <Text variant="titleMedium">Agency switcher</Text>
            </View>
            <Text variant="bodySmall" color={theme.textSecondary} className="mb-3">
              Active: {currentAgency.name} ({currentAgency.id})
            </Text>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {allAgencies.map((agency) => {
                const isActive = agency.id === currentAgency.id;
                return (
                  <Pressable
                    key={agency.id}
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setCurrentAgencyId(agency.id);
                    }}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 9999,
                      backgroundColor: isActive ? theme.accent : theme.surfaceSecondary,
                      borderWidth: 1,
                      borderColor: isActive ? theme.accent : theme.border,
                    }}
                  >
                    <Text
                      variant="labelSmall"
                      color={isActive ? '#FFFFFF' : theme.textSecondary}
                      style={{ fontWeight: isActive ? '700' : '500' }}
                    >
                      {agency.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        </Animated.View>
      )}

      {/* Agency Info Card */}
      <Animated.View entering={FadeInDown.duration(400).delay(50)} className="mb-4">
        <Card>
          <Text variant="headlineMedium" className="mb-3">
            {currentAgency.name || AGENCY_INFO.name}
          </Text>

          <View className="flex-row items-center mb-2">
            <MapPin size={16} color={theme.textSecondary} strokeWidth={1.8} />
            <Text variant="bodyMedium" color={theme.textSecondary} className="ml-2">
              {AGENCY_INFO.address}
            </Text>
          </View>

          <View className="flex-row items-center mb-2">
            <Phone size={16} color={theme.textSecondary} strokeWidth={1.8} />
            <Text variant="bodyMedium" color={theme.textSecondary} className="ml-2">
              {AGENCY_INFO.phone}
            </Text>
          </View>

          <View className="flex-row items-center mb-2">
            <Mail size={16} color={theme.textSecondary} strokeWidth={1.8} />
            <Text variant="bodyMedium" color={theme.textSecondary} className="ml-2">
              {AGENCY_INFO.email}
            </Text>
          </View>

          <View className="flex-row items-center">
            <Globe size={16} color={theme.textSecondary} strokeWidth={1.8} />
            <Text variant="bodyMedium" color={theme.accent} className="ml-2">
              {AGENCY_INFO.website}
            </Text>
          </View>
        </Card>
      </Animated.View>

      {/* Plan Card */}
      <Animated.View entering={FadeInDown.duration(400).delay(100)} className="mb-4">
        <Card>
          <View className="flex-row items-center mb-3">
            <Crown size={20} color={theme.accent} strokeWidth={1.8} />
            <Text variant="headlineSmall" className="ml-2 flex-1">
              Abonnement
            </Text>
            <Badge variant="accent" size="md">
              Professional
            </Badge>
          </View>
          <Divider className="mb-3" />
          <View className="flex-row justify-between mb-2">
            <Text variant="bodyMedium" color={theme.textSecondary}>
              Tarif mensuel
            </Text>
            <Text variant="titleMedium">€99/mois</Text>
          </View>
          <View className="flex-row justify-between mb-4">
            <Text variant="bodyMedium" color={theme.textSecondary}>
              Prochaine facturation
            </Text>
            <Text variant="titleMedium">1 mai 2026</Text>
          </View>
          <Button fullWidth variant="secondary" onPress={comingSoon}>
            Mettre à niveau
          </Button>
        </Card>
      </Animated.View>

      {/* Users List */}
      <Animated.View entering={FadeInDown.duration(400).delay(150)} className="mb-4">
        <Card>
          <Text variant="headlineSmall" className="mb-3">
            Équipe
          </Text>
          {TEAM_MEMBERS.map((member, index) => (
            <React.Fragment key={member.name}>
              {index > 0 && <Divider className="my-2.5" />}
              <View className="flex-row items-center">
                <Avatar
                  name={member.name}
                  size="sm"
                  online={member.lastActive === 'En ligne'}
                />
                <View className="flex-1 ml-3">
                  <Text variant="titleMedium">{member.name}</Text>
                  <Text variant="bodySmall" color={theme.textTertiary}>
                    {member.lastActive}
                  </Text>
                </View>
                <Badge
                  variant={member.role === 'admin' ? 'accent' : 'neutral'}
                  size="sm"
                >
                  {member.role === 'admin' ? 'Admin' : 'Employé'}
                </Badge>
              </View>
            </React.Fragment>
          ))}
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
      <Animated.View entering={FadeInDown.duration(400).delay(200)} className="mb-4">
        <Card>
          <Text variant="headlineSmall" className="mb-3">
            Paramètres de l'agence
          </Text>

          <View className="flex-row items-center mb-3">
            <Banknote size={18} color={theme.textSecondary} strokeWidth={1.8} />
            <Text variant="bodyMedium" className="flex-1 ml-3">
              Frais administratifs
            </Text>
            <Text variant="titleMedium" color={theme.accent}>
              €40
            </Text>
          </View>

          <Divider className="mb-3" />

          <View className="flex-row items-center mb-3">
            <Clock size={18} color={theme.textSecondary} strokeWidth={1.8} />
            <Text variant="bodyMedium" className="flex-1 ml-3">
              Horaires de travail
            </Text>
            <Text variant="titleMedium" color={theme.textSecondary}>
              09:00 - 18:00
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
                setAutoReminders(val);
              }}
              trackColor={{ false: theme.surfaceTertiary, true: theme.accentSoft }}
              thumbColor={autoReminders ? theme.accent : theme.textTertiary}
            />
          </View>
        </Card>
      </Animated.View>

      {/* Delivery */}
      <Animated.View entering={FadeInDown.duration(400).delay(225)} className="mb-4">
        <Card>
          <View className="flex-row items-center mb-1">
            <Truck size={20} color={theme.accent} strokeWidth={1.8} />
            <Text variant="headlineSmall" className="ml-2 flex-1">
              {t('settings.delivery.sectionTitle', 'Delivery')}
            </Text>
            <Switch
              value={delivery.enabled}
              onValueChange={(val) => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setDeliveryEnabled(val);
              }}
              trackColor={{ false: theme.surfaceTertiary, true: theme.accentSoft }}
              thumbColor={delivery.enabled ? theme.accent : theme.textTertiary}
            />
          </View>
          <Text variant="bodySmall" color={theme.textSecondary} className="mb-4">
            {t(
              'settings.delivery.sectionSubtitle',
              'Configure base point and per-km rate',
            )}
          </Text>

          {delivery.enabled && (
            <View style={{ gap: 14 }}>
              <Input
                label={t('settings.delivery.basePointLabel', 'Base point name')}
                placeholder={t(
                  'settings.delivery.basePointLabelPlaceholder',
                  'E.g. Geneva-Centre agency',
                )}
                value={deliveryLabel}
                onChangeText={setDeliveryLabel}
              />

              <View>
                <Input
                  label={t('settings.delivery.basePointAddress', 'Base address')}
                  placeholder={t(
                    'settings.delivery.basePointAddressPlaceholder',
                    'Street, number, postcode, city',
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
                      ? t('settings.delivery.searching', 'Searching…')
                      : t('settings.delivery.search', 'Search')}
                  </Button>
                </View>
              </View>

              {searching && (
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <ActivityIndicator color={theme.accent} />
                  <Text variant="bodySmall" color={theme.textSecondary}>
                    {t('settings.delivery.searching', 'Searching…')}
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
                      {t('settings.delivery.resolved', 'Address resolved')}
                    </Text>
                  </View>
                  <Text variant="bodySmall" color={theme.textPrimary}>
                    {resolvedAddress || deliveryAddress}
                  </Text>
                  <Text variant="caption" color={theme.textTertiary}>
                    {t('settings.delivery.coordinates', 'Coordinates')}:{' '}
                    {resolvedLat.toFixed(6)}, {resolvedLng.toFixed(6)}
                  </Text>
                  {staticMapUrl && (
                    <Image
                      source={staticMapUrl}
                      style={{ width: '100%', height: 140, borderRadius: 10 }}
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
                label={`${t('settings.delivery.ratePerKm', 'Rate per km')} (${delivery.currency})`}
                placeholder={t('settings.delivery.ratePerKmPlaceholder', 'E.g. 1.50')}
                value={deliveryRate}
                onChangeText={(text) =>
                  setDeliveryRateInput(text.replace(/[^0-9.,]/g, ''))
                }
                keyboardType="decimal-pad"
                leftIcon={Banknote}
              />

              <View className="flex-row" style={{ gap: 10 }}>
                <View className="flex-1">
                  <Input
                    label={t('settings.delivery.minFee', 'Minimum fee (optional)')}
                    placeholder={t('settings.delivery.minFeePlaceholder', 'E.g. 10')}
                    value={deliveryMinFee}
                    onChangeText={(text) =>
                      setDeliveryMinFeeInput(text.replace(/[^0-9.,]/g, ''))
                    }
                    keyboardType="decimal-pad"
                  />
                </View>
                <View className="flex-1">
                  <Input
                    label={t(
                      'settings.delivery.maxDistance',
                      'Max distance in km (optional)',
                    )}
                    placeholder={t(
                      'settings.delivery.maxDistancePlaceholder',
                      'E.g. 50',
                    )}
                    value={deliveryMaxDistance}
                    onChangeText={(text) =>
                      setDeliveryMaxDistanceInput(text.replace(/[^0-9.,]/g, ''))
                    }
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <Button variant="primary" fullWidth onPress={handleSaveDelivery}>
                {t('settings.delivery.save', 'Save delivery settings')}
              </Button>
            </View>
          )}
        </Card>
      </Animated.View>

      {/* Booking Policies */}
      <Animated.View entering={FadeInDown.duration(400).delay(250)} className="mb-8">
        <Card>
          <Text variant="headlineSmall" className="mb-3">
            {t('agency.bookingPolicies', { defaultValue: 'Booking Policies' })}
          </Text>

          <View className="flex-row items-center">
            <CalendarX size={18} color={theme.textSecondary} strokeWidth={1.8} />
            <Text variant="bodyMedium" className="flex-1 ml-3">
              {t('agency.autoCancelUnpaid', { defaultValue: 'Auto-cancel unpaid bookings' })}
            </Text>
            <Switch
              value={autoCancelEnabled}
              onValueChange={(val) => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setAutoCancelEnabled(val);
              }}
              trackColor={{ false: theme.surfaceTertiary, true: theme.accentSoft }}
              thumbColor={autoCancelEnabled ? theme.accent : theme.textTertiary}
            />
          </View>

          {autoCancelEnabled && (
            <View className="mt-3">
              <Text variant="bodySmall" color={theme.textSecondary} className="mb-2">
                {t('agency.cancelAfter', { defaultValue: 'Cancel after' })}
              </Text>
              <View className="flex-row gap-2">
                {AUTO_CANCEL_OPTIONS.map((option) => {
                  const isActive = autoCancelHours === option.hours;
                  return (
                    <Pressable
                      key={option.hours}
                      onPress={() => {
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setAutoCancelHours(option.hours);
                      }}
                      style={{
                        flex: 1,
                        paddingVertical: 8,
                        borderRadius: 9999,
                        backgroundColor: isActive ? theme.accent : theme.surfaceSecondary,
                        alignItems: 'center',
                      }}
                    >
                      <Text
                        variant="labelSmall"
                        color={isActive ? '#FFFFFF' : theme.textSecondary}
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
    </ScreenWrapper>
  );
}
