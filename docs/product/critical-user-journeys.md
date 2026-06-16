# Critical user journeys (CUJs)

The journeys that must never break. **Every row is `[inferred — confirm]`** until the product owner confirms it (this doc was reverse-engineered unattended on 2026-06-12).

**Rules going forward**

- A change touching a CUJ requires **running that journey on a simulator/device** before claiming done (there is no automated coverage — see column 5).
- New user-visible features must extend an existing CUJ row or register a new one here.
- When a journey's screens move, update the "where it lives" column in the same PR.

| ID | Journey | Steps in the user's words | Where it lives in code | Test coverage |
| --- | --- | --- | --- | --- |
| CUJ-01 | Sign in | "I open the app and sign in with my email (or Google/Apple/phone), and land on my dashboard." | `src/app/index.tsx` → `(auth)/login.tsx` (`phone-login`/`otp`) → `(app)/(home)/index.tsx`; `useAuthStore`, `authService.ts` | none — untested |
| CUJ-02 | Create a booking | "I pick a car, pick (or quickly add) the client, set the dates, see the price with insurance and delivery, and confirm — and I'm warned if it double-books." | `(bookings)/new.tsx` (5 steps), `useBookingDraft`, `bookingService.ts`, `pricing.ts`, `mapsService.ts`, `clients/quick-register.tsx` | none — untested |
| CUJ-03 | Pickup handover | "When the client arrives, I check identity/payment/keys, photograph the car from 8 angles with mileage and fuel, then they sign the contract on my phone and drive off." | `(bookings)/pickup/[id].tsx`, `BookingInspectionStep.tsx`, `SignaturePad.tsx`, `contractService.ts`, `pickupEligibility.ts` | none — untested |
| CUJ-04 | Return & damage assessment | "When the car comes back I redo the photos, compare before/after, log any new damage and km overage, the client signs off, and the deposit is captured or released." | `(bookings)/return/[id].tsx`, `PrePostAngleList.tsx`, `bookingService.ts` (`close`, `deposit/capture`, `deposit/release`), `invoiceService.ts` | none — untested |
| CUJ-05 | Take a deposit / get paid | "I send a payment link or take cash, and I can see the deposit held, captured, or released on the booking." | `(bookings)/[id].tsx`, `paymentService.ts`, `payments/stripePaymentLink.ts`, `usePayments.ts` | none — untested |
| CUJ-06 | Standalone inspection with AI | "I document a vehicle's condition: 8 photos, mileage, fuel, run the AI, review what it found, save the report." | `(inspections)/new.tsx`, `[id].tsx`, `inspectionService.ts`, `useInspectionPhotoUploads.ts`, `ManualAngleReviewModal.tsx` | none — untested |
| CUJ-07 | Register a walk-in client | "A new client at the counter: I type their name and phone and photograph their ID, license, and card in under two minutes." | `(more)/clients/quick-register.tsx`, `clientService.ts`, `useClientDocuments.ts` | none — untested |
| CUJ-08 | Record a violation | "A fine arrives: I enter the date and plate, the app tells me which booking and client it was, and I log it with our admin fee." | `(more)/violations/new.tsx`, `violationService.ts`, `violationLookup.ts` | none — untested |
| CUJ-09 | Chase an invoice | "I see which invoices are overdue, open one, and send a reminder or record a payment/refund." | `(more)/billing/index.tsx`, `[id].tsx`, `invoiceService.ts`, `paymentService.ts` | none — untested |
| CUJ-10 | Add a vehicle to the fleet | "I add a car with photos, plate, rate, and insurance tier, and it shows up available for booking." | `(fleet)/add.tsx`, `VehicleFormFields.tsx`, `useVehiclePhotoUploads.ts`, `fleetService.ts` | none — untested |
| CUJ-11 | Agency onboarding | "I create my agency account, upload our legal documents, and configure delivery pricing and booking policies." | `(auth)/register.tsx`, `storage.ts` (signup-upload), `(more)/agency.tsx`, `agencyService.ts` | none — untested |

> Coverage note: there is no Jest/Detox/Maestro setup in this repository at all; "none — untested" is literal. Adopting an E2E harness for CUJ-02/03/04 (the money paths) is the highest-leverage quality investment — see `../quality/debt-map.md` item 1.
