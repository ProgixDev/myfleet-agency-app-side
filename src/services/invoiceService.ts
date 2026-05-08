import { authedRequest } from "@/services/api";
import type { Invoice } from "@/types/billing";

export interface InvoicesSummary {
  monthlyRevenueCents: number;
  pendingCents: number;
  overdueCents: number;
}

export interface RecordPaymentInput {
  amount: number;
  method: "card" | "cash" | "transfer";
  date?: string;
  reference?: string;
}

export interface InvoiceListFilters {
  bookingId?: string;
  kind?: "rental" | "damages";
  status?: string;
}

export async function getInvoices(
  filters?: InvoiceListFilters,
): Promise<Invoice[]> {
  const qs = new URLSearchParams();
  if (filters?.bookingId) qs.set("bookingId", filters.bookingId);
  if (filters?.kind) qs.set("kind", filters.kind);
  if (filters?.status) qs.set("status", filters.status);
  const query = qs.toString();
  return authedRequest<Invoice[]>(query ? `/invoices?${query}` : `/invoices`, {
    method: "GET",
  });
}

export async function getInvoiceById(id: string): Promise<Invoice> {
  return authedRequest<Invoice>(`/invoices/${id}`, { method: "GET" });
}

export async function getInvoicesSummary(): Promise<InvoicesSummary> {
  return authedRequest<InvoicesSummary>(`/invoices/summary`, { method: "GET" });
}

export async function recordPayment(
  id: string,
  data: RecordPaymentInput,
): Promise<Invoice> {
  return authedRequest<Invoice>(`/invoices/${id}/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function sendInvoiceReminder(id: string): Promise<void> {
  await authedRequest<{ ok: true }>(`/invoices/${id}/send-reminder`, {
    method: "POST",
  });
}
