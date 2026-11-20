import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const PROOF_DIR = path.resolve('docs/proof/phase-2');
fs.mkdirSync(PROOF_DIR, { recursive: true });

function runCmd(cmd, args, label, useShell = false) {
  console.log(`\n=== [${label}] ${cmd} ${args.join(' ')} ===`);
  const res = spawnSync(cmd, args, { encoding: 'utf8', shell: useShell });
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
  if (res.status !== 0) {
    throw new Error(`${label} failed with exit code ${res.status}`);
  }
  return res;
}

// 1. Unit & headless contract tests
const testRes = runCmd(process.execPath, ['--test', 'tests/sim.test.js', 'tests/headless.test.js'], 'Unit & Headless Tests');
fs.writeFileSync(path.join(PROOF_DIR, 'test-output.txt'), testRes.stdout + testRes.stderr, 'utf8');

// 2. Production Vite build
const buildRes = runCmd('npm', ['run', 'build'], 'Production Build (Vite)', process.platform === 'win32');
fs.writeFileSync(path.join(PROOF_DIR, 'build-output.txt'), buildRes.stdout + buildRes.stderr, 'utf8');

// 3. Headless Scenario: Night 2 Dash + Charm + Drifter Steal/Drop + Pause
const n2Scenario = path.join(PROOF_DIR, 'scenario-night2-features.json');
const n2Inputs = path.join(PROOF_DIR, 'inputs-night2-features.json');
const n2Out = path.join(PROOF_DIR, 'out-night2-features.jsonl');

fs.writeFileSync(
  n2Scenario,
  JSON.stringify(
    {
      player: { pos: [35, 0, 0], carried: 8, flames: 3 },
      random_motes: false,
      random_shades: false,
      random_drifters: false,
      motes: [],
      shades: [],
      drifters: [{ id: 'D1', pos: [35.5, 1.0, 0], state: 'chase' }]
    },
    null,
    2
  )
);
fs.writeFileSync(
  n2Inputs,
  JSON.stringify(
    {
      frames: [
        { tick: 0, dash: true },
        { tick: 1, dash: false, pulse: true },
        { tick: 2, pulse: false, pause: true },
        { tick: 3, pause: false },
        { tick: 15, pause: true },
        { tick: 16, pause: false }
      ]
    },
    null,
    2
  )
);
runCmd(
  process.execPath,
  ['src/headless/cli.js', '--seed', '7', '--night', '2', '--scenario', n2Scenario, '--inputs', n2Inputs, '--ticks', '40', '--out', n2Out, '--snapshot-every', '10'],
  'Night 2 Features Scenario (Dash, Charm, Drifter, Pause)'
);

// 4. Full Night 3 (21,600 ticks) Performance & Determinism Benchmark
const n3Run1 = path.join(PROOF_DIR, 'night3-21600-run1.jsonl');
const n3Run2 = path.join(PROOF_DIR, 'night3-21600-run2.jsonl');
const t0 = performance.now();
runCmd(
  process.execPath,
  ['src/headless/cli.js', '--seed', '2026', '--night', '3', '--ticks', '21600', '--out', n3Run1, '--snapshot-every', '600'],
  'Night 3 Full-Length Benchmark (21,600 ticks) Run 1'
);
const benchMs = Math.round(performance.now() - t0);

runCmd(
  process.execPath,
  ['src/headless/cli.js', '--seed', '2026', '--night', '3', '--ticks', '21600', '--out', n3Run2, '--snapshot-every', '600'],
  'Night 3 Full-Length Determinism Run 2'
);

const identical = fs.readFileSync(n3Run1, 'utf8') === fs.readFileSync(n3Run2, 'utf8');
if (!identical) throw new Error('Night 3 determinism check FAILED!');
if (benchMs > 30000) throw new Error(`Night 3 21,600-tick benchmark exceeded 30s: ${benchMs}ms`);

const summary = [
  `Phase 2 Verification Summary (Contract v1.1)`,
  `Timestamp: ${new Date().toISOString()}`,
  `Node: ${process.version}`,
  `Unit & Headless Tests: PASS`,
  `Vite Production Build: PASS`,
  `Night 2 Features Scenario: PASS (${path.basename(n2Out)})`,
  `Night 3 Full-Night Benchmark (21,600 ticks): PASS (${benchMs} ms <= 30,000 ms limit)`,
  `Night 3 Determinism (21,600 ticks x2): PASS (byte-identical)`
].join('\n');

fs.writeFileSync(path.join(PROOF_DIR, 'verification-summary.txt'), summary + '\n', 'utf8');
console.log('\n' + summary);
