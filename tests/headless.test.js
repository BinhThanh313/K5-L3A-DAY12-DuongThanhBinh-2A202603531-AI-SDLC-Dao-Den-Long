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

test('headless CLI runs full win scenario and matches Test Contract v1.0 JSONL schema', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-test-'));
  const scenarioPath = path.join(tmpDir, 'scenario.json');
  const inputsPath = path.join(tmpDir, 'inputs.json');
  const outPath = path.join(tmpDir, 'out.jsonl');

  fs.writeFileSync(
    scenarioPath,
    JSON.stringify({
      player: { pos: [0, 0, 0], carried: 4, flames: 3 },
      random_motes: false,
      random_shades: false,
      motes: [[0, 0, 5]],
      shades: [],
      lanterns: [
        { id: 'L1', pos: [0, 0, 8], deposited: 0, lit: false },
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
    '--seed', '42',
    '--night', '1',
    '--scenario', scenarioPath,
    '--inputs', inputsPath,
    '--ticks', '200',
    '--out', outPath,
    '--snapshot-every', '20'
  ]);

  assert.equal(res.status, 0, res.stderr);
  const lines = fs.readFileSync(outPath, 'utf8').trim().split('\n').map((l) => JSON.parse(l));

  assert.equal(lines[0].type, 'snapshot');
  assert.equal(lines[0].tick, 0);
  assert.equal(lines[0].sim_tick, 0);
  assert.equal(lines[0].motes_active, 1);

  const events = lines.filter((l) => l.type === 'event');
  assert.ok(events.some((e) => e.name === 'mote_picked'));
  assert.ok(events.some((e) => e.name === 'deposit' && e.data.lantern_id === 'L1'));
  assert.ok(events.some((e) => e.name === 'lantern_lit' && e.data.lantern_id === 'L1'));
  assert.ok(events.some((e) => e.name === 'game_over' && e.data.result === 'won' && e.data.reason === 'all_lit'));

  const endLine = lines[lines.length - 1];
  assert.equal(endLine.type, 'end');
  assert.equal(endLine.state, 'won');
  assert.ok(endLine.ticks < 200);
});

test('headless CLI determinism: two runs with same seed & inputs produce byte-identical JSONL', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-det-'));
  const inputsPath = path.join(tmpDir, 'inputs.json');
  const out1 = path.join(tmpDir, 'run1.jsonl');
  const out2 = path.join(tmpDir, 'run2.jsonl');

  fs.writeFileSync(
    inputsPath,
    JSON.stringify({
      frames: [
        { tick: 0, move: [0.5, 0.8], cam_yaw_deg: 25 },
        { tick: 90, move: [-0.7, 0.4], jump: true },
        { tick: 91, jump: false },
        { tick: 180, move: [0, -1], pulse: true },
        { tick: 181, pulse: false }
      ]
    })
  );

  const argsBase = ['--seed', '1337', '--night', '1', '--inputs', inputsPath, '--ticks', '600', '--snapshot-every', '30'];
  const r1 = runHeadless([...argsBase, '--out', out1]);
  const r2 = runHeadless([...argsBase, '--out', out2]);

  assert.equal(r1.status, 0, r1.stderr);
  assert.equal(r2.status, 0, r2.stderr);

  const c1 = fs.readFileSync(out1, 'utf8');
  const c2 = fs.readFileSync(out2, 'utf8');
  assert.equal(c1, c2);
});

test('headless CLI returns exit code 2 on invalid inputs (non-increasing ticks, malformed JSON)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-err-'));
  const badTicks = path.join(tmpDir, 'bad-ticks.json');
  const badJson = path.join(tmpDir, 'bad.json');
  const outPath = path.join(tmpDir, 'out.jsonl');

  fs.writeFileSync(
    badTicks,
    JSON.stringify({
      frames: [
        { tick: 10, move: [0, 1] },
        { tick: 10, move: [0, 0] }
      ]
    })
  );
  fs.writeFileSync(badJson, '{ not valid json');

  const r1 = runHeadless(['--seed', '1', '--night', '1', '--inputs', badTicks, '--ticks', '60', '--out', outPath]);
  assert.equal(r1.status, 2);
  assert.ok(r1.stderr.length > 0);

  const r2 = runHeadless(['--seed', '1', '--night', '1', '--scenario', badJson, '--ticks', '60', '--out', outPath]);
  assert.equal(r2.status, 2);
  assert.ok(r2.stderr.length > 0);
});
