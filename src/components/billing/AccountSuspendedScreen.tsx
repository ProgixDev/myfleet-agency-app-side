import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Ban, RefreshCw, LogOut } from "lucide-react-native";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { useTheme } from "@/hooks/useTheme";
import { fontFamilies } from "@/theme/typography";
import { useAuthStore } from "@/stores/useAuthStore";

/**
 * Full-screen gate shown over the (app) area when a platform operator has
 * suspended the agency (backend returns 403 with code AGENCY_SUSPENDED). It is
 * intentionally neutral — it states the account is suspended and offers
 * "refresh status" (re-check after reactivation) and "log out". No external CTA.
 */
export function AccountSuspendedScreen({
  onRefresh,
  refreshing,
}: {
  onRefresh: () => void;
  refreshing?: boolean;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const logout = useAuthStore((s) => s.logout);

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: theme.background,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 24,
          justifyContent: "center",
          gap: 28,
        },
      ]}
      accessibilityLabel="account-suspended"
      testID="account-suspended"
    >
      <View style={{ alignItems: "center", gap: 16 }}>
        <View
          style={{
            width: 76,
            height: 76,
            borderRadius: 38,
            backgroundColor: theme.dangerSoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ban size={34} color={theme.danger} />
        </View>
        <Text
          variant="titleLarge"
          align="center"
          style={{ fontFamily: fontFamilies.bold }}
        >
          {t("suspended.title", "Account suspended")}
        </Text>
        <Text
          variant="bodyMedium"
          color={theme.textSecondary}
          align="center"
          style={{ lineHeight: 21 }}
        >
          {t(
            "suspended.message",
            "This agency account has been suspended. Please contact MyFleet support to restore access.",
          )}
        </Text>
      </View>

      <View style={{ gap: 12 }}>
        <Button
          variant="primary"
          fullWidth
          size="lg"
          leftIcon={RefreshCw}
          loading={refreshing}
          onPress={onRefresh}
          testID="suspended-refresh-button"
          accessibilityLabel={t("paywall.refresh", "Refresh status")}
        >
          {t("paywall.refresh", "Refresh status")}
        </Button>
        <Pressable
          onPress={() => void logout()}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            paddingVertical: 10,
          }}
          accessibilityRole="button"
          accessibilityLabel={t("paywall.logout", "Log out")}
          testID="suspended-logout-button"
        >
          <LogOut size={16} color={theme.textSecondary} />
          <Text variant="bodyMedium" color={theme.textSecondary}>
            {t("paywall.logout", "Log out")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
