export type InspectionType = "pre-rental" | "post-rental" | "routine";

export type InspectionStatus = "draft" | "completed";

export type DamageType =
  | "scratch"
  | "dent"
  | "crack"
  | "paint"
  | "stain"
  | "other";

export type DamageSeverity = "minor" | "moderate" | "severe";

export type PhotoAngle =
  | "front"
  | "front-right"
  | "right"
  | "rear-right"
  | "rear"
  | "rear-left"
  | "left"
  | "front-left";

export const PHOTO_ANGLES: {
  key: PhotoAngle;
  label: string;
  labelFr: string;
}[] = [
  { key: "front", label: "Front", labelFr: "Face avant" },
  { key: "front-right", label: "Front-Right", labelFr: "Avant droit" },
  { key: "right", label: "Right Side", labelFr: "Côté droit" },
  { key: "rear-right", label: "Rear-Right", labelFr: "Arrière droit" },
  { key: "rear", label: "Rear", labelFr: "Face arrière" },
  { key: "rear-left", label: "Rear-Left", labelFr: "Arrière gauche" },
  { key: "left", label: "Left Side", labelFr: "Côté gauche" },
  { key: "front-left", label: "Front-Left", labelFr: "Avant gauche" },
];

export interface DamageAnnotation {
  id: string;
  x: number; // 0-1 relative position on photo
  y: number;
  type: DamageType;
  severity: DamageSeverity;
  description: string;
}

export interface AIMarker {
  id?: string;
  x: number;
  y: number;
  width?: number | null;
  height?: number | null;
  confidence: number;
  damageClass?: string | null;
  isNew?: boolean | null;
  description?: string;
}

export interface AIDetectionResult {
  damagesFound: number;
  markers: AIMarker[];
}

export type AIInspectionStatus =
  | "idle"
  | "queued"
  | "running"
  | "completed"
  | "failed";

export interface CapturedPhoto {
  angle: PhotoAngle;
  uri: string; // photo URI or empty for mock
  key?: string;
  url?: string | null;
  timestamp: string;
  aiResult: AIDetectionResult | null;
  annotations: DamageAnnotation[];
  aiStatus?: AIInspectionStatus;
  aiError?: string | null;
  aiRunAt?: string | null;
}

export interface Inspection {
  id: string;
  vehicleId: string;
  vehicleName: string;
  bookingId: string | null;
  clientName: string | null;
  type: InspectionType;
  status: InspectionStatus;
  date: string;
  inspectorName: string;
  photos: CapturedPhoto[];
  mileage: number;
  fuelLevel: number;
  notes: string;
  totalDamagesAI: number;
  totalDamagesManual: number;
  aiStatus?: AIInspectionStatus;
  aiSummary?: string | null;
  aiError?: string | null;
  aiRunAt?: string | null;
}

export interface InspectionDraft {
  vehicleId: string;
  vehicleName: string;
  bookingId: string | null;
  clientName: string | null;
  type: InspectionType;
  currentAngleIndex: number;
  photos: CapturedPhoto[];
  mileage: number;
  fuelLevel: number;
  notes: string;
}
