import fs from 'node:fs';
import path from 'node:path';
import { GameSimulation } from '../src/sim/engine.js';
import { SeededPRNG } from '../src/sim/prng.js';

function parseArgs(argv) {
  const args = { seed: 7, nights: 10, out: 'soak.json' };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const next = argv[i + 1];
    switch (flag) {
      case '--seed':
        if (next === undefined) throw new Error('Missing value for --seed');
        args.seed = Number(next);
        i++;
        break;
      case '--nights':
        if (next === undefined) throw new Error('Missing value for --nights');
        args.nights = Number(next);
        i++;
        break;
      case '--out':
        if (next === undefined) throw new Error('Missing value for --out');
        args.out = next;
        i++;
        break;
      default:
        throw new Error(`Unknown argument: ${flag}`);
    }
  }
  if (!Number.isInteger(args.seed)) throw new Error('--seed must be an integer');
  if (!Number.isInteger(args.nights) || args.nights <= 0) throw new Error('--nights must be a positive integer');
  if (!args.out) throw new Error('--out is required');
  return args;
}

function round1(v) {
  return Math.round(v * 10) / 10;
}

function getRssMb() {
  return process.memoryUsage().rss / (1024 * 1024);
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  // Brief V8 JIT warmup across all 3 nights (~15ms) so mem_start_mb reflects steady-state engine memory
  for (const wn of [1, 2, 3]) {
    let warmSim = new GameSimulation({ seed: 900 + wn, night: wn });
    for (let w = 0; w < 600 && warmSim.state === 'playing'; w++) {
      warmSim.step({
        move: [Math.cos(w * 0.1), Math.sin(w * 0.1)],
        jump: w % 20 === 0,
        dash: w % 30 === 0,
        pulse: w % 50 === 0,
        interact: w % 10 === 0
      });
    }
    warmSim = null;
  }

  const t0 = performance.now();

  let crashes = 0;
  const results = [];
  let memStartMb = 0;

  for (let i = 0; i < args.nights; i++) {
    const night = (i % 3) + 1;
    const nightSeed = args.seed + i;
    let sim = null;
    try {
      sim = new GameSimulation({ seed: nightSeed, night });
      if (i === 0) {
        memStartMb = getRssMb();
      }

      const inPrng = new SeededPRNG(((nightSeed + 1) * 2654435761) >>> 0);
      const maxTicks = Math.round(sim.map.durationS * 60) + 10;
      let move = [0, 0];

      for (let t = 0; t < maxTicks && sim.state !== 'won' && sim.state !== 'lost'; t++) {
        if (t % 30 === 0) {
          const angle = inPrng.range(0, Math.PI * 2);
          move = [Math.cos(angle), Math.sin(angle)];
        }
        sim.step({
          move,
          cam_yaw_deg: 0,
          jump: inPrng.next() < 0.05,
          dash: inPrng.next() < 0.03,
          pulse: inPrng.next() < 0.02,
          interact: inPrng.next() < 0.10,
          pause: false
        });
      }

      results.push(sim.state === 'won' ? 'won' : 'lost');
    } catch (err) {
      crashes += 1;
      results.push('crash');
      process.stderr.write(`Soak crash on night index ${i} (Night ${night}, seed ${nightSeed}): ${err.stack || err.message}\n`);
    } finally {
      sim = null;
    }
  }

  if (typeof globalThis.gc === 'function') {
    globalThis.gc();
  }
  const memEndMb = getRssMb();
  const durationS = (performance.now() - t0) / 1000;

  const output = {
    nights: args.nights,
    crashes,
    results,
    mem_start_mb: round1(memStartMb),
    mem_end_mb: round1(memEndMb),
    duration_s: round1(durationS)
  };

  const outPath = path.resolve(args.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(output));
}

try {
  main();
} catch (err) {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
}
