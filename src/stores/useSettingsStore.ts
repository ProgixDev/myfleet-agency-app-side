import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Types ────────────────────────────────────────────────────────────────────

export type Locale = 'fr' | 'en';

export type ThemeMode = 'dark' | 'light' | 'system';

interface SettingsState {
  locale: Locale;
  theme: ThemeMode;
  notificationsEnabled: boolean;
  hasSeenOnboarding: boolean;
}

interface SettingsActions {
  setLocale: (locale: Locale) => void;
  setTheme: (theme: ThemeMode) => void;
  toggleNotifications: () => void;
  completeOnboarding: () => void;
}

type SettingsStore = SettingsState & SettingsActions;

// ── Store ────────────────────────────────────────────────────────────────────

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      locale: 'fr',
      theme: 'system',
      notificationsEnabled: true,
      hasSeenOnboarding: false,

      setLocale: (locale) => set({ locale }),
      setTheme: (theme) => set({ theme }),
      toggleNotifications: () =>
        set((state) => ({ notificationsEnabled: !state.notificationsEnabled })),
      completeOnboarding: () => set({ hasSeenOnboarding: true }),
    }),
    {
      name: 'my-fleet-settings',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<SettingsState>;
        if (version < 1) {
          // One-shot reset so users see onboarding after the splash rewrite.
          return { ...state, hasSeenOnboarding: false } as SettingsState;
        }
        return state as SettingsState;
      },
    },
  ),
);
