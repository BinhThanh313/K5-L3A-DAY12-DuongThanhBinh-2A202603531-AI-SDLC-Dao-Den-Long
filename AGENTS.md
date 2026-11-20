# AGENTS.md — Đảo Đèn Lồng

## Commands
- Install & build: `npm install && npm run build`
- Run 3D game: `npm run dev` (or `npm run preview -- --host 127.0.0.1 --port 4173`)
- Run all tests: `npm test`
- Run full phase verification & save proof: `npm run verify`
- Run headless CLI: `node src/headless/cli.js --seed 1 --night 1 --ticks 600 --out out.jsonl`

## Architecture Rules (Contract v1.1)
- `src/sim/` MUST stay 100% pure ESM JavaScript with ZERO browser/DOM/Three.js imports.
- `src/sim/config.js` MUST stay in sync with `game.contract.json` tuning values (enforced by unit test).
- Follow the mandatory 12-step tick order in `src/sim/engine.js`:
  1. Input/pause -> 2. Timers -> 3. Move/jump/dash/pad/wind/fall -> 4. Pickup motes & charms -> 5. Lantern interact -> 6. Safe zones -> 7. Pulse -> 8. Move shades & drifters -> 9. Collisions (drifters steal before shades hit, ascending id) -> 10. Scheduled spawns -> 11. Win/lose -> 12. Snapshot.
- Shade states MUST use exact Contract v1.1 names: `spawning`, `wander`, `chase`, `recoil`, `stunned`.
- Maps 1, 2, 3 live in `src/sim/maps.js` with exact coordinates, spawn points, jump pads, ramps, and bell tower collision.
- Fixed timestep: `dt = 1 / 60`. All randomness MUST go through `src/sim/prng.js` seeded by `--seed`.
- Creative visual/audio additions live ONLY in `src/game/` and MUST NEVER alter `src/sim/` headless output.
- Full Night headless run (21,600 ticks) MUST complete in well under 30s.

## Verification Gate
- Never declare a phase complete without running `npm test` and `npm run verify` (exit code 0).
- Never fake tests or hand-edit proof outputs. Update old tests only when contract specs change, with documented reasons.
- Keep commits small and focused. Never delete harness files or force-push after tagging.
