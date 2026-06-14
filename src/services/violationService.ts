import { authedRequest } from "@/services/api";
import type { Violation } from "@/types/violation";

export interface ViolationFilters {
  status?: Violation["status"];
  search?: string;
  /** Filter by agency_client.id (GET /violations?clientId=). */
  clientId?: string;
  /** Filter by booking (GET /violations?bookingId=). */
  bookingId?: string;
}

export interface ViolationSummary {
  totalFines: number;
  pendingCount: number;
  total: number;
}

export interface ViolationLookupResult {
  vehicle: {
    id: string;
    name: string;
    brand: string;
    licensePlate: string;
  } | null;
  booking: { id: string } | null;
  client: { id: string; name: string } | null;
}

export interface CreateViolationInput {
  reference: string;
  vehicleId: string;
  licensePlate: string;
  bookingId?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  type: Violation["type"];
  date: string;
  fineAmount: number;
  adminFee?: number;
  location?: string;
  description?: string;
  notes?: string;
}

function buildQuery(params: Record<string, string | undefined>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    }
  }
  return parts.length > 0 ? `?${parts.join("&")}` : "";
}

export async function getViolations(
  filters: ViolationFilters = {},
): Promise<Violation[]> {
  const qs = buildQuery({
    status: filters.status,
    search: filters.search,
    clientId: filters.clientId,
    bookingId: filters.bookingId,
  });
  return authedRequest<Violation[]>(`/violations${qs}`, { method: "GET" });
}

export async function getViolationById(id: string): Promise<Violation> {
  return authedRequest<Violation>(`/violations/${id}`, { method: "GET" });
}

export async function getViolationsSummary(): Promise<ViolationSummary> {
  return authedRequest<ViolationSummary>(`/violations/summary`, {
    method: "GET",
  });
}

export async function lookupViolation(
  licensePlate: string,
  date: string,
): Promise<ViolationLookupResult> {
  const qs = buildQuery({ licensePlate, date });
  return authedRequest<ViolationLookupResult>(`/violations/lookup${qs}`, {
    method: "GET",
  });
}

export async function createViolation(
  data: CreateViolationInput,
): Promise<Violation> {
  return authedRequest<Violation>(`/violations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateViolationStatus(
  id: string,
  status: Violation["status"],
): Promise<Violation> {
  return authedRequest<Violation>(`/violations/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}
