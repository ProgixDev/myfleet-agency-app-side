/**
 * Web admin (billing) configuration.
 *
 * AI credits and plan upgrades are purchased on the web admin, not in the
 * mobile apps — the apps are login-only companions for billing. The URL is
 * read from `EXPO_PUBLIC_WEB_ADMIN_URL` (inlined at build time) with the
 * production deployment as the fallback default, mirroring how
 * `EXPO_PUBLIC_API_URL` is resolved in `src/services/api.ts`.
 */

import { envBaseUrl } from "@/lib/env";

const DEFAULT_WEB_ADMIN_URL = "https://backoffice.myfleetagency.com";

// `envBaseUrl`, not `??`: a present-but-blank env var inlines as "" and `??`
// does not fall back on it, which would leave this an empty string and send
// billing links to a relative URL.
export const WEB_ADMIN_URL = envBaseUrl(
  process.env.EXPO_PUBLIC_WEB_ADMIN_URL,
  DEFAULT_WEB_ADMIN_URL,
);
