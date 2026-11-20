import fs from 'node:fs';
import path from 'node:path';
import { GameSimulation } from '../sim/engine.js';

function fail(code, message) {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const args = {
    seed: null,
    night: null,
    scenario: null,
    inputs: null,
    ticks: null,
    out: null,
    snapshotEvery: 10
  };

  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const next = argv[i + 1];
    switch (flag) {
      case '--seed':
        if (next === undefined) fail(1, 'Missing value for --seed');
        args.seed = Number(next);
        i++;
        break;
      case '--night':
        if (next === undefined) fail(1, 'Missing value for --night');
        args.night = Number(next);
        i++;
        break;
      case '--scenario':
        if (next === undefined) fail(1, 'Missing value for --scenario');
        args.scenario = next;
        i++;
        break;
      case '--inputs':
        if (next === undefined) fail(1, 'Missing value for --inputs');
        args.inputs = next;
        i++;
        break;
      case '--ticks':
        if (next === undefined) fail(1, 'Missing value for --ticks');
        args.ticks = Number(next);
        i++;
        break;
      case '--out':
        if (next === undefined) fail(1, 'Missing value for --out');
        args.out = next;
        i++;
        break;
      case '--snapshot-every':
        if (next === undefined) fail(1, 'Missing value for --snapshot-every');
        args.snapshotEvery = Number(next);
        i++;
        break;
      default:
        fail(1, `Unknown argument: ${flag}`);
    }
  }

  if (!Number.isInteger(args.seed)) fail(1, 'Required integer --seed');
  if (!Number.isInteger(args.night) || args.night !== 1) fail(1, 'Required --night 1');
  if (!Number.isInteger(args.ticks) || args.ticks < 0) fail(1, 'Required non-negative integer --ticks');
  if (!args.out) fail(1, 'Required --out <file.jsonl>');
  if (!Number.isInteger(args.snapshotEvery) || args.snapshotEvery <= 0) {
    fail(1, '--snapshot-every must be a positive integer');
  }

  return args;
}

function isVec3(v) {
  return (
    Array.isArray(v) &&
    v.length === 3 &&
    v.every((n) => typeof n === 'number' && Number.isFinite(n))
  );
}

function loadJsonFile(filePath, label) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    fail(1, `Cannot read ${label} file "${filePath}": ${err.message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    fail(2, `Malformed JSON in ${label} file "${filePath}": ${err.message}`);
  }
}

function validateScenario(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    fail(2, 'Scenario root must be a JSON object');
  }

  if (data.player !== undefined) {
    if (!data.player || typeof data.player !== 'object' || Array.isArray(data.player)) {
      fail(2, 'scenario.player must be an object');
    }
    if (data.player.pos !== undefined && !isVec3(data.player.pos)) {
      fail(2, 'scenario.player.pos must be [x, y, z]');
    }
    if (
      data.player.carried !== undefined &&
      (!Number.isInteger(data.player.carried) || data.player.carried < 0)
    ) {
      fail(2, 'scenario.player.carried must be a non-negative integer');
    }
    if (
      data.player.flames !== undefined &&
      (!Number.isInteger(data.player.flames) || data.player.flames < 0)
    ) {
      fail(2, 'scenario.player.flames must be a non-negative integer');
    }
  }

  if (data.random_motes !== undefined && typeof data.random_motes !== 'boolean') {
    fail(2, 'scenario.random_motes must be boolean');
  }
  if (data.random_shades !== undefined && typeof data.random_shades !== 'boolean') {
    fail(2, 'scenario.random_shades must be boolean');
  }
  if (
    data.time_left_s !== undefined &&
    (typeof data.time_left_s !== 'number' || !Number.isFinite(data.time_left_s) || data.time_left_s < 0)
  ) {
    fail(2, 'scenario.time_left_s must be a non-negative number');
  }

  if (data.motes !== undefined) {
    if (!Array.isArray(data.motes)) fail(2, 'scenario.motes must be an array');
    for (const m of data.motes) {
      if (isVec3(m)) continue;
      if (m && typeof m === 'object' && isVec3(m.pos)) continue;
      fail(2, 'Each entry in scenario.motes must be [x, y, z] or { pos: [x, y, z] }');
    }
  }

  if (data.shades !== undefined) {
    if (!Array.isArray(data.shades)) fail(2, 'scenario.shades must be an array');
    for (const s of data.shades) {
      if (!s || typeof s !== 'object' || !isVec3(s.pos)) {
        fail(2, 'Each entry in scenario.shades must be an object with pos: [x, y, z]');
      }
      if (s.id !== undefined && typeof s.id !== 'string') {
        fail(2, 'scenario.shades[].id must be a string');
      }
    }
  }

  if (data.lanterns !== undefined) {
    if (!Array.isArray(data.lanterns)) fail(2, 'scenario.lanterns must be an array');
    for (const l of data.lanterns) {
      if (!l || typeof l !== 'object' || typeof l.id !== 'string') {
        fail(2, 'Each entry in scenario.lanterns must have a string id');
      }
      if (l.pos !== undefined && !isVec3(l.pos)) {
        fail(2, `scenario.lanterns[${l.id}].pos must be [x, y, z]`);
      }
      if (l.deposited !== undefined && (!Number.isInteger(l.deposited) || l.deposited < 0)) {
        fail(2, `scenario.lanterns[${l.id}].deposited must be a non-negative integer`);
      }
      if (l.lit !== undefined && typeof l.lit !== 'boolean') {
        fail(2, `scenario.lanterns[${l.id}].lit must be boolean`);
      }
    }
  }

  return data;
}

function validateInputs(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    fail(2, 'Inputs root must be a JSON object');
  }
  if (!Array.isArray(data.frames)) {
    fail(2, 'Inputs file must contain a "frames" array');
  }

  let prevTick = -1;
  for (let i = 0; i < data.frames.length; i++) {
    const f = data.frames[i];
    if (!f || typeof f !== 'object' || Array.isArray(f)) {
      fail(2, `inputs.frames[${i}] must be an object`);
    }
    if (!Number.isInteger(f.tick) || f.tick < 0) {
      fail(2, `inputs.frames[${i}].tick must be a non-negative integer`);
    }
    if (f.tick <= prevTick) {
      fail(2, `inputs.frames ticks must be strictly increasing (got ${f.tick} after ${prevTick})`);
    }
    prevTick = f.tick;

    if (f.move !== undefined) {
      if (
        !Array.isArray(f.move) ||
        f.move.length !== 2 ||
        !f.move.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= -1 && n <= 1)
      ) {
        fail(2, `inputs.frames[${i}].move must be [x, z] with values in [-1, 1]`);
      }
    }
    if (f.cam_yaw_deg !== undefined && (typeof f.cam_yaw_deg !== 'number' || !Number.isFinite(f.cam_yaw_deg))) {
      fail(2, `inputs.frames[${i}].cam_yaw_deg must be a finite number`);
    }
    for (const btn of ['jump', 'interact', 'pulse', 'dash']) {
      if (f[btn] !== undefined && typeof f[btn] !== 'boolean') {
        fail(2, `inputs.frames[${i}].${btn} must be boolean`);
      }
    }
  }

  return data.frames;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const scenario = args.scenario ? validateScenario(loadJsonFile(args.scenario, 'scenario')) : null;
  const frames = args.inputs ? validateInputs(loadJsonFile(args.inputs, 'inputs')) : [];

  const sim = new GameSimulation({
    seed: args.seed,
    night: args.night,
    scenario
  });

  const lines = [];
  lines.push(JSON.stringify(sim.getSnapshot()));

  const currentInput = {
    move: [0, 0],
    cam_yaw_deg: 0,
    jump: false,
    interact: false,
    pulse: false
  };

  let frameIdx = 0;

  for (let k = 0; k < args.ticks && sim.state === 'playing'; k++) {
    while (frameIdx < frames.length && frames[frameIdx].tick === k) {
      const f = frames[frameIdx++];
      if (f.move !== undefined) currentInput.move = [f.move[0], f.move[1]];
      if (f.cam_yaw_deg !== undefined) currentInput.cam_yaw_deg = f.cam_yaw_deg;
      if (f.jump !== undefined) currentInput.jump = f.jump;
      if (f.interact !== undefined) currentInput.interact = f.interact;
      if (f.pulse !== undefined) currentInput.pulse = f.pulse;
    }

    const events = sim.step(currentInput);
    for (const ev of events) {
      lines.push(JSON.stringify(ev));
    }

    if (sim.tick % args.snapshotEvery === 0) {
      lines.push(JSON.stringify(sim.getSnapshot()));
    }
  }

  lines.push(JSON.stringify(sim.getEndSummary()));

  const outDir = path.dirname(path.resolve(args.out));
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(args.out, lines.join('\n') + '\n', 'utf8');
}

main();
