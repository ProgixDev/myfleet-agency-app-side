import { useCallback, useEffect, useRef, useState } from "react";
import { uploadInspectionImage } from "@/services/inspectionService";
import type { PhotoAngle } from "@/types/inspection";

export type InspectionUploadStatus = "uploading" | "uploaded" | "failed";

export interface ManagedInspectionPhoto {
  uri: string;
  angle: PhotoAngle;
  status: InspectionUploadStatus;
  progress: number;
  /** Always undefined — kept for shape parity with vehicle ManagedPhoto. */
  tempKey?: string;
  error?: string;
  /** Internal: tracks the latest in-flight attempt for this slot. */
  uploadId: number;
}

export interface UseInspectionPhotoUploads {
  photos: ManagedInspectionPhoto[];
  enqueueUpload: (input: { uri: string; angle: PhotoAngle }) => void;
  cancelUpload: (angle: string) => void;
  retryUpload: (angle: string, uri: string) => void;
  removePhoto: (angle: string) => void;
  awaitAll: () => Promise<void>;
  snapshot: () => ManagedInspectionPhoto[];
}

/**
 * Background uploader for inspection photos. Mirrors useVehiclePhotoUploads
 * but targets POST /inspections/:id/photos/:angle, so it needs the inspection
 * id before any photo is enqueued. Callers must create the inspection first.
 */
export function useInspectionPhotoUploads(
  inspectionId: string | null,
  initialPhotos?: { uri: string; angle: PhotoAngle }[],
): UseInspectionPhotoUploads {
  const [photos, setPhotosState] = useState<ManagedInspectionPhoto[]>([]);
  const photosRef = useRef<ManagedInspectionPhoto[]>([]);
  const inspectionIdRef = useRef<string | null>(inspectionId);
  const hydratedForRef = useRef<string | null>(null);

  useEffect(() => {
    inspectionIdRef.current = inspectionId;
  }, [inspectionId]);

  // Hydrate from server-side photos the first time we see this inspection id.
  // Treat them as already-uploaded so the Continue gate passes without the
  // user redoing the capture; they can still retake any angle to replace it.
  useEffect(() => {
    if (!inspectionId) return;
    if (hydratedForRef.current === inspectionId) return;
    if (!initialPhotos || initialPhotos.length === 0) return;
    hydratedForRef.current = inspectionId;
    setPhotosState((prev) => {
      const existingAngles = new Set(prev.map((p) => p.angle));
      const seeded: ManagedInspectionPhoto[] = initialPhotos
        .filter((p) => !existingAngles.has(p.angle))
        .map((p) => ({
          uri: p.uri,
          angle: p.angle,
          status: "uploaded",
          progress: 1,
          uploadId: 0,
        }));
      const next = [...prev, ...seeded];
      photosRef.current = next;
      return next;
    });
  }, [inspectionId, initialPhotos]);

  const setPhotos = useCallback(
    (updater: (prev: ManagedInspectionPhoto[]) => ManagedInspectionPhoto[]) => {
      setPhotosState((prev) => {
        const next = updater(prev);
        photosRef.current = next;
        return next;
      });
    },
    [],
  );

  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const uploadPromisesRef = useRef<Map<string, Promise<unknown>>>(new Map());
  const cancelledIdsRef = useRef<Set<number>>(new Set());
  const uploadIdCounterRef = useRef(0);

  const cancelUpload = useCallback((angle: string) => {
    const ctrl = abortControllersRef.current.get(angle);
    if (ctrl) {
      ctrl.abort();
      abortControllersRef.current.delete(angle);
    }
    uploadPromisesRef.current.delete(angle);
  }, []);

  const enqueueUpload = useCallback(
    (p: { uri: string; angle: PhotoAngle }) => {
      const id = inspectionIdRef.current;
      if (id == null) {
        // Flow B guarantees the inspection is created before the photos step
        // mounts. If this fires, the caller is ordering things wrong.
        setPhotos((prev) => {
          const without = prev.filter((x) => x.angle !== p.angle);
          return [
            ...without,
            {
              uri: p.uri,
              angle: p.angle,
              status: "failed",
              progress: 0,
              error: "Inspection not initialized",
              uploadId: ++uploadIdCounterRef.current,
            },
          ];
        });
        return;
      }

      const prevPhoto = photosRef.current.find((x) => x.angle === p.angle);
      if (prevPhoto) cancelledIdsRef.current.add(prevPhoto.uploadId);
      cancelUpload(p.angle);

      const uploadId = ++uploadIdCounterRef.current;

      setPhotos((prev) => {
        const without = prev.filter((x) => x.angle !== p.angle);
        return [
          ...without,
          {
            uri: p.uri,
            angle: p.angle,
            status: "uploading",
            progress: 0,
            uploadId,
          },
        ];
      });

      const ctrl = new AbortController();
      abortControllersRef.current.set(p.angle, ctrl);

      const promise = uploadInspectionImage(
        { inspectionId: id, uri: p.uri, angle: p.angle },
        {
          signal: ctrl.signal,
          onProgress: ({ progress }) => {
            if (cancelledIdsRef.current.has(uploadId)) return;
            setPhotos((prev) =>
              prev.map((x) =>
                x.uploadId === uploadId ? { ...x, progress } : x,
              ),
            );
          },
        },
      ).then(
        () => {
          if (cancelledIdsRef.current.has(uploadId)) return;
          setPhotos((prev) =>
            prev.map((x) =>
              x.uploadId === uploadId
                ? { ...x, status: "uploaded", progress: 1 }
                : x,
            ),
          );
          abortControllersRef.current.delete(p.angle);
        },
        (err: unknown) => {
          if (cancelledIdsRef.current.has(uploadId)) return;
          const name = (err as { name?: string })?.name;
          if (name === "AbortError") return;
          const message = err instanceof Error ? err.message : "Upload failed";
          setPhotos((prev) =>
            prev.map((x) =>
              x.uploadId === uploadId
                ? { ...x, status: "failed", error: message }
                : x,
            ),
          );
          abortControllersRef.current.delete(p.angle);
        },
      );

      uploadPromisesRef.current.set(p.angle, promise);
    },
    [cancelUpload, setPhotos],
  );

  const retryUpload = useCallback(
    (angle: string, uri: string) => {
      enqueueUpload({ uri, angle: angle as PhotoAngle });
    },
    [enqueueUpload],
  );

  const removePhoto = useCallback(
    (angle: string) => {
      const prevPhoto = photosRef.current.find((x) => x.angle === angle);
      if (prevPhoto) cancelledIdsRef.current.add(prevPhoto.uploadId);
      cancelUpload(angle);
      setPhotos((prev) => prev.filter((p) => p.angle !== angle));
    },
    [cancelUpload, setPhotos],
  );

  const awaitAll = useCallback(async () => {
    const pending = Array.from(uploadPromisesRef.current.values());
    if (pending.length > 0) {
      await Promise.allSettled(pending);
    }
  }, []);

  const snapshot = useCallback(() => photosRef.current, []);

  return {
    photos,
    enqueueUpload,
    cancelUpload,
    retryUpload,
    removePhoto,
    awaitAll,
    snapshot,
  };
}
