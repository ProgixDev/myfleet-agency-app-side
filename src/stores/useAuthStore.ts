import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  signInWithEmail,
  signInWithSocial,
  validateSession,
  logout as supabaseSignOut,
  signInWithApple,
  signInWithGoogle,
  signInWithFacebook,
  type SocialProvider,
} from '@/services/authService';
import { supabase } from '@/lib/supabase';

// ── Types ────────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'employee' | 'client';
export type AuthProvider = 'email' | 'apple' | 'google' | 'facebook';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  agencyId: string;
  avatar?: string;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authProvider: AuthProvider;
  accessToken?: string;
  refreshToken?: string;
  socialProfile?: {
    providerId: string;
    photoUrl?: string;
  };
}

interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  loginWithSocial: (provider: SocialProvider) => Promise<void>;
  loginWithSession: (accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  initialize: () => Promise<void>;
  updateUser: (updates: Partial<AuthUser>) => void;
}

type AuthStore = AuthState & AuthActions;

// ── Store ────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      authProvider: 'email',
      accessToken: undefined,
      refreshToken: undefined,
      socialProfile: undefined,

      initialize: async () => {
        set({ isLoading: true });
        try {
          const { data, error } = await supabase.auth.getSession();
          if (error || !data.session) {
            set({ isLoading: false });
            return;
          }

          const user = await validateSession(data.session.access_token);
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
          });
        } catch {
          await supabase.auth.signOut();
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            accessToken: undefined,
            refreshToken: undefined,
            socialProfile: undefined,
          });
        }
      },

      login: async (email: string, password: string) => {
        set({ isLoading: true });

        try {
          const session = await signInWithEmail(
            email.trim().toLowerCase(),
            password,
          );
          const user = await validateSession(session.accessToken);

          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            authProvider: 'email',
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      loginWithSocial: async (provider: SocialProvider) => {
        set({ isLoading: true });

        try {
          if (provider === 'facebook') {
            throw new Error('Facebook login not yet implemented on mobile');
          }

          let socialResult;
          if (provider === 'apple') {
            socialResult = await signInWithApple();
          } else {
            socialResult = await signInWithGoogle();
          }

          if (!socialResult.idToken) {
            throw new Error(`${provider} login failed: No ID Token received`);
          }

          const session = await signInWithSocial(
            provider,
            socialResult.idToken,
          );

          let user: AuthUser;
          try {
            user = await validateSession(session.accessToken);
          } catch (validationError) {
            await supabaseSignOut();
            throw validationError;
          }

          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            authProvider: provider,
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
            socialProfile: {
              providerId: socialResult.providerId,
              photoUrl: socialResult.photoUrl,
            },
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      loginWithSession: async (accessToken: string, refreshToken: string) => {
        set({ isLoading: true });
        try {
          const user = await validateSession(accessToken);
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            authProvider: 'email',
            accessToken,
            refreshToken,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        await supabaseSignOut();
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          authProvider: 'email',
          accessToken: undefined,
          refreshToken: undefined,
          socialProfile: undefined,
        });
      },

      setLoading: (loading) => set({ isLoading: loading }),

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
    }),
    {
      name: 'my-fleet-auth',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        authProvider: state.authProvider,
        socialProfile: state.socialProfile,
      }),
    },
  ),
);
