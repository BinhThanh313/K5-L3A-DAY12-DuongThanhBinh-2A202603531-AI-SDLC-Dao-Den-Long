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

test('[UPDATED FOR P3 TICKET-03: Contract v1.2 dawn_survived] headless CLI Night 1 fuel, refuel, drain, relight & dawn_survived win', () => {
  // Reason for update: Ticket-03 replaced early all_lit win with dawn_survived at time_left_s <= 0
  // and added fuel, ever_lit, relit_count, capacity, refuel, lantern_out, and fuel_drain.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-p3-'));
  const scenarioPath = path.join(tmpDir, 'scenario.json');
  const inputsPath = path.join(tmpDir, 'inputs.json');
  const outPath = path.join(tmpDir, 'out.jsonl');

  fs.writeFileSync(
    scenarioPath,
    JSON.stringify({
      player: { pos: [0, 0, 0], carried: 10, flames: 3 },
      random_motes: false,
      random_shades: false,
      motes: [],
      shades: [{ id: 'S1', pos: [23.8, 0, 6.2], state: 'drain', target_lantern_id: 'L2' }],
      lanterns: [
        { id: 'L1', pos: [0, 0, 1.0], lit: true, fuel: 0.5 }, // burns out at tick 30, then player relights it
        { id: 'L2', pos: [23.8, 0, 7.7], lit: true, fuel: 25 }, // drained by S1 -> emits fuel_drain at tick 60
        { id: 'L3', lit: true, fuel: 90 },
        { id: 'L4', lit: true, fuel: 90 },
        { id: 'L5', lit: false }
      ],
      time_left_s: 1.5 // 90 ticks until dawn
    })
  );

  fs.writeFileSync(
    inputsPath,
    JSON.stringify({
      frames: [
        { tick: 35, interact: true }, // Relight L1 (5 motes)
        { tick: 36, interact: false },
        { tick: 70, interact: true }, // Refuel L1 (1 mote)
        { tick: 71, interact: false }
      ]
    })
  );

  const res = runHeadless([
    '--seed', '42', '--night', '1',
    '--scenario', scenarioPath, '--inputs', inputsPath,
    '--ticks', '120', '--out', outPath, '--snapshot-every', '30'
  ]);
  assert.equal(res.status, 0, res.stderr);

  const lines = fs.readFileSync(outPath, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const snap0 = lines[0];
  assert.equal(snap0.type, 'snapshot');
  assert.equal(snap0.player.capacity, 10);
  assert.equal(typeof snap0.lanterns[0].fuel, 'number');
  assert.equal(typeof snap0.lanterns[0].ever_lit, 'boolean');
  assert.equal(typeof snap0.lanterns[0].relit_count, 'number');

  const events = lines.filter((l) => l.type === 'event');
  assert.ok(events.some((e) => e.name === 'lantern_out' && e.data.lantern_id === 'L1'));
  assert.ok(events.some((e) => e.name === 'lantern_lit' && e.data.lantern_id === 'L1' && e.data.relight === true));
  assert.ok(events.some((e) => e.name === 'fuel_drain' && e.data.lantern_id === 'L2' && e.data.shade_id === 'S1'));
  assert.ok(events.some((e) => e.name === 'refuel' && e.data.lantern_id === 'L1'));
  assert.ok(events.some((e) => e.name === 'game_over' && e.data.result === 'won' && e.data.reason === 'dawn_survived'));

  const endLine = lines[lines.length - 1];
  assert.equal(endLine.type, 'end');
  assert.equal(endLine.state, 'won');
});

test('[P2 regression] headless CLI Night 2 jump pad, charm, drifter, pause & fall scenario', () => {
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
});

test('headless CLI Night 3 determinism & full-night (18,000 ticks) performance <= 30s', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-n3-'));
  const out1 = path.join(tmpDir, 'n3-1.jsonl');
  const out2 = path.join(tmpDir, 'n3-2.jsonl');

  const t0 = performance.now();
  const r1 = runHeadless(['--seed', '999', '--night', '3', '--ticks', '18000', '--out', out1, '--snapshot-every', '600']);
  const elapsedMs = performance.now() - t0;
  assert.equal(r1.status, 0, r1.stderr);
  assert.ok(elapsedMs < 30000, `18,000 ticks took ${elapsedMs}ms (> 30,000ms limit)`);

  const r2 = runHeadless(['--seed', '999', '--night', '3', '--ticks', '18000', '--out', out2, '--snapshot-every', '600']);
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
