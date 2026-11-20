# AGENTS.md — Đảo Đèn Lồng

## Commands
- Install & build: `npm install && npm run build`
- Run 3D game: `npm run dev` (or `npm run preview -- --host 127.0.0.1 --port 4173`)
- Run all tests: `npm test`
- Run full phase verification & save proof: `npm run verify`
- Run headless CLI: `node src/headless/cli.js --seed 1 --night 1 --ticks 600 --out out.jsonl`

## Architecture Rules
- `src/sim/` MUST stay 100% pure ESM JavaScript with ZERO browser/DOM/Three.js imports so headless runs directly in Node.js on macOS/Linux/Windows.
- `src/sim/config.js` MUST stay in sync with `game.contract.json` tuning values.
- All distances for gameplay checks are measured on the horizontal **XZ plane** (`<= r`), no entity radius added.
- Fixed timestep: `dt = 1 / 60`. All randomness MUST go through `src/sim/prng.js` seeded by `--seed`.
- Creative visual/audio additions live ONLY in `src/game/` and MUST NEVER alter `src/sim/` headless output.

## Verification Gate
- Never declare a phase or task complete without running `npm test` and `npm run verify` and checking that all assertions pass with exit code 0.
- Never fake tests or hand-edit proof outputs. Record real command outputs.
- Keep commits small and focused. Never delete harness files or force-push after tagging.
