export const DT = 1 / 60;
export const ISLAND_RADIUS = 35.0;
export const JUMP_VELOCITY = 8.0;
export const GRAVITY = -20.0;

export const TUNING = {
  player_speed: 7.0,
  carry_capacity: 5,
  lantern_cost: 5,
  lantern_count_night1: 5,
  pickup_radius: 2.0,
  interact_radius: 3.0,
  pulse_cost: 1,
  pulse_radius: 7.0,
  night1_duration_s: 240,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 2.5,
  pulse_push_m: 5.0,
  pulse_cooldown_s: 2.0,
  safe_radius: 6.0,
  shade_speed: 4.2,
  shade_hit_radius: 1.2,
  fall_enabled: false,
  score: {
    per_mote: 10,
    per_lantern: 200,
    per_stun: 50,
    per_second_left: 5,
    per_flame_left: 100
  }
};

export function createDefaultNight1Lanterns() {
  const count = TUNING.lantern_count_night1;
  const ringRadius = 22.0;
  const lanterns = [];
  for (let i = 0; i < count; i++) {
    const angle = (i * 2 * Math.PI) / count - Math.PI / 2;
    const x = Math.round(Math.cos(angle) * ringRadius * 1000) / 1000;
    const z = Math.round(Math.sin(angle) * ringRadius * 1000) / 1000;
    lanterns.push({
      id: `L${i + 1}`,
      pos: [x, 0, z],
      lit: false,
      deposited: 0
    });
  }
  return lanterns;
}
