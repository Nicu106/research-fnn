import * as THREE from 'three';
import { createStage } from './stage.js';
import { loadHead } from './head.js';
import { buildNetwork, LAYERS, REGIONS } from './network.js';
import { NetworkView } from './networkView.js';
import { createHud } from './hud.js';
import { FaceTracker, describeCameraError } from './live/faceTracker.js';
import { AvatarRig } from './live/avatarRig.js';
import { FaceParts } from './live/faceParts.js';
import { buildBasis } from './emotion/faceBasis.js';
import { toRigFrame, makeRigFrame } from './emotion/driver.js';
import { EmotionStudio } from './emotion/studio.js';
import { recognise, EMOTIONS } from './emotion/emotions.js';
import { EmotionMap } from './taxonomy/mapView.js';
import { recipeToExpression } from './taxonomy/facs.js';
import { buildNeuromotor } from './neuro/neuromotor.js';
import { NeuromotorView } from './neuro/neuromotorView.js';
import { BrainLabels } from './neuro/brainLabels.js';
import { MuscleView } from './muscle/muscleView.js';
import { muscleActivity } from './muscle/muscles.js';

// `muscles`: translucent skin, network hidden, the muscle atlas on (muscle/muscleView.js).
const PRESETS = { skin: 1, hybrid: 0.35, network: 0, muscles: 0.28 };
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
  tab: 'network',
  activation: true,
  neuro: true,
  brainLabels: true,
  muscleMode: false,
};
stage.controls.autoRotate = true;

const tracker = new FaceTracker(document.getElementById('camVideo'));
let rig = null;
let parts = null;
let basis = null;
let anchorPositions = null;
let nm = null;       // neuromotor network (data + activations)
let nmView = null;
let brainLabels = null; // names of the brain structures, floating in 3D
let labelHover = -1;    // neuromotor node id hovered through its label
let muscleView = null;  // the facial muscles, drawn as an anatomy atlas
let muscleLabels = null;
let layersBeforeMuscles = null; // network layer visibility to restore when leaving muscle mode
let recog = [];
let recogAt = 0;
const NM_BASE = 100000; // picking ids >= NM_BASE are neuromotor nodes
let lastBlendshapes = [];
let lastExpression = null;
const rigFrame = makeRigFrame();
// Wrinkle strengths, eased so creases fade in and out with the muscles in every mode.
const wrinkleW = {};
const wrinkleTarget = {};
let skinResponse = { flush: 0, wet: 0 };

// Exposed for quick experiments from the browser console.
window.neuralFace = { net, view, stage, head, tracker, get rig() { return rig; }, get parts() { return parts; } };

// ---------- HUD wiring ----------
hud.on('preset', (name) => {
  state.skin = PRESETS[name];
  hud.setSkin(state.skin);
  setMuscleMode(name === 'muscles');
});

// Muscle mode: the network steps aside (its layers are restored on leaving) so the muscles read.
function setMuscleMode(on) {
  if (on === state.muscleMode) return;
  state.muscleMode = on;
  document.body.classList.toggle('musclemode', on);
  if (on) {
    layersBeforeMuscles = [0, 1, 2].map((i) => view.isLayerVisible(i));
    [0, 1, 2].forEach((i) => { view.setLayerVisible(i, false); hud.setToggle('layer', false, i); });
  } else if (layersBeforeMuscles) {
    layersBeforeMuscles.forEach((v, i) => { view.setLayerVisible(i, v); hud.setToggle('layer', v, i); });
    layersBeforeMuscles = null;
  }
}
hud.on('skin', (v) => { state.skin = v; if (v > 0.6) setMuscleMode(false); });
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
  if (state.tab === 'emotion' && lastExpression) {
    const r4 = (v) => Math.round(v * 1e4) / 1e4;
    const t = studio.performer;
    data.expression = {
      name: studio.baseLabel,
      capturedAt: new Date().toISOString(),
      blendshapes: Object.fromEntries(Object.entries(t.target).filter(([, v]) => v > 0.001).map(([k, v]) => [k, r4(v)])),
      head: { ...t.headT },
      gaze: [...t.gazeT],
      positions: Array.from({ length: net.count }, (_, i) => [
        r4(net.positions[i * 3]), r4(net.positions[i * 3 + 1]), r4(net.positions[i * 3 + 2]),
      ]),
      activation: rig ? Array.from(rig.activation, (v) => r4(v / basis.unitsPerMM)) : undefined,
    };
  }
  if (nm) {
    const r3 = (v) => Math.round(v * 1000) / 1000;
    data.neuromotor = {
      levels: nm.levels.map((l) => l.key),
      nodes: nm.nodes.map((n) => ({ id: n.id, key: n.key, name: n.name, level: nm.levels[n.level].key, activation: r3(nm.act[n.id]) })),
      edges: nm.edges.map((e, k) => [e.a, e.b, r3(nm.edgeAct[k])]),
      skin: nm.skin.map((k) => [k.muscle, k.net]),
    };
  }
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = data.expression ? `neural-face-emotie-${Date.now()}.json` : data.live ? `neural-face-live-${Date.now()}.json` : `neural-face-topology-seed${net.seed}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});

function setAutoRotate(on) {
  state.autoRotate = on;
  stage.controls.autoRotate = on;
  hud.setToggle('autorotate', on);
}
stage.controls.addEventListener('start', () => { if (state.autoRotate) setAutoRotate(false); });

// ---------- rig: shared by the webcam and the emotion studio ----------
let rigLoading = null;
function ensureRig() {
  if (rig) return Promise.resolve(rig);
  if (!rigLoading) {
    rigLoading = (async () => {
      const anchors = await fetch('./assets/head/anchors.json').then((r) => r.json());
      anchorPositions = anchors.positions;
      rig = new AvatarRig({ anchors: anchors.positions, mesh: head.mesh, net, view, features: head.features });
      parts = new FaceParts(anchors.positions);
      head.group.add(parts.group);
      basis = buildBasis({ anchors: anchors.positions });
      head.setFaceFrame(basis.frame);
      nm = buildNeuromotor({ anchors: anchors.positions, frame: basis.frame, net });
      nmView = new NeuromotorView(nm, net, { pixelRatio: stage.pixelRatio });
      head.group.add(nmView.group);
      nmView.bindTo(rig);
      const labelEvents = {
        onPick: (id) => { selected = NM_BASE + id; },
        onHover: (id) => { labelHover = id; },
      };
      brainLabels = new BrainLabels(
        nm.nodes.filter((n) => n.label).map((n) => ({ at: n.id, pick: n.id, label: n.label, name: n.name, color: n.color, side: n.side })),
        nmView.nodePos, labelEvents);
      brainLabels.setEnabled(state.brainLabels);
      muscleView = new MuscleView({ anchors: anchors.positions, frame: basis.frame });
      head.group.add(muscleView.group);
      muscleView.bindTo(rig);
      // One label per muscle, alternating sides so both columns fill; the pick is the muscle's
      // node in the neuromotor network, which carries its explanation.
      const nmId = Object.fromEntries(nm.nodes.map((n) => [n.key, n.id]));
      const perMuscle = [...new Set(muscleView.ranges.map((r) => r.muscle))];
      muscleLabels = new BrainLabels(
        muscleView.ranges.map((r, at) => ({ r, at })).filter(({ r }) => r.side === (perMuscle.indexOf(r.muscle) % 2 ? 'L' : 'R'))
          .map(({ r, at }) => ({ at, pick: nmId[r.key], label: r.label, name: nm.nodes[nmId[r.key]].name, color: '#ff7a6b' })),
        muscleView.centroids, labelEvents);
      document.querySelectorAll('[data-nm-count]').forEach((el) => { el.textContent = `${nm.counts.levels} niveluri · ${nm.counts.nodes} neuroni`; });
      Object.assign(window.neuralFace, { basis, anchors: anchors.positions, THREE, nm, nmView, muscleView });
      return rig;
    })();
  }
  return rigLoading;
}

// ---------- tabs ----------
const toastEl = document.getElementById('toast');
let toastTimer = 0;
function notify(msg, kind = 'ok') {
  clearTimeout(toastTimer);
  toastEl.textContent = msg;
  toastEl.className = 'toast' + (kind === 'err' ? ' err' : '');
  toastEl.hidden = false;
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, kind === 'err' ? 5000 : 2600);
}

const studio = new EmotionStudio({ snapshot: () => captureThumb(), notify });
window.neuralFace.studio = studio;
let studioVisited = false;

// Emotion map: "Arată pe față" hands a node to the studio — its tuned preset when there is one,
// otherwise the expression composed from its FACS recipe.
const emotionMap = new EmotionMap({
  notify,
  onShow: async (node) => {
    await setTab('emotion');
    if (node.preset) studio.select(node.preset);
    else studio.showExpression({ ...recipeToExpression(node.facs), life: EMOTIONS.neutral.life }, node.ro, 'emotion');
    notify(`${node.ro}${node.preset ? '' : ` · compusă din rețeta FACS ${node.facs}`}`);
  },
});
window.neuralFace.emotionMap = emotionMap;

// "Creierul emoțional" is the text article (blog/index.html, generated from js/brain/atlas.js by
// tools/build-blog.mjs), shown as a page of its own. Loaded the first time the tab opens.
const blogView = document.getElementById('blogView');
const blogFrame = document.getElementById('blogFrame');

async function setTab(name) {
  if (name === state.tab) return;
  for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('on', b.dataset.tab === name);
  document.getElementById('panelNetwork').hidden = name !== 'network';
  document.getElementById('panelEmotion').hidden = name !== 'emotion';
  document.getElementById('panelMap').hidden = name !== 'map';
  document.getElementById('mapView').hidden = name !== 'map';
  blogView.hidden = name !== 'brain';
  document.body.classList.toggle('studio', name === 'emotion');
  document.body.classList.toggle('mapmode', name === 'map');
  document.body.classList.toggle('brainmode', name === 'brain');
  const from = state.tab;
  state.tab = name;
  if (name === 'brain') {
    // A page to read: no camera, no face, and no 3D rendering behind it (see renderFrame).
    if (state.source === 'camera') stopCamera();
    studio.setActive(false);
    if (from === 'emotion') { rig?.release(); stage.setMood('stage'); }
    selected = -1;
    hovered = -1;
    if (!blogFrame.getAttribute('src')) blogFrame.src = 'blog/index.html';
    return;
  }
  if (name === 'map') {
    if (state.source === 'camera') stopCamera();
    studio.setActive(false);
    if (from === 'emotion') { rig?.release(); stage.setMood('stage'); }
    selected = -1;
    hovered = -1;
    await emotionMap.open();
    return;
  }
  if (name === 'emotion') {
    if (state.source === 'camera') stopCamera();
    selected = -1;
    setAutoRotate(false);
    stage.flyTo('portrait');
    stage.setMood('portrait');
    // The studio is about the face: show the skin the first time (the network stays one click away).
    if (!studioVisited && state.skin < 0.9) { state.skin = PRESETS.hybrid; hud.setSegment('preset', 'hybrid'); hud.setSkin(state.skin); }
    studioVisited = true;
    studio.setActive(true);
    await ensureRig();
    if (state.tab !== 'emotion') return;
  } else {
    studio.setActive(false);
    rig?.release();
    stage.flyTo('front');
    stage.setMood('stage');
  }
}
document.getElementById('tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (b) setTab(b.dataset.tab);
});
hud.on('activation', (on) => { state.activation = on; });
hud.on('brainLabels', (on) => {
  state.brainLabels = on;
  document.querySelectorAll('[data-toggle="brainLabels"]').forEach((b) => b.setAttribute('aria-pressed', String(on)));
  brainLabels?.setEnabled(on);
});
// The neuromotor toggle exists in both panels; keep them in step. It lives inside the head, so
// turning it on over opaque skin switches to the hybrid view, where it can be seen.
hud.on('neuro', (on) => {
  state.neuro = on;
  document.querySelectorAll('[data-toggle="neuro"]').forEach((b) => b.setAttribute('aria-pressed', String(on)));
  if (on && state.skin > 0.9) { state.skin = PRESETS.hybrid; hud.setSegment('preset', 'hybrid'); hud.setSkin(state.skin); }
});

/**
 * Square JPEG of the face as currently rendered, for the expression library.
 * Rendered and read back in the same task, so no preserveDrawingBuffer is needed.
 */
function captureThumb(size = 112) {
  if (!anchorPositions) return null;
  stage.render();
  const c = stage.renderer.domElement;
  const at = (i) => new THREE.Vector3().fromArray(anchorPositions, i * 3).applyMatrix4(head.group.matrixWorld).project(stage.camera);
  const top = at(10), chin = at(152);
  const px = (v) => [(v.x * 0.5 + 0.5) * c.width, (-v.y * 0.5 + 0.5) * c.height];
  const [tx, ty] = px(top), [bx, by] = px(chin);
  const side = Math.hypot(bx - tx, by - ty) * 1.55;
  const cx = (tx + bx) / 2, cy = (ty + by) / 2 - side * 0.04;
  const out = document.createElement('canvas');
  out.width = out.height = size;
  const g = out.getContext('2d');
  g.fillStyle = '#020406';
  g.fillRect(0, 0, size, size);
  g.drawImage(c, cx - side / 2, cy - side / 2, side, side, 0, 0, size, size);
  return out.toDataURL('image/jpeg', 0.85);
}

// ---------- live camera: the webcam drives the photoreal head ----------
let cameraBusy = false;
let pendingStop = false;
let camStatus = '';

async function startCamera() {
  if (cameraBusy || state.source === 'camera' || state.tab !== 'network') return;
  cameraBusy = true;
  pendingStop = false;
  hud.setLive(true);
  hud.setCamStatus('loading', 'Pornesc camera…');
  try {
    await tracker.start((msg) => hud.setCamStatus('loading', msg));
    if (!rig) {
      hud.setCamStatus('loading', 'Pregătesc avatarul…');
      await ensureRig();
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

// The route the strongest muscle's signal takes, spelled out under the face.
const pathEl = document.getElementById('emoCapPath');
let pathAt = 0;
function updatePathCaption() {
  const now = performance.now();
  if (now - pathAt < 300) return;
  pathAt = now;
  const top = nm.topPaths(1)[0];
  const emo = recog.find((r) => r.key !== 'neutral');
  if (!top || !emo) { pathEl.textContent = ''; return; }
  const short = (s) => s.replace(/ \(?(dreapta|stânga)\)?$/, '');
  pathEl.innerHTML = [emo.name, 'amigdală', 'cortex motor', short(top.nucleus), short(top.branch), short(top.muscle), 'piele']
    .map((x) => `<span>${x}</span>`).join('<i>→</i>');
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
  let pick = best ? best.index : -1;
  if (nmView?.group.visible) {
    for (const h of raycaster.intersectObject(nmView.points, false)) {
      if (h.distance > occluder) continue;
      if (!best || h.distanceToRay < best.distanceToRay * 1.4) { best = h; pick = NM_BASE + h.index; }
    }
  }
  return pick;
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
  if ((e.key === 'c' || e.key === 'C') && state.tab === 'network') {
    const next = state.source === 'camera' ? 'scan' : 'camera';
    hud.setSegment('source', next);
    next === 'camera' ? startCamera() : stopCamera();
  }
  if ((e.key === 'n' || e.key === 'N') && rig && state.source === 'camera') rig.calibrate();
});

const tmp = new THREE.Vector3();
function updateInspector() {
  const active = selected >= 0 ? selected : labelHover >= 0 ? NM_BASE + labelHover : hovered;
  if (active >= NM_BASE && nm) {
    const id = active - NM_BASE;
    const n = nm.nodes[id];
    view.setActive(-1);
    nmView.setHighlight(id);
    document.body.classList.toggle('hovering', hovered >= 0);
    tmp.fromArray(nmView.nodePos, id * 3).applyMatrix4(head.group.matrixWorld).project(stage.camera);
    const links = nm.edges.filter((e) => e.a === id || e.b === id).length + nm.skin.filter((k) => k.muscle === id).length;
    hud.showInspector({
      id: NM_BASE + id,
      color: n.color,
      fields: {
        id: `NM-${String(id).padStart(2, '0')}`,
        layer: nm.levels[n.level].name,
        region: n.name,
        x: `${Math.round(nm.act[id] * 100)}% activ`,
        y: n.pos[1].toFixed(3),
        z: n.pos[2].toFixed(3),
        degree: links,
        info: n.info ?? '',
      },
    }, (tmp.x * 0.5 + 0.5) * window.innerWidth, (-tmp.y * 0.5 + 0.5) * window.innerHeight, selected >= 0);
    return;
  }
  nmView?.setHighlight(-1);
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
ensureRig().catch((err) => console.error('[rig]', err));
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
  // The map and the article are 2D pages over the scene: don't spend the GPU on a head nobody sees.
  if (state.tab === 'map' || state.tab === 'brain') return;
  // Intro: network scans in top-down, then the skin materialises behind it.
  const reveal = 4.6 - 9.4 * ease(clamp01((t - 0.5) / 3.6));
  const cut = 4.6 - 9.4 * ease(clamp01((t - 2.8) / 2.8));

  state.skinShown += (state.skin - state.skinShown) * (1 - Math.exp(-dt * 4));
  if (Math.abs(state.skin - state.skinShown) < 0.001) state.skinShown = state.skin;

  if (state.source === 'camera' && tracker.ended) {
    stopCamera();
    hud.setCamStatus('err', describeCameraError({ name: 'TrackEnded' }));
  }

  for (const k in wrinkleTarget) wrinkleTarget[k] = 0;
  skinResponse = { flush: 0, wet: 0 };
  if (rig && state.tab === 'emotion' && basis) {
    const f = studio.update(dt);
    toRigFrame(basis, f, rigFrame);
    rig.drive(rigFrame);
    Object.assign(wrinkleTarget, f.w);
    skinResponse = f.skin;
    lastExpression = f;
  }

  if (rig) {
    const res = state.source === 'camera' ? tracker.detect(performance.now()) : undefined;
    const st = rig.update(res, dt);
    // Eyeballs and mouth interior only make sense behind visible skin.
    parts.update(rig.face, rig.headMatrix);
    // Eyes from low skin opacity (hidden below half, the hybrid view showed a face with its eyes
    // shut); the mouth interior only when the skin is nearly opaque (see FaceParts.setSkin).
    // ...and never during the intro, while the skin is still materialising top-down: the rig now
    // exists from startup, and its eyeballs and teeth floated in front of an unfinished face.
    parts.setSkin(cut < -0.6 ? state.skinShown : 0);
    if (state.source === 'camera') {
      updateCameraStatus(st);
      if (res) {
        // Webcam wrinkles: the user's own muscles, on the avatar's side of the face.
        const swap = (n) => (!state.mirror ? n : n.endsWith('Left') ? n.slice(0, -4) + 'Right' : n.endsWith('Right') ? n.slice(0, -5) + 'Left' : n);
        for (const c of res.blendshapes) wrinkleTarget[swap(c.categoryName)] = c.score;
        lastBlendshapes = res.blendshapes;
        hud.setBlendshapes(res.blendshapes);
        hud.setPose(rig.pose);
      }
    }
  }

  if (rig) view.setActivation(state.activation && rig.active ? rig.activation : null, basis?.unitsPerMM ?? 1);
  const kw = 1 - Math.exp(-dt * 10);
  for (const k in wrinkleTarget) wrinkleW[k] = (wrinkleW[k] ?? 0) + (wrinkleTarget[k] - (wrinkleW[k] ?? 0)) * kw;
  head.setExpression(wrinkleW, skinResponse);
  head.syncScale();

  if (nm) {
    const now = performance.now();
    if (now - recogAt > 120) { recog = recognise(wrinkleW); recogAt = now; }
    nm.compute(wrinkleW, recog);
    nmView.setVisible(state.neuro && state.skinShown < 0.92 && reveal < -2);
    nmView.update(t, dt);
    const a = selected >= 0 ? selected : labelHover >= 0 ? NM_BASE + labelHover : hovered;
    const hot = a >= NM_BASE ? a - NM_BASE : -1;
    const actOf = (id) => nm.act[id];
    // In muscle mode the muscle labels take the place of the brain's.
    if (state.brainLabels) brainLabels.update(stage.camera, head.group.matrixWorld, nmView.group.visible && !state.muscleMode ? nmView.uniforms.uVis.value : 0, hot, actOf);
    muscleView.setVisible(state.muscleMode && state.skinShown < 0.92 && reveal < -2);
    muscleView.update(t, dt, muscleActivity(nm.units));
    if (state.brainLabels) muscleLabels.update(stage.camera, head.group.matrixWorld, muscleView.group.visible ? muscleView.uniforms.uVis.value : 0, hot, actOf);
    if (state.tab === 'emotion') updatePathCaption();
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
