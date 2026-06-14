import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAgency,
  getAgencyDocuments,
  getAgencySettings,
  getTeam,
  inviteTeamMember,
  updateAgency,
  updateAgencyDocument,
  updateAgencySettings,
  type InviteTeamMemberInput,
  type UpdateAgencyInput,
  type UpdateAgencySettingsInput,
} from "@/services/agencyService";
import type {
  Agency,
  AgencyDocumentType,
  AgencySettings,
  AgencyUser,
} from "@/types/agency";

export const agencyKeys = {
  all: ["agency"] as const,
  me: () => [...agencyKeys.all, "me"] as const,
  settings: () => [...agencyKeys.all, "settings"] as const,
  team: () => [...agencyKeys.all, "team"] as const,
};

export function useAgency() {
  return useQuery({
    queryKey: agencyKeys.me(),
    queryFn: getAgency,
  });
}

export function useAgencySettings() {
  return useQuery({
    queryKey: agencyKeys.settings(),
    queryFn: getAgencySettings,
  });
}

export function useTeam() {
  return useQuery({
    queryKey: agencyKeys.team(),
    queryFn: getTeam,
  });
}

export function useInviteTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: InviteTeamMemberInput) => inviteTeamMember(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agencyKeys.team() });
    },
  });
}

export function useUpdateAgency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateAgencyInput) => updateAgency(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agencyKeys.me() });
    },
  });
}

export function useUpdateAgencySettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateAgencySettingsInput) => updateAgencySettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agencyKeys.settings() });
    },
  });
}

export function useAgencyDocuments() {
  return useQuery({
    queryKey: [...agencyKeys.all, "documents"],
    queryFn: getAgencyDocuments,
  });
}

export function useUpdateAgencyDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      type,
      file,
    }: {
      type: AgencyDocumentType;
      file: { uri: string; name: string; mimeType: string };
    }) => updateAgencyDocument(type, file),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...agencyKeys.all, "documents"],
      });
    },
  });
}
