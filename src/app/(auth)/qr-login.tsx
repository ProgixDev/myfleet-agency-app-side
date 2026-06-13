import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { StatusBar } from "expo-status-bar";
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { QrCode, X } from "lucide-react-native";
import { z } from "zod";

import { Text } from "@/components/ui/Text";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/stores/useAuthStore";
import { useToastStore } from "@/components/ui/Toast";
import { fontFamilies } from "@/theme/typography";

const ACCENT = "#7C3AED";

const qrPayloadSchema = z.object({
  kind: z.literal("myfleet-agency-login"),
  token: z.string().min(1),
});

export default function QrLoginScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [permission, requestPermission] = useCameraPermissions();
  const showToast = useToastStore((s) => s.show);

  const [scanned, setScanned] = useState(false);

  const handleClose = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const handleScan = async (result: BarcodeScanningResult) => {
    setScanned(true);

    let parsed: z.infer<typeof qrPayloadSchema>;
    try {
      parsed = qrPayloadSchema.parse(JSON.parse(result.data));
    } catch {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast({
        variant: "error",
        title: t("auth.qrLogin.title"),
        message: t("auth.qrLogin.invalid"),
      });
      setScanned(false);
      return;
    }

    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await useAuthStore.getState().loginWithQrToken(parsed.token);
      showToast({
        variant: "success",
        title: t("auth.qrLogin.title"),
        message: t("auth.qrLogin.success"),
      });
      router.replace("/(app)/(home)");
    } catch (err: unknown) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message =
        err instanceof Error ? err.message : t("auth.qrLogin.invalid");
      showToast({
        variant: "error",
        title: t("auth.qrLogin.title"),
        message,
      });
      setScanned(false);
    }
  };

  // ── Permission gate ─────────────────────────────────────────────────────────

  if (!permission) {
    return (
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: "#000",
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          },
        ]}
      >
        <StatusBar style="light" />
        <Text variant="bodyMedium" color="#fff" align="center">
          {t("auth.qrLogin.permissionMessage")}
        </Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: "#000",
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          },
        ]}
      >
        <StatusBar style="light" />
        <QrCode size={48} color="#fff" strokeWidth={1.6} />
        <Text
          variant="headlineSmall"
          color="#fff"
          align="center"
          style={{ marginTop: 16, marginBottom: 12 }}
        >
          {t("auth.qrLogin.permissionTitle")}
        </Text>
        <Text
          variant="bodyMedium"
          color="rgba(255,255,255,0.7)"
          align="center"
          style={{ marginBottom: 24 }}
        >
          {t("auth.qrLogin.permissionMessage")}
        </Text>
        <Pressable
          testID="qr-login-grant-permission"
          onPress={requestPermission}
          style={{
            backgroundColor: ACCENT,
            paddingHorizontal: 28,
            paddingVertical: 12,
            borderRadius: 9999,
          }}
        >
          <Text
            variant="bodyMedium"
            color="#fff"
            style={{ fontFamily: fontFamilies.semiBold }}
          >
            {t("auth.qrLogin.grantPermission")}
          </Text>
        </Pressable>
        <Pressable
          testID="qr-login-close"
          onPress={handleClose}
          style={{ marginTop: 16 }}
        >
          <Text variant="bodyMedium" color="rgba(255,255,255,0.5)">
            {t("common.cancel")}
          </Text>
        </Pressable>
      </View>
    );
  }

  // ── Scanner ─────────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar style="light" />

      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={scanned ? undefined : handleScan}
      />

      {/* Dim scrim for legibility */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: "rgba(0,0,0,0.25)" },
        ]}
        pointerEvents="none"
      />

      {/* Top bar */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          paddingTop: insets.top + 12,
          paddingHorizontal: 16,
          paddingBottom: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Pressable
          testID="qr-login-close"
          onPress={handleClose}
          hitSlop={10}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: "rgba(0,0,0,0.45)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X size={20} color="#fff" strokeWidth={2.5} />
        </Pressable>

        <View style={{ alignItems: "center" }}>
          <Text
            variant="bodyMedium"
            color="#fff"
            style={{ fontFamily: fontFamilies.semiBold, fontSize: 15 }}
          >
            {t("auth.qrLogin.title")}
          </Text>
        </View>

        <View style={{ width: 40 }} />
      </View>

      {/* Framing reticle */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { justifyContent: "center", alignItems: "center" },
        ]}
        pointerEvents="none"
      >
        <View
          style={{
            width: 240,
            height: 240,
            borderRadius: 28,
            borderWidth: 3,
            borderColor: theme.accent,
          }}
        />
      </View>

      {/* Bottom hint */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 32,
          alignItems: "center",
        }}
      >
        <Text
          variant="bodyMedium"
          color="#fff"
          align="center"
          style={{ fontFamily: fontFamilies.semiBold, marginBottom: 6 }}
        >
          {t("auth.qrLogin.subtitle")}
        </Text>
        <Text
          variant="bodySmall"
          color="rgba(255,255,255,0.7)"
          align="center"
        >
          {scanned ? t("auth.qrLogin.scanning") : t("auth.qrLogin.subtitle")}
        </Text>
      </View>
    </View>
  );
}
