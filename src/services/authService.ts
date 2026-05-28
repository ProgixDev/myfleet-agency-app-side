import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { GoogleSignin } from "@react-native-google-signin/google-signin";

import { apiRequest, AUTH_BASE_URL } from "@/services/api";
import { supabase } from "@/lib/supabase";
import type { UploadedSignupDocument } from "@/services/storage";

// Configure Google Sign-In
GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
});

export class EmailNotConfirmedError extends Error {
  constructor(public email: string) {
    super("Email not confirmed");
    this.name = "EmailNotConfirmedError";
  }
}

export type SocialProvider = "apple" | "google" | "facebook";

export interface SocialAuthResult {
  provider: SocialProvider;
  email: string;
  name: string;
  photoUrl?: string;
  providerId: string;
  idToken?: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: "admin" | "employee" | "client";
  agencyId: string;
  avatar?: string;
}

export interface AgencySignUpPayload {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  agency: string;
  city: string;
  fleetSize: "s" | "m" | "l" | "xl" | null;
  docsUploaded: {
    kbis: UploadedSignupDocument | null;
    license: UploadedSignupDocument | null;
    insurance: UploadedSignupDocument | null;
  };
  cguAccepted: boolean;
}

export interface AgencySignUpResult {
  user: {
    id: string;
    name: string;
    email: string;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  memberRole: "admin";
}

export function isAppleSignInAvailable(): boolean {
  return Platform.OS === "ios";
}

export async function signInWithApple(): Promise<SocialAuthResult> {
  if (!isAppleSignInAvailable()) {
    throw new Error("Apple Sign-In is only available on iOS");
  }

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new Error("Apple Sign-In failed: No identity token received");
    }

    return {
      provider: "apple",
      email: credential.email ?? "",
      name: credential.fullName
        ? `${credential.fullName.givenName} ${credential.fullName.familyName}`.trim()
        : "Apple User",
      providerId: credential.user,
      idToken: credential.identityToken,
    };
  } catch (e: any) {
    if (e.code === "ERR_CANCELED") {
      throw new Error("Apple Sign-In was cancelled");
    }
    throw e;
  }
}

export async function signInWithGoogle(): Promise<SocialAuthResult> {
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();

  // In newer versions of @react-native-google-signin/google-signin,
  // the response structure might be { data: { ... } } or just { ... }.
  // We'll handle the common structure.
  const userInfo = (response as any).data || response;

  if (!userInfo.idToken) {
    throw new Error("Google Sign-In failed: No ID Token received");
  }

  return {
    provider: "google",
    email: userInfo.user.email,
    name: userInfo.user.name ?? "Google User",
    photoUrl: userInfo.user.photo ?? undefined,
    providerId: userInfo.user.id,
    idToken: userInfo.idToken,
  };
}

export async function signInWithFacebook(): Promise<SocialAuthResult> {
  await new Promise((resolve) => setTimeout(resolve, 800));

  return {
    provider: "facebook",
    email: "user@facebook.com",
    name: "Facebook User",
    photoUrl: "https://ui-avatars.com/api/?name=Facebook+User&size=128",
    providerId: "facebook-001",
  };
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    if (error?.message.includes("Email not confirmed")) {
      throw new EmailNotConfirmedError(email);
    }
    throw new Error(error?.message ?? "Invalid email or password");
  }

  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  };
}

export async function signInWithSocial(
  provider: "google" | "apple",
  idToken: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider,
    token: idToken,
  });

  if (error || !data.session) {
    throw new Error(error?.message ?? "Social login failed");
  }

  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  };
}

export async function validateSession(accessToken: string): Promise<AuthUser> {
  const principal = await apiRequest<AuthUser>("/validate", {
    baseUrl: AUTH_BASE_URL,
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return principal;
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}

export async function forgotPassword(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) {
    throw new Error(error.message);
  }
}

export async function resetPasswordWithOtp(
  email: string,
  token: string,
  password: string,
): Promise<void> {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "recovery",
  });

  if (error || !data.session) {
    throw new Error(error?.message ?? "Invalid or expired reset code");
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password,
  });

  if (updateError) {
    throw new Error(updateError.message);
  }

  await supabase.auth.signOut();
}

export async function resendVerificationEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
  });
  if (error) {
    console.error("[authService] resend signup email failed", {
      message: error.message,
      status: error.status,
      code: error.code,
      name: error.name,
    });
    throw new Error(error.message);
  }
}

export async function verifyEmailOtp(
  email: string,
  token: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "signup",
  });

  if (error || !data.session) {
    throw new Error(error?.message ?? "Invalid or expired verification code");
  }

  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  };
}

export function signUpAgency(
  payload: AgencySignUpPayload,
): Promise<AgencySignUpResult> {
  return apiRequest<AgencySignUpResult>("/signup/agency", {
    baseUrl: AUTH_BASE_URL,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}
