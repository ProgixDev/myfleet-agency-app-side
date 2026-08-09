import { Stack } from "expo-router";

import { useTheme } from "@/hooks/useTheme";

export default function AuthLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="onboarding" options={{ animation: "fade" }} />
      <Stack.Screen name="welcome" />
      {/* Login renders in the root window, not as a modal.
       *
       * As a modal it was a separate iOS window whose layout shifts when the
       * keyboard opens, which made the email and password fields drift between
       * taps — unusable for UI automation, and the reason the Maestro login
       * flow has been parked as `wip` since the harness was added. It is also
       * the better home for a form with two inputs and a keyboard.
       *
       * The slide_from_bottom animation is kept so the transition still reads
       * like the sheet it replaces. */}
      <Stack.Screen
        name="login"
        options={{
          animation: "slide_from_bottom",
        }}
      />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="verify-email" />
      <Stack.Screen
        name="qr-login"
        options={{
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />
    </Stack>
  );
}
