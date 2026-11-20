import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GameSimulation, distXZ } from '../src/sim/engine.js';
import { CHARM_SPEED, TUNING } from '../src/sim/config.js';

test('game.contract.json v1.1 tuning matches src/sim/config.js', () => {
  const contract = JSON.parse(fs.readFileSync(new URL('../game.contract.json', import.meta.url), 'utf8'));
  assert.equal(contract.contract_version, '1.1');
  assert.deepEqual(contract.tuning, TUNING);
});

test('[P1 regression - updated to v1.1 speed 6.0] movement, cam_yaw_deg rotation, and normalization', () => {
  const sim = new GameSimulation({
    seed: 1,
    night: 1,
    scenario: { random_motes: false, random_shades: false, motes: [], shades: [] }
  });

  for (let i = 0; i < 60; i++) {
    sim.step({ move: [0, 1], cam_yaw_deg: 0 });
  }
  assert.ok(Math.abs(sim.player.pos[0] - 0) < 1e-6);
  assert.ok(Math.abs(sim.player.pos[2] - TUNING.player_speed) < 1e-6);

  const startPos = [...sim.player.pos];
  for (let i = 0; i < 60; i++) {
    sim.step({ move: [1, 1], cam_yaw_deg: 0 });
  }
  assert.ok(Math.abs(distXZ(startPos, sim.player.pos) - TUNING.player_speed) < 1e-5);
});

test('[P1 regression - updated to v1.1 pickup_radius 1.0, cap 10, deposit scoring] mote pickup', () => {
  const sim = new GameSimulation({
    seed: 1,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 0], carried: 9 },
      random_motes: false,
      random_shades: false,
      motes: [
        [0, 0, 1.0], // exact boundary -> picked
        [0, 0, 0.5], // exceeds carry_capacity 10 -> stays
        [0, 0, 3.0]  // out of radius -> stays
      ],
      shades: []
    }
  });

  const events = sim.step({});
  assert.equal(sim.player.carried, 10);
  assert.equal(sim.motes.length, 2);
  // In Contract v1.1, +10 score is awarded on deposit (not pickup)
  assert.equal(sim.score, 0);
  assert.ok(events.some((e) => e.name === 'mote_picked' && e.data.carried === 10));
});

test('[P1 regression - updated to v1.1 scoring] deposit lights final lantern and wins with bonuses', () => {
  const sim = new GameSimulation({
    seed: 1,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 0], carried: 10, flames: 3 },
      random_motes: false,
      random_shades: false,
      motes: [],
      shades: [],
      time_left_s: 100,
      lanterns: [
        { id: 'L1', pos: [0, 0, 1.5], deposited: 0, lit: false },
        { id: 'L2', lit: true },
        { id: 'L3', lit: true },
        { id: 'L4', lit: true },
        { id: 'L5', lit: true }
      ]
    }
  });

  const events = sim.step({ interact: true });
  assert.equal(sim.state, 'won');
  assert.ok(events.some((e) => e.name === 'deposit' && e.data.amount === 10));
  assert.ok(events.some((e) => e.name === 'lantern_lit' && e.data.lantern_id === 'L1'));
  assert.ok(events.some((e) => e.name === 'game_over' && e.data.result === 'won' && e.data.reason === 'all_lit'));

  // 10*10 (deposit) + 100 (lantern) + floor(99.983)*2 (198) + 3*50 (150) = 548
  assert.equal(sim.score, 100 + 100 + 198 + 150);
});

test('[P1 regression - updated to v1.1 pulse 3 cost, 5m 3D radius, 15-tick push] pulse stuns and pushes', () => {
  const sim = new GameSimulation({
    seed: 1,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 0], carried: 5 },
      random_motes: false,
      random_shades: false,
      motes: [],
      shades: [
        { id: 'S1', pos: [4, 0, 0], state: 'chase' },
        { id: 'S2', pos: [15, 0, 0], state: 'wander' }
      ]
    }
  });

  const events = sim.step({ pulse: true });
  assert.equal(sim.player.carried, 2);
  assert.equal(sim.score, 5);
  const pulseEv = events.find((e) => e.name === 'pulse');
  assert.deepEqual(pulseEv.data, { stunned_ids: ['S1'] });
  assert.equal(sim.shades[0].state, 'stunned');

  // Run 15 ticks so horizontal push of 4m completes
  for (let i = 0; i < 15; i++) sim.step({ pulse: false });
  assert.ok(sim.shades[0].pos[0] >= 7.9 && sim.shades[0].pos[0] <= 8.1);
});

test('[P2] dash moves at 14 m/s for 12 ticks, preserves air altitude, and has 90-tick cooldown', () => {
  const sim = new GameSimulation({
    seed: 1,
    night: 1,
    scenario: { random_motes: false, random_shades: false, motes: [], shades: [] }
  });

  // Jump first, then dash in air
  sim.step({ jump: true });
  for (let i = 0; i < 5; i++) sim.step({ jump: false });
  const yBeforeDash = sim.player.pos[1];
  assert.ok(yBeforeDash > 0.3);

  const evs = sim.step({ move: [0, 1], dash: true });
  assert.ok(evs.some((e) => e.name === 'dash'));
  const zStart = sim.player.pos[2];

  for (let i = 0; i < 11; i++) sim.step({ move: [0, 1], dash: false });
  // Maintained altitude during dash
  assert.ok(Math.abs(sim.player.pos[1] - yBeforeDash) < 1e-4);
  // Moved ~14 * (12/60) = 2.8m total
  assert.ok(sim.player.pos[2] - zStart > 2.3);
  assert.ok(sim.player.dashCdTicks > 70);
});

test('[P2] fall off island ignores invuln, loses all carried motes, respawns after 60 ticks', () => {
  const sim = new GameSimulation({
    seed: 1,
    night: 1,
    scenario: {
      player: { pos: [41, -9.8, 0], carried: 7, flames: 3, invuln_ticks: 90 },
      random_motes: false,
      random_shades: false,
      motes: [],
      shades: []
    }
  });

  let hitEv = null;
  for (let i = 0; i < 15 && !hitEv; i++) {
    const evs = sim.step({});
    hitEv = evs.find((e) => e.name === 'player_hit');
  }
  assert.ok(hitEv);
  assert.deepEqual(hitEv.data, { by: 'fall', flames: 2, dropped: 0, lost: 7 });
  assert.equal(sim.player.carried, 0);

  // Wait 60 ticks -> respawns at (0,0,0) with invuln
  for (let i = 0; i < 60; i++) sim.step({});
  assert.deepEqual(sim.player.pos, [0, 0, 0]);
  assert.ok(sim.player.invulnTicks > 0);
});

test('[P2] Drifter steals motes and drops them when pulsed while fleeing', () => {
  const sim = new GameSimulation({
    seed: 1,
    night: 2,
    scenario: {
      player: { pos: [0, 0, 0], carried: 8 },
      random_motes: false,
      random_shades: false,
      random_drifters: false,
      motes: [],
      shades: [],
      drifters: [{ id: 'D1', pos: [0.5, 1.0, 0], state: 'chase' }]
    }
  });

  const ev1 = sim.step({});
  const steal = ev1.find((e) => e.name === 'drifter_steal');
  assert.ok(steal);
  assert.deepEqual(steal.data, { drifter_id: 'D1', amount: 3, carried: 5 });
  assert.equal(sim.drifters[0].state, 'flee');

  // Pulse immediately while fleeing within 5m -> drops all 3 motes
  const ev2 = sim.step({ pulse: true });
  const drop = ev2.find((e) => e.name === 'drifter_drop');
  assert.ok(drop);
  assert.deepEqual(drop.data, { drifter_id: 'D1', amount: 3 });
  assert.equal(sim.motes.filter((m) => m.kind === 'dropped').length, 3);
});

test('[P2] Wind Charm boosts speed to 7.2 m/s and removes dash cooldown', () => {
  const sim = new GameSimulation({
    seed: 1,
    night: 2,
    scenario: {
      player: { pos: [35, 0, 0], carried: 0 },
      random_motes: false,
      random_shades: false,
      random_drifters: false,
      motes: [],
      shades: []
    }
  });

  const ev1 = sim.step({});
  assert.ok(ev1.some((e) => e.name === 'charm_picked' && e.data.charm_id === 'C1' && e.data.charm_ticks === 600));
  assert.equal(sim.charms[0].available, false);

  // Move 1 tick -> speed should be CHARM_SPEED (7.2)
  sim.step({ move: [1, 0] });
  assert.ok(Math.abs(sim.player.vel[0] - CHARM_SPEED) < 1e-6);

  // Dash -> cooldown stays 0 during charm
  const evDash = sim.step({ move: [1, 0], dash: true });
  assert.ok(evDash.some((e) => e.name === 'dash'));
  assert.equal(sim.player.dashCdTicks, 0);
});

test('[P2] Pause freezes sim_tick and timers while advancing tick', () => {
  const sim = new GameSimulation({
    seed: 1,
    night: 1,
    scenario: { random_motes: false, random_shades: false, motes: [], shades: [] }
  });

  sim.step({});
  assert.equal(sim.tick, 1);
  assert.equal(sim.simTick, 1);

  const evPause = sim.step({ pause: true });
  assert.ok(evPause.some((e) => e.name === 'paused'));
  assert.equal(sim.state, 'paused');
  assert.equal(sim.tick, 2);
  assert.equal(sim.simTick, 1);

  for (let i = 0; i < 10; i++) sim.step({ pause: false });
  assert.equal(sim.tick, 12);
  assert.equal(sim.simTick, 1);

  const evResume = sim.step({ pause: true });
  assert.ok(evResume.some((e) => e.name === 'resumed'));
  assert.equal(sim.state, 'playing');
  assert.equal(sim.tick, 13);
  assert.equal(sim.simTick, 2);
});
