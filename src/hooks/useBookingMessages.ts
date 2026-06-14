import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { messageKeys } from "@/lib/queryKeys";
import {
  listBookingMessages,
  sendBookingMessage,
  type BookingMessage,
} from "@/services/messageService";

/**
 * Polled list of booking messages. Refetches every 5s for near-realtime chat;
 * polling pauses while the app is backgrounded (React Query default).
 */
export function useBookingMessages(bookingId: string | undefined) {
  return useQuery<BookingMessage[]>({
    queryKey: messageKeys.list(bookingId ?? "_"),
    queryFn: async () => (await listBookingMessages(bookingId as string)).data,
    enabled: typeof bookingId === "string" && bookingId.length > 0,
    refetchInterval: 5000,
    staleTime: 0,
  });
}

/**
 * Send an agency message, then invalidate the list so the new message appears.
 */
export function useSendBookingMessage(bookingId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      if (!bookingId) throw new Error("Missing booking id");
      const res = await sendBookingMessage(bookingId, body);
      return res.data;
    },
    onSuccess: () => {
      if (!bookingId) return;
      void qc.invalidateQueries({ queryKey: messageKeys.list(bookingId) });
    },
  });
}
