import { authedRequest, BASE_URL, type ApiResponse } from "@/services/api";
import { getAuthHeader } from "@/services/authHeader";
import { ok, toQuery } from "@/services/_helpers";
import type { UploadProgress } from "@/services/fleetService";
import type {
  DamageSeverity,
  DamageType,
  Inspection,
  InspectionType,
  PhotoAngle,
} from "@/types/inspection";

interface InspectionFilters {
  vehicleId?: string;
  bookingId?: string;
  type?: InspectionType;
}

export async function listInspections(
  filters: InspectionFilters = {},
): Promise<ApiResponse<Inspection[]>> {
  const data = await authedRequest<Inspection[]>(
    `/inspections${toQuery(filters)}`,
  );
  return ok(data);
}

// Backwards-compatible alias for screens that still call getInspections().
export const getInspections = listInspections;

export async function getInspectionById(
  id: string,
): Promise<ApiResponse<Inspection>> {
  const data = await authedRequest<Inspection>(`/inspections/${id}`);
  return ok(data);
}

export interface CreateInspectionPayload {
  vehicleId: string;
  bookingId?: string | null;
  type: InspectionType;
  inspectorName?: string;
  mileage?: number;
  fuelLevel?: number;
  notes?: string;
}

export async function createInspection(
  payload: CreateInspectionPayload,
): Promise<ApiResponse<Inspection>> {
  const data = await authedRequest<Inspection>("/inspections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return ok(data);
}

export async function deleteInspection(id: string): Promise<void> {
  await authedRequest<void>(`/inspections/${id}`, { method: "DELETE" });
}

export async function runInspectionAi(
  id: string,
): Promise<ApiResponse<Inspection>> {
  const data = await authedRequest<Inspection>(`/inspections/${id}/run-ai`, {
    method: "POST",
  });
  return ok(data);
}

export async function runInspectionAngleAi(
  id: string,
  angle: PhotoAngle,
): Promise<ApiResponse<Inspection>> {
  const data = await authedRequest<Inspection>(
    `/inspections/${id}/photos/${angle}/run-ai`,
    { method: "POST" },
  );
  return ok(data);
}

export interface MarkerFeedback {
  verdict: "confirm" | "reject" | "reclassify";
  rejectReason?: "false_positive" | "not_chargeable" | "duplicate" | "low_quality";
  correctedClass?: string;
  correctedSeverity?: "cosmetic" | "minor" | "moderate" | "severe";
}

// Data flywheel: the inspector's verdict on one AI finding (real damage / false
// alarm) becomes a labelled example server-side.
export async function submitMarkerFeedback(
  inspectionId: string,
  markerId: string,
  feedback: MarkerFeedback,
): Promise<ApiResponse<Inspection>> {
  const data = await authedRequest<Inspection>(
    `/inspections/${inspectionId}/markers/${markerId}/feedback`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(feedback),
    },
  );
  return ok(data);
}

export async function patchInspection(
  id: string,
  patch: {
    status?: "draft" | "completed";
    mileage?: number;
    fuelLevel?: number;
    notes?: string;
  },
): Promise<ApiResponse<Inspection>> {
  const data = await authedRequest<Inspection>(`/inspections/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return ok(data);
}

export interface InspectionImageUpload {
  inspectionId: string;
  uri: string;
  angle: PhotoAngle;
  fileName?: string;
  mimeType?: string;
}

export interface UploadedInspectionPhoto {
  angle: PhotoAngle;
  inspection: Inspection;
}

export async function uploadInspectionImage(
  upload: InspectionImageUpload,
  opts: {
    onProgress?: (p: UploadProgress) => void;
    signal?: AbortSignal;
  } = {},
): Promise<UploadedInspectionPhoto> {
  const headers = await getAuthHeader();
  return uploadInspectionImageOnce(upload, headers, opts).catch(async (err) => {
    const isNetworkError =
      err instanceof Error && err.message === "Network error during upload";
    if (!isNetworkError) throw err;
    if (opts.signal?.aborted) throw err;
    await new Promise<void>((r) => setTimeout(r, 1000));
    if (opts.signal?.aborted) throw err;
    return uploadInspectionImageOnce(upload, headers, opts);
  });
}

function uploadInspectionImageOnce(
  upload: InspectionImageUpload,
  headers: Record<string, string>,
  opts: {
    onProgress?: (p: UploadProgress) => void;
    signal?: AbortSignal;
  },
): Promise<UploadedInspectionPhoto> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", {
      uri: upload.uri,
      name: upload.fileName ?? `${upload.angle}.jpg`,
      type: upload.mimeType ?? "image/jpeg",
    } as unknown as Blob);

    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      `${BASE_URL}/inspections/${upload.inspectionId}/photos/${upload.angle}`,
    );
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
        body.success === true &&
        body.data
      ) {
        resolve({ angle: upload.angle, inspection: body.data as Inspection });
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

export async function addAnnotation(
  inspectionId: string,
  angle: PhotoAngle,
  annotation: {
    x: number;
    y: number;
    type: DamageType;
    severity: DamageSeverity;
    description?: string;
  },
): Promise<ApiResponse<Inspection>> {
  const data = await authedRequest<Inspection>(
    `/inspections/${inspectionId}/photos/${angle}/annotations`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(annotation),
    },
  );
  return ok(data);
}
