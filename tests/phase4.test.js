import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { GameSimulation } from '../src/sim/engine.js';
import {
  addLeaderboardEntry,
  formatIsoWithTimezone,
  sortAndTrimEntries,
  validatePlayerName
} from '../src/sim/leaderboard.js';

test('[P4] Benchmark simulation spawns 200 wandering shades, 100 motes, L1-L3 lit fuel 100, and disables decay/damage/end', () => {
  const sim = new GameSimulation({ seed: 42, night: 1, benchMode: true });
  assert.equal(sim.night, 1);
  assert.equal(sim.shades.length, 200);
  assert.equal(sim.motes.length, 100);
  assert.deepEqual(sim.player.pos, [0, 0, 0]);
  assert.ok(sim.shades.every((s) => s.state === 'wander'));

  const litIds = sim.lanterns.filter((l) => l.lit).map((l) => l.id);
  assert.deepEqual(litIds, ['L1', 'L2', 'L3']);
  for (const id of ['L1', 'L2', 'L3']) {
    const l = sim.lanterns.find((x) => x.id === id);
    assert.equal(l.fuelUnits, 6000);
  }

  const initialShadePositions = sim.shades.map((s) => [...s.pos]);
  for (let i = 0; i < 180; i++) {
    const ev = sim.step({ move: [1, 0], jump: true, interact: true, pulse: true, dash: true });
    assert.equal(ev.length, 0);
  }

  // Player stayed at origin, no fuel decayed, no motes picked up, no end state, shades moved
  assert.deepEqual(sim.player.pos, [0, 0, 0]);
  assert.equal(sim.state, 'playing');
  assert.equal(sim.shades.length, 200);
  assert.equal(sim.motes.length, 100);
  assert.equal(sim.lanterns[0].fuelUnits, 6000);
  const movedCount = sim.shades.filter(
    (s, idx) =>
      Math.hypot(s.pos[0] - initialShadePositions[idx][0], s.pos[2] - initialShadePositions[idx][2]) > 0.1
  ).length;
  assert.ok(movedCount > 150, `Expected wandering shades to move, moved=${movedCount}`);
});

test('[P4] Leaderboard name validation, sorting, tie-break by earlier achieved_at, and top-10 cap', () => {
  assert.equal(validatePlayerName('May_01').valid, true);
  assert.equal(validatePlayerName('Mây_Đảo').valid, true); // Vietnamese accented bonus
  assert.equal(validatePlayerName('ab').valid, false); // too short
  assert.equal(validatePlayerName('abcdefghijklm').valid, false); // 13 chars too long
  assert.equal(validatePlayerName('bad name!').valid, false); // space & symbol

  const iso = formatIsoWithTimezone(new Date());
  assert.match(iso, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);

  let entries = [];
  for (let i = 0; i < 12; i++) {
    entries = addLeaderboardEntry(entries, {
      name: `Player_${i}`,
      score: 100 + (i % 5) * 50,
      nights_won: i % 4,
      achieved_at: `2026-11-20T10:${String(i).padStart(2, '0')}:00+07:00`,
      seed: 100 + i
    });
  }
  assert.equal(entries.length, 10);

  // Tie-break check: earlier achieved_at ranks higher on equal score
  const tied = sortAndTrimEntries([
    { name: 'Late', score: 500, nights_won: 3, achieved_at: '2026-11-20T12:00:00+07:00', seed: 2 },
    { name: 'Early', score: 500, nights_won: 3, achieved_at: '2026-11-20T11:00:00+07:00', seed: 1 }
  ]);
  assert.equal(tied[0].name, 'Early');
  assert.equal(tied[1].name, 'Late');
});

test('[P4] Soak test CLI runs consecutively with 0 crashes and bounded RSS', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-soak-'));
  const outPath = path.join(tmpDir, 'soak.json');
  const res = spawnSync(process.execPath, ['scripts/soak.mjs', '--seed', '7', '--nights', '3', '--out', outPath], {
    encoding: 'utf8'
  });
  assert.equal(res.status, 0, res.stderr);
  const data = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  assert.equal(data.nights, 3);
  assert.equal(data.crashes, 0);
  assert.equal(data.results.length, 3);
  assert.ok(data.mem_start_mb > 0);
  assert.ok(data.mem_end_mb <= data.mem_start_mb * 1.2, `RSS grew too much: ${data.mem_start_mb} -> ${data.mem_end_mb}`);
});

test('[P4] run_cmd --export-leaderboard exports sorted entries JSON', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-lb-'));
  const lbPath = path.join(tmpDir, 'leaderboard.json');
  const exportPath = path.join(tmpDir, 'exported.json');

  fs.writeFileSync(
    lbPath,
    JSON.stringify({
      entries: [
        { name: 'Second', score: 300, nights_won: 2, achieved_at: '2026-11-20T10:05:00+07:00', seed: 10 },
        { name: 'First', score: 600, nights_won: 3, achieved_at: '2026-11-20T10:01:00+07:00', seed: 42 }
      ]
    })
  );

  const res = spawnSync(process.execPath, ['scripts/run.mjs', '--export-leaderboard', exportPath], {
    encoding: 'utf8',
    env: { ...process.env, DDL_LEADERBOARD_PATH: lbPath }
  });
  assert.equal(res.status, 0, res.stderr);
  const exported = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
  assert.ok(Array.isArray(exported.entries));
  assert.equal(exported.entries.length, 2);
  assert.equal(exported.entries[0].name, 'First');
  assert.equal(exported.entries[1].name, 'Second');
});
