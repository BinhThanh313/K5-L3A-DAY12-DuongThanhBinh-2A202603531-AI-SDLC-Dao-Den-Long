# CHANGELOG

## [1.0.0 — Phase 4 / Contract v1.3] - 2026-11-20 (Ticket-04: "Bình minh: phát hành v1.0.0")

### Added
- **Benchmark Mode (`bench_cmd`):** `node scripts/bench.mjs --seed 42 --duration 30 --out bench.json` launches a non-fullscreen `1280×720` window with vsync disabled (`--disable-frame-rate-limit --disable-gpu-vsync`), loads standard Night 1 lighting & shadows with 200 wandering Shades and 100 Motes rendered via `THREE.InstancedMesh`, L1–L3 lit at `fuel = 100`, Mây stationary at `(0,0,0)`, orbiting camera (`r = 30 m, Y = 15 m`, CCW from `(30,15,0)`, `15 s/rev`), 3 s warmup + `--duration` measurement, and outputs Contract v1.3 `bench.json`.
- **Soak Test (`soak_cmd`):** `node scripts/soak.mjs --seed 7 --nights 10 --out soak.json` runs 10 consecutive headless nights (rotating Nights 1→2→3) in a single Node process with seeded random inputs, verifying `crashes = 0` and bounded RSS (`mem_end_mb <= 1.2 * mem_start_mb`).
- **Local Disk Leaderboard:** `src/sim/leaderboard.js` + `scripts/run.mjs` persist top-10 scores to `data/leaderboard.json` (accessible from Main Menu and Result screen after Dawn Victory or defeat; supports 3–12 char `[A-Za-z0-9_]` + Vietnamese accented letters; sorted by score desc, earlier `achieved_at` tie-break). Export via `node scripts/run.mjs --export-leaderboard out.json`.
- **Accessibility Suite:**
  - Full key remapping for all 9 actions (`moveUp`, `moveDown`, `moveLeft`, `moveRight`, `jump`, `dash`, `interact`, `pulse`, `pause`) with duplicate-key conflict warning and "Khôi phục mặc định".
  - Visual subtitles & indicators for Shade spawn (with directional edge arrow), Wind warning, last 10 seconds, and low-fuel lanterns (`fuel < 30`).
  - Reduce Motion mode ("Giảm chuyển động") disabling camera shake, hit screen-flash, and blinking CSS animations.
  - Minimum `18 px` UI font size at `1280×720` plus Large Text (`×1.25`) toggle.
- **Test Contract v1.3:** Updated `game.contract.json` (`contract_version: "1.3"`, `run_cmd`, `bench_cmd`, `soak_cmd`), added `tests/phase4.test.js`, and updated `scripts/verify-phase.mjs` for Phase 4 proof.
- **Release & Retrospective:** Updated `README.md`, `CREDITS.md`, `docs/notes/phase-4-eval.md`, and `docs/notes/retro.md`.

## [Phase 3 — Contract v1.2] - 2026-11-20 (Ticket-03: "Đèn cạn dầu")

### Breaking Changes (Replaced Rules from Phase 1 & Phase 2)
1. **[REPLACED] Lanterns are no longer permanently lit (`fuel` system):**
   - Lit lanterns start with `fuel = 100` and decay at `1.0 fuel/s` (`1/60` per tick).
   - Interacting with a lit lantern (`fuel < 100`) now refuels it (`+10 fuel/mote`, event `refuel`) instead of being ignored. Full lanterns (`fuel = 100`) are ignored.
   - When `fuel <= 0`, the lantern turns off (`lit: false, deposited: 0, ever_lit: true`) and emits `lantern_out`.
   - Relighting an `ever_lit` lantern costs `5` motes (down from `10`) and emits `lantern_lit` with `relight: true`.
2. **[REPLACED] Safe zone now requires `fuel >= 30` & Shades drain weak lanterns:**
   - Lit lanterns with `fuel < 30` lose their `6 m` safe zone.
   - `wander` Shades prioritize the nearest lit lantern with `fuel < 30` (tie-break by smaller `id`) and enter the new `drain` state at `XZ <= 2.0 m`, draining `5.0 fuel/s` (`fuel_drain` event every 60 ticks).
3. **[REPLACED] Win condition changed from `all_lit` (early win) to `dawn_survived`:**
   - Lighting all lanterns no longer ends the Night early.
   - Night durations changed from `300 / 330 / 360 s` to `240 / 270 / 300 s`.
   - Victory is checked at dawn (`time_left_s <= 0`) when Mây is alive and `lit_lanterns >= ceil(0.6 * total_lanterns)` (3/5, 4/6, 5/7), emitting `game_over` with `reason: "dawn_survived"`.
4. **[REPLACED] Scoring formula overhauled:**
   - Mote deposited/refueled: `+5` (was `+10`).
   - First-time lantern light: `+100`; relight: `+40`.
   - Shade stunned by Pulse: `+5` (`+15` if the Shade was in `drain` state).
   - Dawn survival bonus (on win only): `+50 + floor(fuel)` per lit lantern, `+50` per remaining flame. Time-left bonus removed (`per_second_left: 0`).

### Added
- Progressive carry capacity: `capacity = min(20, 10 + 2 * successful_lights)`.
- Colorblind accessibility setting ("Bảng màu dễ phân biệt") with `#00B3FF` shade rim, `#FFFFFF` + `⚠` UI warning, 20% squashed/torn unlit lanterns, and 1 Hz low-fuel blinking bar.
- Test Contract v1.2 snapshot fields (`lanterns[].{fuel, ever_lit, relit_count}`, `player.capacity`, `shades[].state = "drain"`) and scenario overrides (`lanterns[].{fuel, ever_lit}`, `player.successful_lights`, `shades[].target_lantern_id`).

## [Phase 2 — Contract v1.1] - 2026-11-20 (Ticket-02: "Ba hòn đảo")
- Standardized tuning constants, 12-step tick order, 3 Nights (Đảo Bến, Đảo Cau, Đảo Chuông), Dash, Falling/Respawn, Gió Lạc (Drifters), Bùa Gió (Wind Charm), Pause, and 3-Night Campaign UI.

## [Phase 1 — Contract v1.0] - 2026-11-20 (PRD-0)
- Initial Night 1 (Đảo Bến) 3D game and headless Test Contract v1.0 runner.
