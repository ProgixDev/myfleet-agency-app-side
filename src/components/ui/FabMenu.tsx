import React, { useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { CalendarPlus, Plus, ScanLine, UserPlus, X } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";

import { Text } from "@/components/ui/Text";
import { useTheme } from "@/hooks/useTheme";
import { fontFamilies } from "@/theme/typography";

// ── Public component ─────────────────────────────────────────────────────────

export function FabMenu() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [open, setOpen] = useState(false);
  const rotation = useSharedValue(0);

  const toggle = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (open) {
      rotation.value = withSpring(0, { damping: 14, stiffness: 260 });
      setOpen(false);
    } else {
      rotation.value = withTiming(45, { duration: 180 });
      setOpen(true);
    }
  };

  const close = () => {
    rotation.value = withSpring(0, { damping: 14, stiffness: 260 });
    setOpen(false);
  };

  const go = (path: string) => {
    close();
    setTimeout(() => router.push(path as never), 120);
  };

  const plusStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  // Position the FAB well above the floating tab bar — leaves visible breathing
  // room between the + circle and the top edge of the capsule.
  // Tab bar capsule sits at `Math.max(insets.bottom, 14)` and is ~76px tall
  // (40 icon box + label + padding); we add ~28px of air on top of that.
  const fabBottom = Math.max(insets.bottom, 14) + 104;

  return (
    <>
      {/* FAB button */}
      <View
        style={{
          position: "absolute",
          right: 18,
          bottom: fabBottom,
        }}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={toggle}
          style={({ pressed }) => ({
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: theme.accent,
            alignItems: "center",
            justifyContent: "center",
            transform: [{ scale: pressed ? 0.94 : 1 }],
            shadowColor: theme.accent,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.35,
            shadowRadius: 16,
            elevation: 10,
          })}
        >
          <Animated.View style={plusStyle}>
            <Plus size={26} color="#FFFFFF" strokeWidth={2.4} />
          </Animated.View>
        </Pressable>
      </View>

      {/* Action sheet modal */}
      <Modal
        visible={open}
        transparent
        animationType="none"
        onRequestClose={close}
      >
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(180)}
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.45)",
          }}
        >
          <Pressable style={{ flex: 1 }} onPress={close} />

          <Animated.View
            entering={FadeInDown.duration(240)}
            style={{
              position: "absolute",
              right: 18,
              bottom: fabBottom + 68,
              gap: 10,
              alignItems: "flex-end",
            }}
          >
            <ActionRow
              icon={ScanLine}
              label={t("dashboard.fab.newInspection")}
              onPress={() => go("/(app)/(inspections)/new")}
              theme={theme}
            />
            <ActionRow
              icon={CalendarPlus}
              label={t("dashboard.fab.newBooking")}
              onPress={() => go("/(app)/(bookings)/new")}
              theme={theme}
            />
            <ActionRow
              icon={UserPlus}
              label={t("dashboard.fab.newClient")}
              onPress={() => go("/(app)/(more)/clients/new")}
              theme={theme}
            />
          </Animated.View>

          {/* Close hint — a small X chip above the FAB location */}
          <View
            style={{
              position: "absolute",
              right: 18,
              bottom: fabBottom,
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: theme.accent,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: theme.accent,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.35,
              shadowRadius: 16,
              elevation: 10,
            }}
          >
            <Pressable
              onPress={close}
              hitSlop={10}
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={24} color="#FFFFFF" strokeWidth={2.4} />
            </Pressable>
          </View>
        </Animated.View>
      </Modal>
    </>
  );
}

// ── Action row ───────────────────────────────────────────────────────────────

interface ActionRowProps {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}

function ActionRow({ icon: Icon, label, onPress, theme }: ActionRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        opacity: pressed ? 0.85 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <View
        style={{
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 9999,
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.borderLight,
        }}
      >
        <Text
          variant="bodySmall"
          style={{
            fontFamily: fontFamilies.semiBold,
            color: theme.textPrimary,
          }}
        >
          {label}
        </Text>
      </View>
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.borderLight,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={20} color={theme.accent} strokeWidth={2} />
      </View>
    </Pressable>
  );
}
