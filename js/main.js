import * as THREE from 'three';
import { createStage } from './stage.js';
import { loadHead } from './head.js';
import { buildNetwork, LAYERS, REGIONS } from './network.js';
import { NetworkView } from './networkView.js';
import { createHud } from './hud.js';
import { FaceTracker, describeCameraError } from './live/faceTracker.js';
import { AvatarRig } from './live/avatarRig.js';
import { FaceParts } from './live/faceParts.js';

const PRESETS = { skin: 1, hybrid: 0.35, network: 0 };
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const hud = createHud();
const stage = createStage(document.getElementById('scene'));

const head = await loadHead((p) => hud.setProgress(p * 0.8));
stage.scene.add(head.group);

hud.setProgress(0.86, 'Construire topologie');
// Yield so the loader repaints (a timer, not rAF: rAF never fires in background tabs).
await new Promise((r) => setTimeout(r, 30));

const net = buildNetwork(head.mesh, { seed: 1337 });
const view = new NetworkView(net, { pixelRatio: stage.pixelRatio });
head.group.add(view.group);
hud.setNetwork(net);

const state = {
  skin: 1,
  skinShown: 0,
  autoRotate: true,
  source: 'scan',
  mirror: true,
};
stage.controls.autoRotate = true;

const tracker = new FaceTracker(document.getElementById('camVideo'));
let rig = null;
let parts = null;
let lastBlendshapes = [];

// Exposed for quick experiments from the browser console.
window.neuralFace = { net, view, stage, head, tracker, get rig() { return rig; }, get parts() { return parts; } };

// ---------- HUD wiring ----------
hud.on('preset', (name) => {
  state.skin = PRESETS[name];
  hud.setSkin(state.skin);
});
hud.on('skin', (v) => { state.skin = v; });
hud.on('layer', (on, i) => view.setLayerVisible(i, on));
hud.on('color', (mode) => view.setColorMode(mode));
hud.on('pulse', (on) => view.setPulses(on));
hud.on('view', (name) => {
  setAutoRotate(false);
  stage.flyTo(name);
});
hud.on('autorotate', (on) => setAutoRotate(on));
hud.on('source', (s) => (s === 'camera' ? startCamera() : stopCamera()));
hud.on('preview', (on) => hud.showPreview(on));
hud.on('mirror', (on) => {
  state.mirror = on;
  if (rig) {
    rig.mirror = on;
    rig.calibrate();
  }
});
hud.on('recalibrate', () => rig?.calibrate());
hud.on('export', () => {
  const data = net.toJSON();
  if (state.source === 'camera' && rig) {
    const r4 = (v) => Math.round(v * 1e4) / 1e4;
    data.live = {
      capturedAt: new Date().toISOString(),
      mirror: state.mirror,
      pose: { ...rig.pose },
      blendshapes: Object.fromEntries(lastBlendshapes.map((b) => [b.categoryName, r4(b.score)])),
      positions: Array.from({ length: net.count }, (_, i) => [
        r4(net.positions[i * 3]), r4(net.positions[i * 3 + 1]), r4(net.positions[i * 3 + 2]),
      ]),
    };
  }
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = data.live ? `neural-face-live-${Date.now()}.json` : `neural-face-topology-seed${net.seed}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});

function setAutoRotate(on) {
  state.autoRotate = on;
  stage.controls.autoRotate = on;
  hud.setToggle('autorotate', on);
}
stage.controls.addEventListener('start', () => { if (state.autoRotate) setAutoRotate(false); });

// ---------- live camera: the webcam drives the photoreal head ----------
let cameraBusy = false;
let pendingStop = false;
let camStatus = '';

async function startCamera() {
  if (cameraBusy || state.source === 'camera') return;
  cameraBusy = true;
  pendingStop = false;
  hud.setLive(true);
  hud.setCamStatus('loading', 'Pornesc camera…');
  try {
    await tracker.start((msg) => hud.setCamStatus('loading', msg));
    if (!rig) {
      hud.setCamStatus('loading', 'Pregătesc avatarul…');
      const anchors = await fetch('./assets/head/anchors.json').then((r) => r.json());
      rig = new AvatarRig({ anchors: anchors.positions, mesh: head.mesh, net, view, features: head.features });
      parts = new FaceParts(anchors.positions);
      head.group.add(parts.group);
    }
  } catch (err) {
    console.error('[camera]', err);
    tracker.stop();
    hud.setCamStatus('err', describeCameraError(err));
    hud.setSegment('source', 'scan');
    hud.setLive(false);
    cameraBusy = false;
    return;
  }
  cameraBusy = false;
  if (pendingStop) {
    tracker.stop();
    hud.setLive(false);
    hud.setCamStatus('hidden');
    return;
  }

  rig.mirror = state.mirror;
  rig.start();
  state.source = 'camera';
  camStatus = '';
  selected = -1;
  setAutoRotate(false);
  stage.flyTo('front');
}

function stopCamera() {
  if (cameraBusy) { pendingStop = true; return; }
  if (state.source !== 'camera') return;
  tracker.stop();
  rig?.release();
  state.source = 'scan';
  hud.setLive(false);
  hud.setCamStatus('hidden');
  hud.setSegment('source', 'scan');
}

function updateCameraStatus(st) {
  const next = !st.tracking ? 'search' : st.calibrating ? 'calib' : 'live';
  if (next === 'calib') {
    hud.setCamStatus('loading', `Calibrare · privește camera relaxat ${Math.round(st.progress * 100)}%`);
  } else if (next !== camStatus) {
    if (next === 'search') hud.setCamStatus('loading', 'Caut fața…');
    else hud.setCamStatus('ok', 'Avatarul te copiază live');
  }
  camStatus = next;
}

// ---------- picking ----------
const canvas = stage.renderer.domElement;
const raycaster = new THREE.Raycaster();
raycaster.params.Points.threshold = 0.1;
const ndc = new THREE.Vector2();
let pointer = null;
let hovered = -1;
let selected = -1;
let downAt = null;

function pick(x, y) {
  ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, stage.camera);
  let occluder = Infinity;
  if (state.skinShown > 0.6) {
    const hit = raycaster.intersectObject(head.mesh, false)[0];
    if (hit) occluder = hit.distance + 0.15;
  }
  let best = null;
  for (const h of raycaster.intersectObject(view.points, false)) {
    if (h.distance > occluder || !view.isLayerVisible(net.layers[h.index])) continue;
    if (!best || h.distanceToRay < best.distanceToRay) best = h;
  }
  return best ? best.index : -1;
}

// Listen on window so hovering the HUD (which overlays the canvas) clears the hover.
window.addEventListener('pointermove', (e) => {
  pointer = e.target === canvas ? { x: e.clientX, y: e.clientY } : null;
  if (!pointer) hovered = -1;
});
canvas.addEventListener('pointerleave', () => { pointer = null; hovered = -1; });
canvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointerup', (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) return;
  selected = pick(e.clientX, e.clientY);
  downAt = null;
});
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (e.key === 'Escape') selected = -1;
  if (['1', '2', '3'].includes(e.key)) {
    const i = Number(e.key) - 1;
    const on = !view.isLayerVisible(i);
    view.setLayerVisible(i, on);
    hud.setToggle('layer', on, i);
  }
  if (e.key === 'c' || e.key === 'C') {
    const next = state.source === 'camera' ? 'scan' : 'camera';
    hud.setSegment('source', next);
    next === 'camera' ? startCamera() : stopCamera();
  }
  if ((e.key === 'n' || e.key === 'N') && rig && state.source === 'camera') rig.calibrate();
});

const tmp = new THREE.Vector3();
function updateInspector() {
  const active = selected >= 0 ? selected : hovered;
  view.setActive(active);
  document.body.classList.toggle('hovering', hovered >= 0);
  if (active < 0) return hud.hideInspector();

  tmp.fromArray(net.positions, active * 3).applyMatrix4(head.group.matrixWorld).project(stage.camera);
  const sx = (tmp.x * 0.5 + 0.5) * window.innerWidth;
  const sy = (-tmp.y * 0.5 + 0.5) * window.innerHeight;
  const p = net.positions;
  const layer = LAYERS[net.layers[active]];
  hud.showInspector({
    id: active,
    color: layer.color,
    fields: {
      id: `N-${String(active).padStart(4, '0')}`,
      layer: layer.name,
      region: REGIONS[net.regions[active]].name,
      x: p[active * 3].toFixed(3),
      y: p[active * 3 + 1].toFixed(3),
      z: p[active * 3 + 2].toFixed(3),
      degree: net.neighbors[active].length,
    },
  }, sx, sy, selected >= 0);
}

// ---------- loop ----------
hud.setProgress(1, 'Gata');
await new Promise((r) => setTimeout(r, 350));
hud.hideLoader();

const clock = new THREE.Clock();
let frames = 0;
let fpsTime = 0;

function frame() {
  renderFrame(clock.elapsedTime, Math.min(clock.getDelta(), 0.05));
  requestAnimationFrame(frame);
}

// Debug: render a specific moment (seconds since start), e.g. neuralFace.step(12).
window.neuralFace.step = (t) => {
  clock.elapsedTime = t;
  renderFrame(t, 1);
};

function renderFrame(t, dt) {
  // Intro: network scans in top-down, then the skin materialises behind it.
  const reveal = 4.6 - 9.4 * ease(clamp01((t - 0.5) / 3.6));
  const cut = 4.6 - 9.4 * ease(clamp01((t - 2.8) / 2.8));

  state.skinShown += (state.skin - state.skinShown) * (1 - Math.exp(-dt * 4));
  if (Math.abs(state.skin - state.skinShown) < 0.001) state.skinShown = state.skin;

  if (state.source === 'camera' && tracker.ended) {
    stopCamera();
    hud.setCamStatus('err', describeCameraError({ name: 'TrackEnded' }));
  }

  if (rig) {
    const res = state.source === 'camera' ? tracker.detect(performance.now()) : undefined;
    const st = rig.update(res, dt);
    // Eyeballs and mouth interior only make sense behind visible skin.
    parts.update(rig.face, rig.headMatrix);
    parts.group.visible = state.skinShown > 0.5;
    if (state.source === 'camera') {
      updateCameraStatus(st);
      if (res) {
        lastBlendshapes = res.blendshapes;
        hud.setBlendshapes(res.blendshapes);
        hud.setPose(rig.pose);
      }
    }
  }

  if (pointer && t > 3) hovered = pick(pointer.x, pointer.y);

  head.update({ time: t, skin: state.skinShown, cut });
  view.update(t, dt, reveal);
  stage.update(dt, t);
  updateInspector();
  stage.render();

  frames++;
  fpsTime += dt;
  if (fpsTime > 0.5) {
    hud.setFps(Math.round(frames / fpsTime));
    frames = 0;
    fpsTime = 0;
  }
}
requestAnimationFrame(frame);
