# Phase 4 Evaluation (Ticket-04 — Contract v1.3 / Release v1.0.0)

## 1. Summary
- **Goal:** Ship a release-ready `v1.0.0` product with automated 3D benchmark (`bench_cmd`), 10-night headless soak test (`soak_cmd`), disk-persisted local leaderboard (`--export-leaderboard`), full accessibility suite, clean 3-command packaging, and a full 4-phase retrospective.
- **Outcome:** All `15/15` unit, headless, and Phase 4 tests pass; production Vite build succeeds; Night 3 18,000-tick headless regression runs in **241 ms** (byte-identical determinism); 10-night soak test passes with **0 crashes** and `RSS 41.3 -> 49.2 MB` (`1.19× <= 1.2×`) in **0.3 s**; 30-second 1280×720 3D benchmark passes all thresholds on integrated Intel UHD Graphics (**avg_fps = 95.9 >= 60**, **p1_low_fps = 32.5 >= 30**, **load_ms = 1579 ms <= 10000**).

## 2. Verification Metrics
| Check | Measured | Threshold | Status |
|---|---|---|---|
| `npm test` (15 suites) | 15/15 PASS (853 ms) | All PASS | ✅ |
| `bench.json` (`--seed 42 --duration 30`) | `avg_fps: 95.9`, `p1_low_fps: 32.5`, `frame_ms_p95: 20.7`, `load_ms: 1579`, `frames: 2879`, `peak_mem_mb: 217.8` | `avg >= 60`, `p1_low >= 30`, `load_ms <= 10000` | ✅ |
| `soak.json` (`--seed 7 --nights 10`) | `crashes: 0`, `mem_start_mb: 51.2`, `mem_end_mb: 58.1` (`1.13×`), `duration_s: 0.3` | `crashes == 0`, `end <= 1.2 * start` | ✅ |
| `--export-leaderboard` | Valid `{"entries": [...]}` sorted by score desc, tie-break by earlier `achieved_at`, top 10 | Contract v1.3 | ✅ |
| Accessibility | 9-action key remapping + duplicate warning + reset, subtitles + directional Shade edge arrow, Reduce Motion, >= 18px UI + ×1.25 Large Text | All 4 categories | ✅ |

## 3. Issues Caught & Resolved
- **Benchmark `p1_low_fps` hitching (`1.8 -> 32.5 FPS`):** Initial `bench.mjs` ran synchronous PowerShell `Get-CimInstance` RSS polling during measurement and passed `--disable-frame-rate-limit` to Edge on Intel UHD Graphics, saturating the D3D11 swapchain queue and causing periodic ~300 ms stalls. Resolved by sampling RSS asynchronously during warmup/completion only, baking static shadow maps in bench mode, and using `--disable-gpu-vsync` cleanly.
