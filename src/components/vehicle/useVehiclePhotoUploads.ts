import { useCallback, useRef, useState } from "react";
import { uploadVehicleImage, type AngleKey } from "@/services/fleetService";

export type UploadStatus = "uploading" | "uploaded" | "failed";

export interface ManagedPhoto {
  uri: string;
  angle: AngleKey;
  status: UploadStatus;
  progress: number;
  /** Set when this slot is a fresh upload (not yet linked to a vehicle). */
  tempKey?: string;
  /**
   * Set when this slot references a photo that's already stored on the
   * server — i.e. seeded from existing vehicle data on the edit screen.
   * Either tempKey OR imageKey will be set on a successful slot.
   */
  imageKey?: string;
  error?: string;
  /** Internal: tracks the latest in-flight attempt for this slot. */
  uploadId: number;
}

export interface UseVehiclePhotoUploads {
  photos: ManagedPhoto[];
  enqueueUpload: (input: { uri: string; angle: AngleKey }) => void;
  cancelUpload: (angle: string) => void;
  retryUpload: (angle: string, uri: string) => void;
  removePhoto: (angle: string) => void;
  /**
   * Seed the slots with photos that already exist on the server. Each
   * lands as `status: "uploaded"` with an `imageKey` instead of a tempKey.
   * Replaces existing state entirely — call once on mount.
   */
  seedExisting: (
    existing: { uri: string; angle: AngleKey; imageKey: string }[],
  ) => void;
  awaitAll: () => Promise<void>;
  /** Stable ref to current photos array (use after awaitAll). */
  snapshot: () => ManagedPhoto[];
}

export function useVehiclePhotoUploads(): UseVehiclePhotoUploads {
  const [photos, setPhotosState] = useState<ManagedPhoto[]>([]);
  const photosRef = useRef<ManagedPhoto[]>([]);

  const setPhotos = useCallback(
    (updater: (prev: ManagedPhoto[]) => ManagedPhoto[]) => {
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
    (p: { uri: string; angle: AngleKey }) => {
      // Cancel any previous in-flight upload for this angle and mark its id
      // as cancelled so its handlers become no-ops.
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

      const promise = uploadVehicleImage(
        { uri: p.uri, angle: p.angle },
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
        (result) => {
          if (cancelledIdsRef.current.has(uploadId)) return;
          setPhotos((prev) =>
            prev.map((x) =>
              x.uploadId === uploadId
                ? {
                    ...x,
                    status: "uploaded",
                    progress: 1,
                    tempKey: result.tempKey,
                  }
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
      enqueueUpload({ uri, angle: angle as AngleKey });
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

  const seedExisting = useCallback(
    (existing: { uri: string; angle: AngleKey; imageKey: string }[]) => {
      const seeded: ManagedPhoto[] = existing.map((e) => ({
        uri: e.uri,
        angle: e.angle,
        status: "uploaded",
        progress: 1,
        imageKey: e.imageKey,
        uploadId: ++uploadIdCounterRef.current,
      }));
      setPhotos(() => seeded);
    },
    [setPhotos],
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
    seedExisting,
    awaitAll,
    snapshot,
  };
}
