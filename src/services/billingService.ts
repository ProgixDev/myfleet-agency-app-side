import { delay, ApiResponse } from '@/services/api';

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

export type PaymentMethod = 'cash' | 'card' | 'bank-transfer' | 'cheque';

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  bookingId: string;
  clientId: string;
  invoiceNumber: string;
  items: InvoiceLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: InvoiceStatus;
  issuedAt: string;
  dueDate: string;
  paidAt: string;
  paymentMethod: PaymentMethod | null;
}

const mockInvoices: Invoice[] = [
  {
    id: 'inv-001',
    bookingId: 'b-001',
    clientId: 'c-001',
    invoiceNumber: 'INV-2026-0001',
    items: [
      { description: 'Dacia Duster - 5 days', quantity: 5, unitPrice: 350, total: 1750 },
      { description: 'Foreign Use Pass add-on', quantity: 5, unitPrice: 30, total: 150 },
    ],
    subtotal: 1900,
    tax: 380,
    total: 2280,
    status: 'sent',
    issuedAt: '2026-04-01T10:00:00Z',
    dueDate: '2026-04-10',
    paidAt: '',
    paymentMethod: null,
  },
  {
    id: 'inv-002',
    bookingId: 'b-002',
    clientId: 'c-002',
    invoiceNumber: 'INV-2026-0002',
    items: [
      { description: 'Renault Clio - 3 days', quantity: 3, unitPrice: 250, total: 750 },
    ],
    subtotal: 750,
    tax: 150,
    total: 900,
    status: 'paid',
    issuedAt: '2026-03-28T14:30:00Z',
    dueDate: '2026-04-05',
    paidAt: '2026-04-04T11:00:00Z',
    paymentMethod: 'card',
  },
];

export async function getInvoices(): Promise<ApiResponse<Invoice[]>> {
  await delay();
  return {
    data: mockInvoices,
    success: true,
  };
}

export async function createInvoice(
  bookingId: string
): Promise<ApiResponse<Invoice>> {
  await delay();
  const newInvoice: Invoice = {
    id: `inv-${Date.now()}`,
    bookingId,
    clientId: 'c-001',
    invoiceNumber: `INV-2026-${String(mockInvoices.length + 1).padStart(4, '0')}`,
    items: [
      { description: 'Vehicle rental', quantity: 1, unitPrice: 350, total: 350 },
    ],
    subtotal: 350,
    tax: 70,
    total: 420,
    status: 'draft',
    issuedAt: new Date().toISOString(),
    dueDate: '2026-04-30',
    paidAt: '',
    paymentMethod: null,
  };
  return {
    data: newInvoice,
    success: true,
    message: 'Invoice created successfully',
  };
}

export async function processPayment(
  invoiceId: string,
  amount: number
): Promise<ApiResponse<Invoice>> {
  await delay();
  const existing = mockInvoices.find((inv) => inv.id === invoiceId);
  if (!existing) {
    return {
      data: {} as Invoice,
      success: false,
      message: `Invoice with id "${invoiceId}" not found`,
    };
  }
  if (existing.status === 'paid') {
    return {
      data: existing,
      success: false,
      message: 'Invoice has already been paid',
    };
  }
  if (amount < existing.total) {
    return {
      data: existing,
      success: false,
      message: `Insufficient payment amount. Expected ${existing.total} MAD, received ${amount} MAD`,
    };
  }
  const paid: Invoice = {
    ...existing,
    status: 'paid',
    paidAt: new Date().toISOString(),
    paymentMethod: 'card',
  };
  return {
    data: paid,
    success: true,
    message: 'Payment processed successfully',
  };
}
