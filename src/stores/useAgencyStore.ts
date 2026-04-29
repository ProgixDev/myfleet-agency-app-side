import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AgencyProfile {
  id: string;
  name: string;
  qrUrl: string;
}

interface AgencyState {
  /** The agency currently being viewed/edited. Driven by auth in prod and by
   *  the __DEV__ agency switcher in development. */
  currentAgencyId: string;
  /** All tenants known to the app, keyed by id. */
  agencies: Record<string, AgencyProfile>;
}

interface AgencyActions {
  setCurrentAgencyId: (id: string) => void;
  setAgencyName: (name: string) => void;
  upsertAgency: (profile: AgencyProfile) => void;
}

type AgencyStore = AgencyState & AgencyActions;

// ── Seed tenants (dev mock — backend replaces this later) ───────────────────

const SEED_AGENCIES: Record<string, AgencyProfile> = {
  'agency-001': {
    id: 'agency-001',
    name: 'Geneva Luxury Rentals',
    qrUrl: 'myfleet.app/agency/agency-001',
  },
  'agency-002': {
    id: 'agency-002',
    name: 'Zurich Prestige Motors',
    qrUrl: 'myfleet.app/agency/agency-002',
  },
};

export const SEED_AGENCY_IDS = Object.keys(SEED_AGENCIES);

const DEFAULT_AGENCY_ID = 'agency-001';

// ── Store ────────────────────────────────────────────────────────────────────

export const useAgencyStore = create<AgencyStore>()(
  persist(
    (set) => ({
      currentAgencyId: DEFAULT_AGENCY_ID,
      agencies: SEED_AGENCIES,

      setCurrentAgencyId: (id) => set({ currentAgencyId: id }),

      setAgencyName: (name) =>
        set((s) => {
          const current = s.agencies[s.currentAgencyId];
          if (!current) return s;
          return {
            agencies: {
              ...s.agencies,
              [s.currentAgencyId]: { ...current, name },
            },
          };
        }),

      upsertAgency: (profile) =>
        set((s) => ({
          agencies: { ...s.agencies, [profile.id]: profile },
        })),
    }),
    {
      name: 'my-fleet-agency',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      // Keep seeds present even after a user's edits are rehydrated:
      // persisted entries win per-id, but new seeds still get backfilled.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AgencyState>;
        return {
          ...current,
          ...p,
          agencies: { ...current.agencies, ...(p.agencies ?? {}) },
        } as AgencyStore;
      },
    },
  ),
);

// ── Selectors ────────────────────────────────────────────────────────────────

/**
 * Returns the profile of the currently-selected agency.
 * Falls back to a blank profile scoped to the currentAgencyId if somehow
 * the id isn't in the map — the UI keeps rendering instead of crashing.
 */
export function useCurrentAgency(): AgencyProfile {
  return useAgencyStore(
    useShallow((s) => {
      const currentId = s.currentAgencyId;
      const profile = s.agencies[currentId];
      return profile ?? { id: currentId, name: '', qrUrl: '' };
    }),
  );
}

export function useAgencyList(): AgencyProfile[] {
  return useAgencyStore(useShallow((s) => Object.values(s.agencies)));
}
