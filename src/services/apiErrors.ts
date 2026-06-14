import { ApiClientError } from "@/services/api";

/**
 * True when an error represents the AI credit gate: the backend meters AI
 * inspections against an agency credit ledger and returns HTTP 402 with
 * envelope `error.code === "INSUFFICIENT_CREDITS"` once credits run out.
 * AI credits are topped up on the web admin, not in the app.
 */
export function isInsufficientCredits(err: unknown): boolean {
  return (
    err instanceof ApiClientError && err.code === "INSUFFICIENT_CREDITS"
  );
}

/**
 * True when an error is the platform subscription gate: the backend returns
 * HTTP 402 with envelope `error.code === "SUBSCRIPTION_REQUIRED"` from staff
 * product endpoints when the agency has no active subscription. Subscriptions
 * are purchased on the web admin. Checked by `code` (not status) so it never
 * collides with the AI credit gate, which is also a 402.
 */
export function isSubscriptionRequired(err: unknown): boolean {
  return (
    err instanceof ApiClientError && err.code === "SUBSCRIPTION_REQUIRED"
  );
}
