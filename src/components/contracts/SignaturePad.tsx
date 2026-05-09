import React, { useCallback, useState } from "react";
import { View, Modal, Pressable, type LayoutChangeEvent } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { PenLine, X as XIcon } from "lucide-react-native";

import { useTheme } from "@/hooks/useTheme";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Point {
  x: number;
  y: number;
}

export interface SignaturePadProps {
  /** When true, the fullscreen signing sheet is presented. */
  visible: boolean;
  /** Called when the user dismisses without saving. */
  onClose: () => void;
  /** Called with the SVG document string when the user taps Done. */
  onSubmit: (svg: string) => void;
  /** Caption rendered under the signature line (e.g. "Client Signature"). */
  label?: string;
  /** Header title (e.g. "Agent" or "Client"). */
  title?: string;
  strokeColor?: string;
  strokeWidth?: number;
  backgroundColor?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pointsToSvgPath(points: Point[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const p = points[0];
    return `M ${p.x} ${p.y} L ${p.x} ${p.y}`;
  }
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    const midX = (current.x + next.x) / 2;
    const midY = (current.y + next.y) / 2;
    d += ` Q ${current.x} ${current.y} ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

function buildSvgDocument(
  paths: Point[][],
  width: number,
  height: number,
  strokeColor: string,
  strokeWidth: number,
): string {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const pathEls = paths
    .map(
      (pts) =>
        `<path d="${pointsToSvgPath(pts)}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${pathEls}</svg>`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SignaturePad({
  visible,
  onClose,
  onSubmit,
  label = "Client Signature",
  title,
  strokeColor,
  strokeWidth = 2.5,
  backgroundColor,
}: SignaturePadProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const resolvedStrokeColor = strokeColor ?? theme.textPrimary;
  const resolvedBgColor = backgroundColor ?? theme.surface;

  const [paths, setPaths] = useState<Point[][]>([]);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const [containerLayout, setContainerLayout] = useState<{
    width: number;
    height: number;
  }>({ width: 0, height: 0 });

  const hasSignature = paths.length > 0 || currentPath.length > 0;

  // Reset internal state every time the sheet opens so the user gets a fresh
  // canvas (saved SVGs live in the parent screen).
  React.useEffect(() => {
    if (visible) {
      setPaths([]);
      setCurrentPath([]);
    }
  }, [visible]);

  // Pulse animation for the empty-state hint.
  const pulseOpacity = useSharedValue(0.4);
  React.useEffect(() => {
    pulseOpacity.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [pulseOpacity]);
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .onStart((e) => {
      setCurrentPath([{ x: e.x, y: e.y }]);
    })
    .onUpdate((e) => {
      setCurrentPath((prev) => [...prev, { x: e.x, y: e.y }]);
    })
    .onEnd(() => {
      setCurrentPath((prev) => {
        if (prev.length > 0) {
          setPaths((existing) => [...existing, prev]);
        }
        return [];
      });
    });

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height: h } = e.nativeEvent.layout;
    setContainerLayout({ width, height: h });
  }, []);

  const handleClear = useCallback(() => {
    setPaths([]);
    setCurrentPath([]);
  }, []);

  const handleDone = useCallback(() => {
    const finalised = currentPath.length > 0 ? [...paths, currentPath] : paths;
    if (finalised.length === 0) return;
    const svg = buildSvgDocument(
      finalised,
      containerLayout.width,
      containerLayout.height,
      resolvedStrokeColor,
      strokeWidth,
    );
    onSubmit(svg);
  }, [
    paths,
    currentPath,
    containerLayout.width,
    containerLayout.height,
    resolvedStrokeColor,
    strokeWidth,
    onSubmit,
  ]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
          <StatusBar style="dark" />

          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingVertical: 12,
            }}
          >
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: theme.surfaceTertiary,
              }}
            >
              <XIcon size={20} color={theme.textPrimary} />
            </Pressable>
            <Text variant="titleMedium" style={{ fontWeight: "700" }}>
              {title ?? label}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Drawing area — fills the rest of the screen */}
          <View style={{ flex: 1, paddingHorizontal: 16, paddingBottom: 12 }}>
            <GestureDetector gesture={panGesture}>
              <View
                onLayout={handleLayout}
                style={{
                  flex: 1,
                  borderRadius: 16,
                  overflow: "hidden",
                  backgroundColor: resolvedBgColor,
                  borderWidth: 1,
                  borderColor: theme.border,
                }}
              >
                {containerLayout.width > 0 && containerLayout.height > 0 && (
                  <Svg
                    width={containerLayout.width}
                    height={containerLayout.height}
                    style={{ position: "absolute", top: 0, left: 0 }}
                  >
                    {paths.map((pts, idx) => (
                      <Path
                        key={`path-${idx}`}
                        d={pointsToSvgPath(pts)}
                        stroke={resolvedStrokeColor}
                        strokeWidth={strokeWidth}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ))}
                    {currentPath.length > 0 && (
                      <Path
                        d={pointsToSvgPath(currentPath)}
                        stroke={resolvedStrokeColor}
                        strokeWidth={strokeWidth}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                  </Svg>
                )}

                {!hasSignature && (
                  <View
                    pointerEvents="none"
                    style={{
                      ...StyleSheetAbsoluteFill,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Animated.View style={pulseStyle}>
                      <PenLine size={36} color={theme.textTertiary} />
                    </Animated.View>
                    <Text
                      variant="bodyMedium"
                      color={theme.textTertiary}
                      style={{ marginTop: 8 }}
                    >
                      Sign here
                    </Text>
                  </View>
                )}

                {/* Signature line + label */}
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    left: 24,
                    right: 24,
                    bottom: 24,
                    alignItems: "center",
                  }}
                >
                  <View
                    style={{
                      width: "70%",
                      height: 1,
                      backgroundColor: theme.border,
                    }}
                  />
                  <Text
                    variant="caption"
                    color={theme.textTertiary}
                    style={{ marginTop: 4 }}
                  >
                    {label}
                  </Text>
                </View>
              </View>
            </GestureDetector>
          </View>

          {/* Footer actions */}
          <View
            style={{
              flexDirection: "row",
              gap: 12,
              paddingHorizontal: 16,
              paddingTop: 8,
              paddingBottom: 12 + insets.bottom,
            }}
          >
            <Button
              variant="ghost"
              onPress={handleClear}
              disabled={!hasSignature}
            >
              Clear
            </Button>
            <View style={{ flex: 1 }}>
              <Button fullWidth disabled={!hasSignature} onPress={handleDone}>
                Done
              </Button>
            </View>
          </View>
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const StyleSheetAbsoluteFill = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};
