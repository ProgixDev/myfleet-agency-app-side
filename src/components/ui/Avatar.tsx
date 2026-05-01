import React, { useMemo, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';

import { useTheme } from '@/hooks/useTheme';

export interface AvatarProps {
  source?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  online?: boolean;
  showRing?: boolean;
  className?: string;
}

const sizeMap: Record<NonNullable<AvatarProps['size']>, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 72,
};

const fontSizeMap: Record<NonNullable<AvatarProps['size']>, number> = {
  xs: 9,
  sm: 12,
  md: 14,
  lg: 20,
  xl: 26,
};

const onlineDotSizeMap: Record<NonNullable<AvatarProps['size']>, number> = {
  xs: 6,
  sm: 8,
  md: 10,
  lg: 14,
  xl: 16,
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export function Avatar({
  source,
  name,
  size = 'md',
  online,
  showRing = false,
  className = '',
}: AvatarProps) {
  const theme = useTheme();
  const dimension = sizeMap[size];
  const fontSize = fontSizeMap[size];
  const dotSize = onlineDotSizeMap[size];
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const initials = useMemo(
    () => (name ? getInitials(name) : ''),
    [name],
  );

  const ringWidth = 2;
  const outerDimension = showRing ? dimension + ringWidth * 2 : dimension;

  const showImage = source && !hasError;

  return (
    <View
      className={`items-center justify-center ${className}`}
      style={{
        width: outerDimension,
        height: outerDimension,
      }}
    >
      {/* Ring container */}
      <View
        className="rounded-full items-center justify-center overflow-hidden"
        style={{
          width: outerDimension,
          height: outerDimension,
          borderWidth: showRing ? ringWidth : 0,
          borderColor: showRing ? theme.accent : 'transparent',
        }}
      >
        {/* Loading placeholder (shown behind image while loading) */}
        {isLoading && showImage && (
          <View
            className="absolute items-center justify-center rounded-full"
            style={{
              width: dimension,
              height: dimension,
              backgroundColor: theme.surfaceSecondary,
            }}
          >
            <ActivityIndicator size="small" color={theme.accent} />
          </View>
        )}

        {/* Image or initials */}
        {showImage ? (
          <Image
            source={{ uri: source }}
            style={{
              width: dimension,
              height: dimension,
              borderRadius: dimension / 2,
            }}
            contentFit="cover"
            transition={200}
            onLoadStart={() => setIsLoading(true)}
            onLoadEnd={() => setIsLoading(false)}
            onError={() => {
              setHasError(true);
              setIsLoading(false);
            }}
          />
        ) : (
          <View
            className="items-center justify-center rounded-full"
            style={{
              width: dimension,
              height: dimension,
              backgroundColor: theme.accent,
            }}
          >
            <Text
              style={{
                fontFamily: 'Poppins_600SemiBold',
                fontSize,
                color: '#FFFFFF',
                lineHeight: fontSize * 1.3,
              }}
            >
              {initials}
            </Text>
          </View>
        )}
      </View>

      {/* Online indicator */}
      {online !== undefined ? (
        <View
          className="absolute rounded-full"
          style={{
            width: dotSize,
            height: dotSize,
            backgroundColor: online ? theme.success : theme.textTertiary,
            borderWidth: 2,
            borderColor: theme.surface,
            bottom: 0,
            right: 0,
          }}
        />
      ) : null}
    </View>
  );
}
