import type { VehicleStatus, VehicleCategory } from "@/types/vehicle";

export const fleetKeys = {
  all: ["fleet"] as const,
  lists: () => [...fleetKeys.all, "list"] as const,
  list: (filters: { status?: VehicleStatus | null; category?: VehicleCategory | null; search?: string }) =>
    [...fleetKeys.lists(), filters] as const,
  details: () => [...fleetKeys.all, "detail"] as const,
  detail: (id: string) => [...fleetKeys.details(), id] as const,
};

export const clientKeys = {
  all: ["clients"] as const,
  lists: () => [...clientKeys.all, "list"] as const,
  list: (search?: string) => [...clientKeys.lists(), search ?? ""] as const,
  details: () => [...clientKeys.all, "detail"] as const,
  detail: (id: string) => [...clientKeys.details(), id] as const,
};

export const agencyKeys = {
  all: ["agency"] as const,
  me: () => [...agencyKeys.all, "me"] as const,
  settings: () => [...agencyKeys.all, "settings"] as const,
};

export const messageKeys = {
  all: ["bookingMessages"] as const,
  list: (bookingId: string) => [...messageKeys.all, "list", bookingId] as const,
};
