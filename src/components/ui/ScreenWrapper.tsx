import React from 'react';
import { ScrollView, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { useTheme } from '@/hooks/useTheme';
import { colors } from '@/theme/colors';

export interface ScreenWrapperProps {
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean; // default true, adds px-4
  children: React.ReactNode;
  className?: string;
}

export function ScreenWrapper({
  scroll = false,
  refreshing = false,
  onRefresh,
  padded = true,
  children,
  className,
}: ScreenWrapperProps) {
  const theme = useTheme();

  const isDark = theme.background === colors.dark.background;
  const statusBarStyle = isDark ? 'light' : 'dark';

  const paddingClass = padded ? 'px-4' : '';

  const content = (
    <View className={`flex-1 ${paddingClass} ${className ?? ''}`}>
      {children}
    </View>
  );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.background }}
    >
      <StatusBar style={statusBarStyle} />

      {scroll ? (
        <ScrollView
          bounces
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 110 }}
          refreshControl={
            onRefresh != null ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.accent}
              />
            ) : undefined
          }
        >
          {content}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, paddingBottom: 110 }}>{content}</View>
      )}
    </SafeAreaView>
  );
}
