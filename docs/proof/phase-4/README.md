# Phase 4 Proof Artifacts (Contract v1.3 / Release v1.0.0)

Generated automatically by `npm run verify` (`scripts/verify-phase.mjs`), `scripts/bench.mjs`, and `scripts/soak.mjs`:

- [verification-summary.txt](verification-summary.txt) — Overall pass/fail summary for Contract v1.3
- [test-output.txt](test-output.txt) — Full `node --test` output (15/15 tests passing: Phase 1–3 regressions + Phase 4 bench/soak/leaderboard/contract v1.3)
- [build-output.txt](build-output.txt) — Production Vite build output (`dist/`)
- [soak.json](soak.json) — 10-Night headless soak test proof (`seed 7`, `crashes: 0`, `mem_end_mb <= 1.2 × mem_start_mb`)
- [leaderboard-export.json](leaderboard-export.json) — Output of `node scripts/run.mjs --export-leaderboard`
- [night3-18000-run1.jsonl](night3-18000-run1.jsonl) & [night3-18000-run2.jsonl](night3-18000-run2.jsonl) — Byte-identical 18,000-tick Night 3 determinism proof
- Root [bench.json](../../../bench.json) — Official 30-second 1280×720 3D benchmark (`avg_fps: 95.9`, `p1_low_fps: 32.5`, `load_ms: 1579`)
- Root [soak.json](../../../soak.json) — Official 10-night soak test (`crashes: 0`, `mem_start_mb: 51.2`, `mem_end_mb: 58.1`)
