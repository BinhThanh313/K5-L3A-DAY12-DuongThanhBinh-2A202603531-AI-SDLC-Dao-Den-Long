---
name: verify-phase
description: Run all automated unit tests, headless Test Contract v1.1 scenarios (Nights 1-3, dash, fall, drifter, charm, pause, wind), determinism check, 21,600-tick performance check, production build, and save real verification evidence to docs/proof/phase-N/.
---

# Skill: verify-phase

Use this skill before tagging any phase (`phase-1` .. `phase-4`) or whenever simulation logic, maps, Test Contract, or build config changes.

## Steps
1. Run `npm run verify` (which executes `scripts/verify-phase.mjs`).
2. Confirm exit code is `0`:
   - All unit & headless contract tests pass (`npm test`).
   - Production Vite build succeeds (`npm run build`).
   - Headless scenarios for Nights 1, 2, 3 and new features (dash, fall, drifter, charm, pause, wind) pass assertions.
   - Determinism check (2 runs identical byte-for-byte) passes.
   - Full-night 21,600-tick headless benchmark finishes in well under 30 seconds.
3. Inspect the generated proof files in `docs/proof/phase-2/` (or current phase folder).
4. If any check fails, fix the root cause in code (never fake or skip tests) and re-run until green.
