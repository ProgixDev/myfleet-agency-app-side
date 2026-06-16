# AGENTS.md — operating manual for my-fleet (agency app)

## What this repository is

The agency-facing mobile app of **MyFleet**, a B2B fleet/car-rental management product for rental agencies: bookings, pickup/return handovers, 8-angle AI vehicle inspections, contracts with in-app signature, Stripe deposit holds, invoicing, violations, clients, and agency administration. Stack: **Expo SDK 55** (managed / CNG — no committed `ios/` or `android/` folders), **React Native 0.83.6**, **React 19.2**, **expo-router ~55** (file-based, typed routes), **TanStack React Query 5** (server state), **Zustand 5** (client state, persisted to AsyncStorage), **NativeWind 5 preview** + a custom `src/theme/` token system (mixed with some `StyleSheet`), **zod 4**, **i18next** (EN/FR), **Supabase** (auth + storage) and a NestJS backend at `../backend` reached via `EXPO_PUBLIC_API_URL`. This is a legacy in-production project under an AI operating model: we **evolve** it, we do not migrate or restructure it. Since it is on SDK 55, always consult the **versioned Expo docs for SDK 55** — APIs differ between SDKs.

## The loop

Every task follows: **Ground** → **Plan** → **Implement** → **Verify** → **Encode**.

1. **Ground** — read the docs in the map below and the neighboring code before writing anything.
2. **Plan** — for anything beyond a trivial fix, state a short plan (files, steps, risks) first.
3. **Implement** — small steps; keep the build green after each one.
4. **Verify** — run the check commands below. For UI changes, boot the app on a simulator/device and *look at it*; if a critical user journey (see `docs/product/critical-user-journeys.md`) is touched, walk that journey. Never claim done without evidence.
5. **Encode** — if a mistake could repeat, write the fix into a doc, test, or rule in the same PR (see the `encode-lesson` skill).

## Commands

There is **no test runner and no typecheck script** in `package.json` — "green" is the sequence below.

| Command | Purpose |
| --- | --- |
| `npm run start` | Start the Metro dev server (`expo start`). |
| `npm run ios` | Build & run on iOS simulator (`expo run:ios`, local prebuild). |
| `npm run android` / `npm run dev` | Build & run on Android (`expo run:android`). |
| `npm run web` | Start the web target (`expo start --web`). |
| `npm run lint` | ESLint via `expo lint` (eslint-config-expo flat config). |
| `npx tsc --noEmit` | Typecheck (strict mode is on; no script alias exists — run it directly). |

**Green = `npm run lint` + `npx tsc --noEmit` both clean**, plus visual verification for UI changes. EAS builds use `eas.json` profiles (`development`, `preview`, `production`). `npm run reset-project` is **broken** (`scripts/reset-project.js` does not exist) — never run it.

## Docs map

| Task | Read first |
| --- | --- |
| Any task | This file |
| Understanding structure, nav, data flow | `docs/architecture/overview.md` |
| Writing new code (style, patterns) | `docs/conventions/code-style.md` |
| Touching risky areas / before "fixing" something odd | `docs/quality/debt-map.md` |
| Product intent, scope, goals | `docs/product/prd.md` |
| What the app does, screen by screen | `docs/product/overview.md` |
| UI changes / flow changes | `docs/product/critical-user-journeys.md` |
| Architectural choices | `docs/architecture/decisions/` (ADRs) |

## Architecture as it is

- `src/app/` — expo-router routes. `(auth)` stack; `(app)` tab navigator with groups `(home)`, `(fleet)`, `(inspections)`, `(bookings)` (incl. `pickup/[id]`, `return/[id]`), `(more)` (clients, contracts, billing, violations, analytics, notifications, settings, agency).
- `src/components/` — shared UI primitives in `ui/`, feature components in `booking/`, `inspection(s)/`, `vehicle/`, `contracts/`.
- `src/services/` — typed REST clients over `apiRequest` (`src/services/api.ts`); one file per backend domain.
- `src/hooks/` — React Query hooks wrapping services (query keys in `src/lib/queryKeys.ts`).
- `src/stores/` — Zustand stores (auth, drafts, settings), persisted via AsyncStorage.
- `src/types/` · `src/utils/` · `src/theme/` · `src/i18n/` (EN/FR) · `src/lib/` (queryClient, supabase client).
- `src/data/` — **legacy mock data, still partially imported by live screens** (see debt map).
- Path aliases: `@/*` plus `@components/*`, `@services/*`, etc. (tsconfig).
- Build/release: EAS (`eas.json`); `metro.config.js` adds a web shim for `react-native-pdf`; one pnpm patch on `@supabase/supabase-js` in `patches/`.

## Rules for new code

- New code follows `docs/conventions/code-style.md` section (b); existing code is left alone unless the task is about it.
- Inventory existing code before adding anything — prefer extending existing patterns (`ui/` primitives, service/hook/queryKey pattern) over inventing new ones. Reuse, never recreate.
- TypeScript: no new `any`, no new `@ts-ignore` (use `@ts-expect-error` with a reason) — even though old code has ~14 occurrences.
- Validate at the edges: new code parses external input (network responses, deep links, storage rehydration) — zod is already a dependency; use it.
- New interactive elements get a `testID` (kebab-case, feature-prefixed, e.g. `booking-confirm-button`) even though the existing codebase has zero.
- New logic gets tests where feasible; bug fixes get a regression test first. **There is no test setup yet** — adding one (jest-expo) requires an ADR first. Never place test files under `src/app/` where the router would treat them as routes.
- New dependencies: check Expo SDK 55 compatibility with `npx expo install <pkg>`; anything architectural gets an ADR in `docs/architecture/decisions/`.
- All money is **integer cents** end-to-end; format only via `src/utils/format.ts` / `src/utils/money.ts`. Never do float arithmetic on amounts.
- All user-facing strings go through i18n: add keys to **both** `src/i18n/en.json` and `fr.json`.
- Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:` …) — this matches the existing history.
- Never weaken a gate (lint rule, tsconfig strictness, CI step) to make work pass; propose gate changes explicitly and separately.
- Boy-scout rule is **opt-in**: only clean adjacent code when explicitly asked.

## Native code policy

This is a **CNG/prebuild** project: there are no committed `ios/`/`android/` folders; `expo run:*` generates them. **Never hand-edit generated native folders** — native changes go through `app.json` plugins or config plugins. Existing patches: `patches/@supabase__supabase-js@2.106.1.patch` (pnpm `patchedDependencies`; disables the optional OpenTelemetry dynamic import that breaks Metro). If you bump `@supabase/supabase-js`, the patch must be re-validated or re-created.

## Legacy zones — handle with care

- `src/data/*` mocks still imported by live screens (fallback client data, booking history, contract clauses, vehicle images, activity feed) — removing or "wiring up" these casually can silently change production UI. See debt map.
- Payments/deposits (`bookingService`, `paymentService`, `usePayments`, pickup/return flows) — Stripe manual-capture holds + cash flow + cents math, **zero automated tests**. Treat as high-risk; verify on device against CUJ-03/04.
- `nativewind@5.0.0-preview.3` + `react-native-css` + `lightningcss` override — preview-release styling chain; upgrades here break builds.
- Dual lockfiles (`bun.lock` + `pnpm-lock.yaml`); pnpm appears canonical (workspace file + patchedDependencies). Don't regenerate either casually.
- `eas.json` preview profile embeds env values incl. a raw-IP API host with an ATS exception in `app.json` — coordinated infra, do not "clean up".

## When unsure

Stop after **two failed attempts** at the same fix; ask one concrete question instead of pushing a hack through. If a doc here conflicts with the code, the doc may be stale: flag it and propose the doc fix in the same PR.

### Questions for the owner (recorded, not blocking)

1. Is **pnpm** the canonical package manager (and `bun.lock` stale), or the reverse? [inferred: pnpm]
2. Are the `src/data/*` mock imports in live screens (e.g. `mockClients` fallback in `(bookings)/[id].tsx`) intentional placeholders awaiting backend endpoints, or forgotten dev scaffolding?
3. Is the raw-IP backend (`217.65.144.155` / nip.io in `eas.json`) a temporary staging setup that docs should treat as throwaway?
