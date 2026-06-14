import { z } from "zod";

import { authedRequest, type ApiResponse } from "@/services/api";
import { ok } from "@/services/_helpers";

// ── Types ─────────────────────────────────────────────────────────────────────

export type MessageSenderRole = "client" | "agency";

export interface BookingMessage {
  id: string;
  bookingId: string;
  senderRole: MessageSenderRole;
  senderUserId: string;
  body: string;
  createdAt: string;
}

// ── Edge validation ─────────────────────────────────────────────────────────
// Network responses are external input — parse them at the boundary (AGENTS.md).

const bookingMessageSchema = z.object({
  id: z.string(),
  bookingId: z.string(),
  senderRole: z.enum(["client", "agency"]),
  senderUserId: z.string(),
  body: z.string(),
  createdAt: z.string(),
});

const bookingMessageListSchema = z.array(bookingMessageSchema);

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * List all messages on a booking, oldest first (server order is preserved).
 * Agency is derived from the JWT server-side — no x-agency-id header needed.
 */
export async function listBookingMessages(
  bookingId: string,
): Promise<ApiResponse<BookingMessage[]>> {
  const data = await authedRequest<unknown>(
    `/bookings/${bookingId}/messages`,
  );
  return ok(bookingMessageListSchema.parse(data));
}

/**
 * Post a new agency message to a booking. The senderRole is set to 'agency'
 * server-side based on the authenticated staff user.
 */
export async function sendBookingMessage(
  bookingId: string,
  body: string,
): Promise<ApiResponse<BookingMessage>> {
  const data = await authedRequest<unknown>(
    `/bookings/${bookingId}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    },
  );
  return ok(bookingMessageSchema.parse(data));
}
