import { Tabs, useSegments } from "expo-router";
import {
  LayoutDashboard,
  Car,
  ScanLine,
  CalendarDays,
  Menu,
} from "lucide-react-native";
import React from "react";
import { useTranslation } from "react-i18next";

import { TabBar, type TabItem } from "@/components/ui/TabBar";
import { useSubscription } from "@/hooks/useSubscription";
import { SubscriptionPaywall } from "@/components/billing/SubscriptionPaywall";

// Routes where the global tab bar should be hidden — full-bleed screens
// (e.g. camera capture) that need the entire viewport.
const HIDDEN_TAB_BAR_SEGMENTS = new Set(["camera"]);

export default function AppLayout() {
  const { t } = useTranslation();
  const segments = useSegments();
  const lastSegment = segments.at(-1) ?? "";
  const hideTabBar = HIDDEN_TAB_BAR_SEGMENTS.has(lastSegment);

  // Paywall gate. We only lock when we POSITIVELY know the agency is inactive;
  // while loading or on a fetch error we fail open (the backend
  // SubscriptionGuard still enforces access — this overlay is just UX).
  const subscription = useSubscription();
  const locked = subscription.data ? !subscription.data.active : false;

  const tabs: TabItem[] = [
    { name: "(home)", label: t("tabs.dashboard"), icon: LayoutDashboard },
    { name: "(fleet)", label: t("tabs.fleet"), icon: Car },
    { name: "(inspections)", label: t("inspection.title"), icon: ScanLine },
    { name: "(bookings)", label: t("tabs.bookings"), icon: CalendarDays },
    { name: "(more)", label: t("tabs.more"), icon: Menu },
  ];

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
        }}
        tabBar={(props) => {
          if (hideTabBar) return null;
          return (
            <TabBar
              tabs={tabs}
              activeTab={props.state.routes[props.state.index].name}
              onTabPress={(name) => {
                const route = props.state.routes.find((r) => r.name === name);
                if (route) {
                  props.navigation.navigate(route.name);
                }
              }}
            />
          );
        }}
      >
        <Tabs.Screen name="(home)" />
        <Tabs.Screen name="(fleet)" />
        <Tabs.Screen name="(inspections)" />
        <Tabs.Screen name="(bookings)" />
        <Tabs.Screen name="(more)" />
      </Tabs>
      {locked && (
        <SubscriptionPaywall
          onRefresh={() => void subscription.refetch()}
          refreshing={subscription.isFetching}
        />
      )}
    </>
  );
}
