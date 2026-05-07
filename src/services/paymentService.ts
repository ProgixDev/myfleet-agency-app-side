import { authedRequest, type ApiResponse } from "@/services/api";
import { ok, toQuery } from "@/services/_helpers";
import type { Payment, PaymentMethod } from "@/types/payment";

export interface PaymentFilters {
  bookingId?: string;
  invoiceId?: string;
  clientId?: string;
  status?: Payment["status"];
}

export interface RecordChargePayload {
  bookingId?: string;
  invoiceId?: string;
  amount: number;
  currency?: string;
  method: PaymentMethod;
  processor?: "stripe" | "manual";
  notes?: string;
  processorChargeId?: string;
}

export interface RefundPayload {
  amount: number;
  notes?: string;
  processorChargeId?: string;
}

export async function getPayments(
  filters: PaymentFilters = {},
): Promise<ApiResponse<Payment[]>> {
  const data = await authedRequest<Payment[]>(`/payments${toQuery(filters)}`);
  return ok(data);
}

export async function recordPayment(
  payload: RecordChargePayload,
): Promise<ApiResponse<Payment>> {
  const data = await authedRequest<Payment>("/payments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return ok(data);
}

export async function refundPayment(
  id: string,
  payload: RefundPayload,
): Promise<ApiResponse<Payment>> {
  const data = await authedRequest<Payment>(`/payments/${id}/refund`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return ok(data);
}
