# Debt map — known landmines

**Append-only.** Future sessions add dated findings here instead of fixing-by-the-way. Fixing an item requires its own task (and usually an ADR or spec), never a drive-by.

## 2026-06-12 — initial audit

### P1 — biggest risks

1. **Zero automated test coverage on money and handover flows.** No Jest/Detox/Maestro anywhere. The deposit lifecycle (Stripe manual-capture holds: authorize → capture/partial-capture/release, cash-paid marking, km-overage billing in cents) spans `src/services/bookingService.ts`, `paymentService.ts`, `src/utils/pricing.ts`, `money.ts`, and the pickup/return screens — all verified only by hand. A regression here directly mis-charges customers. *This is the single biggest risk in the repo.*
2. **Mock data interleaved with live production screens.** Live imports of `src/data/*`: `mockClients` fallback in `src/app/(app)/(bookings)/[id].tsx`; `mockBookings` in `clients/[id].tsx` (booking history) and `src/utils/violationLookup.ts`; `CONTRACT_CLAUSES` from `src/data/contracts.ts` in `contracts/new.tsx`; `recentActivity` from `src/data/dashboard.ts` in `notifications/index.tsx`; `mockVehicles` (brand/category suggestions) in `fleet/add.tsx`; bundled `vehicleImages.ts`/`vehicleAssets.ts` used as thumbnail fallbacks across fleet/booking/inspection views. Risk: fake data shown to real users, or API failures silently masked. Do not remove or "wire up" casually — each usage needs a deliberate task. *Open question for owner: intentional placeholders or forgotten scaffolding?*
3. **Legacy Zustand stores still mock-backed:** `useContractStore`, `useBillingStore`, `useViolationStore` import `src/data/*` while React Query hooks for the same domains hit the real API — two sources of truth for the same entities.

### P2 — fragile dependencies & config

4. **`nativewind@5.0.0-preview.3`** + `react-native-css@3` + pinned `lightningcss@1.30.1` override — preview-release styling chain; minor upgrades have historically broken builds. Treat any bump as its own task with full visual verification.
5. **Patched `@supabase/supabase-js@2.106.1`** (`patches/`, pnpm `patchedDependencies`): disables the optional `@opentelemetry/api` dynamic import that breaks Metro. Any supabase-js upgrade must re-validate/re-create the patch.
6. **Dual lockfiles:** `bun.lock` and `pnpm-lock.yaml` are both committed; `pnpm-workspace.yaml` + `pnpm.patchedDependencies` suggest pnpm is canonical and `bun.lock` is stale [inferred — confirm with owner]. Installing with the wrong manager will skip the supabase patch.
7. **Raw-IP backend with ATS exception:** `eas.json` preview profile bakes `EXPO_PUBLIC_API_URL=https://217.65.144.155.nip.io` and `app.json` carries an `NSExceptionDomains` entry for `217.65.144.155`. Coordinated with server infra — do not "clean up" unilaterally. Supabase anon key and Stripe test publishable key are committed in `eas.json` (publishable by design, but worth owner review).
8. **Session tokens persisted in AsyncStorage** (`useAuthStore` persist + supabase client storage) instead of `expo-secure-store`, which is installed but unused for sessions.
9. **React Compiler experiment enabled** (`experiments.reactCompiler`) — still experimental on SDK 55; be alert to memoization-related heisenbugs.

### P3 — hygiene

10. **Broken script:** `npm run reset-project` → `scripts/reset-project.js` does not exist (template leftover, as is most of `README.md`).
11. ~14 `any` / `@ts-ignore` occurrences across `src/` (largest cluster in stores/screens touching mocks).
12. **Zero `testID`s** in the entire codebase — blocks any future E2E adoption until new code starts adding them (rule now in AGENTS.md).
13. No CI detected in-repo (no `.github/workflows`) — lint/typecheck run only on dev machines.
14. `README.md` is the untouched create-expo-app template; real onboarding info lives in `AGENTS.md`/`docs/` as of today.

## Planned changes (flagged 2026-06-12 — not yet started)

### Payment wall → RevenueCat
The **subscription paywall** is planned to move to **RevenueCat** (`react-native-purchases` + `-ui`, app-store IAP). Reference dossier (different app, "Libou" — pattern only): `/Users/achrafarabi/Dev/libou/docs/research/revenuecat-integration.md`. It targets Expo SDK 56 / RN 0.85; **this app is SDK 55 / RN 0.83**, so verify compatibility via `npx expo install` and expect a mandatory dev-client rebuild (native code — CNG).

- **Critical constraint:** RevenueCat handles app-store subscription IAP only — it **cannot** process the rental **deposit holds and booking charges** (Stripe manual-capture: `paymentService.ts` / `bookingService.ts` / `pricing.ts` + pickup/return flows, P1 item #1). Those stay on a PSP. This migration touches the **agency SaaS subscription** surface (the starter / professional / enterprise plans), not the deposit/booking money flow.
- **Open question (scope):** confirm the paywall in scope is the agency subscription, and that the P1 deposit/booking Stripe flow is explicitly out of scope. `[inferred: yes]`

Until decided: don't assume the current subscription-billing mechanism is permanent; flag any subscription/billing task against this note.

### Update 2026-06-12 — payment architecture decided (owner-approved); supersedes the RevenueCat plan above
- The agency **subscription + AI credit top-ups are sold on the new web admin** via Stripe — **not in-app**. This app is a **login-only companion** for billing: no in-app purchase, no paywall screen, **RevenueCat is not used**.
- Deposits/booking stay on Stripe and move to **Stripe Connect** (each agency a connected account; per-agency payouts + platform application fee; manual-capture deposits carry over).
- **AI credits** live as a ledger in the backend (Supabase); this app only *checks/displays* the balance via API and gates AI actions on it. The detection engine behind the credits is still being evaluated (research in progress).
