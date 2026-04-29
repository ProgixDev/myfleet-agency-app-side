import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { Booking, BookingStatus, BookingDraft, BookingOption } from '@/types/booking';
import { mockBookings } from '@/data/bookings';

// ── Types ────────────────────────────────────────────────────────────────────

interface BookingState {
  bookings: Booking[];
  draft: BookingDraft | null;
}

export interface CloseBookingPayload {
  returnMileage: number;
  fuelLevel?: number | null;
  notes?: string;
  postRentalInspectionId?: string;
}

export type MutationResult = { ok: true } | { ok: false; error: string };

/** A booking-shaped object that can participate in conflict detection —
 *  either the live draft or a committed Booking. */
export interface ConflictCandidate {
  id: string | null;
  vehicleId: string;
  startDate: string;
  endDate: string;
}

interface BookingActions {
  // Queries
  detectConflicts: (candidate: ConflictCandidate) => Booking[];
  findDraftConflicts: () => Booking[];

  // Mutations
  createBooking: (dailyRate: number) => Booking | null;
  updateBookingStatus: (id: string, status: BookingStatus) => void;
  cancelBooking: (id: string) => void;
  recordStartMileage: (bookingId: string, km: number) => MutationResult;
  closeBookingWithReturn: (bookingId: string, payload: CloseBookingPayload) => MutationResult;

  // Draft
  startDraft: () => void;
  updateDraft: (updates: Partial<BookingDraft>) => void;
  toggleDraftOption: (optionId: string) => void;
  discardDraft: () => void;
}

/** Agency-wide defaults when a booking/vehicle doesn't define its own pricing. */
export const DEFAULT_INCLUDED_KM = 200;
export const DEFAULT_EXTRA_KM_RATE = 0.3;

type BookingStore = BookingState & BookingActions;

// ── Helpers ──────────────────────────────────────────────────────────────────

function datesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  return s1 < e2 && s2 < e1;
}

/**
 * Pure: scans all bookings, finds overlapping non-cancelled pairs per vehicle,
 * and returns a new list with each booking's `conflict` field populated
 * (or cleared). Idempotent — stable object identity when nothing changed.
 */
function computeConflictAnnotations(bookings: Booking[]): Booking[] {
  const overlaps = new Map<string, Set<string>>();

  const nonCancelled = bookings.filter((b) => b.status !== 'cancelled');

  // Bucket by vehicle so we only compare within the same fleet unit
  const byVehicle = new Map<string, Booking[]>();
  for (const b of nonCancelled) {
    const list = byVehicle.get(b.vehicleId);
    if (list) list.push(b);
    else byVehicle.set(b.vehicleId, [b]);
  }

  for (const [, vehicleBookings] of byVehicle) {
    for (let i = 0; i < vehicleBookings.length; i++) {
      for (let j = i + 1; j < vehicleBookings.length; j++) {
        const a = vehicleBookings[i];
        const b = vehicleBookings[j];
        if (datesOverlap(a.startDate, a.endDate, b.startDate, b.endDate)) {
          if (!overlaps.has(a.id)) overlaps.set(a.id, new Set());
          if (!overlaps.has(b.id)) overlaps.set(b.id, new Set());
          overlaps.get(a.id)!.add(b.id);
          overlaps.get(b.id)!.add(a.id);
        }
      }
    }
  }

  const now = new Date().toISOString();

  return bookings.map((b) => {
    const ids = overlaps.get(b.id);

    if (!ids || ids.size === 0) {
      return b.conflict ? { ...b, conflict: undefined } : b;
    }

    const sorted = Array.from(ids).sort();
    const existing = b.conflict;
    const unchanged =
      existing &&
      existing.withBookingIds.length === sorted.length &&
      existing.withBookingIds.every((x, i) => x === sorted[i]);

    if (unchanged) return b;

    return {
      ...b,
      conflict: {
        withBookingIds: sorted,
        detectedAt: existing?.detectedAt ?? now,
      },
    };
  });
}

const DEFAULT_OPTIONS: BookingOption[] = [
  { id: 'ins', label: 'Insurance Plus', price: 15, enabled: false },
  { id: 'drv', label: 'Additional Driver', price: 10, enabled: false },
  { id: 'foreign-use', label: 'Foreign Use Pass', price: 25, enabled: false },
  { id: 'seat', label: 'Child Seat', price: 5, enabled: false },
];

// ── Store ────────────────────────────────────────────────────────────────────

export const useBookingStore = create<BookingStore>()((set, get) => ({
  // Annotate the seed mock data at app start so pre-existing overlaps surface
  // in the dashboard immediately.
  bookings: computeConflictAnnotations(mockBookings),
  draft: null,

  // ── Queries ──────────────────────────────────────────────────────────────

  detectConflicts: (candidate) => {
    return get().bookings.filter(
      (b) =>
        b.id !== candidate.id &&
        b.vehicleId === candidate.vehicleId &&
        b.status !== 'cancelled' &&
        datesOverlap(candidate.startDate, candidate.endDate, b.startDate, b.endDate),
    );
  },

  findDraftConflicts: () => {
    const draft = get().draft;
    if (!draft || !draft.vehicleId || !draft.startDate || !draft.endDate) return [];
    return get().detectConflicts({
      id: null,
      vehicleId: draft.vehicleId,
      startDate: draft.startDate,
      endDate: draft.endDate,
    });
  },

  // ── Mutations ────────────────────────────────────────────────────────────

  createBooking: (dailyRate) => {
    const { draft, bookings } = get();
    if (
      !draft ||
      !draft.vehicleId ||
      !draft.vehicleName ||
      !draft.clientId ||
      !draft.clientName ||
      !draft.startDate ||
      !draft.endDate
    )
      return null;

    const start = new Date(draft.startDate);
    const end = new Date(draft.endDate);
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
    const subtotal = dailyRate * days;
    const optionsTotal = draft.options
      .filter((o) => o.enabled)
      .reduce((s, o) => s + o.price * days, 0);
    const deliveryFee = draft.options
      .filter((o) => o.enabled && o.deliveryDetails)
      .reduce((s, o) => s + (o.deliveryDetails?.fee ?? 0), 0);

    const booking: Booking = {
      id: `bk-${Date.now()}`,
      vehicleId: draft.vehicleId,
      vehicleName: draft.vehicleName,
      clientId: draft.clientId,
      clientName: draft.clientName,
      startDate: draft.startDate,
      endDate: draft.endDate,
      status: 'confirmed',
      dailyRate,
      totalAmount: subtotal + optionsTotal + deliveryFee,
      deposit: Math.round(subtotal * 0.4),
      pickupLocation: draft.pickupLocation,
      returnLocation: draft.returnLocation,
      pickupTime: draft.pickupTime,
      returnTime: draft.returnTime,
      options: draft.options,
      notes: draft.notes,
      createdAt: new Date().toISOString().slice(0, 10),
    };

    const newBookings = computeConflictAnnotations([booking, ...bookings]);
    set({
      bookings: newBookings,
      draft: null,
    });
    // Return the freshly-annotated version so the caller sees conflict flags
    return newBookings.find((b) => b.id === booking.id) ?? booking;
  },

  updateBookingStatus: (id, status) =>
    set((s) => ({
      bookings: computeConflictAnnotations(
        s.bookings.map((b) => (b.id === id ? { ...b, status } : b)),
      ),
    })),

  cancelBooking: (id) =>
    set((s) => ({
      bookings: computeConflictAnnotations(
        s.bookings.map((b) =>
          b.id === id ? { ...b, status: 'cancelled' as const } : b,
        ),
      ),
    })),

  recordStartMileage: (bookingId, km) => {
    const booking = get().bookings.find((b) => b.id === bookingId);
    if (!booking) return { ok: false, error: 'bookingNotFound' };
    if (!Number.isFinite(km) || km < 0) return { ok: false, error: 'invalidMileage' };

    set((s) => ({
      bookings: s.bookings.map((b) =>
        b.id === bookingId ? { ...b, startMileage: Math.round(km) } : b,
      ),
    }));
    return { ok: true };
  },

  closeBookingWithReturn: (bookingId, payload) => {
    const booking = get().bookings.find((b) => b.id === bookingId);
    if (!booking) return { ok: false, error: 'bookingNotFound' };

    const { returnMileage } = payload;
    if (!Number.isFinite(returnMileage) || returnMileage < 0) {
      return { ok: false, error: 'invalidMileage' };
    }

    const startMileage = booking.startMileage;
    if (startMileage == null) return { ok: false, error: 'missingStartMileage' };
    if (returnMileage <= startMileage) return { ok: false, error: 'returnBelowStart' };

    const includedKm = booking.includedKm ?? DEFAULT_INCLUDED_KM;
    const extraKmRate = booking.extraKmRate ?? DEFAULT_EXTRA_KM_RATE;
    const kmDriven = Math.round(returnMileage - startMileage);
    const kmOverage = Math.max(0, kmDriven - includedKm);
    const overageCost = Math.round(kmOverage * extraKmRate * 100) / 100;

    const existingNotes = booking.notes ?? '';
    const mergedNotes = payload.notes
      ? existingNotes
        ? `${existingNotes}\n${payload.notes}`
        : payload.notes
      : existingNotes;

    set((s) => ({
      bookings: s.bookings.map((b) =>
        b.id === bookingId
          ? {
              ...b,
              status: 'completed' as const,
              returnMileage: Math.round(returnMileage),
              includedKm,
              extraKmRate,
              kmDriven,
              kmOverage,
              overageCost,
              notes: mergedNotes,
              workflow: {
                ...b.workflow,
                returnCompletedAt: new Date().toISOString(),
                ...(payload.postRentalInspectionId
                  ? { postInspectionId: payload.postRentalInspectionId }
                  : {}),
              },
            }
          : b,
      ),
    }));
    return { ok: true };
  },

  // ── Draft ────────────────────────────────────────────────────────────────

  startDraft: () =>
    set({
      draft: {
        vehicleId: null,
        vehicleName: null,
        clientId: null,
        clientName: null,
        startDate: null,
        endDate: null,
        pickupTime: '09:00',
        returnTime: '18:00',
        pickupLocation: 'Agence Paris Centre',
        returnLocation: 'Agence Paris Centre',
        options: DEFAULT_OPTIONS.map((o) => ({ ...o })),
        notes: '',
      },
    }),

  updateDraft: (updates) =>
    set((s) => (s.draft ? { draft: { ...s.draft, ...updates } } : s)),

  toggleDraftOption: (optionId) =>
    set((s) => {
      if (!s.draft) return s;
      const options = s.draft.options.map((o) =>
        o.id === optionId ? { ...o, enabled: !o.enabled } : o,
      );
      return { draft: { ...s.draft, options } };
    }),

  discardDraft: () => set({ draft: null }),
}));

// ── Selectors ────────────────────────────────────────────────────────────────

export function useBookingsForVehicle(vehicleId: string): Booking[] {
  return useBookingStore(
    useShallow((s) =>
      s.bookings.filter((b) => b.vehicleId === vehicleId && b.status !== 'cancelled'),
    ),
  );
}

export function useBookingsForDate(date: string): Booking[] {
  return useBookingStore(
    useShallow((s) =>
      s.bookings.filter(
        (b) => b.startDate <= date && b.endDate >= date && b.status !== 'cancelled',
      ),
    ),
  );
}

export function useVehicleAvailable(vehicleId: string, start: string | null, end: string | null): boolean {
  return useBookingStore(
    useShallow((s) => {
      if (!vehicleId || !start || !end) return true;
      const vehicleBookings = s.bookings.filter(
        (b) =>
          b.vehicleId === vehicleId &&
          b.status !== 'cancelled' &&
          b.status !== 'completed',
      );
      return !vehicleBookings.some((b) => datesOverlap(start, end, b.startDate, b.endDate));
    }),
  );
}

export function useConflictingBookings(): Booking[] {
  return useBookingStore(
    useShallow((s) =>
      s.bookings.filter((b) => b.conflict && b.conflict.withBookingIds.length > 0),
    ),
  );
}

export function useDraftConflicts(): Booking[] {
  return useBookingStore(
    useShallow((s) => {
      const draft = s.draft;
      if (!draft || !draft.vehicleId || !draft.startDate || !draft.endDate) return [];
      
      return s.bookings.filter(
        (b) =>
          b.id !== null &&
          b.vehicleId === draft.vehicleId &&
          b.status !== 'cancelled' &&
          datesOverlap(draft.startDate!, draft.endDate!, b.startDate, b.endDate),
      );
    }),
  );
}
