import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Pressable, ScrollView, Alert, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withSpring,
  withDelay,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  X,
  Zap,
  ZapOff,
  Car,
  Check,
  RotateCcw,
  ChevronRight,
  Camera,
  AlertTriangle,
  CheckCircle,
  ScanLine,
} from 'lucide-react-native';

import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { shadows } from '@/theme/shadows';
import { PHOTO_ANGLES, type PhotoAngle, type AIDetectionResult } from '@/types/inspection';
import { useInspectionStore } from '@/stores/useInspectionStore';

// ── Constants ─────────────────────────────────────────────────────────────────

const TOTAL_ANGLES = PHOTO_ANGLES.length;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const DARK_BG = '#0F0F1A';
const ACCENT = '#7C3AED';
const ACCENT_END = '#A855F7';
const SUCCESS = '#10B981';
const DANGER = '#EF4444';

type Phase = 'preview' | 'captured' | 'analyzing' | 'result';

// ── AI Simulation ─────────────────────────────────────────────────────────────

function simulateAI(): AIDetectionResult {
  const hasDamage = Math.random() < 0.3;
  if (!hasDamage) return { damagesFound: 0, markers: [] };
  const count = Math.ceil(Math.random() * 3);
  const markers = Array.from({ length: count }, () => ({
    x: 0.2 + Math.random() * 0.6,
    y: 0.2 + Math.random() * 0.6,
    confidence: 0.7 + Math.random() * 0.25,
  }));
  return { damagesFound: count, markers };
}

// ── Viewfinder Corner Bracket ─────────────────────────────────────────────────

function CornerBracket({
  position,
}: {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}) {
  const size = 24;
  const thickness = 2.5;
  const color = 'rgba(255,255,255,0.35)';

  const isTop = position.includes('top');
  const isLeft = position.includes('left');

  return (
    <View
      style={{
        position: 'absolute',
        top: isTop ? 0 : undefined,
        bottom: !isTop ? 0 : undefined,
        left: isLeft ? 0 : undefined,
        right: !isLeft ? 0 : undefined,
        width: size,
        height: size,
      }}
    >
      {/* Horizontal bar */}
      <View
        style={{
          position: 'absolute',
          top: isTop ? 0 : undefined,
          bottom: !isTop ? 0 : undefined,
          left: isLeft ? 0 : undefined,
          right: !isLeft ? 0 : undefined,
          width: size,
          height: thickness,
          backgroundColor: color,
          borderRadius: 1,
        }}
      />
      {/* Vertical bar */}
      <View
        style={{
          position: 'absolute',
          top: isTop ? 0 : undefined,
          bottom: !isTop ? 0 : undefined,
          left: isLeft ? 0 : undefined,
          right: !isLeft ? 0 : undefined,
          width: thickness,
          height: size,
          backgroundColor: color,
          borderRadius: 1,
        }}
      />
    </View>
  );
}

// ── Pulsing Dot ───────────────────────────────────────────────────────────────

function PulsingDot() {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 600 }),
        withTiming(1, { duration: 600 }),
      ),
      -1,
      false,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: ACCENT,
        },
        animatedStyle,
      ]}
    />
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CameraScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const draft = useInspectionStore((s) => s.draft);
  const capturePhoto = useInspectionStore((s) => s.capturePhoto);
  const nextAngle = useInspectionStore((s) => s.nextAngle);

  const [phase, setPhase] = useState<Phase>('preview');
  const [flashOn, setFlashOn] = useState(false);
  const [aiResult, setAiResult] = useState<AIDetectionResult | null>(null);
  const [allDone, setAllDone] = useState(false);
  const [showFlash, setShowFlash] = useState(false);

  const currentIndex = draft?.currentAngleIndex ?? 0;
  const currentAngle = PHOTO_ANGLES[currentIndex];
  const capturedPhotos = draft?.photos ?? [];

  // Timer refs for cleanup
  const capturedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analyzingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Scanning animation ────────────────────────────────────────────────────
  const scanLineY = useSharedValue(0);

  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanLineY.value }],
  }));

  // ── Capture button glow animation ─────────────────────────────────────────
  const captureGlow = useSharedValue(0.25);

  useEffect(() => {
    if (phase === 'preview') {
      captureGlow.value = withRepeat(
        withSequence(
          withTiming(0.5, { duration: 1200 }),
          withTiming(0.25, { duration: 1200 }),
        ),
        -1,
        false,
      );
    }
  }, [phase, captureGlow]);

  const captureGlowStyle = useAnimatedStyle(() => ({
    shadowOpacity: captureGlow.value,
  }));

  // ── Success circle bounce ─────────────────────────────────────────────────
  const successScale = useSharedValue(0);

  useEffect(() => {
    if (allDone) {
      successScale.value = withSpring(1, { damping: 12, stiffness: 180 });
    }
  }, [allDone, successScale]);

  const successScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: successScale.value }],
  }));

  useEffect(() => {
    if (phase === 'analyzing') {
      scanLineY.value = 0;
      scanLineY.value = withRepeat(
        withTiming(SCREEN_HEIGHT * 0.5, { duration: 1500 }),
        -1,
        true,
      );

      analyzingTimerRef.current = setTimeout(() => {
        const result = simulateAI();
        setAiResult(result);
        setPhase('result');
      }, 2000);
    }

    return () => {
      if (analyzingTimerRef.current) {
        clearTimeout(analyzingTimerRef.current);
        analyzingTimerRef.current = null;
      }
    };
  }, [phase, scanLineY]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (capturedTimerRef.current) clearTimeout(capturedTimerRef.current);
      if (analyzingTimerRef.current) clearTimeout(analyzingTimerRef.current);
    };
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleClose = useCallback(() => {
    Alert.alert(
      'Exit Camera',
      'Are you sure you want to exit? Your progress will be preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Exit', style: 'destructive', onPress: () => router.back() },
      ],
    );
  }, [router]);

  const handleCapture = useCallback(() => {
    if (phase !== 'preview') return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Flash effect
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 200);

    setPhase('captured');

    capturedTimerRef.current = setTimeout(() => {
      setPhase('analyzing');
    }, 500);
  }, [phase]);

  const handleRetake = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAiResult(null);
    setPhase('preview');
  }, []);

  const handleAccept = useCallback(() => {
    if (!currentAngle || !aiResult) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    capturePhoto(
      currentAngle.key,
      `mock://inspection-photo-${currentAngle.key}-${Date.now()}`,
      aiResult,
    );

    if (currentIndex >= TOTAL_ANGLES - 1) {
      setAllDone(true);
    } else {
      nextAngle();
      setAiResult(null);
      setPhase('preview');
    }
  }, [currentAngle, aiResult, capturePhoto, nextAngle, currentIndex]);

  const handleReviewSubmit = useCallback(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  }, [router]);

  const isAngleCaptured = useCallback(
    (angleKey: PhotoAngle): boolean => {
      return capturedPhotos.some((p) => p.angle === angleKey);
    },
    [capturedPhotos],
  );

  // Count stats for completion screen
  const cleanCount = capturedPhotos.filter(
    (p) => !p.aiResult || p.aiResult.damagesFound === 0,
  ).length;
  const issueCount = capturedPhotos.filter(
    (p) => p.aiResult && p.aiResult.damagesFound > 0,
  ).length;

  // ── Guard: no draft ───────────────────────────────────────────────────────
  if (!draft) {
    return (
      <View
        className="flex-1 items-center justify-center px-8"
        style={{ backgroundColor: '#F8F8FC' }}
      >
        <View
          className="items-center justify-center mb-5"
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            backgroundColor: '#7C3AED15',
          }}
        >
          <ScanLine size={28} color={ACCENT} strokeWidth={1.8} />
        </View>
        <Text variant="headlineSmall" align="center" style={{ fontSize: 18 }}>
          No Inspection in Progress
        </Text>
        <Text
          variant="bodyMedium"
          color="#6E6E82"
          align="center"
          className="mt-2"
          style={{ fontSize: 13 }}
        >
          Start a new inspection to begin capturing photos.
        </Text>
        <View style={{ marginTop: 24 }}>
          <Pressable
            onPress={() => router.replace('/(app)/(inspections)/new')}
            style={({ pressed }) => ({
              paddingHorizontal: 22,
              paddingVertical: 12,
              borderRadius: 9999,
              backgroundColor: ACCENT,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            })}
          >
            <Text variant="bodyMedium" color="#FFFFFF" style={{ fontSize: 14 }}>
              New inspection
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Completion Overlay ────────────────────────────────────────────────────
  if (allDone) {
    return (
      <View
        className="flex-1 items-center justify-center px-8"
        style={{ backgroundColor: '#F8F8FC' }}
      >
        <Animated.View
          entering={FadeInDown.duration(400)}
          className="items-center w-full"
        >
          {/* Solid accent success circle */}
          <Animated.View
            style={[
              {
                width: 88,
                height: 88,
                borderRadius: 44,
                backgroundColor: ACCENT,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
                shadowColor: ACCENT,
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.35,
                shadowRadius: 18,
                elevation: 8,
              },
              successScaleStyle,
            ]}
          >
            <Check size={40} color="#FFFFFF" strokeWidth={2.6} />
          </Animated.View>

          <Text
            variant="headlineLarge"
            align="center"
            style={{ fontSize: 22 }}
          >
            All Photos Captured!
          </Text>

          <Text
            variant="bodyMedium"
            color="#6E6E82"
            align="center"
            className="mt-2"
            style={{ fontSize: 13 }}
          >
            {capturedPhotos.length} of {TOTAL_ANGLES} angles documented
          </Text>

          {/* Stats pills */}
          <View className="flex-row items-center justify-center mt-5" style={{ gap: 8 }}>
            <View
              className="flex-row items-center"
              style={{
                backgroundColor: '#10B98115',
                borderRadius: 9999,
                paddingHorizontal: 12,
                paddingVertical: 6,
                gap: 6,
              }}
            >
              <CheckCircle size={13} color={SUCCESS} />
              <Text
                variant="labelSmall"
                color={SUCCESS}
                style={{ fontSize: 12, fontWeight: '600' }}
              >
                {cleanCount} clean
              </Text>
            </View>
            <View
              className="flex-row items-center"
              style={{
                backgroundColor: '#EF444415',
                borderRadius: 9999,
                paddingHorizontal: 12,
                paddingVertical: 6,
                gap: 6,
              }}
            >
              <AlertTriangle size={13} color={DANGER} />
              <Text
                variant="labelSmall"
                color={DANGER}
                style={{ fontSize: 12, fontWeight: '600' }}
              >
                {issueCount} with issues
              </Text>
            </View>
          </View>

          {/* Review & Submit button */}
          <View className="mt-10 w-full">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              rightIcon={ChevronRight}
              onPress={handleReviewSubmit}
            >
              Review & Submit
            </Button>
          </View>
        </Animated.View>
      </View>
    );
  }

  // ── Main Camera UI ────────────────────────────────────────────────────────
  const hasDamage = aiResult !== null && aiResult.damagesFound > 0;

  // Viewfinder area dimensions
  const viewfinderWidth = SCREEN_WIDTH - 64;
  const viewfinderHeight = viewfinderWidth * 0.75;
  const viewfinderTop = SCREEN_HEIGHT * 0.22;

  return (
    <View className="flex-1" style={{ backgroundColor: DARK_BG }}>
      {/* ── Camera Preview / States ─────────────────────────────────────── */}
      <View className="flex-1">
        {/* Preview state: simulated camera viewfinder */}
        {phase === 'preview' && (
          <Animated.View
            entering={FadeIn.duration(200)}
            className="flex-1 items-center justify-center"
          >
            {/* Viewfinder frame with corner brackets */}
            <View
              style={{
                width: viewfinderWidth,
                height: viewfinderHeight,
                position: 'relative',
              }}
            >
              <CornerBracket position="top-left" />
              <CornerBracket position="top-right" />
              <CornerBracket position="bottom-left" />
              <CornerBracket position="bottom-right" />

              {/* Accent soft glow behind icon */}
              <View
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  width: 180,
                  height: 180,
                  marginLeft: -90,
                  marginTop: -90,
                  borderRadius: 90,
                  backgroundColor: 'rgba(124,58,237,0.08)',
                }}
              />

              {/* Center content */}
              <View className="flex-1 items-center justify-center">
                {/* Angle icon in accent-soft tile */}
                <View
                  style={{
                    width: 88,
                    height: 88,
                    borderRadius: 24,
                    backgroundColor: 'rgba(124,58,237,0.15)',
                    borderWidth: 1,
                    borderColor: 'rgba(124,58,237,0.35)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 18,
                  }}
                >
                  <Car size={42} color={ACCENT} strokeWidth={1.4} />
                </View>
                <Text
                  variant="headlineLarge"
                  color="#FFFFFF"
                  align="center"
                  style={{ fontSize: 24, fontWeight: '700' }}
                >
                  {currentAngle?.label ?? ''}
                </Text>
                <View
                  style={{
                    marginTop: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                    borderRadius: 9999,
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.1)',
                  }}
                >
                  <Text
                    variant="labelSmall"
                    color="rgba(255,255,255,0.75)"
                    style={{ fontSize: 11, letterSpacing: 0.3 }}
                  >
                    Position the vehicle · Tap to capture
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Captured state: flash + confirmation */}
        {phase === 'captured' && (
          <Animated.View
            entering={FadeIn.duration(100)}
            className="flex-1 items-center justify-center"
          >
            <View
              className="w-16 h-16 rounded-full items-center justify-center mb-3"
              style={{ backgroundColor: '#7C3AED15' }}
            >
              <Camera size={32} color={ACCENT} />
            </View>
            <Text variant="headlineSmall" color="#FFFFFF">
              Photo captured
            </Text>
            <Text
              variant="bodySmall"
              color="rgba(255,255,255,0.5)"
              className="mt-1"
            >
              {currentAngle?.label ?? ''}
            </Text>
          </Animated.View>
        )}

        {/* Flash overlay */}
        {showFlash && (
          <Animated.View
            entering={FadeIn.duration(50)}
            exiting={FadeOut.duration(150)}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(255,255,255,0.85)',
            }}
          />
        )}

        {/* Analyzing state: scanning line + card */}
        {phase === 'analyzing' && (
          <View className="flex-1">
            {/* Dark overlay */}
            <View
              className="absolute inset-0"
              style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            />

            {/* Scanning gradient band */}
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  top: SCREEN_HEIGHT * 0.15,
                  left: 0,
                  right: 0,
                  height: 4,
                },
                scanLineStyle,
              ]}
            >
              <LinearGradient
                colors={['transparent', ACCENT, ACCENT_END, 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  height: 4,
                  width: '100%',
                  ...shadows.accent,
                }}
              />
              {/* Glow below the line */}
              <LinearGradient
                colors={['rgba(124,58,237,0.3)', 'transparent']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={{
                  height: 20,
                  width: '100%',
                  marginTop: -2,
                }}
              />
            </Animated.View>

            {/* Centered analysis card */}
            <View className="flex-1 items-center justify-center px-8">
              <Animated.View
                entering={FadeInDown.duration(300)}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 20,
                  padding: 24,
                  alignItems: 'center',
                  width: '100%',
                  maxWidth: 280,
                  ...shadows.lg,
                }}
              >
                <PulsingDot />
                <Text variant="headlineSmall" align="center" className="mt-4">
                  Analyzing with AI...
                </Text>
                <Text
                  variant="bodySmall"
                  color="#6E6E82"
                  align="center"
                  className="mt-2"
                >
                  Scanning for damages
                </Text>
              </Animated.View>
            </View>
          </View>
        )}

        {/* Result state */}
        {phase === 'result' && aiResult && (
          <View className="flex-1">
            {/* Background tint */}
            <View
              className="absolute inset-0"
              style={{
                backgroundColor: hasDamage
                  ? 'rgba(239, 68, 68, 0.12)'
                  : 'rgba(16, 185, 129, 0.08)',
              }}
            />

            {/* Damage markers — accent purple numbered circles */}
            {hasDamage &&
              aiResult.markers.map((marker, idx) => (
                <Animated.View
                  key={`marker-${idx}`}
                  entering={FadeIn.delay(idx * 150).duration(300)}
                  style={{
                    position: 'absolute',
                    left: marker.x * SCREEN_WIDTH - 16,
                    top: marker.y * SCREEN_HEIGHT * 0.5 + SCREEN_HEIGHT * 0.15 - 16,
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: ACCENT,
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...shadows.accent,
                  }}
                >
                  <Text variant="labelSmall" color="#FFFFFF" style={{ fontSize: 13 }}>
                    {idx + 1}
                  </Text>
                </Animated.View>
              ))}

            {/* Result card */}
            <Animated.View
              entering={FadeInDown.duration(300)}
              className="absolute inset-0 items-center justify-center px-8"
            >
              <View
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 20,
                  padding: 24,
                  alignItems: 'center',
                  width: '100%',
                  maxWidth: 300,
                  ...shadows.lg,
                }}
              >
                {hasDamage ? (
                  <>
                    <View
                      className="w-14 h-14 rounded-full items-center justify-center mb-3"
                      style={{ backgroundColor: '#EF444415' }}
                    >
                      <AlertTriangle size={28} color={DANGER} />
                    </View>
                    <Text variant="headlineSmall" color={DANGER} align="center">
                      {aiResult.damagesFound} issue{aiResult.damagesFound > 1 ? 's' : ''} detected
                    </Text>
                    <Text
                      variant="bodySmall"
                      color="#6E6E82"
                      align="center"
                      className="mt-2"
                    >
                      Confidence:{' '}
                      {Math.round(
                        (aiResult.markers.reduce(
                          (s, m) => s + m.confidence,
                          0,
                        ) /
                          aiResult.markers.length) *
                          100,
                      )}
                      %
                    </Text>
                  </>
                ) : (
                  <>
                    <View
                      className="w-14 h-14 rounded-full items-center justify-center mb-3"
                      style={{ backgroundColor: '#10B98115' }}
                    >
                      <CheckCircle size={28} color={SUCCESS} />
                    </View>
                    <Text variant="headlineSmall" color={SUCCESS} align="center">
                      No damage detected
                    </Text>
                    <Text
                      variant="bodySmall"
                      color="#6E6E82"
                      align="center"
                      className="mt-2"
                    >
                      This angle looks clean
                    </Text>
                  </>
                )}
              </View>
            </Animated.View>

            {/* Accept / Retake buttons */}
            <Animated.View
              entering={FadeInUp.duration(300).delay(200)}
              className="absolute left-5 right-5 flex-row"
              style={{ bottom: insets.bottom + 190, gap: 12 }}
            >
              <View className="flex-1">
                <Button
                  variant="ghost"
                  size="lg"
                  fullWidth
                  leftIcon={RotateCcw}
                  onPress={handleRetake}
                >
                  Retake
                </Button>
              </View>
              <View className="flex-1">
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  leftIcon={Check}
                  onPress={handleAccept}
                >
                  Accept
                </Button>
              </View>
            </Animated.View>
          </View>
        )}
      </View>

      {/* ── Top Bar (absolute, safe area aware) ───────────────────────── */}
      <View
        className="absolute left-0 right-0 z-10 px-4"
        style={{ top: insets.top + 8 }}
      >
        <View className="flex-row items-center justify-between">
          {/* Close button */}
          <Pressable
            onPress={handleClose}
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
          >
            <X size={20} color="#FFFFFF" />
          </Pressable>

          {/* Progress pill */}
          <View
            className="flex-row items-center"
            style={{
              backgroundColor: 'rgba(255,255,255,0.12)',
              borderRadius: 9999,
              paddingHorizontal: 14,
              paddingVertical: 7,
              gap: 6,
            }}
          >
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 9999,
                backgroundColor: ACCENT,
              }}
            >
              <Text
                variant="labelSmall"
                color="#FFFFFF"
                style={{ fontSize: 11, fontWeight: '700' }}
              >
                {currentIndex + 1}/{TOTAL_ANGLES}
              </Text>
            </View>
            <Text
              variant="labelSmall"
              color="#FFFFFF"
              style={{ fontSize: 12, fontWeight: '600' }}
              numberOfLines={1}
            >
              {currentAngle?.label ?? ''}
            </Text>
          </View>

          {/* Flash toggle */}
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setFlashOn((prev) => !prev);
            }}
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
          >
            {flashOn ? (
              <Zap size={20} color="#FFFFFF" />
            ) : (
              <ZapOff size={20} color="rgba(255,255,255,0.6)" />
            )}
          </Pressable>
        </View>

        {/* Segmented progress — one cell per angle */}
        <View
          className="flex-row"
          style={{ marginTop: 10, gap: 4 }}
        >
          {PHOTO_ANGLES.map((angle, idx) => {
            const isDone = isAngleCaptured(angle.key);
            const isCurrent = idx === currentIndex;
            return (
              <View
                key={`seg-${angle.key}`}
                style={{
                  flex: 1,
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: isDone
                    ? ACCENT
                    : isCurrent
                      ? 'rgba(124,58,237,0.55)'
                      : 'rgba(255,255,255,0.12)',
                }}
              />
            );
          })}
        </View>
      </View>

      {/* ── Bottom Area (absolute) ──────────────────────────────────────── */}
      <View
        className="absolute left-0 right-0 z-10"
        style={{ bottom: insets.bottom + 8 }}
      >
        {/* Thumbnail Strip with angle labels */}
        <View className="mb-4">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 16,
              gap: 10,
              alignItems: 'center',
            }}
          >
            {PHOTO_ANGLES.map((angle, idx) => {
              const captured = isAngleCaptured(angle.key);
              const isCurrent = idx === currentIndex;
              const bg = captured
                ? 'rgba(124,58,237,0.18)'
                : isCurrent
                  ? 'rgba(124,58,237,0.08)'
                  : 'rgba(255,255,255,0.06)';
              const borderColor = isCurrent
                ? ACCENT
                : captured
                  ? 'rgba(124,58,237,0.4)'
                  : 'rgba(255,255,255,0.08)';

              return (
                <View
                  key={angle.key}
                  style={{ alignItems: 'center', gap: 4, width: 56 }}
                >
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      backgroundColor: bg,
                      borderWidth: isCurrent ? 2 : 1,
                      borderColor,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {captured ? (
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: ACCENT,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Check size={13} color="#FFFFFF" strokeWidth={3} />
                      </View>
                    ) : (
                      <Text
                        variant="labelSmall"
                        color={
                          isCurrent ? '#FFFFFF' : 'rgba(255,255,255,0.45)'
                        }
                        style={{
                          fontSize: 13,
                          fontWeight: isCurrent ? '700' : '600',
                        }}
                      >
                        {idx + 1}
                      </Text>
                    )}
                  </View>
                  <Text
                    variant="labelSmall"
                    color={
                      isCurrent
                        ? '#FFFFFF'
                        : captured
                          ? 'rgba(255,255,255,0.55)'
                          : 'rgba(255,255,255,0.35)'
                    }
                    style={{
                      fontSize: 9,
                      fontWeight: isCurrent ? '700' : '500',
                      letterSpacing: 0.2,
                    }}
                    numberOfLines={1}
                  >
                    {angle.label}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </View>

        {/* Capture Button — only in preview */}
        <View className="items-center mt-2 mb-2">
          {phase === 'preview' ? (
            <Pressable
              onPress={handleCapture}
              style={({ pressed }) => ({
                transform: [{ scale: pressed ? 0.94 : 1 }],
              })}
            >
              <Animated.View
                style={[
                  {
                    width: 78,
                    height: 78,
                    borderRadius: 39,
                    borderWidth: 3,
                    borderColor: 'rgba(255,255,255,0.9)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: ACCENT,
                    shadowOffset: { width: 0, height: 0 },
                    shadowRadius: 24,
                    elevation: 10,
                  },
                  captureGlowStyle,
                ]}
              >
                <View
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 30,
                    backgroundColor: ACCENT,
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: ACCENT,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.5,
                    shadowRadius: 10,
                    elevation: 6,
                  }}
                >
                  <Camera size={22} color="#FFFFFF" strokeWidth={2.2} />
                </View>
              </Animated.View>
            </Pressable>
          ) : (
            <View style={{ width: 78, height: 78 }} />
          )}
        </View>
      </View>
    </View>
  );
}
