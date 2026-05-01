import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { ChevronLeft, Camera, ImageIcon, Aperture } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';

import { ScreenWrapper } from '@/components/ui/ScreenWrapper';
import { Text } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Input } from '@/components/ui/Input';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/components/ui/Toast';
import { updateProfile } from '@/services/userService';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const updateUser = useAuthStore((s) => s.updateUser);
  const showToast = useToastStore((s) => s.show);

  const [firstName, setFirstName] = useState(user?.name?.split(' ')[0] ?? '');
  const [lastName, setLastName] = useState(
    user?.name?.split(' ').slice(1).join(' ') ?? '',
  );
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [showAvatarSheet, setShowAvatarSheet] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{
    uri: string;
    name: string;
    mimeType: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handlePickFromLibrary = async () => {
    setShowAvatarSheet(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const uri = asset.uri;
      const name = asset.fileName ?? `avatar-${Date.now()}.jpg`;
      const mimeType = asset.mimeType ?? 'image/jpeg';
      setSelectedImage({ uri, name, mimeType });
    }
  };

  const handleTakePhoto = async () => {
    setShowAvatarSheet(false);

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showToast({
        variant: 'error',
        title: 'Permission refusée',
        message: "L'accès à la caméra est nécessaire pour prendre une photo.",
      });
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const uri = asset.uri;
      const name = asset.fileName ?? `photo-${Date.now()}.jpg`;
      const mimeType = asset.mimeType ?? 'image/jpeg';
      setSelectedImage({ uri, name, mimeType });
    }
  };

  const handleSave = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!accessToken) {
      showToast({
        variant: 'error',
        title: 'Non authentifié',
        message: 'Veuillez vous reconnecter.',
      });
      return;
    }

    setIsSaving(true);

    try {
      const fullName = `${firstName} ${lastName}`.trim();
      const updated = await updateProfile(accessToken, {
        name: fullName || user?.name,
        phone: phone || undefined,
        avatarFile: selectedImage,
      });

      updateUser(updated);
      showToast({
        variant: 'success',
        title: 'Profil mis à jour',
        message: 'Vos informations ont été enregistrées.',
      });
      setSelectedImage(null);
    } catch (error: any) {
      showToast({
        variant: 'error',
        title: 'Erreur',
        message:
          error?.message ?? 'Impossible de mettre à jour votre profil.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const avatarSource = selectedImage?.uri ?? user?.avatar;

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
          Profil
        </Text>
      </Animated.View>

      {/* Avatar with camera overlay */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(50)}
        className="items-center mb-6"
      >
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowAvatarSheet(true);
          }}
        >
          <Avatar name={user?.name} source={avatarSource} size="xl" />
          <View
            style={{ backgroundColor: theme.accent }}
            className="absolute bottom-0 right-0 rounded-full p-1.5"
          >
            <Camera size={14} color="#0A0A0F" strokeWidth={2} />
          </View>
        </Pressable>
      </Animated.View>

      {/* Form */}
      <Animated.View entering={FadeInDown.duration(400).delay(100)} className="mb-4">
        <Input
          label="Prénom"
          placeholder="Votre prénom"
          value={firstName}
          onChangeText={setFirstName}
          className="mb-4"
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(400).delay(150)} className="mb-4">
        <Input
          label="Nom"
          placeholder="Votre nom"
          value={lastName}
          onChangeText={setLastName}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(400).delay(200)} className="mb-4">
        <Input
          label="Email"
          placeholder="Email"
          value={user?.email ?? ''}
          disabled
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(400).delay(250)} className="mb-4">
        <Input
          label="Téléphone"
          placeholder="+33 6 00 00 00 00"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
      </Animated.View>

      {/* Role badge */}
      <Animated.View entering={FadeInDown.duration(400).delay(300)} className="mb-6">
        <Text
          variant="titleSmall"
          color={theme.textSecondary}
          className="mb-1.5 px-1"
        >
          Rôle
        </Text>
        <Badge variant="accent" size="lg">
          {user?.role === 'admin' ? 'Administrateur' : 'Employé'}
        </Badge>
      </Animated.View>

      {/* Save Button */}
      <Animated.View entering={FadeInDown.duration(400).delay(350)} className="mb-8">
        <Button fullWidth onPress={handleSave} loading={isSaving}>
          Enregistrer
        </Button>
      </Animated.View>

      {/* Avatar picker bottom sheet */}
      <BottomSheet
        visible={showAvatarSheet}
        onClose={() => setShowAvatarSheet(false)}
        snapPoints={[25]}
        title="Changer la photo"
      >
        <View className="px-4 pb-6 gap-3">
          <Pressable
            onPress={handleTakePhoto}
            className="flex-row items-center gap-3 p-3 rounded-2xl"
            style={{ backgroundColor: theme.surfaceSecondary }}
          >
            <Aperture size={22} color={theme.textPrimary} />
            <Text variant="bodyLarge">Prendre une photo</Text>
          </Pressable>

          <Pressable
            onPress={handlePickFromLibrary}
            className="flex-row items-center gap-3 p-3 rounded-2xl"
            style={{ backgroundColor: theme.surfaceSecondary }}
          >
            <ImageIcon size={22} color={theme.textPrimary} />
            <Text variant="bodyLarge">Choisir dans la galerie</Text>
          </Pressable>
        </View>
      </BottomSheet>
    </ScreenWrapper>
  );
}
