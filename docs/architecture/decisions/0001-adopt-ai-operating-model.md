# ADR-0001: Adopt the AI operating model

- **Status:** accepted
- **Date:** 2026-06-12

## Context

This project (the MyFleet agency app) predates our EXPO-SKELETON standards. It is in production (EAS build 7 on both stores' track), has no automated tests, mixes mock data with live API data in places, and carries several fragile dependencies (NativeWind 5 preview, a patched `@supabase/supabase-js`). Rewriting or migrating it would be high-risk and is not the goal.

## Decision

Adopt the AI operating model **additively**: install `AGENTS.md` (the loop, rules for new code), `docs/` (architecture, conventions, debt map, reverse-engineered product layer), and `.claude/skills/` workflow commands — without migrating, refactoring, or restructuring any existing code.

## Consequences

- New code follows the target conventions in `docs/conventions/code-style.md` section (b); legacy code is documented (section (a) + `docs/quality/debt-map.md`), not rewritten.
- Every future architectural choice (test runner adoption, styling consolidation, dependency upgrades with patches) gets an ADR in this folder, numbered sequentially.
- Docs are kept truthful: when code and docs diverge, the doc is fixed in the same PR — facts have one home.
- The debt map is append-only; findings are recorded there instead of fixed-by-the-way.
