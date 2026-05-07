import { create } from "zustand";
import type { Invoice, InvoiceStatus, PaymentMethod } from "@/types/billing";
import { mockInvoices } from "@/data/billing";

// ── Types ────────────────────────────────────────────────────────────────────

interface BillingState {
  invoices: Invoice[];
}

interface BillingActions {
  getMonthlyRevenue: () => number;
  getPendingAmount: () => number;
  getOverdueAmount: () => number;
  recordPayment: (
    invoiceId: string,
    amount: number,
    method: PaymentMethod,
  ) => void;
  updateInvoiceStatus: (id: string, status: InvoiceStatus) => void;
}

type BillingStore = BillingState & BillingActions;

// ── Store ────────────────────────────────────────────────────────────────────

export const useBillingStore = create<BillingStore>()((set, get) => ({
  invoices: mockInvoices,

  // ── Queries ──────────────────────────────────────────────────────────────

  getMonthlyRevenue: () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-based

    // Real revenue is computed server-side from the payment ledger; this
    // local-store fallback approximates by bucketing on issuedDate.
    return get()
      .invoices.filter((inv) => inv.status === "paid")
      .filter((inv) => {
        const d = new Date(inv.issuedDate);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .reduce((sum, inv) => sum + inv.amountPaid, 0);
  },

  getPendingAmount: () =>
    get()
      .invoices.filter((inv) => inv.status === "pending")
      .reduce((sum, inv) => sum + inv.remainingBalance, 0),

  getOverdueAmount: () =>
    get()
      .invoices.filter((inv) => inv.status === "overdue")
      .reduce((sum, inv) => sum + inv.remainingBalance, 0),

  // ── Mutations ────────────────────────────────────────────────────────────

  // Local-only optimistic update used by demo screens. Real settlement goes
  // through the payments API (POST /payments) and is reflected on the next
  // invoice fetch.
  recordPayment: (invoiceId, amount, _method) =>
    set((state) => ({
      invoices: state.invoices.map((inv) => {
        if (inv.id !== invoiceId) return inv;
        const newAmountPaid = inv.amountPaid + amount;
        const newBalance = Math.max(0, inv.totalDue - newAmountPaid);
        const newStatus: InvoiceStatus =
          newBalance === 0 ? "paid" : "partially-paid";
        return {
          ...inv,
          amountPaid: newAmountPaid,
          remainingBalance: newBalance,
          status: newStatus,
        };
      }),
    })),

  updateInvoiceStatus: (id, status) =>
    set((state) => ({
      invoices: state.invoices.map((inv) =>
        inv.id === id ? { ...inv, status } : inv,
      ),
    })),
}));
