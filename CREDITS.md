# CREDITS

## Original Concept
- **Đảo Đèn Lồng** setting, characters (Mây, Đèn Lồng Lớn, Đom Đóm, Bóng Mực): Day 12 AI SDLC Lab original specification.

## Libraries (MIT License)
- [Three.js](https://threejs.org/) — 3D rendering (MIT License)
- [Vite](https://vite.dev/) — Frontend bundler & dev server (MIT License)

## Procedural Assets & Audio
- All 3D models (Mây with conical hat & hanging lantern, Great Lanterns, Ink Shades, Fireflies, circular island, sea of clouds) are procedurally constructed in code using Three.js primitives.
- All sound effects (pentatonic chimes, lantern ignition chord, pulse wave, hit thud) are procedurally synthesized via Web Audio API in `src/game/audio.js`. No external copyrighted audio or 3D models were used.

## AI Tools Used
- Antigravity AI coding assistant (Gemini model) — used for architecture planning, code generation, Three.js procedural geometry, Web Audio API synthesis, automated test authoring, benchmark/soak harness, and documentation.
- All generated code, tests, benchmark results, and soak test runs were verified directly by automated test suites and manual review.
