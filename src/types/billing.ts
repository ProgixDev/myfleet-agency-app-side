export type InvoiceStatus = "pending" | "paid" | "overdue" | "partially-paid";

// Re-exported for legacy callers. New code should import from "@/types/payment".
export type { PaymentMethod } from "./payment";

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  /** In cents (smallest currency unit). */
  unitPrice: number;
  /** In cents. */
  total: number;
}

export interface Invoice {
  id: string;
  reference: string; // INV-2026-XXXX
  bookingId: string | null;
  vehicleId: string;
  vehicleName: string;
  clientId: string;
  clientName: string;
  status: InvoiceStatus;
  issuedDate: string;
  dueDate: string;
  lineItems: InvoiceLineItem[];
  /** In cents (smallest currency unit). */
  subtotal: number;
  /** In cents. */
  deposit: number;
  /** In cents. */
  damageCharges: number;
  /** In cents. */
  lateReturnFee: number;
  /** In cents. */
  violationCharges: number;
  /** In cents. */
  totalDue: number;
  /** In cents. Aggregated from the payment ledger; readers shouldn't recompute. */
  amountPaid: number;
  /** In cents. */
  remainingBalance: number;
  notes: string;
}

export interface PricingConfig {
  weekendSurcharge: number;
  highSeasonMultiplier: number;
  highSeasonMonths: number[];
  longRentalDiscounts: { minDays: number; discount: number }[];
}
