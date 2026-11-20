import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const CLI_PATH = path.resolve('src/headless/cli.js');

function runHeadless(args) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    encoding: 'utf8'
  });
}

test('headless CLI Night 1 win scenario matches Contract v1.1 schema', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-n1-'));
  const scenarioPath = path.join(tmpDir, 'scenario.json');
  const inputsPath = path.join(tmpDir, 'inputs.json');
  const outPath = path.join(tmpDir, 'out.jsonl');

  fs.writeFileSync(
    scenarioPath,
    JSON.stringify({
      player: { pos: [0, 0, 0], carried: 9, flames: 3 },
      random_motes: false,
      random_shades: false,
      motes: [[0, 0, 4]],
      shades: [],
      lanterns: [
        { id: 'L1', pos: [0, 0, 6], deposited: 0, lit: false },
        { id: 'L2', lit: true },
        { id: 'L3', lit: true },
        { id: 'L4', lit: true },
        { id: 'L5', lit: true }
      ],
      time_left_s: 120
    })
  );

  fs.writeFileSync(
    inputsPath,
    JSON.stringify({
      frames: [
        { tick: 0, move: [0, 1], cam_yaw_deg: 0 },
        { tick: 60, move: [0, 0], interact: true },
        { tick: 61, interact: false }
      ]
    })
  );

  const res = runHeadless([
    '--seed', '42', '--night', '1',
    '--scenario', scenarioPath, '--inputs', inputsPath,
    '--ticks', '120', '--out', outPath, '--snapshot-every', '20'
  ]);
  assert.equal(res.status, 0, res.stderr);

  const lines = fs.readFileSync(outPath, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const snap0 = lines[0];
  assert.equal(snap0.type, 'snapshot');
  assert.equal(snap0.night, 1);
  assert.ok(snap0.wind && typeof snap0.wind.active === 'boolean');
  assert.ok(Array.isArray(snap0.player.vel));
  assert.ok(Array.isArray(snap0.motes));
  assert.ok(Array.isArray(snap0.drifters));
  assert.ok(Array.isArray(snap0.charms));

  const endLine = lines[lines.length - 1];
  assert.equal(endLine.type, 'end');
  assert.equal(endLine.state, 'won');
});

test('headless CLI Night 2 jump pad, charm, drifter, pause scenario', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-n2-'));
  const scenarioPath = path.join(tmpDir, 'scenario.json');
  const inputsPath = path.join(tmpDir, 'inputs.json');
  const outPath = path.join(tmpDir, 'out.jsonl');

  fs.writeFileSync(
    scenarioPath,
    JSON.stringify({
      player: { pos: [35, 0, 0], carried: 8, flames: 3 },
      random_motes: false,
      random_shades: false,
      random_drifters: false,
      motes: [],
      shades: [],
      drifters: [{ id: 'D1', pos: [35.5, 1.0, 0], state: 'chase' }]
    })
  );

  fs.writeFileSync(
    inputsPath,
    JSON.stringify({
      frames: [
        { tick: 0, dash: true },
        { tick: 1, dash: false, pulse: true },
        { tick: 2, pulse: false, pause: true },
        { tick: 3, pause: false },
        { tick: 15, pause: true },
        { tick: 16, pause: false }
      ]
    })
  );

  const res = runHeadless([
    '--seed', '7', '--night', '2',
    '--scenario', scenarioPath, '--inputs', inputsPath,
    '--ticks', '40', '--out', outPath, '--snapshot-every', '10'
  ]);
  assert.equal(res.status, 0, res.stderr);

  const lines = fs.readFileSync(outPath, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const names = lines.filter((l) => l.type === 'event').map((e) => e.name);
  assert.ok(names.includes('dash'));
  assert.ok(names.includes('charm_picked'));
  assert.ok(names.includes('drifter_steal'));
  assert.ok(names.includes('drifter_drop'));
  assert.ok(names.includes('paused'));
  assert.ok(names.includes('resumed'));
  assert.ok(lines.some((l) => l.type === 'snapshot' && l.state === 'paused'));
});

test('headless CLI Night 3 determinism & 21,600-tick performance <= 30s', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-n3-'));
  const out1 = path.join(tmpDir, 'n3-1.jsonl');
  const out2 = path.join(tmpDir, 'n3-2.jsonl');

  const t0 = performance.now();
  const r1 = runHeadless(['--seed', '999', '--night', '3', '--ticks', '21600', '--out', out1, '--snapshot-every', '600']);
  const elapsedMs = performance.now() - t0;
  assert.equal(r1.status, 0, r1.stderr);
  assert.ok(elapsedMs < 30000, `21,600 ticks took ${elapsedMs}ms (> 30,000ms limit)`);

  const r2 = runHeadless(['--seed', '999', '--night', '3', '--ticks', '21600', '--out', out2, '--snapshot-every', '600']);
  assert.equal(r2.status, 0, r2.stderr);
  assert.equal(fs.readFileSync(out1, 'utf8'), fs.readFileSync(out2, 'utf8'));
});

test('headless CLI returns exit code 2 on invalid inputs/scenario', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-err-'));
  const badTicks = path.join(tmpDir, 'bad-ticks.json');
  const badShade = path.join(tmpDir, 'bad-shade.json');
  const outPath = path.join(tmpDir, 'out.jsonl');

  fs.writeFileSync(badTicks, JSON.stringify({ frames: [{ tick: 5 }, { tick: 5 }] }));
  fs.writeFileSync(badShade, JSON.stringify({ shades: [{ pos: [0, 0, 0], state: 'invalid_state' }] }));

  const r1 = runHeadless(['--seed', '1', '--night', '1', '--inputs', badTicks, '--ticks', '30', '--out', outPath]);
  assert.equal(r1.status, 2);
  const r2 = runHeadless(['--seed', '1', '--night', '1', '--scenario', badShade, '--ticks', '30', '--out', outPath]);
  assert.equal(r2.status, 2);
});
