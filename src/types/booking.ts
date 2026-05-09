export type BookingStatus =
  | "pending"
  | "confirmed"
  | "active"
  | "completed"
  | "cancelled";

export interface DeliveryDetails {
  address: string;
  lat: number;
  lng: number;
  distanceKm: number;
  /** One-time fee in the agency's configured currency. */
  fee: number;
}

export interface BookingOption {
  id: string;
  label: string;
  /** Per-day rate in cents. Set to 0 for one-time distance options (see deliveryDetails.fee). */
  price: number;
  enabled: boolean;
  /** Set when a distance-based option, such as delivery or custom recovery, has a resolved address. */
  deliveryDetails?: DeliveryDetails;
}

export interface PricingBreakdown {
  /** In cents (smallest currency unit). */
  dailyRate: number;
  days: number;
  /** In cents. */
  subtotal: number;
  options: BookingOption[];
  /** In cents. */
  optionsTotal: number;
  /** One-time delivery fee in cents (0 when no delivery option is enabled). */
  deliveryFee: number;
  /** In cents. */
  deposit: number;
  /** In cents. */
  total: number;
}

export interface TimelineStep {
  key: string;
  label: string;
  date: string | null;
  completed: boolean;
  active: boolean;
}

export interface Booking {
  id: string;
  vehicleId: string;
  vehicleName: string;
  clientId: string;
  clientName: string;
  startDate: string;
  endDate: string;
  status: BookingStatus;
  /** In cents (smallest currency unit). */
  dailyRate: number;
  /** In cents. */
  totalAmount: number;
  /** In cents. */
  deposit: number;
  pickupLocation: string;
  returnLocation: string;
  pickupTime: string;
  returnTime: string;
  options: BookingOption[];
  notes: string;
  createdAt: string;

  // Deposit lifecycle. The deposit is a Stripe manual-capture authorization
  // (or cash held by the agent). Captured amount produces a payment row on
  // the damages invoice; released auths just void.
  depositStatus?:
    | "none"
    | "held"
    | "captured"
    | "partially_captured"
    | "released"
    | "forfeited"
    | "failed";
  /** Stripe PaymentIntent id (pi_…) for the deposit auth. */
  depositPaymentIntentId?: string;
  /** In cents. How much of the held deposit has actually been captured. */
  depositCapturedAmount?: number;
  depositAuthorizedAt?: string;
  depositCapturedAt?: string;
  depositReleasedAt?: string;
  /** Stripe auths expire ~7 days after authorization. */
  depositExpiresAt?: string;
  depositFailureReason?: string;

  /** Denormalized pointer to the rental invoice issued at confirmation. */
  rentalInvoiceId?: string;
  /** Denormalized pointer to the damages invoice issued at close. */
  damagesInvoiceId?: string;

  /** Selected at booking creation. 'cash' means agent collects cash at pickup. Undefined reads as 'online'. */
  paymentMethod?: "online" | "cash";
  /** Channel that submitted the booking. Undefined treated as 'agency'. */
  source?: "agency" | "client";
  /** UUID of the auth principal (agent or client) who created the booking. */
  createdByUserId?: string | null;

  // Insurance fields
  insurance?: {
    tier: "basic" | "all_inclusive";
    /** In cents. 0 for basic, 2500 for all-inclusive. */
    dailyRate: number;
    /** In cents. */
    totalCost: number;
    /** In cents. 150000 for basic, 0 for all-inclusive. */
    excess: number;
  };

  // Auto-cancel
  autoCancelAt?: string;

  // Workflow linkage
  workflow?: {
    pickupStartedAt?: string;
    pickupCompletedAt?: string;
    returnStartedAt?: string;
    returnCompletedAt?: string;
    preInspectionId?: string;
    postInspectionId?: string;
    contractId?: string;
    returnContractId?: string;
    contractSentAt?: string;
    contractSignedAt?: string;
    invoiceSentAt?: string;
    invoiceId?: string;
    paymentReceivedAt?: string;
  };

  // Mileage (recorded at pickup / return)
  startMileage?: number;
  returnMileage?: number;
  /** Total km included in the rental (absolute, not per-day). */
  includedKm?: number;
  /** Cost per km above includedKm, in CHF. */
  extraKmRate?: number;
  kmDriven?: number;
  kmOverage?: number;
  overageCost?: number;

  /** Detected double-booking. Populated by the store; undefined when clean. */
  conflict?: {
    /** Other bookings this one overlaps with (on the same vehicle). */
    withBookingIds: string[];
    detectedAt: string;
  };
}

export interface BookingDraft {
  vehicleId: string | null;
  vehicleName: string | null;
  clientId: string | null;
  clientName: string | null;
  startDate: string | null;
  endDate: string | null;
  pickupTime: string;
  returnTime: string;
  pickupLocation: string;
  returnLocation: string;
  options: BookingOption[];
  notes: string;
  insuranceTier?: "basic" | "all_inclusive";
}
