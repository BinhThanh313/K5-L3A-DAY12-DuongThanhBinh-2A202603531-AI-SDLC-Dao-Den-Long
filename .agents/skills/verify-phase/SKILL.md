---
name: verify-phase
description: Run all automated unit tests, headless Test Contract scenarios, determinism check, production build, and save real verification evidence to docs/proof/phase-N/.
---

# Skill: verify-phase

Use this skill before tagging any phase (`phase-1` .. `phase-4`) or whenever simulation logic, Test Contract, or build config changes.

## Steps
1. Run `npm run verify` (which executes `scripts/verify-phase.mjs`).
2. Confirm exit code is `0` (all unit tests, headless contract scenarios, determinism diff, and `vite build` passed).
3. Inspect the generated proof files in `docs/proof/phase-1/` (or current phase folder) to verify real outputs match requirements.
4. If any check fails, fix the root cause in code (never fake or skip tests) and re-run until green.
