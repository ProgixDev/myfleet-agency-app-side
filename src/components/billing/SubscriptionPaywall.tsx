import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Sparkles, RefreshCw, LogOut } from "lucide-react-native";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { useTheme } from "@/hooks/useTheme";
import { fontFamilies } from "@/theme/typography";
import { useAuthStore } from "@/stores/useAuthStore";

/**
 * Full-screen gate shown over the (app) area when the agency has no active
 * subscription. Subscriptions are managed entirely on the web back-office.
 *
 * This gate is intentionally NEUTRAL to stay within Apple's App Store rules
 * (Guideline 3.1.1 anti-steering + the "free companion app" exemption): it must
 * not show prices, a "Subscribe" button, or any link/CTA to an external
 * purchase page. It only states the account is inactive and offers
 * "refresh status" (re-check after the agency activates on the web) and
 * "log out". Do not re-add an in-app purchase/subscribe call-to-action here.
 */
export function SubscriptionPaywall({
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
      accessibilityLabel="subscription-paywall"
      testID="subscription-paywall"
    >
      <View style={{ alignItems: "center", gap: 16 }}>
        <View
          style={{
            width: 76,
            height: 76,
            borderRadius: 38,
            backgroundColor: theme.accentSoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Sparkles size={34} color={theme.accent} />
        </View>
        <Text
          variant="titleLarge"
          align="center"
          style={{ fontFamily: fontFamilies.bold }}
        >
          {t("paywall.title", "Subscription inactive")}
        </Text>
        <Text
          variant="bodyMedium"
          color={theme.textSecondary}
          align="center"
          style={{ lineHeight: 21 }}
        >
          {t(
            "paywall.message",
            "This account doesn't have an active MyFleet subscription. Please contact your account administrator to activate it.",
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
          testID="paywall-refresh-button"
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
          testID="paywall-logout-button"
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
