import React, { useCallback, useMemo } from "react";
import { View, Pressable, SectionList } from "react-native";
import { useRouter } from "expo-router";
import {
  ChevronLeft,
  BellOff,
  Calendar,
  Clock,
  AlertTriangle,
  ScanLine,
  AlertCircle,
  CreditCard,
  Wrench,
  FileText,
  Megaphone,
} from "lucide-react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import type { LucideIcon } from "lucide-react-native";

import { ScreenWrapper } from "@/components/ui/ScreenWrapper";
import { Text } from "@/components/ui/Text";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@/hooks/useNotifications";
import type { AppNotification, NotificationType } from "@/types/notification";

// ── Icon / color mapping ────────────────────────────────────────────────────

interface NotificationStyle {
  icon: LucideIcon;
  colorKey: "info" | "warning" | "danger" | "success" | "accent";
}

const NOTIFICATION_STYLES: Record<NotificationType, NotificationStyle> = {
  booking_reminder: { icon: Calendar, colorKey: "info" },
  return_due: { icon: Clock, colorKey: "warning" },
  return_overdue: { icon: AlertTriangle, colorKey: "danger" },
  inspection_required: { icon: ScanLine, colorKey: "warning" },
  violation_received: { icon: AlertCircle, colorKey: "danger" },
  payment_received: { icon: CreditCard, colorKey: "success" },
  payment_overdue: { icon: CreditCard, colorKey: "danger" },
  maintenance_due: { icon: Wrench, colorKey: "warning" },
  contract_pending: { icon: FileText, colorKey: "accent" },
  marketing_campaign: { icon: Megaphone, colorKey: "info" },
};

// ── Date grouping ───────────────────────────────────────────────────────────

function getDateGroup(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0 && now.getDate() === date.getDate()) return "Aujourd'hui";
  if (diffDays <= 1 && now.getDate() - date.getDate() === 1) return "Hier";
  if (diffDays <= 7) return "Cette semaine";
  return "Plus ancien";
}

function getTimeAgo(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return "A l'instant";
  if (diffMinutes < 60) return `Il y a ${diffMinutes}min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays === 1) return "Hier";
  return `Il y a ${diffDays}j`;
}

const GROUP_ORDER = ["Aujourd'hui", "Hier", "Cette semaine", "Plus ancien"];

// ── Component ───────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { data: notifications = [] } = useNotifications();
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();

  const markAsRead = useCallback(
    (id: string) => {
      markReadMutation.mutate(id);
    },
    [markReadMutation],
  );

  const markAllAsRead = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    markAllReadMutation.mutate();
  }, [markAllReadMutation]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const sections = useMemo(() => {
    const grouped: Record<string, AppNotification[]> = {};
    notifications.forEach((n) => {
      const group = getDateGroup(n.timestamp);
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push(n);
    });

    return GROUP_ORDER.filter(
      (title) => grouped[title] && grouped[title].length > 0,
    ).map((title) => ({
      title,
      data: grouped[title].sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      ),
    }));
  }, [notifications]);

  const handleNotificationPress = useCallback(
    (notification: AppNotification) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      markAsRead(notification.id);
      if (notification.targetRoute && notification.targetId) {
        router.push(
          notification.targetRoute.replace(
            "[id]",
            notification.targetId,
          ) as never,
        );
      }
    },
    [markAsRead, router],
  );

  if (notifications.length === 0) {
    return (
      <ScreenWrapper>
        <View className="flex-row items-center pt-6 pb-4">
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            className="mr-3"
          >
            <ChevronLeft size={24} color={theme.textPrimary} strokeWidth={2} />
          </Pressable>
          <Text variant="headlineLarge" className="flex-1">
            Notifications
          </Text>
        </View>
        <EmptyState
          icon={BellOff}
          title="Aucune notification"
          subtitle="Vous n'avez aucune notification pour le moment."
          className="flex-1 pb-20"
        />
      </ScreenWrapper>
    );
  }

  const renderNotification = ({
    item,
    index,
  }: {
    item: AppNotification;
    index: number;
  }) => {
    const isRead = item.read;
    const style = NOTIFICATION_STYLES[item.type];
    const Icon = style.icon;
    const colorMap = {
      info: theme.info,
      warning: theme.warning,
      danger: theme.danger,
      success: theme.success,
      accent: theme.accent,
    };
    const bgColorMap = {
      info: theme.infoSoft,
      warning: theme.warningSoft,
      danger: theme.dangerSoft,
      success: theme.successSoft,
      accent: theme.accentSoft,
    };
    const iconColor = colorMap[style.colorKey];
    const iconBg = bgColorMap[style.colorKey];

    return (
      <Animated.View entering={FadeInDown.duration(300).delay(index * 30)}>
        <Pressable
          onPress={() => handleNotificationPress(item)}
          className="flex-row py-3 px-3 mb-1 rounded-xl"
          style={{
            backgroundColor: theme.surface,
            borderLeftWidth: isRead ? 0 : 3,
            borderLeftColor: isRead ? "transparent" : theme.accent,
          }}
        >
          <View
            style={{ backgroundColor: iconBg }}
            className="rounded-full p-2 mr-3 mt-0.5"
          >
            <Icon size={18} color={iconColor} strokeWidth={2} />
          </View>
          <View className="flex-1">
            <Text variant="titleMedium" className={isRead ? "" : "font-bold"}>
              {item.title}
            </Text>
            <Text
              variant="bodySmall"
              color={theme.textSecondary}
              numberOfLines={2}
              className="mt-0.5"
            >
              {item.description}
            </Text>
            <Text variant="caption" color={theme.textTertiary} className="mt-1">
              {getTimeAgo(item.timestamp)}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <ScreenWrapper>
      {/* Header */}
      <Animated.View
        entering={FadeInDown.duration(400)}
        className="flex-row items-center pt-6 pb-2"
      >
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          className="mr-3"
        >
          <ChevronLeft size={24} color={theme.textPrimary} strokeWidth={2} />
        </Pressable>
        <Text variant="headlineLarge" className="flex-1">
          Notifications
        </Text>
        {unreadCount > 0 && (
          <Badge variant="accent" size="sm" className="mr-3">
            {unreadCount}
          </Badge>
        )}
      </Animated.View>

      {/* The Activity tab was removed: it rendered a hardcoded array from
          src/data/dashboard.ts, and there is no activity endpoint on the
          backend to replace it with. Showing invented history to a real agency
          is both misleading and an App Review 2.1 risk (placeholder content
          presented as real). Notifications below are real server data. If an
          activity feed is wanted later it needs a backend endpoint first, and
          the toggle can come back with it. */}
      <>
        {unreadCount > 0 && (
          <Animated.View
            entering={FadeInDown.duration(400).delay(60)}
            className="mb-3"
          >
            <Pressable onPress={markAllAsRead}>
              <Text variant="titleMedium" color={theme.accent}>
                Tout marquer lu
              </Text>
            </Pressable>
          </Animated.View>
        )}

        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderNotification}
          renderSectionHeader={({ section }) => (
            <View className="pt-3 pb-1.5">
              <Text variant="titleSmall" color={theme.textTertiary}>
                {section.title}
              </Text>
            </View>
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}
          stickySectionHeadersEnabled={false}
        />
      </>
    </ScreenWrapper>
  );
}
