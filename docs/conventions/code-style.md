# Code style & conventions

Two sections: **(a)** what the codebase does today (detected), **(b)** what all *new* code must do. Where they conflict: **follow (b) in new files; match (a) only when editing inside an existing legacy module.**

## (a) Detected conventions

- **Files/naming:** routes are lower-case/expo-router style (`[id].tsx`, `new.tsx`, group folders `(bookings)`); shared components PascalCase under `src/components/ui/` (with a barrel `index.ts`) and feature folders (`booking/`, `inspection/`, `vehicle/`, `contracts/`); a few older kebab-case components (`themed-text.tsx`, `app-tabs.tsx`). Hooks `useX.ts`, services `xService.ts`, stores `useXStore.ts`, types one file per domain in `src/types/`.
- **Imports:** path aliases `@/…` (plus `@components/…`, `@services/…`, etc.). Relative imports are rare.
- **Styling:** mostly NativeWind `className` (Tailwind 4, `src/global.css`); theme tokens via `useTheme()` + `src/theme/*` for colors/spacing/typography; occasional `StyleSheet.create` (8 files); platform splits via `*.web.tsx` and `metro.config.js` web shims.
- **Server state:** React Query hooks per domain (`src/hooks/useBookings.ts` …) calling services; query keys centralized in `src/lib/queryKeys.ts`; API envelope `ApiResponse<T>` with `ApiClientError`.
- **Client state:** Zustand stores with `persist` + AsyncStorage; wizard drafts in `useBookingDraft`.
- **Navigation:** typed routes (`experiments.typedRoutes`), `router.push`/`<Redirect>`; multi-step flows are single screens with internal step state (booking wizard, pickup/return).
- **i18n:** all screen copy via `useTranslation()`; keys in `src/i18n/en.json` + `fr.json`.
- **Money:** integer cents end-to-end, formatted via `src/utils/format.ts` / `money.ts` (since the cents migration, commit `fa4ae7b`).
- **Commits:** Conventional Commits (`feat(bookings): …`, `fix(deps): …`, `chore(eas): …`).
- **Enforced vs conventional:** *Enforced:* TypeScript `strict: true`, `eslint-config-expo` via `expo lint`. *Merely conventional:* everything else — no Prettier config, no tests, no CI gates detected, no pre-commit hooks.
- **Legacy quirks:** ~14 `any`/`@ts-ignore` occurrences; zero `testID`s; some stores/screens still import `src/data/*` mocks.

## (b) Target conventions for new code

- **Strict TypeScript:** no new `any`, no `@ts-ignore` (only `@ts-expect-error` with a one-line reason). Exported functions get explicit return types.
- **Validate at trust boundaries:** parse network responses, deep-link params, and storage rehydration with **zod** (already a dependency; see `src/types/vehicleSchema.ts` for the existing pattern) before trusting them.
- **Screens stay thin:** data fetching in React Query hooks, business logic in `src/services/` or `src/utils/`, screens compose components. No inline `fetch` in screens.
- **No new module-level state singletons:** new client state goes in a Zustand store or React context; no mutable module globals.
- **Reuse UI primitives:** build on `src/components/ui/*` (Button, Card, Input, BottomSheet, Toast, …) instead of one-off styling; new primitives go into `ui/` with the barrel export.
- **Styling:** prefer NativeWind `className` + `src/theme` tokens for new components; do not introduce a fourth styling approach.
- **i18n always:** never hardcode user-facing strings; add keys to both `en.json` and `fr.json` in the same PR.
- **Money:** integer cents only; format through `formatCurrency`; never float math on amounts.
- **`testID`s:** every new interactive element gets one — kebab-case, feature-prefixed (`fleet-add-submit`, `booking-step-next`).
- **Tests:** new logic gets tests where the setup allows; there is currently **no test runner** — adopting one (jest-expo recommended) requires an ADR. Never place test files under `src/app/` (the router would register them as routes).
- **Animations:** use Reanimated worklets (off the JS thread); respect reduced-motion where the animation is decorative.
- **Dependencies:** add via `npx expo install <pkg>` (SDK 55 compatibility); architectural additions get an ADR.
- **Routing:** keep typed routes valid — run `npx tsc --noEmit` after adding/renaming routes.
- **Commits:** Conventional Commits, small and scoped.
