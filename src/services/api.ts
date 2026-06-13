import { getAuthHeader } from "@/services/authHeader";

const DEFAULT_API_BASE_URL = "http://localhost:4000";

// Use `??` only catches null/undefined, so an env var set to "" (which happens
// when a key is present-but-blank in .env / EAS) would slip through and point
// requests at the wrong origin (e.g. the Metro dev server). Treat blank/
// whitespace-only values as absent and fall back.
const envOr = (value: string | undefined, fallback: string): string => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
};

export const BASE_URL = envOr(
  process.env.EXPO_PUBLIC_API_URL,
  DEFAULT_API_BASE_URL,
).replace(/\/+$/, "");

export const AUTH_BASE_URL = envOr(
  process.env.EXPO_PUBLIC_AUTH_BASE_URL,
  `${BASE_URL}/auth`,
).replace(/\/+$/, "");

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
  message?: string;
}

interface ApiErrorEnvelope {
  success?: false;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(params: {
    message: string;
    code?: string;
    status: number;
    details?: unknown;
  }) {
    super(params.message);
    this.name = "ApiClientError";
    this.code = params.code ?? "API_ERROR";
    this.status = params.status;
    this.details = params.details;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function buildUrl(path: string, baseUrl: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

async function readBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  const raw = await response.text();

  if (!raw) {
    return null;
  }

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return raw;
    }
  }

  return raw;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit & { baseUrl?: string } = {},
): Promise<T> {
  const { baseUrl = BASE_URL, headers, ...rest } = init;
  const response = await fetch(buildUrl(path, baseUrl), {
    ...rest,
    headers: {
      Accept: "application/json",
      ...(headers ?? {}),
    },
  });

  const body = await readBody(response);
  const errorMessage = `Request failed (${response.status})`;

  if (!isRecord(body)) {
    if (!response.ok) {
      throw new ApiClientError({
        status: response.status,
        code: "HTTP_ERROR",
        message:
          typeof body === "string" && body.length > 0 ? body : errorMessage,
      });
    }

    throw new ApiClientError({
      status: response.status,
      code: "INVALID_RESPONSE",
      message: "Response is not a valid JSON envelope",
      details: body,
    });
  }

  const success = body.success;
  if (success === true && "data" in body) {
    return body.data as T;
  }

  const envelope = body as unknown as ApiErrorEnvelope;
  const fallbackMessage = response.ok ? "Request failed" : errorMessage;
  const message =
    envelope.error?.message && envelope.error.message.length > 0
      ? envelope.error.message
      : fallbackMessage;

  throw new ApiClientError({
    status: response.status,
    code:
      envelope.error?.code ?? (response.ok ? "INVALID_ENVELOPE" : "HTTP_ERROR"),
    message,
    details: envelope.error?.details ?? body,
  });
}

/**
 * Simulates network latency for mock API calls.
 * @param ms - delay in milliseconds (default: 300–800ms random)
 */
export function delay(ms?: number): Promise<void> {
  const duration = ms ?? Math.floor(Math.random() * 500) + 300;
  return new Promise((resolve) => setTimeout(resolve, duration));
}

export async function authedRequest<T>(
  path: string,
  init: RequestInit & { baseUrl?: string } = {},
): Promise<T> {
  return apiRequest<T>(path, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...(await getAuthHeader()),
    },
  });
}
