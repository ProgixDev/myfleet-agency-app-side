# Maestro E2E flows — agency app

UI smoke/E2E flows for the agency app, run with [Maestro](https://maestro.mobile.dev).

## Prerequisites

- Maestro CLI (`curl -Ls "https://get.maestro.mobile.dev" | bash`)
- An iOS Simulator **booted** (`xcrun simctl boot "iPhone 17"` or open Simulator.app)
- The app **installed** on that simulator. It's a **debug build**, so the Metro
  packager must be running for it to load JS:

  ```bash
  npm run ios            # first time: builds, installs, and starts Metro
  # or, if already installed:
  npx expo start         # then launch the app on the sim
  ```

## Run

```bash
npm run test:e2e         # runs the passing smoke suite (tag: smoke)
maestro test .maestro/smoke.yaml      # a single flow
```

Screenshots land in `~/.maestro/tests/<timestamp>/` and via `takeScreenshot`.

## Flows

| File | Tag | Status |
| --- | --- | --- |
| `smoke.yaml` | `smoke` | ✅ Launch → onboarding renders → welcome renders |
| `login.yaml` | `wip` | ⛔ Blocked — see below |

QA login: `agencyqa1781442020@example.com` / `Test1234!` (the QA test agency).

## Known testability limitations (important)

This app currently can't be driven past sign-in by Maestro. Two compounding issues:

1. **New Architecture (Fabric):** `testID` does **not** surface as an iOS
   accessibilityIdentifier, so Maestro `id:` selectors never match. Flows must
   target visible **text** (bilingual FR/EN regexes work well).
2. **Sign-in is a modal** (`presentation: "modal"` → a separate iOS window).
   Maestro cannot read its content **or** inject text into it; coordinate taps
   don't focus its fields. So the authenticated area is unreachable.

**To unlock full E2E** (login → bookings → pickup/return → inspection):
render sign-in in the root window — drop `presentation: "modal"` from the
`login` Stack.Screen in `src/app/(auth)/_layout.tsx` (or present the form
inline on `welcome`). After that, `login.yaml` and follow-on authed flows can
run. Camera-driven steps (the 8-angle inspection) still need a fixture/mock to
be automatable.
