# AI Usage & Token Log

## Phase 1 (PRD-0 + Test Contract v1.0)
- **Tools used:** Antigravity AI coding assistant (Gemini model).
- **Estimated usage:** ~25k input tokens, ~10k output tokens (~$0.05–$0.10 equivalent).
- **Token-saving strategies applied:**
  1. Read all lab docs once in parallel and designed the full architecture & verification plan (`docs/notes/phase-1-spec.md`) before generating code.
  2. Chose lightweight stack (`three` + `vite` + Node built-in `node --test`) — avoided heavy frameworks, TypeScript build chains, or large test runners.
  3. Kept `AGENTS.md` concise (~25 lines) so every turn stays low-context.
  4. Shared one pure JS engine (`src/sim/engine.js`) between headless and 3D renderer instead of maintaining two codebases.
  5. Caught and fixed bugs locally via `npm run verify` instead of blind multi-turn retries.

## AI Error Log
| Phase | Error | How Detected | Resolution |
|---|---|---|---|
| Phase 1 | Passed `shell: true` to `spawnSync(process.execPath, ...)` on Windows, breaking paths with spaces. | Running `npm run verify` | Restricted `shell: true` to `npm` only; verified cross-platform execution. |
| Phase 1 | Initial proof scenario in `verify-phase.mjs` had 4 starting motes instead of 5 after spending 1 on pulse, ending in `playing` instead of `won`. | Manual inspection of `out-win.jsonl` | Adjusted scenario + added hard assertion `winEnd.state === 'won'` in `verify-phase.mjs`. |
