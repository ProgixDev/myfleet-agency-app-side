import React from "react";
import { View, Pressable, Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import {
  FileText,
  AlertTriangle,
  Users,
  Receipt,
  BarChart3,
  QrCode,
  Settings,
  Bell,
  LogOut,
  ChevronRight,
} from "lucide-react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import type { LucideIcon } from "lucide-react-native";

import { ScreenWrapper } from "@/components/ui/ScreenWrapper";
import { Text } from "@/components/ui/Text";
import { Avatar } from "@/components/ui/Avatar";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/stores/useAuthStore";
import { fontFamilies } from "@/theme/typography";

interface MenuItem {
  icon: LucideIcon;
  label: string;
  color: string;
  bg: string;
  onPress: () => void;
}

interface MenuGroup {
  titleKey: string;
  fallback: string;
  items: MenuItem[];
}

export default function MoreScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const go = (path: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(path as never);
  };

  const groups: MenuGroup[] = [
    {
      titleKey: "more.groups.operations",
      fallback: "Opérations",
      items: [
        {
          icon: FileText,
          label: t("more.contracts", { defaultValue: "Contrats" }),
          color: theme.accent,
          bg: theme.accentSoft,
          onPress: () => go("/(app)/(more)/contracts"),
        },
        {
          icon: AlertTriangle,
          label: t("more.violations", { defaultValue: "Infractions" }),
          color: theme.warning,
          bg: theme.warningSoft,
          onPress: () => go("/(app)/(more)/violations"),
        },
        {
          icon: Users,
          label: t("more.clients", { defaultValue: "Clients" }),
          color: theme.info,
          bg: theme.infoSoft,
          onPress: () => go("/(app)/(more)/clients"),
        },
        {
          icon: Receipt,
          label: t("more.billing", { defaultValue: "Facturation" }),
          color: theme.success,
          bg: theme.successSoft,
          onPress: () => go("/(app)/(more)/billing"),
        },
      ],
    },
    {
      titleKey: "more.groups.tools",
      fallback: "Outils",
      items: [
        {
          icon: BarChart3,
          label: t("more.analytics", { defaultValue: "Analytique" }),
          color: theme.accent,
          bg: theme.accentSoft,
          onPress: () => go("/(app)/(more)/analytics"),
        },
        {
          icon: Bell,
          label: t("more.notifications", { defaultValue: "Notifications" }),
          color: theme.accent,
          bg: theme.accentSoft,
          onPress: () => go("/(app)/(more)/notifications"),
        },
        {
          icon: QrCode,
          label: t("more.qrCode", { defaultValue: "Mon QR Code" }),
          color: theme.accent,
          bg: theme.accentSoft,
          onPress: () => go("/(app)/(more)/agency-qr"),
        },
      ],
    },
    {
      titleKey: "more.groups.account",
      fallback: "Compte",
      items: [
        {
          icon: Settings,
          label: t("more.settings", { defaultValue: "Paramètres" }),
          color: theme.accent,
          bg: theme.accentSoft,
          onPress: () => go("/(app)/(more)/settings"),
        },
      ],
    },
  ];

  const userName = user?.name ?? "Agent Fleet";
  const userRoleLabel =
    user?.role === "admin"
      ? t("more.roleAdmin", { defaultValue: "Administrateur" })
      : t("more.roleAgent", { defaultValue: "Agent" });

  return (
    <ScreenWrapper scroll padded={false}>
      {/* ── Header ─────────────────────────────────────────── */}
      <Animated.View
        entering={FadeInDown.duration(350)}
        className="px-4 pt-3 pb-3"
      >
        <Text
          variant="titleLarge"
          style={{ fontFamily: fontFamilies.bold, fontSize: 20 }}
        >
          {t("more.title", { defaultValue: "Plus" })}
        </Text>
      </Animated.View>

      {/* ── Profile card ───────────────────────────────────── */}
      <Animated.View
        entering={FadeInDown.delay(60).duration(350)}
        className="px-4"
      >
        <Pressable
          onPress={() => go("/(app)/(more)/settings/profile")}
          style={({ pressed }) => ({
            backgroundColor: theme.surface,
            borderRadius: 18,
            padding: 14,
            borderWidth: 1,
            borderColor: theme.borderLight,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            transform: [{ scale: pressed ? 0.99 : 1 }],
          })}
        >
          <Avatar name={userName} source={user?.avatar} size="md" />
          <View style={{ flex: 1 }}>
            <Text
              variant="titleMedium"
              style={{ fontFamily: fontFamilies.semiBold, fontSize: 14 }}
              numberOfLines={1}
            >
              {userName}
            </Text>
            <View className="flex-row items-center mt-1" style={{ gap: 6 }}>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 9999,
                  backgroundColor: theme.accentSoft,
                }}
              >
                <Text
                  variant="labelSmall"
                  color={theme.accent}
                  style={{
                    fontFamily: fontFamilies.semiBold,
                    fontSize: 10,
                    letterSpacing: 0.3,
                  }}
                >
                  {userRoleLabel}
                </Text>
              </View>
              {user?.email && (
                <Text
                  variant="caption"
                  color={theme.textTertiary}
                  style={{ fontSize: 11 }}
                  numberOfLines={1}
                >
                  {user.email}
                </Text>
              )}
            </View>
          </View>
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: theme.surfaceTertiary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ChevronRight
              size={14}
              color={theme.textTertiary}
              strokeWidth={2.2}
            />
          </View>
        </Pressable>
      </Animated.View>

      {/* ── Menu groups ────────────────────────────────────── */}
      {groups.map((group, gIdx) => (
        <Animated.View
          key={group.titleKey}
          entering={FadeInDown.delay(120 + gIdx * 60).duration(350)}
          style={{ marginTop: 18 }}
        >
          <View className="px-4 mb-2">
            <Text
              variant="bodySmall"
              color={theme.textTertiary}
              style={{
                fontFamily: fontFamilies.medium,
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              {t(group.titleKey, { defaultValue: group.fallback })}
            </Text>
          </View>
          <View className="px-4">
            <View
              style={{
                backgroundColor: theme.surface,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: theme.borderLight,
                overflow: "hidden",
              }}
            >
              {group.items.map((item, idx) => {
                const Icon = item.icon;
                const isLast = idx === group.items.length - 1;
                return (
                  <Pressable
                    key={item.label}
                    onPress={item.onPress}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                      borderBottomWidth: isLast ? 0 : 0.5,
                      borderBottomColor: theme.border,
                      backgroundColor: pressed
                        ? theme.surfaceTertiary
                        : "transparent",
                    })}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 12,
                        backgroundColor: item.bg,
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 12,
                      }}
                    >
                      <Icon
                        size={18}
                        color={item.color}
                        strokeWidth={2}
                      />
                    </View>
                    <Text
                      variant="bodyMedium"
                      style={{
                        flex: 1,
                        fontFamily: fontFamilies.medium,
                        fontSize: 14,
                      }}
                    >
                      {item.label}
                    </Text>
                    <View
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 13,
                        backgroundColor: theme.surfaceTertiary,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <ChevronRight
                        size={13}
                        color={theme.textTertiary}
                        strokeWidth={2.2}
                      />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Animated.View>
      ))}

      {/* ── Logout ─────────────────────────────────────────── */}
      <Animated.View
        entering={FadeInDown.delay(320).duration(350)}
        style={{ marginTop: 18 }}
      >
        <View className="px-4">
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              Alert.alert(
                t("more.logoutConfirmTitle", { defaultValue: "Se déconnecter ?" }),
                t("more.logoutConfirmMessage", {
                  defaultValue:
                    "Vous serez redirigé vers l'écran d'accueil.",
                }),
                [
                  {
                    text: t("common.cancel", { defaultValue: "Annuler" }),
                    style: "cancel",
                  },
                  {
                    text: t("more.logout", { defaultValue: "Se déconnecter" }),
                    style: "destructive",
                    onPress: () => {
                      logout();
                      router.replace("/(auth)/welcome");
                    },
                  },
                ],
              );
            }}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              paddingVertical: 14,
              borderRadius: 18,
              backgroundColor: theme.dangerSoft,
              borderWidth: 1,
              borderColor: "rgba(239, 68, 68, 0.25)",
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <LogOut size={17} color={theme.danger} strokeWidth={2} />
            <Text
              variant="bodyMedium"
              color={theme.danger}
              style={{ fontFamily: fontFamilies.semiBold, fontSize: 14 }}
            >
              {t("more.logout", { defaultValue: "Se déconnecter" })}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </ScreenWrapper>
  );
}
