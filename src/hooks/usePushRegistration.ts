// Registers this device's Expo push token so the backend can reach agency
// staff. The server side already existed and was firing into the void:
// MessagesService.fanoutPushToAgency() sends "New message from a client" to
// every staff user of the agency, and NotificationsService.emit() pushes on
// top of each in-app notification. Neither could deliver anything, because
// this app never registered a token — so `user_push_token` held rows for
// renters only.
//
// Mirrors ../../../client/src/hooks/usePushRegistration.ts deliberately: same
// endpoint, same best-effort contract. Divergence between the two is a bug.
//
// Best-effort throughout: push must never block or break the app. No token is
// issued on a simulator (Device.isDevice === false), so this can only be
// verified on real hardware.

import { useEffect } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { authedRequest } from "@/services/api";

// Show notifications while the app is foregrounded — an agent with the app
// open is exactly who needs to see "new message from a client".
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * @param enabled pass the session state — registering before sign-in would
 * send an unauthenticated request and attach the token to nobody.
 */
export function usePushRegistration(enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;
    void registerPushToken();
  }, [enabled]);
}

async function registerPushToken(): Promise<void> {
  try {
    if (!Device.isDevice) return; // simulators never get a token

    const settings = await Notifications.getPermissionsAsync();
    let granted = settings.granted;
    if (!granted) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.granted;
    }
    if (!granted) return;

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      (Constants?.easConfig as { projectId?: string } | undefined)?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );

    const platform: "ios" | "android" =
      Platform.OS === "ios" ? "ios" : "android";
    await authedRequest<unknown>("/me/push-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: tokenData.data,
        platform,
        ...(Device.deviceName ? { deviceName: Device.deviceName } : {}),
      }),
    });
  } catch {
    // Swallowed on purpose — see the header note.
  }
}
