/*
 * The muscle layer: the face's source of truth.
 *
 * An expression is a set of muscle activations (0..1). Blendshapes (ARKit's 52, which the
 * face basis, the rig and MediaPipe all speak) are what those muscles PRODUCE, computed from
 * them, not the other way round:
 *
 *   musclesToWeights(a)   forward:  activations -> blendshape weights   (studio, generation)
 *   weightsToMuscles(w)   inverse:  blendshape weights -> activations    (camera, photos, presets)
 *
 * Three levels:
 *   MUSCLES  anatomical mimic and jaw muscles, one per side (what the neuromotor network draws)
 *   UNITS    functional units, aligned with FACS action units. Most muscles have one; the
 *            orbicularis oris and oculi do several distinct things (press, pucker, roll lips;
 *            tighten, close lids) and get one unit for each, the way FACS separates them.
 *   OUT      each unit's contribution to the blendshapes (`*` = that side's Left/Right shape;
 *            no star = a bilateral shape, to which each side contributes its half).
 *
 * Some shapes are not made by mimic muscles at all and pass straight through: where the eyes
 * look (extraocular muscles), puffed cheeks (air pressure) and the whole mouth shifted sideways.
 *
 * Each unit maps onto the shapes of its action unit exactly as js/taxonomy/facs.js does (AU6 ->
 * cheekSquint, AU12 -> mouthSmile, ...). How one muscle drags the skin of its neighbours (the
 * smile pushing the cheek up) is the deformation model's job, not this table's.
 *
 * What ARKit cannot tell apart, this layer cannot either, and says so:
 *   twin     corrugator and procerus both lower the brows: the inverse shares the movement.
 *   bilateral shapes (browInnerUp, mouthPucker, jawOpen...) have no side: the inverse gives both
 *            sides half each, so a one-sided AU1 comes back as a symmetric one.
 *   hidden   the platysma works on the neck, which ARKit does not see: its mouth effect is
 *            explained by risorius + depressor labii. It is only ever driven forward.
 * tools/check-muscles.mjs measures all of this.
 *
 * Pure data and maths, no DOM, no three.js: runs in the app and in node.
 */

import { BLENDSHAPES } from '../live/landmarkSets.js';

/** Anatomical muscles. `lm`/`off` place them on the face (neuromotor.js), `branch` = nerve. */
export const MUSCLES = [
  { key: 'frontalisMed', name: 'Frontal (porțiunea medială)', lm: [[108], [337]], off: [0, 4], branch: 'temporal' },
  { key: 'frontalisLat', name: 'Frontal (porțiunea laterală)', lm: [[67], [297]], off: [0, 0], branch: 'temporal' },
  { key: 'corrugator', name: 'Corugator al sprâncenei', lm: [[55], [285]], off: [2, 2], branch: 'temporal' },
  { key: 'orbOculiPalp', name: 'Orbicular al ochiului (palpebral)', lm: [[159], [386]], off: [0, 3], branch: 'temporal' },
  { key: 'procerus', name: 'Procer', lm: [[168], [168]], off: [4, 0], branch: 'buccal' },
  { key: 'orbOculiOrb', name: 'Orbicular al ochiului (orbitar)', lm: [[118], [347]], off: [0, -2], branch: 'zygomatic' },
  { key: 'levLabAlae', name: 'Ridicător al buzei și aripii nasului', lm: [[129], [358]], off: [2, 4], branch: 'zygomatic' },
  { key: 'zygMajor', name: 'Zigomatic mare', lm: [[116, 61], [345, 291]], off: [0, 0], branch: 'zygomatic' },
  { key: 'levLab', name: 'Ridicător al buzei superioare', lm: [[206], [426]], off: [0, 3], branch: 'buccal' },
  { key: 'risorius', name: 'Risorius', lm: [[57], [287]], off: [6, 0], branch: 'buccal' },
  { key: 'buccinator', name: 'Buccinator', lm: [[57, 187], [287, 411]], off: [0, 0], branch: 'buccal' },
  { key: 'orbOrisSup', name: 'Orbicular al gurii (superior)', lm: [[37], [267]], off: [0, 0], branch: 'buccal' },
  { key: 'depAnguli', name: 'Coborâtor al unghiului gurii', lm: [[43], [273]], off: [2, -3], branch: 'mandibular' },
  { key: 'depLabii', name: 'Coborâtor al buzei inferioare', lm: [[182], [406]], off: [0, -2], branch: 'mandibular' },
  { key: 'mentalis', name: 'Mentonier', lm: [[199], [199]], off: [6, 4], branch: 'mandibular' },
  { key: 'orbOrisInf', name: 'Orbicular al gurii (inferior)', lm: [[84], [314]], off: [0, 0], branch: 'mandibular' },
  { key: 'platysma', name: 'Platisma', lm: [[148], [377]], off: [16, -8], branch: 'cervical' },
  { key: 'levPalp', name: 'Ridicător al pleoapei superioare', lm: [[159], [386]], off: [0, 7], branch: 'III' },
  // Jaw: opened by the digastric and the lateral pterygoids, pushed forward and sideways by the
  // lateral pterygoids — all trigeminal (V3). Placed from the lower-cheek landmarks, not the
  // jaw-angle ones: MediaPipe's frontal projection grazes the silhouette there.
  { key: 'jawOpener', name: 'Digastric (coborâtorul mandibulei)', lm: [[123], [352]], off: [4, -14], branch: 'V3' },
  { key: 'pterygoidLat', name: 'Pterigoidian lateral', lm: [[123], [352]], off: [10, -6], branch: 'V3' },
];

/**
 * Functional units. `muscles`: which anatomical muscles do it. `au`: FACS code(s).
 * `out`: [shape, gain]. `_jawLateral` is a signed axis (chin to the subject's left > 0) that
 * becomes jawLeft / jawRight at the end: the two lateral pterygoids work against each other, and
 * two clipped one-way channels would lose that.
 */
export const UNITS = [
  { key: 'innerBrowRaise', ro: 'Ridică interiorul sprâncenei', au: 'AU1', muscles: ['frontalisMed'], out: [['browInnerUp', 0.5]] },
  { key: 'outerBrowRaise', ro: 'Ridică exteriorul sprâncenei', au: 'AU2', muscles: ['frontalisLat'], out: [['browOuterUp*', 1]] },
  { key: 'browKnit', ro: 'Coboară și apropie sprânceana', au: 'AU4', muscles: ['corrugator'], out: [['browDown*', 0.8]], twin: 'browLower' },
  { key: 'browLower', ro: 'Coboară capătul interior, cute la rădăcina nasului', au: 'AU4', muscles: ['procerus'], out: [['browDown*', 0.5]], twin: 'browKnit' },
  { key: 'lidRaise', ro: 'Ridică pleoapa superioară', au: 'AU5', muscles: ['levPalp'], out: [['eyeWide*', 1]] },
  { key: 'cheekRaise', ro: 'Ridică obrazul, încrețește la coada ochiului', au: 'AU6', muscles: ['orbOculiOrb'], out: [['cheekSquint*', 1]] },
  { key: 'lidTighten', ro: 'Încordează pleoapele', au: 'AU7', muscles: ['orbOculiPalp'], out: [['eyeSquint*', 1]] },
  { key: 'lidClose', ro: 'Închide pleoapa', au: 'AU43/45', muscles: ['orbOculiPalp'], out: [['eyeBlink*', 1]] },
  { key: 'noseWrinkle', ro: 'Încrețește nasul', au: 'AU9', muscles: ['levLabAlae'], out: [['noseSneer*', 1]] },
  { key: 'upperLipRaise', ro: 'Ridică buza superioară', au: 'AU10', muscles: ['levLab'], out: [['mouthUpperUp*', 1]] },
  { key: 'lipCornerPull', ro: 'Trage colțul gurii în sus și în afară', au: 'AU12', muscles: ['zygMajor'], out: [['mouthSmile*', 1]] },
  { key: 'dimple', ro: 'Strânge colțul gurii înapoi (gropiță)', au: 'AU14', muscles: ['buccinator'], out: [['mouthDimple*', 1]] },
  { key: 'lipCornerDepress', ro: 'Coboară colțul gurii', au: 'AU15', muscles: ['depAnguli'], out: [['mouthFrown*', 1]] },
  { key: 'lowerLipDepress', ro: 'Coboară buza inferioară', au: 'AU16', muscles: ['depLabii'], out: [['mouthLowerDown*', 1]] },
  { key: 'chinRaise', ro: 'Ridică bărbia și buza de jos', au: 'AU17', muscles: ['mentalis'], out: [['mouthShrugLower', 0.5]] },
  { key: 'upperLipShrug', ro: 'Împinge buza de sus în sus (cu bărbia)', au: 'AU17', muscles: ['mentalis', 'orbOrisSup'], out: [['mouthShrugUpper', 0.5]] },
  { key: 'lipPucker', ro: 'Țuguiază buzele', au: 'AU18', muscles: ['orbOrisSup', 'orbOrisInf'], out: [['mouthPucker', 0.5]] },
  { key: 'lipStretch', ro: 'Întinde buzele lateral', au: 'AU20', muscles: ['risorius'], out: [['mouthStretch*', 1]] },
  { key: 'neckTighten', ro: 'Încordează gâtul, trage colțul în jos', au: 'AU21', muscles: ['platysma'], out: [['mouthStretch*', 0.35], ['mouthLowerDown*', 0.2]], hidden: true },
  { key: 'lipFunnel', ro: 'Buze în pâlnie', au: 'AU22', muscles: ['orbOrisSup', 'orbOrisInf'], out: [['mouthFunnel', 0.5]] },
  { key: 'lipPress', ro: 'Presează buzele', au: 'AU23/24', muscles: ['orbOrisSup', 'orbOrisInf'], out: [['mouthPress*', 1]] },
  { key: 'upperLipRoll', ro: 'Rulează buza de sus spre interior', au: 'AU28', muscles: ['orbOrisSup'], out: [['mouthRollUpper', 0.5]] },
  { key: 'lowerLipRoll', ro: 'Rulează buza de jos spre interior', au: 'AU28', muscles: ['orbOrisInf'], out: [['mouthRollLower', 0.5]] },
  { key: 'lipSeal', ro: 'Ține buzele lipite cu gura deschisă', au: 'AU24+26', muscles: ['orbOrisSup', 'orbOrisInf'], out: [['mouthClose', 0.5]] },
  { key: 'jawDrop', ro: 'Coboară mandibula', au: 'AU26/27', muscles: ['jawOpener'], out: [['jawOpen', 0.5]] },
  // The right lateral pterygoid pulls the right condyle forward: the chin swings to the LEFT.
  { key: 'jawThrust', ro: 'Împinge mandibula înainte și în lateral', au: 'AU29/30', muscles: ['pterygoidLat'], out: [['jawForward', 0.5], ['_jawLateral', 1]] },
];

/** Shapes no mimic muscle makes: passed through unchanged. */
export const PASSTHROUGH = BLENDSHAPES.filter((n) => /^eyeLook/.test(n) || n === 'cheekPuff' || n === 'mouthLeft' || n === 'mouthRight');

export const SIDES = ['R', 'L'];
const SUFFIX = { R: 'Right', L: 'Left' };

/** Unit channels: one per unit per side, `${unit}${side}`. */
export const CHANNELS = UNITS.flatMap((u) => SIDES.map((s) => ({ key: u.key + s, unit: u, side: s })));
const NSHAPE = BLENDSHAPES.length;
const SHAPE_INDEX = Object.fromEntries(BLENDSHAPES.map((n, i) => [n, i]));
const LAT = NSHAPE; // virtual row: signed jaw lateral
const JAW_L = SHAPE_INDEX.jawLeft, JAW_R = SHAPE_INDEX.jawRight;
const ROWS = NSHAPE + 1;

// Sparse forward matrix: for every channel, the shapes it moves and by how much.
const COLS = CHANNELS.map(({ unit, side }) => unit.out.map(([shape, g]) => {
  // The right pterygoid swings the chin to the left (+), the left one to the right (-).
  if (shape === '_jawLateral') return [LAT, side === 'R' ? g : -g];
  const name = shape.endsWith('*') ? shape.slice(0, -1) + SUFFIX[side] : shape;
  const i = SHAPE_INDEX[name];
  if (i === undefined) throw new Error(`muscles: unknown blendshape ${name}`);
  return [i, g];
}));
const COLNORM = COLS.map((c) => c.reduce((s, [, g]) => s + g * g, 0));

// Inverse variables. Channels ARKit cannot tell apart are perfectly collinear: least squares has
// no unique answer for them, and coordinate descent would split them by visiting order (all of a
// bilateral AU1 on the right side, none on the left). So they are solved as one variable with
// equal activation: both sides of a unit that only moves bilateral shapes, and declared twins on
// the same side. Hidden units are not solved at all.
const VARS = [];
{
  const taken = new Set();
  const bilateralOnly = (u) => u.out.every(([shape]) => !shape.endsWith('*') && shape !== '_jawLateral');
  CHANNELS.forEach((ch, c) => {
    if (taken.has(c) || ch.unit.hidden) return;
    const group = [c];
    if (bilateralOnly(ch.unit)) group.push(CHANNELS.findIndex((x) => x.unit === ch.unit && x.side !== ch.side));
    if (ch.unit.twin) group.push(CHANNELS.findIndex((x) => x.unit.key === ch.unit.twin && x.side === ch.side));
    group.forEach((g) => taken.add(g));
    const col = new Map();
    for (const g of group) for (const [i, v] of COLS[g]) col.set(i, (col.get(i) ?? 0) + v);
    const entries = [...col];
    VARS.push({ chs: group, col: entries, norm: entries.reduce((sum, [, v]) => sum + v * v, 0) });
  });
}

/** Shapes the muscle layer explains (everything except the passthrough ones and _neutral). */
export const MUSCLE_SHAPES = BLENDSHAPES.filter((n, i) => COLS.some((c) => c.some(([j]) => j === i || (j === LAT && (i === JAW_L || i === JAW_R)))));

/**
 * Forward: unit activations -> blendshape weights.
 * @param {ArrayLike<number>} a   one value per CHANNELS entry, 0..1
 * @param {Record<string, number>} [pass] passthrough shapes to carry over (gaze, cheekPuff...)
 */
export function musclesToWeights(a, pass = null) {
  const v = new Float64Array(ROWS);
  for (let c = 0; c < COLS.length; c++) {
    const x = a[c];
    if (!x) continue;
    for (const [i, g] of COLS[c]) v[i] += g * x;
  }
  v[JAW_L] += Math.max(0, v[LAT]);
  v[JAW_R] += Math.max(0, -v[LAT]);
  const w = {};
  for (let i = 0; i < NSHAPE; i++) {
    const val = Math.min(1, Math.max(0, v[i]));
    if (val > 1e-4) w[BLENDSHAPES[i]] = val;
  }
  if (pass) for (const n of PASSTHROUGH) if (pass[n]) w[n] = pass[n];
  return w;
}

/**
 * Inverse: blendshape weights -> unit activations, by bounded least squares
 * (min |M a - w|^2 + lambda |a|^2, 0 <= a <= 1) with projected coordinate descent. A few dozen
 * channels with 1-3 shapes each: microseconds per call, fine every frame.
 * @param {Record<string, number>} w
 * @param {object} [o] { out: Float32Array to reuse (also the warm start), iters, lambda }
 */
export function weightsToMuscles(w, { out = new Float32Array(CHANNELS.length), iters = 40, lambda = 0.002 } = {}) {
  const target = new Float64Array(ROWS);
  for (const [n, v] of Object.entries(w)) { const i = SHAPE_INDEX[n]; if (i !== undefined) target[i] = v; }
  target[LAT] = target[JAW_L] - target[JAW_R];
  target[JAW_L] = target[JAW_R] = 0;
  // Residual r = target - M a, kept up to date as variables change. Warm start from `out`
  // (each variable starts at the mean of its channels).
  const r = Float64Array.from(target);
  const x = VARS.map((v) => v.chs.reduce((sum, c) => sum + out[c], 0) / v.chs.length);
  VARS.forEach((v, k) => { if (x[k]) for (const [i, g] of v.col) r[i] -= g * x[k]; });
  for (let it = 0; it < iters; it++) {
    let moved = 0;
    for (let k = 0; k < VARS.length; k++) {
      const { col, norm } = VARS[k];
      let dot = 0;
      for (const [i, g] of col) dot += g * r[i];
      const old = x[k];
      const next = Math.min(1, Math.max(0, (dot + norm * old) / (norm + lambda)));
      if (next === old) continue;
      for (const [i, g] of col) r[i] -= g * (next - old);
      x[k] = next;
      moved = Math.max(moved, Math.abs(next - old));
    }
    if (moved < 1e-5) break;
  }
  out.fill(0);
  VARS.forEach((v, k) => { for (const c of v.chs) out[c] = x[k]; });
  return out;
}

/** Per anatomical muscle and side: the strongest of the units it takes part in. */
export function muscleActivity(a) {
  const act = {};
  CHANNELS.forEach(({ unit, side }, c) => {
    for (const m of unit.muscles) act[m + side] = Math.max(act[m + side] ?? 0, a[c]);
  });
  return act;
}

/** Channel index by key, e.g. CH.lipCornerPullR. */
export const CH = Object.fromEntries(CHANNELS.map((c, i) => [c.key, i]));

/** Activations from a { unitKey: value } map (both sides) or { unitKeyR: value } (one side). */
export function activations(spec) {
  const a = new Float32Array(CHANNELS.length);
  for (const [k, v] of Object.entries(spec)) {
    if (CH[k] !== undefined) a[CH[k]] = v;
    else if (CH[k + 'R'] !== undefined) { a[CH[k + 'R']] = v; a[CH[k + 'L']] = v; }
    else throw new Error(`muscles: unknown unit ${k}`);
  }
  return a;
}
