/**
 * Mapbox wrappers — Geocoding + Directions + Static Images.
 *
 * Requires env var `EXPO_PUBLIC_MAPBOX_TOKEN` (inlined at build time by Expo).
 * See `.env.example` for instructions. Use the public token (starts with
 * `pk.…`); never ship a secret token (`sk.…`) in the app bundle.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress: string;
}

export interface DistanceResult {
  distanceMeters: number;
  durationSeconds: number;
}

export interface StaticMapOptions {
  zoom?: number;
  width?: number;
  height?: number;
}

// ── Errors ───────────────────────────────────────────────────────────────────

export class MapsApiKeyMissingError extends Error {
  readonly code = 'MAPS_API_KEY_MISSING' as const;
  constructor() {
    super('EXPO_PUBLIC_MAPBOX_TOKEN is not set. See .env.example.');
    this.name = 'MapsApiKeyMissingError';
  }
}

export type GeocodingErrorCode =
  | 'ZERO_RESULTS'
  | 'OVER_QUERY_LIMIT'
  | 'REQUEST_DENIED'
  | 'INVALID_REQUEST'
  | 'NETWORK'
  | 'UNKNOWN';

export class GeocodingError extends Error {
  readonly code: GeocodingErrorCode;
  constructor(code: GeocodingErrorCode, message: string) {
    super(message);
    this.name = 'GeocodingError';
    this.code = code;
  }
}

export type DistanceMatrixErrorCode =
  | 'ZERO_RESULTS'
  | 'OVER_QUERY_LIMIT'
  | 'REQUEST_DENIED'
  | 'INVALID_REQUEST'
  | 'NOT_FOUND'
  | 'NETWORK'
  | 'UNKNOWN';

export class DistanceMatrixError extends Error {
  readonly code: DistanceMatrixErrorCode;
  constructor(code: DistanceMatrixErrorCode, message: string) {
    super(message);
    this.name = 'DistanceMatrixError';
    this.code = code;
  }
}

// ── Key resolution ───────────────────────────────────────────────────────────

function getToken(): string {
  const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
  if (!token || token.length === 0) throw new MapsApiKeyMissingError();
  return token;
}

export function hasMapsApiKey(): boolean {
  const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
  return typeof token === 'string' && token.length > 0;
}

function httpStatusToErrorCode(
  status: number,
): 'OVER_QUERY_LIMIT' | 'REQUEST_DENIED' | 'INVALID_REQUEST' | 'UNKNOWN' {
  if (status === 401 || status === 403) return 'REQUEST_DENIED';
  if (status === 422) return 'INVALID_REQUEST';
  if (status === 429) return 'OVER_QUERY_LIMIT';
  return 'UNKNOWN';
}

// ── Geocoding (Mapbox Geocoding v6 — forward) ────────────────────────────────

interface MapboxGeocodeResponse {
  type: 'FeatureCollection';
  features: Array<{
    properties: {
      full_address?: string;
      name?: string;
      place_formatted?: string;
    };
    geometry: {
      type: 'Point';
      coordinates: [number, number]; // [lng, lat]
    };
  }>;
}

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const trimmed = address.trim();
  if (!trimmed) {
    throw new GeocodingError('INVALID_REQUEST', 'Empty address');
  }

  const token = getToken();
  const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(
    trimmed,
  )}&limit=1&access_token=${token}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new GeocodingError(
      'NETWORK',
      err instanceof Error ? err.message : 'Network error',
    );
  }

  if (!response.ok) {
    throw new GeocodingError(
      httpStatusToErrorCode(response.status),
      `Geocoding failed: HTTP ${response.status}`,
    );
  }

  const data = (await response.json()) as MapboxGeocodeResponse;
  const best = data.features?.[0];
  if (!best) {
    throw new GeocodingError('ZERO_RESULTS', 'No results');
  }

  const [lng, lat] = best.geometry.coordinates;
  const formattedAddress =
    best.properties.full_address ??
    best.properties.place_formatted ??
    best.properties.name ??
    trimmed;

  return { lat, lng, formattedAddress };
}

// ── Driving distance (Mapbox Directions v5) ──────────────────────────────────

interface MapboxDirectionsResponse {
  code: string; // 'Ok' | 'NoRoute' | 'NoSegment' | 'ProfileNotFound' | 'InvalidInput' | ...
  message?: string;
  routes: Array<{
    distance: number; // meters
    duration: number; // seconds
  }>;
}

function latLngToPoint(value: LatLng | string): string {
  if (typeof value === 'string') {
    // Accept "lat,lng" strings (legacy Google-style) and convert to Mapbox "lng,lat"
    const parts = value.split(',').map((p) => p.trim());
    if (parts.length === 2) {
      const lat = Number(parts[0]);
      const lng = Number(parts[1]);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        return `${lng},${lat}`;
      }
    }
    // Not a coord pair — Mapbox Directions doesn't accept raw addresses, so
    // callers should geocode first. Pass through unchanged and let the API
    // reject it with a clear error.
    return value.trim();
  }
  return `${value.lng},${value.lat}`;
}

export async function getDrivingDistance(
  origin: LatLng | string,
  destination: LatLng | string,
): Promise<DistanceResult> {
  const token = getToken();
  const originPoint = latLngToPoint(origin);
  const destPoint = latLngToPoint(destination);

  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${encodeURIComponent(
    originPoint,
  )};${encodeURIComponent(
    destPoint,
  )}?geometries=geojson&overview=false&access_token=${token}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new DistanceMatrixError(
      'NETWORK',
      err instanceof Error ? err.message : 'Network error',
    );
  }

  if (!response.ok) {
    throw new DistanceMatrixError(
      httpStatusToErrorCode(response.status),
      `Directions failed: HTTP ${response.status}`,
    );
  }

  const data = (await response.json()) as MapboxDirectionsResponse;

  if (data.code !== 'Ok') {
    const code: DistanceMatrixErrorCode =
      data.code === 'NoRoute' || data.code === 'NoSegment'
        ? 'ZERO_RESULTS'
        : data.code === 'ProfileNotFound'
          ? 'NOT_FOUND'
          : data.code === 'InvalidInput'
            ? 'INVALID_REQUEST'
            : 'UNKNOWN';
    throw new DistanceMatrixError(
      code,
      data.message ?? `Directions failed: ${data.code}`,
    );
  }

  const route = data.routes[0];
  if (!route) {
    throw new DistanceMatrixError('ZERO_RESULTS', 'No route in response');
  }

  return {
    distanceMeters: route.distance,
    durationSeconds: route.duration,
  };
}

// ── Static Images (Mapbox) ───────────────────────────────────────────────────

/**
 * Builds a Mapbox Static Images URL centered on the given coordinates with a
 * red pin. Returns null when the token is not configured (caller can render a
 * placeholder).
 */
export function buildStaticMapUrl(
  lat: number,
  lng: number,
  { zoom = 14, width = 600, height = 300 }: StaticMapOptions = {},
): string | null {
  const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
  if (!token || token.length === 0) return null;
  const marker = `pin-s+ef4444(${lng},${lat})`;
  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${marker}/${lng},${lat},${zoom},0/${width}x${height}@2x?access_token=${token}`;
}
