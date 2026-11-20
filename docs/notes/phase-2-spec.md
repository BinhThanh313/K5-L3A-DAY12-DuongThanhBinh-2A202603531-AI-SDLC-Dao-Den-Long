# Phase 2 Specification & Verification Plan (Ticket-02 — Contract v1.1)

## 1. Breaking / Standardized Changes from Phase 1
- **Standardized Tuning:** Replaced Phase 1 custom numbers with Ticket-02 mandatory constants (`player_speed: 6.0`, `carry_capacity: 10`, `lantern_cost: 10`, `pickup_radius: 1.0`, `interact_radius: 2.0`, `pulse_cost: 3`, `pulse_radius: 5.0`, `pulse_stun_s: 2.0`, `pulse_push_m: 4.0`, `pulse_cooldown_s: 3.0`, `shade_speed: 4.0` / `4.5`, `shade_hit_radius: 1.0`, `fall_enabled: true`).
- **Scoring:** `+10` moved from pickup to **deposit** (`per_mote: 10`), `per_lantern: 100`, `per_stun: 5`, `per_second_left: 2`, `per_flame_left: 50`.
- **Shade States:** Standardized to `spawning`, `wander`, `chase`, `recoil`, `stunned` (with 12 m detect / 18 m leash and 60-tick recoil).
- **Phase 1 Test Updates:** Unit tests in `tests/sim.test.js` updated to reflect the new standardized numbers and deposit-based mote scoring (documented in test names and git diff).

## 2. Acceptance Criteria for Part 3 Features
| Feature | Acceptance Criteria | Verification |
|---|---|---|
| **Dash (Lướt)** | Edge-triggered `dash` moves Mây at `14 m/s` for `12` ticks (`0.2 s`), cooldown `90` ticks (`1.5 s` from start), preserves altitude in air, emits `dash {}`. | Unit + headless scenario |
| **Falling (`Y < -10`)** | Crossing island boundary drops Mây; at `Y < -10` loses 1 flame (ignores invuln), loses all carried motes (`player_hit` with `by: "fall"`, `lost`), waits 60 ticks, respawns at `(0,0,0)` with 90 ticks invuln (or `no_flames` loss if 0 flames). | Unit + headless scenario |
| **3 Standardized Maps** | Night 1 (Đảo Bến r=40, 5 lanterns), Night 2 (Đảo Cau 2×r=28 + bridge + 2 jump pads, 6 lanterns), Night 3 (Đảo Chuông 3 tiers + 2 ramps + jump pad + bell tower + wind, 7 lanterns). | Unit + headless scenarios for Nights 1, 2, 3 |
| **Gió Lạc (Drifters)** | Spawns on Nights 2 & 3 at ticks `1200, 2400, ...` (max 2); `idle -> chase` when carried `>= 5` and dist `<= 15 m`; steals `min(3, carried)` on XZ `<= 1.2 m` (`drifter_steal`); Pulse during chase forces `flee`, Pulse during flee with loot drops motes (`drifter_drop`). | Unit + headless scenario |
| **Bùa Gió (Wind Charm)** | `C1` (Night 2) and `C1, C2` (Night 3); pickup grants `600` ticks of `7.2 m/s` speed and `0` dash cooldown (`charm_picked`); respawns after `2700` ticks. | Unit + headless scenario |
| **Pause (Esc/P)** | Edge-triggered `pause` toggles `playing <-> paused` (`paused {}` / `resumed {}`); while paused `tick` advances while `sim_tick`, timers, spawns, and TTL freeze. | Unit + headless scenario |
| **3-Night Campaign & UI** | Main Menu -> Night Intro (Ông Đăng dialogue) -> Gameplay -> Result -> Next Night -> Dawn Victory screen with total score; Pause menu (Resume/Retry/Settings/Menu); Settings (volume & mouse sensitivity persisted in `localStorage`). | Browser UI + Vite build |
| **Audio & Standard Palette & HUD** | Procedural night ambience + all 10 SFX (pickup, lantern lit, pulse, hit, jump, dash, win, lose, shade spawn, 10s countdown); exact Ticket-02 hex palette; full HUD with 10-slot mote bar, 30s blinking red timer, off-screen nearest unlit lantern arrow. | Visual/code audit + Vite build |
| **Performance** | Headless 21,600 ticks finishes in `<= 30 s` (target `< 2 s`). 3D game targets `>= 30 FPS` at 1280×720. | `npm run verify` benchmark |
