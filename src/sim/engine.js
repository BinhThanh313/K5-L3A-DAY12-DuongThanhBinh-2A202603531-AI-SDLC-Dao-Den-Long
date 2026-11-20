import { DT, GRAVITY, ISLAND_RADIUS, JUMP_VELOCITY, TUNING, createDefaultNight1Lanterns } from './config.js';
import { SeededPRNG } from './prng.js';

export function round3(v) {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
}

export function distXZ(a, b) {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

function clampToIsland(pos, radius = ISLAND_RADIUS) {
  const r = Math.hypot(pos[0], pos[2]);
  if (r > radius && r > 0) {
    const scale = radius / r;
    pos[0] *= scale;
    pos[2] *= scale;
  }
}

export class GameSimulation {
  constructor({ seed = 1, night = 1, scenario = null } = {}) {
    if (night !== 1) {
      throw new Error(`Unsupported night: ${night}. Phase 1 only supports night 1.`);
    }

    this.seed = seed;
    this.night = night;
    this.prng = new SeededPRNG(seed);
    this.tuning = TUNING;

    this.tick = 0;
    this.simTick = 0;
    this.state = 'playing';
    this.score = 0;

    this.initialTimeLeftS =
      scenario && typeof scenario.time_left_s === 'number'
        ? scenario.time_left_s
        : this.tuning.night1_duration_s;
    this.timeLeftS = this.initialTimeLeftS;

    this.randomMotes = scenario && typeof scenario.random_motes === 'boolean' ? scenario.random_motes : true;
    this.randomShades = scenario && typeof scenario.random_shades === 'boolean' ? scenario.random_shades : true;

    this.player = {
      pos: [0, 0, 0],
      vy: 0,
      flames: this.tuning.flames,
      carried: 0,
      invulnTimer: 0,
      pulseCooldown: 0,
      facingYaw: 0
    };

    if (scenario && scenario.player) {
      if (Array.isArray(scenario.player.pos)) {
        this.player.pos = [
          Number(scenario.player.pos[0]),
          Number(scenario.player.pos[1]),
          Number(scenario.player.pos[2])
        ];
      }
      if (typeof scenario.player.carried === 'number') {
        this.player.carried = scenario.player.carried;
      }
      if (typeof scenario.player.flames === 'number') {
        this.player.flames = scenario.player.flames;
      }
    }

    this.lanterns = createDefaultNight1Lanterns();
    if (scenario && Array.isArray(scenario.lanterns)) {
      for (const patch of scenario.lanterns) {
        const target = this.lanterns.find((l) => l.id === patch.id);
        if (target) {
          if (Array.isArray(patch.pos)) {
            target.pos = [Number(patch.pos[0]), Number(patch.pos[1]), Number(patch.pos[2])];
          }
          if (typeof patch.deposited === 'number') {
            target.deposited = patch.deposited;
          }
          if (typeof patch.lit === 'boolean') {
            target.lit = patch.lit;
          }
        }
      }
    }

    this.nextMoteSeq = 1;
    this.nextShadeSeq = 1;
    this.moteSpawnTimer = 0;
    this.shadeSpawnTimer = 0;

    this.motes = [];
    if (scenario && Array.isArray(scenario.motes)) {
      for (const item of scenario.motes) {
        if (Array.isArray(item)) {
          this.motes.push({
            id: this._allocMoteId(),
            pos: [Number(item[0]), 0, Number(item[2])]
          });
        } else if (item && Array.isArray(item.pos)) {
          this.motes.push({
            id: item.id || this._allocMoteId(),
            pos: [Number(item.pos[0]), 0, Number(item.pos[2])]
          });
        }
      }
    } else if (this.randomMotes) {
      for (let i = 0; i < 18; i++) {
        this._spawnRandomMote();
      }
    }

    this.shades = [];
    if (scenario && Array.isArray(scenario.shades)) {
      for (const item of scenario.shades) {
        const id = item.id || this._allocShadeId();
        this.shades.push({
          id,
          pos: [Number(item.pos[0]), Number(item.pos[1] ?? 0), Number(item.pos[2])],
          state: item.state || 'chase',
          stunTimer: 0
        });
      }
    } else if (this.randomShades) {
      for (let i = 0; i < 2; i++) {
        this._spawnRandomShade(false);
      }
    }

    this.prevButtons = {
      jump: false,
      interact: false,
      pulse: false
    };

    this.lastPulseTick = -999;
    this.lastHitTick = -999;
  }

  _allocMoteId() {
    while (true) {
      const id = `M${this.nextMoteSeq++}`;
      if (!this.motes.some((m) => m.id === id)) return id;
    }
  }

  _allocShadeId() {
    while (true) {
      const id = `S${this.nextShadeSeq++}`;
      if (!this.shades.some((s) => s.id === id)) return id;
    }
  }

  _spawnRandomMote() {
    for (let attempt = 0; attempt < 20; attempt++) {
      const angle = this.prng.range(0, Math.PI * 2);
      const r = Math.sqrt(this.prng.next()) * (ISLAND_RADIUS - 3.0);
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      if (Math.hypot(x - this.player.pos[0], z - this.player.pos[2]) < 3.5) continue;
      this.motes.push({
        id: this._allocMoteId(),
        pos: [round3(x), 0, round3(z)]
      });
      return;
    }
    this.motes.push({
      id: this._allocMoteId(),
      pos: [round3(this.prng.range(-15, 15)), 0, round3(this.prng.range(-15, 15))]
    });
  }

  _spawnRandomShade(emitEventsList = null) {
    for (let attempt = 0; attempt < 25; attempt++) {
      const angle = this.prng.range(0, Math.PI * 2);
      const r = this.prng.range(ISLAND_RADIUS - 10.0, ISLAND_RADIUS - 2.0);
      const pos = [Math.cos(angle) * r, 0, Math.sin(angle) * r];
      if (distXZ(pos, this.player.pos) < 10.0) continue;
      if (this._isInsideAnyLitSafeZone(pos)) continue;
      const id = this._allocShadeId();
      this.shades.push({
        id,
        pos: [round3(pos[0]), 0, round3(pos[2])],
        state: 'chase',
        stunTimer: 0
      });
      if (emitEventsList) {
        emitEventsList.push({
          type: 'event',
          tick: this.tick,
          name: 'shade_spawned',
          data: { id }
        });
      }
      return;
    }
  }

  _isInsideAnyLitSafeZone(pos) {
    for (const lantern of this.lanterns) {
      if (lantern.lit && distXZ(pos, lantern.pos) < this.tuning.safe_radius) {
        return true;
      }
    }
    return false;
  }

  _enforceLitSafeZones(shade) {
    const safeR = this.tuning.safe_radius;
    for (let iter = 0; iter < 3; iter++) {
      let pushed = false;
      for (const lantern of this.lanterns) {
        if (!lantern.lit) continue;
        const dx = shade.pos[0] - lantern.pos[0];
        const dz = shade.pos[2] - lantern.pos[2];
        const d = Math.hypot(dx, dz);
        if (d < safeR) {
          const nx = d > 1e-6 ? dx / d : 1;
          const nz = d > 1e-6 ? dz / d : 0;
          shade.pos[0] = lantern.pos[0] + nx * safeR;
          shade.pos[2] = lantern.pos[2] + nz * safeR;
          pushed = true;
        }
      }
      if (!pushed) break;
    }
    clampToIsland(shade.pos);
  }

  step(rawInput = {}) {
    if (this.state !== 'playing') {
      return [];
    }

    const events = [];
    this.tick += 1;
    this.simTick += 1;

    const move = Array.isArray(rawInput.move) ? rawInput.move : [0, 0];
    const camYawDeg = typeof rawInput.cam_yaw_deg === 'number' ? rawInput.cam_yaw_deg : 0;
    const jump = Boolean(rawInput.jump);
    const interact = Boolean(rawInput.interact);
    const pulse = Boolean(rawInput.pulse);

    const jumpTriggered = !this.prevButtons.jump && jump;
    const interactTriggered = !this.prevButtons.interact && interact;
    const pulseTriggered = !this.prevButtons.pulse && pulse;

    this.prevButtons.jump = jump;
    this.prevButtons.interact = interact;
    this.prevButtons.pulse = pulse;

    // 1. Timers
    this.timeLeftS = Math.max(0, this.initialTimeLeftS - this.simTick * DT);
    if (this.player.invulnTimer > 0) {
      this.player.invulnTimer = Math.max(0, this.player.invulnTimer - DT);
    }
    if (this.player.pulseCooldown > 0) {
      this.player.pulseCooldown = Math.max(0, this.player.pulseCooldown - DT);
    }

    // 2. Player movement & jump
    let mx = Number(move[0]) || 0;
    let mz = Number(move[1]) || 0;
    const theta = (camYawDeg * Math.PI) / 180;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    let wx = mx * cosT + mz * sinT;
    let wz = -mx * sinT + mz * cosT;
    const mag = Math.hypot(wx, wz);
    if (mag > 1) {
      wx /= mag;
      wz /= mag;
    }

    if (mag > 1e-4) {
      this.player.facingYaw = Math.atan2(wx, wz);
    }

    this.player.pos[0] += wx * this.tuning.player_speed * DT;
    this.player.pos[2] += wz * this.tuning.player_speed * DT;
    clampToIsland(this.player.pos);

    if (jumpTriggered && this.player.pos[1] <= 0) {
      this.player.vy = JUMP_VELOCITY;
    }
    if (this.player.pos[1] > 0 || this.player.vy !== 0) {
      this.player.pos[1] += this.player.vy * DT;
      this.player.vy += GRAVITY * DT;
      if (this.player.pos[1] <= 0) {
        this.player.pos[1] = 0;
        this.player.vy = 0;
      }
    }

    // 3. Mote pickup
    if (this.player.carried < this.tuning.carry_capacity) {
      const remaining = [];
      for (const mote of this.motes) {
        if (
          this.player.carried < this.tuning.carry_capacity &&
          distXZ(this.player.pos, mote.pos) <= this.tuning.pickup_radius
        ) {
          this.player.carried += 1;
          this.score += this.tuning.score.per_mote;
          events.push({
            type: 'event',
            tick: this.tick,
            name: 'mote_picked',
            data: { carried: this.player.carried }
          });
        } else {
          remaining.push(mote);
        }
      }
      this.motes = remaining;
    }

    // 4. Interact (Deposit into nearest unlit lantern)
    if (interactTriggered && this.player.carried > 0) {
      let bestLantern = null;
      let bestDist = Infinity;
      for (const lantern of this.lanterns) {
        if (lantern.lit) continue;
        const d = distXZ(this.player.pos, lantern.pos);
        if (d <= this.tuning.interact_radius && d < bestDist) {
          bestDist = d;
          bestLantern = lantern;
        }
      }
      if (bestLantern) {
        const needed = Math.max(0, this.tuning.lantern_cost - bestLantern.deposited);
        const amount = Math.min(this.player.carried, needed);
        if (amount > 0) {
          this.player.carried -= amount;
          bestLantern.deposited += amount;
          events.push({
            type: 'event',
            tick: this.tick,
            name: 'deposit',
            data: {
              lantern_id: bestLantern.id,
              amount,
              deposited: bestLantern.deposited
            }
          });

          if (bestLantern.deposited >= this.tuning.lantern_cost) {
            bestLantern.lit = true;
            this.score += this.tuning.score.per_lantern;
            events.push({
              type: 'event',
              tick: this.tick,
              name: 'lantern_lit',
              data: { lantern_id: bestLantern.id }
            });

            // Push shades out of newly created safe zone
            for (const shade of this.shades) {
              this._enforceLitSafeZones(shade);
            }

            // Check win condition
            if (this.lanterns.every((l) => l.lit)) {
              this.score +=
                Math.floor(this.timeLeftS) * this.tuning.score.per_second_left +
                this.player.flames * this.tuning.score.per_flame_left;
              this.state = 'won';
              events.push({
                type: 'event',
                tick: this.tick,
                name: 'game_over',
                data: { result: 'won', reason: 'all_lit' }
              });
              return events;
            }
          }
        }
      }
    }

    // 5. Pulse
    if (
      pulseTriggered &&
      this.player.pulseCooldown <= 0 &&
      this.player.carried >= this.tuning.pulse_cost
    ) {
      this.player.carried -= this.tuning.pulse_cost;
      this.player.pulseCooldown = this.tuning.pulse_cooldown_s;
      this.lastPulseTick = this.tick;

      const stunnedIds = [];
      for (const shade of this.shades) {
        const dx = shade.pos[0] - this.player.pos[0];
        const dz = shade.pos[2] - this.player.pos[2];
        const d = Math.hypot(dx, dz);
        if (d <= this.tuning.pulse_radius) {
          shade.state = 'stunned';
          shade.stunTimer = this.tuning.pulse_stun_s;
          const nx = d > 1e-6 ? dx / d : 1;
          const nz = d > 1e-6 ? dz / d : 0;
          shade.pos[0] += nx * this.tuning.pulse_push_m;
          shade.pos[2] += nz * this.tuning.pulse_push_m;
          this._enforceLitSafeZones(shade);
          stunnedIds.push(shade.id);
          this.score += this.tuning.score.per_stun;
        }
      }

      events.push({
        type: 'event',
        tick: this.tick,
        name: 'pulse',
        data: { stunned_ids: stunnedIds }
      });
    }

    // 6. Shades update & collision
    for (const shade of this.shades) {
      if (shade.state === 'stunned') {
        shade.stunTimer -= DT;
        if (shade.stunTimer <= 0) {
          shade.stunTimer = 0;
          shade.state = 'chase';
        }
      }

      if (shade.state === 'chase') {
        const dx = this.player.pos[0] - shade.pos[0];
        const dz = this.player.pos[2] - shade.pos[2];
        const d = Math.hypot(dx, dz);
        if (d > 1e-6) {
          const stepDist = Math.min(d, this.tuning.shade_speed * DT);
          shade.pos[0] += (dx / d) * stepDist;
          shade.pos[2] += (dz / d) * stepDist;
        }
        this._enforceLitSafeZones(shade);

        if (
          this.player.invulnTimer <= 0 &&
          distXZ(this.player.pos, shade.pos) <= this.tuning.shade_hit_radius
        ) {
          this.player.flames = Math.max(0, this.player.flames - 1);
          const dropped = Math.floor(this.player.carried * this.tuning.hit_drop_ratio);
          this.player.carried -= dropped;
          this.player.invulnTimer = this.tuning.invuln_s;
          this.lastHitTick = this.tick;

          events.push({
            type: 'event',
            tick: this.tick,
            name: 'player_hit',
            data: {
              by: 'shade',
              flames: this.player.flames,
              dropped
            }
          });

          if (this.player.flames <= 0) {
            this.state = 'lost';
            events.push({
              type: 'event',
              tick: this.tick,
              name: 'game_over',
              data: { result: 'lost', reason: 'no_flames' }
            });
            return events;
          }
        }
      }
    }

    // 7. Random spawns (only when enabled)
    if (this.randomMotes) {
      this.moteSpawnTimer += DT;
      if (this.moteSpawnTimer >= 6.0) {
        this.moteSpawnTimer -= 6.0;
        if (this.motes.length < 18) {
          this._spawnRandomMote();
        }
      }
    }

    if (this.randomShades) {
      this.shadeSpawnTimer += DT;
      if (this.shadeSpawnTimer >= 35.0) {
        this.shadeSpawnTimer -= 35.0;
        if (this.shades.length < 5) {
          this._spawnRandomShade(events);
        }
      }
    }

    // 8. Dawn timeout check
    if (this.timeLeftS <= 0 && this.state === 'playing') {
      this.state = 'lost';
      events.push({
        type: 'event',
        tick: this.tick,
        name: 'game_over',
        data: { result: 'lost', reason: 'dawn' }
      });
    }

    return events;
  }

  getSnapshot() {
    return {
      type: 'snapshot',
      tick: this.tick,
      sim_tick: this.simTick,
      state: this.state,
      time_left_s: round3(this.timeLeftS),
      score: this.score,
      player: {
        pos: this.player.pos.map(round3),
        flames: this.player.flames,
        carried: this.player.carried
      },
      lanterns: this.lanterns.map((l) => ({
        id: l.id,
        pos: l.pos.map(round3),
        lit: l.lit,
        deposited: l.deposited
      })),
      shades: this.shades.map((s) => ({
        id: s.id,
        pos: s.pos.map(round3),
        state: s.state
      })),
      motes: this.motes.map((m) => ({
        id: m.id,
        pos: m.pos.map(round3)
      })),
      motes_active: this.motes.length
    };
  }

  getEndSummary() {
    return {
      type: 'end',
      ticks: this.tick,
      state: this.state,
      score: this.score
    };
  }
}
