import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getInvoiceById,
  getInvoices,
  getInvoicesSummary,
  recordPayment,
  sendInvoiceReminder,
  type InvoiceListFilters,
  type RecordPaymentInput,
} from "@/services/invoiceService";

export const invoiceKeys = {
  all: ["invoices"] as const,
  // Prefix used for cross-list invalidation. Append filters for the actual
  // query key — invalidating with this prefix matches every filtered list.
  lists: () => [...invoiceKeys.all, "list"] as const,
  list: (filters?: InvoiceListFilters) =>
    [...invoiceKeys.lists(), filters ?? {}] as const,
  detail: (id: string) => [...invoiceKeys.all, "detail", id] as const,
  summary: () => [...invoiceKeys.all, "summary"] as const,
};

// Invoice rows only mutate via Stripe webhooks or staff actions, both of
// which invalidate explicitly. 30s feels-fresh, halves redundant fetches.
const INVOICE_STALE_TIME_MS = 30_000;

export function useInvoices(
  filters?: InvoiceListFilters,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: invoiceKeys.list(filters),
    queryFn: () => getInvoices(filters),
    staleTime: INVOICE_STALE_TIME_MS,
    enabled: options?.enabled ?? true,
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: invoiceKeys.detail(id),
    queryFn: () => getInvoiceById(id),
    enabled: !!id,
    staleTime: INVOICE_STALE_TIME_MS,
  });
}

export function useInvoicesSummary() {
  return useQuery({
    queryKey: invoiceKeys.summary(),
    queryFn: getInvoicesSummary,
    staleTime: INVOICE_STALE_TIME_MS,
  });
}

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: RecordPaymentInput }) =>
      recordPayment(id, data),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: invoiceKeys.detail(variables.id) });
      qc.invalidateQueries({ queryKey: invoiceKeys.lists() });
      qc.invalidateQueries({ queryKey: invoiceKeys.summary() });
    },
  });
}

export function useSendInvoiceReminder() {
  return useMutation({
    mutationFn: (id: string) => sendInvoiceReminder(id),
  });
}
