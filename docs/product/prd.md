# PRD — MyFleet agency app (reverse-engineered)

> Reconstructed from the codebase on 2026-06-12. Every claim is **observed** (with source) or marked `[inferred]`. Business intent not derivable from code is recorded as an Open Question, not assumed.

## Problem & opportunity

Small/medium car-rental agencies run their fleet on paper, spreadsheets, and WhatsApp: double-bookings, undocumented vehicle damage disputes, unsecured deposits, and untracked violations and invoices. `[inferred from the feature set: conflict detection on the dashboard, 8-angle photographic inspections with AI damage detection, Stripe deposit holds, violation lookup by plate]` MyFleet gives an agency one mobile tool that runs the entire rental lifecycle — booking → pickup handover → return & damage assessment → billing — with photographic evidence and held deposits as the dispute backstop.

## Goals & non-goals

- **Goal `[inferred]`:** make pickup/return handover fast and defensible (guided checklists, 8-angle photos, AI damage detection, in-app signed contract — observed: `pickup/[id].tsx`, `return/[id].tsx`, `SignaturePad.tsx`).
- **Goal `[inferred]`:** protect agency revenue (deposit auth holds, km-overage billing, damages invoices, violation pass-through with admin fee — observed: `bookingService.ts` deposit endpoints, `pricing.ts`, `violations/new.tsx`).
- **Goal `[inferred]`:** multi-tenant SaaS (agency signup with legal docs, subscription plans starter/professional/enterprise, team roles, "Multi-tenant" chip on the welcome screen — observed: `register.tsx`, `agency.tsx`, `welcome.tsx`).
- **Non-goal (observed):** this app does not serve the renter — the client-facing experience lives elsewhere (role `client` exists in `useAuthStore` types but no client UI here; agency QR points to a public URL).
- **Non-goal `[inferred]`:** no telematics/GPS tracking of vehicles in this app (backend has a `tracking` module; no consumer in this codebase).
- Other goals/non-goals: **unknown — see Open Questions.**

## Users & jobs

- **Agency admin** (observed role `admin`, `useAuthStore.ts`; admin-only Agency screen): owns the agency — configures pricing policies, delivery settings, team, legal docs, subscription; watches analytics and billing.
- **Agency employee/counter agent** (observed role `employee`): runs daily operations — creates bookings, registers walk-in clients with document capture, performs pickup/return handovers and inspections, records violations.
- A `client` role exists in types (observed, `useAuthStore.ts`) but has no surface in this app `[inferred: served by a separate client app]`.

## Current scope — shipped capabilities, ranked by centrality

1. **Booking lifecycle** (observed: `(bookings)/` group) — 5-step creation wizard (vehicle → client → dates with conflict detection → pricing/insurance/delivery-fee via Mapbox → confirm); statuses pending → confirmed → active → completed/cancelled; extend, cancel, auto-cancel-unpaid policy; calendar/agenda view.
2. **Pickup & return handovers** (observed: `pickup/[id].tsx` 3 steps, `return/[id].tsx` 4 steps) — identity/payment/keys checklist, pre- and post-rental inspections, pre/post comparison, damage sign-off, km-overage computation, contract signature.
3. **AI vehicle inspections** (observed: `(inspections)/`, `inspectionService.ts`) — 8 fixed angles, camera capture with angle tagging, mileage + fuel level, per-angle or full AI damage runs (confidence-scored markers), manual annotations (type/severity), pre/post compare viewer.
4. **Payments & deposits** (observed: `paymentService.ts`, `stripePaymentLink.ts`, `.env.example`) — Stripe deposit auth holds (manual capture/release/partial), cash-at-pickup marking, payment links; two-invoice billing (rental + damages); all amounts integer cents.
5. **Fleet management** (observed: `(fleet)/`) — vehicle CRUD with photos/video, status (available/rented/maintenance), daily rate, fleet stats.
6. **Clients & KYC** (observed: `clients/`, `quick-register.tsx`) — client CRUD, walk-in quick registration with ID/license/credit-card photo capture, document storage, tags (VIP/corporate/walk-in).
7. **Contracts** (observed: `contracts/`, `pdf-viewer.tsx`) — generated rental contract PDFs, in-app signature, regenerate, view/share.
8. **Billing & invoices** (observed: `billing/`) — invoice list/detail, overdue flags, reminders, payments/refunds.
9. **Violations** (observed: `violations/`) — record a fine by date+plate, backend lookup resolves vehicle/booking/client, admin fee added, status pending/paid/contested.
10. **Dashboard & analytics** (observed: `(home)/`, `analytics/`) — focus card (conflicts → overdue → returns today), fleet pulse, active rentals, revenue KPIs, top clients.
11. **Agency administration** (observed: `agency.tsx`, `agency-qr.tsx`, `settings/`) — agency profile, subscription plan, team, legal documents, delivery & booking policies, public QR code; EN/FR; light/dark theme.

## Constraints (observed)

- Expo SDK 55 / RN 0.83, CNG workflow; EAS build/release; iOS + Android (web target exists but secondary — shims, single-page output).
- Backend: NestJS + Supabase at `EXPO_PUBLIC_API_URL` (`../backend`); auth via Supabase/Better Auth with Google/Apple sign-in.
- Stripe publishable-key-only on device; deposit logic server-side. Mapbox public token for geocoding/distance.
- No automated tests exist; verification is manual (constraint on safe change velocity — see `../quality/debt-map.md`).
- Preview builds point at a raw-IP staging backend (ATS exception) — staging infra constraint.

## Success metrics

**Unknown — not derivable from code.** Candidates implied by the UI `[inferred]`: time-to-complete pickup/return handover, % of returns with documented damage evidence, deposit dispute rate, booking conflict rate, overdue-invoice total. See Open Questions.

## Open questions (awaiting product owner)

1. What are the actual business goals and success metrics for the agency app (activation, handover time, dispute reduction, revenue per agency)?
2. What is explicitly out of scope / non-goal (e.g., renter-facing features, telematics, fleet maintenance scheduling)?
3. Who is the target market (geography, fleet size)? FR strings + KBIS document + EUR-ish flows suggest France `[inferred]` — confirm.
4. Is the `client` role in the auth types served by a separate shipped app, and does this app need to stay compatible with it?
5. What is the subscription/monetization status (plans appear in `agency.tsx` — are starter/professional/enterprise live with Stripe billing)?
6. Are the `src/data/*` mock integrations (contract clauses, activity feed, client fallbacks) awaiting backend endpoints or scheduled for removal?

## Decision log

| Date | Decision |
| --- | --- |
| 2026-06-12 | PRD reverse-engineered from codebase; pending product-owner review. Questions above recorded instead of asked (session ran unattended). |
| 2026-06-12 | Planned: migrate the **agency subscription paywall** to RevenueCat (app-store IAP); the deposit/booking Stripe flow is out of scope. ADR pending — see debt-map "Planned changes". |
| 2026-06-12 | **Decided (owner-approved, supersedes the row above):** agency subscription + AI credit top-ups sold on the **web admin** via Stripe; this app is a **login-only companion** (no in-app paywall), **RevenueCat dropped**; deposits/bookings → **Stripe Connect**; **AI credits = backend ledger**. |
