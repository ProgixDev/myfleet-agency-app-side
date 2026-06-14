import React from 'react';
import { ActivityIndicator, Pressable, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';

import { useTheme } from '@/hooks/useTheme';
import { shadows } from '@/theme/shadows';
import { Text } from './Text';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  onPress?: () => void;
  children: React.ReactNode;
  className?: string;
  testID?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SIZE_CONFIG = {
  sm: { height: 36, textVariant: 'bodySmall' as const, px: 14, iconSize: 14, gap: 4 },
  md: { height: 44, textVariant: 'bodyMedium' as const, px: 20, iconSize: 16, gap: 6 },
  lg: { height: 52, textVariant: 'bodyLarge' as const, px: 28, iconSize: 18, gap: 8 },
} as const;

// ── Component ────────────────────────────────────────────────────────────────

export function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  onPress,
  children,
  className,
  testID,
}: ButtonProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const sizeConfig = SIZE_CONFIG[size];

  const handlePressIn = () => {
    if (disabled || loading) return;
    scale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const handlePress = () => {
    if (disabled || loading) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  // -- Variant config -------------------------------------------------------

  const isGradient = variant === 'primary' || variant === 'danger';

  const gradientColors: [string, string] =
    variant === 'primary'
      ? [theme.accentGradientStart, theme.accentGradientEnd]
      : [theme.danger, '#F87171'];

  const getVariantStyles = (): {
    backgroundColor: string;
    borderColor: string;
    borderWidth: number;
    textColor: string;
    shadow: ViewStyle;
  } => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: 'transparent', // gradient handles bg
          borderColor: 'transparent',
          borderWidth: 0,
          textColor: '#FFFFFF',
          shadow: shadows.accent,
        };
      case 'secondary':
        return {
          backgroundColor: theme.surface,
          borderColor: theme.accent,
          borderWidth: 1.5,
          textColor: theme.accent,
          shadow: {},
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          borderColor: 'transparent',
          borderWidth: 0,
          textColor: theme.accent,
          shadow: {},
        };
      case 'danger':
        return {
          backgroundColor: 'transparent', // gradient handles bg
          borderColor: 'transparent',
          borderWidth: 0,
          textColor: '#FFFFFF',
          shadow: {},
        };
      case 'dark':
        return {
          backgroundColor: theme.navBar,
          borderColor: 'transparent',
          borderWidth: 0,
          textColor: '#FFFFFF',
          shadow: {},
        };
    }
  };

  const vs = getVariantStyles();

  // -- Content row ----------------------------------------------------------

  const renderContent = () => {
    const textColor = vs.textColor;

    if (loading) {
      return <ActivityIndicator size="small" color="#FFFFFF" />;
    }

    return (
      <>
        {LeftIcon && <LeftIcon size={sizeConfig.iconSize} color={textColor} />}
        <Text variant={sizeConfig.textVariant} color={textColor} className="font-semibold">
          {children}
        </Text>
        {RightIcon && <RightIcon size={sizeConfig.iconSize} color={textColor} />}
      </>
    );
  };

  // -- Layout ---------------------------------------------------------------

  const outerStyle: ViewStyle = {
    borderRadius: 9999,
    opacity: disabled ? 0.5 : loading ? 0.8 : 1,
    ...vs.shadow,
    ...(fullWidth && { width: '100%' as unknown as number }),
  };

  const innerContentStyle: ViewStyle = {
    height: sizeConfig.height,
    paddingHorizontal: sizeConfig.px,
    borderRadius: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sizeConfig.gap,
    backgroundColor: isGradient ? 'transparent' : vs.backgroundColor,
    borderColor: vs.borderColor,
    borderWidth: vs.borderWidth,
  };

  if (isGradient) {
    return (
      <AnimatedPressable
        style={[outerStyle, animatedStyle]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        disabled={disabled || loading}
        className={className}
        testID={testID}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            borderRadius: 9999,
            overflow: 'hidden',
          }}
        >
          <View style={innerContentStyle}>{renderContent()}</View>
        </LinearGradient>
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      style={[outerStyle, innerContentStyle, animatedStyle]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled || loading}
      className={className}
      testID={testID}
    >
      {renderContent()}
    </AnimatedPressable>
  );
}
