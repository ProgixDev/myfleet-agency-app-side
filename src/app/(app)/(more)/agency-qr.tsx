import React, { useCallback, useRef } from "react";
import { View, Alert, Platform } from "react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Share2, Download, Printer } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import * as Print from "expo-print";
import QRCode from "react-native-qrcode-svg";

import { ScreenWrapper } from "@/components/ui/ScreenWrapper";
import { Text } from "@/components/ui/Text";
import { IconButton } from "@/components/ui/IconButton";
import { useTheme } from "@/hooks/useTheme";
import { useAgency } from "@/hooks/useAgency";
import { shadows } from "@/theme/shadows";
import { fontFamilies } from "@/theme/typography";

const QR_SIZE = 256;

type QRRef = {
  toDataURL: (cb: (data: string) => void) => void;
};

export default function AgencyQRScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { data: agency } = useAgency();
  const agencyName = agency?.name ?? "";
  const publicBase = (
    process.env.EXPO_PUBLIC_PUBLIC_URL ?? "https://myfleet.app"
  ).replace(/\/+$/, "");
  const publicQrUrl = agency?.slug ? `${publicBase}/pair/${agency.slug}` : "";
  const deepLinkUrl = agency?.slug
    ? Linking.createURL(`pair/${agency.slug}`)
    : "";
  const agencyQrUrl = deepLinkUrl || publicQrUrl;

  const qrRef = useRef<QRRef | null>(null);

  const getQrBase64 = useCallback(() => {
    return new Promise<string>((resolve, reject) => {
      if (!qrRef.current) {
        reject(new Error("QR not ready"));
        return;
      }
      qrRef.current.toDataURL((data) => resolve(data));
    });
  }, []);

  const writeQrToFile = useCallback(
    async (filename: string) => {
      const base64 = await getQrBase64();
      const file = new File(Paths.cache, filename);
      if (file.exists) {
        file.delete();
      }
      file.create();
      file.write(base64, { encoding: "base64" });
      return { uri: file.uri, base64 };
    },
    [getQrBase64],
  );

  const handleShare = useCallback(async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert(
          t("agency.qrCode.shareUnavailable", {
            defaultValue: "Sharing is not available on this device.",
          }),
        );
        return;
      }
      const slug = agency?.slug ?? "agency";
      const { uri } = await writeQrToFile(`agency-qr-${slug}.png`);
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: t("agency.qrCode.shareTitle", {
          defaultValue: "Share agency QR code",
        }),
        UTI: "public.png",
      });
    } catch (err) {
      Alert.alert(
        t("common.error", { defaultValue: "Error" }),
        err instanceof Error ? err.message : String(err),
      );
    }
  }, [agency?.slug, t, writeQrToFile]);

  const handleDownload = useCallback(async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          t("agency.qrCode.permissionDenied", {
            defaultValue: "Permission to access the gallery was denied.",
          }),
        );
        return;
      }
      const slug = agency?.slug ?? "agency";
      const { uri } = await writeQrToFile(`agency-qr-${slug}.png`);
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert(
        t("agency.qrCode.saved", { defaultValue: "Saved!" }),
        t("agency.qrCode.downloadMessage", {
          defaultValue: "QR code has been saved to your gallery.",
        }),
      );
    } catch (err) {
      Alert.alert(
        t("common.error", { defaultValue: "Error" }),
        err instanceof Error ? err.message : String(err),
      );
    }
  }, [agency?.slug, t, writeQrToFile]);

  const handlePrint = useCallback(async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const base64 = await getQrBase64();
      const dataUri = `data:image/png;base64,${base64}`;
      const safeName = (agencyName || "").replace(
        /[<>&"']/g,
        (c) =>
          (
            ({
              "<": "&lt;",
              ">": "&gt;",
              "&": "&amp;",
              '"': "&quot;",
              "'": "&#39;",
            }) as Record<string, string>
          )[c] ?? c,
      );
      const subtitle = t("agency.qrCode.subtitle", {
        defaultValue: "Scan to connect the client app",
      });
      const html = `
        <html>
          <head>
            <meta charset="utf-8" />
            <style>
              @page { margin: 24px; }
              body {
                font-family: -apple-system, Helvetica, Arial, sans-serif;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 48px 24px;
              }
              h1 { font-size: 28px; margin: 0 0 24px; }
              p { font-size: 16px; color: #555; margin: 16px 0 0; }
              img { width: 360px; height: 360px; }
              .url { font-size: 12px; color: #888; margin-top: 12px; word-break: break-all; }
            </style>
          </head>
          <body>
            <h1>${safeName}</h1>
            <img src="${dataUri}" />
            <p>${subtitle}</p>
            <p class="url">${agencyQrUrl}</p>
            ${publicQrUrl && publicQrUrl !== agencyQrUrl ? `<p class="url">${publicQrUrl}</p>` : ""}
          </body>
        </html>
      `;
      await Print.printAsync({ html });
    } catch (err) {
      if (Platform.OS === "ios" && /did not complete/i.test(String(err))) {
        return;
      }
      Alert.alert(
        t("common.error", { defaultValue: "Error" }),
        err instanceof Error ? err.message : String(err),
      );
    }
  }, [agencyName, agencyQrUrl, getQrBase64, publicQrUrl, t]);

  const actionButtons = [
    {
      key: "share",
      icon: Share2,
      label: t("agency.qrCode.share", { defaultValue: "Share" }),
      onPress: handleShare,
    },
    {
      key: "download",
      icon: Download,
      label: t("agency.qrCode.download", { defaultValue: "Download" }),
      onPress: handleDownload,
    },
    {
      key: "print",
      icon: Printer,
      label: t("agency.qrCode.print", { defaultValue: "Print" }),
      onPress: handlePrint,
    },
  ];

  return (
    <ScreenWrapper scroll>
      {/* Header */}
      <View className="flex-row items-center pt-2 pb-4">
        <IconButton
          icon={ArrowLeft}
          variant="ghost"
          size="md"
          onPress={() => router.back()}
          color={theme.textPrimary}
        />
        <Text variant="headlineMedium" className="ml-2">
          {t("agency.qrCode.title", { defaultValue: "Agency QR Code" })}
        </Text>
      </View>

      {/* Agency name */}
      <Text
        variant="headlineSmall"
        align="center"
        color={theme.textPrimary}
        className="mt-4 mb-8"
      >
        {agencyName}
      </Text>

      {/* QR Code Card */}
      <View className="items-center">
        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 20,
            padding: 24,
            alignItems: "center",
            ...shadows.lg,
          }}
        >
          {agencyQrUrl ? (
            <QRCode
              value={agencyQrUrl}
              size={QR_SIZE}
              backgroundColor="#FFFFFF"
              color="#1A1A2E"
              getRef={(ref) => {
                qrRef.current = ref as QRRef | null;
              }}
            />
          ) : (
            <View
              style={{
                width: QR_SIZE,
                height: QR_SIZE,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text variant="bodySmall" color={theme.textSecondary}>
                {t("agency.qrCode.unavailable", {
                  defaultValue: "QR code unavailable",
                })}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Agency info below card */}
      <View className="items-center mt-6">
        <Text
          variant="headlineSmall"
          align="center"
          color={theme.textPrimary}
          style={{
            fontFamily: fontFamilies.semiBold,
            fontSize: 18,
          }}
        >
          {agencyName}
        </Text>
        <Text
          variant="bodyMedium"
          align="center"
          color={theme.textSecondary}
          className="mt-1"
        >
          {t("agency.qrCode.subtitle", {
            defaultValue: "Scan to connect the client app",
          })}
        </Text>
        {publicQrUrl && publicQrUrl !== agencyQrUrl ? (
          <Text
            variant="caption"
            align="center"
            color={theme.textTertiary}
            className="mt-2"
            style={{ maxWidth: 260 }}
          >
            {publicQrUrl}
          </Text>
        ) : null}
      </View>

      {/* Action Buttons */}
      <View
        className="flex-row justify-center items-center mt-8 mb-8"
        style={{ gap: 32 }}
      >
        {actionButtons.map((btn) => {
          const Icon = btn.icon;
          return (
            <View key={btn.key} className="items-center" style={{ gap: 6 }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: theme.accentSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <IconButton
                  icon={Icon}
                  variant="ghost"
                  size="lg"
                  color={theme.accent}
                  onPress={btn.onPress}
                />
              </View>
              <Text variant="bodySmall" color={theme.textSecondary}>
                {btn.label}
              </Text>
            </View>
          );
        })}
      </View>
    </ScreenWrapper>
  );
}
