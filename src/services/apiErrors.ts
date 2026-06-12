import { ApiClientError } from "@/services/api";

/**
 * True when an error represents the AI credit gate: the backend meters AI
 * inspections against an agency credit ledger and returns HTTP 402 with
 * envelope `error.code === "INSUFFICIENT_CREDITS"` once credits run out.
 * AI credits are topped up on the web admin, not in the app.
 */
export function isInsufficientCredits(err: unknown): boolean {
  return (
    err instanceof ApiClientError &&
    (err.code === "INSUFFICIENT_CREDITS" || err.status === 402)
  );
}
