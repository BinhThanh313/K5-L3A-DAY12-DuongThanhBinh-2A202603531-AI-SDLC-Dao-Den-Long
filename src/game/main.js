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

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 280);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
container.insertBefore(renderer.domElement, container.firstChild);

const ambientLight = new THREE.AmbientLight(0xd9e3ff, 0.15);
scene.add(ambientLight);

// Hemisphere light gives true 3D top-vs-side shading on every mesh
const hemiLight = new THREE.HemisphereLight(0x748ce0, 0x0b1024, 0.55);
scene.add(hemiLight);

const moonLight = new THREE.DirectionalLight(0xc8d6ff, 0.95);
moonLight.position.set(38, 62, -28);
moonLight.castShadow = true;
moonLight.shadow.mapSize.width = 2048;
moonLight.shadow.mapSize.height = 2048;
moonLight.shadow.camera.near = 5;
moonLight.shadow.camera.far = 180;
moonLight.shadow.camera.left = -65;
moonLight.shadow.camera.right = 105;
moonLight.shadow.camera.top = 65;
moonLight.shadow.camera.bottom = -65;
moonLight.shadow.bias = -0.0005;
scene.add(moonLight);

// 3D Starfield dome & glowing 3D Moon
const starGeo = new THREE.BufferGeometry();
const starPts = [];
for (let i = 0; i < 320; i++) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.random() * Math.PI * 0.44;
  const r = 145;
  starPts.push(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi) + 12, r * Math.sin(phi) * Math.sin(theta));
}
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPts, 3));
scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: PALETTE.moteCore, size: 0.75 })));

const moonMesh = new THREE.Mesh(
  new THREE.SphereGeometry(5.5, 24, 24),
  new THREE.MeshBasicMaterial({ color: PALETTE.lanternCore })
);
moonMesh.position.set(65, 78, -55);
scene.add(moonMesh);

// Cloud sea plane + 3D volumetric rolling cloud clusters below islands
const cloudSea = new THREE.Mesh(
  new THREE.CircleGeometry(210, 48),
  new THREE.MeshStandardMaterial({ color: PALETTE.cloudSea, roughness: 1, transparent: true, opacity: 0.9 })
);
cloudSea.rotation.x = -Math.PI / 2;
cloudSea.position.y = -10.2;
scene.add(cloudSea);

const cloudPuffMat = new THREE.MeshStandardMaterial({
  color: PALETTE.cloudSea,
  roughness: 0.95,
  transparent: true,
  opacity: 0.78
});
for (let i = 0; i < 42; i++) {
  const a = (i / 42) * Math.PI * 2;
  const dist = 50 + (i % 5) * 14;
  const puff = new THREE.Mesh(new THREE.SphereGeometry(5.5 + (i % 4) * 2.2, 12, 10), cloudPuffMat);
  puff.scale.set(1.7, 0.48, 1.25);
  puff.position.set(15 + Math.cos(a) * dist, -6.2 - (i % 3) * 1.3, Math.sin(a) * dist);
  scene.add(puff);
}

// Map geometry container
const worldGroup = new THREE.Group();
scene.add(worldGroup);

function buildMapGeometry(night) {
  while (worldGroup.children.length > 0) {
    worldGroup.remove(worldGroup.children[0]);
  }
  const grassMat = new THREE.MeshStandardMaterial({ color: PALETTE.grass, roughness: 0.86 });
  const sandMat = new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 0.9 });
  const woodMat = new THREE.MeshStandardMaterial({ color: PALETTE.wood, roughness: 0.82 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x454b66, roughness: 0.85 });

  // Multi-layered 3D island disk with cliff strata, sandy rim, grassy terrain & 3D stone paths
  const addIslandDisk = (cx, cz, r, yTop, height = 4.2) => {
    const underCliff = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.88, r * 0.62, height * 1.1, 32),
      stoneMat
    );
    underCliff.position.set(cx, yTop - height * 1.35, cz);
    worldGroup.add(underCliff);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.88, height, 48), sandMat);
    base.position.set(cx, yTop - height / 2, cz);
    base.receiveShadow = true;
    base.castShadow = true;
    worldGroup.add(base);

    const top = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.91, r * 0.93, 0.16, 48), grassMat);
    top.position.set(cx, yTop - 0.04, cz);
    top.receiveShadow = true;
    worldGroup.add(top);

    // 3D Stone plaza & concentric cobblestone rings for strong 3D ground depth perception
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.1, 0.08, 16), stoneMat);
    plaza.position.set(cx, yTop + 0.03, cz);
    plaza.receiveShadow = true;
    worldGroup.add(plaza);

    if (r >= 20) {
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const tile = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.07, 0.9), stoneMat);
        tile.position.set(cx + Math.cos(a) * (r * 0.55), yTop + 0.03, cz + Math.sin(a) * (r * 0.55));
        tile.rotation.y = -a;
        tile.receiveShadow = true;
        worldGroup.add(tile);
      }
    }
  };

  // Helper: 3D stylized coastal tree / Areca palm (purely decorative at island rim)
  const addArecaPalm = (x, y, z, scale = 1) => {
    const tree = new THREE.Group();
    tree.position.set(x, y, z);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * scale, 0.22 * scale, 4.2 * scale, 8), woodMat);
    trunk.position.y = 2.1 * scale;
    trunk.castShadow = true;
    tree.add(trunk);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.45 * scale, 1.8 * scale, 5), grassMat);
      frond.position.set(Math.cos(a) * 0.7 * scale, 4.1 * scale, Math.sin(a) * 0.7 * scale);
      frond.rotation.z = -Math.cos(a) * 1.1;
      frond.rotation.x = Math.sin(a) * 1.1;
      frond.castShadow = true;
      tree.add(frond);
    }
    worldGroup.add(tree);
  };

  const addRockCluster = (x, y, z, s = 1) => {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.75 * s, 0), stoneMat);
    rock.scale.set(1.2, 0.75, 1.0);
    rock.position.set(x, y + 0.35 * s, z);
    rock.castShadow = true;
    rock.receiveShadow = true;
    worldGroup.add(rock);
  };

  if (night === 1) {
    addIslandDisk(0, 0, 40, 0, 4.2);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 1.25, 8), woodMat);
      post.position.set(Math.cos(a) * 39.1, 0.62, Math.sin(a) * 39.1);
      post.castShadow = true;
      worldGroup.add(post);
      if (i % 3 === 0) {
        addRockCluster(Math.cos(a + 0.1) * 37.8, 0, Math.sin(a + 0.1) * 37.8, 0.9);
      }
      if (i % 4 === 1) {
        addArecaPalm(Math.cos(a) * 36.5, 0, Math.sin(a) * 36.5, 0.85);
      }
    }
  } else if (night === 2) {
    addIslandDisk(0, 0, 28, 0, 4.2);
    addIslandDisk(70, 0, 28, 0, 4.2);
    for (const cx of [0, 70]) {
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + 0.2;
        if (Math.abs(Math.sin(a)) < 0.25) continue; // keep bridge approach clear
        addArecaPalm(cx + Math.cos(a) * 25.2, 0, Math.sin(a) * 25.2, 1.05);
      }
    }
    // 3D Segmented Bamboo bridge x in [26, 44], z in [-2, 2]
    const bridgeBeamL = new THREE.Mesh(new THREE.BoxGeometry(18, 0.28, 0.28), woodMat);
    bridgeBeamL.position.set(35, -0.14, -1.85);
    const bridgeBeamR = bridgeBeamL.clone();
    bridgeBeamR.position.z = 1.85;
    worldGroup.add(bridgeBeamL, bridgeBeamR);
    for (let bx = 26.5; bx <= 43.5; bx += 0.9) {
      const plank = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 3.95, 8), woodMat);
      plank.rotation.x = Math.PI / 2;
      plank.position.set(bx, -0.06, 0);
      plank.receiveShadow = true;
      plank.castShadow = true;
      worldGroup.add(plank);
    }
  } else if (night === 3) {
    addIslandDisk(0, 0, 45, 0, 4.2);

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

    // 3D Stone parapet bollards along Tier 1 rim so cliff edge is unmistakably 3D
    for (let deg = 10; deg <= 170; deg += 20) {
      if (Math.abs(deg - 30) < 12 || Math.abs(deg - 150) < 12) continue;
      const rad = (deg * Math.PI) / 180;
      const bollard = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.55, 0.45), stoneMat);
      bollard.position.set(Math.cos(rad) * 23.6, 3.27, Math.sin(rad) * 23.6);
      bollard.castShadow = true;
      worldGroup.add(bollard);
    }

    // Tier 2: solid central cliff cylinder (r=8, Y=0..6), spawn is at (0, 0, -15)
    addIslandDisk(0, 0, 8, 6.0, 6.0);

    // Ornate 3D Multi-Tiered Pagoda Bell Tower (r=2, h=8) on Tier 2 (Y=6..14)
    const towerBase = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.25, 1.2, 12), stoneMat);
    towerBase.position.set(0, 6.6, 0);
    towerBase.castShadow = true;
    worldGroup.add(towerBase);

    const towerCore = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.75, 6.8, 12), woodMat);
    towerCore.position.set(0, 10.4, 0);
    towerCore.castShadow = true;
    worldGroup.add(towerCore);

    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 7.0, 8), woodMat);
      col.position.set(Math.cos(a) * 1.85, 10.5, Math.sin(a) * 1.85);
      col.castShadow = true;
      worldGroup.add(col);
    }

    const roofMat = new THREE.MeshStandardMaterial({
      color: PALETTE.gold,
      emissive: PALETTE.lanternLit,
      emissiveIntensity: 0.25,
      roughness: 0.4
    });
    const lowerEave = new THREE.Mesh(new THREE.ConeGeometry(3.1, 1.2, 8), roofMat);
    lowerEave.position.set(0, 11.2, 0);
    lowerEave.castShadow = true;
    const upperRoof = new THREE.Mesh(new THREE.ConeGeometry(2.7, 2.1, 8), roofMat);
    upperRoof.position.set(0, 14.6, 0);
    upperRoof.castShadow = true;
    worldGroup.add(lowerEave, upperRoof);

    // 2 Ramps at 30 deg & 150 deg with 3D stepped planks & glowing handrails
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

      const deck = new THREE.Mesh(new THREE.BoxGeometry(rampLen, 0.32, 3.0), woodMat);
      deck.position.y = -0.16;
      deck.receiveShadow = true;
      deck.castShadow = true;
      rampGroup.add(deck);

      for (const side of [-1.42, 1.42]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(rampLen, 0.16, 0.16), railMat);
        rail.position.set(0, 0.38, side);
        rampGroup.add(rail);
        for (const px of [-2.6, 0, 2.6]) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.45, 0.16), woodMat);
          post.position.set(px, 0.18, side);
          rampGroup.add(post);
        }
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

  const scarfMat = new THREE.MeshStandardMaterial({
    color: PALETTE.mayScarf,
    emissive: PALETTE.mayScarf,
    emissiveIntensity: 0,
    roughness: 0.5
  });
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.08, 8, 16), scarfMat);
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 1.1;
  group.add(scarf);
  group.userData.scarfMat = scarfMat;

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

  // Animated feet under Mây's robe
  const footMat = new THREE.MeshStandardMaterial({ color: PALETTE.wood, roughness: 0.8 });
  const leftFoot = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), footMat);
  leftFoot.scale.set(0.85, 0.65, 1.35);
  leftFoot.position.set(-0.15, 0.08, 0);
  const rightFoot = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), footMat);
  rightFoot.scale.set(0.85, 0.65, 1.35);
  rightFoot.position.set(0.15, 0.08, 0);
  group.add(leftFoot, rightFoot);

  // Sleek foot-level wind-wake crescent & ankle wind currents when gliding/boosted
  const footGlideGroup = new THREE.Group();
  const wakeArc = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.68, 24, 1, -Math.PI * 0.85, Math.PI * 0.7),
    new THREE.MeshBasicMaterial({
      color: PALETTE.gold,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    })
  );
  wakeArc.rotation.x = -Math.PI / 2;
  wakeArc.position.set(0, 0.07, 0.15);
  footGlideGroup.add(wakeArc);

  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(
      new THREE.ConeGeometry(0.08, 0.95, 6),
      new THREE.MeshBasicMaterial({
        color: PALETTE.mayScarf,
        transparent: true,
        opacity: 0.75
      })
    );
    wing.rotation.x = -Math.PI / 2;
    wing.rotation.z = side * 0.25;
    wing.position.set(side * 0.34, 0.14, -0.35);
    footGlideGroup.add(wing);
  }
  footGlideGroup.visible = false;
  group.add(footGlideGroup);

  group.userData.leftFoot = leftFoot;
  group.userData.rightFoot = rightFoot;
  group.userData.footGlideGroup = footGlideGroup;
  group.userData.wakeArc = wakeArc;

  return group;
}

const playerMesh = createPlayerMesh();
scene.add(playerMesh);

// World-space footstep wind-ripples & gliding dust puffs left behind at Mây's feet
const footRipplePool = [];
for (let i = 0; i < 28; i++) {
  const rippleGroup = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.18, 0.36, 20),
    new THREE.MeshBasicMaterial({
      color: i % 2 === 0 ? PALETTE.gold : 0xffffff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide
    })
  );
  ring.rotation.x = -Math.PI / 2;
  rippleGroup.add(ring);

  const puffL = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 8),
    new THREE.MeshBasicMaterial({
      color: i % 3 === 0 ? PALETTE.mayScarf : PALETTE.moteCore,
      transparent: true,
      opacity: 0
    })
  );
  puffL.position.set(-0.22, 0.08, 0);
  const puffR = puffL.clone();
  puffR.position.set(0.22, 0.08, 0);
  rippleGroup.add(puffL, puffR);

  rippleGroup.visible = false;
  scene.add(rippleGroup);
  footRipplePool.push({
    group: rippleGroup,
    ringMat: ring.material,
    puffMat: puffL.material,
    puffL,
    puffR,
    life: 0,
    maxLife: 0.42,
    vx: 0,
    vz: 0
  });
}
let nextRippleIdx = 0;
let lastRippleTime = 0;

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

  const woodMat = new THREE.MeshStandardMaterial({ color: PALETTE.wood, roughness: 0.8 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x454b66, roughness: 0.88 });

  // 2-step 3D stone pedestal
  const step1 = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.2, 0.28, 8), stoneMat);
  step1.position.y = 0.14;
  step1.castShadow = true;
  step1.receiveShadow = true;
  const step2 = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.85, 0.32, 8), stoneMat);
  step2.position.y = 0.42;
  step2.castShadow = true;
  group.add(step1, step2);

  // Main wooden column
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 2.3, 10), woodMat);
  pillar.position.y = 1.65;
  pillar.castShadow = true;
  group.add(pillar);

  // Lantern housing platform & 4 corner cage ribs
  const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.52, 0.18, 8), woodMat);
  tray.position.y = 2.65;
  tray.castShadow = true;
  group.add(tray);

  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.25, 6), woodMat);
    rib.position.set(Math.cos(a) * 0.52, 3.28, Math.sin(a) * 0.52);
    rib.castShadow = true;
    group.add(rib);
  }

  const coreMat = new THREE.MeshStandardMaterial({
    color: PALETTE.lanternUnlit,
    emissive: 0x1a1e2e,
    emissiveIntensity: 0.3,
    roughness: 0.35
  });
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.4, 1.12, 12), coreMat);
  core.position.y = 3.28;
  group.add(core);

  // Double-tiered pagoda roof with gold finial
  const roofLower = new THREE.Mesh(new THREE.ConeGeometry(1.08, 0.45, 8), woodMat);
  roofLower.position.y = 4.02;
  roofLower.castShadow = true;
  const roofUpper = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.45, 8), woodMat);
  roofUpper.position.y = 4.38;
  roofUpper.castShadow = true;
  const finial = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 8),
    new THREE.MeshStandardMaterial({ color: PALETTE.gold, emissive: PALETTE.lanternLit, emissiveIntensity: 0.5 })
  );
  finial.position.y = 4.68;
  group.add(roofLower, roofUpper, finial);

  const light = new THREE.PointLight(PALETTE.lanternLit, 0, 20, 1.4);
  light.position.y = 3.3;
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

  // Foot-level stride & world-space wind-ripple gliding trail
  const hasCharm = sim.player.charmTicks > 0;
  const isDashing = sim.player.dashTicks > 0;
  const horizSpeed = Math.hypot(sim.player.vel[0], sim.player.vel[2]);
  const isMoving = horizSpeed > 0.5;
  const isGliding = isDashing || (hasCharm && isMoving);

  playerMesh.userData.scarfMat.emissiveIntensity = hasCharm ? 0.9 + Math.sin(nowSec * 10) * 0.25 : 0;
  playerMesh.userData.footGlideGroup.visible = isGliding;

  if (isMoving) {
    const strideFreq = hasCharm || isDashing ? 18 : 11;
    const stride = Math.sin(nowSec * strideFreq);
    playerMesh.userData.leftFoot.position.z = stride * 0.22;
    playerMesh.userData.leftFoot.position.y = 0.08 + Math.max(0, stride) * 0.1;
    playerMesh.userData.rightFoot.position.z = -stride * 0.22;
    playerMesh.userData.rightFoot.position.y = 0.08 + Math.max(0, -stride) * 0.1;
  } else {
    playerMesh.userData.leftFoot.position.set(-0.15, 0.08, 0);
    playerMesh.userData.rightFoot.position.set(0.15, 0.08, 0);
  }

  if (isGliding) {
    const wakeScale = isDashing ? 1.25 : 0.95 + Math.sin(nowSec * 14) * 0.1;
    playerMesh.userData.wakeArc.scale.set(wakeScale, wakeScale, 1);

    // Emit world-space ground wind-ripples & gliding puffs under Mây's feet
    const interval = isDashing ? 0.025 : 0.045;
    if (nowSec - lastRippleTime >= interval && sim.player.fallRespawnTicks === 0) {
      lastRippleTime = nowSec;
      const item = footRipplePool[nextRippleIdx];
      nextRippleIdx = (nextRippleIdx + 1) % footRipplePool.length;
      item.life = item.maxLife;
      item.group.visible = true;
      item.group.position.set(sim.player.pos[0], sim.player.pos[1] + 0.05, sim.player.pos[2]);
      item.group.rotation.y = sim.player.facingYaw;
      item.group.scale.setScalar(isDashing ? 0.85 : 0.65);
      item.vx = -Math.sin(sim.player.facingYaw) * (isDashing ? 2.4 : 1.3);
      item.vz = -Math.cos(sim.player.facingYaw) * (isDashing ? 2.4 : 1.3);
    }
  }

  // Update world-space footstep wind ripples
  for (const item of footRipplePool) {
    if (item.life > 0) {
      item.life = Math.max(0, item.life - 0.016);
      const t = 1 - item.life / item.maxLife; // 0 -> 1
      item.group.position.x += item.vx * 0.016;
      item.group.position.z += item.vz * 0.016;
      const sc = 0.65 + t * 1.45;
      item.group.scale.set(sc, 1, sc);
      item.ringMat.opacity = (1 - t) * 0.75;
      item.puffMat.opacity = (1 - t) * 0.55;
      item.puffL.position.x = -0.18 - t * 0.35;
      item.puffL.position.y = 0.06 + t * 0.22;
      item.puffR.position.x = 0.18 + t * 0.35;
      item.puffR.position.y = 0.06 + t * 0.22;
      if (item.life === 0) item.group.visible = false;
    }
  }

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
      const fade = Math.max(0.1, 1 - (s.stateTicksLeft || 0) / 60);
      vis.bodyMat.transparent = true;
      vis.bodyMat.opacity = fade;
      vis.group.scale.setScalar(0.45 + fade * 0.55);
      vis.bodyMat.color.setHex(PALETTE.shadeBody);
      vis.bodyMat.emissiveIntensity = 1.1;
      vis.eyeMat.color.setHex(0xb88cff);
      vis.coreGroup.rotation.x = 0;
      vis.tendrilsGroup.rotation.y = nowSec * 6;
      vis.stunHalo.visible = false;
    } else if (s.state === 'stunned') {
      vis.bodyMat.transparent = false;
      vis.bodyMat.opacity = 1;
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
