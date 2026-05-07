import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getPayments,
  recordPayment,
  refundPayment,
  type PaymentFilters,
  type RecordChargePayload,
  type RefundPayload,
} from "@/services/paymentService";

export const paymentKeys = {
  all: ["payments"] as const,
  list: (filters?: PaymentFilters) =>
    [...paymentKeys.all, "list", filters ?? {}] as const,
};

export function usePayments(filters?: PaymentFilters) {
  return useQuery({
    queryKey: paymentKeys.list(filters),
    queryFn: async () => {
      const res = await getPayments(filters);
      return res.data ?? [];
    },
    enabled:
      // Avoid unbounded list pulls — require at least one filter.
      filters !== undefined &&
      (filters.bookingId !== undefined ||
        filters.invoiceId !== undefined ||
        filters.clientId !== undefined ||
        filters.status !== undefined),
  });
}

function invalidatePayments(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: paymentKeys.all });
}

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: RecordChargePayload) => {
      const res = await recordPayment(payload);
      if (!res.data) throw new Error("Failed to record payment");
      return res.data;
    },
    onSuccess: (_payment) => {
      invalidatePayments(qc);
      // Settlements update aggregates on booking/invoice; invalidate those too.
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

export function useRefundPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: RefundPayload;
    }) => {
      const res = await refundPayment(id, payload);
      if (!res.data) throw new Error("Failed to refund payment");
      return res.data;
    },
    onSuccess: () => {
      invalidatePayments(qc);
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}
