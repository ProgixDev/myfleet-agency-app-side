import { authedRequest } from "@/services/api";
import type {
  Agency,
  AgencyBookingOption,
  AgencyDocument,
  AgencyDocumentType,
  AgencySettings,
  AgencyUser,
} from "@/types/agency";

export async function getAgency(): Promise<Agency> {
  return authedRequest<Agency>("/agency/me", { method: "GET" });
}

export async function getAgencySettings(): Promise<AgencySettings> {
  return authedRequest<AgencySettings>("/agency/settings", { method: "GET" });
}

export async function getTeam(): Promise<AgencyUser[]> {
  return authedRequest<AgencyUser[]>("/agency/team", { method: "GET" });
}

export interface InviteTeamMemberInput {
  firstName: string;
  lastName: string;
  email: string;
}

export async function inviteTeamMember(
  input: InviteTeamMemberInput,
): Promise<AgencyUser> {
  return authedRequest<AgencyUser>("/agency/team", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function getAgencyDocuments(): Promise<AgencyDocument[]> {
  return authedRequest<AgencyDocument[]>("/agency/documents", {
    method: "GET",
  });
}

export async function updateAgencyDocument(
  type: AgencyDocumentType,
  file: { uri: string; name: string; mimeType: string },
): Promise<AgencyDocument> {
  const formData = new FormData();
  formData.append("file", {
    uri: file.uri,
    name: file.name,
    type: file.mimeType,
  } as unknown as Blob);

  return authedRequest<AgencyDocument>(`/agency/documents/${type}`, {
    method: "PATCH",
    body: formData,
  });
}

export async function getSignedDocumentUrl(key: string): Promise<string> {
  const result = await authedRequest<{ url: string }>(
    `/storage/signed-url/${encodeURIComponent(key)}`,
    { method: "GET" },
  );
  return result.url;
}

export interface UpdateAgencyInput {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
  currency?: string;
  timezone?: string;
  logoFile?: {
    uri: string;
    name: string;
    mimeType: string;
  } | null;
}

export async function updateAgency(data: UpdateAgencyInput): Promise<Agency> {
  const formData = new FormData();

  if (data.name !== undefined) formData.append("name", data.name);
  if (data.phone !== undefined) formData.append("phone", data.phone);
  if (data.email !== undefined) formData.append("email", data.email);
  if (data.address !== undefined) formData.append("address", data.address);
  if (data.website !== undefined) formData.append("website", data.website);
  if (data.currency !== undefined) formData.append("currency", data.currency);
  if (data.timezone !== undefined) formData.append("timezone", data.timezone);

  if (data.logoFile) {
    formData.append("logo", {
      uri: data.logoFile.uri,
      name: data.logoFile.name,
      type: data.logoFile.mimeType,
    } as unknown as Blob);
  }

  return authedRequest<Agency>("/agency/me", {
    method: "PATCH",
    body: formData,
  });
}

export interface UpdateAgencySettingsInput {
  defaultLanguage?: "fr" | "en";
  invoicePrefix?: string;
  adminFee?: number;
  weekendSurcharge?: number;
  highSeasonMultiplier?: number;
  highSeasonMonths?: number[];
  workingHoursStart?: string;
  workingHoursEnd?: string;
  autoReminders?: boolean;
  deliveryEnabled?: boolean;
  deliveryBasePointLabel?: string;
  deliveryBasePointAddress?: string;
  deliveryBasePointLat?: number;
  deliveryBasePointLng?: number;
  deliveryRatePerKm?: number;
  deliveryCurrency?: string;
  deliveryMinFee?: number;
  deliveryMaxDistanceKm?: number;
  bookingAutoCancelUnpaid?: boolean;
  bookingAutoCancelAfterHours?: number;
  bookingOptions?: AgencyBookingOption[];
  cashPaymentsEnabled?: boolean;
}

export async function updateAgencySettings(
  data: UpdateAgencySettingsInput,
): Promise<AgencySettings> {
  return authedRequest<AgencySettings>("/agency/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}
