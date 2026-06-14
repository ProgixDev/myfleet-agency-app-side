import { useQuery } from "@tanstack/react-query";
import { getSubscription } from "@/services/subscriptionService";

export const subscriptionKeys = {
  all: ["subscription"] as const,
};

/**
 * Reads the agency's platform subscription. Drives the in-app paywall: the
 * `(app)` layout blocks product screens while `data.active` is false. The
 * endpoint (`GET /agency/subscription`) is intentionally NOT subscription-gated
 * on the backend, so a lapsed agency can still load it to learn it must pay.
 */
export function useSubscription() {
  return useQuery({
    queryKey: subscriptionKeys.all,
    queryFn: getSubscription,
    staleTime: 60_000,
  });
}
