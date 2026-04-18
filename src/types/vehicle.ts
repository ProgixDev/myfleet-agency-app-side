export type VehicleCategory =
  | 'SUV'
  | 'SUV Compact'
  | 'Sedan Compact'
  | 'Sedan Luxury'
  | 'Van / Minivan'
  | 'City Car'
  | 'SUV Coupé'
  | 'Hatchback'
  | 'SUV / 7 Places'
  | 'SUV Luxury'
  | 'Van / Utilitaire'
  | 'Coupe / Sedan Sport';

export type VehicleBrand =
  | 'Audi'
  | 'BMW'
  | 'Mercedes-Benz'
  | 'Škoda'
  | 'Volkswagen'
  | 'Mini'
  | 'Land Rover';

export type VehicleStatus = 'available' | 'rented' | 'maintenance' | 'reserved';

export type FuelType = 'gasoline' | 'diesel' | 'electric' | 'hybrid' | 'plug-in-hybrid';

export type Transmission = 'manual' | 'automatic';

export interface DamageRecord {
  id: string;
  date: string;
  inspectorName: string;
  type: 'scratch' | 'dent' | 'crack' | 'stain' | 'other';
  severity: 'minor' | 'moderate' | 'severe';
  description: string;
  resolved: boolean;
}

export interface RentalHistoryEntry {
  id: string;
  clientName: string;
  startDate: string;
  endDate: string;
  duration: number; // days
  revenue: number;
}

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
  dailyRate: number;
  images: string[];
  fuelType: FuelType;
  transmission: Transmission;
  seats: number;
  color: string;
  features: string[];
  rentalHistory: RentalHistoryEntry[];
  damageRecords: DamageRecord[];
  media: VehicleMedia;
  quantity: number;
  /** Default km included per rental — copied onto Booking at creation. */
  includedKm?: number;
  /** Default cost per km above includedKm, in CHF. */
  extraKmRate?: number;
}
