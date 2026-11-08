/*
 * Dev-only round trip: render the head in a known expression, read it back through MediaPipe
 * (the same model the photo capture uses) and compare.
 *
 *   const rt = await import('/tools/roundtrip.js');
 *   await rt.recognition();   // does an independent model see the intended emotion?
 *   await rt.conventions();   // which way do MediaPipe's Left/Right and head angles point?
 *   await rt.neutralBias();   // what it reports on a relaxed face (for BIAS in imageCapture.js)
 *
 * MediaPipe was trained on real human faces, so it is an objective check that an authored
 * expression carries the cues people actually read — not just that it looks right to its author.
 */

import { correctWeights, headFromMatrix } from '/js/emotion/imageCapture.js';
import { recognise } from '/js/emotion/emotions.js';

const NF = () => window.neuralFace;
let t = 50;
const tick = (n = 4) => { for (let i = 0; i < n; i++) { t += 1 / 30; NF().step(t); } };

async function setup() {
  document.querySelector('#tabs [data-tab=emotion]').click();
  for (let i = 0; i < 20 && !NF().basis; i++) await new Promise((r) => setTimeout(r, 500));
  document.querySelector('#panelEmotion [data-seg=preset] [data-value=skin]').click();
  [0, 1, 2].forEach((i) => NF().view.setLayerVisible(i, false));
  NF().studio.performer.settings.life = 0;
  NF().studio.performer.settings.asym = 0;
  frontalCamera();
  tick(8);
  await NF().studio.analyzer.load();
}

// A photo-like viewpoint: straight in front of the face, lens at eye height. The studio's
// portrait framing sits ~6 degrees to the side and slightly below the eyes, which an analyser
// reads as the subject looking down and turned — a property of the camera, not the face.
export function frontalCamera(dist = 7) {
  const nf = NF(), a = nf.anchors;
  const T = nf.THREE;
  const eyes = new T.Vector3(
    (a[33 * 3] + a[263 * 3]) / 2, (a[33 * 3 + 1] + a[263 * 3 + 1]) / 2, (a[33 * 3 + 2] + a[263 * 3 + 2]) / 2,
  ).applyMatrix4(nf.head.group.matrixWorld);
  const target = eyes.clone().setY(eyes.y - 0.45); // aim a little below the eyes: whole face in frame
  nf.stage.controls.target.copy(target);
  nf.stage.camera.position.set(target.x, eyes.y, target.z + dist);
  nf.stage.camera.lookAt(target);
  nf.stage.controls.update();
}

function screenOf(i) {
  const nf = NF(), T = nf.THREE, a = nf.anchors;
  const p = new T.Vector3(a[i * 3] + nf.rig.Ds[i * 3], a[i * 3 + 1] + nf.rig.Ds[i * 3 + 1], a[i * 3 + 2] + nf.rig.Ds[i * 3 + 2])
    .applyMatrix4(nf.rig.headMatrix).applyMatrix4(nf.head.group.matrixWorld).project(nf.stage.camera);
  const c = nf.stage.renderer.domElement;
  return [(p.x * 0.5 + 0.5) * c.width, (-p.y * 0.5 + 0.5) * c.height];
}

/** Render `expr` and return a square canvas of the face, as a photo would be. */
function renderFace(expr) {
  const s = NF().studio;
  if (typeof expr === 'string') s.select(expr);
  else s.showExpression({ w: expr.w ?? {}, head: expr.head ?? { pitch: 0, yaw: 0, roll: 0 }, gaze: expr.gaze ?? [0, 0] }, 'rt', 'edit');
  s.performer.snap();
  tick(4);
  const [ax, ay] = screenOf(10), [bx, by] = screenOf(152);
  const h = Math.hypot(bx - ax, by - ay) * 1.6;
  const cx = (ax + bx) / 2, cy = (ay + by) / 2;
  const out = document.createElement('canvas');
  out.width = out.height = 640;
  const g = out.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, 640, 640);
  g.drawImage(NF().stage.renderer.domElement, cx - h / 2, cy - h / 2, h, h, 0, 0, 640, 640);
  return out;
}

async function read(expr) {
  const img = renderFace(expr);
  const res = await NF().studio.analyzer.analyze(img);
  if (!res) return null;
  return { raw: res.raw, w: correctWeights(res.raw), head: headFromMatrix(res.matrix), img, landmarks: res.landmarks };
}

const r2 = (v) => Math.round(v * 100) / 100;

export async function recognition(keys = ['neutral', 'melancholy', 'sad', 'grief', 'joy', 'surprise', 'fear', 'anger', 'disgust', 'contempt']) {
  await setup();
  const rows = [];
  for (const k of keys) {
    const r = await read(k);
    if (!r) { rows.push({ expr: k, seen: 'NO FACE' }); continue; }
    const rec = recognise(r.w);
    const top = (n) => Object.entries(r.raw).filter(([x]) => x !== '_neutral').sort((a, b) => b[1] - a[1]).slice(0, n).map(([x, v]) => `${x}=${r2(v)}`).join(' ');
    rows.push({ expr: k, seen: rec[0].key, p: r2(rec[0].p), second: `${rec[1].key} ${r2(rec[1].p)}`, rawTop: top(5) });
  }
  return rows;
}

export async function conventions() {
  await setup();
  const out = {};
  const L = await read({ w: { eyeBlinkLeft: 1 } });
  out.closeSubjectsLeftEye = { eyeBlinkLeft: r2(L.raw.eyeBlinkLeft), eyeBlinkRight: r2(L.raw.eyeBlinkRight) };
  const S = await read({ w: { mouthSmileLeft: 0.9 } });
  out.smileSubjectsLeft = { mouthSmileLeft: r2(S.raw.mouthSmileLeft), mouthSmileRight: r2(S.raw.mouthSmileRight) };
  for (const [name, head] of [['yaw+15 (turn to own left)', { yaw: 15, pitch: 0, roll: 0 }], ['pitch+12 (chin down)', { pitch: 12, yaw: 0, roll: 0 }], ['roll+10 (tilt to own right)', { roll: 10, yaw: 0, pitch: 0 }]]) {
    // Head angles for showExpression are in degrees.
    const r = await read({ w: {}, head });
    out[name] = { read: { yaw: r2(r.head.yaw), pitch: r2(r.head.pitch), roll: r2(r.head.roll) } };
  }
  const base = await read({ w: {} });
  out.levelHead = { yaw: r2(base.head.yaw), pitch: r2(base.head.pitch), roll: r2(base.head.roll) };
  return out;
}

export async function neutralBias() {
  await setup();
  const r = await read({ w: {} });
  return Object.fromEntries(Object.entries(r.raw).filter(([k, v]) => k !== '_neutral' && v > 0.03).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, r2(v)]));
}

/** Show the exact crops the analyser receives, side by side, with what it read. */
export async function preview(items = ['neutral', 'joy', 'sad']) {
  await setup();
  let o = document.getElementById('__rt');
  if (!o) {
    o = document.createElement('canvas');
    o.id = '__rt';
    Object.assign(o.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', zIndex: 60, background: '#000' });
    document.body.appendChild(o);
  }
  o.width = innerWidth * 2;
  o.height = innerHeight * 2;
  const g = o.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, o.width, o.height);
  const size = Math.min(o.height - 120, o.width / items.length);
  for (let i = 0; i < items.length; i++) {
    const r = await read(items[i]);
    g.drawImage(r.img, i * size, 0, size, size);
    const rec = recognise(r.w)[0];
    g.fillStyle = '#9ff3ff';
    g.font = `${Math.round(size / 22)}px monospace`;
    const label = typeof items[i] === 'string' ? items[i] : items[i].label;
    g.fillText(`${label} -> ${rec.key} ${Math.round(rec.p * 100)}%`, i * size + 12, size + 40);
    const sm = `smile L/R ${r2(r.raw.mouthSmileLeft)}/${r2(r.raw.mouthSmileRight)} · lookDown ${r2(r.raw.eyeLookDownLeft)}`;
    g.fillText(sm, i * size + 12, size + 80);
  }
  return 'shown';
}

/**
 * Muscle recovery: the stage-A baseline (vault: "Strategia - modelul complet al emoției").
 * Each functional unit alone, at two intensities, rendered -> read by MediaPipe -> turned back
 * into muscles. Does an independent model, trained on real faces, see the muscle we moved, and
 * only that one?
 *
 *   const rt = await import('/tools/roundtrip.js');
 *   const m = await rt.muscles();   // { summary, units: [...] }
 *
 * summary.pcc       Pearson correlation, intended vs recovered, over every unit x intensity
 * units[].seen      recovered activation of the unit itself (twins / bilateral pairs counted)
 * units[].leak      strongest other unit that came back, and how strong
 */
export async function muscles({ levels = [0.35, 0.7] } = {}) {
  const M = await import('/js/muscle/muscles.js');
  await setup();
  const base = await read({ w: {} });
  const baseA = M.weightsToMuscles(base.w);
  const rows = [];
  const xs = [], ys = [];
  for (const u of M.UNITS) {
    if (u.hidden) continue;
    const row = { unit: u.key, au: u.au };
    for (const lv of levels) {
      const r = await read({ w: M.musclesToWeights(M.activations({ [u.key]: lv })) });
      if (!r) { row[`seen@${lv}`] = 'NO FACE'; continue; }
      const a = M.weightsToMuscles(r.w);
      const val = (k) => Math.max(0, (a[M.CH[k + 'R']] + a[M.CH[k + 'L']]) / 2 - (baseA[M.CH[k + 'R']] + baseA[M.CH[k + 'L']]) / 2);
      const own = new Set([u.key, u.twin].filter(Boolean));
      const seen = [...own].reduce((s, k) => s + val(k), 0);
      let leak = 0, leakAt = '';
      for (const o of M.UNITS) if (!own.has(o.key) && !o.hidden && val(o.key) > leak) { leak = val(o.key); leakAt = o.key; }
      row[`seen@${lv}`] = r2(seen);
      row[`leak@${lv}`] = `${leakAt} ${r2(leak)}`;
      // Every unit at every level contributes one intended/recovered pair per unit.
      for (const o of M.UNITS) if (!o.hidden && (o.key === u.key || !own.has(o.key))) { xs.push(o.key === u.key ? lv : 0); ys.push(own.has(o.key) ? seen : val(o.key)); }
    }
    rows.push(row);
  }
  const mean = (v) => v.reduce((s, x) => s + x, 0) / v.length;
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; syy += (ys[i] - my) ** 2; });
  const pcc = sxy / Math.sqrt(sxx * syy);
  const hi = levels[levels.length - 1];
  const detected = rows.filter((r) => r[`seen@${hi}`] >= hi * 0.25).length;
  return {
    summary: { pcc: r2(pcc), unitsDetected: `${detected}/${rows.length}`, at: hi, note: 'detected = recovered at least 25% of the intended activation' },
    units: rows,
  };
}

/**
 * Geometric round trip: does the movement each unit is meant to make actually show in the
 * rendered image? Compares, landmark by landmark, the displacement the face basis intends (mm)
 * with the one MediaPipe's landmarks measure on the render (mm, scaled by the 90 mm outer-canthal
 * width). Independent of MediaPipe's blendshape classifier, which reads isolated units poorly.
 *
 *   const g = await rt.geometry();   // { summary, units: [{ unit, gain, cos, mm }] }
 *
 * gain  measured / intended along the intended direction (1 = exactly as designed)
 * cos   direction agreement over the moving landmarks (1 = same pattern)
 * mm    largest intended displacement of the unit, for scale
 */
export async function geometry({ level = 0.7, minMM = 1.5 } = {}) {
  const M = await import('/js/muscle/muscles.js');
  const { compose } = await import('/js/emotion/faceBasis.js');
  await setup();
  const nf = NF(), basis = nf.basis, u = basis.unitsPerMM;
  const base = await read({ w: {} });
  const L0 = base.landmarks;
  const px = (l) => [l.x * 640, l.y * 640];
  const scale = 90 / Math.hypot(px(L0[33])[0] - px(L0[263])[0], px(L0[33])[1] - px(L0[263])[1]); // mm per pixel
  const field = new Float32Array(478 * 3);
  const rows = [];
  let gSum = 0, gN = 0;
  for (const unit of M.UNITS) {
    if (unit.hidden) continue;
    const w = M.musclesToWeights(M.activations({ [unit.key]: level }));
    compose(basis, w, field);
    const r = await read({ w });
    if (!r) { rows.push({ unit: unit.key, au: unit.au, gain: 'NO FACE' }); continue; }
    // The crop follows landmarks 10 and 152 (forehead, chin), which some units move: align the
    // render to the neutral one on points no expression moves (eye corners, nasal bridge).
    const align = similarity(RIGID.map((i) => px(r.landmarks[i])), RIGID.map((i) => px(L0[i])));
    let dot = 0, ii = 0, dd = 0, peak = 0, n = 0;
    for (let i = 0; i < 468; i++) {
      // Intended, projected on the image plane of the frontal camera: model +x = image right,
      // model +y = image up.
      const ix = field[i * 3] / u, iy = -field[i * 3 + 1] / u;
      const m = Math.hypot(ix, iy);
      peak = Math.max(peak, m);
      if (m < minMM) continue;
      const [ax, ay] = align(px(r.landmarks[i])), [bx, by] = px(L0[i]);
      const dx = (ax - bx) * scale, dy = (ay - by) * scale;
      dot += dx * ix + dy * iy; ii += ix * ix + iy * iy; dd += dx * dx + dy * dy; n++;
    }
    if (!n) { rows.push({ unit: unit.key, au: unit.au, gain: '-', mm: r2(peak), note: 'nicio mișcare frontală peste prag (adâncime, sau pleoapă din rig-ul ochiului)' }); continue; }
    const gain = dot / ii, cos = dot / Math.sqrt(ii * dd);
    gSum += gain; gN++;
    rows.push({ unit: unit.key, au: unit.au, gain: r2(gain), cos: r2(cos), mm: r2(peak), landmarks: n });
  }
  const seen = rows.filter((x) => typeof x.gain === 'number' && x.gain > 0.5 && x.cos > 0.6).length;
  return { summary: { meanGain: r2(gSum / gN), unitsVisible: `${seen}/${gN}`, level, note: 'visible = gain > 0.5 and cos > 0.6' }, units: rows };
}

// Landmarks no facial action moves: inner and outer eye corners, nasal bridge.
const RIGID = [33, 133, 362, 263, 168, 6];

/** 2D similarity transform (scale, rotation, translation) taking points `from` onto `to`. */
function similarity(from, to) {
  const n = from.length;
  const mean = (P) => [P.reduce((s, p) => s + p[0], 0) / n, P.reduce((s, p) => s + p[1], 0) / n];
  const [fx, fy] = mean(from), [tx, ty] = mean(to);
  let a = 0, b = 0, ff = 0;
  for (let i = 0; i < n; i++) {
    const x = from[i][0] - fx, y = from[i][1] - fy, X = to[i][0] - tx, Y = to[i][1] - ty;
    a += x * X + y * Y; b += x * Y - y * X; ff += x * x + y * y;
  }
  a /= ff; b /= ff;
  return ([x, y]) => [tx + a * (x - fx) - b * (y - fy), ty + b * (x - fx) + a * (y - fy)];
}
