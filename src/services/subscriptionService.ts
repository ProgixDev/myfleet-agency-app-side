import { authedRequest } from "@/services/api";

export interface SubscriptionPlanOption {
  key: string;
  name: string;
  amount: number;
  currency: string;
  monthlyCredits: number;
  available: boolean;
  current: boolean;
}

/**
 * Agency platform subscription, mirroring the backend `SubscriptionView`.
 * `active` is the single source of truth for the paywall — it is true only
 * while Stripe reports the agency `active` or `trialing`, exactly the same
 * predicate the backend `SubscriptionGuard` enforces on product endpoints.
 */
export interface AgencySubscription {
  status: string | null;
  plan: string | null;
  currentPeriodEnd: string | null;
  active: boolean;
  plans: SubscriptionPlanOption[];
}

export async function getSubscription(): Promise<AgencySubscription> {
  return authedRequest<AgencySubscription>("/agency/subscription", {
    method: "GET",
  });
}
