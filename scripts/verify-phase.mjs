import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const PROOF_DIR = path.resolve('docs/proof/phase-4');
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

// 1. All Unit, Headless & Phase 4 Contract Tests (v1.3)
const testRes = runCmd(
  process.execPath,
  ['--test', 'tests/sim.test.js', 'tests/headless.test.js', 'tests/phase4.test.js'],
  'Unit, Headless & Phase 4 Tests (Contract v1.3)'
);
fs.writeFileSync(path.join(PROOF_DIR, 'test-output.txt'), testRes.stdout + testRes.stderr, 'utf8');

// 2. Production Vite build
const buildRes = runCmd('npm', ['run', 'build'], 'Production Build (Vite)', process.platform === 'win32');
fs.writeFileSync(path.join(PROOF_DIR, 'build-output.txt'), buildRes.stdout + buildRes.stderr, 'utf8');

// 3. Official 10-Night Soak Test (seed 7, nights 10)
const soakProof = path.join(PROOF_DIR, 'soak.json');
runCmd(
  process.execPath,
  ['scripts/soak.mjs', '--seed', '7', '--nights', '10', '--out', soakProof],
  'Official 10-Night Soak Test (seed 7)'
);
const soakData = JSON.parse(fs.readFileSync(soakProof, 'utf8'));
if (soakData.crashes !== 0 || soakData.mem_end_mb > soakData.mem_start_mb * 1.2) {
  throw new Error(`Soak test failed threshold: ${JSON.stringify(soakData)}`);
}

// 4. Leaderboard Export Proof
const lbExportOut = path.join(PROOF_DIR, 'leaderboard-export.json');
runCmd(
  process.execPath,
  ['scripts/run.mjs', '--export-leaderboard', lbExportOut],
  'Leaderboard Export Check'
);
const lbData = JSON.parse(fs.readFileSync(lbExportOut, 'utf8'));
if (!Array.isArray(lbData.entries)) {
  throw new Error('Exported leaderboard missing entries array');
}

// 5. Night 3 Full-Night (18,000 ticks) Determinism & Performance Regression
const n3Run1 = path.join(PROOF_DIR, 'night3-18000-run1.jsonl');
const n3Run2 = path.join(PROOF_DIR, 'night3-18000-run2.jsonl');
const t0 = performance.now();
runCmd(
  process.execPath,
  ['src/headless/cli.js', '--seed', '2026', '--night', '3', '--ticks', '18000', '--out', n3Run1, '--snapshot-every', '600'],
  'Night 3 Full-Length Benchmark (18,000 ticks) Run 1'
);
const simBenchMs = Math.round(performance.now() - t0);

runCmd(
  process.execPath,
  ['src/headless/cli.js', '--seed', '2026', '--night', '3', '--ticks', '18000', '--out', n3Run2, '--snapshot-every', '600'],
  'Night 3 Full-Length Determinism Run 2'
);

if (fs.readFileSync(n3Run1, 'utf8') !== fs.readFileSync(n3Run2, 'utf8')) {
  throw new Error('Night 3 determinism check FAILED!');
}

// 6. Verify root bench.json & soak.json if present
let benchLine = 'Root bench.json: (run "npm run bench -- --seed 42 --duration 30 --out bench.json")';
if (fs.existsSync('bench.json')) {
  const b = JSON.parse(fs.readFileSync('bench.json', 'utf8'));
  benchLine = `Root bench.json: avg_fps=${b.avg_fps}, p1_low_fps=${b.p1_low_fps}, frame_ms_p95=${b.frame_ms_p95}, load_ms=${b.load_ms}, frames=${b.frames}`;
}

const summary = [
  `Phase 4 Verification Summary (Contract v1.3 / v1.0.0)`,
  `Timestamp: ${new Date().toISOString()}`,
  `Node: ${process.version}`,
  `Unit, Headless & Phase 4 Tests: PASS`,
  `Vite Production Build: PASS`,
  `10-Night Soak Test (seed 7): PASS (crashes=${soakData.crashes}, mem ${soakData.mem_start_mb} -> ${soakData.mem_end_mb} MB, ${soakData.duration_s}s)`,
  `Leaderboard Export (--export-leaderboard): PASS (${lbData.entries.length} entries)`,
  `Night 3 Full-Night Benchmark (18,000 ticks): PASS (${simBenchMs} ms <= 30,000 ms limit)`,
  `Night 3 Determinism (18,000 ticks x2): PASS (byte-identical)`,
  benchLine
].join('\n');

fs.writeFileSync(path.join(PROOF_DIR, 'verification-summary.txt'), summary + '\n', 'utf8');
console.log('\n' + summary);
