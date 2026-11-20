# ADR-001: Lantern Fuel State Machine, Shade Drain Behavior & Dawn Survival Win Condition (Phase 3 / Ticket-03)

## Status
Accepted — Supersedes Phase 1–2 permanent-lantern and `all_lit` early-win rules.

## Context
Ticket-03 ("Đèn cạn dầu" · Contract v1.2) replaces four core mechanics:
1. Lit lanterns now burn fuel (`1.0/s`) and can be refueled (`+10 fuel/mote`) or burn out (`lantern_out`), requiring `5` motes to relight (`ever_lit: true`).
2. Lanterns with `fuel < 30` lose their `6 m` safe zone; `wander` Shades target the nearest weak lit lantern (`fuel < 30`) and enter a new `drain` state within `2 m` (`5.0 fuel/s`).
3. Early win (`all_lit`) is removed; victory (`dawn_survived`) is evaluated at dawn (`time_left_s <= 0`) when Mây is alive and `litCount >= ceil(0.6 * totalLanterns)`.
4. Carry capacity scales with `successful_lights` (`min(20, 10 + 2 * successful_lights)`), and scoring is overhauled.

## Decision

### 1. Exact Integer Fuel Arithmetic (`1/60` units)
To eliminate floating-point drift across 18,000+ ticks, each lantern stores `fuelUnits` as an integer where `60 units = 1.0 fuel` (`FUEL_MAX_UNITS = 6000`, `FUEL_LOW_UNITS = 1800`, `FUEL_PER_MOTE_UNITS = 600`).
- Every tick in **Step 2**, each lit lantern subtracts `1` unit (natural decay) plus `5` units per Shade currently in `drain` on that lantern.
- Immediately after **Step 2**, any lit lantern with `fuelUnits <= 0` transitions to `lit = false, deposited = 0, everLit = true, fuelUnits = 0` and emits `lantern_out`.
- External outputs (`snapshot`, `refuel`, `fuel_drain`) convert `fuelUnits / 60` rounded to 1 decimal place (`Math.round((fuelUnits / 60) * 10) / 10`).

### 2. Lantern State & Interaction Model
Each lantern tracks `{ id, pos, lit, deposited, fuelUnits, everLit, relitCount }`.
- **Eligible for Interact (`XZ <= 2.0 m`)**: `!l.lit` OR (`l.lit && l.fuelUnits < 6000`). Full lanterns (`fuelUnits === 6000`) are skipped so Mây never wastes motes or triggers no-op events.
- **Unlit interaction**: costs `5` if `everLit` else `10`. On completion: `lit = true`, `fuelUnits = 6000`, `successfulLights++`, `capacity = min(20, 10 + 2 * successfulLights)`, emits `lantern_lit { lantern_id, relight: everLit }`.
- **Lit interaction (Refuel)**: `used = min(carried, ceil((6000 - fuelUnits) / 600))`, adds `used * 600` capped at `6000`, emits `refuel { lantern_id, amount: used, fuel }`. If `fuelUnits` crosses from `< 1800` to `>= 1800`, the `6 m` safe zone reactivates and ejects any Shades inside within 30 ticks.

### 3. Shade `drain` State Transitions
- `wander -> chase`: player within `12 m`.
- `wander -> drain`: no player within `12 m`, nearest weak lit lantern (`fuelUnits < 1800`) is within `XZ <= 2.0 m`.
- `drain` per tick: stands still, drains `5` `fuelUnits`/tick, emits `fuel_drain` every 60 ticks of continuous drain.
- `drain -> chase`: player enters `XZ <= 6.0 m`.
- `drain -> stunned`: hit by Pulse (awards `+15` total score instead of `+5`).
- `drain -> wander`: target lantern burns out, is refueled to `>= 1800` (`fuel >= 30`), or distance `> 2.0 m`.

### 4. Dawn Survival Win Condition (Step 11)
Evaluated after all tick updates:
1. `player.flames <= 0` -> `lost` (`no_flames`).
2. `timeLeftS <= 0`:
   - If `litCount >= Math.ceil(0.6 * lanterns.length)` -> add dawn bonuses (`+50 + floor(fuel)` per lit lantern, `+50` per remaining flame), `won` (`dawn_survived`).
   - Else -> `lost` (`dawn`).

## Consequences
- Tests asserting immediate win on lighting all lanterns (`all_lit`) or old scoring constants are updated with documented reasons in `tests/sim.test.js` and `tests/headless.test.js`.
