import { authedRequest, type ApiResponse } from "@/services/api";
import { ok, toQuery } from "@/services/_helpers";
import type { Contract } from "@/types/contract";

interface ContractFilters {
  bookingId?: string;
  clientId?: string;
  status?: Contract["status"];
}

export async function getContracts(
  filters: ContractFilters = {},
): Promise<ApiResponse<Contract[]>> {
  const data = await authedRequest<Contract[]>(`/contracts${toQuery(filters)}`);
  return ok(data);
}

export async function getContractById(
  id: string,
): Promise<ApiResponse<Contract>> {
  const data = await authedRequest<Contract>(`/contracts/${id}`);
  return ok(data);
}

export async function createContract(payload: {
  bookingId: string;
  notes?: string;
}): Promise<ApiResponse<Contract>> {
  const data = await authedRequest<Contract>("/contracts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return ok(data);
}

export async function signContract(
  id: string,
  payload: {
    role: "lessee" | "lessor";
    svg: string;
    signerName: string;
  },
): Promise<ApiResponse<Contract>> {
  const data = await authedRequest<Contract>(`/contracts/${id}/sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return ok(data);
}

export async function getContractPdfUrl(
  id: string,
): Promise<ApiResponse<{ url: string | null }>> {
  const data = await authedRequest<{ url: string | null }>(
    `/contracts/${id}/pdf`,
  );
  return ok(data);
}

/** Role of the signing party: 'client' = lessee, 'agent' = lessor. */
export type ContractSignatureRole = "client" | "agent";

/** Returns a short-TTL signed URL to the captured signature SVG for the given
 *  party, or `{ url: null }` when that party hasn't signed yet. */
export async function getContractSignatureUrl(
  id: string,
  role: ContractSignatureRole,
): Promise<ApiResponse<{ url: string | null }>> {
  const data = await authedRequest<{ url: string | null }>(
    `/contracts/${id}/signature/${role}`,
  );
  return ok(data);
}

/** Admin-only: re-render the contract PDF in place (e.g. after fixing
 *  agency profile data). Returns the updated contract row. */
export async function regenerateContract(
  id: string,
): Promise<ApiResponse<Contract>> {
  const data = await authedRequest<Contract>(`/contracts/${id}/regenerate`, {
    method: "POST",
  });
  return ok(data);
}
