/*
 * Neuromotor network: the pathway an emotion takes to reach the skin, 7 levels deep.
 *
 *   emotion prototypes -> limbic system -> facial motor cortex -> brainstem nuclei
 *   -> cranial nerves (the 5 branches of VII, plus III and V3) -> mimic muscles -> skin
 *
 * The existing surface network (network.js) is the last level: every muscle projects onto the
 * skin nodes lying over it.
 *
 * Anatomy that shapes the wiring (and is visible in how the signal flows):
 *   - The facial nucleus has an upper-face part (forehead, brows, orbicularis oculi) and a
 *     lower-face part. The upper part gets input from the motor cortex of BOTH hemispheres; the
 *     lower part only from the OPPOSITE one. This is why a cortical stroke spares the forehead.
 *   - The five branches of VII fan out from the parotid (pes anserinus): temporal, zygomatic,
 *     buccal, marginal mandibular, cervical. Each serves its own muscles.
 *   - The upper lid is raised by levator palpebrae, innervated by III (oculomotor), not VII.
 *     The jaw is opened by muscles of V3 (trigeminal), not VII.
 *
 * Activation runs backwards from what the face is doing: muscle activity comes from the
 * blendshape weights (their FACS action units), each structure upstream is as active as the
 * muscles it drives, and the emotion level shows how well the current face matches each
 * prototype. A pathway lights only where both of its ends are active, so a sad face lights the
 * temporal branch to the brows and the mandibular branch to the chin — and nothing else.
 *
 * Pure data (no three.js); positions are in scan (model) units.
 */

import { landmarkNormals } from '../emotion/faceBasis.js';
import { EMOTIONS } from '../emotion/emotions.js';
import { mniToModel } from '../brain/atlas.js';
import { MUSCLES, UNITS, weightsToMuscles, muscleActivity, CHANNELS } from '../muscle/muscles.js';

export const LEVELS = [
  { key: 'emotion', name: 'Emoții', color: '#ffd166' },
  { key: 'limbic', name: 'Sistem limbic', color: '#c77dff' },
  { key: 'cortex', name: 'Cortex motor facial', color: '#7c9bff' },
  { key: 'nucleus', name: 'Nuclei (trunchi cerebral)', color: '#9ff3ff' },
  { key: 'nerve', name: 'Nervi cranieni', color: '#ffe8a3' },
  { key: 'muscle', name: 'Mușchi mimici', color: '#ff7a6b' },
  { key: 'skin', name: 'Piele', color: '#9ff3ff' },
];
const L = Object.fromEntries(LEVELS.map((l, i) => [l.key, i]));

// Labels and one-line explanations for the brain structures (levels limbic, cortex, nucleus),
// shown as floating labels in 3D (brainLabels.js) and in the inspector. Study guide in the vault:
// "Ghid de studiu - părțile creierului".
export const BRAIN_INFO = {
  amygdala: { label: 'Amigdala', info: 'Detectează rapid ce e important (amenințări, recompense, fețe) și pornește reacția emoțională. Trimite semnalul spre cortex și spre trunchiul cerebral.' },
  cingulate: { label: 'Cortex cingular anterior', info: 'Leagă emoția de acțiune. Aria lui motorie trimite comanda EMOȚIONALĂ spre nucleul facial, mai ales pentru frunte și pleoape.' },
  cortex: { label: 'Cortex motor (fața)', info: 'Aria feței din girusul precentral: comanda VOLUNTARĂ a expresiei (zâmbetul „la comandă”). Fața de jos o controlează doar din emisfera opusă.' },
  VIIsup: { label: 'Nucleul facial · sus', info: 'Partea nucleului nervului facial (VII) pentru frunte, sprâncene și pleoape. Primește comenzi din AMBELE emisfere, de aceea un AVC cortical cruță fruntea.' },
  VIIinf: { label: 'Nucleul facial · jos', info: 'Partea nucleului nervului facial (VII) pentru obraji, buze și bărbie. Primește comenzi doar din emisfera OPUSĂ.' },
  Vm: { label: 'Nucleul motor trigemen (V)', info: 'Comandă mușchii masticatori prin nervul V3: deschiderea gurii și mișcările maxilarului.' },
  III: { label: 'Nucleul oculomotor (III)', info: 'În mezencefal. Prin nervul III ridică pleoapa superioară (ochii larg deschiși la surpriză și frică) și mișcă globul ocular.' },
};

const EMOTION_KEYS = ['sad', 'joy', 'surprise', 'fear', 'anger', 'disgust', 'contempt'];
const EMOTION_COLOR = {
  sad: '#6fa8ff', joy: '#ffd166', surprise: '#7ff0ff', fear: '#b28dff', anger: '#ff5d5d', disgust: '#7ddf64', contempt: '#ffa45c',
};

// Mimic and jaw muscles: js/muscle/muscles.js, the face's source of truth. Their activation is
// computed there (blendshapes -> functional units -> muscles), not guessed here.

const BRANCHES = [
  { key: 'temporal', name: 'N. VII · ramura temporală', nucleus: 'VIIsup' },
  { key: 'zygomatic', name: 'N. VII · ramura zigomatică', nucleus: 'VIIinf' },
  { key: 'buccal', name: 'N. VII · ramura bucală', nucleus: 'VIIinf' },
  { key: 'mandibular', name: 'N. VII · ramura marginală a mandibulei', nucleus: 'VIIinf' },
  { key: 'cervical', name: 'N. VII · ramura cervicală', nucleus: 'VIIinf' },
  { key: 'III', name: 'N. III · oculomotor', nucleus: 'III' },
  { key: 'V3', name: 'N. V3 · mandibular (motor)', nucleus: 'Vm' },
];

/**
 * @param {object} o
 * @param {ArrayLike<number|null>} o.anchors scan-space landmarks (478 * 3)
 * @param {object} o.frame faceBasis frame ({ origin, unitsPerMM })
 * @param {object} o.net the surface network (network.js): skin level targets
 */
export function buildNeuromotor({ anchors, frame, net }) {
  const u = frame.unitsPerMM;
  const mx = frame.origin[0];
  const normals = landmarkNormals(anchors);
  const nodes = [];
  const edges = [];
  const add = (level, key, name, pos, extra = {}) => {
    // Brain structures carry a label + explanation; the key is the base key plus an R/L suffix.
    const bi = level >= L.limbic && level <= L.nucleus ? BRAIN_INFO[key.replace(/[RL]$/, '')] : null;
    const side = bi && /[RL]$/.test(key) && BRAIN_INFO[key] === undefined ? key.slice(-1) : extra.side;
    nodes.push({ id: nodes.length, level, key, name, pos, color: extra.color ?? LEVELS[level].color, ...extra, side, ...(bi ? { label: bi.label, info: bi.info } : {}) });
    return nodes.length - 1;
  };
  // Mirror about the face midline; s = -1 subject's right, +1 subject's left.
  const X = (s, d) => mx + s * d;
  const SIDE = [['R', -1, 'dreapta'], ['L', 1, 'stânga']];

  // Surface point of landmark(s) + mm offset, sunk under the skin along the local normal.
  const underSkin = (ids, off, s, depthMM = 3) => {
    const p = [0, 0, 0], n = [0, 0, 0];
    for (const i of ids) for (let c = 0; c < 3; c++) { p[c] += anchors[i * 3 + c] / ids.length; n[c] += normals[i * 3 + c] / ids.length; }
    p[0] += off[0] * s * u; // s = -1 on the right, so +lateral moves toward -X there
    p[1] += off[1] * u;
    const nl = Math.hypot(n[0], n[1], n[2]) || 1;
    for (let c = 0; c < 3; c++) p[c] -= (n[c] / nl) * depthMM * u;
    return p;
  };

  // 1. Emotion prototypes: a row across the top of the brain.
  const emo = {};
  EMOTION_KEYS.forEach((k, i) => {
    const a = Math.PI * (0.12 + 0.76 * (i / (EMOTION_KEYS.length - 1)));
    emo[k] = add(L.emotion, k, EMOTIONS[k].name, [mx - 0.95 * Math.cos(a), 3.05 + 0.18 * Math.sin(a), 0.35 + 0.35 * Math.sin(a)], { color: EMOTION_COLOR[k] });
  });

  // 2-4. Anatomical structures at their MNI positions, the same registration the emotional-brain
  // atlas uses (brain/atlas.js), so both tabs put the amygdala, the cortex and the nuclei in the
  // same place. MNI +x is the subject's RIGHT: side s = -1 (right) takes +x.
  const mni = (x, y, z) => mniToModel([x, y, z], mx);
  const amyg = {}, cortex = {}, VIIsup = {}, VIIinf = {}, Vm = {};
  for (const [S, s, sn] of SIDE) amyg[S] = add(L.limbic, 'amygdala' + S, `Amigdala ${sn}`, mni(-s * 23, -5, -18));
  const cing = add(L.limbic, 'cingulate', 'Cortex cingular anterior', mni(0, 22, 34));

  // Facial motor cortex (face area of the precentral gyrus), one per hemisphere.
  for (const [S, s, sn] of SIDE) cortex[S] = add(L.cortex, 'cortex' + S, `Cortex motor facial ${sn}`, mni(-s * 54, -8, 32));

  // Brainstem nuclei: facial (upper- and lower-face parts, caudal pons), oculomotor (midbrain),
  // motor trigeminal (pons). Positions approximate; the nuclei are millimetres across.
  for (const [S, s, sn] of SIDE) {
    VIIsup[S] = add(L.nucleus, 'VIIsup' + S, `Nucleul facial (fața superioară) ${sn}`, mni(-s * 12, -37, -37));
    VIIinf[S] = add(L.nucleus, 'VIIinf' + S, `Nucleul facial (fața inferioară) ${sn}`, mni(-s * 12, -39, -43));
    Vm[S] = add(L.nucleus, 'Vm' + S, `Nucleul motor al trigemenului ${sn}`, mni(-s * 9, -32, -32));
  }
  const III = add(L.nucleus, 'III', 'Nucleul oculomotor', mni(0, -26, -8));

  // 5. Nerves. VII: nucleus -> internal acoustic meatus -> stylomastoid foramen -> parotid
  // (pes anserinus) -> the five branches, each at the edge of the face it serves.
  const branchPos = {
    temporal: [1.3, 1.95, 0.85], zygomatic: [1.25, 1.2, 1.1], buccal: [1.1, 0.55, 1.3],
    mandibular: [1.0, -0.1, 1.1], cervical: [1.05, -0.9, 0.6], III: [0.55, 1.62, 1.35], V3: [1.05, 0.55, 0.65],
  };
  const branch = {};
  for (const [S, s, sn] of SIDE) {
    for (const b of BRANCHES) {
      const p = branchPos[b.key];
      branch[b.key + S] = add(L.nerve, b.key + S, `${b.name} (${sn})`, [X(s, p[0]), p[1], p[2]], { branch: b.key, side: S });
    }
  }

  // 6. Muscles.
  const muscles = [];
  for (const [S, s, sn] of SIDE) {
    for (const m of MUSCLES) {
      const pos = underSkin(m.lm[S === 'R' ? 0 : 1], m.off, s);
      // What it does, unit by unit, with FACS codes: shown in the inspector.
      const info = UNITS.filter((x) => x.muscles.includes(m.key)).map((x) => `${x.au}: ${x.ro.toLowerCase()}`).join(' · ')
        + ({ III: ' · Nervul III (oculomotor).', V3: ' · Nervul V3 (trigemen, ramura mandibulară).' }[m.branch] ?? ` · Nervul VII, ramura ${m.branch === 'mandibular' ? 'marginală a mandibulei' : m.branch === 'temporal' ? 'temporală' : m.branch === 'zygomatic' ? 'zigomatică' : m.branch === 'buccal' ? 'bucală' : 'cervicală'}.`);
      const id = add(L.muscle, m.key + S, `${m.name} (${sn})`, pos, { side: S, info });
      muscles.push({ id, side: S, key: m.key + S, branch: branch[m.branch + S] });
    }
  }

  // ---------- wiring ----------
  // `via` = intermediate route points (model units) the fibre bends through.
  const link = (a, b, via = []) => edges.push({ a, b, via });
  for (const k of EMOTION_KEYS) {
    for (const S of ['R', 'L']) link(emo[k], amyg[S]);
    link(emo[k], cing);
  }
  for (const [S] of SIDE) {
    link(amyg[S], cortex[S]);
    link(amyg[S], cortex[S === 'R' ? 'L' : 'R']);
    link(cing, cortex[S]);
  }
  for (const [S] of SIDE) {
    const O = S === 'R' ? 'L' : 'R';
    // Corticobulbar fibres descend through the internal capsule and cross in the brainstem.
    const capsule = (side) => [[X(side === 'R' ? -1 : 1, 0.55), 2.0, -0.1]];
    link(cortex[S], VIIinf[O], capsule(S));            // lower face: contralateral only
    link(cortex[S], VIIsup[O], capsule(S));            // upper face: both sides
    link(cortex[S], VIIsup[S], capsule(S));
    link(cortex[S], Vm[S], capsule(S));
    link(cortex[S], Vm[O], capsule(S));
    link(cortex[S], III, capsule(S));
  }
  for (const [S, s] of SIDE) {
    const meatus = [X(s, 1.05), 1.2, -0.3];
    const stylo = [X(s, 1.35), 0.7, -0.35];
    const parotid = [X(s, 1.45), 0.75, 0.3];
    for (const b of ['temporal']) link(VIIsup[S], branch[b + S], [meatus, stylo, parotid]);
    for (const b of ['zygomatic', 'buccal', 'mandibular', 'cervical']) link(VIIinf[S], branch[b + S], [meatus, stylo, parotid]);
    link(III, branch['III' + S], [[X(s, 0.35), 1.6, 0.4]]);
    link(Vm[S], branch['V3' + S], [[X(s, 0.75), 0.85, 0.1]]);
  }
  for (const m of muscles) link(m.branch, m.id);

  // 7. Skin: each muscle projects onto the surface-network nodes over it.
  const skin = [];
  const np = net.positions;
  for (const m of muscles) {
    const p = nodes[m.id].pos;
    const cand = [];
    for (let j = 0; j < net.count; j++) {
      if (net.layers[j] !== 0) continue;
      const d = Math.hypot(np[j * 3] - p[0], np[j * 3 + 1] - p[1], np[j * 3 + 2] - p[2]);
      if (d < 14 * u) cand.push([d, j]);
    }
    cand.sort((a, b) => a[0] - b[0]);
    for (const [, j] of cand.slice(0, 7)) skin.push({ muscle: m.id, net: j });
  }

  // Children of each node along the wiring, computed once.
  const children = nodes.map(() => []);
  for (const e of edges) children[e.a].push(e.b);
  const ofLevel = (lv) => nodes.filter((n) => n.level === lv).map((n) => n.id);
  const nerveIds = ofLevel(L.nerve), nucleusIds = ofLevel(L.nucleus), cortexIds = ofLevel(L.cortex), limbicIds = ofLevel(L.limbic);

  const act = new Float32Array(nodes.length);
  const edgeAct = new Float32Array(edges.length);
  const skinAct = new Float32Array(skin.length);
  const byKey = Object.fromEntries(nodes.map((n) => [n.key, n.id]));
  const units = new Float32Array(CHANNELS.length); // functional-unit activations, warm-started

  /**
   * Update activations from blendshape weights and emotion recognition scores.
   * @param {Record<string, number>} w
   * @param {{key: string, p: number}[]} recog from emotions.recognise (optional)
   */
  function compute(w, recog = []) {
    act.fill(0);
    const clamp = (v) => Math.min(1, Math.max(0, v));
    weightsToMuscles(w, { out: units, iters: 12 });
    const mAct = muscleActivity(units);
    for (const m of muscles) act[m.id] = clamp(mAct[m.key] ?? 0);
    // Upstream: each structure is as active as the strongest thing it drives (plus a little of
    // the rest, so several active muscles on one branch read as more than one).
    const up = (id, kids) => {
      let mxv = 0, sum = 0;
      for (const k of kids) { mxv = Math.max(mxv, act[k]); sum += act[k]; }
      act[id] = clamp(mxv * 0.85 + sum * 0.15);
    };
    for (const id of nerveIds) up(id, children[id]);
    for (const id of nucleusIds) up(id, children[id]);
    for (const id of cortexIds) up(id, children[id]);
    // Emotions: how well the face matches each prototype, scaled by how much it is doing.
    let drive = 0;
    for (const id of cortexIds) drive = Math.max(drive, act[id]);
    for (const r of recog) if (byKey[r.key] !== undefined && nodes[byKey[r.key]].level === L.emotion) act[byKey[r.key]] = clamp(r.p * 1.4) * clamp(drive * 1.6);
    let e = 0;
    for (const k of EMOTION_KEYS) e = Math.max(e, act[emo[k]]);
    for (const id of limbicIds) act[id] = clamp(Math.max(e, drive * 0.6));
    edges.forEach((e, k) => { edgeAct[k] = Math.min(act[e.a], act[e.b]); });
    skin.forEach((s, k) => { skinAct[k] = act[s.muscle]; });
    return act;
  }

  /** The most active chains from emotion to muscle, for the caption. */
  function topPaths(n = 3) {
    const out = [];
    for (const m of muscles) {
      if (act[m.id] < 0.15) continue;
      const br = m.branch;
      const nuc = edges.find((e) => e.b === br)?.a;
      out.push({ muscle: nodes[m.id].name, branch: nodes[br].name, nucleus: nuc !== undefined ? nodes[nuc].name : '', v: act[m.id] });
    }
    return out.sort((a, b) => b.v - a.v).slice(0, n);
  }

  return {
    levels: LEVELS, nodes, edges, skin, muscles, units, act, edgeAct, skinAct, compute, topPaths,
    counts: { nodes: nodes.length, edges: edges.length + skin.length, levels: LEVELS.length },
  };
}
