import { apiRequest, authedRequest, BASE_URL } from "@/services/api";
import { getAuthHeader } from "@/services/authHeader";
import type { AngleKey, Vehicle } from "@/types/vehicle";

export type { AngleKey };

const ANGLE_KEYS: readonly AngleKey[] = [
  "front",
  "front-right",
  "right",
  "rear-right",
  "rear",
  "rear-left",
  "left",
  "front-left",
];

const ANGLE_KEY_SET = new Set<string>(ANGLE_KEYS);

export interface UploadedVehicleImage {
  tempKey: string;
  angle: AngleKey;
}

export type VehicleImageInput =
  | UploadedVehicleImage
  | { imageKey: string; angle: AngleKey };

export interface VehicleImageUpload {
  uri: string;
  angle: AngleKey;
  fileName?: string;
  mimeType?: string;
}

export async function uploadVehicleImages(
  uploads: VehicleImageUpload[],
): Promise<UploadedVehicleImage[]> {
  if (uploads.length === 0) return [];

  const form = new FormData();
  for (const u of uploads) {
    const name = u.fileName ?? `${u.angle}.jpg`;
    const type = u.mimeType ?? "image/jpeg";
    // React Native FormData file shape
    form.append(u.angle, {
      uri: u.uri,
      name,
      type,
    } as unknown as Blob);
  }

  const { images } = await apiRequest<{ images: UploadedVehicleImage[] }>(
    "/fleet/photos/upload",
    {
      method: "POST",
      headers: await getAuthHeader(),
      body: form as unknown as BodyInit,
    },
  );

  return images.map((i) => ({ tempKey: i.tempKey, angle: i.angle }));
}

export interface UploadProgress {
  loaded: number;
  total: number;
  /** 0..1 */
  progress: number;
}

/**
 * Upload a single vehicle image with progress reporting and cancel support.
 * Hits the same batch endpoint with one file part.
 */
export async function uploadVehicleImage(
  upload: VehicleImageUpload,
  opts: {
    onProgress?: (p: UploadProgress) => void;
    signal?: AbortSignal;
  } = {},
): Promise<UploadedVehicleImage> {
  const headers = await getAuthHeader();
  return uploadVehicleImageOnce(upload, headers, opts).catch(async (err) => {
    // Single retry on network error (status 0 / no response).
    const isNetworkError =
      err instanceof Error && err.message === "Network error during upload";
    if (!isNetworkError) throw err;
    if (opts.signal?.aborted) throw err;
    await new Promise<void>((r) => setTimeout(r, 1000));
    if (opts.signal?.aborted) throw err;
    return uploadVehicleImageOnce(upload, headers, opts);
  });
}

function uploadVehicleImageOnce(
  upload: VehicleImageUpload,
  headers: Record<string, string>,
  opts: {
    onProgress?: (p: UploadProgress) => void;
    signal?: AbortSignal;
  },
): Promise<UploadedVehicleImage> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append(upload.angle, {
      uri: upload.uri,
      name: upload.fileName ?? `${upload.angle}.jpg`,
      type: upload.mimeType ?? "image/jpeg",
    } as unknown as Blob);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE_URL}/fleet/photos/upload`);
    xhr.setRequestHeader("Accept", "application/json");
    for (const [k, v] of Object.entries(headers)) {
      xhr.setRequestHeader(k, v);
    }

    if (xhr.upload && opts.onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          opts.onProgress!({
            loaded: e.loaded,
            total: e.total,
            progress: e.loaded / e.total,
          });
        }
      };
    }

    xhr.onload = () => {
      let body: any = null;
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        // ignore
      }
      if (
        xhr.status >= 200 &&
        xhr.status < 300 &&
        body &&
        body.success === true
      ) {
        const first = body.data?.images?.[0];
        if (!first || !ANGLE_KEY_SET.has(first.angle)) {
          reject(new Error("Empty upload response"));
          return;
        }
        resolve({ tempKey: first.tempKey, angle: first.angle as AngleKey });
        return;
      }
      const message =
        body?.error?.message ||
        (typeof body === "string" ? body : `Upload failed (${xhr.status})`);
      reject(new Error(message));
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => {
      const err = new Error("Upload aborted");
      err.name = "AbortError";
      reject(err);
    };

    if (opts.signal) {
      if (opts.signal.aborted) {
        xhr.abort();
        return;
      }
      opts.signal.addEventListener(
        "abort",
        () => {
          xhr.onload = null;
          xhr.onerror = null;
          xhr.abort();
        },
        { once: true },
      );
    }

    xhr.send(form);
  });
}

function filterKnownAngleImages<T extends { images?: { angle: string }[] }>(
  v: T,
): T {
  if (!v.images) return v;
  return {
    ...v,
    images: v.images.filter((img) => ANGLE_KEY_SET.has(img.angle)),
  };
}

export async function getVehicles(): Promise<Vehicle[]> {
  const list = await apiRequest<Vehicle[]>("/fleet", {
    method: "GET",
    headers: await getAuthHeader(),
  });
  return list.map(filterKnownAngleImages);
}

export async function getVehicleById(id: string): Promise<Vehicle> {
  const v = await apiRequest<Vehicle>(`/fleet/${id}`, {
    method: "GET",
    headers: await getAuthHeader(),
  });
  return filterKnownAngleImages(v);
}

export interface CreateVehicleInput {
  slug?: string;
  name: string;
  brand: string;
  category: string;
  year: number;
  mileage: number;
  licensePlate: string;
  dailyRate: number;
  fuelType: string;
  transmission: string;
  seats: number;
  color: string;
  features: string[];
  images?: VehicleImageInput[];
  quantity?: number;
  includedKm?: number;
  extraKmRate?: number;
}

export async function createVehicle(
  data: CreateVehicleInput,
): Promise<Vehicle> {
  return apiRequest<Vehicle>("/fleet", {
    method: "POST",
    headers: {
      ...(await getAuthHeader()),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
}

export interface UpdateVehicleInput {
  slug?: string;
  name?: string;
  brand?: string;
  category?: string;
  status?: string;
  year?: number;
  mileage?: number;
  licensePlate?: string;
  dailyRate?: number;
  fuelType?: string;
  transmission?: string;
  seats?: number;
  color?: string;
  features?: string[];
  images?: VehicleImageInput[];
  quantity?: number;
  includedKm?: number;
  extraKmRate?: number;
}

export async function updateVehicle(
  id: string,
  data: UpdateVehicleInput,
): Promise<Vehicle> {
  return apiRequest<Vehicle>(`/fleet/${id}`, {
    method: "PATCH",
    headers: {
      ...(await getAuthHeader()),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
}

export async function deleteVehicle(id: string): Promise<{ id: string }> {
  return apiRequest<{ id: string }>(`/fleet/${id}`, {
    method: "DELETE",
    headers: await getAuthHeader(),
  });
}

export interface FleetStats {
  total: number;
  rented: number;
  available: number;
  maintenance: number;
}

export async function getFleetStats(): Promise<FleetStats> {
  return authedRequest<FleetStats>("/fleet/stats", { method: "GET" });
}
