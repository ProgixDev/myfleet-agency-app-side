import { Platform } from "react-native";
import { apiRequest, AUTH_BASE_URL } from "@/services/api";
import type { UploadedSignupDocument } from "@/services/storage";

export type SocialProvider = "apple" | "google" | "facebook";

export interface SocialAuthResult {
  provider: SocialProvider;
  email: string;
  name: string;
  photoUrl?: string;
  providerId: string;
  idToken?: string;
}

export interface EmailLoginResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: "admin" | "employee" | "client";
    agencyId: string;
    avatar?: string;
  };
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

  await new Promise((resolve) => setTimeout(resolve, 800));

  return {
    provider: "apple",
    email: "user@icloud.com",
    name: "Apple User",
    providerId: "apple-001",
    idToken: "mock-apple-id-token",
  };
}

export async function signInWithGoogle(): Promise<SocialAuthResult> {
  await new Promise((resolve) => setTimeout(resolve, 800));

  return {
    provider: "google",
    email: "user@gmail.com",
    name: "Google User",
    photoUrl: "https://ui-avatars.com/api/?name=Google+User&size=128",
    providerId: "google-001",
    idToken: "mock-google-id-token",
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

export function loginWithEmail(
  email: string,
  password: string,
): Promise<EmailLoginResult> {
  return apiRequest<EmailLoginResult>("/login", {
    baseUrl: AUTH_BASE_URL,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
}

export function forgotPassword(email: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>("/forgot-password", {
    baseUrl: AUTH_BASE_URL,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });
}

export function resetPasswordWithOtp(
  email: string,
  token: string,
  password: string,
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>("/reset-password", {
    baseUrl: AUTH_BASE_URL,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, token, password }),
  });
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
