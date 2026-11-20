# Phase 2 Evaluation (Ticket-02 — Contract v1.1)

## 1. Summary
- **Goal:** Synchronize all standardized constants, expand to 3 Nights (Đảo Bến, Đảo Cau, Đảo Chuông), implement Dash, Falling/Respawn, Gió Lạc, Bùa Gió, Wind, Pause, 3-Night Campaign UI, persisted Settings, Full Audio, Standard Palette, and Full HUD under Contract v1.1.
- **Outcome:** All `14/14` unit & headless contract tests pass, production build succeeds, and full 21,600-tick Night 3 headless benchmark finishes in **161 ms** (requirement `<= 30,000 ms`) with byte-identical determinism.

## 2. Phase 1 Regression & Change Handling
- Phase 1 unit tests were explicitly updated (never silently disabled) to match Ticket-02's standardized tuning (`player_speed: 6.0`, `carry_capacity: 10`, `pickup_radius: 1.0`, `pulse_cost: 3`, deposit-based `+10` mote scoring, and standardized shade states `spawning/wander/chase/recoil/stunned`).

## 3. Issues Caught & Harness Updates
- **CLI loop termination on `paused` state:** Caught during review of `src/headless/cli.js` that `sim.state === 'playing'` would prematurely exit headless runs upon pausing. Fixed loop condition to `sim.state !== 'won' && sim.state !== 'lost'` and covered it with a headless pause/resume test.
- **Harness updated:** Updated `AGENTS.md` (mandatory 12-step tick order, Contract v1.1 shade states, map module rule) and `.agents/skills/verify-phase/SKILL.md` (Nights 1–3 + 21,600-tick benchmark).
