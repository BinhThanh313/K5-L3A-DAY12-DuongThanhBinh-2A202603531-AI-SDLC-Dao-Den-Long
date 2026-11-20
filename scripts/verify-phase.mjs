import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const PROOF_DIR = path.resolve('docs/proof/phase-1');
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

// 1. Run unit + headless test suite
const testRes = runCmd(process.execPath, ['--test', 'tests/sim.test.js', 'tests/headless.test.js'], 'Unit & Headless Tests');
fs.writeFileSync(path.join(PROOF_DIR, 'test-output.txt'), testRes.stdout + testRes.stderr, 'utf8');

// 2. Run production build
const buildRes = runCmd('npm', ['run', 'build'], 'Production Build (Vite)', process.platform === 'win32');
fs.writeFileSync(path.join(PROOF_DIR, 'build-output.txt'), buildRes.stdout + buildRes.stderr, 'utf8');

// 3. Run canonical headless scenarios and determinism check, save real JSONL evidence
const winScenario = path.join(PROOF_DIR, 'scenario-win.json');
const winInputs = path.join(PROOF_DIR, 'inputs-win.json');
const winOut = path.join(PROOF_DIR, 'out-win.jsonl');

fs.writeFileSync(
  winScenario,
  JSON.stringify(
    {
      player: { pos: [0, 0, 0], carried: 5, flames: 3 },
      random_motes: false,
      random_shades: false,
      motes: [[0, 0, 5]],
      shades: [{ id: 'S1', pos: [4, 0, 0] }],
      lanterns: [
        { id: 'L1', pos: [0, 0, 10], deposited: 0, lit: false },
        { id: 'L2', lit: true },
        { id: 'L3', lit: true },
        { id: 'L4', lit: true },
        { id: 'L5', lit: true }
      ],
      time_left_s: 120
    },
    null,
    2
  )
);

fs.writeFileSync(
  winInputs,
  JSON.stringify(
    {
      frames: [
        { tick: 0, move: [0, 1], cam_yaw_deg: 0, pulse: true },
        { tick: 1, pulse: false },
        { tick: 80, move: [0, 0], interact: true },
        { tick: 81, interact: false }
      ]
    },
    null,
    2
  )
);

runCmd(
  process.execPath,
  [
    'src/headless/cli.js',
    '--seed', '101',
    '--night', '1',
    '--scenario', winScenario,
    '--inputs', winInputs,
    '--ticks', '150',
    '--out', winOut,
    '--snapshot-every', '20'
  ],
  'Headless Win + Pulse Scenario'
);

const winLines = fs.readFileSync(winOut, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const winEnd = winLines[winLines.length - 1];
if (winEnd.type !== 'end' || winEnd.state !== 'won') {
  throw new Error(`Expected win scenario to end with state="won", got: ${JSON.stringify(winEnd)}`);
}

// Determinism check (2 full runs with random spawns)
const det1 = path.join(PROOF_DIR, 'determinism-run1.jsonl');
const det2 = path.join(PROOF_DIR, 'determinism-run2.jsonl');
for (const out of [det1, det2]) {
  runCmd(
    process.execPath,
    ['src/headless/cli.js', '--seed', '2026', '--night', '1', '--ticks', '600', '--out', out, '--snapshot-every', '60'],
    `Determinism Run (${path.basename(out)})`
  );
}
const identical = fs.readFileSync(det1, 'utf8') === fs.readFileSync(det2, 'utf8');
if (!identical) {
  throw new Error('Determinism check FAILED: outputs differ!');
}

const summary = [
  `Phase 1 Verification Summary`,
  `Timestamp: ${new Date().toISOString()}`,
  `Node: ${process.version}`,
  `Unit & Headless Tests: PASS`,
  `Vite Production Build: PASS`,
  `Headless Win + Pulse Scenario: PASS (${path.basename(winOut)})`,
  `Determinism Check (seed 2026, 600 ticks x2): PASS (byte-identical)`
].join('\n');

fs.writeFileSync(path.join(PROOF_DIR, 'verification-summary.txt'), summary + '\n', 'utf8');
console.log('\n' + summary);
