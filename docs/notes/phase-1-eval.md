# Phase 1 Evaluation

## 1. Summary
- **Goal:** Build Night 1 (Đảo Bến) playable 3D game + Test Contract v1.0 headless simulation + automated verification before the 1h mark.
- **Outcome:** All 8 core requirements (M1–M8) verified and passing (`11/11` automated tests, `vite build` clean, determinism byte-identical across 600 ticks, win+pulse headless scenario verified).

## 2. What Worked Well
- **Contract-first architecture:** Designing `src/sim/engine.js` as pure ESM JavaScript with zero Three.js/DOM dependencies allowed both the 3D browser game and Node.js headless CLI to share 100% identical logic and tuning.
- **Verification before tagging:** Running `npm run verify` caught two real issues immediately before committing (documented below).

## 3. AI Errors Caught & Harness Updates
1. **Windows `spawnSync` with `shell: true` on `process.execPath`:**
   - *How caught:* Running `npm run verify` failed immediately (`'C:\Program' is not recognized`) because `C:\Program Files\nodejs\node.exe` contains a space.
   - *Fix:* Updated `scripts/verify-phase.mjs` to use `shell: false` for `process.execPath` and `shell: true` only for `npm` on Windows.
2. **Weak assertion in initial `verify-phase.mjs` win scenario:**
   - *How caught:* Manually inspecting `docs/proof/phase-1/out-win.jsonl` revealed that starting with `carried: 4`, spending 1 on `pulse`, and picking 1 mote left the player with 4/5 motes on `L1` (`state: "playing"` instead of `"won"`).
   - *Fix:* Fixed scenario to start with `carried: 5` AND added an explicit assertion in `scripts/verify-phase.mjs` (`winEnd.state === 'won'`) so the script fails if the win condition isn't actually reached.

## 4. Next Steps for Phase 2
- Keep `src/sim/config.js` locked to `game.contract.json` via the automated sync test.
- Run full Phase 1 regression tests (`npm run verify`) after integrating Ticket-02 changes.
