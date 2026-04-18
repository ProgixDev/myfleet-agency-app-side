import React, { useCallback, useRef, useState } from "react";
import { Dimensions, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolate,
  useAnimatedScrollHandler,
  runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { ArrowRight, ChevronRight } from "lucide-react-native";

import { useSettingsStore } from "@/stores/useSettingsStore";
import { fontFamilies } from "@/theme/typography";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const ACCENT = "#7C3AED";
const ACCENT_SOFT = "#A855F7";

const SLIDES = [
  {
    key: "screen1" as const,
    image: require("../../../assets/images/onb1.jpg"),
  },
  {
    key: "screen2" as const,
    image: require("../../../assets/images/onb2.jpg"),
  },
  {
    key: "screen3" as const,
    image: require("../../../assets/images/onb3.jpg"),
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const completeOnboarding = useSettingsStore((s) => s.completeOnboarding);
  const scrollRef = useRef<Animated.ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollX = useSharedValue(0);
  const textOpacity = useSharedValue(1);

  const updateIndex = useCallback(
    (idx: number) => {
      if (idx !== activeIndex) {
        textOpacity.value = withTiming(0, { duration: 150 }, () => {
          runOnJS(setActiveIndex)(idx);
          textOpacity.value = withTiming(1, { duration: 280 });
        });
      }
    },
    [activeIndex, textOpacity],
  );

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
    onMomentumEnd: (event) => {
      const idx = Math.round(event.contentOffset.x / SCREEN_WIDTH);
      runOnJS(updateIndex)(idx);
    },
  });

  const handleNext = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (activeIndex < SLIDES.length - 1) {
      const nextIndex = activeIndex + 1;
      scrollRef.current?.scrollTo({
        x: nextIndex * SCREEN_WIDTH,
        animated: true,
      });
      textOpacity.value = withTiming(0, { duration: 150 }, () => {
        runOnJS(setActiveIndex)(nextIndex);
        textOpacity.value = withTiming(1, { duration: 280 });
      });
    } else {
      completeOnboarding();
      router.replace("/(auth)/welcome");
    }
  }, [activeIndex, completeOnboarding, router, textOpacity]);

  const handleSkip = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    completeOnboarding();
    router.replace("/(auth)/welcome");
  }, [completeOnboarding, router]);

  const isLastSlide = activeIndex === SLIDES.length - 1;
  const currentSlide = SLIDES[activeIndex];

  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  return (
    <View style={{ flex: 1, backgroundColor: "#0A0510" }}>
      <StatusBar style="light" />

      {/* ── Image carousel (full-bleed) ─────────────────────────── */}
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        bounces={false}
        style={{ flex: 1 }}
      >
        {SLIDES.map((slide) => (
          <View
            key={slide.key}
            style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}
          >
            <Image
              source={slide.image}
              style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}
              contentFit="cover"
              transition={400}
            />
          </View>
        ))}
      </Animated.ScrollView>

      {/* ── Bottom gradient (keeps the text card legible on any image) ── */}
      <LinearGradient
        colors={[
          "transparent",
          "rgba(10, 5, 16, 0.35)",
          "rgba(10, 5, 16, 0.85)",
          "rgba(10, 5, 16, 1)",
        ]}
        locations={[0, 0.35, 0.7, 1]}
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: SCREEN_HEIGHT * 0.62,
        }}
        pointerEvents="none"
      />

      {/* ── Top bar: centered logo + skip pill on the right ─────── */}
      <View
        style={{
          position: "absolute",
          top: 60,
          left: 0,
          right: 0,
          alignItems: "center",
          zIndex: 10,
        }}
        pointerEvents="box-none"
      >
        <Animated.View entering={FadeIn.duration(500)}>
          <BlurView
            intensity={30}
            tint="dark"
            style={{
              alignItems: "center",
              justifyContent: "center",
              width: 48,
              height: 48,
              borderRadius: 9999,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.15)",
            }}
          >
            <Image
              source={require("../../../assets/images/logo.png")}
              style={{ width: 30, height: 30 }}
              contentFit="contain"
            />
          </BlurView>
        </Animated.View>
      </View>

      {!isLastSlide && (
        <Animated.View
          entering={FadeIn.duration(500)}
          style={{ position: "absolute", top: 66, right: 20, zIndex: 10 }}
        >
          <Pressable onPress={handleSkip} hitSlop={10}>
            <BlurView
              intensity={30}
              tint="dark"
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingLeft: 14,
                paddingRight: 10,
                paddingVertical: 8,
                borderRadius: 9999,
                overflow: "hidden",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.15)",
              }}
            >
              <Animated.Text
                style={{
                  fontFamily: fontFamilies.medium,
                  fontSize: 13,
                  color: "rgba(255, 255, 255, 0.9)",
                }}
              >
                {t("auth.onboarding.skip")}
              </Animated.Text>
              <ChevronRight
                size={14}
                color="rgba(255, 255, 255, 0.9)"
                strokeWidth={2}
              />
            </BlurView>
          </Pressable>
        </Animated.View>
      )}

      {/* ── Bottom glass card ──────────────────────────────────── */}
      <Animated.View
        entering={FadeInDown.duration(600).delay(150)}
        style={{
          position: "absolute",
          bottom: 40,
          left: 16,
          right: 16,
        }}
      >
        <View
          style={{
            borderRadius: 32,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.08)",
          }}
        >
          <BlurView
            intensity={50}
            tint="dark"
            style={{
              padding: 22,
              backgroundColor: "rgba(10, 5, 16, 0.55)",
            }}
          >
            {/* Step chip + pagination row */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                  borderRadius: 9999,
                  backgroundColor: "rgba(124, 58, 237, 0.2)",
                  borderWidth: 1,
                  borderColor: "rgba(124, 58, 237, 0.4)",
                }}
              >
                <Animated.Text
                  style={{
                    fontFamily: fontFamilies.semiBold,
                    fontSize: 11,
                    color: ACCENT_SOFT,
                    letterSpacing: 1,
                  }}
                >
                  {t("auth.onboarding.stepIndicator", {
                    current: String(activeIndex + 1).padStart(2, "0"),
                    total: String(SLIDES.length).padStart(2, "0"),
                  })}
                </Animated.Text>
              </View>

              <View style={{ flexDirection: "row", gap: 6 }}>
                {SLIDES.map((_, i) => (
                  <PaginationDot key={i} index={i} scrollX={scrollX} />
                ))}
              </View>
            </View>

            {/* Title + subtitle with fade transition */}
            <Animated.View style={textAnimatedStyle}>
              <Animated.Text
                style={{
                  fontFamily: fontFamilies.bold,
                  fontSize: 28,
                  lineHeight: 34,
                  color: "#FFFFFF",
                  marginBottom: 10,
                  letterSpacing: -0.5,
                }}
              >
                {t(`auth.onboarding.${currentSlide.key}.title`)}
              </Animated.Text>

              <Animated.Text
                style={{
                  fontFamily: fontFamilies.regular,
                  fontSize: 14,
                  lineHeight: 21,
                  color: "rgba(255, 255, 255, 0.7)",
                  marginBottom: 16,
                }}
              >
                {t(`auth.onboarding.${currentSlide.key}.subtitle`)}
              </Animated.Text>

              {/* Feature chips row */}
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 6,
                  marginBottom: 22,
                }}
              >
                {["chip1", "chip2", "chip3"].map((chipKey) => (
                  <View
                    key={chipKey}
                    style={{
                      paddingHorizontal: 11,
                      paddingVertical: 6,
                      borderRadius: 9999,
                      backgroundColor: "rgba(255, 255, 255, 0.08)",
                      borderWidth: 1,
                      borderColor: "rgba(255, 255, 255, 0.12)",
                    }}
                  >
                    <Animated.Text
                      style={{
                        fontFamily: fontFamilies.medium,
                        fontSize: 11,
                        color: "rgba(255, 255, 255, 0.85)",
                        letterSpacing: 0.2,
                      }}
                    >
                      {t(`auth.onboarding.${currentSlide.key}.${chipKey}`)}
                    </Animated.Text>
                  </View>
                ))}
              </View>
            </Animated.View>

            {/* CTA pill with accent icon circle + chevron trio */}
            <Pressable
              onPress={handleNext}
              style={({ pressed }) => ({
                opacity: pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "rgba(255, 255, 255, 0.08)",
                  borderRadius: 9999,
                  padding: 6,
                  paddingRight: 18,
                  borderWidth: 1,
                  borderColor: "rgba(124, 58, 237, 0.35)",
                }}
              >
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    backgroundColor: ACCENT,
                    alignItems: "center",
                    justifyContent: "center",
                    shadowColor: ACCENT,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.6,
                    shadowRadius: 12,
                    elevation: 8,
                  }}
                >
                  <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.2} />
                </View>
                <Animated.Text
                  style={{
                    flex: 1,
                    textAlign: "center",
                    fontFamily: fontFamilies.semiBold,
                    fontSize: 15,
                    color: "#FFFFFF",
                    letterSpacing: 0.3,
                    marginLeft: -42,
                  }}
                >
                  {isLastSlide
                    ? t("auth.onboarding.getStarted")
                    : t("auth.onboarding.next")}
                </Animated.Text>
                <View style={{ flexDirection: "row", gap: 2 }}>
                  <ChevronRight
                    size={14}
                    color="rgba(168, 85, 247, 0.5)"
                    strokeWidth={2.4}
                  />
                  <ChevronRight
                    size={14}
                    color="rgba(168, 85, 247, 0.75)"
                    strokeWidth={2.4}
                    style={{ marginLeft: -8 }}
                  />
                  <ChevronRight
                    size={14}
                    color={ACCENT_SOFT}
                    strokeWidth={2.4}
                    style={{ marginLeft: -8 }}
                  />
                </View>
              </View>
            </Pressable>
          </BlurView>
        </View>
      </Animated.View>
    </View>
  );
}

// ── Pagination Dot ──────────────────────────────────────────────────────────

function PaginationDot({
  index,
  scrollX,
}: {
  index: number;
  scrollX: { value: number };
}) {
  const style = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
    ];
    const width = interpolate(scrollX.value, inputRange, [6, 22, 6], "clamp");
    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0.3, 1, 0.3],
      "clamp",
    );

    return { width, opacity };
  });

  return (
    <Animated.View
      style={[
        {
          height: 6,
          borderRadius: 3,
          backgroundColor: ACCENT_SOFT,
        },
        style,
      ]}
    />
  );
}
