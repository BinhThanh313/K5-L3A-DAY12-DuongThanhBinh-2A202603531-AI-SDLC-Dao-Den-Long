import * as THREE from 'three';
import { DT, ISLAND_RADIUS, TUNING } from '../sim/config.js';
import { GameSimulation, distXZ } from '../sim/engine.js';
import { SoundEffects } from './audio.js';

const container = document.getElementById('app');
const hudFlames = document.getElementById('hud-flames');
const hudCarried = document.getElementById('hud-carried');
const hudLanterns = document.getElementById('hud-lanterns');
const hudTime = document.getElementById('hud-time');
const hudScore = document.getElementById('hud-score');
const hudPulse = document.getElementById('hud-pulse');
const promptBanner = document.getElementById('prompt-banner');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayReason = document.getElementById('overlay-reason');
const overlayScore = document.getElementById('overlay-score');
const replayBtn = document.getElementById('replay-btn');
const muteBtn = document.getElementById('mute-btn');

const sfx = new SoundEffects();

// Three.js Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0a1c);
scene.fog = new THREE.FogExp2(0x120d26, 0.022);

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 220);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.insertBefore(renderer.domElement, container.firstChild);

// Lights (warm up dynamically as lanterns are lit)
const hemiLight = new THREE.HemisphereLight(0x4e4b8a, 0x161224, 0.65);
scene.add(hemiLight);

const moonLight = new THREE.DirectionalLight(0x9fb2ff, 0.55);
moonLight.position.set(18, 34, 14);
moonLight.castShadow = true;
moonLight.shadow.mapSize.width = 1024;
moonLight.shadow.mapSize.height = 1024;
moonLight.shadow.camera.near = 5;
moonLight.shadow.camera.far = 90;
const dCam = 42;
moonLight.shadow.camera.left = -dCam;
moonLight.shadow.camera.right = dCam;
moonLight.shadow.camera.top = dCam;
moonLight.shadow.camera.bottom = -dCam;
scene.add(moonLight);

// Island Geometry (Circular Đảo Bến)
const islandGroup = new THREE.Group();
scene.add(islandGroup);

const islandMesh = new THREE.Mesh(
  new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS * 0.92, 3.2, 64),
  new THREE.MeshStandardMaterial({ color: 0x24263b, roughness: 0.92, metalness: 0.05 })
);
islandMesh.position.y = -1.6;
islandMesh.receiveShadow = true;
islandGroup.add(islandMesh);

// Subtle stone plaza center & ring path
const centerPlaza = new THREE.Mesh(
  new THREE.CylinderGeometry(4.2, 4.4, 0.08, 32),
  new THREE.MeshStandardMaterial({ color: 0x35334f, roughness: 0.85 })
);
centerPlaza.position.y = 0.04;
centerPlaza.receiveShadow = true;
islandGroup.add(centerPlaza);

const ringPath = new THREE.Mesh(
  new THREE.RingGeometry(20.6, 23.4, 64),
  new THREE.MeshStandardMaterial({
    color: 0x2f2d47,
    roughness: 0.9,
    side: THREE.DoubleSide
  })
);
ringPath.rotation.x = -Math.PI / 2;
ringPath.position.y = 0.03;
ringPath.receiveShadow = true;
islandGroup.add(ringPath);

// Decorative wooden pier posts along the island edge
const postMat = new THREE.MeshStandardMaterial({ color: 0x4b3832, roughness: 0.9 });
for (let i = 0; i < 24; i++) {
  const angle = (i / 24) * Math.PI * 2;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.1, 8), postMat);
  post.position.set(Math.cos(angle) * (ISLAND_RADIUS - 0.5), 0.55, Math.sin(angle) * (ISLAND_RADIUS - 0.5));
  post.castShadow = true;
  islandGroup.add(post);
}

// Sea of clouds below the island
const cloudGroup = new THREE.Group();
scene.add(cloudGroup);
const cloudMat = new THREE.MeshStandardMaterial({
  color: 0x211c3a,
  roughness: 1,
  transparent: true,
  opacity: 0.72
});
for (let i = 0; i < 36; i++) {
  const angle = (i / 36) * Math.PI * 2;
  const dist = ISLAND_RADIUS + 8 + (i % 5) * 9;
  const puff = new THREE.Mesh(new THREE.SphereGeometry(5 + (i % 4) * 2.2, 12, 10), cloudMat);
  puff.scale.set(1.6, 0.45, 1.2);
  puff.position.set(Math.cos(angle) * dist, -4.5 - (i % 3) * 1.4, Math.sin(angle) * dist);
  cloudGroup.add(puff);
}

// Starfield
const starGeo = new THREE.BufferGeometry();
const starPositions = [];
for (let i = 0; i < 260; i++) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.random() * Math.PI * 0.42;
  const r = 110;
  starPositions.push(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi) + 10,
    r * Math.sin(phi) * Math.sin(theta)
  );
}
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
const stars = new THREE.Points(
  starGeo,
  new THREE.PointsMaterial({ color: 0xfff1cc, size: 0.65, transparent: true, opacity: 0.85 })
);
scene.add(stars);

// Build Mây (Player with Nón Lá + Hanging Small Lantern)
function createPlayerMesh() {
  const group = new THREE.Group();

  // Cloak / body
  const body = new THREE.Mesh(
    new THREE.ConeGeometry(0.45, 1.15, 14),
    new THREE.MeshStandardMaterial({ color: 0x3b6998, roughness: 0.75 })
  );
  body.position.y = 0.58;
  body.castShadow = true;
  group.add(body);

  // Scarf
  const scarf = new THREE.Mesh(
    new THREE.TorusGeometry(0.24, 0.08, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0xf4a261, roughness: 0.6 })
  );
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 1.1;
  group.add(scarf);

  // Head
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 14, 12),
    new THREE.MeshStandardMaterial({ color: 0xffe0bd, roughness: 0.7 })
  );
  head.position.y = 1.32;
  head.castShadow = true;
  group.add(head);

  // Nón lá (Conical hat)
  const hat = new THREE.Mesh(
    new THREE.ConeGeometry(0.68, 0.42, 20),
    new THREE.MeshStandardMaterial({ color: 0xe6c78c, roughness: 0.85 })
  );
  hat.position.y = 1.62;
  hat.castShadow = true;
  group.add(hat);

  // Small hanging lantern attached to front rim of nón lá
  const charmPivot = new THREE.Group();
  charmPivot.position.set(0, 1.42, 0.62);
  const stringMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 0.22, 6),
    new THREE.MeshBasicMaterial({ color: 0xd9a760 })
  );
  stringMesh.position.y = -0.11;
  charmPivot.add(stringMesh);

  const miniLantern = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 10, 10),
    new THREE.MeshStandardMaterial({
      color: 0xffc857,
      emissive: 0xff9f1c,
      emissiveIntensity: 1.5
    })
  );
  miniLantern.scale.set(0.85, 1.2, 0.85);
  miniLantern.position.y = -0.26;
  charmPivot.add(miniLantern);

  const playerLight = new THREE.PointLight(0xffb84d, 2.4, 12, 1.6);
  playerLight.position.set(0, -0.26, 0);
  charmPivot.add(playerLight);

  group.add(charmPivot);
  group.userData.charmPivot = charmPivot;
  group.userData.bodyMat = body.material;
  return group;
}

const playerMesh = createPlayerMesh();
scene.add(playerMesh);

// Pulse visual wave ring
const pulseWave = new THREE.Mesh(
  new THREE.RingGeometry(0.6, 1.0, 48),
  new THREE.MeshBasicMaterial({
    color: 0xffcc66,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide
  })
);
pulseWave.rotation.x = -Math.PI / 2;
pulseWave.position.y = 0.15;
scene.add(pulseWave);
let pulseWaveAnim = 0;

// Dynamic entity pools
const lanternVisuals = new Map();
const moteVisuals = new Map();
const shadeVisuals = new Map();

function createLanternVisual(lantern) {
  const group = new THREE.Group();
  group.position.set(lantern.pos[0], 0, lantern.pos[2]);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.8, 0.5, 10),
    new THREE.MeshStandardMaterial({ color: 0x3b354f, roughness: 0.9 })
  );
  base.position.y = 0.25;
  base.castShadow = true;
  group.add(base);

  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.24, 2.5, 10),
    new THREE.MeshStandardMaterial({ color: 0x4f3d33, roughness: 0.85 })
  );
  pillar.position.y = 1.6;
  pillar.castShadow = true;
  group.add(pillar);

  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x4a4660,
    emissive: 0x221b38,
    emissiveIntensity: 0.3,
    roughness: 0.4
  });
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.38, 1.05, 8), coreMat);
  core.position.y = 3.25;
  group.add(core);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(0.85, 0.55, 8),
    new THREE.MeshStandardMaterial({ color: 0x3a2a2a, roughness: 0.8 })
  );
  roof.position.y = 4.0;
  group.add(roof);

  const light = new THREE.PointLight(0xffa73b, 0, 18, 1.4);
  light.position.y = 3.3;
  group.add(light);

  // Safe radius visual indicator (visible when lit)
  const safeRing = new THREE.Mesh(
    new THREE.RingGeometry(TUNING.safe_radius - 0.15, TUNING.safe_radius, 48),
    new THREE.MeshBasicMaterial({
      color: 0xffbe55,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide
    })
  );
  safeRing.rotation.x = -Math.PI / 2;
  safeRing.position.y = 0.06;
  group.add(safeRing);

  scene.add(group);
  return { group, coreMat, light, safeRing };
}

function createMoteVisual() {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 10, 10),
    new THREE.MeshStandardMaterial({
      color: 0xffe484,
      emissive: 0xffb32c,
      emissiveIntensity: 1.8
    })
  );
  scene.add(mesh);
  return mesh;
}

function createShadeVisual() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x180a26,
    emissive: 0x4c1478,
    emissiveIntensity: 0.85,
    roughness: 0.5
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.65, 14, 12), bodyMat);
  body.scale.set(1, 1.35, 1);
  body.position.y = 0.95;
  body.castShadow = true;
  group.add(body);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xe29cff });
  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), eyeMat);
  leftEye.position.set(-0.22, 1.15, 0.54);
  const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), eyeMat);
  rightEye.position.set(0.22, 1.15, 0.54);
  group.add(leftEye, rightEye);

  const stunRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.5, 0.06, 8, 20),
    new THREE.MeshBasicMaterial({ color: 0xffe299 })
  );
  stunRing.rotation.x = Math.PI / 2;
  stunRing.position.y = 2.05;
  stunRing.visible = false;
  group.add(stunRing);

  scene.add(group);
  return { group, bodyMat, stunRing };
}

// Game State & Input
let sim = null;
let camYawDeg = 0;
let isDragging = false;
let lastMouseX = 0;
const keys = new Set();

function resetGame() {
  for (const v of lanternVisuals.values()) scene.remove(v.group);
  for (const m of moteVisuals.values()) scene.remove(m);
  for (const s of shadeVisuals.values()) scene.remove(s.group);
  lanternVisuals.clear();
  moteVisuals.clear();
  shadeVisuals.clear();

  sim = new GameSimulation({ seed: Math.floor(Date.now() % 100000), night: 1 });
  for (const l of sim.lanterns) {
    lanternVisuals.set(l.id, createLanternVisual(l));
  }
  overlay.classList.remove('visible');
  pulseWaveAnim = 0;
}

window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'KeyM') {
    const muted = sfx.toggleMute();
    muteBtn.textContent = muted ? '🔇 Âm thanh: Tắt (M)' : '🔊 Âm thanh: Bật (M)';
  }
  if (e.code === 'Enter' && sim && sim.state !== 'playing') {
    resetGame();
  }
});

window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
});

renderer.domElement.addEventListener('mousedown', (e) => {
  if (e.button === 0) {
    isDragging = true;
    lastMouseX = e.clientX;
  }
});
window.addEventListener('mouseup', () => {
  isDragging = false;
});
window.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const dx = e.clientX - lastMouseX;
  lastMouseX = e.clientX;
  camYawDeg = (camYawDeg - dx * 0.35 + 360) % 360;
});

muteBtn.addEventListener('click', () => {
  const muted = sfx.toggleMute();
  muteBtn.textContent = muted ? '🔇 Âm thanh: Tắt (M)' : '🔊 Âm thanh: Bật (M)';
});

replayBtn.addEventListener('click', resetGame);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function formatTime(sec) {
  const s = Math.max(0, Math.ceil(sec));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function handleEvents(events) {
  for (const ev of events) {
    switch (ev.name) {
      case 'mote_picked':
        sfx.playMotePickup(ev.data.carried);
        break;
      case 'deposit':
        sfx.playDeposit();
        break;
      case 'lantern_lit':
        sfx.playLanternLit();
        break;
      case 'pulse':
        sfx.playPulse();
        pulseWaveAnim = 1.0;
        pulseWave.position.set(sim.player.pos[0], 0.15, sim.player.pos[2]);
        break;
      case 'player_hit':
        sfx.playHit();
        break;
      case 'game_over':
        if (ev.data.result === 'won') {
          sfx.playWin();
          overlayTitle.textContent = 'Đảo Đèn Lồng Bừng Sáng!';
          overlayReason.textContent = 'Mây đã thắp sáng cả 5 Đèn Lồng Lớn và đẩy lùi sương đen khỏi Đảo Bến.';
        } else {
          sfx.playLose();
          overlayTitle.textContent = 'Sương Đen Bao Phủ...';
          overlayReason.textContent =
            ev.data.reason === 'dawn'
              ? 'Bình minh đã tới trước khi toàn bộ Đèn Lồng kịp thắp sáng.'
              : 'Ngọn lửa của Mây đã tắt vì bị Bóng Mực chạm phải.';
        }
        overlayScore.textContent = `${sim.score} điểm`;
        overlay.classList.add('visible');
        break;
    }
  }
}

function syncVisuals(nowSec) {
  // Dynamic island brightening based on lit lanterns
  const litCount = sim.lanterns.filter((l) => l.lit).length;
  const progress = litCount / sim.lanterns.length;
  hemiLight.intensity = 0.55 + progress * 0.85;
  hemiLight.color.setHex(0x4e4b8a).lerp(new THREE.Color(0xffcf8b), progress * 0.65);
  scene.fog.density = 0.024 - progress * 0.011;
  scene.background.setHex(0x0b0a1c).lerp(new THREE.Color(0x231d3b), progress * 0.7);

  // Player mesh
  playerMesh.position.set(sim.player.pos[0], sim.player.pos[1], sim.player.pos[2]);
  playerMesh.rotation.y = sim.player.facingYaw;
  playerMesh.userData.charmPivot.rotation.z = Math.sin(nowSec * 3.5) * 0.12;
  playerMesh.visible = sim.player.invulnTimer <= 0 || Math.floor(nowSec * 14) % 2 === 0;

  // Pulse wave animation
  if (pulseWaveAnim > 0) {
    pulseWaveAnim = Math.max(0, pulseWaveAnim - 0.045);
    const scale = 1 + (1 - pulseWaveAnim) * TUNING.pulse_radius;
    pulseWave.scale.set(scale, scale, 1);
    pulseWave.material.opacity = pulseWaveAnim * 0.75;
  } else {
    pulseWave.material.opacity = 0;
  }

  // Lanterns
  let nearbyUnlit = null;
  for (const l of sim.lanterns) {
    const vis = lanternVisuals.get(l.id);
    if (!vis) continue;
    vis.group.position.set(l.pos[0], 0, l.pos[2]);
    if (l.lit) {
      vis.coreMat.color.setHex(0xffd27d);
      vis.coreMat.emissive.setHex(0xff9422);
      vis.coreMat.emissiveIntensity = 1.6 + Math.sin(nowSec * 4 + l.pos[0]) * 0.2;
      vis.light.intensity = 4.2;
      vis.safeRing.material.opacity = 0.28 + Math.sin(nowSec * 2) * 0.06;
    } else {
      const ratio = l.deposited / TUNING.lantern_cost;
      vis.coreMat.color.setHex(0x4a4660).lerp(new THREE.Color(0xffb85c), ratio);
      vis.coreMat.emissive.setHex(0x221b38).lerp(new THREE.Color(0xff8c1a), ratio);
      vis.coreMat.emissiveIntensity = 0.3 + ratio * 0.9;
      vis.light.intensity = ratio * 1.5;
      vis.safeRing.material.opacity = 0;

      if (distXZ(sim.player.pos, l.pos) <= TUNING.interact_radius) {
        nearbyUnlit = l;
      }
    }
  }

  // Motes sync
  const activeMoteIds = new Set();
  for (const m of sim.motes) {
    activeMoteIds.add(m.id);
    let mesh = moteVisuals.get(m.id);
    if (!mesh) {
      mesh = createMoteVisual();
      moteVisuals.set(m.id, mesh);
    }
    const bob = 0.75 + Math.sin(nowSec * 3.2 + m.pos[0] + m.pos[2]) * 0.22;
    mesh.position.set(m.pos[0], bob, m.pos[2]);
  }
  for (const [id, mesh] of moteVisuals.entries()) {
    if (!activeMoteIds.has(id)) {
      scene.remove(mesh);
      moteVisuals.delete(id);
    }
  }

  // Shades sync
  const activeShadeIds = new Set();
  for (const s of sim.shades) {
    activeShadeIds.add(s.id);
    let vis = shadeVisuals.get(s.id);
    if (!vis) {
      vis = createShadeVisual();
      shadeVisuals.set(s.id, vis);
    }
    vis.group.position.set(s.pos[0], Math.sin(nowSec * 4 + s.pos[0]) * 0.14, s.pos[2]);
    const dx = sim.player.pos[0] - s.pos[0];
    const dz = sim.player.pos[2] - s.pos[2];
    vis.group.rotation.y = Math.atan2(dx, dz);

    if (s.state === 'stunned') {
      vis.bodyMat.emissive.setHex(0xb49bff);
      vis.stunRing.visible = true;
      vis.stunRing.rotation.z = nowSec * 5;
    } else {
      vis.bodyMat.emissive.setHex(0x4c1478);
      vis.stunRing.visible = false;
    }
  }
  for (const [id, vis] of shadeVisuals.entries()) {
    if (!activeShadeIds.has(id)) {
      scene.remove(vis.group);
      shadeVisuals.delete(id);
    }
  }

  // Camera follow (3rd person)
  const yawRad = (camYawDeg * Math.PI) / 180;
  const camDist = 11.5;
  const camHeight = 6.8;
  const targetCamPos = new THREE.Vector3(
    sim.player.pos[0] - Math.sin(yawRad) * camDist,
    sim.player.pos[1] + camHeight,
    sim.player.pos[2] - Math.cos(yawRad) * camDist
  );
  camera.position.lerp(targetCamPos, 0.12);
  camera.lookAt(sim.player.pos[0], sim.player.pos[1] + 1.2, sim.player.pos[2]);

  // HUD updates
  hudFlames.textContent = `${sim.player.flames}/${TUNING.flames}`;
  hudCarried.textContent = `${sim.player.carried}/${TUNING.carry_capacity}`;
  hudLanterns.textContent = `${litCount}/${TUNING.lantern_count_night1}`;
  hudTime.textContent = formatTime(sim.timeLeftS);
  hudScore.textContent = String(sim.score);

  if (sim.player.pulseCooldown > 0) {
    hudPulse.textContent = `Tỏa sáng (Shift): Hồi ${sim.player.pulseCooldown.toFixed(1)}s`;
  } else if (sim.player.carried < TUNING.pulse_cost) {
    hudPulse.textContent = `Tỏa sáng (Shift): Cần ${TUNING.pulse_cost} ✨`;
  } else {
    hudPulse.textContent = `Tỏa sáng (Shift): Sẵn sàng!`;
  }

  if (nearbyUnlit && sim.state === 'playing') {
    promptBanner.textContent =
      sim.player.carried > 0
        ? `Nhấn E để nạp ✨ vào Đèn ${nearbyUnlit.id} (${nearbyUnlit.deposited}/${TUNING.lantern_cost})`
        : `Đèn ${nearbyUnlit.id} (${nearbyUnlit.deposited}/${TUNING.lantern_cost}) — Hãy gom thêm ✨ đom đóm`;
    promptBanner.classList.add('visible');
  } else {
    promptBanner.classList.remove('visible');
  }
}

resetGame();

let lastTime = performance.now();
let accumulator = 0;

function animate(now) {
  requestAnimationFrame(animate);
  const delta = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (keys.has('KeyQ')) camYawDeg = (camYawDeg + 110 * delta) % 360;
  if (keys.has('KeyR')) camYawDeg = (camYawDeg - 110 * delta + 360) % 360;

  accumulator += delta;
  while (accumulator >= DT) {
    accumulator -= DT;
    if (sim.state === 'playing') {
      let mx = 0;
      let mz = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) mz += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) mz -= 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) mx += 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) mx -= 1;

      const events = sim.step({
        move: [mx, mz],
        cam_yaw_deg: camYawDeg,
        jump: keys.has('Space'),
        interact: keys.has('KeyE') || keys.has('KeyF'),
        pulse: keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyK')
      });
      handleEvents(events);
    }
  }

  syncVisuals(now / 1000);
  renderer.render(scene, camera);
}

requestAnimationFrame(animate);
