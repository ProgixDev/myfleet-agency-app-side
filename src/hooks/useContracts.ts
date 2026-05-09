import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContract,
  getContractById,
  getContractPdfUrl,
  getContracts,
  regenerateContract,
  signContract,
} from "@/services/contractService";
import type { Contract } from "@/types/contract";

export interface ContractListFilters {
  bookingId?: string;
  clientId?: string;
  status?: Contract["status"];
}

export const contractKeys = {
  all: ["contracts"] as const,
  list: (filters?: ContractListFilters) =>
    [...contractKeys.all, "list", filters ?? {}] as const,
  detail: (id: string) => [...contractKeys.all, "detail", id] as const,
  pdf: (id: string) => [...contractKeys.all, "pdf", id] as const,
};

export function useContracts(filters?: ContractListFilters) {
  return useQuery({
    queryKey: contractKeys.list(filters),
    queryFn: async () => (await getContracts(filters)).data ?? [],
    staleTime: 30_000,
  });
}

export function useContract(id: string | undefined) {
  return useQuery({
    queryKey: contractKeys.detail(id ?? "_"),
    queryFn: async () => (await getContractById(id as string)).data,
    enabled: typeof id === "string" && id.length > 0,
    staleTime: 10_000,
  });
}

export function useContractPdfUrl(id: string | undefined) {
  return useQuery({
    queryKey: contractKeys.pdf(id ?? "_"),
    queryFn: async () => (await getContractPdfUrl(id as string)).data,
    enabled: typeof id === "string" && id.length > 0,
    staleTime: 5 * 60_000,
  });
}

export function useCreateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { bookingId: string; notes?: string }) => {
      const res = await createContract(payload);
      if (!res.data) throw new Error("Failed to create contract");
      return res.data;
    },
    onSuccess: (contract) => {
      void qc.invalidateQueries({ queryKey: contractKeys.all });
      qc.setQueryData(contractKeys.detail(contract.id), contract);
    },
  });
}

/** Admin-only mutation that regenerates the contract PDF in place. */
export function useRegenerateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await regenerateContract(id);
      if (!res.data) throw new Error("Failed to regenerate contract");
      return res.data;
    },
    onSuccess: (contract) => {
      void qc.invalidateQueries({ queryKey: contractKeys.all });
      qc.setQueryData(contractKeys.detail(contract.id), contract);
      void qc.invalidateQueries({ queryKey: contractKeys.pdf(contract.id) });
    },
  });
}

export function useSignContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: {
        role: "lessee" | "lessor";
        svg: string;
        signerName: string;
      };
    }) => {
      const res = await signContract(id, payload);
      if (!res.data) throw new Error("Failed to sign contract");
      return res.data;
    },
    onSuccess: (contract) => {
      void qc.invalidateQueries({ queryKey: contractKeys.all });
      qc.setQueryData(contractKeys.detail(contract.id), contract);
    },
  });
}
