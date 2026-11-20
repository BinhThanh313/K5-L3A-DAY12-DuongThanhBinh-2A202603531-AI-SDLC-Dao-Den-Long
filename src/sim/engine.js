import {
  CHARM_DURATION_TICKS,
  CHARM_RESPAWN_TICKS,
  CHARM_SPEED,
  DRIFTER_CHASE_SPEED,
  DRIFTER_DETECT_RADIUS,
  DRIFTER_DROP_FLEE_TICKS,
  DRIFTER_FLEE_TICKS,
  DRIFTER_IDLE_SPEED,
  DRIFTER_MAX_STEAL,
  DRIFTER_MIN_CARRIED,
  DRIFTER_STEAL_RADIUS,
  DROPPED_MOTE_TTL_TICKS,
  DT,
  FALL_RESPAWN_TICKS,
  FALL_THRESHOLD_Y,
  GRAVITY,
  JUMP_VELOCITY,
  PULSE_PUSH_TICKS,
  SAFE_EJECT_TICKS,
  SHADE_DETECT_RADIUS,
  SHADE_LEASH_RADIUS,
  SHADE_RECOIL_DIST,
  SHADE_RECOIL_TICKS,
  TUNING,
  WIND_DURATION_TICKS,
  WIND_INTERVAL_TICKS,
  WIND_SPEED,
  WIND_WARN_TICKS
} from './config.js';
import {
  getMapConfig,
  getSurfaceHeight,
  isPointOnWalkableIsland,
  resolveHorizontalCollision
} from './maps.js';
import { SeededPRNG } from './prng.js';

export function round3(v) {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
}

export function distXZ(a, b) {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

export function dist3D(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export class GameSimulation {
  constructor({ seed = 1, night = 1, scenario = null } = {}) {
    this.map = getMapConfig(night);
    this.seed = seed;
    this.night = night;
    this.prng = new SeededPRNG(seed);
    this.tuning = TUNING;

    this.tick = 0;
    this.simTick = 0;
    this.state = 'playing';
    this.score = 0;
    this.nightStartEmitted = false;

    this.initialTimeLeftS =
      scenario && typeof scenario.time_left_s === 'number'
        ? scenario.time_left_s
        : this.map.durationS;
    this.timeLeftS = this.initialTimeLeftS;

    this.randomMotes = scenario && typeof scenario.random_motes === 'boolean' ? scenario.random_motes : true;
    this.randomShades = scenario && typeof scenario.random_shades === 'boolean' ? scenario.random_shades : true;
    this.randomDrifters =
      scenario && typeof scenario.random_drifters === 'boolean'
        ? scenario.random_drifters
        : this.map.hasDrifters;
    this.windEnabled =
      scenario && typeof scenario.wind_enabled === 'boolean'
        ? scenario.wind_enabled
        : this.map.hasWind;

    this.wind = {
      active: false,
      warning: false,
      dirDeg: 0,
      timerTicks: 0
    };

    const sp = this.map.spawnPos;
    this.player = {
      pos: [sp[0], sp[1], sp[2]],
      vel: [0, 0, 0],
      grounded: true,
      flames: this.tuning.flames,
      carried: 0,
      invulnTicks: 0,
      dashTicks: 0,
      dashDir: [0, 1],
      dashCdTicks: 0,
      pulseCdTicks: 0,
      charmTicks: 0,
      launchLocked: false,
      fallRespawnTicks: 0,
      facingYaw: 0 // +Z
    };

    if (scenario && scenario.player) {
      const p = scenario.player;
      if (Array.isArray(p.pos)) {
        this.player.pos = [Number(p.pos[0]), Number(p.pos[1]), Number(p.pos[2])];
      }
      if (typeof p.carried === 'number') this.player.carried = p.carried;
      if (typeof p.flames === 'number') this.player.flames = p.flames;
      if (typeof p.invuln_ticks === 'number') this.player.invulnTicks = p.invuln_ticks;
      if (typeof p.dash_cd_ticks === 'number') this.player.dashCdTicks = p.dash_cd_ticks;
      if (typeof p.pulse_cd_ticks === 'number') this.player.pulseCdTicks = p.pulse_cd_ticks;
      if (typeof p.charm_ticks === 'number') this.player.charmTicks = p.charm_ticks;
      const surf = getSurfaceHeight(this.map, this.player.pos[0], this.player.pos[2], this.player.pos[1]);
      this.player.grounded = surf !== null && Math.abs(this.player.pos[1] - surf) < 0.05;
    }

    this.lanterns = this.map.lanterns.map((l) => ({
      id: l.id,
      pos: [...l.pos],
      lit: l.lit,
      deposited: l.deposited
    }));
    if (scenario && Array.isArray(scenario.lanterns)) {
      for (const patch of scenario.lanterns) {
        const target = this.lanterns.find((l) => l.id === patch.id);
        if (target) {
          if (Array.isArray(patch.pos)) {
            target.pos = [Number(patch.pos[0]), Number(patch.pos[1]), Number(patch.pos[2])];
          }
          if (typeof patch.deposited === 'number') target.deposited = patch.deposited;
          if (typeof patch.lit === 'boolean') target.lit = patch.lit;
        }
      }
    }

    this.nextMoteSeq = 1;
    this.nextShadeSeq = 1;
    this.nextDrifterSeq = 1;

    this.motes = [];
    if (scenario && Array.isArray(scenario.motes)) {
      for (const item of scenario.motes) {
        if (Array.isArray(item)) {
          this.motes.push({
            id: this._allocMoteId(),
            pos: [Number(item[0]), Number(item[1] ?? 0), Number(item[2])],
            kind: 'random',
            ttlTicks: null,
            spawnTick: -1
          });
        } else if (item && Array.isArray(item.pos)) {
          this.motes.push({
            id: item.id || this._allocMoteId(),
            pos: [Number(item.pos[0]), Number(item.pos[1] ?? 0), Number(item.pos[2])],
            kind: item.kind || 'random',
            ttlTicks: typeof item.ttl_s === 'number' ? Math.round(item.ttl_s * 60) : null,
            spawnTick: -1
          });
        }
      }
    } else if (this.randomMotes) {
      this._spawnInitialMotes(20);
    }

    this.shades = [];
    if (scenario && Array.isArray(scenario.shades)) {
      for (const item of scenario.shades) {
        const id = item.id || this._allocShadeId();
        const pos = [Number(item.pos[0]), Number(item.pos[1] ?? 0), Number(item.pos[2])];
        const defaultState = distXZ(pos, this.player.pos) <= SHADE_DETECT_RADIUS ? 'chase' : 'wander';
        const state = item.state || defaultState;
        const stateTicksLeft =
          typeof item.state_ticks_left === 'number'
            ? item.state_ticks_left
            : state === 'stunned'
              ? Math.round(this.tuning.pulse_stun_s * 60)
              : state === 'recoil'
                ? SHADE_RECOIL_TICKS
                : state === 'spawning'
                  ? 30
                  : 0;
        this.shades.push({
          id,
          pos,
          state,
          stateTicksLeft,
          pushTicksLeft: 0,
          pushDir: [1, 0],
          recoilDir: [1, 0],
          safeEjectTicks: 0,
          safeEjectTarget: null,
          wanderAngle: this.prng.range(0, Math.PI * 2),
          spawnTick: -1
        });
      }
    }

    this.drifters = [];
    if (scenario && Array.isArray(scenario.drifters)) {
      for (const item of scenario.drifters) {
        const id = item.id || this._allocDrifterId();
        this.drifters.push({
          id,
          pos: [Number(item.pos[0]), Number(item.pos[1] ?? 1.5), Number(item.pos[2])],
          state: item.state || 'idle',
          stolen: typeof item.stolen === 'number' ? item.stolen : 0,
          hasStolen: Boolean(item.stolen > 0 || item.state === 'flee'),
          fleeTicksLeft: item.state === 'flee' ? DRIFTER_FLEE_TICKS : 0,
          idleAngle: this.prng.range(0, Math.PI * 2),
          spawnTick: -1
        });
      }
    }

    this.charms = [];
    if (scenario && Array.isArray(scenario.charms)) {
      for (let i = 0; i < scenario.charms.length; i++) {
        const c = scenario.charms[i];
        this.charms.push({
          id: c.id || `C${i + 1}`,
          pos: [Number(c.pos[0]), Number(c.pos[1] ?? 0), Number(c.pos[2])],
          available: typeof c.available === 'boolean' ? c.available : true,
          respawnTicks: typeof c.respawn_s === 'number' ? Math.round(c.respawn_s * 60) : 0
        });
      }
    } else {
      for (const c of this.map.charms) {
        this.charms.push({
          id: c.id,
          pos: [...c.pos],
          available: true,
          respawnTicks: 0
        });
      }
    }

    this.prevButtons = {
      jump: false,
      interact: false,
      pulse: false,
      dash: false,
      pause: false
    };
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

  _allocDrifterId() {
    while (true) {
      const id = `D${this.nextDrifterSeq++}`;
      if (!this.drifters.some((d) => d.id === id)) return id;
    }
  }

  _spawnInitialMotes(count) {
    const indices = this.map.motePoints.map((_, idx) => idx);
    // Deterministic Fisher-Yates shuffle
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(this.prng.next() * (i + 1));
      const tmp = indices[i];
      indices[i] = indices[j];
      indices[j] = tmp;
    }
    const n = Math.min(count, indices.length);
    for (let i = 0; i < n; i++) {
      const pt = this.map.motePoints[indices[i]];
      this.motes.push({
        id: this._allocMoteId(),
        pos: [pt[0], pt[1], pt[2]],
        kind: 'random',
        ttlTicks: null,
        spawnTick: -1
      });
    }
  }

  _spawnScheduledMote() {
    if (this.motes.length >= 30) return;
    const freePts = this.map.motePoints.filter(
      (pt) => !this.motes.some((m) => distXZ(m.pos, pt) < 0.5 && Math.abs(m.pos[1] - pt[1]) < 0.5)
    );
    if (freePts.length === 0) return;
    const pt = freePts[Math.floor(this.prng.next() * freePts.length)];
    this.motes.push({
      id: this._allocMoteId(),
      pos: [pt[0], pt[1], pt[2]],
      kind: 'random',
      ttlTicks: null,
      spawnTick: this.simTick
    });
  }

  _isInsideAnyLitSafeZone(pos) {
    for (const l of this.lanterns) {
      if (l.lit && distXZ(pos, l.pos) < this.tuning.safe_radius) return true;
    }
    return false;
  }

  _spawnScheduledShade(events) {
    if (this.shades.length >= this.map.maxShades) return;
    const validPts = this.map.shadePoints.filter(
      (pt) =>
        distXZ(pt, this.player.pos) >= 15.0 &&
        !this._isInsideAnyLitSafeZone(pt) &&
        !this.shades.some((s) => distXZ(s.pos, pt) < 1.0)
    );
    if (validPts.length === 0) return;
    const pt = validPts[Math.floor(this.prng.next() * validPts.length)];
    const id = this._allocShadeId();
    this.shades.push({
      id,
      pos: [pt[0], pt[1], pt[2]],
      state: 'spawning',
      stateTicksLeft: 30,
      pushTicksLeft: 0,
      pushDir: [1, 0],
      recoilDir: [1, 0],
      safeEjectTicks: 0,
      safeEjectTarget: null,
      wanderAngle: this.prng.range(0, Math.PI * 2),
      spawnTick: this.simTick
    });
    events.push({
      type: 'event',
      tick: this.tick,
      name: 'shade_spawned',
      data: { id }
    });
  }

  _spawnScheduledDrifter() {
    const activeCount = this.drifters.filter((d) => d.state !== 'removed').length;
    if (activeCount >= 2) return;
    const pts = this.map.shadePoints;
    if (pts.length === 0) return;
    const pt = pts[Math.floor(this.prng.next() * pts.length)];
    this.drifters.push({
      id: this._allocDrifterId(),
      pos: [pt[0], pt[1] + 1.5, pt[2]],
      state: 'idle',
      stolen: 0,
      hasStolen: false,
      fleeTicksLeft: 0,
      idleAngle: this.prng.range(0, Math.PI * 2),
      spawnTick: this.simTick
    });
  }

  _enforceOutsideLitSafeZones(shade) {
    const safeR = this.tuning.safe_radius;
    for (let iter = 0; iter < 3; iter++) {
      let adjusted = false;
      for (const l of this.lanterns) {
        if (!l.lit) continue;
        const dx = shade.pos[0] - l.pos[0];
        const dz = shade.pos[2] - l.pos[2];
        const d = Math.hypot(dx, dz);
        if (d < safeR) {
          const nx = d > 1e-6 ? dx / d : 1;
          const nz = d > 1e-6 ? dz / d : 0;
          shade.pos[0] = l.pos[0] + nx * safeR;
          shade.pos[2] = l.pos[2] + nz * safeR;
          adjusted = true;
        }
      }
      if (!adjusted) break;
    }
  }

  _spawnDroppedMotes(centerPos, count) {
    for (let i = 0; i < count; i++) {
      const angle = this.prng.range(0, Math.PI * 2);
      const r = this.prng.range(1.5, 2.5);
      let x = centerPos[0] + Math.cos(angle) * r;
      let z = centerPos[2] + Math.sin(angle) * r;
      let y = getSurfaceHeight(this.map, x, z, centerPos[1] + 0.5);
      if (y === null) {
        x = centerPos[0];
        z = centerPos[2];
        y = Math.max(0, centerPos[1]);
      }
      this.motes.push({
        id: this._allocMoteId(),
        pos: [round3(x), round3(y), round3(z)],
        kind: 'dropped',
        ttlTicks: DROPPED_MOTE_TTL_TICKS,
        spawnTick: this.simTick
      });
    }
  }

  step(rawInput = {}) {
    if (this.state === 'won' || this.state === 'lost') {
      return [];
    }

    const events = [];

    // Step 1: Read input & handle pause FIRST
    const move = Array.isArray(rawInput.move) ? rawInput.move : [0, 0];
    const camYawDeg = typeof rawInput.cam_yaw_deg === 'number' ? rawInput.cam_yaw_deg : 0;
    const jump = Boolean(rawInput.jump);
    const interact = Boolean(rawInput.interact);
    const pulse = Boolean(rawInput.pulse);
    const dash = Boolean(rawInput.dash);
    const pause = Boolean(rawInput.pause);

    const jumpTriggered = !this.prevButtons.jump && jump;
    const interactTriggered = !this.prevButtons.interact && interact;
    const pulseTriggered = !this.prevButtons.pulse && pulse;
    const dashTriggered = !this.prevButtons.dash && dash;
    const pauseTriggered = !this.prevButtons.pause && pause;

    this.prevButtons.jump = jump;
    this.prevButtons.interact = interact;
    this.prevButtons.pulse = pulse;
    this.prevButtons.dash = dash;
    this.prevButtons.pause = pause;

    this.tick += 1;

    if (this.state === 'paused') {
      if (pauseTriggered) {
        this.state = 'playing';
        events.push({ type: 'event', tick: this.tick, name: 'resumed', data: {} });
      } else {
        return events;
      }
    } else if (pauseTriggered) {
      this.state = 'paused';
      events.push({ type: 'event', tick: this.tick, name: 'paused', data: {} });
      return events;
    }

    this.simTick += 1;

    if (!this.nightStartEmitted) {
      this.nightStartEmitted = true;
      events.push({ type: 'event', tick: this.tick, name: 'night_start', data: { night: this.night } });
    }

    // Step 2: Decrement timers (time, cooldowns, invuln, stun/recoil, charm, dropped TTL, charm respawn, fall respawn)
    this.timeLeftS = Math.max(0, this.initialTimeLeftS - this.simTick * DT);

    if (this.player.invulnTicks > 0) this.player.invulnTicks -= 1;
    if (this.player.dashCdTicks > 0) this.player.dashCdTicks -= 1;
    if (this.player.pulseCdTicks > 0) this.player.pulseCdTicks -= 1;
    if (this.player.charmTicks > 0) this.player.charmTicks -= 1;

    if (this.player.fallRespawnTicks > 0) {
      this.player.fallRespawnTicks -= 1;
      if (this.player.fallRespawnTicks === 0) {
        const sp = this.map.spawnPos;
        this.player.pos = [sp[0], sp[1], sp[2]];
        this.player.vel = [0, 0, 0];
        this.player.grounded = true;
        this.player.launchLocked = false;
        this.player.dashTicks = 0;
        this.player.invulnTicks = Math.round(this.tuning.invuln_s * 60);
      }
    }

    for (const s of this.shades) {
      if (s.stateTicksLeft > 0) {
        s.stateTicksLeft -= 1;
        if (s.stateTicksLeft === 0 && (s.state === 'spawning' || s.state === 'stunned' || s.state === 'recoil')) {
          s.state = 'wander';
          s.pushTicksLeft = 0;
        }
      }
    }

    // Dropped mote TTL
    const aliveMotes = [];
    for (const m of this.motes) {
      if (m.kind === 'dropped' && m.ttlTicks !== null) {
        m.ttlTicks -= 1;
        if (m.ttlTicks <= 0) continue;
      }
      aliveMotes.push(m);
    }
    this.motes = aliveMotes;

    // Charm respawn timers
    for (const c of this.charms) {
      if (!c.available && c.respawnTicks > 0) {
        c.respawnTicks -= 1;
        if (c.respawnTicks === 0) {
          c.available = true;
        }
      }
    }

    // Wind cycle (Night 3 or wind_enabled)
    if (this.windEnabled) {
      const cyclePos = this.simTick % WIND_INTERVAL_TICKS;
      if (cyclePos === WIND_INTERVAL_TICKS - WIND_WARN_TICKS) {
        this.wind.dirDeg = Math.floor(this.prng.next() * 360);
        this.wind.warning = true;
        this.wind.active = false;
      } else if (cyclePos === 0) {
        this.wind.warning = false;
        this.wind.active = true;
        this.wind.timerTicks = WIND_DURATION_TICKS;
      } else if (this.wind.active) {
        this.wind.timerTicks -= 1;
        if (this.wind.timerTicks <= 0) {
          this.wind.active = false;
        }
      }
    } else {
      this.wind.active = false;
      this.wind.warning = false;
    }

    // Step 3: Move Mây (jump, dash, jump pads, wind) then check fall off island
    const waitingRespawn = this.player.fallRespawnTicks > 0;
    if (!waitingRespawn) {
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

      // Dash trigger
      const canDash = this.player.dashTicks === 0 && (this.player.charmTicks > 0 || this.player.dashCdTicks === 0);
      if (dashTriggered && canDash) {
        const dirX = mag > 1e-4 ? wx / mag : Math.sin(this.player.facingYaw);
        const dirZ = mag > 1e-4 ? wz / mag : Math.cos(this.player.facingYaw);
        this.player.dashDir = [dirX, dirZ];
        this.player.dashTicks = Math.round(this.tuning.dash_duration_s * 60); // 12
        this.player.dashCdTicks = this.player.charmTicks > 0 ? 0 : Math.round(this.tuning.dash_cooldown_s * 60); // 90
        this.player.launchLocked = false;
        events.push({ type: 'event', tick: this.tick, name: 'dash', data: {} });
      }

      const oldX = this.player.pos[0];
      const oldZ = this.player.pos[2];
      const runSpeed = this.player.charmTicks > 0 ? CHARM_SPEED : this.tuning.player_speed;

      if (this.player.dashTicks > 0) {
        this.player.vel[0] = this.player.dashDir[0] * this.tuning.dash_speed;
        this.player.vel[2] = this.player.dashDir[1] * this.tuning.dash_speed;
        this.player.vel[1] = 0; // Dash keeps altitude in air
        this.player.dashTicks -= 1;
      } else {
        if (!this.player.launchLocked) {
          this.player.vel[0] = wx * runSpeed;
          this.player.vel[2] = wz * runSpeed;
        }
        if (jumpTriggered && this.player.grounded) {
          this.player.vel[1] = JUMP_VELOCITY;
          this.player.grounded = false;
        }
      }

      // Wind push
      let windVx = 0;
      let windVz = 0;
      if (this.wind.active) {
        const wRad = (this.wind.dirDeg * Math.PI) / 180;
        windVx = Math.cos(wRad) * WIND_SPEED;
        windVz = Math.sin(wRad) * WIND_SPEED;
      }

      const targetX = oldX + (this.player.vel[0] + windVx) * DT;
      const targetZ = oldZ + (this.player.vel[2] + windVz) * DT;
      const resolved = resolveHorizontalCollision(this.map, oldX, oldZ, targetX, targetZ, this.player.pos[1]);
      this.player.pos[0] = resolved.x;
      this.player.pos[2] = resolved.z;

      // Vertical physics & ground support
      const groundY = getSurfaceHeight(this.map, this.player.pos[0], this.player.pos[2], this.player.pos[1]);
      if (this.player.dashTicks > 0) {
        // Maintain altitude during dash; if on ground keep grounded state accurate
        this.player.grounded = groundY !== null && Math.abs(this.player.pos[1] - groundY) < 0.05;
      } else {
        if (!this.player.grounded || groundY === null || this.player.pos[1] > groundY + 0.05) {
          this.player.grounded = false;
          this.player.pos[1] += this.player.vel[1] * DT;
          this.player.vel[1] += GRAVITY * DT;
          if (groundY !== null && this.player.pos[1] <= groundY && this.player.vel[1] <= 0) {
            this.player.pos[1] = groundY;
            this.player.vel[1] = 0;
            this.player.grounded = true;
            this.player.launchLocked = false;
          }
        } else {
          // Follow ramp smoothly
          this.player.pos[1] = groundY;
          this.player.vel[1] = 0;
          this.player.grounded = true;
          this.player.launchLocked = false;
        }
      }

      // Jump pads check
      for (const pad of this.map.jumpPads) {
        if (
          distXZ(this.player.pos, pad.pos) <= pad.radius &&
          Math.abs(this.player.pos[1] - pad.pos[1]) <= 0.6 &&
          this.player.vel[1] <= 0.5
        ) {
          this.player.vel[0] = pad.dir[0] * pad.vh;
          this.player.vel[2] = pad.dir[1] * pad.vh;
          this.player.vel[1] = pad.vy;
          this.player.grounded = false;
          this.player.launchLocked = true;
          this.player.dashTicks = 0;
          break;
        }
      }

      // Fall off island check (Y < -10)
      if (this.tuning.fall_enabled && this.player.pos[1] < FALL_THRESHOLD_Y) {
        const lost = this.player.carried;
        this.player.carried = 0;
        this.player.flames = Math.max(0, this.player.flames - 1);
        this.player.vel = [0, 0, 0];
        this.player.dashTicks = 0;
        this.player.launchLocked = false;
        events.push({
          type: 'event',
          tick: this.tick,
          name: 'player_hit',
          data: {
            by: 'fall',
            flames: this.player.flames,
            dropped: 0,
            lost
          }
        });
        if (this.player.flames > 0) {
          this.player.fallRespawnTicks = FALL_RESPAWN_TICKS;
        }
      }
    }

    const canInteractWorld = this.player.fallRespawnTicks === 0 && this.player.flames > 0;

    // Step 4: Pickup motes and charms
    if (canInteractWorld) {
      if (this.player.carried < this.tuning.carry_capacity) {
        const remaining = [];
        for (const m of this.motes) {
          const canPick =
            this.player.carried < this.tuning.carry_capacity &&
            m.spawnTick < this.simTick &&
            distXZ(this.player.pos, m.pos) <= this.tuning.pickup_radius &&
            Math.abs(this.player.pos[1] - m.pos[1]) <= 1.5;
          if (canPick) {
            this.player.carried += 1;
            events.push({
              type: 'event',
              tick: this.tick,
              name: 'mote_picked',
              data: { carried: this.player.carried }
            });
          } else {
            remaining.push(m);
          }
        }
        this.motes = remaining;
      }

      for (const c of this.charms) {
        if (
          c.available &&
          distXZ(this.player.pos, c.pos) <= this.tuning.pickup_radius &&
          Math.abs(this.player.pos[1] - c.pos[1]) <= 1.5
        ) {
          c.available = false;
          c.respawnTicks = CHARM_RESPAWN_TICKS;
          this.player.charmTicks = CHARM_DURATION_TICKS;
          this.player.dashCdTicks = 0;
          events.push({
            type: 'event',
            tick: this.tick,
            name: 'charm_picked',
            data: { charm_id: c.id, charm_ticks: CHARM_DURATION_TICKS }
          });
        }
      }
    }

    // Step 5: Interact with lanterns
    if (canInteractWorld && interactTriggered && this.player.carried > 0) {
      let bestLantern = null;
      let bestDist = Infinity;
      for (const l of this.lanterns) {
        if (l.lit) continue;
        const d = distXZ(this.player.pos, l.pos);
        if (d <= this.tuning.interact_radius) {
          if (d < bestDist - 1e-9 || (Math.abs(d - bestDist) <= 1e-9 && (!bestLantern || l.id < bestLantern.id))) {
            bestDist = d;
            bestLantern = l;
          }
        }
      }
      if (bestLantern) {
        const needed = Math.max(0, this.tuning.lantern_cost - bestLantern.deposited);
        const amount = Math.min(this.player.carried, needed);
        if (amount > 0) {
          this.player.carried -= amount;
          bestLantern.deposited += amount;
          this.score += amount * this.tuning.score.per_mote;
          events.push({
            type: 'event',
            tick: this.tick,
            name: 'deposit',
            data: { lantern_id: bestLantern.id, amount, deposited: bestLantern.deposited }
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

            // Flag shades currently inside safe_radius for smooth ejection within 30 ticks
            for (const s of this.shades) {
              const dx = s.pos[0] - bestLantern.pos[0];
              const dz = s.pos[2] - bestLantern.pos[2];
              const d = Math.hypot(dx, dz);
              if (d < this.tuning.safe_radius) {
                const nx = d > 1e-6 ? dx / d : 1;
                const nz = d > 1e-6 ? dz / d : 0;
                s.safeEjectTicks = SAFE_EJECT_TICKS;
                s.safeEjectTarget = [
                  bestLantern.pos[0] + nx * (this.tuning.safe_radius + 0.05),
                  bestLantern.pos[2] + nz * (this.tuning.safe_radius + 0.05)
                ];
              }
            }
          }
        }
      }
    }

    // Step 6: Update safe zones (eject flagged shades within 30 ticks)
    for (const s of this.shades) {
      if (s.safeEjectTicks > 0 && s.safeEjectTarget) {
        const dx = s.safeEjectTarget[0] - s.pos[0];
        const dz = s.safeEjectTarget[1] - s.pos[2];
        const frac = 1 / s.safeEjectTicks;
        s.pos[0] += dx * frac;
        s.pos[2] += dz * frac;
        s.safeEjectTicks -= 1;
        if (s.safeEjectTicks === 0) {
          s.safeEjectTarget = null;
        }
      }
    }

    // Step 7: Pulse (Tỏa Sáng)
    if (
      canInteractWorld &&
      pulseTriggered &&
      this.player.pulseCdTicks === 0 &&
      this.player.carried >= this.tuning.pulse_cost
    ) {
      this.player.carried -= this.tuning.pulse_cost;
      this.player.pulseCdTicks = Math.round(this.tuning.pulse_cooldown_s * 60); // 180
      const pulseCenter = [this.player.pos[0], this.player.pos[1] + 0.8, this.player.pos[2]];
      const stunnedIds = [];

      for (const s of this.shades) {
        if (s.spawnTick >= this.simTick) continue;
        if (dist3D(pulseCenter, s.pos) <= this.tuning.pulse_radius) {
          s.state = 'stunned';
          s.stateTicksLeft = Math.round(this.tuning.pulse_stun_s * 60); // 120
          s.pushTicksLeft = PULSE_PUSH_TICKS; // 15
          const dx = s.pos[0] - this.player.pos[0];
          const dz = s.pos[2] - this.player.pos[2];
          const d = Math.hypot(dx, dz);
          s.pushDir = d > 1e-6 ? [dx / d, dz / d] : [1, 0];
          stunnedIds.push(s.id);
          this.score += this.tuning.score.per_stun;
        }
      }

      for (const dr of this.drifters) {
        if (dr.state === 'removed' || dr.spawnTick >= this.simTick) continue;
        if (dist3D(pulseCenter, dr.pos) <= this.tuning.pulse_radius) {
          if (dr.state === 'chase') {
            dr.state = 'flee';
            dr.fleeTicksLeft = DRIFTER_FLEE_TICKS;
          } else if (dr.state === 'flee' && dr.stolen > 0) {
            const amount = dr.stolen;
            dr.stolen = 0;
            dr.fleeTicksLeft = DRIFTER_DROP_FLEE_TICKS;
            this._spawnDroppedMotes(dr.pos, amount);
            events.push({
              type: 'event',
              tick: this.tick,
              name: 'drifter_drop',
              data: { drifter_id: dr.id, amount }
            });
          }
        }
      }

      events.push({
        type: 'event',
        tick: this.tick,
        name: 'pulse',
        data: { stunned_ids: stunnedIds }
      });
    }

    // Step 8: Move Shades and Drifters
    for (const s of this.shades) {
      if (s.spawnTick >= this.simTick) continue;
      if (s.safeEjectTicks > 0) continue; // Currently being pushed out by safe zone

      const oldX = s.pos[0];
      const oldZ = s.pos[2];

      if (s.state === 'stunned') {
        if (s.pushTicksLeft > 0) {
          const stepDist = this.tuning.pulse_push_m / PULSE_PUSH_TICKS;
          const nx = oldX + s.pushDir[0] * stepDist;
          const nz = oldZ + s.pushDir[1] * stepDist;
          const col = resolveHorizontalCollision(this.map, oldX, oldZ, nx, nz, s.pos[1]);
          if (col.blocked || !isPointOnWalkableIsland(this.map, col.x, col.z)) {
            s.pushTicksLeft = 0;
          } else {
            s.pos[0] = col.x;
            s.pos[2] = col.z;
            s.pushTicksLeft -= 1;
          }
        }
      } else if (s.state === 'recoil') {
        const stepDist = SHADE_RECOIL_DIST / SHADE_RECOIL_TICKS;
        const nx = oldX + s.recoilDir[0] * stepDist;
        const nz = oldZ + s.recoilDir[1] * stepDist;
        if (isPointOnWalkableIsland(this.map, nx, nz)) {
          s.pos[0] = nx;
          s.pos[2] = nz;
        }
      } else if (s.state === 'wander' || s.state === 'chase') {
        const dPlayer = distXZ(s.pos, this.player.pos);
        if (s.state === 'wander' && dPlayer <= SHADE_DETECT_RADIUS) {
          s.state = 'chase';
        } else if (s.state === 'chase' && dPlayer > SHADE_LEASH_RADIUS) {
          s.state = 'wander';
        }

        if (s.state === 'chase') {
          const dx = this.player.pos[0] - oldX;
          const dz = this.player.pos[2] - oldZ;
          const d = Math.hypot(dx, dz);
          if (d > 1e-6) {
            const stepDist = Math.min(d, this.map.shadeSpeed * DT);
            const nx = oldX + (dx / d) * stepDist;
            const nz = oldZ + (dz / d) * stepDist;
            const col = resolveHorizontalCollision(this.map, oldX, oldZ, nx, nz, s.pos[1]);
            if (isPointOnWalkableIsland(this.map, col.x, col.z)) {
              s.pos[0] = col.x;
              s.pos[2] = col.z;
            }
          }
        } else {
          // Wander gently on island
          const stepDist = this.map.shadeSpeed * 0.45 * DT;
          const nx = oldX + Math.cos(s.wanderAngle) * stepDist;
          const nz = oldZ + Math.sin(s.wanderAngle) * stepDist;
          if (isPointOnWalkableIsland(this.map, nx, nz)) {
            s.pos[0] = nx;
            s.pos[2] = nz;
          } else {
            s.wanderAngle += Math.PI * 0.75;
          }
        }
      }

      // Enforce outside lit lantern safe zones
      this._enforceOutsideLitSafeZones(s);
      const surf = getSurfaceHeight(this.map, s.pos[0], s.pos[2], s.pos[1] + 0.5);
      if (surf !== null) s.pos[1] = surf;
    }

    // Move Drifters
    for (const dr of this.drifters) {
      if (dr.state === 'removed' || dr.spawnTick >= this.simTick) continue;
      const dPlayer = distXZ(dr.pos, this.player.pos);

      if (dr.state === 'idle') {
        if (!dr.hasStolen && this.player.carried >= DRIFTER_MIN_CARRIED && dPlayer <= DRIFTER_DETECT_RADIUS) {
          dr.state = 'chase';
        } else {
          dr.idleAngle += 0.015;
          dr.pos[0] += Math.cos(dr.idleAngle) * DRIFTER_IDLE_SPEED * DT;
          dr.pos[2] += Math.sin(dr.idleAngle) * DRIFTER_IDLE_SPEED * DT;
        }
      }

      if (dr.state === 'chase') {
        if (this.player.carried < DRIFTER_MIN_CARRIED || dPlayer > DRIFTER_DETECT_RADIUS) {
          dr.state = 'idle';
        } else {
          const dx = this.player.pos[0] - dr.pos[0];
          const dz = this.player.pos[2] - dr.pos[2];
          const d = Math.hypot(dx, dz);
          if (d > 1e-6) {
            const stepDist = Math.min(d, DRIFTER_CHASE_SPEED * DT);
            dr.pos[0] += (dx / d) * stepDist;
            dr.pos[2] += (dz / d) * stepDist;
          }
        }
      } else if (dr.state === 'flee') {
        const dx = dr.pos[0] - this.player.pos[0];
        const dz = dr.pos[2] - this.player.pos[2];
        const d = Math.hypot(dx, dz);
        const nx = d > 1e-6 ? dx / d : 1;
        const nz = d > 1e-6 ? dz / d : 0;
        dr.pos[0] += nx * DRIFTER_CHASE_SPEED * DT;
        dr.pos[2] += nz * DRIFTER_CHASE_SPEED * DT;
        dr.fleeTicksLeft -= 1;
        if (dr.fleeTicksLeft <= 0) {
          dr.state = 'removed';
        }
      }
    }

    // Step 9: Collisions — Drifters steal first, then Shades hit (ascending id, max 1 shade hit per tick)
    if (canInteractWorld) {
      const sortedDrifters = [...this.drifters].sort((a, b) => a.id.localeCompare(b.id));
      for (const dr of sortedDrifters) {
        if (dr.state !== 'chase' || dr.hasStolen || dr.spawnTick >= this.simTick) continue;
        if (distXZ(this.player.pos, dr.pos) <= DRIFTER_STEAL_RADIUS) {
          const amount = Math.min(DRIFTER_MAX_STEAL, this.player.carried);
          this.player.carried -= amount;
          dr.stolen = amount;
          dr.hasStolen = true;
          dr.state = 'flee';
          dr.fleeTicksLeft = DRIFTER_FLEE_TICKS;
          events.push({
            type: 'event',
            tick: this.tick,
            name: 'drifter_steal',
            data: { drifter_id: dr.id, amount, carried: this.player.carried }
          });
        }
      }

      if (this.player.invulnTicks === 0) {
        const sortedShades = [...this.shades].sort((a, b) => a.id.localeCompare(b.id));
        for (const s of sortedShades) {
          if (s.spawnTick >= this.simTick) continue;
          if (s.safeEjectTicks > 0) continue;
          if (s.state !== 'chase' && s.state !== 'wander') continue;
          if (
            distXZ(this.player.pos, s.pos) <= this.tuning.shade_hit_radius &&
            Math.abs(this.player.pos[1] - s.pos[1]) <= 1.5
          ) {
            this.player.flames = Math.max(0, this.player.flames - 1);
            const dropped = Math.floor(this.player.carried * this.tuning.hit_drop_ratio);
            this.player.carried -= dropped;
            if (dropped > 0) {
              this._spawnDroppedMotes(this.player.pos, dropped);
            }
            this.player.invulnTicks = Math.round(this.tuning.invuln_s * 60); // 90

            // Shade enters recoil for 60 ticks
            const dx = s.pos[0] - this.player.pos[0];
            const dz = s.pos[2] - this.player.pos[2];
            const d = Math.hypot(dx, dz);
            s.state = 'recoil';
            s.stateTicksLeft = SHADE_RECOIL_TICKS;
            s.recoilDir = d > 1e-6 ? [dx / d, dz / d] : [1, 0];

            events.push({
              type: 'event',
              tick: this.tick,
              name: 'player_hit',
              data: { by: 'shade', flames: this.player.flames, dropped }
            });
            break; // Max 1 flame lost per tick
          }
        }
      }
    }

    // Step 10: Scheduled spawns (entities interact from next tick)
    if (this.randomMotes && this.simTick > 0 && this.simTick % 240 === 0) {
      this._spawnScheduledMote();
    }

    if (this.randomShades) {
      if (this.simTick === 300) {
        this._spawnScheduledShade(events);
        this._spawnScheduledShade(events);
      } else if (
        this.simTick > 300 &&
        (this.simTick - 300) % this.map.shadeSpawnIntervalTicks === 0
      ) {
        this._spawnScheduledShade(events);
      }
    }

    if (this.randomDrifters && this.simTick > 0 && this.simTick % 1200 === 0) {
      this._spawnScheduledDrifter();
    }

    // Step 11: Win / Lose check (exact priority: no_flames -> all_lit -> dawn)
    if (this.player.flames <= 0) {
      this.state = 'lost';
      events.push({
        type: 'event',
        tick: this.tick,
        name: 'game_over',
        data: { result: 'lost', reason: 'no_flames' }
      });
    } else if (this.lanterns.every((l) => l.lit)) {
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
    } else if (this.timeLeftS <= 0) {
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
      night: this.night,
      state: this.state,
      time_left_s: round3(this.timeLeftS),
      score: this.score,
      wind: {
        active: this.wind.active,
        dir_deg: this.wind.dirDeg
      },
      player: {
        pos: this.player.pos.map(round3),
        vel: this.player.vel.map(round3),
        grounded: this.player.grounded,
        flames: this.player.flames,
        carried: this.player.carried,
        invuln: this.player.invulnTicks > 0,
        dash_cd_s: round3(this.player.dashCdTicks * DT),
        pulse_cd_s: round3(this.player.pulseCdTicks * DT),
        charm_s: round3(this.player.charmTicks * DT)
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
        pos: m.pos.map(round3),
        kind: m.kind,
        ttl_s: m.ttlTicks === null ? null : round3(m.ttlTicks * DT)
      })),
      motes_active: this.motes.length,
      drifters: this.drifters
        .filter((d) => d.state !== 'removed')
        .map((d) => ({
          id: d.id,
          pos: d.pos.map(round3),
          state: d.state,
          stolen: d.stolen
        })),
      charms: this.charms.map((c) => ({
        id: c.id,
        available: c.available,
        respawn_s: round3(c.respawnTicks * DT)
      }))
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
