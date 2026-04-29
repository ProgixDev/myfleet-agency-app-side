import React, { useState, useCallback } from 'react';
import {
  TextInput,
  View,
  Text,
  Pressable,
  type KeyboardTypeOptions,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Eye, EyeOff, Search, type LucideIcon } from 'lucide-react-native';

import { useTheme } from '@/hooks/useTheme';

// ── Types ────────────────────────────────────────────────────────────────────

export interface InputProps {
  variant?: 'default' | 'search' | 'password';
  label?: string;
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  error?: string;
  helperText?: string;
  disabled?: boolean;
  secureTextEntry?: boolean;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  className?: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const AnimatedView = Animated.createAnimatedComponent(View);

// ── Component ────────────────────────────────────────────────────────────────

export function Input({
  variant = 'default',
  label,
  placeholder,
  value,
  onChangeText,
  error,
  helperText,
  disabled = false,
  secureTextEntry: secureTextEntryProp = false,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  className = '',
  multiline = false,
  keyboardType,
  maxLength,
  autoCapitalize,
}: InputProps) {
  const theme = useTheme();
  const isPassword = variant === 'password' || secureTextEntryProp;
  const isSearch = variant === 'search';
  const ResolvedLeftIcon = isSearch ? Search : LeftIcon;
  const [hidePassword, setHidePassword] = useState(isPassword);
  const [isFocused, setIsFocused] = useState(false);
  const focusProgress = useSharedValue(0);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    focusProgress.value = withTiming(1, { duration: 200 });
  }, [focusProgress]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    focusProgress.value = withTiming(0, { duration: 200 });
  }, [focusProgress]);

  const animatedContainerStyle = useAnimatedStyle(() => {
    if (error) {
      return {
        borderWidth: 2,
        borderColor: theme.danger,
      };
    }

    return {
      borderWidth: focusProgress.value * 2,
      borderColor: theme.accent,
    };
  });

  const toggleSecureEntry = useCallback(() => {
    setHidePassword((prev) => !prev);
  }, []);

  const iconColor = error ? theme.danger : isFocused ? theme.accent : theme.textTertiary;

  const bottomText = error ?? helperText;
  const bottomTextColor = error ? theme.danger : theme.textTertiary;

  return (
    <View className={className} style={{ opacity: disabled ? 0.5 : 1 }}>
      {label ? (
        <Text
          style={{
            fontFamily: 'Poppins_500Medium',
            fontSize: 12,
            color: theme.textSecondary,
            marginBottom: 6,
          }}
        >
          {label}
        </Text>
      ) : null}

      <AnimatedView
        style={[
          animatedContainerStyle,
          {
            backgroundColor: theme.surfaceTertiary,
            borderRadius: 16,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 14,
            minHeight: multiline ? 96 : 48,
          },
        ]}
      >
        {ResolvedLeftIcon ? (
          <ResolvedLeftIcon
            size={18}
            color={iconColor}
            style={{ marginRight: 10 }}
          />
        ) : null}

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textTertiary}
          secureTextEntry={hidePassword}
          editable={!disabled}
          multiline={multiline}
          keyboardType={keyboardType}
          maxLength={maxLength}
          autoCapitalize={autoCapitalize}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={{
            flex: 1,
            fontFamily: 'Poppins_400Regular',
            fontSize: 14,
            color: theme.textPrimary,
            paddingVertical: 12,
            textAlignVertical: multiline ? 'top' : 'center',
          }}
        />

        {isPassword ? (
          <Pressable onPress={toggleSecureEntry} hitSlop={8}>
            {hidePassword ? (
              <EyeOff size={18} color={iconColor} />
            ) : (
              <Eye size={18} color={iconColor} />
            )}
          </Pressable>
        ) : RightIcon ? (
          <RightIcon size={18} color={iconColor} />
        ) : null}
      </AnimatedView>

      {bottomText ? (
        <Text
          style={{
            fontFamily: 'Poppins_400Regular',
            fontSize: 12,
            color: bottomTextColor,
            marginTop: 4,
          }}
        >
          {bottomText}
        </Text>
      ) : null}
    </View>
  );
}
