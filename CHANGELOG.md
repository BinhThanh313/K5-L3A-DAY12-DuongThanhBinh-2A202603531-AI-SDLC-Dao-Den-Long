# CHANGELOG

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
