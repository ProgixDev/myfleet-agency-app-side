import React, { useState, useCallback } from 'react';
import { View, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  ZoomIn,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  ChevronLeft,
  Check,
  Camera,
  CheckCircle,
  UserCheck,
  CreditCard,
  Key,
  AlertTriangle,
  Eye,
  EyeOff,
  FileText,
  Shield,
  PenTool,
  Car,
  Gauge,
} from 'lucide-react-native';

import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Divider } from '@/components/ui/Divider';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { useToastStore } from '@/components/ui/Toast';
import { useBookingStore } from '@/stores/useBookingStore';
import { useTheme } from '@/hooks/useTheme';
import { shadows } from '@/theme/shadows';

// ── Mock Data ───────────────────────────────────────────────────────────────

const MOCK_BOOKING = {
  id: 'BK-2024-0042',
  client: {
    name: 'Mohammed Benali',
    phone: '+212 6 12 34 56 78',
    licenseNo: 'D-4892731',
  },
  vehicle: {
    name: 'Mercedes C-Class 2024',
    plate: '12345-A-67',
    color: 'Black',
    vin: 'WDD2050012R123456',
  },
  dates: {
    start: '2024-12-15',
    end: '2024-12-22',
    days: 7,
  },
  pricing: {
    daily: 450,
    total: 3150,
    deposit: 5000,
    currency: 'MAD',
  },
  insurance: 'all-inclusive' as const,
};

const MOCK_AI_DETECTIONS = [
  { id: '1', location: 'Front Bumper', type: 'Scratch', confidence: 94, severity: 'minor' },
  { id: '2', location: 'Rear Left Door', type: 'Dent', confidence: 78, severity: 'moderate' },
  { id: '3', location: 'Front Right Fender', type: 'Scratch', confidence: 55, severity: 'minor' },
  { id: '4', location: 'Roof', type: 'Paint chip', confidence: 42, severity: 'minor' },
];

const CAMERA_ANGLES = [
  'Front', 'Front Right', 'Right', 'Rear Right',
  'Rear', 'Rear Left', 'Left', 'Front Left',
] as const;

const STEPS = ['Reservation', 'Inspection', 'Contract'] as const;

// ── Step Progress Component ─────────────────────────────────────────────────

interface StepProgressProps {
  currentStep: number;
  steps: readonly string[];
}

function StepProgress({ currentStep, steps }: StepProgressProps) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
        paddingHorizontal: 24,
      }}
    >
      {steps.map((label, index) => {
        const isCompleted = index < currentStep;
        const isActive = index === currentStep;

        const circleSize = 32;
        const circleColor =
          isCompleted || isActive ? theme.accent : theme.surfaceTertiary;
        const textColor =
          isCompleted || isActive ? '#FFFFFF' : theme.textTertiary;

        return (
          <React.Fragment key={label}>
            {index > 0 && (
              <View
                style={{
                  flex: 1,
                  height: 2,
                  backgroundColor:
                    index <= currentStep
                      ? theme.accent
                      : theme.surfaceTertiary,
                  marginHorizontal: 4,
                }}
              />
            )}

            <View style={{ alignItems: 'center' }}>
              <View
                style={{
                  width: circleSize,
                  height: circleSize,
                  borderRadius: circleSize / 2,
                  backgroundColor: circleColor,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isCompleted ? (
                  <Check size={16} color="#FFFFFF" strokeWidth={3} />
                ) : (
                  <Text
                    variant="bodySmall"
                    color={textColor}
                    style={{ fontWeight: '700', fontSize: 13 }}
                  >
                    {index + 1}
                  </Text>
                )}
              </View>
              <Text
                variant="bodySmall"
                color={isActive ? theme.accent : theme.textTertiary}
                style={{
                  marginTop: 4,
                  fontWeight: isActive ? '600' : '400',
                  fontSize: 11,
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

// ── Checklist Item ──────────────────────────────────────────────────────────

interface ChecklistItemProps {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  checked: boolean;
  onToggle: () => void;
}

function ChecklistItem({ icon: Icon, label, checked, onToggle }: ChecklistItemProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onToggle();
      }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        gap: 12,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: checked ? theme.accentSoft : theme.surfaceSecondary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={20} color={checked ? theme.accent : theme.textTertiary} />
      </View>
      <Text
        variant="bodyMedium"
        color={checked ? theme.textPrimary : theme.textSecondary}
        style={{ flex: 1, fontWeight: checked ? '600' : '400' }}
      >
        {label}
      </Text>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          borderWidth: 2,
          borderColor: checked ? theme.accent : theme.border,
          backgroundColor: checked ? theme.accent : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
      </View>
    </Pressable>
  );
}

// ── Signature Box ───────────────────────────────────────────────────────────

interface SignatureBoxProps {
  label: string;
  signed: boolean;
  onSign: () => void;
}

function SignatureBox({ label, signed, onSign }: SignatureBoxProps) {
  const theme = useTheme();

  return (
    <View style={{ flex: 1 }}>
      <Text
        variant="bodySmall"
        color={theme.textSecondary}
        style={{ marginBottom: 8, fontWeight: '600' }}
      >
        {label}
      </Text>
      <Pressable
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onSign();
        }}
        style={{
          height: 100,
          borderRadius: 16,
          borderWidth: 2,
          borderColor: signed ? theme.accent : theme.border,
          borderStyle: signed ? 'solid' : 'dashed',
          backgroundColor: signed ? theme.accentSoft : theme.surfaceSecondary,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        {signed ? (
          <>
            <CheckCircle size={24} color={theme.accent} />
            <Text variant="bodySmall" color={theme.accent} style={{ fontWeight: '600' }}>
              Signed
            </Text>
          </>
        ) : (
          <>
            <PenTool size={20} color={theme.textTertiary} />
            <Text variant="bodySmall" color={theme.textTertiary}>
              Tap to sign
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

// ── Main Screen ─────────────────────────────────────────────────────────────

export default function PickupScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const recordStartMileage = useBookingStore((s) => s.recordStartMileage);
  const showToast = useToastStore((s) => s.show);

  const [currentStep, setCurrentStep] = useState(0);
  const [completed, setCompleted] = useState(false);

  // Step 1 state
  const [identityVerified, setIdentityVerified] = useState(false);
  const [paymentReceived, setPaymentReceived] = useState(false);
  const [keysReady, setKeysReady] = useState(false);
  const [startMileageInput, setStartMileageInput] = useState('');

  // Step 2 state
  const [capturedAngles, setCapturedAngles] = useState<Set<number>>(new Set());
  const [showUncertain, setShowUncertain] = useState(false);
  const [agentSigned, setAgentSigned] = useState(false);
  const [clientSigned, setClientSigned] = useState(false);

  // Step 3 state
  const [contractSigned, setContractSigned] = useState(false);

  const booking = MOCK_BOOKING;

  const parsedStartMileage = Number.parseInt(startMileageInput.replace(/[^0-9]/g, ''), 10);
  const isStartMileageValid =
    startMileageInput.trim().length > 0 && Number.isFinite(parsedStartMileage) && parsedStartMileage > 0;

  const allChecked =
    identityVerified && paymentReceived && keysReady && isStartMileageValid;

  const confirmDetections = MOCK_AI_DETECTIONS.filter((d) => d.confidence >= 90);
  const reviewDetections = MOCK_AI_DETECTIONS.filter(
    (d) => d.confidence >= 70 && d.confidence < 90
  );
  const uncertainDetections = MOCK_AI_DETECTIONS.filter((d) => d.confidence < 70);

  const handleCapture = useCallback(
    (index: number) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setCapturedAngles((prev) => {
        const next = new Set(prev);
        next.add(index);
        return next;
      });
    },
    []
  );

  const handleNext = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentStep < 2) {
      setCurrentStep((s) => s + 1);
    }
  }, [currentStep]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    } else {
      router.back();
    }
  }, [currentStep, router]);

  const handleComplete = useCallback(() => {
    if (!id || !isStartMileageValid) {
      showToast({
        variant: 'error',
        title: t('bookings.mileage.startMileageRequired', 'Departure mileage required'),
      });
      return;
    }

    const result = recordStartMileage(id, parsedStartMileage);
    if (!result.ok) {
      const messageKey =
        result.error === 'invalidMileage'
          ? 'bookings.mileage.errorInvalid'
          : result.error === 'bookingNotFound'
            ? 'bookings.mileage.errorBookingNotFound'
            : 'bookings.mileage.errorInvalid';
      showToast({
        variant: 'error',
        title: t(messageKey, result.error),
      });
      return;
    }

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCompleted(true);
  }, [id, isStartMileageValid, parsedStartMileage, recordStartMileage, showToast, t]);

  // ── Success Screen ──────────────────────────────────────────────────────

  if (completed) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <StatusBar style="dark" />
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 32,
          }}
        >
          <Animated.View entering={ZoomIn.springify().damping(12)}>
            <View
              style={{
                width: 120,
                height: 120,
                borderRadius: 60,
                backgroundColor: theme.accentSoft,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 24,
              }}
            >
              <LinearGradient
                colors={[theme.accentGradientStart, theme.accentGradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Check size={40} color="#FFFFFF" strokeWidth={3} />
              </LinearGradient>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(300).springify()}>
            <Text
              variant="headlineLarge"
              align="center"
              style={{ marginBottom: 8 }}
            >
              {t('pickup.success.title', { defaultValue: 'Vehicle Departed!' })}
            </Text>
            <Text
              variant="bodyMedium"
              color={theme.textSecondary}
              align="center"
              style={{ marginBottom: 8 }}
            >
              {t('pickup.success.subtitle', {
                defaultValue: 'Pickup process completed successfully',
              })}
            </Text>
            <Text
              variant="bodySmall"
              color={theme.textTertiary}
              align="center"
              style={{ marginBottom: 32 }}
            >
              {t('pickup.success.booking', {
                defaultValue: 'Booking {{id}}',
                id: booking.id,
              })}
            </Text>
          </Animated.View>

          <Animated.View
            entering={FadeInUp.delay(500).springify()}
            style={{ width: '100%' }}
          >
            <Button fullWidth onPress={() => router.back()}>
              {t('pickup.success.done', { defaultValue: 'Done' })}
            </Button>
          </Animated.View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Step 1: Reservation Summary ─────────────────────────────────────────

  const renderStep1 = () => (
    <Animated.View entering={FadeIn.duration(300)} style={{ gap: 16 }}>
      {/* Booking Summary */}
      <Card>
        <View style={{ gap: 12 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text variant="headlineSmall">
              {t('pickup.reservation.title', { defaultValue: 'Booking Summary' })}
            </Text>
            <Badge variant="accent">{booking.id}</Badge>
          </View>

          <Divider />

          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="bodySmall" color={theme.textSecondary}>
                {t('pickup.reservation.client', { defaultValue: 'Client' })}
              </Text>
              <Text variant="bodySmall" style={{ fontWeight: '600' }}>
                {booking.client.name}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="bodySmall" color={theme.textSecondary}>
                {t('pickup.reservation.phone', { defaultValue: 'Phone' })}
              </Text>
              <Text variant="bodySmall" style={{ fontWeight: '600' }}>
                {booking.client.phone}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="bodySmall" color={theme.textSecondary}>
                {t('pickup.reservation.license', { defaultValue: 'License' })}
              </Text>
              <Text variant="bodySmall" style={{ fontWeight: '600' }}>
                {booking.client.licenseNo}
              </Text>
            </View>
          </View>

          <Divider />

          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="bodySmall" color={theme.textSecondary}>
                {t('pickup.reservation.vehicle', { defaultValue: 'Vehicle' })}
              </Text>
              <Text variant="bodySmall" style={{ fontWeight: '600' }}>
                {booking.vehicle.name}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="bodySmall" color={theme.textSecondary}>
                {t('pickup.reservation.plate', { defaultValue: 'Plate' })}
              </Text>
              <Text variant="bodySmall" style={{ fontWeight: '600' }}>
                {booking.vehicle.plate}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="bodySmall" color={theme.textSecondary}>
                {t('pickup.reservation.period', { defaultValue: 'Period' })}
              </Text>
              <Text variant="bodySmall" style={{ fontWeight: '600' }}>
                {booking.dates.start} - {booking.dates.end} ({booking.dates.days}d)
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="bodySmall" color={theme.textSecondary}>
                {t('pickup.reservation.total', { defaultValue: 'Total' })}
              </Text>
              <Text variant="bodySmall" color={theme.accent} style={{ fontWeight: '700' }}>
                {booking.pricing.total} {booking.pricing.currency}
              </Text>
            </View>
          </View>
        </View>
      </Card>

      {/* Checklist */}
      <Card>
        <Text
          variant="titleLarge"
          style={{ marginBottom: 4 }}
        >
          {t('pickup.checklist.title', { defaultValue: 'Pre-Departure Checklist' })}
        </Text>
        <Text
          variant="bodySmall"
          color={theme.textSecondary}
          style={{ marginBottom: 12 }}
        >
          {t('pickup.checklist.subtitle', {
            defaultValue: 'Verify all items before proceeding',
          })}
        </Text>

        <ChecklistItem
          icon={UserCheck}
          label={t('pickup.checklist.identity', {
            defaultValue: 'Client identity verified',
          })}
          checked={identityVerified}
          onToggle={() => setIdentityVerified((v) => !v)}
        />
        <View style={{ height: 1, backgroundColor: theme.borderLight, marginHorizontal: 16 }} />
        <ChecklistItem
          icon={CreditCard}
          label={t('pickup.checklist.payment', {
            defaultValue: 'Payment received',
          })}
          checked={paymentReceived}
          onToggle={() => setPaymentReceived((v) => !v)}
        />
        <View style={{ height: 1, backgroundColor: theme.borderLight, marginHorizontal: 16 }} />
        <ChecklistItem
          icon={Key}
          label={t('pickup.checklist.keys', {
            defaultValue: 'Vehicle keys prepared',
          })}
          checked={keysReady}
          onToggle={() => setKeysReady((v) => !v)}
        />
      </Card>

      {/* Start mileage (required) */}
      <Card>
        <Text variant="titleLarge" style={{ marginBottom: 4 }}>
          {t('bookings.mileage.startMileageLabel', 'Departure mileage')}
        </Text>
        <Text
          variant="bodySmall"
          color={theme.textSecondary}
          style={{ marginBottom: 12 }}
        >
          {t('bookings.mileage.startMileageRequired', 'Departure mileage required')}
        </Text>
        <Input
          placeholder={t('bookings.mileage.startMileagePlaceholder', 'Enter mileage')}
          value={startMileageInput}
          onChangeText={(text) => setStartMileageInput(text.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          leftIcon={Gauge}
          helperText={`${t('bookings.mileage.unit', 'km')}`}
        />
      </Card>

      {/* Continue Button */}
      <Button
        fullWidth
        disabled={!allChecked}
        onPress={handleNext}
      >
        {t('pickup.reservation.continue', {
          defaultValue: 'Continue to Inspection',
        })}
      </Button>
    </Animated.View>
  );

  // ── Step 2: Pre-Departure Inspection ────────────────────────────────────

  const renderStep2 = () => (
    <Animated.View entering={FadeIn.duration(300)} style={{ gap: 16 }}>
      {/* Banner */}
      <Card variant="accent" padding="md">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Car size={20} color="#FFFFFF" />
          <View style={{ flex: 1 }}>
            <Text variant="bodySmall" color="#FFFFFF" style={{ opacity: 0.8 }}>
              {t('pickup.inspection.banner', {
                defaultValue: 'Pre-departure inspection for',
              })}
            </Text>
            <Text variant="titleMedium" color="#FFFFFF" style={{ fontWeight: '700' }}>
              {booking.vehicle.name} — {booking.client.name}
            </Text>
          </View>
        </View>
      </Card>

      {/* 8-Angle Capture Grid */}
      <Card>
        <Text variant="titleLarge" style={{ marginBottom: 4 }}>
          {t('pickup.inspection.captureTitle', {
            defaultValue: 'Vehicle Photos',
          })}
        </Text>
        <Text
          variant="bodySmall"
          color={theme.textSecondary}
          style={{ marginBottom: 12 }}
        >
          {t('pickup.inspection.captureSubtitle', {
            defaultValue: 'Capture all 8 angles of the vehicle',
          })}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          {CAMERA_ANGLES.map((angle, index) => {
            const isCaptured = capturedAngles.has(index);
            return (
              <Pressable
                key={angle}
                onPress={() => handleCapture(index)}
                style={{
                  width: '23%',
                  aspectRatio: 1,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: isCaptured ? theme.accent : theme.border,
                  borderStyle: isCaptured ? 'solid' : 'dashed',
                  backgroundColor: isCaptured
                    ? theme.accentSoft
                    : theme.surfaceSecondary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                }}
              >
                {isCaptured ? (
                  <CheckCircle size={20} color={theme.accent} />
                ) : (
                  <Camera size={20} color={theme.textTertiary} />
                )}
                <Text
                  variant="labelSmall"
                  color={isCaptured ? theme.accent : theme.textTertiary}
                  align="center"
                  numberOfLines={1}
                  style={{ fontSize: 9, paddingHorizontal: 2 }}
                >
                  {angle}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text
          variant="bodySmall"
          color={theme.textTertiary}
          align="center"
          style={{ marginTop: 8 }}
        >
          {capturedAngles.size}/{CAMERA_ANGLES.length}{' '}
          {t('pickup.inspection.captured', { defaultValue: 'captured' })}
        </Text>
      </Card>

      {/* AI Detection Results */}
      <Card>
        <Text variant="titleLarge" style={{ marginBottom: 4 }}>
          {t('pickup.inspection.aiTitle', {
            defaultValue: 'AI Damage Detection',
          })}
        </Text>
        <Text
          variant="bodySmall"
          color={theme.textSecondary}
          style={{ marginBottom: 12 }}
        >
          {t('pickup.inspection.aiSubtitle', {
            defaultValue: 'Automated analysis of captured photos',
          })}
        </Text>

        {/* Confirmed Damages (>= 90%) */}
        {confirmDetections.length > 0 && (
          <View style={{ gap: 8, marginBottom: 12 }}>
            {confirmDetections.map((d) => (
              <View
                key={d.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  backgroundColor: theme.dangerSoft,
                  borderRadius: 12,
                }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodySmall" style={{ fontWeight: '600' }}>
                    {d.type} — {d.location}
                  </Text>
                  <Text variant="caption" color={theme.textTertiary}>
                    {d.confidence}%{' '}
                    {t('pickup.inspection.confidence', {
                      defaultValue: 'confidence',
                    })}{' '}
                    · {d.severity}
                  </Text>
                </View>
                <Badge variant="danger" size="sm">
                  {t('pickup.inspection.confirmed', {
                    defaultValue: 'Confirmed',
                  })}
                </Badge>
              </View>
            ))}
          </View>
        )}

        {/* Review Required (70-89%) */}
        {reviewDetections.length > 0 && (
          <View style={{ gap: 8, marginBottom: 12 }}>
            {reviewDetections.map((d) => (
              <View
                key={d.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  backgroundColor: theme.warningSoft,
                  borderRadius: 12,
                }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodySmall" style={{ fontWeight: '600' }}>
                    {d.type} — {d.location}
                  </Text>
                  <Text variant="caption" color={theme.textTertiary}>
                    {d.confidence}%{' '}
                    {t('pickup.inspection.confidence', {
                      defaultValue: 'confidence',
                    })}{' '}
                    · {d.severity}
                  </Text>
                </View>
                <Badge variant="warning" size="sm">
                  {t('pickup.inspection.review', {
                    defaultValue: 'Review Required',
                  })}
                </Badge>
              </View>
            ))}
          </View>
        )}

        {/* Uncertain (< 70%) */}
        {uncertainDetections.length > 0 && (
          <View>
            <Pressable
              onPress={() => setShowUncertain((v) => !v)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 8,
                gap: 6,
              }}
            >
              {showUncertain ? (
                <EyeOff size={14} color={theme.textTertiary} />
              ) : (
                <Eye size={14} color={theme.textTertiary} />
              )}
              <Text variant="bodySmall" color={theme.textTertiary}>
                {showUncertain
                  ? t('pickup.inspection.hideUncertain', {
                      defaultValue: 'Hide uncertain',
                    })
                  : t('pickup.inspection.showUncertain', {
                      defaultValue: 'Show uncertain',
                    })}{' '}
                ({uncertainDetections.length})
              </Text>
            </Pressable>

            {showUncertain && (
              <View style={{ gap: 8, marginTop: 8 }}>
                {uncertainDetections.map((d) => (
                  <View
                    key={d.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      backgroundColor: theme.surfaceSecondary,
                      borderRadius: 12,
                      opacity: 0.7,
                    }}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="bodySmall" style={{ fontWeight: '600' }}>
                        {d.type} — {d.location}
                      </Text>
                      <Text variant="caption" color={theme.textTertiary}>
                        {d.confidence}%{' '}
                        {t('pickup.inspection.confidence', {
                          defaultValue: 'confidence',
                        })}{' '}
                        · {d.severity}
                      </Text>
                    </View>
                    <Badge variant="neutral" size="sm">
                      {t('pickup.inspection.uncertain', {
                        defaultValue: 'Uncertain',
                      })}
                    </Badge>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </Card>

      {/* Signatures */}
      <Card>
        <Text variant="titleLarge" style={{ marginBottom: 12 }}>
          {t('pickup.inspection.signatures', {
            defaultValue: 'Signatures',
          })}
        </Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <SignatureBox
            label={t('pickup.inspection.agentSignature', {
              defaultValue: 'Agent',
            })}
            signed={agentSigned}
            onSign={() => setAgentSigned((v) => !v)}
          />
          <SignatureBox
            label={t('pickup.inspection.clientSignature', {
              defaultValue: 'Client',
            })}
            signed={clientSigned}
            onSign={() => setClientSigned((v) => !v)}
          />
        </View>
      </Card>

      {/* Continue Button */}
      <Button fullWidth onPress={handleNext}>
        {t('pickup.inspection.continue', {
          defaultValue: 'Continue to Contract',
        })}
      </Button>
    </Animated.View>
  );

  // ── Step 3: Contract ────────────────────────────────────────────────────

  const renderStep3 = () => (
    <Animated.View entering={FadeIn.duration(300)} style={{ gap: 16 }}>
      {/* Contract Preview */}
      <Card>
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: theme.accentSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileText size={20} color={theme.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="titleLarge">
                {t('pickup.contract.title', { defaultValue: 'Rental Contract' })}
              </Text>
              <Text variant="bodySmall" color={theme.textSecondary}>
                {t('pickup.contract.subtitle', {
                  defaultValue: 'Review and sign to complete',
                })}
              </Text>
            </View>
          </View>

          <Divider />

          {/* Contract Details */}
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="bodySmall" color={theme.textSecondary}>
                {t('pickup.contract.contractId', { defaultValue: 'Contract ID' })}
              </Text>
              <Text variant="bodySmall" style={{ fontWeight: '600' }}>
                CTR-{booking.id.replace('BK-', '')}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="bodySmall" color={theme.textSecondary}>
                {t('pickup.contract.renter', { defaultValue: 'Renter' })}
              </Text>
              <Text variant="bodySmall" style={{ fontWeight: '600' }}>
                {booking.client.name}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="bodySmall" color={theme.textSecondary}>
                {t('pickup.contract.vehicle', { defaultValue: 'Vehicle' })}
              </Text>
              <Text variant="bodySmall" style={{ fontWeight: '600' }}>
                {booking.vehicle.name}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="bodySmall" color={theme.textSecondary}>
                {t('pickup.contract.plateNumber', { defaultValue: 'Plate' })}
              </Text>
              <Text variant="bodySmall" style={{ fontWeight: '600' }}>
                {booking.vehicle.plate}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="bodySmall" color={theme.textSecondary}>
                {t('pickup.contract.vin', { defaultValue: 'VIN' })}
              </Text>
              <Text variant="bodySmall" style={{ fontWeight: '600' }}>
                {booking.vehicle.vin}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="bodySmall" color={theme.textSecondary}>
                {t('pickup.contract.rentalPeriod', { defaultValue: 'Rental Period' })}
              </Text>
              <Text variant="bodySmall" style={{ fontWeight: '600' }}>
                {booking.dates.start} - {booking.dates.end}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="bodySmall" color={theme.textSecondary}>
                {t('pickup.contract.dailyRate', { defaultValue: 'Daily Rate' })}
              </Text>
              <Text variant="bodySmall" style={{ fontWeight: '600' }}>
                {booking.pricing.daily} {booking.pricing.currency}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="bodySmall" color={theme.textSecondary}>
                {t('pickup.contract.totalAmount', { defaultValue: 'Total Amount' })}
              </Text>
              <Text variant="bodySmall" color={theme.accent} style={{ fontWeight: '700' }}>
                {booking.pricing.total} {booking.pricing.currency}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="bodySmall" color={theme.textSecondary}>
                {t('pickup.contract.deposit', { defaultValue: 'Deposit' })}
              </Text>
              <Text variant="bodySmall" style={{ fontWeight: '600' }}>
                {booking.pricing.deposit} {booking.pricing.currency}
              </Text>
            </View>
          </View>
        </View>
      </Card>

      {/* Insurance Tier */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: theme.successSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Shield size={20} color={theme.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="titleMedium" style={{ fontWeight: '600' }}>
              {t('pickup.contract.insurance', { defaultValue: 'Insurance' })}
            </Text>
            <Text variant="bodySmall" color={theme.textSecondary}>
              {booking.insurance === 'all-inclusive'
                ? t('pickup.contract.insuranceAllInclusive', {
                    defaultValue: 'All-Inclusive Coverage',
                  })
                : t('pickup.contract.insuranceBasic', {
                    defaultValue: 'Basic Coverage',
                  })}
            </Text>
          </View>
          <Badge
            variant={booking.insurance === 'all-inclusive' ? 'success' : 'neutral'}
          >
            {booking.insurance === 'all-inclusive'
              ? t('pickup.contract.allInclusive', { defaultValue: 'All-Inclusive' })
              : t('pickup.contract.basic', { defaultValue: 'Basic' })}
          </Badge>
        </View>
      </Card>

      {/* Contract Signature */}
      <Card>
        <Text variant="titleLarge" style={{ marginBottom: 12 }}>
          {t('pickup.contract.signatureTitle', {
            defaultValue: 'Contract Signature',
          })}
        </Text>
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setContractSigned((v) => !v);
          }}
          style={{
            height: 140,
            borderRadius: 16,
            borderWidth: 2,
            borderColor: contractSigned ? theme.accent : theme.border,
            borderStyle: contractSigned ? 'solid' : 'dashed',
            backgroundColor: contractSigned
              ? theme.accentSoft
              : theme.surfaceSecondary,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {contractSigned ? (
            <>
              <CheckCircle size={32} color={theme.accent} />
              <Text
                variant="bodyMedium"
                color={theme.accent}
                style={{ fontWeight: '600' }}
              >
                {t('pickup.contract.signed', { defaultValue: 'Contract Signed' })}
              </Text>
            </>
          ) : (
            <>
              <PenTool size={24} color={theme.textTertiary} />
              <Text variant="bodyMedium" color={theme.textTertiary}>
                {t('pickup.contract.tapToSign', {
                  defaultValue: 'Tap to sign contract',
                })}
              </Text>
            </>
          )}
        </Pressable>
      </Card>

      {/* Sign & Complete */}
      <View style={{ ...shadows.accent, borderRadius: 9999 }}>
        <LinearGradient
          colors={[theme.accentGradientStart, theme.accentGradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ borderRadius: 9999, overflow: 'hidden' }}
        >
          <Pressable
            onPress={handleComplete}
            disabled={!contractSigned}
            style={{
              height: 52,
              borderRadius: 9999,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
              opacity: contractSigned ? 1 : 0.5,
            }}
          >
            <CheckCircle size={20} color="#FFFFFF" />
            <Text
              variant="bodyLarge"
              color="#FFFFFF"
              style={{ fontWeight: '700' }}
            >
              {t('pickup.contract.complete', {
                defaultValue: 'Sign & Complete',
              })}
            </Text>
          </Pressable>
        </LinearGradient>
      </View>
    </Animated.View>
  );

  // ── Main Layout ─────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar style="dark" />

      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 8,
          gap: 12,
        }}
      >
        <IconButton
          icon={ChevronLeft}
          variant="ghost"
          size="md"
          onPress={handleBack}
        />
        <View style={{ flex: 1 }}>
          <Text variant="headlineSmall">
            {t('pickup.title', { defaultValue: 'Vehicle Pickup' })}
          </Text>
          <Text variant="bodySmall" color={theme.textSecondary}>
            {booking.id}
          </Text>
        </View>
      </View>

      {/* Step Indicator */}
      <StepProgress currentStep={currentStep} steps={STEPS} />

      {/* Content */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 32,
        }}
        bounces
      >
        {currentStep === 0 && renderStep1()}
        {currentStep === 1 && renderStep2()}
        {currentStep === 2 && renderStep3()}
      </ScrollView>
    </SafeAreaView>
  );
}
