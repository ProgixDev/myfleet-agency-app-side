import React, { useCallback, useState } from "react";
import { View, Pressable, ActivityIndicator, Dimensions } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";
import Pdf from "react-native-pdf";
import { ChevronLeft, Download, AlertTriangle } from "lucide-react-native";

import { Text } from "@/components/ui/Text";
import { useTheme } from "@/hooks/useTheme";
import { useToastStore } from "@/components/ui/Toast";

/**
 * Fullscreen in-app PDF viewer. Push to it with:
 *
 *   router.push({
 *     pathname: "/(app)/pdf-viewer",
 *     params: { url, title, filename },
 *   });
 *
 * `url` must be a publicly downloadable URL (e.g. a Supabase signed URL).
 * The Download button copies the bytes to the device's cache directory
 * and hands them to the OS Share sheet so the user can save / forward.
 */
export default function PdfViewerScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const showToast = useToastStore((s) => s.show);

  const params = useLocalSearchParams<{
    url?: string;
    title?: string;
    filename?: string;
  }>();
  const url = typeof params.url === "string" ? params.url : null;
  const title = typeof params.title === "string" ? params.title : "Document";
  const filename =
    typeof params.filename === "string" ? params.filename : "document.pdf";

  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    if (!url) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDownloading(true);
    try {
      const target = `${FileSystem.cacheDirectory}${filename}`;
      const { uri } = await FileSystem.downloadAsync(url, target);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          UTI: "com.adobe.pdf",
          dialogTitle: title,
        });
      } else {
        showToast({
          variant: "info",
          title: t("pdfViewer.savedTitle", { defaultValue: "Saved" }),
          message: uri,
        });
      }
    } catch (err) {
      showToast({
        variant: "error",
        title: t("pdfViewer.downloadFailed", {
          defaultValue: "Download failed",
        }),
        message: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setDownloading(false);
    }
  }, [url, filename, title, showToast, t]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#111827" }}>
      <StatusBar style="light" />

      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 12,
          paddingVertical: 8,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255,255,255,0.12)",
          }}
        >
          <ChevronLeft size={22} color="#FFFFFF" />
        </Pressable>
        <Text
          variant="titleMedium"
          color="#FFFFFF"
          style={{ flex: 1, textAlign: "center", fontWeight: "700" }}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Pressable
          onPress={handleDownload}
          disabled={!url || downloading}
          hitSlop={10}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255,255,255,0.12)",
            opacity: !url || downloading ? 0.5 : 1,
          }}
        >
          {downloading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Download size={20} color="#FFFFFF" />
          )}
        </Pressable>
      </View>

      {/* PDF body */}
      <View style={{ flex: 1, paddingBottom: insets.bottom }}>
        {url ? (
          <Pdf
            source={{ uri: url, cache: true }}
            style={{
              flex: 1,
              width: Dimensions.get("window").width,
              backgroundColor: "#111827",
            }}
            trustAllCerts={false}
            onError={(err) => {
              showToast({
                variant: "error",
                title: t("pdfViewer.loadFailed", {
                  defaultValue: "Couldn't load PDF",
                }),
                message: err instanceof Error ? err.message : String(err),
              });
            }}
            renderActivityIndicator={() => (
              <ActivityIndicator size="large" color={theme.accent} />
            )}
          />
        ) : (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: 24,
            }}
          >
            <AlertTriangle size={32} color="#FBBF24" />
            <Text variant="bodyMedium" color="#FFFFFF">
              {t("pdfViewer.noUrl", { defaultValue: "No document to display" })}
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
