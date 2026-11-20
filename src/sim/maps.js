function round3(v) {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
}

function ringPoints(cx, cz, radius, count, startDeg = 0, stepDeg = null, y = 0) {
  const step = stepDeg !== null ? stepDeg : 360 / count;
  const pts = [];
  for (let i = 0; i < count; i++) {
    const rad = ((startDeg + i * step) * Math.PI) / 180;
    pts.push([round3(cx + Math.cos(rad) * radius), y, round3(cz + Math.sin(rad) * radius)]);
  }
  return pts;
}

export function getMapConfig(night) {
  if (night === 1) {
    return {
      night: 1,
      name: 'Đêm 1 — Đảo Bến',
      introQuote: 'Ông Đăng: "Đêm đầu tiên sương đen vừa kéo về. Hãy gom đom đóm thắp đèn và châm dầu giữ ít nhất 3/5 Đèn Lồng sáng tới Bình Minh!"',
      durationS: 240,
      spawnPos: [0, 0, 0],
      shadeSpeed: 4.0,
      shadeSpawnIntervalTicks: 480, // 8s
      maxShades: 6,
      hasDrifters: false,
      hasWind: false,
      lanterns: [
        { id: 'L1', pos: [0, 0, 25], lit: false, deposited: 0 },
        { id: 'L2', pos: [23.8, 0, 7.7], lit: false, deposited: 0 },
        { id: 'L3', pos: [14.7, 0, -20.2], lit: false, deposited: 0 },
        { id: 'L4', pos: [-14.7, 0, -20.2], lit: false, deposited: 0 },
        { id: 'L5', pos: [-23.8, 0, 7.7], lit: false, deposited: 0 }
      ],
      motePoints: [
        ...ringPoints(0, 0, 12, 8, 0, 45, 0),
        ...ringPoints(0, 0, 33, 16, 0, 22.5, 0)
      ],
      shadePoints: ringPoints(0, 0, 37, 12, 15, 30, 0),
      charms: [],
      jumpPads: []
    };
  }

  if (night === 2) {
    const dirAtoB = (() => {
      const dx = 70 - 20;
      const dz = 0 - 18;
      const len = Math.hypot(dx, dz);
      return [dx / len, dz / len];
    })();
    const dirBtoA = (() => {
      const dx = 0 - 50;
      const dz = 0 - -18;
      const len = Math.hypot(dx, dz);
      return [dx / len, dz / len];
    })();

    return {
      night: 2,
      name: 'Đêm 2 — Đảo Cau',
      introQuote: 'Ông Đăng: "Đảo Cau nối đôi bờ bằng cầu tre mảnh. Coi chừng Gió Lạc cướp sáng, Bóng Mực hút dầu và giữ ít nhất 4/6 đèn sáng tới Bình Minh!"',
      durationS: 270,
      spawnPos: [0, 0, 0],
      shadeSpeed: 4.0,
      shadeSpawnIntervalTicks: 420, // 7s
      maxShades: 8,
      hasDrifters: true,
      hasWind: false,
      lanterns: [
        { id: 'L1', pos: [0, 0, 20], lit: false, deposited: 0 },
        { id: 'L2', pos: [17, 0, -10], lit: false, deposited: 0 },
        { id: 'L3', pos: [-17, 0, -10], lit: false, deposited: 0 },
        { id: 'L4', pos: [70, 0, 20], lit: false, deposited: 0 },
        { id: 'L5', pos: [87, 0, -10], lit: false, deposited: 0 },
        { id: 'L6', pos: [53, 0, -10], lit: false, deposited: 0 }
      ],
      motePoints: [
        ...ringPoints(0, 0, 10, 4, 0, 90, 0),
        ...ringPoints(0, 0, 22, 8, 0, 45, 0),
        ...ringPoints(70, 0, 10, 4, 0, 90, 0),
        ...ringPoints(70, 0, 22, 8, 0, 45, 0)
      ],
      shadePoints: [
        ...ringPoints(0, 0, 26, 8, 22.5, 45, 0),
        ...ringPoints(70, 0, 26, 8, 22.5, 45, 0)
      ],
      charms: [{ id: 'C1', pos: [35, 0, 0] }],
      jumpPads: [
        { pos: [20, 0, 18], radius: 1.0, vy: 14.0, vh: 24.0, dir: dirAtoB },
        { pos: [50, 0, -18], radius: 1.0, vy: 14.0, vh: 24.0, dir: dirBtoA }
      ]
    };
  }

  if (night === 3) {
    return {
      night: 3,
      name: 'Đêm 3 — Đảo Chuông',
      introQuote: 'Ông Đăng: "Đêm cuối cùng trên Đảo Chuông ba tầng! Gió lớn sắp nổi — hãy châm dầu giữ ít nhất 5/7 Đèn Lồng sáng tới Bình Minh!"',
      durationS: 300,
      spawnPos: [0, 0, -15],
      shadeSpeed: 4.5,
      shadeSpawnIntervalTicks: 360, // 6s
      maxShades: 10,
      hasDrifters: true,
      hasWind: true,
      lanterns: [
        { id: 'L1', pos: [0, 6, 6], lit: false, deposited: 0 },
        { id: 'L2', pos: [18, 3, 10], lit: false, deposited: 0 },
        { id: 'L3', pos: [-18, 3, 10], lit: false, deposited: 0 },
        { id: 'L4', pos: [35, 0, -10], lit: false, deposited: 0 },
        { id: 'L5', pos: [-35, 0, -10], lit: false, deposited: 0 },
        { id: 'L6', pos: [20, 0, -35], lit: false, deposited: 0 },
        { id: 'L7', pos: [-20, 0, -35], lit: false, deposited: 0 }
      ],
      motePoints: [
        ...ringPoints(0, 0, 34, 18, 0, 20, 0),
        ...ringPoints(0, 0, 18, 8, 20, 20, 3),
        ...ringPoints(0, 0, 5, 4, 45, 90, 6)
      ],
      shadePoints: ringPoints(0, 0, 43, 16, 0, 22.5, 0),
      charms: [
        { id: 'C1', pos: [30, 0, 25] },
        { id: 'C2', pos: [-30, 0, 25] }
      ],
      jumpPads: [{ pos: [0, 3, 13], radius: 1.0, vy: 12.0, vh: 8.0, dir: [0, -1] }],
      ramps: [
        { angleDeg: 30, rStart: 30, rEnd: 24, halfWidth: 1.5, yStart: 0, yEnd: 3 },
        { angleDeg: 150, rStart: 30, rEnd: 24, halfWidth: 1.5, yStart: 0, yEnd: 3 }
      ],
      bellTower: { pos: [0, 6, 0], radius: 2.0, height: 8.0 }
    };
  }

  throw new Error(`Unsupported night: ${night}. Expected 1, 2, or 3.`);
}

function getRampHeight(ramps, x, z) {
  let best = null;
  for (const ramp of ramps) {
    const rad = (ramp.angleDeg * Math.PI) / 180;
    const ux = Math.cos(rad);
    const uz = Math.sin(rad);
    const along = x * ux + z * uz;
    const perp = Math.abs(-x * uz + z * ux);
    if (perp <= ramp.halfWidth && along >= ramp.rEnd && along <= ramp.rStart) {
      const t = (ramp.rStart - along) / (ramp.rStart - ramp.rEnd);
      const y = ramp.yStart + t * (ramp.yEnd - ramp.yStart);
      if (best === null || y > best) best = y;
    }
  }
  return best;
}

/**
 * Returns the maximum walkable surface height at (x, z) that is reachable from currentY (<= currentY + maxStep),
 * or null if (x, z) is off the island (over the cloud sea).
 */
export function getSurfaceHeight(map, x, z, currentY = 0, maxStep = 0.65) {
  if (map.night === 1) {
    return Math.hypot(x, z) <= 40.0 ? 0 : null;
  }

  if (map.night === 2) {
    const onA = Math.hypot(x, z) <= 28.0;
    const onB = Math.hypot(x - 70, z) <= 28.0;
    const onBridge = x >= 26.0 && x <= 44.0 && z >= -2.0 && z <= 2.0;
    return onA || onB || onBridge ? 0 : null;
  }

  // Night 3: 3 tiers + 2 ramps
  const r = Math.hypot(x, z);
  if (r > 45.0) return null;

  const candidates = [0];
  if (r >= 12.0 && r <= 24.0 && z > 0) {
    candidates.push(3.0);
  }
  if (r <= 8.0) {
    candidates.push(6.0);
  }
  const rampY = getRampHeight(map.ramps, x, z);
  if (rampY !== null) {
    candidates.push(rampY);
  }

  let best = null;
  for (const h of candidates) {
    if (h <= currentY + maxStep) {
      if (best === null || h > best) best = h;
    }
  }
  return best;
}

/**
 * Checks if moving horizontally from (oldX, oldZ) to (newX, newZ) at height currentY hits a vertical cliff or bell tower.
 * Returns adjusted [x, z] and whether an obstacle was hit.
 */
export function resolveHorizontalCollision(map, oldX, oldZ, newX, newZ, currentY) {
  let x = newX;
  let z = newZ;
  let blocked = false;

  if (map.night === 3) {
    // Bell tower cylinder at (0,0), radius 2, Y in [6, 14]
    if (currentY >= 5.5 && currentY < 14.0) {
      const rTower = Math.hypot(x, z);
      if (rTower < 2.0) {
        const nx = rTower > 1e-6 ? x / rTower : 1;
        const nz = rTower > 1e-6 ? z / rTower : 0;
        x = nx * 2.0;
        z = nz * 2.0;
        blocked = true;
      }
    }

    // Tier 2 central cliff cylinder (r <= 8, Y=6) when below Tier 2 (currentY < 5.35)
    if (currentY < 5.35) {
      const newR = Math.hypot(x, z);
      const oldR = Math.hypot(oldX, oldZ);
      if (newR < 8.0 && oldR >= 8.0) {
        const nx = newR > 1e-6 ? x / newR : 0;
        const nz = newR > 1e-6 ? z / newR : -1;
        x = nx * 8.02;
        z = nz * 8.02;
        blocked = true;
      }
    }

    // Tier 1 vertical cliff wall (12 <= r <= 24, z > 0, Y=3) when below Tier 1 and NOT on a ramp
    const inTier1XZ = (px, pz) => {
      const r = Math.hypot(px, pz);
      return r >= 12.0 && r <= 24.0 && pz > 0;
    };
    const onRamp =
      getRampHeight(map.ramps, x, z) !== null || getRampHeight(map.ramps, oldX, oldZ) !== null;

    if (!onRamp && currentY < 2.35 && inTier1XZ(x, z) && !inTier1XZ(oldX, oldZ)) {
      blocked = true;
      // Slide smoothly along the cliff instead of freezing dead
      if (!inTier1XZ(x, oldZ)) {
        z = oldZ;
      } else if (!inTier1XZ(oldX, z)) {
        x = oldX;
      } else {
        const oldR = Math.hypot(oldX, oldZ);
        if (oldZ <= 0) {
          z = -0.02;
        } else if (oldR > 24.0) {
          const r = Math.hypot(x, z) || 1;
          x = (x / r) * 24.02;
          z = (z / r) * 24.02;
        } else if (oldR < 12.0) {
          const r = Math.hypot(x, z) || 1;
          x = (x / r) * 11.98;
          z = (z / r) * 11.98;
        } else {
          x = oldX;
          z = oldZ;
        }
      }
    }
  }

  return { x, z, blocked };
}

export function isPointOnWalkableIsland(map, x, z) {
  return getSurfaceHeight(map, x, z, 100, 100) !== null;
}
