# AGENTS.md — Đảo Đèn Lồng

## Commands
- Install & build: `npm install && npm run build`
- Run 3D game (with disk leaderboard): `node scripts/run.mjs` (or `npm start`)
- Export leaderboard: `node scripts/run.mjs --export-leaderboard out.json`
- Run all tests: `npm test`
- Run full phase verification & save proof: `npm run verify`
- Run headless CLI: `node src/headless/cli.js --seed 1 --night 1 --ticks 600 --out out.jsonl`
- Run benchmark (Contract v1.3): `node scripts/bench.mjs --seed 42 --duration 30 --out bench.json`
- Run soak test (Contract v1.3): `node scripts/soak.mjs --seed 7 --nights 10 --out soak.json`

## Architecture Rules (Contract v1.3)
- `src/sim/` MUST stay 100% pure ESM JavaScript with ZERO browser/DOM/Three.js imports.
- `src/sim/config.js` MUST stay in sync with `game.contract.json` v1.3 tuning values (enforced by unit test).
- Lantern fuel MUST use integer `1/60` units (`6000` units = `100.0` fuel) to prevent floating-point drift; round to 1 decimal only on output.
- Tick order in `src/sim/engine.js`:
  1. Input/pause -> 2. Timers + fuel decay (`1/60`) & shade drain (`5/60`), then immediately turn off lanterns with `fuel <= 0` (`lantern_out`) -> 3. Move/jump/dash/pad/wind/fall -> 4. Pickup motes & charms (up to `player.capacity`) -> 5. Lantern interact (light/relight/refuel) -> 6. Safe zones (`fuel >= 30`) -> 7. Pulse (`+15` if draining else `+5`) -> 8. Move shades & drifters (`drain` at `<= 2m` of weak lantern) -> 9. Collisions -> 10. Scheduled spawns -> 11. Win/lose (`no_flames` first, then at dawn `dawn_survived` if `lit >= ceil(0.6*total)` else `dawn`) -> 12. Snapshot.
- Shade states MUST use exact Contract v1.2 names: `spawning`, `wander`, `chase`, `recoil`, `stunned`, `drain`.
- Fixed timestep: `dt = 1 / 60`. All randomness MUST go through `src/sim/prng.js` seeded by `--seed`.
- Creative visual/audio additions live ONLY in `src/game/` and MUST NEVER alter `src/sim/` headless output.

## Verification Gate
- Never declare a phase complete without running `npm test` and `npm run verify` (exit code 0).
- Never fake tests or hand-edit proof outputs. Update old tests only when contract specs change, with documented reasons.
- Keep commits small and focused. Never delete harness files or force-push after tagging.
