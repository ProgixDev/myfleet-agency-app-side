import React, { useState } from 'react';
import { View, Pressable, Switch, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  ChevronRight,
  Palette,
  Globe,
  Bell,
  Mail,
  Calendar,
  Clock,
  KeyRound,
  Fingerprint,
  Info,
  LogOut,
  Trash2,
  User,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';

import { ScreenWrapper } from '@/components/ui/ScreenWrapper';
import { Text } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Divider } from '@/components/ui/Divider';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/components/ui/Toast';
import { deleteAccount } from '@/services/authService';
import { ApiClientError } from '@/services/api';

// ── SettingsRow ─────────────────────────────────────────────────────────────

interface SettingsRowProps {
  icon: LucideIcon;
  label: string;
  onPress?: () => void;
  rightElement?: 'chevron' | 'badge' | 'switch';
  badgeText?: string;
  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void;
  danger?: boolean;
  iconColor?: string;
  isLast?: boolean;
  testID?: string;
  switchTestID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

function SettingsRow({
  icon: Icon,
  label,
  onPress,
  rightElement = 'chevron',
  badgeText,
  switchValue,
  onSwitchChange,
  danger = false,
  iconColor,
  isLast = false,
  testID,
  switchTestID,
  accessibilityLabel,
  accessibilityHint,
}: SettingsRowProps) {
  const theme = useTheme();
  const textColor = danger ? theme.danger : theme.textPrimary;
  const resolvedIconColor = iconColor ?? (danger ? theme.danger : theme.textSecondary);

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      className="flex-row items-center py-3.5 px-4"
      style={
        !isLast
          ? { borderBottomWidth: 1, borderBottomColor: theme.border }
          : undefined
      }
    >
      <Icon size={20} color={resolvedIconColor} strokeWidth={1.8} />
      <Text variant="bodyLarge" color={textColor} className="flex-1 ml-3">
        {label}
      </Text>

      {rightElement === 'chevron' && (
        <ChevronRight size={18} color={theme.textTertiary} strokeWidth={1.8} />
      )}
      {rightElement === 'badge' && badgeText && (
        <Badge variant="accent" size="sm">{badgeText}</Badge>
      )}
      {rightElement === 'switch' && (
        <Switch
          testID={switchTestID}
          accessibilityRole="switch"
          accessibilityLabel={label}
          value={switchValue}
          onValueChange={(val) => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onSwitchChange?.(val);
          }}
          trackColor={{ false: theme.surfaceTertiary, true: theme.accentSoft }}
          thumbColor={switchValue ? theme.accent : theme.textTertiary}
        />
      )}
    </Pressable>
  );
}

// ── Section Header ──────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  const theme = useTheme();
  return (
    <Text
      variant="titleSmall"
      color={theme.textTertiary}
      className="mt-5 mb-2 px-1"
    >
      {title}
    </Text>
  );
}

// ── Main Screen ─────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const role = user?.role;
  const showToast = useToastStore((s) => s.show);

  // Local toggle states
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [bookingReminders, setBookingReminders] = useState(true);
  const [returnAlerts, setReturnAlerts] = useState(true);
  const [biometrics, setBiometrics] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleLogout = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    logout();
    router.replace('/' as never);
  };

  const performAccountDeletion = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteAccount();
      // Sign out locally + clear persisted auth, then route to the auth entry
      // (mirrors handleLogout).
      await logout();
      showToast({
        variant: 'success',
        title: t('settings.deleteAccount.success'),
        message: t('settings.deleteAccount.successMessage'),
      });
      router.replace('/' as never);
    } catch (error) {
      // ADMIN accounts are blocked by the backend with HTTP 403 and a specific
      // message asking the user to contact support to transfer agency
      // ownership; surface that message instead of a generic failure.
      if (error instanceof ApiClientError && error.status === 403) {
        Alert.alert(
          t('settings.deleteAccount.adminBlockedTitle'),
          error.message,
        );
      } else {
        showToast({
          variant: 'error',
          title: t('settings.deleteAccount.errorTitle'),
          message:
            error instanceof Error && error.message
              ? error.message
              : t('settings.deleteAccount.errorMessage'),
        });
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAccount = () => {
    if (isDeleting) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      t('settings.deleteAccount.confirmTitle'),
      t('settings.deleteAccount.confirmMessage'),
      [
        { text: t('settings.deleteAccount.cancel'), style: 'cancel' },
        {
          text: t('settings.deleteAccount.confirm'),
          style: 'destructive',
          onPress: () => {
            void performAccountDeletion();
          },
        },
      ],
    );
  };

  return (
    <ScreenWrapper scroll>
      {/* Header */}
      <Animated.View
        entering={FadeInDown.duration(400)}
        className="flex-row items-center pt-6 pb-4"
      >
        <Pressable
          testID="settings-back-button"
          accessibilityRole="button"
          accessibilityLabel="Retour"
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          className="mr-3"
        >
          <ChevronLeft size={24} color={theme.textPrimary} strokeWidth={2} />
        </Pressable>
        <Text variant="headlineLarge" className="flex-1">
          Paramètres
        </Text>
      </Animated.View>

      {/* Profile Section */}
      <Animated.View entering={FadeInDown.duration(400).delay(50)}>
        <View
          style={{ backgroundColor: theme.surface }}
          className="rounded-2xl p-4 items-center"
        >
          <Avatar name={user?.name} source={user?.avatar} size="lg" />
          <Text variant="headlineMedium" className="mt-3">
            {user?.name ?? 'Utilisateur'}
          </Text>
          <Badge variant="accent" size="md" className="mt-1">
            {role === 'admin' ? 'Administrateur' : 'Employé'}
          </Badge>
          <Text variant="bodySmall" color={theme.textSecondary} className="mt-1">
            {user?.email ?? ''}
          </Text>
          <Pressable
            testID="settings-edit-profile-button"
            accessibilityRole="button"
            onPress={() => router.push('/(app)/(more)/settings/profile' as never)}
            className="mt-3"
          >
            <Text variant="titleMedium" color={theme.accent}>
              Modifier le profil
            </Text>
          </Pressable>
        </View>
      </Animated.View>

      {/* Apparence */}
      <Animated.View entering={FadeInDown.duration(400).delay(100)}>
        <SectionHeader title="Apparence" />
        <View
          style={{ backgroundColor: theme.surface }}
          className="rounded-2xl overflow-hidden"
        >
          <SettingsRow
            icon={Palette}
            label="Thème"
            onPress={() => router.push('/(app)/(more)/settings/theme' as never)}
            testID="settings-row-theme"
          />
          <SettingsRow
            icon={Globe}
            label="Langue"
            onPress={() => router.push('/(app)/(more)/settings/language' as never)}
            isLast
            testID="settings-row-language"
          />
        </View>
      </Animated.View>

      {/* Notifications */}
      <Animated.View entering={FadeInDown.duration(400).delay(150)}>
        <SectionHeader title="Notifications" />
        <View
          style={{ backgroundColor: theme.surface }}
          className="rounded-2xl overflow-hidden"
        >
          <SettingsRow
            icon={Bell}
            label="Notifications push"
            rightElement="switch"
            switchValue={pushEnabled}
            onSwitchChange={setPushEnabled}
            testID="settings-row-push-notifications"
            switchTestID="settings-switch-push-notifications"
          />
          <SettingsRow
            icon={Mail}
            label="Notifications email"
            rightElement="switch"
            switchValue={emailEnabled}
            onSwitchChange={setEmailEnabled}
            testID="settings-row-email-notifications"
            switchTestID="settings-switch-email-notifications"
          />
          <SettingsRow
            icon={Calendar}
            label="Rappels de réservation"
            rightElement="switch"
            switchValue={bookingReminders}
            onSwitchChange={setBookingReminders}
            testID="settings-row-booking-reminders"
            switchTestID="settings-switch-booking-reminders"
          />
          <SettingsRow
            icon={Clock}
            label="Alertes de retour"
            rightElement="switch"
            switchValue={returnAlerts}
            onSwitchChange={setReturnAlerts}
            isLast
            testID="settings-row-return-alerts"
            switchTestID="settings-switch-return-alerts"
          />
        </View>
      </Animated.View>

      {/* Sécurité */}
      <Animated.View entering={FadeInDown.duration(400).delay(250)}>
        <SectionHeader title="Sécurité" />
        <View
          style={{ backgroundColor: theme.surface }}
          className="rounded-2xl overflow-hidden"
        >
          <SettingsRow
            icon={KeyRound}
            label="Changer mot de passe"
            onPress={() => router.push('/(auth)/forgot-password')}
            testID="settings-row-change-password"
          />
          <SettingsRow
            icon={Fingerprint}
            label="Biométrie"
            rightElement="switch"
            switchValue={biometrics}
            onSwitchChange={setBiometrics}
            isLast
            testID="settings-row-biometrics"
            switchTestID="settings-switch-biometrics"
          />
        </View>
      </Animated.View>

      {/* À propos */}
      <Animated.View entering={FadeInDown.duration(400).delay(350)}>
        <SectionHeader title="À propos" />
        <View
          style={{ backgroundColor: theme.surface }}
          className="rounded-2xl overflow-hidden"
        >
          <SettingsRow
            icon={Info}
            label="Version"
            rightElement="badge"
            badgeText="1.0.0"
            testID="settings-row-version"
          />
          <View className="flex-row items-center py-3.5 px-4">
            <Text variant="bodyMedium" color={theme.textSecondary}>
              Réalisé par Progix
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* Zone dangereuse */}
      <Animated.View entering={FadeInDown.duration(400).delay(400)}>
        <SectionHeader title="Zone dangereuse" />
        <View
          style={{ backgroundColor: theme.surface }}
          className="rounded-2xl overflow-hidden mb-8"
        >
          <SettingsRow
            icon={LogOut}
            label="Déconnexion"
            danger
            onPress={handleLogout}
            testID="settings-row-logout"
          />
          <SettingsRow
            icon={Trash2}
            label={t('settings.deleteAccount.row')}
            danger
            onPress={handleDeleteAccount}
            isLast
            testID="settings-row-delete-account"
            accessibilityLabel={t('settings.deleteAccount.row')}
            accessibilityHint={t('settings.deleteAccount.confirmMessage')}
          />
        </View>
      </Animated.View>
    </ScreenWrapper>
  );
}
