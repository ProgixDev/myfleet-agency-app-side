import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { Client, ClientStats } from '@/types/client';
import { mockClients } from '@/data/clients';
import { mockBookings } from '@/data/bookings';

// ── Types ────────────────────────────────────────────────────────────────────

interface ClientState {
  clients: Client[];
  selectedClient: Client | null;
  searchQuery: string;
}

interface ClientActions {
  setClients: (clients: Client[]) => void;
  addClient: (client: Client) => void;
  updateClient: (id: string, updates: Partial<Client>) => void;
  selectClient: (client: Client | null) => void;
  searchClients: (query: string) => void;
  flagClient: (id: string, reason: string) => void;
  unflagClient: (id: string) => void;
}

type ClientStore = ClientState & ClientActions;

// ── Store ────────────────────────────────────────────────────────────────────

export const useClientStore = create<ClientStore>()((set) => ({
  // State
  clients: mockClients,
  selectedClient: null,
  searchQuery: '',

  // Actions
  setClients: (clients) => set({ clients }),

  addClient: (client) =>
    set((state) => ({
      clients: [...state.clients, client],
    })),

  updateClient: (id, updates) =>
    set((state) => ({
      clients: state.clients.map((c) =>
        c.id === id ? { ...c, ...updates } : c,
      ),
      selectedClient:
        state.selectedClient?.id === id
          ? { ...state.selectedClient, ...updates }
          : state.selectedClient,
    })),

  selectClient: (client) => set({ selectedClient: client }),

  searchClients: (query) => set({ searchQuery: query }),

  flagClient: (id, reason) =>
    set((state) => ({
      clients: state.clients.map((c) =>
        c.id === id
          ? {
              ...c,
              tags: c.tags.includes('flagged') ? c.tags : [...c.tags, 'flagged'],
              flagReason: reason,
            }
          : c,
      ),
      selectedClient:
        state.selectedClient?.id === id
          ? {
              ...state.selectedClient,
              tags: state.selectedClient.tags.includes('flagged')
                ? state.selectedClient.tags
                : [...state.selectedClient.tags, 'flagged'],
              flagReason: reason,
            }
          : state.selectedClient,
    })),

  unflagClient: (id) =>
    set((state) => ({
      clients: state.clients.map((c) =>
        c.id === id
          ? {
              ...c,
              tags: c.tags.filter((t) => t !== 'flagged'),
              flagReason: null,
            }
          : c,
      ),
      selectedClient:
        state.selectedClient?.id === id
          ? {
              ...state.selectedClient,
              tags: state.selectedClient.tags.filter((t) => t !== 'flagged'),
              flagReason: null,
            }
          : state.selectedClient,
    })),
}));

// ── Selectors ────────────────────────────────────────────────────────────────

export function useFilteredClients(): Client[] {
  return useClientStore(
    useShallow((state) => {
      const { clients, searchQuery } = state;
      if (!searchQuery.trim()) return clients;

      const lower = searchQuery.toLowerCase();
      return clients.filter(
        (c) =>
          c.firstName.toLowerCase().includes(lower) ||
          c.lastName.toLowerCase().includes(lower) ||
          c.email.toLowerCase().includes(lower) ||
          c.phone.includes(searchQuery),
      );
    }),
  );
}

export function useClientStats(id: string): ClientStats {
  // Stats calculation depends on bookings and clients
  // For now it uses mockBookings directly, we might want to use useBookingStore later
  // but we'll keep it simple and stable.
  return useClientStore(
    useShallow(() => {
      const clientBookings = mockBookings.filter(
        (b) => b.clientId === id && b.status !== 'cancelled',
      );

      const totalRentals = clientBookings.length;
      const totalSpent = clientBookings.reduce((sum, b) => sum + b.totalAmount, 0);

      const completedOrActive = clientBookings
        .filter((b) => b.status === 'completed' || b.status === 'active')
        .sort((a, b) => b.startDate.localeCompare(a.startDate));

      const lastRentalDate =
        completedOrActive.length > 0 ? completedOrActive[0].startDate : null;

      const durations = clientBookings.map((b) => {
        const start = new Date(b.startDate);
        const end = new Date(b.endDate);
        return Math.ceil(
          (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
        );
      });
      const avgDuration =
        durations.length > 0
          ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
          : 0;

      const hasActiveBooking = clientBookings.some(
        (b) => b.status === 'active' || b.status === 'confirmed' || b.status === 'pending',
      );

      return { totalRentals, totalSpent, lastRentalDate, avgDuration, hasActiveBooking };
    }),
  );
}
