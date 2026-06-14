import React from "react";
import { View, StyleSheet, Linking, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Sparkles, RefreshCw, LogOut } from "lucide-react-native";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { useTheme } from "@/hooks/useTheme";
import { fontFamilies } from "@/theme/typography";
import { WEB_ADMIN_URL } from "@/config/webAdmin";
import { useAuthStore } from "@/stores/useAuthStore";

/**
 * Full-screen gate shown over the (app) area when the agency has no active
 * subscription. Subscriptions are purchased on the web admin (Stripe Checkout
 * needs the web), so the primary CTA deep-links there; the refresh button
 * re-checks status after the user pays, and logout lets them switch accounts.
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
          {t("paywall.title", "Subscription required")}
        </Text>
        <Text
          variant="bodyMedium"
          color={theme.textSecondary}
          align="center"
          style={{ lineHeight: 21 }}
        >
          {t(
            "paywall.message",
            "Your agency needs an active MyFleet subscription to use the app. Subscribe from your web dashboard to unlock your fleet, bookings, inspections and AI.",
          )}
        </Text>
      </View>

      <View style={{ gap: 12 }}>
        <Button
          variant="primary"
          fullWidth
          size="lg"
          leftIcon={Sparkles}
          onPress={() =>
            void Linking.openURL(`${WEB_ADMIN_URL}/subscription`)
          }
          testID="paywall-subscribe-button"
          accessibilityLabel={t("paywall.subscribe", "Subscribe")}
        >
          {t("paywall.subscribe", "Subscribe")}
        </Button>
        <Button
          variant="secondary"
          fullWidth
          size="lg"
          leftIcon={RefreshCw}
          loading={refreshing}
          onPress={onRefresh}
          testID="paywall-refresh-button"
          accessibilityLabel={t("paywall.refresh", "I've subscribed — refresh")}
        >
          {t("paywall.refresh", "I've subscribed — refresh")}
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
