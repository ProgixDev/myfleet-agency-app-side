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
}: SettingsRowProps) {
  const theme = useTheme();
  const textColor = danger ? theme.danger : theme.textPrimary;
  const resolvedIconColor = iconColor ?? (danger ? theme.danger : theme.textSecondary);

  return (
    <Pressable
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

  const handleLogout = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    logout();
    router.replace('/' as never);
  };

  const handleDeleteAccount = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      'Supprimer le compte',
      'Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            showToast({ variant: 'info', title: 'Coming soon', message: 'La suppression de compte sera disponible prochainement.' });
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
          />
          <SettingsRow
            icon={Globe}
            label="Langue"
            onPress={() => router.push('/(app)/(more)/settings/language' as never)}
            isLast
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
          />
          <SettingsRow
            icon={Mail}
            label="Notifications email"
            rightElement="switch"
            switchValue={emailEnabled}
            onSwitchChange={setEmailEnabled}
          />
          <SettingsRow
            icon={Calendar}
            label="Rappels de réservation"
            rightElement="switch"
            switchValue={bookingReminders}
            onSwitchChange={setBookingReminders}
          />
          <SettingsRow
            icon={Clock}
            label="Alertes de retour"
            rightElement="switch"
            switchValue={returnAlerts}
            onSwitchChange={setReturnAlerts}
            isLast
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
          />
          <SettingsRow
            icon={Fingerprint}
            label="Biométrie"
            rightElement="switch"
            switchValue={biometrics}
            onSwitchChange={setBiometrics}
            isLast
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
          />
          <SettingsRow
            icon={Trash2}
            label="Supprimer le compte"
            danger
            onPress={handleDeleteAccount}
            isLast
          />
        </View>
      </Animated.View>
    </ScreenWrapper>
  );
}
