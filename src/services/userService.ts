import { apiRequest, AUTH_BASE_URL } from "@/services/api";
import type { AuthUser } from "@/stores/useAuthStore";

export interface UpdateProfilePayload {
  name?: string;
  phone?: string;
  avatarFile?: {
    uri: string;
    name: string;
    mimeType: string;
  } | null;
}

export async function updateProfile(
  accessToken: string,
  payload: UpdateProfilePayload,
): Promise<AuthUser> {
  const formData = new FormData();

  if (payload.name) {
    formData.append("name", payload.name);
  }
  if (payload.phone) {
    formData.append("phone", payload.phone);
  }
  if (payload.avatarFile) {
    formData.append("file", {
      uri: payload.avatarFile.uri,
      name: payload.avatarFile.name,
      type: payload.avatarFile.mimeType,
    } as unknown as Blob);
  }

  return apiRequest<AuthUser>("/me", {
    baseUrl: AUTH_BASE_URL,
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });
}
