# AI Usage & Token Log

## Phase 1 (PRD-0 + Test Contract v1.0)
- **Tools used:** Antigravity AI coding assistant (Gemini model).
- **Estimated usage:** ~25k input tokens, ~10k output tokens (~$0.05–$0.10 equivalent).
- **Token-saving strategies applied:**
  1. Read all lab docs once in parallel and designed the full architecture & verification plan (`docs/notes/phase-1-spec.md`) before generating code.
  2. Chose lightweight stack (`three` + `vite` + Node built-in `node --test`) — avoided heavy frameworks, TypeScript build chains, or large test runners.
  3. Kept `AGENTS.md` concise (~25 lines) so every turn stays low-context.
  4. Shared one pure JS engine (`src/sim/engine.js`) between headless and 3D renderer instead of maintaining two codebases.
  5. Caught and fixed bugs locally via `npm run verify` instead of blind multi-turn retries.

## AI Error Log
| Phase | Error | How Detected | Resolution |
|---|---|---|---|
| Phase 1 | Passed `shell: true` to `spawnSync(process.execPath, ...)` on Windows, breaking paths with spaces. | Running `npm run verify` | Restricted `shell: true` to `npm` only; verified cross-platform execution. |
| Phase 1 | Initial proof scenario in `verify-phase.mjs` had 4 starting motes instead of 5 after spending 1 on pulse, ending in `playing` instead of `won`. | Manual inspection of `out-win.jsonl` | Adjusted scenario + added hard assertion `winEnd.state === 'won'` in `verify-phase.mjs`. |

## Phase 2 (Ticket-02 — Contract v1.1)
- **Tools used:** Antigravity AI coding assistant (Gemini model).
- **Estimated usage:** ~35k input tokens, ~18k output tokens (~$0.08–$0.15 equivalent).
- **Token-saving strategies applied:**
  1. Isolated all 3 map geometries & collision math into a dedicated pure module (`src/sim/maps.js`) so `engine.js` stayed clean and easy to edit in one pass.
  2. Reused the existing `node --test` and `scripts/verify-phase.mjs` harness instead of rewriting test infrastructure.
  3. Caught the headless CLI pause-loop bug by design review before running tests, saving retry cycles.

| Phase | Error | How Detected | Resolution |
|---|---|---|---|
| Phase 2 | Headless CLI loop checked `sim.state === 'playing'`, which would stop early when `state === 'paused'`. | Code review during v1.1 upgrade | Changed condition to `sim.state !== 'won' && sim.state !== 'lost'` and added headless pause/resume test. |

## Phase 3 (Ticket-03 — Contract v1.2)
- **Tools used:** Antigravity AI coding assistant (Gemini model).
- **Estimated usage:** ~22k input tokens, ~11k output tokens (~$0.05–$0.09 equivalent).
- **Token-saving strategies applied:**
  1. Wrote `docs/notes/phase-3-adr.md` and `CHANGELOG.md` upfront to map out all 4 `[THAY THẾ]` rules before editing `src/sim/engine.js` in a single pass.
  2. Used integer `1/60` fuel units (`6000 = 100.0 fuel`) as recommended by Ticket-03, avoiding floating-point precision debugging.

| Phase | Error | How Detected | Resolution |
|---|---|---|---|
| Phase 3 | Pressing interact 1–2 ticks after lighting a lantern (`fuelUnits = 5998`, displayed `100.0`) triggered `refuel` with `used = 1` because Step 2 decayed `1/60` before Step 5. | Unit test `[P3] fuel decay, lantern_out, relight cost 5, and refuel formula` | Guarded Step 5 refuel eligibility with `fuelUnits < FUEL_MAX_UNITS - 3` (where 1-decimal fuel is `< 100.0`). |
