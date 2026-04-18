import React, { useCallback } from 'react';
import { View, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Share2, Download, Printer } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { ScreenWrapper } from '@/components/ui/ScreenWrapper';
import { Text } from '@/components/ui/Text';
import { IconButton } from '@/components/ui/IconButton';
import { useTheme } from '@/hooks/useTheme';
import { useCurrentAgency } from '@/stores/useAgencyStore';
import { shadows } from '@/theme/shadows';
import { fontFamilies } from '@/theme/typography';

// ── QR Code Placeholder ─────────────────────────────────────────────────────
// Replace this with `import QRCode from 'react-native-qrcode-svg'` once installed.
// Install: npx expo install react-native-qrcode-svg react-native-svg

function QRCodePlaceholder({ value, size }: { value: string; size: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#E5E4EB',
      }}
    >
      {/* Grid pattern to simulate QR code appearance */}
      <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: size * 0.7, justifyContent: 'center' }}>
          {Array.from({ length: 49 }).map((_, i) => (
            <View
              key={i}
              style={{
                width: size * 0.08,
                height: size * 0.08,
                margin: size * 0.005,
                backgroundColor: (i + Math.floor(i / 7)) % 3 === 0 ? '#1A1A2E' : '#FFFFFF',
                borderRadius: 2,
              }}
            />
          ))}
        </View>
        <Text
          variant="bodySmall"
          color="#6E6E82"
          align="center"
          style={{ marginTop: 8 }}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

// ── Screen ──────────────────────────────────────────────────────────────────

export default function AgencyQRScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { name: agencyName, qrUrl: agencyQrUrl } = useCurrentAgency();

  const handleShare = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      t('agency.qrCode.shared', { defaultValue: 'Shared!' }),
      t('agency.qrCode.shareMessage', {
        defaultValue: 'QR code share dialog would open here.',
      }),
    );
  }, [t]);

  const handleDownload = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      t('agency.qrCode.saved', { defaultValue: 'Saved!' }),
      t('agency.qrCode.downloadMessage', {
        defaultValue: 'QR code has been saved to your gallery.',
      }),
    );
  }, [t]);

  const handlePrint = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      t('agency.qrCode.printing', { defaultValue: 'Print' }),
      t('agency.qrCode.printMessage', {
        defaultValue: 'Print dialog would open here.',
      }),
    );
  }, [t]);

  const actionButtons = [
    {
      key: 'share',
      icon: Share2,
      label: t('agency.qrCode.share', { defaultValue: 'Share' }),
      onPress: handleShare,
    },
    {
      key: 'download',
      icon: Download,
      label: t('agency.qrCode.download', { defaultValue: 'Download' }),
      onPress: handleDownload,
    },
    {
      key: 'print',
      icon: Printer,
      label: t('agency.qrCode.print', { defaultValue: 'Print' }),
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
          {t('agency.qrCode.title', { defaultValue: 'Agency QR Code' })}
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
            backgroundColor: '#FFFFFF',
            borderRadius: 20,
            padding: 24,
            alignItems: 'center',
            ...shadows.lg,
          }}
        >
          <QRCodePlaceholder value={agencyQrUrl} size={256} />
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
          {t('agency.qrCode.subtitle', { defaultValue: 'Scan to visit our agency' })}
        </Text>
      </View>

      {/* Action Buttons */}
      <View className="flex-row justify-center items-center mt-8 mb-8" style={{ gap: 32 }}>
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
                  alignItems: 'center',
                  justifyContent: 'center',
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
