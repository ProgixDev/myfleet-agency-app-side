import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { DeliverySettings } from '@/types/agency';
import { useAgencyStore } from '@/stores/useAgencyStore';

export type AutoCancelHours = 24 | 48 | 72 | 168;

interface BookingPolicies {
  autoCancelUnpaid: boolean;
  autoCancelAfterHours: AutoCancelHours;
}

export interface PerAgencySettings {
  bookingPolicies: BookingPolicies;
  delivery: DeliverySettings;
}

export interface DeliveryBasePointPayload {
  label: string;
  address: string;
  lat: number;
  lng: number;
}

interface AgencySettingsState {
  /** Settings keyed by agencyId. Actions target the currentAgencyId from useAgencyStore. */
  settingsByAgency: Record<string, PerAgencySettings>;
}

interface AgencySettingsActions {
  setAutoCancelEnabled: (enabled: boolean) => void;
  setAutoCancelHours: (hours: AutoCancelHours) => void;

  setDeliveryEnabled: (enabled: boolean) => void;
  setDeliveryBasePoint: (payload: DeliveryBasePointPayload) => void;
  setDeliveryRate: (ratePerKm: number) => void;
  setDeliveryMinFee: (fee: number | undefined) => void;
  setDeliveryMaxDistance: (km: number | undefined) => void;
  setDeliveryCurrency: (currency: string) => void;
}

type AgencySettingsStore = AgencySettingsState & AgencySettingsActions;

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_DELIVERY: DeliverySettings = {
  enabled: false,
  basePointLabel: '',
  basePointAddress: '',
  basePointLat: 0,
  basePointLng: 0,
  ratePerKm: 0,
  currency: 'CHF',
  minFee: undefined,
  maxDistanceKm: undefined,
};

export const DEFAULT_PER_AGENCY_SETTINGS: PerAgencySettings = {
  bookingPolicies: {
    autoCancelUnpaid: true,
    autoCancelAfterHours: 72,
  },
  delivery: DEFAULT_DELIVERY,
};

// ── Seeds (dev mock — realistic divergent delivery configs per tenant) ──────

const SEED_SETTINGS: Record<string, PerAgencySettings> = {
  'agency-001': {
    bookingPolicies: { autoCancelUnpaid: true, autoCancelAfterHours: 72 },
    delivery: {
      enabled: true,
      basePointLabel: 'Agence Genève-Cornavin',
      basePointAddress: 'Place de Cornavin, 1201 Genève',
      basePointLat: 46.2105,
      basePointLng: 6.1428,
      ratePerKm: 1.5,
      currency: 'CHF',
      minFee: 10,
      maxDistanceKm: 60,
    },
  },
  'agency-002': {
    bookingPolicies: { autoCancelUnpaid: true, autoCancelAfterHours: 48 },
    delivery: {
      enabled: true,
      basePointLabel: 'Zürich HB',
      basePointAddress: 'Bahnhofplatz, 8001 Zürich',
      basePointLat: 47.378,
      basePointLng: 8.5402,
      ratePerKm: 2.0,
      currency: 'CHF',
      minFee: 25,
      maxDistanceKm: 80,
    },
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function patchCurrentAgency(
  state: AgencySettingsState,
  fn: (current: PerAgencySettings) => PerAgencySettings,
): AgencySettingsState {
  const currentId = useAgencyStore.getState().currentAgencyId;
  const existing = state.settingsByAgency[currentId] ?? DEFAULT_PER_AGENCY_SETTINGS;
  return {
    settingsByAgency: {
      ...state.settingsByAgency,
      [currentId]: fn(existing),
    },
  };
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useAgencySettingsStore = create<AgencySettingsStore>()(
  persist(
    (set) => ({
      settingsByAgency: SEED_SETTINGS,

      setAutoCancelEnabled: (enabled) =>
        set((s) =>
          patchCurrentAgency(s, (cur) => ({
            ...cur,
            bookingPolicies: { ...cur.bookingPolicies, autoCancelUnpaid: enabled },
          })),
        ),
      setAutoCancelHours: (hours) =>
        set((s) =>
          patchCurrentAgency(s, (cur) => ({
            ...cur,
            bookingPolicies: { ...cur.bookingPolicies, autoCancelAfterHours: hours },
          })),
        ),

      setDeliveryEnabled: (enabled) =>
        set((s) =>
          patchCurrentAgency(s, (cur) => ({
            ...cur,
            delivery: { ...cur.delivery, enabled },
          })),
        ),
      setDeliveryBasePoint: ({ label, address, lat, lng }) =>
        set((s) =>
          patchCurrentAgency(s, (cur) => ({
            ...cur,
            delivery: {
              ...cur.delivery,
              basePointLabel: label,
              basePointAddress: address,
              basePointLat: lat,
              basePointLng: lng,
            },
          })),
        ),
      setDeliveryRate: (ratePerKm) =>
        set((s) =>
          patchCurrentAgency(s, (cur) => ({
            ...cur,
            delivery: { ...cur.delivery, ratePerKm },
          })),
        ),
      setDeliveryMinFee: (fee) =>
        set((s) =>
          patchCurrentAgency(s, (cur) => ({
            ...cur,
            delivery: { ...cur.delivery, minFee: fee },
          })),
        ),
      setDeliveryMaxDistance: (km) =>
        set((s) =>
          patchCurrentAgency(s, (cur) => ({
            ...cur,
            delivery: { ...cur.delivery, maxDistanceKm: km },
          })),
        ),
      setDeliveryCurrency: (currency) =>
        set((s) =>
          patchCurrentAgency(s, (cur) => ({
            ...cur,
            delivery: { ...cur.delivery, currency },
          })),
        ),
    }),
    {
      name: 'my-fleet-agency-settings',
      storage: createJSONStorage(() => AsyncStorage),
      version: 3,
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<AgencySettingsState> & {
          bookingPolicies?: BookingPolicies;
          delivery?: DeliverySettings;
        };

        // v1/v2: flat { bookingPolicies, delivery } for a single tenant.
        if (version < 3 || !state.settingsByAgency) {
          const legacy: PerAgencySettings = {
            bookingPolicies: state.bookingPolicies ?? DEFAULT_PER_AGENCY_SETTINGS.bookingPolicies,
            delivery: state.delivery ?? DEFAULT_DELIVERY,
          };
          return {
            settingsByAgency: {
              ...SEED_SETTINGS,
              // User's previous single-tenant settings carried onto default tenant
              'agency-001': legacy,
            },
          } as AgencySettingsState;
        }
        return state as AgencySettingsState;
      },
      // Keep new seeds present alongside persisted per-agency customizations.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AgencySettingsState>;
        return {
          ...current,
          ...p,
          settingsByAgency: {
            ...current.settingsByAgency,
            ...(p.settingsByAgency ?? {}),
          },
        } as AgencySettingsStore;
      },
    },
  ),
);

// ── Selector hook ────────────────────────────────────────────────────────────

/**
 * Returns the PerAgencySettings of the currently-selected agency.
 * Falls back to DEFAULT_PER_AGENCY_SETTINGS if the agency has no stored entry
 * (e.g. brand-new tenant never customised by the user).
 */
export function useCurrentAgencySettings(): PerAgencySettings {
  const currentId = useAgencyStore((s) => s.currentAgencyId);
  return useAgencySettingsStore(
    (s) => s.settingsByAgency[currentId] ?? DEFAULT_PER_AGENCY_SETTINGS,
  );
}
