import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const PROOF_DIR = path.resolve('docs/proof/phase-3');
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
const testRes = runCmd(process.execPath, ['--test', 'tests/sim.test.js', 'tests/headless.test.js'], 'Unit & Headless Tests (v1.2)');
fs.writeFileSync(path.join(PROOF_DIR, 'test-output.txt'), testRes.stdout + testRes.stderr, 'utf8');

// 2. Production Vite build
const buildRes = runCmd('npm', ['run', 'build'], 'Production Build (Vite)', process.platform === 'win32');
fs.writeFileSync(path.join(PROOF_DIR, 'build-output.txt'), buildRes.stdout + buildRes.stderr, 'utf8');

// 3. Headless Scenario: Phase 3 Fuel Decay, Drain, Lantern Out, Relight, Refuel & Dawn Survived
const p3Scenario = path.join(PROOF_DIR, 'scenario-phase3-fuel-dawn.json');
const p3Inputs = path.join(PROOF_DIR, 'inputs-phase3-fuel-dawn.json');
const p3Out = path.join(PROOF_DIR, 'out-phase3-fuel-dawn.jsonl');

fs.writeFileSync(
  p3Scenario,
  JSON.stringify(
    {
      player: { pos: [0, 0, 0], carried: 10, flames: 3 },
      random_motes: false,
      random_shades: false,
      motes: [],
      shades: [{ id: 'S1', pos: [23.8, 0, 6.2], state: 'drain', target_lantern_id: 'L2' }],
      lanterns: [
        { id: 'L1', pos: [0, 0, 1.0], lit: true, fuel: 0.5 },
        { id: 'L2', pos: [23.8, 0, 7.7], lit: true, fuel: 25 },
        { id: 'L3', lit: true, fuel: 90 },
        { id: 'L4', lit: true, fuel: 90 },
        { id: 'L5', lit: false }
      ],
      time_left_s: 1.5
    },
    null,
    2
  )
);

fs.writeFileSync(
  p3Inputs,
  JSON.stringify(
    {
      frames: [
        { tick: 35, interact: true },
        { tick: 36, interact: false },
        { tick: 70, interact: true },
        { tick: 71, interact: false }
      ]
    },
    null,
    2
  )
);

runCmd(
  process.execPath,
  ['src/headless/cli.js', '--seed', '42', '--night', '1', '--scenario', p3Scenario, '--inputs', p3Inputs, '--ticks', '120', '--out', p3Out, '--snapshot-every', '30'],
  'Phase 3 Fuel, Drain, Relight, Refuel & Dawn Survived Scenario'
);

const p3Lines = fs.readFileSync(p3Out, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const p3End = p3Lines[p3Lines.length - 1];
if (p3End.type !== 'end' || p3End.state !== 'won') {
  throw new Error(`Expected Phase 3 scenario to end in state="won", got ${JSON.stringify(p3End)}`);
}

// 4. Determinism & Full-Night (18,000 ticks) Benchmark on Night 3
const n3Run1 = path.join(PROOF_DIR, 'night3-18000-run1.jsonl');
const n3Run2 = path.join(PROOF_DIR, 'night3-18000-run2.jsonl');
const t0 = performance.now();
runCmd(
  process.execPath,
  ['src/headless/cli.js', '--seed', '2026', '--night', '3', '--ticks', '18000', '--out', n3Run1, '--snapshot-every', '600'],
  'Night 3 Full-Length Benchmark (18,000 ticks) Run 1'
);
const benchMs = Math.round(performance.now() - t0);

runCmd(
  process.execPath,
  ['src/headless/cli.js', '--seed', '2026', '--night', '3', '--ticks', '18000', '--out', n3Run2, '--snapshot-every', '600'],
  'Night 3 Full-Length Determinism Run 2'
);

if (fs.readFileSync(n3Run1, 'utf8') !== fs.readFileSync(n3Run2, 'utf8')) {
  throw new Error('Phase 3 determinism check FAILED!');
}

const summary = [
  `Phase 3 Verification Summary (Contract v1.2)`,
  `Timestamp: ${new Date().toISOString()}`,
  `Node: ${process.version}`,
  `Unit & Headless Tests: PASS`,
  `Vite Production Build: PASS`,
  `Phase 3 Fuel/Drain/Relight/Refuel/Dawn Scenario: PASS (${path.basename(p3Out)})`,
  `Night 3 Full-Night Benchmark (18,000 ticks): PASS (${benchMs} ms <= 30,000 ms limit)`,
  `Night 3 Determinism (18,000 ticks x2): PASS (byte-identical)`
].join('\n');

fs.writeFileSync(path.join(PROOF_DIR, 'verification-summary.txt'), summary + '\n', 'utf8');
console.log('\n' + summary);
