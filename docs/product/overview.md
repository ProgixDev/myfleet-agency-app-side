# Product overview — what this app is and does today

Written for a new teammate. Everything below is observed in the code (screens under `src/app/`, copy in `src/i18n/en.json`).

**My Fleet (agency app)** is the mobile control room for a car-rental agency. An admin or counter employee signs in and runs the whole rental business from five tabs: **Dashboard, Fleet, Inspections, Bookings, More**.

## Getting in

First launch shows an animated splash, then a 3-screen onboarding carousel and a welcome screen ("Get Started" / "Sign In"). Agencies register in a 4-step flow — personal info, agency details, password, legal document upload (KBIS, license, insurance) — or sign in with email/password, Google, Apple, or phone + OTP. (`src/app/(auth)/`)

## Dashboard (home tab)

A time-of-day greeting, then a "focus card" that surfaces the most urgent thing: booking conflicts first, then overdue returns, then today's returns, else all-clear. Below it: fleet pulse (rented/available/maintenance bar), quick actions (Inspection, Booking, Client), today's returns, and an active-rentals carousel. A statistics screen breaks down fleet status, booking counts, and revenue. (`(home)/index.tsx`, `statistics.tsx`)

## Fleet tab

The vehicle catalog: searchable, filterable grid/list with status badges and daily rates. Each vehicle has a detail page (gallery, specs, mileage, insurance tier, booking history) and add/edit forms with photo capture. (`(fleet)/`)

## Bookings tab

The heart of the app. A filterable list and an agenda/calendar view of all rentals. **Creating a booking** is a 5-step wizard: pick a vehicle (availability-aware), pick or instantly create a client, choose dates/times (double-booking conflicts are flagged), set pricing — insurance tier, included km, optional delivery/recovery priced by Mapbox driving distance — and confirm. Payment is collected via Stripe payment link, deposit auth hold, or cash at the counter.

**Pickup** (`pickup/[id].tsx`) is a guided 3-step handover: verify identity/payment/keys → pre-rental inspection (8 photo angles, mileage, fuel, optional AI damage scan) → show the rental contract PDF and capture the client's signature on screen. The booking goes *active*.

**Return** (`return/[id].tsx`) is 4 steps: checklist → post-rental inspection (same 8 angles) → side-by-side pre/post comparison to spot new damage → sign-off that totals damages by severity and any km overage, closes the booking, and feeds the damages invoice / deposit capture-or-release.

## Inspections tab

Standalone vehicle condition reports (pre-rental, post-rental, or routine). The capture flow walks through the 8 angles (camera or upload, auto angle-tagging), records mileage and fuel, and can run **AI damage detection** per angle or for the whole inspection — detections appear as confidence-scored markers the agent can confirm, edit, or dismiss alongside manual annotations. A detail viewer offers a gallery, fullscreen damage view, and pre/post compare mode. (`(inspections)/`, `src/components/inspection*/`)

## More tab

The operations hub: **Clients** (CRUD plus a quick-register flow that photographs ID, license, and credit card for walk-ins), **Contracts** (PDF list, view, re-sign, regenerate), **Billing** (rental + damages invoices, overdue flags, reminders, payments/refunds), **Violations** (enter a fine by date + plate; the backend resolves which vehicle/booking/client it belongs to, an admin fee is added), **Analytics** (revenue, top clients, trends), **Notifications**, **My QR Code** (shareable agency QR), **Settings** (language EN/FR, theme, profile, booking policies, delivery pricing), and — for admins — the **Agency** console: profile, subscription plan, team members, legal documents, delivery base geocoding.

## What powers it

A NestJS + Supabase backend (`../backend`) behind a typed REST client (`src/services/`); Supabase for auth sessions and document storage; Stripe for deposit holds and payment links (publishable key only on device); Mapbox for geocoding/distance/static maps; React Query for server state, Zustand for local state; everything localized in English and French and themed light/dark.
