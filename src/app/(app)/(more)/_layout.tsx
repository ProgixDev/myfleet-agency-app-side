import { Stack } from "expo-router";

import { useTheme } from "@/hooks/useTheme";

export default function MoreLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="contracts/index" />
      <Stack.Screen name="contracts/[id]" />
      <Stack.Screen name="contracts/new" />
      <Stack.Screen name="violations/index" />
      <Stack.Screen name="violations/[id]" />
      <Stack.Screen name="violations/new" />
      <Stack.Screen name="clients/index" />
      <Stack.Screen name="clients/[id]" />
      <Stack.Screen name="clients/new" />
      <Stack.Screen name="clients/quick-register" />
      <Stack.Screen name="billing/index" />
      <Stack.Screen name="billing/[id]" />
      <Stack.Screen name="analytics/index" />
      <Stack.Screen name="agency" />
      <Stack.Screen name="agency-qr" />
      <Stack.Screen name="settings/index" />
      <Stack.Screen name="settings/profile" />
      <Stack.Screen name="settings/theme" />
      <Stack.Screen name="settings/language" />
      <Stack.Screen name="notifications/index" />
    </Stack>
  );
}
