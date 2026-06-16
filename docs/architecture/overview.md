# Architecture overview — as it is

App: **my-fleet** (display name "My Fleet"), the agency-facing app of the MyFleet product. Expo SDK 55, React Native 0.83.6, React 19.2, TypeScript 5.9 (strict). Experiments enabled in `app.json`: **typedRoutes** and **reactCompiler**.

## Workflow type

**Expo managed with CNG/prebuild.** No `ios/` or `android/` folders are committed; `expo run:ios|android` prebuilds them locally. All native configuration lives in `app.json` (plugins: expo-router, splash-screen, fonts, localization, image, datetimepicker, apple-authentication, google-signin, camera, video, web-browser). Never hand-edit generated native folders.

## Navigation model (expo-router, file-based)

Entry: `expo-router/entry` → `src/app/_layout.tsx` (fonts, QueryClientProvider, GestureHandlerRootView, ToastProvider, root `<Stack>`).

- `src/app/index.tsx` — animated splash + redirect: authenticated → `(app)/(home)`; first run → `(auth)/onboarding`; else `(auth)/welcome`.
- `src/app/(auth)/` — stack: welcome, onboarding, login, register (4-step agency signup), phone-login, otp, forgot-password, verify-email.
- `src/app/(app)/_layout.tsx` — `<Tabs>` with a **custom TabBar** (`src/components/ui/TabBar.tsx`); tab bar hidden on `camera` segments. Five groups:
  - `(home)` — dashboard + statistics
  - `(fleet)` — list, `[id]`, add, `edit/[id]`
  - `(inspections)` — list, `[id]`, new
  - `(bookings)` — list, `[id]`, new (5-step wizard), calendar, `pickup/[id]` (3-step handover), `return/[id]` (4-step return)
  - `(more)` — hub: clients (incl. quick-register), contracts, billing, violations, analytics, notifications, settings (language/theme/profile), agency (admin-only), agency-qr
- `src/app/(app)/pdf-viewer.tsx` — shared PDF viewer route (contracts/invoices).
- Deep link scheme: `myfleet`.

## State & data flow

Three layers, consistently applied across domains:

1. **Services** (`src/services/*Service.ts`) — typed fetch wrappers over `apiRequest` in `src/services/api.ts` (`ApiResponse<T>` envelope, `ApiClientError`, auth header from `src/services/authHeader.ts`). Base URL from `EXPO_PUBLIC_API_URL` (NestJS backend in `../backend`).
2. **React Query hooks** (`src/hooks/use*.ts`) — server state; `src/lib/queryClient.ts` + centralized `src/lib/queryKeys.ts`.
3. **Zustand stores** (`src/stores/`) — client state: `useAuthStore` (session, role admin/employee, persisted to AsyncStorage), `useBookingDraft` (wizard draft), settings/theme/locale stores, plus several legacy stores that still import mock data (`useContractStore`, `useBillingStore`, `useViolationStore`).

`src/lib/supabase.ts` creates the Supabase client (AsyncStorage-backed sessions). Auth is Supabase + Better Auth endpoints on the backend (`AUTH_BASE_URL = ${API}/auth`), with Google/Apple native sign-in.

## External services & native integrations

| Integration | Where |
| --- | --- |
| NestJS REST API (`../backend`) | all `src/services/*` via `apiRequest` |
| Supabase (auth sessions, signup doc storage) | `src/lib/supabase.ts`, `src/services/storage.ts`, `authService.ts` |
| Stripe (deposit auth holds, payment links; publishable key only) | `src/services/paymentService.ts`, `src/services/payments/stripePaymentLink.ts` |
| Mapbox (geocoding, driving distance, static map previews) | `src/services/mapsService.ts` |
| Google / Apple sign-in | `src/services/authService.ts` |
| Camera / image picker (inspections, client docs, vehicle photos) | `expo-camera`, `expo-image-picker` |
| PDF render & print/share (contracts, QR) | `react-native-pdf` (web-shimmed in `metro.config.js`), `expo-print`, `expo-sharing` |
| QR generation (agency public QR) | `react-native-qrcode-svg` |
| i18n EN/FR | `src/i18n/` (i18next + expo-localization) |

## Styling & theming

Mixed: **NativeWind 5 (preview)** with Tailwind 4 / `src/global.css` (63 files use `className`), a custom token system in `src/theme/` (colors/spacing/typography/shadows) consumed via `useTheme`, and ~8 files using `StyleSheet.create`. Web has platform-specific files (`*.web.tsx`) and `web-shims/`.

## Build & release

EAS (`eas.json`): `development` (dev client, internal), `preview` (internal APK / iOS device, env baked in — points at a nip.io-wrapped raw-IP backend), `production` (autoIncrement). App version 1.0.0, build 7 on iOS/Android. `app.json` carries an ATS exception for `217.65.144.155`. Pnpm patch `patches/@supabase__supabase-js@2.106.1.patch` neutralizes supabase-js's optional OpenTelemetry dynamic import (breaks Metro bundling).

## Known deviations from our target architecture

Recorded factually as legacy patterns (details in `../quality/debt-map.md`):

- **No test infrastructure at all** — no Jest/Detox/Maestro, no test files, no typecheck script; only `expo lint` is wired.
- **Mock data interleaved with live data**: `src/data/*` mocks are still imported by production screens (e.g. `mockClients` fallback in `(bookings)/[id].tsx`, `mockBookings` in client history and violation lookup, `CONTRACT_CLAUSES` in `contracts/new.tsx`, bundled `vehicleImages`/`vehicleAssets`).
- **Three styling systems coexist** (NativeWind classes, `src/theme` tokens, StyleSheet).
- **Zero `testID`s** anywhere; ~14 `any`/`@ts-ignore` occurrences.
- **Dual lockfiles** (`bun.lock`, `pnpm-lock.yaml`); pnpm appears canonical [inferred].
- **Broken script**: `npm run reset-project` references missing `scripts/reset-project.js`.
- Tokens persisted to AsyncStorage rather than `expo-secure-store` (which is installed but unused for sessions).
