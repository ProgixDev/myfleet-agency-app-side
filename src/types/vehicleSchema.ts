import { z } from "zod";

import { unitsToCents } from "@/utils/money";

// Mirrors server `createVehicleSchema` in src/fleet/fleet.types.ts (camelCase).
// Slug is omitted on the client; the server derives it from the name.

export const angleKeySchema = z.enum([
  "front",
  "front-right",
  "right",
  "rear-right",
  "rear",
  "rear-left",
  "left",
  "front-left",
]);

export const vehicleStatusSchema = z.enum([
  "available",
  "rented",
  "maintenance",
  "reserved",
]);

export const fuelTypeSchema = z.enum([
  "gasoline",
  "diesel",
  "electric",
  "hybrid",
  "plug-in-hybrid",
]);

export const transmissionSchema = z.enum(["manual", "automatic"]);

export const vehicleImageInputSchema = z.object({
  tempKey: z.string().startsWith("temp/"),
  angle: angleKeySchema,
});

export const vehicleFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  brand: z.string().min(1, "Pick a brand").max(120),
  category: z.string().min(1, "Pick a category").max(120),
  status: vehicleStatusSchema.default("available"),
  year: z.coerce
    .number({ message: "Year is required" })
    .int()
    .min(1900, "Year must be between 1900 and 2100")
    .max(2100, "Year must be between 1900 and 2100"),
  mileage: z.coerce.number().int().min(0, "Mileage must be ≥ 0").default(0),
  licensePlate: z.string().min(1, "License plate is required").max(50),
  // Form input is whole euros; schema converts to cents (the wire format).
  dailyRate: z.coerce
    .number({ message: "Daily rate is required" })
    .min(0, "Daily rate must be ≥ 0")
    .transform(unitsToCents),
  deposit: z.coerce
    .number({ message: "Deposit must be a number" })
    .min(0, "Deposit must be ≥ 0")
    .default(0)
    .transform(unitsToCents),
  fuelType: fuelTypeSchema,
  transmission: transmissionSchema,
  seats: z.coerce
    .number({ message: "Seats is required" })
    .int()
    .min(1, "Seats must be between 1 and 50")
    .max(50, "Seats must be between 1 and 50"),
  color: z.string().min(1, "Color is required").max(50),
  features: z.array(z.string()).default([]),
  images: z.array(vehicleImageInputSchema).default([]),
  quantity: z.coerce.number().int().min(1).default(1),
  includedKm: z.coerce.number().int().min(0).optional(),
  extraKmRate: z.coerce
    .number()
    .min(0)
    .optional()
    .transform((euros) =>
      euros === undefined ? undefined : unitsToCents(euros),
    ),
});

export type VehicleFormInput = z.input<typeof vehicleFormSchema>;
export type VehicleFormParsed = z.output<typeof vehicleFormSchema>;
