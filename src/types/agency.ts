export interface DeliverySettings {
  enabled: boolean;
  /** Human-readable label (e.g. "Agence Genève-Centre"). */
  basePointLabel: string;
  /** Raw address the user typed (pre-geocoding). */
  basePointAddress: string;
  /** Geocoded latitude. 0 means "not yet resolved". */
  basePointLat: number;
  /** Geocoded longitude. 0 means "not yet resolved". */
  basePointLng: number;
  /** Cost per driving km (in `currency`). */
  ratePerKm: number;
  currency: string;
  /** Optional minimum fee charged regardless of distance. */
  minFee?: number;
  /** Optional maximum driving distance allowed for delivery. */
  maxDistanceKm?: number;
}

export interface AgencySettings {
  defaultLanguage: 'fr' | 'en';
  invoicePrefix: string;
  adminFee: number;
  weekendSurcharge: number;
  highSeasonMultiplier: number;
  workingHoursStart: string;
  workingHoursEnd: string;
  autoReminders: boolean;
  delivery: DeliverySettings;
}

export interface Agency {
  id: string;
  name: string;
  slug: string;
  logo: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  currency: 'EUR' | 'CHF' | 'USD';
  country: string;
  timezone: string;
  plan: 'starter' | 'professional' | 'enterprise';
  subscription: {
    status: 'active' | 'trial' | 'expired';
    startDate: string;
    nextBillingDate: string;
    monthlyPrice: number;
  };
  settings: AgencySettings;
  createdAt: string;
}

export interface AgencyUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'employee';
  lastActive: string;
}
