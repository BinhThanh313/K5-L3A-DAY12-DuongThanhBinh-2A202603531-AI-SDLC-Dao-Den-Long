# Phase 3 Evaluation (Ticket-03 — Contract v1.2)

## 1. Summary
- **Goal:** Handle a major Change Request replacing core lantern, safe-zone, win-condition, and scoring rules (`Contract v1.2`) within the 30-minute Phase 3 window.
- **Outcome:** All `11/11` unit & headless test suites pass, production Vite build succeeds, Night 3 full-length 18,000-tick benchmark runs in **172 ms** (byte-identical determinism), and all breaking changes are documented in [phase-3-adr.md](phase-3-adr.md) and [CHANGELOG.md](../../CHANGELOG.md).

## 2. How Replaced Rules & Old Tests Were Handled
- Instead of silently skipping or deleting tests broken by Ticket-03, we explicitly updated the affected tests in `tests/sim.test.js` and `tests/headless.test.js` with `[UPDATED FOR P3 TICKET-03]` annotations explaining why `all_lit` early win was replaced by `dawn_survived` and how the new `+5/mote`, `+40 relight`, and dawn fuel bonuses are calculated.
- All non-replaced Phase 1 & Phase 2 mechanics (movement, rotation, pickup radius, dash, fall/respawn, jump pads, drifter steal/drop, wind charm, pause) continue to pass regression tests unchanged.

## 3. Issues Caught & Resolved
- **Full-lantern refuel guard after Step 2 decay:** Because Step 2 decays fuel by `1/60` (`0.0167`) before Step 5 processes player interaction, a newly lit lantern (`6000` units) had `5998..5999` units (`99.97..99.98` fuel, still displayed as `100.0`) on the immediate next tick, causing `ceil((100 - fuel) / 10)` to evaluate to `1` instead of `0`. Caught immediately by `tests/sim.test.js` line 128! Fixed by treating `fuelUnits >= FUEL_MAX_UNITS - 3` (where 1-decimal displayed fuel is still `100.0`) as full (`used = 0`).
