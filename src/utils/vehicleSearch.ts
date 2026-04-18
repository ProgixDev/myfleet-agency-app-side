import type { Vehicle } from '@/types/vehicle';

/**
 * Strips spaces and hyphens and lowercases so "GE-123-ABC", "ge123abc",
 * and "ge 123 abc" all collapse to the same key.
 */
export function normalizePlate(value: string): string {
  return value.toLowerCase().replace(/[\s-]+/g, '');
}

/**
 * True when the query matches the vehicle on name, brand, or license plate.
 * Name/brand match is a plain case-insensitive substring check; plate match
 * is a substring check on the normalized form (spaces/hyphens stripped).
 * An empty query matches every vehicle.
 */
export function matchesVehicleQuery(vehicle: Vehicle, query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;

  const q = trimmed.toLowerCase();
  if (vehicle.name.toLowerCase().includes(q)) return true;
  if (vehicle.brand.toLowerCase().includes(q)) return true;

  const normalizedPlate = normalizePlate(vehicle.licensePlate);
  const normalizedQuery = normalizePlate(trimmed);
  return normalizedPlate.includes(normalizedQuery);
}
