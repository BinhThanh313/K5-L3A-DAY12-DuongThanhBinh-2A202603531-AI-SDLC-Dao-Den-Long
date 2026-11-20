# Phase 1 Specification & Verification Plan (PRD-0)

## 1. Mandatory Requirements (PRD-0 + Test Contract v1.0)
- **M1 (Island & Lanterns):** Circular island (Night 1 – Đảo Bến) with 5 Great Lanterns (`L1`..`L5`).
- **M2 (Player Controls & 3D Camera):** Mây moves, jumps, 3rd-person 3D camera, wears conical hat (nón lá) with small hanging lantern.
- **M3 (Fireflies / Motes):** Motes spawn across island, auto-pickup within `pickup_radius` up to `carry_capacity`, award `score.per_mote`.
- **M4 (Deposit & Lighting Lanterns):** Interact within `interact_radius` deposits carried motes into nearest unlit lantern; reaching `lantern_cost` lights it, awards `score.per_lantern`, and gradually brightens the island.
- **M5 (Ink Shades / Bóng Mực):** Spawn and chase Mây; cannot enter `safe_radius` around lit lanterns; touching Mây within `shade_hit_radius` deals 1 flame damage, drops `floor(carried * hit_drop_ratio)` motes, triggers `invuln_s`.
- **M6 (Pulse / Tỏa sáng):** Edge-triggered pulse costs `pulse_cost` motes, stuns (`pulse_stun_s`) and pushes (`pulse_push_m`) shades within `pulse_radius`, respects `pulse_cooldown_s`, awards `score.per_stun` per stunned shade.
- **M7 (Win / Lose / Score / HUD / Replay):** All 5 lanterns lit -> `won` (`all_lit`) with time & flame bonuses; 0 flames -> `lost` (`no_flames`); timer reaches 0 -> `lost` (`dawn`). HUD shows flames, carried motes, lit lanterns, timer, score, pulse status. Replay button resets game cleanly.
- **M8 (Test Contract v1.0 Headless):** `game.contract.json` + CLI supporting `--seed`, `--night 1`, `--scenario`, `--inputs`, `--ticks`, `--out`, `--snapshot-every`, 60Hz fixed tick, strict input/scenario validation (exit code 2), deterministic output, exact JSONL schema.

## 2. Explicit Assumptions (Resolving Ambiguities in PRD-0)
| Area | Assumption | Rationale |
|---|---|---|
| Island geometry | Flat circular island at `Y = 0`, radius `35 m`. Lanterns `L1..L5` placed evenly on a ring of radius `22 m`. | Accommodates example scenario coordinates up to `30.1 m` cleanly while keeping traversal brisk at `7 m/s`. |
| Falling off island | `fall_enabled: false`; player and shades are clamped to island radius `35 m`. | Explicitly permitted by Test Contract v1.0 (`"fall_enabled": false`). Avoids ambiguous fall-death depth rules. |
| Safe radius | Applies to **lit** lanterns only (`lit === true`). When a lantern ignites, shades inside `safe_radius` are pushed out to `safe_radius`. | Matches lore ("Bóng Mực sợ những chiếc đèn" once lit) and gives clear gameplay incentive. |
| Hit drop rounding | `dropped = Math.floor(carried * hit_drop_ratio)` (`hit_drop_ratio = 0.5`). Dropped motes vanish in Phase 1 (not re-spawned on ground). | Standard deterministic integer rounding; never exceeds `carried`. |
| Interact target | Deposits into the nearest unlit lantern within `interact_radius` (`3.0 m`), transferring `min(carried, lantern_cost - deposited)` in one press. | Clean, responsive single-press deposit. |
| Win bonus formula | On `all_lit`: `score += Math.floor(time_left_s) * per_second_left + flames * per_flame_left`. | Matches Test Contract tuning keys `per_second_left` and `per_flame_left`. |
| Shade spawning | When `random_shades: true` and no `scenario.shades`: starts with 2 shades (`S1`, `S2`) at outer ring; spawns 1 more every `35 s` up to max 5 (`shade_spawned` event). | Keeps Night 1 tense yet fair. |
| Mote spawning | When `random_motes: true` and no `scenario.motes`: starts with 18 motes; respawns 1 mote every `6 s` if active motes `< 18`. | Ensures player never runs soft-locked out of motes. |

## 3. Verification Plan (Defined Before Coding)
1. **Unit tests (`tests/sim.test.js`):**
   - Movement + `cam_yaw_deg` rotation + diagonal vector normalization.
   - Mote pickup radius boundary (`<= pickup_radius`) and `carry_capacity` cap.
   - Deposit + lantern ignition + `all_lit` win + score calculation.
   - Pulse cost, cooldown, stun duration, radial push distance, `stunned_ids`.
   - Shade chase, `safe_radius` exclusion around lit lanterns, `player_hit`, `invuln_s`, `hit_drop_ratio`, `no_flames` loss.
   - Dawn timeout (`dawn` loss).
2. **Headless contract tests (`tests/headless.test.js`):**
   - Run CLI on win, lose (no_flames & dawn), pulse, and safe_radius scenarios; verify JSONL schema, tick model, rounding (3 decimals), and exit code `0`.
   - **Determinism check:** run twice with identical `--seed`, `--scenario`, `--inputs` and assert byte-for-byte identical JSONL output.
   - **Error handling:** non-increasing input ticks, malformed JSON, out-of-range move -> assert exit code `2` and non-empty `stderr`.
3. **Build & Playable 3D Verification (`npm run verify`):**
   - `npm run build` succeeds with 0 errors.
   - All unit + headless tests pass and outputs are saved under `docs/proof/phase-1/`.
   - Live browser test of 3D scene, controls, HUD, win/lose, and replay.
