import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GameSimulation, distXZ } from '../src/sim/engine.js';
import { CHARM_SPEED, TUNING } from '../src/sim/config.js';

test('game.contract.json v1.3 tuning & commands match src/sim/config.js', () => {
  const contract = JSON.parse(fs.readFileSync(new URL('../game.contract.json', import.meta.url), 'utf8'));
  assert.equal(contract.contract_version, '1.3');
  assert.equal(typeof contract.run_cmd, 'string');
  assert.equal(typeof contract.bench_cmd, 'string');
  assert.equal(typeof contract.soak_cmd, 'string');
  assert.deepEqual(contract.tuning, TUNING);
});

test('[P1/P2 regression] movement, cam_yaw_deg rotation, and normalization', () => {
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

test('[P1/P2 regression] mote pickup respects pickup_radius 1.0 and dynamic player.capacity', () => {
  const sim = new GameSimulation({
    seed: 1,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 0], carried: 9 },
      random_motes: false,
      random_shades: false,
      motes: [
        [0, 0, 1.0],
        [0, 0, 0.5],
        [0, 0, 3.0]
      ],
      shades: []
    }
  });

  const events = sim.step({});
  assert.equal(sim.player.carried, 10);
  assert.equal(sim.motes.length, 2);
  assert.equal(sim.score, 0);
  assert.ok(events.some((e) => e.name === 'mote_picked' && e.data.carried === 10));
});

test('[UPDATED FOR P3 TICKET-03: replaced all_lit early win with dawn_survived & v1.2 scoring] lighting all lanterns continues until dawn_survived', () => {
  // Reason for update: Ticket-03 Section 3 & 5 removed early win (all_lit), changed deposit score to +5/mote,
  // added relight:false to lantern_lit, and evaluates dawn_survived when time_left_s reaches 0 with >= ceil(0.6*N) lit.
  const sim = new GameSimulation({
    seed: 1,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 0], carried: 10, flames: 3 },
      random_motes: false,
      random_shades: false,
      motes: [],
      shades: [],
      time_left_s: 1 / 60, // 1 tick until dawn
      lanterns: [
        { id: 'L1', pos: [0, 0, 1.5], deposited: 0, lit: false },
        { id: 'L2', lit: true, fuel: 80 },
        { id: 'L3', lit: true, fuel: 80 },
        { id: 'L4', lit: false },
        { id: 'L5', lit: false }
      ]
    }
  });

  const events = sim.step({ interact: true });
  assert.equal(sim.state, 'won');
  assert.equal(sim.player.capacity, 12); // 10 + 2 * 1 successful light
  const litEv = events.find((e) => e.name === 'lantern_lit');
  assert.deepEqual(litEv.data, { lantern_id: 'L1', relight: false });
  const overEv = events.find((e) => e.name === 'game_over');
  assert.deepEqual(overEv.data, { result: 'won', reason: 'dawn_survived' });

  // Score: 10*5 (50 deposit) + 100 (first light)
  // + Dawn bonus: L1 (50 + floor(100)=150), L2 (50 + floor(79.983)=129), L3 (50 + floor(79.983)=129)
  // + Flames: 3 * 50 (150) => total = 50 + 100 + 150 + 129 + 129 + 150 = 708
  assert.equal(sim.score, 708);
});

test('[P3] fuel decay, lantern_out, relight cost 5 (+40 score), and refuel formula', () => {
  const sim = new GameSimulation({
    seed: 1,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 0], carried: 8, flames: 3 },
      random_motes: false,
      random_shades: false,
      motes: [],
      shades: [],
      lanterns: [
        { id: 'L1', pos: [0, 0, 1.0], lit: true, fuel: 0.01 } // 1 tick of fuel left
      ]
    }
  });

  // Tick 1: L1 decays to 0 and turns off immediately after Step 2
  const ev1 = sim.step({});
  assert.ok(ev1.some((e) => e.name === 'lantern_out' && e.data.lantern_id === 'L1'));
  assert.equal(sim.lanterns[0].lit, false);
  assert.equal(sim.lanterns[0].everLit, true);

  // Tick 2: Interact with L1 -> relight costs only 5 motes!
  const ev2 = sim.step({ interact: true });
  assert.ok(ev2.some((e) => e.name === 'deposit' && e.data.amount === 5));
  assert.ok(ev2.some((e) => e.name === 'lantern_lit' && e.data.lantern_id === 'L1' && e.data.relight === true));
  assert.equal(sim.player.carried, 3);
  assert.equal(sim.lanterns[0].fuelUnits, 6000); // 100.0 fuel
  assert.equal(sim.lanterns[0].relitCount, 1);
  assert.equal(sim.score, 5 * 5 + 40); // 25 + 40 = 65

  // Tick 3: Interact with full lantern (fuel=100) -> ignored (no event, no motes used)
  sim.step({ interact: false });
  const evFull = sim.step({ interact: true });
  assert.equal(evFull.filter((e) => e.name === 'refuel' || e.name === 'deposit').length, 0);

  // Let fuel decay for 900 ticks (15s -> fuel = 85.0), then refuel -> ceil((100-85)/10) = 2 motes used -> fuel = 100.0
  sim.step({ interact: false });
  for (let i = 0; i < 899; i++) sim.step({});
  const evRefuel = sim.step({ interact: true });
  const refuelEv = evRefuel.find((e) => e.name === 'refuel');
  assert.ok(refuelEv);
  assert.deepEqual(refuelEv.data, { lantern_id: 'L1', amount: 2, fuel: 100 });
  assert.equal(sim.player.carried, 1);
});

test('[P3] low-fuel lantern (<30) loses safe zone, shade drains at <=2m, fuel_drain every 60 ticks, and pulse awards +15', () => {
  const sim = new GameSimulation({
    seed: 1,
    night: 1,
    scenario: {
      player: { pos: [0, 0, -25], carried: 5, flames: 3 },
      random_motes: false,
      random_shades: false,
      motes: [],
      lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 25 }],
      shades: [{ id: 'S1', pos: [3, 0, 0], state: 'wander' }]
    }
  });

  // Advance until S1 walks into <=2m of weak L1 and drains for 60 ticks
  let drainEvent = null;
  for (let i = 0; i < 100; i++) {
    const evs = sim.step({});
    const found = evs.find((e) => e.name === 'fuel_drain');
    if (found) {
      drainEvent = found;
      break;
    }
  }
  assert.ok(drainEvent, 'Expected fuel_drain event after 60 ticks of draining');
  assert.equal(drainEvent.data.lantern_id, 'L1');
  assert.equal(drainEvent.data.shade_id, 'S1');
  assert.equal(sim.shades[0].state, 'drain');

  // Move player within pulse_radius (5m) and pulse on draining shade -> awards +15 score
  sim.player.pos = [0, 0, -1.5];
  const scoreBefore = sim.score;
  const evPulse = sim.step({ pulse: true });
  assert.ok(evPulse.some((e) => e.name === 'pulse' && e.data.stunned_ids.includes('S1')));
  assert.equal(sim.score - scoreBefore, 15);
  assert.equal(sim.shades[0].state, 'stunned');
});

test('[P2 regression] dash, fall & respawn, drifter steal/drop, wind charm, and pause', () => {
  const sim = new GameSimulation({
    seed: 1,
    night: 2,
    scenario: {
      player: { pos: [35, 0, 0], carried: 8, flames: 3 },
      random_motes: false,
      random_shades: false,
      random_drifters: false,
      motes: [],
      shades: [],
      drifters: [{ id: 'D1', pos: [35.5, 1.0, 0], state: 'chase' }]
    }
  });

  const ev1 = sim.step({ dash: true });
  assert.ok(ev1.some((e) => e.name === 'dash'));
  assert.ok(ev1.some((e) => e.name === 'charm_picked'));
  assert.ok(ev1.some((e) => e.name === 'drifter_steal' && e.data.amount === 3));

  const ev2 = sim.step({ dash: false, pulse: true });
  assert.ok(ev2.some((e) => e.name === 'drifter_drop' && e.data.amount === 3));

  const ev3 = sim.step({ pulse: false, pause: true });
  assert.ok(ev3.some((e) => e.name === 'paused'));
  assert.equal(sim.state, 'paused');
});

test('[P4 fix] falling below island rim cannot snap back up through cliff when moving inward', () => {
  const sim = new GameSimulation({
    seed: 1,
    night: 1,
    scenario: {
      player: { pos: [41.0, -2.0, 0], flames: 3 },
      random_motes: false,
      random_shades: false,
      motes: [],
      shades: []
    }
  });

  // Try moving straight back toward island center (-X) while already below the rim
  let fell = false;
  for (let i = 0; i < 90; i++) {
    const evs = sim.step({ move: [-1, 0], cam_yaw_deg: 0 });
    assert.ok(sim.player.pos[1] < 0, `Player snapped back to Y=${sim.player.pos[1]} at tick ${i}`);
    if (evs.some((e) => e.name === 'player_hit' && e.data.by === 'fall')) {
      fell = true;
      break;
    }
  }
  assert.equal(fell, true, 'Expected player below rim to keep falling and trigger fall hit');
});
