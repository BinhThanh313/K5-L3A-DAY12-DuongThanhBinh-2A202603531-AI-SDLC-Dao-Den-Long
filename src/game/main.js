import * as THREE from 'three';
import { DT, PALETTE, TUNING } from '../sim/config.js';
import { GameSimulation, distXZ } from '../sim/engine.js';
import { getMapConfig } from '../sim/maps.js';
import { SoundEffects } from './audio.js';

// Persisted Settings
const SETTINGS_KEY = 'dao-den-long-settings-v1';
function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { volume: 0.7, sensitivity: 0.35, ...JSON.parse(raw) };
  } catch {}
  return { volume: 0.7, sensitivity: 0.35 };
}
function saveSettings(s) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {}
}
const settings = loadSettings();
const sfx = new SoundEffects(settings.volume);

// DOM elements
const container = document.getElementById('app');
const hud = document.getElementById('hud');
const hudNightName = document.getElementById('hud-night-name');
const hudFlames = document.getElementById('hud-flames');
const hudTimer = document.getElementById('hud-timer');
const hudLanterns = document.getElementById('hud-lanterns');
const hudScore = document.getElementById('hud-score');
const hudDash = document.getElementById('hud-dash');
const hudPulse = document.getElementById('hud-pulse');
const hudCharm = document.getElementById('hud-charm');
const promptBanner = document.getElementById('prompt-banner');
const windBanner = document.getElementById('wind-banner');
const moteSlotsEl = document.getElementById('mote-slots');
const offscreenArrow = document.getElementById('offscreen-arrow');

const menuScreen = document.getElementById('menu-screen');
const introScreen = document.getElementById('intro-screen');
const pauseScreen = document.getElementById('pause-screen');
const settingsScreen = document.getElementById('settings-screen');
const resultScreen = document.getElementById('result-screen');

const optVolume = document.getElementById('opt-volume');
const optVolumeVal = document.getElementById('opt-volume-val');
const optSens = document.getElementById('opt-sens');
const optSensVal = document.getElementById('opt-sens-val');

optVolume.value = String(settings.volume);
optVolumeVal.textContent = `${Math.round(settings.volume * 100)}%`;
optSens.value = String(settings.sensitivity);
optSensVal.textContent = settings.sensitivity.toFixed(2);

// Build 10 mote slots in HUD
const moteSlotEls = [];
for (let i = 0; i < TUNING.carry_capacity; i++) {
  const el = document.createElement('div');
  el.className = 'mote-slot';
  moteSlotsEl.appendChild(el);
  moteSlotEls.push(el);
}

// Three.js Scene with standardized Ticket-02 palette
const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.sky);
scene.fog = new THREE.FogExp2(PALETTE.fog, 0.016);

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 260);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.insertBefore(renderer.domElement, container.firstChild);

const ambientLight = new THREE.AmbientLight(0xd9e3ff, 0.15);
scene.add(ambientLight);

const moonLight = new THREE.DirectionalLight(0xb8c8ff, 0.65);
moonLight.position.set(25, 45, 20);
moonLight.castShadow = true;
moonLight.shadow.mapSize.width = 1024;
moonLight.shadow.mapSize.height = 1024;
scene.add(moonLight);

// Cloud sea plane below islands
const cloudSea = new THREE.Mesh(
  new THREE.CircleGeometry(180, 48),
  new THREE.MeshStandardMaterial({ color: PALETTE.cloudSea, roughness: 1, transparent: true, opacity: 0.88 })
);
cloudSea.rotation.x = -Math.PI / 2;
cloudSea.position.y = -10.2;
scene.add(cloudSea);

// Map geometry container
const worldGroup = new THREE.Group();
scene.add(worldGroup);

function buildMapGeometry(night) {
  while (worldGroup.children.length > 0) {
    worldGroup.remove(worldGroup.children[0]);
  }
  const grassMat = new THREE.MeshStandardMaterial({ color: PALETTE.grass, roughness: 0.9 });
  const sandMat = new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 0.92 });
  const woodMat = new THREE.MeshStandardMaterial({ color: PALETTE.wood, roughness: 0.85 });

  const addIslandDisk = (cx, cz, r, yTop, height = 3.0) => {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.92, height, 48), sandMat);
    base.position.set(cx, yTop - height / 2, cz);
    base.receiveShadow = true;
    worldGroup.add(base);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r * 0.9, 0.08, 48), grassMat);
    top.position.set(cx, yTop + 0.02, cz);
    top.receiveShadow = true;
    worldGroup.add(top);
  };

  if (night === 1) {
    addIslandDisk(0, 0, 40, 0, 3.2);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.1, 8), woodMat);
      post.position.set(Math.cos(a) * 39.2, 0.55, Math.sin(a) * 39.2);
      worldGroup.add(post);
    }
  } else if (night === 2) {
    addIslandDisk(0, 0, 28, 0, 3.2);
    addIslandDisk(70, 0, 28, 0, 3.2);
    // Bamboo bridge x in [26, 44], z in [-2, 2]
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(18, 0.35, 4), woodMat);
    bridge.position.set(35, -0.15, 0);
    bridge.receiveShadow = true;
    worldGroup.add(bridge);
  } else if (night === 3) {
    addIslandDisk(0, 0, 45, 0, 3.2);

    // Tier 1: exact solid semicircular ring (r=12..24, z>0, Y=0..3) matching maps.js 100%
    const t1Shape = new THREE.Shape();
    t1Shape.moveTo(24, 0);
    t1Shape.absarc(0, 0, 24, 0, Math.PI, false);
    t1Shape.lineTo(-12, 0);
    t1Shape.absarc(0, 0, 12, Math.PI, 0, true);
    t1Shape.closePath();

    const t1Geo = new THREE.ExtrudeGeometry(t1Shape, { depth: 3.0, bevelEnabled: false, curveSegments: 36 });
    const t1Mesh = new THREE.Mesh(t1Geo, [grassMat, sandMat]);
    t1Mesh.rotation.x = Math.PI / 2;
    t1Mesh.position.y = 3.0;
    t1Mesh.receiveShadow = true;
    t1Mesh.castShadow = true;
    worldGroup.add(t1Mesh);

    // Tier 2: elevated circular deck (r=8, Y=5.3..6.0) with 4 slender support pillars so spawn (0,0,0) is open
    addIslandDisk(0, 0, 8, 6.0, 0.8);
    for (const deg of [45, 135, 225, 315]) {
      const rad = (deg * Math.PI) / 180;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 5.4, 10), woodMat);
      col.position.set(Math.cos(rad) * 7.0, 2.7, Math.sin(rad) * 7.0);
      worldGroup.add(col);
    }

    // Bell Tower (r=2, h=8) on Tier 2 (Y=6..14)
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 8.0, 20), woodMat);
    tower.position.set(0, 10.0, 0);
    worldGroup.add(tower);
    const bellRoof = new THREE.Mesh(
      new THREE.ConeGeometry(2.8, 2.2, 8),
      new THREE.MeshStandardMaterial({ color: PALETTE.gold, emissive: PALETTE.lanternLit, emissiveIntensity: 0.25 })
    );
    bellRoof.position.set(0, 15.0, 0);
    worldGroup.add(bellRoof);

    // 2 Ramps at 30 deg & 150 deg (from r=30 Y=0 to r=24 Y=3, width 3) with exact YXZ rotation + glowing guide rails
    const railMat = new THREE.MeshStandardMaterial({
      color: PALETTE.gold,
      emissive: PALETTE.lanternLit,
      emissiveIntensity: 0.65
    });
    for (const deg of [30, 150]) {
      const rad = (deg * Math.PI) / 180;
      const rampLen = Math.hypot(6, 3);
      const rampGroup = new THREE.Group();
      const midR = 27;
      rampGroup.position.set(Math.cos(rad) * midR, 1.5, Math.sin(rad) * midR);
      rampGroup.rotation.order = 'YXZ';
      rampGroup.rotation.y = -rad;
      rampGroup.rotation.z = -Math.atan2(3, 6);

      const deck = new THREE.Mesh(new THREE.BoxGeometry(rampLen, 0.26, 3.0), woodMat);
      deck.position.y = -0.13;
      deck.receiveShadow = true;
      rampGroup.add(deck);

      for (const side of [-1.45, 1.45]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(rampLen, 0.14, 0.14), railMat);
        rail.position.set(0, 0.25, side);
        rampGroup.add(rail);
      }
      worldGroup.add(rampGroup);
    }
  }

  // Jump pads visuals
  const mapCfg = getMapConfig(night);
  for (const pad of mapCfg.jumpPads) {
    const padMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(pad.radius, pad.radius * 1.1, 0.25, 20),
      new THREE.MeshStandardMaterial({ color: PALETTE.gold, emissive: PALETTE.lanternLit, emissiveIntensity: 0.9 })
    );
    padMesh.position.set(pad.pos[0], pad.pos[1] + 0.12, pad.pos[2]);
    worldGroup.add(padMesh);
  }
}

// Mây mesh using exact palette (#E8E2D0 robe, #C8102E scarf, nón lá + hanging lantern)
function createPlayerMesh() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.ConeGeometry(0.45, 1.15, 14),
    new THREE.MeshStandardMaterial({ color: PALETTE.mayRobe, roughness: 0.75 })
  );
  body.position.y = 0.58;
  body.castShadow = true;
  group.add(body);

  const scarf = new THREE.Mesh(
    new THREE.TorusGeometry(0.24, 0.08, 8, 16),
    new THREE.MeshStandardMaterial({ color: PALETTE.mayScarf, roughness: 0.6 })
  );
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 1.1;
  group.add(scarf);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 14, 12),
    new THREE.MeshStandardMaterial({ color: 0xffe0bd, roughness: 0.7 })
  );
  head.position.y = 1.32;
  group.add(head);

  const hat = new THREE.Mesh(
    new THREE.ConeGeometry(0.68, 0.42, 20),
    new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 0.85 })
  );
  hat.position.y = 1.62;
  group.add(hat);

  const charmPivot = new THREE.Group();
  charmPivot.position.set(0, 1.42, 0.62);
  const miniLantern = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 10, 10),
    new THREE.MeshStandardMaterial({ color: PALETTE.lanternCore, emissive: PALETTE.lanternLit, emissiveIntensity: 1.6 })
  );
  miniLantern.position.y = -0.22;
  charmPivot.add(miniLantern);
  const pLight = new THREE.PointLight(PALETTE.lanternLit, 2.2, 12, 1.6);
  pLight.position.y = -0.22;
  charmPivot.add(pLight);
  group.add(charmPivot);
  group.userData.charmPivot = charmPivot;

  // Forward direction ground chevron so player always sees exact facing/dash direction
  const arrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.45, 3),
    new THREE.MeshBasicMaterial({ color: PALETTE.gold, transparent: true, opacity: 0.75 })
  );
  arrow.rotation.x = Math.PI / 2;
  arrow.position.set(0, 0.08, 0.85);
  group.add(arrow);

  return group;
}

const playerMesh = createPlayerMesh();
scene.add(playerMesh);

const pulseWave = new THREE.Mesh(
  new THREE.RingGeometry(0.5, 1.0, 48),
  new THREE.MeshBasicMaterial({ color: PALETTE.gold, transparent: true, opacity: 0, side: THREE.DoubleSide })
);
pulseWave.rotation.x = -Math.PI / 2;
scene.add(pulseWave);
let pulseWaveAnim = 0;

// Wind leaves particle group for Night 3 wind warning & active gust
const windLeavesGroup = new THREE.Group();
const leafGeo = new THREE.PlaneGeometry(0.28, 0.16);
const leafMat = new THREE.MeshBasicMaterial({
  color: PALETTE.gold,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.85
});
for (let i = 0; i < 45; i++) {
  const leaf = new THREE.Mesh(leafGeo, leafMat);
  leaf.userData = {
    ox: (Math.random() - 0.5) * 26,
    oy: 0.6 + Math.random() * 5.5,
    oz: (Math.random() - 0.5) * 26,
    phase: Math.random() * Math.PI * 2
  };
  windLeavesGroup.add(leaf);
}
windLeavesGroup.visible = false;
scene.add(windLeavesGroup);
let prevWindWarning = false;

// Pools
const lanternVisuals = new Map();
const moteVisuals = new Map();
const shadeVisuals = new Map();
const drifterVisuals = new Map();
const charmVisuals = new Map();

function createLanternVisual(l) {
  const group = new THREE.Group();
  group.position.set(l.pos[0], l.pos[1], l.pos[2]);

  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.28, 2.6, 10),
    new THREE.MeshStandardMaterial({ color: PALETTE.wood, roughness: 0.85 })
  );
  pillar.position.y = 1.3;
  group.add(pillar);

  const coreMat = new THREE.MeshStandardMaterial({
    color: PALETTE.lanternUnlit,
    emissive: 0x1a1e2e,
    emissiveIntensity: 0.3
  });
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.38, 1.05, 8), coreMat);
  core.position.y = 3.0;
  group.add(core);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(0.85, 0.55, 8),
    new THREE.MeshStandardMaterial({ color: PALETTE.wood })
  );
  roof.position.y = 3.75;
  group.add(roof);

  const light = new THREE.PointLight(PALETTE.lanternLit, 0, 18, 1.4);
  light.position.y = 3.1;
  group.add(light);

  const safeRing = new THREE.Mesh(
    new THREE.RingGeometry(TUNING.safe_radius - 0.14, TUNING.safe_radius, 48),
    new THREE.MeshBasicMaterial({ color: PALETTE.lanternLit, transparent: true, opacity: 0, side: THREE.DoubleSide })
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
    new THREE.MeshStandardMaterial({ color: PALETTE.moteCore, emissive: PALETTE.moteHalo, emissiveIntensity: 1.8 })
  );
  scene.add(mesh);
  return mesh;
}

function createShadeVisual() {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: PALETTE.shadeBody,
    emissive: PALETTE.shadeRim,
    emissiveIntensity: 0.65,
    roughness: 0.45,
    metalness: 0.15
  });
  const rimMat = new THREE.MeshBasicMaterial({
    color: PALETTE.shadeRim,
    transparent: true,
    opacity: 0.55
  });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xe6c8ff });

  // Main floating ink body (tapered shadowy cloak + hooded head)
  const coreGroup = new THREE.Group();
  const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.35, 12), bodyMat);
  cloak.position.y = 0.85;
  cloak.rotation.x = Math.PI; // Tapered ink tail pointing down
  cloak.castShadow = true;
  coreGroup.add(cloak);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.48, 14, 12), bodyMat);
  head.position.y = 1.45;
  head.scale.set(1.0, 1.08, 0.95);
  coreGroup.add(head);

  // Twin curved ink wisps / shadow horns
  for (const side of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.58, 7), bodyMat);
    horn.position.set(side * 0.28, 1.92, -0.05);
    horn.rotation.z = -side * 0.38;
    horn.rotation.x = -0.25;
    coreGroup.add(horn);
  }

  // Glowing menacing eyes facing +Z
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), eyeMat);
    eye.scale.set(1.3, 0.7, 0.5);
    eye.position.set(side * 0.19, 1.48, 0.41);
    eye.rotation.z = side * 0.22;
    coreGroup.add(eye);
  }

  // Swirling ink tendrils orbiting base
  const tendrilsGroup = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const tendril = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.65, 6), bodyMat);
    tendril.position.set(Math.cos(angle) * 0.42, 0.52, Math.sin(angle) * 0.42);
    tendril.rotation.x = Math.PI;
    tendril.rotation.z = Math.cos(angle) * 0.3;
    tendrilsGroup.add(tendril);
  }
  coreGroup.add(tendrilsGroup);

  // Eerie violet ground ink aura ring
  const auraRing = new THREE.Mesh(
    new THREE.RingGeometry(0.45, 0.82, 24),
    new THREE.MeshBasicMaterial({
      color: PALETTE.shadeRim,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide
    })
  );
  auraRing.rotation.x = -Math.PI / 2;
  auraRing.position.y = 0.06;
  group.add(auraRing);

  // Orbiting ink rim halo
  const rimRing = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.035, 6, 20), rimMat);
  rimRing.rotation.x = Math.PI / 2.4;
  rimRing.position.y = 1.15;
  coreGroup.add(rimRing);

  // Golden dizzy halo when stunned
  const stunHalo = new THREE.Mesh(
    new THREE.TorusGeometry(0.46, 0.055, 8, 20),
    new THREE.MeshBasicMaterial({ color: PALETTE.gold })
  );
  stunHalo.rotation.x = Math.PI / 2;
  stunHalo.position.y = 2.25;
  stunHalo.visible = false;
  group.add(stunHalo);

  group.add(coreGroup);
  scene.add(group);
  return { group, coreGroup, tendrilsGroup, bodyMat, eyeMat, auraRing, rimRing, stunHalo };
}

function createDrifterVisual() {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.12, 1.7),
    new THREE.MeshStandardMaterial({ color: PALETTE.drifter, emissive: PALETTE.drifter, emissiveIntensity: 0.45 })
  );
  scene.add(mesh);
  return mesh;
}

function createCharmVisual() {
  const group = new THREE.Group();
  const card = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.72, 0.08),
    new THREE.MeshStandardMaterial({ color: PALETTE.mayScarf, emissive: PALETTE.mayScarf, emissiveIntensity: 0.5 })
  );
  const border = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.8, 0.05),
    new THREE.MeshStandardMaterial({ color: PALETTE.gold, emissive: PALETTE.gold, emissiveIntensity: 0.6 })
  );
  group.add(border, card);
  scene.add(group);
  return group;
}

// App State
let appMode = 'menu'; // menu | intro | playing | paused | result
let currentNight = 1;
let totalCampaignScore = 0;
let settingsReturnTo = 'menu';
let sim = null;
let camYawDeg = 0;
let camPitchDeg = 28;
let camDist = 12.0;
const camPivot = new THREE.Vector3(0, 1.2, 0);
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
let lastCountdownSec = -1;
const keys = new Set();
let pauseKeyQueued = false;

function clearDynamicVisuals() {
  for (const v of lanternVisuals.values()) scene.remove(v.group);
  for (const m of moteVisuals.values()) scene.remove(m);
  for (const s of shadeVisuals.values()) scene.remove(s.group);
  for (const d of drifterVisuals.values()) scene.remove(d);
  for (const c of charmVisuals.values()) scene.remove(c);
  lanternVisuals.clear();
  moteVisuals.clear();
  shadeVisuals.clear();
  drifterVisuals.clear();
  charmVisuals.clear();
}

function showOverlay(target) {
  if (target && document.pointerLockElement) {
    document.exitPointerLock?.();
  }
  [menuScreen, introScreen, pauseScreen, settingsScreen, resultScreen].forEach((el) =>
    el.classList.toggle('visible', el === target)
  );
}

function showNightIntro(night) {
  currentNight = night;
  const cfg = getMapConfig(night);
  document.getElementById('intro-title').textContent = cfg.name;
  document.getElementById('intro-quote').textContent = cfg.introQuote;
  appMode = 'intro';
  hud.classList.remove('visible');
  showOverlay(introScreen);
}

function startNight(night) {
  currentNight = night;
  clearDynamicVisuals();
  buildMapGeometry(night);
  sim = new GameSimulation({ seed: Math.floor(Date.now() % 100000), night });
  for (const l of sim.lanterns) {
    lanternVisuals.set(l.id, createLanternVisual(l));
  }
  hudNightName.textContent = sim.map.name.toUpperCase();
  camYawDeg = 0;
  camPitchDeg = 28;
  camDist = 12.0;
  camPivot.set(sim.player.pos[0], sim.player.pos[1] + 1.2, sim.player.pos[2]);
  lastCountdownSec = -1;
  pulseWaveAnim = 0;
  appMode = 'playing';
  showOverlay(null);
  hud.classList.add('visible');
  sfx.startAmbience();
}

// Menu & Button Bindings
document.getElementById('btn-play-campaign').onclick = () => {
  totalCampaignScore = 0;
  showNightIntro(1);
};
document.querySelectorAll('[data-night]').forEach((btn) => {
  btn.onclick = () => {
    totalCampaignScore = 0;
    showNightIntro(Number(btn.dataset.night));
  };
});
document.getElementById('btn-start-night').onclick = () => startNight(currentNight);
document.getElementById('btn-resume').onclick = () => {
  pauseKeyQueued = true;
};
document.getElementById('btn-retry-pause').onclick = () => startNight(currentNight);
document.getElementById('btn-menu-pause').onclick = () => {
  appMode = 'menu';
  hud.classList.remove('visible');
  showOverlay(menuScreen);
};
document.getElementById('btn-open-settings').onclick = () => {
  settingsReturnTo = 'menu';
  showOverlay(settingsScreen);
};
document.getElementById('btn-settings-pause').onclick = () => {
  settingsReturnTo = 'paused';
  showOverlay(settingsScreen);
};
document.getElementById('btn-close-settings').onclick = () => {
  saveSettings(settings);
  showOverlay(settingsReturnTo === 'paused' ? pauseScreen : menuScreen);
};
optVolume.oninput = () => {
  settings.volume = Number(optVolume.value);
  optVolumeVal.textContent = `${Math.round(settings.volume * 100)}%`;
  sfx.setVolume(settings.volume);
};
optSens.oninput = () => {
  settings.sensitivity = Number(optSens.value);
  optSensVal.textContent = settings.sensitivity.toFixed(2);
};
document.getElementById('btn-next-night').onclick = () => showNightIntro(currentNight + 1);
document.getElementById('btn-retry-night').onclick = () => startNight(currentNight);
document.getElementById('btn-result-menu').onclick = () => {
  appMode = 'menu';
  hud.classList.remove('visible');
  showOverlay(menuScreen);
};

// Input listeners
window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'KeyM') sfx.toggleMute();
  if ((e.code === 'Escape' || e.code === 'KeyP') && (appMode === 'playing' || appMode === 'paused')) {
    pauseKeyQueued = true;
  }
  if (e.code === 'Enter' && appMode === 'intro') {
    startNight(currentNight);
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
renderer.domElement.addEventListener('mousedown', (e) => {
  if (appMode !== 'playing') return;
  if (e.button === 0 || e.button === 2) {
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  }
});
renderer.domElement.addEventListener('dblclick', () => {
  if (appMode === 'playing' && document.pointerLockElement !== renderer.domElement) {
    renderer.domElement.requestPointerLock?.();
  }
});
window.addEventListener('mouseup', () => { isDragging = false; });
window.addEventListener('blur', () => { isDragging = false; });
window.addEventListener('mousemove', (e) => {
  if (appMode !== 'playing') return;
  const locked = document.pointerLockElement === renderer.domElement;
  if (!locked && !isDragging) return;
  const dx = locked ? e.movementX : e.clientX - lastMouseX;
  const dy = locked ? e.movementY : e.clientY - lastMouseY;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
  camYawDeg = (((camYawDeg - dx * settings.sensitivity) % 360) + 360) % 360;
  camPitchDeg = Math.max(12, Math.min(65, camPitchDeg + dy * settings.sensitivity * 0.65));
});
renderer.domElement.addEventListener(
  'wheel',
  (e) => {
    if (appMode !== 'playing') return;
    camDist = Math.max(7.5, Math.min(18.0, camDist + e.deltaY * 0.008));
  },
  { passive: true }
);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function formatTime(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function handleEvents(events) {
  for (const ev of events) {
    switch (ev.name) {
      case 'paused':
        appMode = 'paused';
        showOverlay(pauseScreen);
        break;
      case 'resumed':
        appMode = 'playing';
        showOverlay(null);
        break;
      case 'mote_picked':
        sfx.playMotePickup(ev.data.carried);
        break;
      case 'charm_picked':
        sfx.playCharmPickup();
        break;
      case 'deposit':
        sfx.playDeposit();
        break;
      case 'lantern_lit':
        sfx.playLanternLit();
        break;
      case 'dash':
        sfx.playDash();
        break;
      case 'pulse':
        sfx.playPulse();
        pulseWaveAnim = 1.0;
        pulseWave.position.set(sim.player.pos[0], sim.player.pos[1] + 0.2, sim.player.pos[2]);
        break;
      case 'player_hit':
        sfx.playHit();
        break;
      case 'shade_spawned':
        sfx.playShadeSpawn();
        break;
      case 'game_over': {
        appMode = 'result';
        const nextBtn = document.getElementById('btn-next-night');
        const titleEl = document.getElementById('result-title');
        const reasonEl = document.getElementById('result-reason');
        const scoreEl = document.getElementById('result-score');
        if (ev.data.result === 'won') {
          sfx.playWin();
          totalCampaignScore += sim.score;
          if (currentNight < 3) {
            titleEl.textContent = `${sim.map.name} — Hoàn Thành!`;
            reasonEl.textContent = 'Toàn bộ Đèn Lồng Lớn đã bừng sáng. Sẵn sàng cho hòn đảo tiếp theo!';
            scoreEl.textContent = `Điểm Đêm ${currentNight}: ${sim.score} · Tổng: ${totalCampaignScore}`;
            nextBtn.style.display = 'inline-block';
          } else {
            titleEl.textContent = 'Bình Minh Trên Ba Hòn Đảo!';
            reasonEl.textContent = 'Mây đã xua tan sương đen qua cả 3 Đêm. Bình minh ấm áp trở về với biển mây!';
            scoreEl.textContent = `Tổng điểm chiến dịch: ${totalCampaignScore}`;
            nextBtn.style.display = 'none';
          }
        } else {
          sfx.playLose();
          titleEl.textContent = 'Sương Đen Bao Phủ...';
          reasonEl.textContent =
            ev.data.reason === 'dawn'
              ? 'Hết giờ trước khi toàn bộ Đèn Lồng kịp thắp sáng.'
              : 'Mây đã mất hết Ngọn Lửa.';
          scoreEl.textContent = `${sim.score} điểm`;
          nextBtn.style.display = 'none';
        }
        showOverlay(resultScreen);
        break;
      }
    }
  }
}

function updateOffscreenArrow() {
  let nearest = null;
  let bestD = Infinity;
  for (const l of sim.lanterns) {
    if (l.lit) continue;
    const d = distXZ(sim.player.pos, l.pos);
    if (d < bestD) {
      bestD = d;
      nearest = l;
    }
  }
  if (!nearest || appMode !== 'playing') {
    offscreenArrow.style.display = 'none';
    return;
  }
  const p = new THREE.Vector3(nearest.pos[0], nearest.pos[1] + 2.5, nearest.pos[2]);
  p.project(camera);
  const inFront = p.z < 1;
  const onScreen = inFront && Math.abs(p.x) <= 0.92 && Math.abs(p.y) <= 0.88;
  if (onScreen) {
    offscreenArrow.style.display = 'none';
    return;
  }
  let x = inFront ? p.x : -p.x;
  let y = inFront ? p.y : -p.y;
  const angle = Math.atan2(y, x);
  const clampedX = Math.max(-0.88, Math.min(0.88, Math.cos(angle) * 0.92));
  const clampedY = Math.max(-0.82, Math.min(0.82, Math.sin(angle) * 0.85));
  const sx = (clampedX * 0.5 + 0.5) * window.innerWidth;
  const sy = (-clampedY * 0.5 + 0.5) * window.innerHeight;
  offscreenArrow.style.display = 'flex';
  offscreenArrow.style.left = `${sx - 17}px`;
  offscreenArrow.style.top = `${sy - 17}px`;
  offscreenArrow.style.transform = `rotate(${-angle}rad)`;
}

function syncVisuals(nowSec) {
  if (!sim) return;

  const litCount = sim.lanterns.filter((l) => l.lit).length;
  ambientLight.intensity = 0.15 + 0.55 * (litCount / sim.lanterns.length);

  // Player
  playerMesh.position.set(sim.player.pos[0], sim.player.pos[1], sim.player.pos[2]);
  playerMesh.rotation.y = sim.player.facingYaw;
  playerMesh.userData.charmPivot.rotation.z = Math.sin(nowSec * 3.5) * 0.12;
  playerMesh.visible =
    sim.player.fallRespawnTicks === 0 &&
    (sim.player.invulnTicks === 0 || Math.floor(nowSec * 14) % 2 === 0);

  // Pulse wave
  if (pulseWaveAnim > 0) {
    pulseWaveAnim = Math.max(0, pulseWaveAnim - 0.05);
    const s = 1 + (1 - pulseWaveAnim) * TUNING.pulse_radius;
    pulseWave.scale.set(s, s, 1);
    pulseWave.material.opacity = pulseWaveAnim * 0.75;
  } else {
    pulseWave.material.opacity = 0;
  }

  // Lanterns
  let nearbyUnlit = null;
  for (const l of sim.lanterns) {
    const vis = lanternVisuals.get(l.id);
    if (!vis) continue;
    if (l.lit) {
      vis.coreMat.color.setHex(PALETTE.lanternCore);
      vis.coreMat.emissive.setHex(PALETTE.lanternLit);
      vis.coreMat.emissiveIntensity = 1.6;
      vis.light.intensity = 4.2;
      vis.safeRing.material.opacity = 0.28;
    } else {
      const ratio = l.deposited / TUNING.lantern_cost;
      vis.coreMat.color.setHex(PALETTE.lanternUnlit).lerp(new THREE.Color(PALETTE.lanternLit), ratio);
      vis.coreMat.emissiveIntensity = 0.3 + ratio * 0.9;
      vis.light.intensity = ratio * 1.4;
      vis.safeRing.material.opacity = 0;
      if (distXZ(sim.player.pos, l.pos) <= TUNING.interact_radius) {
        nearbyUnlit = l;
      }
    }
  }

  // Motes
  const mIds = new Set();
  for (const m of sim.motes) {
    mIds.add(m.id);
    let mesh = moteVisuals.get(m.id);
    if (!mesh) {
      mesh = createMoteVisual();
      moteVisuals.set(m.id, mesh);
    }
    mesh.position.set(m.pos[0], m.pos[1] + 0.7 + Math.sin(nowSec * 3.5 + m.pos[0]) * 0.2, m.pos[2]);
  }
  for (const [id, mesh] of moteVisuals) {
    if (!mIds.has(id)) { scene.remove(mesh); moteVisuals.delete(id); }
  }

  // Shades (detailed state-driven animations)
  const sIds = new Set();
  for (const s of sim.shades) {
    sIds.add(s.id);
    let vis = shadeVisuals.get(s.id);
    if (!vis) {
      vis = createShadeVisual();
      shadeVisuals.set(s.id, vis);
    }
    vis.group.position.set(s.pos[0], s.pos[1], s.pos[2]);

    // Face toward Mây
    const dx = sim.player.pos[0] - s.pos[0];
    const dz = sim.player.pos[2] - s.pos[2];
    vis.group.rotation.y = Math.atan2(dx, dz);

    const phase = nowSec * 4 + s.pos[0] * 0.5;
    vis.coreGroup.position.y = Math.sin(phase) * 0.14;
    vis.rimRing.rotation.z = nowSec * 2.2;

    if (s.state === 'spawning') {
      vis.group.scale.setScalar(0.55 + Math.abs(Math.sin(nowSec * 6)) * 0.4);
      vis.bodyMat.color.setHex(PALETTE.shadeBody);
      vis.bodyMat.emissiveIntensity = 1.1;
      vis.eyeMat.color.setHex(0xb88cff);
      vis.coreGroup.rotation.x = 0;
      vis.tendrilsGroup.rotation.y = nowSec * 6;
      vis.stunHalo.visible = false;
    } else if (s.state === 'stunned') {
      vis.group.scale.setScalar(1);
      vis.bodyMat.color.setHex(PALETTE.shadeStunned);
      vis.bodyMat.emissiveIntensity = 0.25;
      vis.eyeMat.color.setHex(0x88849e);
      vis.coreGroup.rotation.x = 0;
      vis.coreGroup.rotation.z = Math.sin(nowSec * 14) * 0.18;
      vis.tendrilsGroup.rotation.y = nowSec * 0.8;
      vis.stunHalo.visible = true;
      vis.stunHalo.rotation.z = nowSec * 5;
    } else if (s.state === 'chase') {
      vis.group.scale.setScalar(1.06);
      vis.bodyMat.color.setHex(PALETTE.shadeBody);
      vis.bodyMat.emissiveIntensity = 0.95;
      vis.eyeMat.color.setHex(0xffffff);
      vis.coreGroup.rotation.x = 0.22; // Lean forward aggressively
      vis.coreGroup.rotation.z = 0;
      vis.tendrilsGroup.rotation.y = nowSec * 4.5;
      vis.stunHalo.visible = false;
    } else if (s.state === 'recoil') {
      vis.group.scale.setScalar(0.95);
      vis.bodyMat.color.setHex(PALETTE.shadeBody);
      vis.bodyMat.emissiveIntensity = 0.5;
      vis.eyeMat.color.setHex(0xd2a8ff);
      vis.coreGroup.rotation.x = -0.25; // Lean back on recoil
      vis.coreGroup.rotation.z = 0;
      vis.tendrilsGroup.rotation.y = nowSec * 2;
      vis.stunHalo.visible = false;
    } else {
      // wander
      vis.group.scale.setScalar(1);
      vis.bodyMat.color.setHex(PALETTE.shadeBody);
      vis.bodyMat.emissiveIntensity = 0.6;
      vis.eyeMat.color.setHex(0xe6c8ff);
      vis.coreGroup.rotation.x = 0.06;
      vis.coreGroup.rotation.z = Math.sin(phase * 0.5) * 0.06;
      vis.tendrilsGroup.rotation.y = nowSec * 1.8;
      vis.stunHalo.visible = false;
    }
  }
  for (const [id, vis] of shadeVisuals) {
    if (!sIds.has(id)) { scene.remove(vis.group); shadeVisuals.delete(id); }
  }

  // Drifters
  const dIds = new Set();
  for (const d of sim.drifters) {
    if (d.state === 'removed') continue;
    dIds.add(d.id);
    let mesh = drifterVisuals.get(d.id);
    if (!mesh) {
      mesh = createDrifterVisual();
      drifterVisuals.set(d.id, mesh);
    }
    mesh.position.set(d.pos[0], d.pos[1] + Math.sin(nowSec * 5) * 0.25, d.pos[2]);
    mesh.rotation.y = nowSec * 2.5;
  }
  for (const [id, mesh] of drifterVisuals) {
    if (!dIds.has(id)) { scene.remove(mesh); drifterVisuals.delete(id); }
  }

  // Charms
  const cIds = new Set();
  for (const c of sim.charms) {
    cIds.add(c.id);
    let mesh = charmVisuals.get(c.id);
    if (!mesh) {
      mesh = createCharmVisual();
      charmVisuals.set(c.id, mesh);
    }
    mesh.visible = c.available;
    mesh.position.set(c.pos[0], c.pos[1] + 0.9 + Math.sin(nowSec * 3) * 0.15, c.pos[2]);
    mesh.rotation.y = nowSec * 1.8;
  }
  for (const [id, mesh] of charmVisuals) {
    if (!cIds.has(id)) { scene.remove(mesh); charmVisuals.delete(id); }
  }

  // Spherical orbit camera follow (never clips through Mây on fast turns)
  const desiredPivot = new THREE.Vector3(sim.player.pos[0], sim.player.pos[1] + 1.2, sim.player.pos[2]);
  camPivot.lerp(desiredPivot, 0.25);
  const yawRad = (camYawDeg * Math.PI) / 180;
  const pitchRad = (camPitchDeg * Math.PI) / 180;
  const horizDist = camDist * Math.cos(pitchRad);
  const vertDist = camDist * Math.sin(pitchRad);
  camera.position.set(
    camPivot.x - Math.sin(yawRad) * horizDist,
    camPivot.y + vertDist,
    camPivot.z - Math.cos(yawRad) * horizDist
  );
  camera.lookAt(camPivot);

  // HUD
  hudFlames.textContent = '🔥'.repeat(sim.player.flames) + '🖤'.repeat(Math.max(0, TUNING.flames - sim.player.flames));
  hudTimer.textContent = formatTime(sim.timeLeftS);
  hudTimer.classList.toggle('danger', sim.timeLeftS <= 30);
  hudLanterns.textContent = `${litCount}/${sim.lanterns.length}`;
  hudScore.textContent = String(sim.score);

  for (let i = 0; i < moteSlotEls.length; i++) {
    moteSlotEls[i].classList.toggle('filled', i < sim.player.carried);
  }

  if (sim.player.charmTicks > 0) {
    hudCharm.style.display = 'block';
    hudCharm.textContent = `Bùa Gió: ${(sim.player.charmTicks / 60).toFixed(1)}s`;
  } else {
    hudCharm.style.display = 'none';
  }

  const dashReady = sim.player.charmTicks > 0 || sim.player.dashCdTicks === 0;
  hudDash.className = `ability-card ${dashReady ? 'ready' : 'cd'}`;
  hudDash.innerHTML = dashReady
    ? 'Lướt (C)<br/><b>Sẵn sàng</b>'
    : `Lướt (C)<br/><b>${(sim.player.dashCdTicks / 60).toFixed(1)}s</b>`;

  const pulseReady = sim.player.pulseCdTicks === 0 && sim.player.carried >= TUNING.pulse_cost;
  hudPulse.className = `ability-card ${pulseReady ? 'ready' : 'cd'}`;
  hudPulse.innerHTML =
    sim.player.pulseCdTicks > 0
      ? `Tỏa Sáng (Shift)<br/><b>${(sim.player.pulseCdTicks / 60).toFixed(1)}s</b>`
      : sim.player.carried < TUNING.pulse_cost
        ? `Tỏa Sáng (Shift)<br/><b>Cần ${TUNING.pulse_cost} ✨</b>`
        : 'Tỏa Sáng (Shift)<br/><b>Sẵn sàng</b>';

  if (nearbyUnlit && appMode === 'playing') {
    promptBanner.textContent = `E — Nạp ánh sáng (${nearbyUnlit.deposited}/${TUNING.lantern_cost})`;
    promptBanner.classList.add('visible');
  } else {
    promptBanner.classList.remove('visible');
  }

  if (sim.wind.warning && !prevWindWarning) {
    sfx.playWindWarning();
  }
  prevWindWarning = sim.wind.warning;

  if (sim.wind.warning || sim.wind.active) {
    windLeavesGroup.visible = true;
    const wRad = (sim.wind.dirDeg * Math.PI) / 180;
    const wx = Math.cos(wRad);
    const wz = Math.sin(wRad);
    const speed = sim.wind.active ? 14 : 6;
    for (const leaf of windLeavesGroup.children) {
      const u = leaf.userData;
      const drift = (nowSec * speed + u.phase * 4) % 26 - 13;
      leaf.position.set(
        sim.player.pos[0] + u.ox + wx * drift,
        sim.player.pos[1] + u.oy + Math.sin(nowSec * 4 + u.phase) * 0.4,
        sim.player.pos[2] + u.oz + wz * drift
      );
      leaf.rotation.set(nowSec * 3 + u.phase, nowSec * 2, u.phase);
    }
  } else {
    windLeavesGroup.visible = false;
  }

  if (sim.wind.warning) {
    windBanner.textContent = '🍃 Gió mạnh sắp nổi...';
    windBanner.classList.add('visible');
  } else if (sim.wind.active) {
    windBanner.textContent = `💨 Gió mạnh đang thổi (${sim.wind.dirDeg}°)`;
    windBanner.classList.add('visible');
  } else {
    windBanner.classList.remove('visible');
  }

  // Last 10s countdown tick SFX
  if (appMode === 'playing' && sim.timeLeftS > 0 && sim.timeLeftS <= 10) {
    const sec = Math.ceil(sim.timeLeftS);
    if (sec !== lastCountdownSec) {
      lastCountdownSec = sec;
      sfx.playCountdownTick();
    }
  }

  updateOffscreenArrow();
}

let lastTime = performance.now();
let accumulator = 0;
let prevJump = false;

function animate(now) {
  requestAnimationFrame(animate);
  const delta = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (appMode === 'playing') {
    if (keys.has('KeyQ')) camYawDeg = (camYawDeg + 110 * delta) % 360;
    if (keys.has('KeyR')) camYawDeg = (camYawDeg - 110 * delta + 360) % 360;
  }

  accumulator += delta;
  while (accumulator >= DT) {
    accumulator -= DT;
    if (sim && (appMode === 'playing' || appMode === 'paused')) {
      let mx = 0;
      let mz = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) mz += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) mz -= 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) mx += 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) mx -= 1;

      const jumpNow = keys.has('Space');
      if (jumpNow && !prevJump && appMode === 'playing' && sim.player.grounded) {
        sfx.playJump();
      }
      prevJump = jumpNow;

      const pauseNow = pauseKeyQueued;
      pauseKeyQueued = false;

      const events = sim.step({
        move: [mx, mz],
        cam_yaw_deg: camYawDeg,
        jump: jumpNow,
        interact: keys.has('KeyE') || keys.has('KeyF'),
        pulse: keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyK'),
        dash: keys.has('KeyC') || keys.has('ControlLeft'),
        pause: pauseNow
      });
      handleEvents(events);
    }
  }

  syncVisuals(now / 1000);
  renderer.render(scene, camera);
}

requestAnimationFrame(animate);
