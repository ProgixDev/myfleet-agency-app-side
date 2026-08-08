/**
 * Build-time environment helpers.
 *
 * `EXPO_PUBLIC_*` values are inlined into the bundle by Metro. A key that is
 * present-but-blank in `.env` (or in an EAS profile) inlines as `""`, and `??`
 * only falls back on `null`/`undefined` — so `process.env.X ?? fallback`
 * silently yields `""` rather than the fallback.
 *
 * That bug shipped once: `EXPO_PUBLIC_PUBLIC_URL` was blank, so the agency
 * pairing QR encoded a relative `/pair/<id>` instead of an absolute URL.
 * Always resolve optional env through `envOr` rather than `??`.
 */
export const envOr = (value: string | undefined, fallback: string): string => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
};

/** `envOr`, with trailing slashes stripped — for base URLs used in `${base}/path`. */
export const envBaseUrl = (value: string | undefined, fallback: string): string =>
  envOr(value, fallback).replace(/\/+$/, "");
