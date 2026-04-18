import React, { useState, useMemo, useCallback } from 'react';
import { View, Pressable, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, {
  FadeInDown,
  FadeInRight,
  FadeInLeft,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
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
} from 'lucide-react-native';
import { Image } from 'expo-image';

import { Text } from '@/components/ui/Text';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Input } from '@/components/ui/Input';
import { StickyButton } from '@/components/ui/StickyButton';
import { useTheme } from '@/hooks/useTheme';
import { mockVehicles } from '@/data/vehicles';
import { getVehicleImage } from '@/data/vehicleImages';
import { fontFamilies } from '@/theme/typography';
import type { Vehicle } from '@/types/vehicle';
import type { InspectionType } from '@/types/inspection';
import { useInspectionStore } from '@/stores/useInspectionStore';

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
    type: 'pre-rental',
    icon: ScanLine,
    titleKey: 'inspections.new.typePreRental.title',
    titleFallback: 'Pre-rental',
    subtitleKey: 'inspections.new.typePreRental.subtitle',
    subtitleFallback: 'Before handing to client',
  },
  {
    type: 'post-rental',
    icon: ClipboardCheck,
    titleKey: 'inspections.new.typePostRental.title',
    titleFallback: 'Post-rental',
    subtitleKey: 'inspections.new.typePostRental.subtitle',
    subtitleFallback: 'When client returns vehicle',
  },
  {
    type: 'routine',
    icon: Wrench,
    titleKey: 'inspections.new.typeRoutine.title',
    titleFallback: 'Routine',
    subtitleKey: 'inspections.new.typeRoutine.subtitle',
    subtitleFallback: 'Periodic maintenance check',
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
            <View style={{ alignItems: 'center' }}>
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: done ? theme.accent : theme.surfaceTertiary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isCompleted ? (
                  <Check size={14} color="#FFFFFF" strokeWidth={3} />
                ) : (
                  <Text
                    variant="labelSmall"
                    color={isActive ? '#FFFFFF' : theme.textTertiary}
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
  const { t } = useTranslation();
  const theme = useTheme();

  const STEPS = [
    t('inspections.new.steps.vehicle', 'Vehicle'),
    t('inspections.new.steps.type', 'Type'),
    t('inspections.new.steps.details', 'Details'),
  ] as const;

  const [currentStep, setCurrentStep] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  const [selectedType, setSelectedType] = useState<InspectionType | null>(null);

  const [mileage, setMileage] = useState('');
  const [fuelLevel, setFuelLevel] = useState<number>(100);
  const [notes, setNotes] = useState('');

  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');

  const filteredVehicles = useMemo(() => {
    if (!searchQuery.trim()) return mockVehicles;
    const q = searchQuery.toLowerCase();
    return mockVehicles.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.brand.toLowerCase().includes(q) ||
        v.licensePlate.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  const goNext = useCallback(() => {
    setDirection('forward');
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  }, [STEPS.length]);

  const goBack = useCallback(() => {
    if (currentStep === 0) {
      router.back();
      return;
    }
    setDirection('backward');
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

  const handleStart = useCallback(() => {
    if (!selectedVehicle || !selectedType) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    useInspectionStore
      .getState()
      .startInspection(selectedVehicle.id, selectedVehicle.name, selectedType);

    const parsedMileage = parseInt(mileage, 10);
    if (!isNaN(parsedMileage)) {
      useInspectionStore.getState().updateDraftMileage(parsedMileage);
    }
    useInspectionStore.getState().updateDraftFuelLevel(fuelLevel);

    if (notes.trim()) {
      useInspectionStore.getState().updateDraftNotes(notes.trim());
    }

    router.push('/(app)/(inspections)/camera');
  }, [selectedVehicle, selectedType, mileage, fuelLevel, notes, router]);

  const canGoNext = useMemo(() => {
    if (currentStep === 0) return selectedVehicle !== null;
    if (currentStep === 1) return selectedType !== null;
    return true;
  }, [currentStep, selectedVehicle, selectedType]);

  const enteringAnim =
    direction === 'forward'
      ? FadeInRight.duration(320)
      : FadeInLeft.duration(320);

  // ── Render step content ────────────────────────────────────────────────

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <Animated.View key="step-0" entering={enteringAnim} style={{ flex: 1 }}>
            <Text
              variant="headlineMedium"
              style={{
                fontFamily: fontFamilies.bold,
                fontSize: 22,
                marginBottom: 4,
              }}
            >
              {t('inspections.new.selectVehicle', 'Select Vehicle')}
            </Text>
            <Text
              variant="bodyMedium"
              color={theme.textSecondary}
              style={{ fontSize: 13, marginBottom: 14 }}
            >
              {t(
                'inspections.new.selectVehicleHint',
                'Choose the vehicle to inspect',
              )}
            </Text>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
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
                  'inspections.new.searchPlaceholder',
                  'Search by name, brand, or plate...',
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
                <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                  <X size={14} color={theme.textTertiary} />
                </Pressable>
              )}
            </View>

            <View style={{ gap: 10 }}>
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
                <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                  <Text variant="bodyMedium" color={theme.textTertiary}>
                    {t('inspections.new.noVehicles', 'No vehicle found')}
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>
        );

      case 1:
        return (
          <Animated.View key="step-1" entering={enteringAnim} style={{ flex: 1 }}>
            <Text
              variant="headlineMedium"
              style={{
                fontFamily: fontFamilies.bold,
                fontSize: 22,
                marginBottom: 4,
              }}
            >
              {t('inspections.new.inspectionType', 'Inspection Type')}
            </Text>
            <Text
              variant="bodyMedium"
              color={theme.textSecondary}
              style={{ fontSize: 13, marginBottom: 18 }}
            >
              {t(
                'inspections.new.typeHint',
                'Select the type of inspection to perform',
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
          <Animated.View key="step-2" entering={enteringAnim} style={{ flex: 1 }}>
            <Text
              variant="headlineMedium"
              style={{
                fontFamily: fontFamilies.bold,
                fontSize: 22,
                marginBottom: 4,
              }}
            >
              {t('inspections.new.vehicleDetails', 'Vehicle Details')}
            </Text>
            <Text
              variant="bodyMedium"
              color={theme.textSecondary}
              style={{ fontSize: 13, marginBottom: 20 }}
            >
              {t(
                'inspections.new.detailsHint',
                'Enter current vehicle information',
              )}
            </Text>

            <Input
              label={t('inspections.new.mileage', 'Current Mileage')}
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
                {t('inspections.new.fuelLevel', 'Fuel Level')}
              </Text>
              <View className="flex-row items-center" style={{ gap: 6 }}>
                <Fuel size={16} color={theme.textTertiary} />
                {FUEL_LEVELS.map((level) => {
                  const isActive = fuelLevel === level;
                  return (
                    <Pressable
                      key={level}
                      onPress={() => handleFuelLevel(level)}
                      style={({ pressed }) => ({
                        flex: 1,
                        alignItems: 'center',
                        paddingVertical: 9,
                        borderRadius: 9999,
                        backgroundColor: isActive
                          ? theme.accent
                          : theme.surface,
                        borderWidth: 1,
                        borderColor: isActive ? theme.accent : theme.borderLight,
                        transform: [{ scale: pressed ? 0.97 : 1 }],
                      })}
                    >
                      <Text
                        variant="labelSmall"
                        color={isActive ? '#FFFFFF' : theme.textSecondary}
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
              label={t('inspections.new.notes', 'Notes (optional)')}
              placeholder={t(
                'inspections.new.notesPlaceholder',
                'Additional observations...',
              )}
              value={notes}
              onChangeText={setNotes}
              multiline
              className="mb-4"
            />
          </Animated.View>
        );

      default:
        return null;
    }
  };

  const showNextButton = canGoNext && currentStep < 2;
  const showStartButton =
    currentStep === 2 && selectedVehicle !== null && selectedType !== null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar style="dark" />
      <View style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 16,
            paddingBottom:
              showNextButton || showStartButton ? 180 : 120,
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
              onPress={goBack}
              hitSlop={10}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.borderLight,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              <ChevronLeft size={20} color={theme.textPrimary} strokeWidth={2} />
            </Pressable>
            <Text
              variant="headlineLarge"
              style={{ fontFamily: fontFamilies.bold, fontSize: 22 }}
            >
              {t('inspections.new.title', 'New Inspection')}
            </Text>
          </Animated.View>

          {/* Stepper */}
          <Animated.View entering={FadeInDown.delay(60).duration(350)}>
            <Stepper currentStep={currentStep} steps={STEPS} theme={theme} />
          </Animated.View>

          {/* Content */}
          <View style={{ flex: 1, minHeight: 400, marginTop: 8 }}>
            {renderStepContent()}
          </View>
        </ScrollView>

        {showNextButton && (
          <StickyButton variant="primary" onPress={goNext}>
            {t('inspections.new.next', 'Next')}
          </StickyButton>
        )}
        {showStartButton && (
          <StickyButton
            variant="primary"
            onPress={handleStart}
            leftIcon={ScanLine}
          >
            {t('inspections.new.start', 'Start Inspection')}
          </StickyButton>
        )}
      </View>
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
  const imageUri = getVehicleImage(vehicle.id);
  return (
    <Animated.View entering={FadeInDown.delay(index * 30).duration(300)}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          backgroundColor: selected ? theme.accentSoft : theme.surface,
          borderRadius: 18,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? theme.accent : theme.borderLight,
          padding: 12,
          flexDirection: 'row',
          alignItems: 'center',
          transform: [{ scale: pressed ? 0.99 : 1 }],
        })}
      >
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            overflow: 'hidden',
            backgroundColor: theme.surfaceTertiary,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
        >
          {imageUri ? (
            <Image
              source={imageUri}
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
          <View style={{ marginTop: 6, alignSelf: 'flex-start' }}>
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
            backgroundColor: selected ? theme.accent : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {selected && (
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: '#FFFFFF',
              }}
            />
          )}
        </View>
      </Pressable>
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
  t: ReturnType<typeof useTranslation>['t'];
  onPress: () => void;
}) {
  const Icon = option.icon;
  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(350)}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          backgroundColor: selected ? theme.accentSoft : theme.surface,
          borderRadius: 18,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? theme.accent : theme.borderLight,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
          transform: [{ scale: pressed ? 0.99 : 1 }],
        })}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: selected ? theme.accent : theme.accentSoft,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 14,
          }}
        >
          <Icon
            size={20}
            color={selected ? '#FFFFFF' : theme.accent}
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
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Check size={14} color="#FFFFFF" strokeWidth={3} />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}
