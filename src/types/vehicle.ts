export type VehicleCategory =
  | "SUV"
  | "SUV Compact"
  | "Sedan Compact"
  | "Sedan Luxury"
  | "Van / Minivan"
  | "City Car"
  | "SUV Coupé"
  | "Hatchback"
  | "SUV / 7 Places"
  | "SUV Luxury"
  | "Van / Utilitaire"
  | "Coupe / Sedan Sport";

export type VehicleBrand =
  | "Audi"
  | "BMW"
  | "Mercedes-Benz"
  | "Škoda"
  | "Volkswagen"
  | "Mini"
  | "Land Rover";

export type VehicleStatus =
  | "available"
  | "rented"
  | "maintenance"
  | "reserved"
  | "retired";

export type FuelType =
  | "gasoline"
  | "diesel"
  | "electric"
  | "hybrid"
  | "plug-in-hybrid";

export type Transmission = "manual" | "automatic";

export interface DamageRecord {
  id: string;
  /** Inspection that flagged this damage. Used to link to the inspection page. */
  inspectionId?: string;
  date: string;
  inspectorName: string;
  type: "scratch" | "dent" | "crack" | "stain" | "other";
  severity: "minor" | "moderate" | "severe";
  description: string;
  resolved: boolean;
}

export interface RentalHistoryEntry {
  /** Booking id — used to link to the booking page. */
  id: string;
  clientName: string;
  startDate: string;
  endDate: string;
  duration: number; // days
  /** In cents (smallest currency unit). */
  revenue: number;
  status?: string;
}

// legacy: bundled mock media — superseded by Vehicle.images (server-driven).
export interface VehicleMedia {
  photos: ReturnType<typeof require>[];
  videos: ReturnType<typeof require>[];
  hasVideo: boolean;
  thumbnail: ReturnType<typeof require> | null;
  /** Relative paths to video files (loaded at runtime, not bundled) */
  videoPaths?: string[];
  /** Fallback URLs for vehicles without local assets */
  placeholderImages?: string[];
}

export type AngleKey =
  | "front"
  | "front-right"
  | "right"
  | "rear-right"
  | "rear"
  | "rear-left"
  | "left"
  | "front-left";

export interface VehicleImage {
  angle: AngleKey;
  url: string;
  /** Storage object key — used by the edit screen to mark a photo as "kept". */
  imageKey: string;
}

export interface Vehicle {
  id: string;
  slug: string;
  name: string;
  brand: VehicleBrand;
  category: VehicleCategory;
  status: VehicleStatus;
  year: number;
  mileage: number;
  licensePlate: string;
  /** In cents (smallest currency unit). */
  dailyRate: number;
  fuelType: FuelType;
  transmission: Transmission;
  seats: number;
  color: string;
  features: string[];
  /** Populated on list responses. */
  thumbnailUrl?: string | null;
  /** Populated on detail responses. */
  images?: VehicleImage[];
  rentalHistory?: RentalHistoryEntry[];
  damageRecords?: DamageRecord[];
  media?: VehicleMedia;
  quantity: number;
  /** Default km included per rental — copied onto Booking at creation. */
  includedKm?: number;
  /** Default cost per km above includedKm, in cents. */
  extraKmRate?: number;
}
