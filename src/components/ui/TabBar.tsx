import React, { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  FadeInDown,
  FadeOutDown,
  LinearTransition,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';

import { useTheme } from '@/hooks/useTheme';
import { fontFamilies } from '@/theme/typography';
import { useStickyCtaStore } from '@/stores/useStickyCtaStore';

// ── Types ────────────────────────────────────────────────────────────────────

export interface TabItem {
  name: string;
  label: string;
  icon: LucideIcon;
}

export interface TabBarProps {
  tabs: TabItem[];
  activeTab: string;
  onTabPress: (name: string) => void;
}

// ── Single Tab ───────────────────────────────────────────────────────────────

interface TabButtonProps {
  tab: TabItem;
  isActive: boolean;
  onPress: () => void;
}

function TabButton({ tab, isActive, onPress }: TabButtonProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const indicator = useSharedValue(isActive ? 1 : 0);

  useEffect(() => {
    indicator.value = withTiming(isActive ? 1 : 0, { duration: 250 });
    scale.value = withSpring(isActive ? 1.04 : 1, {
      damping: 14,
      stiffness: 260,
    });
  }, [isActive, indicator, scale]);

  const circleStyle = useAnimatedStyle(() => ({
    opacity: indicator.value,
    transform: [{ scale: 0.6 + indicator.value * 0.4 }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const Icon = tab.icon;
  const inactiveIconColor = theme.textSecondary;
  const activeIconColor = '#FFFFFF';

  return (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      hitSlop={8}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Animated.View
          style={[
            circleStyle,
            {
              position: 'absolute',
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: theme.accent,
              shadowColor: theme.accent,
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.35,
              shadowRadius: 8,
              elevation: 4,
            },
          ]}
        />
        <Animated.View style={iconStyle}>
          <Icon
            size={20}
            color={isActive ? activeIconColor : inactiveIconColor}
            strokeWidth={isActive ? 2.2 : 1.8}
          />
        </Animated.View>
      </View>

      <Animated.Text
        style={{
          fontFamily: isActive ? fontFamilies.semiBold : fontFamilies.regular,
          fontSize: 10,
          color: isActive ? theme.accent : theme.textTertiary,
          marginTop: 2,
          letterSpacing: 0.2,
        }}
        numberOfLines={1}
      >
        {tab.label}
      </Animated.Text>
    </Pressable>
  );
}

// ── Sticky CTA row (docks on top of the tab buttons within the same shell) ──

function StickyCtaRow() {
  const theme = useTheme();
  const cta = useStickyCtaStore((s) => s.cta);
  if (!cta) return null;

  const variant = cta.variant ?? 'primary';
  const bg =
    variant === 'secondary'
      ? theme.surfaceTertiary
      : variant === 'danger'
        ? theme.danger
        : theme.accent;
  const fg =
    variant === 'secondary' ? theme.textPrimary : '#FFFFFF';

  const LeftIcon = cta.leftIcon;
  const RightIcon = cta.rightIcon;

  return (
    <Animated.View
      entering={FadeInDown.duration(260).springify()}
      exiting={FadeOutDown.duration(200)}
      style={{
        paddingHorizontal: 4,
        paddingTop: 4,
        paddingBottom: 6,
      }}
    >
      <Pressable
        onPress={() => {
          if (cta.disabled) return;
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          cta.onPress();
        }}
        disabled={cta.disabled}
        style={({ pressed }) => ({
          height: 48,
          borderRadius: 9999,
          backgroundColor: bg,
          opacity: cta.disabled ? 0.5 : 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          transform: [{ scale: pressed && !cta.disabled ? 0.98 : 1 }],
        })}
      >
        {LeftIcon && <LeftIcon size={18} color={fg} strokeWidth={2.2} />}
        <Animated.Text
          style={{
            color: fg,
            fontFamily: fontFamilies.semiBold,
            fontSize: 15,
            letterSpacing: 0.2,
          }}
          numberOfLines={1}
        >
          {cta.label}
        </Animated.Text>
        {RightIcon && <RightIcon size={18} color={fg} strokeWidth={2.2} />}
      </Pressable>
    </Animated.View>
  );
}

// ── Tab Bar (floating container — expands when CTA is present) ──────────────

export function TabBar({ tabs, activeTab, onTabPress }: TabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const hasCta = useStickyCtaStore((s) => s.cta !== null);

  return (
    <View
      style={{
        position: 'absolute',
        bottom: Math.max(insets.bottom, 14),
        left: 14,
        right: 14,
      }}
      pointerEvents="box-none"
    >
      <Animated.View
        layout={LinearTransition.duration(220)}
        style={{
          backgroundColor: theme.surface,
          borderRadius: hasCta ? 26 : 9999,
          borderWidth: 1,
          borderColor: theme.borderLight,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.12,
          shadowRadius: 20,
          elevation: 12,
          overflow: 'hidden',
        }}
      >
        <StickyCtaRow />
        <View
          style={{
            flexDirection: 'row',
            paddingHorizontal: 8,
            paddingVertical: 8,
          }}
        >
          {tabs.map((tab) => (
            <TabButton
              key={tab.name}
              tab={tab}
              isActive={activeTab === tab.name}
              onPress={() => onTabPress(tab.name)}
            />
          ))}
        </View>
      </Animated.View>
    </View>
  );
}
