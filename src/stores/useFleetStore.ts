import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { VehicleStatus, VehicleBrand } from "@/types/vehicle";

// Persisted UI preferences for the fleet list. Filters and layout survive
// app restarts so the user lands back in the view they last configured.
// Search input is intentionally excluded — it's ephemeral per session.

export type FleetViewMode = "grid" | "list";

interface FleetUiState {
  statusFilter: VehicleStatus | null;
  brandFilter: VehicleBrand | null;
  viewMode: FleetViewMode;
}

interface FleetUiActions {
  setStatusFilter: (status: VehicleStatus | null) => void;
  setBrandFilter: (brand: VehicleBrand | null) => void;
  setViewMode: (mode: FleetViewMode) => void;
  toggleViewMode: () => void;
  resetFilters: () => void;
}

type FleetUiStore = FleetUiState & FleetUiActions;

const INITIAL_STATE: FleetUiState = {
  statusFilter: null,
  brandFilter: null,
  viewMode: "grid",
};

export const useFleetStore = create<FleetUiStore>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,

      setStatusFilter: (statusFilter) => set({ statusFilter }),
      setBrandFilter: (brandFilter) => set({ brandFilter }),
      setViewMode: (viewMode) => set({ viewMode }),
      toggleViewMode: () =>
        set((s) => ({ viewMode: s.viewMode === "grid" ? "list" : "grid" })),
      resetFilters: () => set({ statusFilter: null, brandFilter: null }),
    }),
    {
      name: "my-fleet-ui",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);
