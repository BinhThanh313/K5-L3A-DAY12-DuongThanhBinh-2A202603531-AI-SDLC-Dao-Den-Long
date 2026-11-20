import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GameSimulation, distXZ } from '../src/sim/engine.js';
import { TUNING } from '../src/sim/config.js';

test('game.contract.json tuning matches src/sim/config.js', () => {
  const contract = JSON.parse(fs.readFileSync(new URL('../game.contract.json', import.meta.url), 'utf8'));
  assert.deepEqual(contract.tuning, TUNING);
});

test('movement, cam_yaw_deg rotation, and vector normalization', () => {
  const sim = new GameSimulation({
    seed: 1,
    night: 1,
    scenario: { random_motes: false, random_shades: false, motes: [], shades: [] }
  });

  // Move +Z with yaw=0 for 60 ticks (1s) -> z should be ~player_speed (7.0)
  for (let i = 0; i < 60; i++) {
    sim.step({ move: [0, 1], cam_yaw_deg: 0 });
  }
  assert.ok(Math.abs(sim.player.pos[0] - 0) < 1e-6);
  assert.ok(Math.abs(sim.player.pos[2] - TUNING.player_speed) < 1e-6);

  // Move diagonal [1, 1] -> normalized to length 1, speed still player_speed
  const startPos = [...sim.player.pos];
  for (let i = 0; i < 60; i++) {
    sim.step({ move: [1, 1], cam_yaw_deg: 0 });
  }
  const movedDist = distXZ(startPos, sim.player.pos);
  assert.ok(Math.abs(movedDist - TUNING.player_speed) < 1e-5);

  // Rotation by 90 deg: move [0, 1] -> x' = sin(90) = 1, z' = cos(90) = 0
  const beforeRot = [...sim.player.pos];
  sim.step({ move: [0, 1], cam_yaw_deg: 90 });
  assert.ok(sim.player.pos[0] > beforeRot[0]);
  assert.ok(Math.abs(sim.player.pos[2] - beforeRot[2]) < 1e-6);
});

test('mote pickup respects pickup_radius and carry_capacity', () => {
  const sim = new GameSimulation({
    seed: 1,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 0], carried: 4 },
      random_motes: false,
      random_shades: false,
      motes: [
        [0, 0, 2.0], // exact boundary -> picked
        [0, 0, 1.0], // would exceed carry_capacity 5 -> stays
        [0, 0, 5.0]  // out of radius -> stays
      ],
      shades: []
    }
  });

  const events = sim.step({});
  assert.equal(sim.player.carried, 5);
  assert.equal(sim.motes.length, 2);
  assert.equal(sim.score, TUNING.score.per_mote);
  assert.equal(events.length, 1);
  assert.equal(events[0].name, 'mote_picked');
  assert.deepEqual(events[0].data, { carried: 5 });
});

test('deposit lights final lantern and triggers win with bonuses', () => {
  const sim = new GameSimulation({
    seed: 1,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 0], carried: 5, flames: 3 },
      random_motes: false,
      random_shades: false,
      motes: [],
      shades: [],
      time_left_s: 100,
      lanterns: [
        { id: 'L1', pos: [0, 0, 2.0], deposited: 0, lit: false },
        { id: 'L2', lit: true },
        { id: 'L3', lit: true },
        { id: 'L4', lit: true },
        { id: 'L5', lit: true }
      ]
    }
  });

  // Scenario setup emits no score
  assert.equal(sim.score, 0);

  const events = sim.step({ interact: true });
  assert.equal(sim.state, 'won');
  assert.deepEqual(
    events.map((e) => e.name),
    ['deposit', 'lantern_lit', 'game_over']
  );
  assert.deepEqual(events[2].data, { result: 'won', reason: 'all_lit' });

  // Expected score: 200 (lantern) + floor(99.983)*5 (495) + 3*100 (300) = 995
  assert.equal(sim.score, 200 + 99 * 5 + 300);
});

test('pulse stuns and pushes shades, costs motes, and respects cooldown', () => {
  const sim = new GameSimulation({
    seed: 1,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 0], carried: 3 },
      random_motes: false,
      random_shades: false,
      motes: [],
      shades: [
        { id: 'S1', pos: [4, 0, 0] },
        { id: 'S2', pos: [15, 0, 0] }
      ]
    }
  });

  const events = sim.step({ pulse: true });
  assert.equal(sim.player.carried, 2);
  assert.equal(sim.score, TUNING.score.per_stun);
  const pulseEv = events.find((e) => e.name === 'pulse');
  assert.deepEqual(pulseEv.data, { stunned_ids: ['S1'] });
  assert.equal(sim.shades[0].state, 'stunned');
  assert.ok(sim.shades[0].pos[0] >= 8.9); // pushed by 5.0m from 4.0 to 9.0
  assert.equal(sim.shades[1].state, 'chase');

  // Edge release + immediate re-press during cooldown should NOT trigger pulse
  sim.step({ pulse: false });
  const events2 = sim.step({ pulse: true });
  assert.equal(events2.filter((e) => e.name === 'pulse').length, 0);
  assert.equal(sim.player.carried, 2);
});

test('lit lantern safe_radius keeps shades out', () => {
  const sim = new GameSimulation({
    seed: 1,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 0], carried: 0, flames: 3 },
      random_motes: false,
      random_shades: false,
      motes: [],
      lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }],
      shades: [{ id: 'S1', pos: [8, 0, 0] }]
    }
  });

  for (let i = 0; i < 120; i++) {
    sim.step({});
  }
  const distToLantern = distXZ(sim.shades[0].pos, [0, 0, 0]);
  assert.ok(distToLantern >= TUNING.safe_radius - 1e-6);
  assert.equal(sim.player.flames, 3);
});

test('shade hit damages player, drops motes, grants invuln, and triggers no_flames loss', () => {
  const sim = new GameSimulation({
    seed: 1,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 0], carried: 4, flames: 2 },
      random_motes: false,
      random_shades: false,
      motes: [],
      shades: [{ id: 'S1', pos: [0.5, 0, 0] }]
    }
  });

  const ev1 = sim.step({});
  const hit1 = ev1.find((e) => e.name === 'player_hit');
  assert.ok(hit1);
  assert.deepEqual(hit1.data, { by: 'shade', flames: 1, dropped: 2 });
  assert.equal(sim.player.carried, 2);

  // During invuln_s (90 ticks), no second hit
  for (let i = 0; i < 60; i++) {
    const ev = sim.step({});
    assert.equal(ev.filter((e) => e.name === 'player_hit').length, 0);
  }

  // Advance past invuln_s -> second hit -> lost
  let lost = false;
  for (let i = 0; i < 60; i++) {
    const ev = sim.step({});
    if (ev.some((e) => e.name === 'game_over' && e.data.reason === 'no_flames')) {
      lost = true;
      break;
    }
  }
  assert.equal(lost, true);
  assert.equal(sim.state, 'lost');
});

test('dawn timeout triggers lost with reason dawn', () => {
  const sim = new GameSimulation({
    seed: 1,
    night: 1,
    scenario: {
      random_motes: false,
      random_shades: false,
      motes: [],
      shades: [],
      time_left_s: 0.5
    }
  });

  let dawnEvent = null;
  for (let i = 0; i < 60 && sim.state === 'playing'; i++) {
    const evs = sim.step({});
    dawnEvent = evs.find((e) => e.name === 'game_over') || dawnEvent;
  }
  assert.equal(sim.state, 'lost');
  assert.deepEqual(dawnEvent.data, { result: 'lost', reason: 'dawn' });
});
