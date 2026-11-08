/*
 * Emotions as muscle activity, and the small involuntary motion that keeps a face alive.
 *
 * Each emotion is a set of blendshape weights built from the FACS prototypes (Ekman & Friesen's
 * EMFACS), plus the head pose, gaze and blink behaviour that go with it. What makes these read as
 * real rather than generated is mostly what is NOT exaggerated:
 *   - Sadness is carried by the oblique brow (AU1 + AU4), heavy lids, corners pulled down (AU15)
 *     and the chin pushing up (AU17). The middle of the mouth stays level; the eyes look down.
 *   - A felt smile involves the eyes (AU6). A smile without AU6 is the polite, social one.
 *   - No real face is symmetric, and no real face is still. Presets carry their own small
 *     asymmetries, and the performer adds blinks, breathing, saccades and drift on top.
 */

import { BLENDSHAPES } from '../live/landmarkSets.js';

const DEG = Math.PI / 180;
export const SHAPE_NAMES = BLENDSHAPES.filter((n) => n !== '_neutral');

/** Which control group a blendshape belongs to (for the "work on the face" sliders). */
export function groupOf(name) {
  if (name.startsWith('brow')) return 'brows';
  if (name.startsWith('eye') || name.startsWith('cheekSquint')) return 'eyes';
  if (name === 'mouthShrugLower' || name.startsWith('jaw') || name === 'mouthRollLower') return 'chin';
  if (name.startsWith('mouth') || name.startsWith('noseSneer') || name === 'cheekPuff') return 'mouth';
  return 'mouth';
}

/**
 * Expression description:
 *   w      blendshape weights (both sides may be given separately; asymmetry is intentional)
 *   head   degrees: pitch > 0 chin down, yaw > 0 turned to own left, roll > 0 tilted to own right
 *   gaze   radians: [yaw, pitch], pitch > 0 looking down
 *   life   behaviour: blink interval (s), blink duration (s), breath period (s), gaze wander,
 *          and optional chin tremor
 *   skin   flush / wet for crying
 */
export const EMOTIONS = {
  neutral: {
    name: 'Neutru',
    w: { eyeBlinkLeft: 0.06, eyeBlinkRight: 0.08, mouthPressLeft: 0.04, mouthRollLower: 0.03 },
    head: { pitch: 1, yaw: 0, roll: 0.6 },
    gaze: [0, 0.02],
    life: { blinkEvery: 3.8, blinkDur: 0.24, breath: 4.2, wander: 1 },
  },

  // ---- sadness, three depths ----
  // The brow carries sadness: AU1 lifts the inner ends into the oblique "grief" line. AU4 is kept
  // light — it knits the brows together, but its lowering pull fights AU1 at exactly the inner end
  // where the lift must show. The head bows only a little: bowed further, it foreshortens the
  // forehead and hides the brow from anyone facing the person.
  // Measured through an independent face model (tools/roundtrip.js): with every sad muscle on and
  // the head level it read the inner-brow raise at 0.19; bowing 6.5 degrees dropped it to 0.04,
  // and AU4 at 0.2 alone cost a third of it. Hence the light AU4 and the small bow.
  melancholy: {
    name: 'Melancolie',
    family: 'sad',
    w: {
      browInnerUp: 0.72, browDownLeft: 0.04, browDownRight: 0.06,
      eyeBlinkLeft: 0.24, eyeBlinkRight: 0.27,
      mouthFrownLeft: 0.24, mouthFrownRight: 0.3, mouthShrugLower: 0.22, mouthPressLeft: 0.12, mouthPressRight: 0.1,
      mouthRollLower: 0.06,
    },
    head: { pitch: 2, yaw: -3, roll: 2.5 },
    gaze: [0.05, 0.13],
    life: { blinkEvery: 4.6, blinkDur: 0.34, breath: 5.2, wander: 0.7 },
  },
  sad: {
    name: 'Tristețe',
    family: 'sad',
    w: {
      browInnerUp: 0.92, browDownLeft: 0.08, browDownRight: 0.11,
      eyeBlinkLeft: 0.33, eyeBlinkRight: 0.37, eyeSquintLeft: 0.16, eyeSquintRight: 0.2,
      cheekSquintLeft: 0.05, cheekSquintRight: 0.08,
      mouthFrownLeft: 0.5, mouthFrownRight: 0.58, mouthShrugLower: 0.46,
      mouthPressLeft: 0.2, mouthPressRight: 0.16, mouthRollLower: 0.08, mouthLowerDownRight: 0.05,
      noseSneerLeft: 0.03, noseSneerRight: 0.05,
    },
    head: { pitch: 3, yaw: -4, roll: 3.5 },
    gaze: [0.07, 0.2],
    life: { blinkEvery: 5, blinkDur: 0.42, breath: 5.8, wander: 0.55 },
  },
  grief: {
    name: 'Durere',
    family: 'sad',
    w: {
      browInnerUp: 1, browDownLeft: 0.2, browDownRight: 0.25,
      eyeBlinkLeft: 0.3, eyeBlinkRight: 0.35, eyeSquintLeft: 0.26, eyeSquintRight: 0.3,
      cheekSquintLeft: 0.24, cheekSquintRight: 0.28,
      mouthFrownLeft: 0.68, mouthFrownRight: 0.76, mouthShrugLower: 0.72, mouthStretchLeft: 0.16,
      mouthStretchRight: 0.22, mouthUpperUpLeft: 0.12, mouthUpperUpRight: 0.16, mouthPressLeft: 0.12,
      mouthPressRight: 0.1, noseSneerLeft: 0.12, noseSneerRight: 0.16, mouthLowerDownRight: 0.06,
    },
    head: { pitch: 5, yaw: -5, roll: 4.5 },
    gaze: [0.09, 0.26],
    life: { blinkEvery: 3.2, blinkDur: 0.5, breath: 3.4, wander: 0.4, tremor: 0.07 },
    skin: { flush: 0.55, wet: 0.8 },
  },

  // A felt (Duchenne) smile is a strong AU12 with AU6 at the eyes. At ~0.7 an independent face
  // model barely registered the smile and read the narrowed eyes as a glare.
  joy: {
    name: 'Bucurie',
    w: {
      mouthSmileLeft: 0.92, mouthSmileRight: 0.85, cheekSquintLeft: 0.55, cheekSquintRight: 0.5,
      eyeSquintLeft: 0.28, eyeSquintRight: 0.25, eyeBlinkLeft: 0.1, eyeBlinkRight: 0.09,
      mouthUpperUpLeft: 0.1, mouthUpperUpRight: 0.08, jawOpen: 0.07, browDownLeft: 0.04, browDownRight: 0.04,
      mouthDimpleLeft: 0.12, mouthDimpleRight: 0.1,
    },
    head: { pitch: -2, yaw: 2, roll: -3 },
    gaze: [0, -0.01],
    life: { blinkEvery: 3.4, blinkDur: 0.22, breath: 3.8, wander: 1 },
  },
  surprise: {
    name: 'Surpriză',
    w: {
      browInnerUp: 0.88, browOuterUpLeft: 0.82, browOuterUpRight: 0.78, eyeWideLeft: 0.7, eyeWideRight: 0.66,
      jawOpen: 0.32, mouthFunnel: 0.08, mouthStretchLeft: 0.05, mouthStretchRight: 0.05,
    },
    head: { pitch: -4, yaw: 0, roll: 0 },
    gaze: [0, -0.02],
    life: { blinkEvery: 6, blinkDur: 0.2, breath: 3.2, wander: 0.4 },
  },
  fear: {
    name: 'Frică',
    w: {
      browInnerUp: 0.84, browOuterUpLeft: 0.42, browOuterUpRight: 0.38, browDownLeft: 0.32, browDownRight: 0.36,
      eyeWideLeft: 0.78, eyeWideRight: 0.74, mouthStretchLeft: 0.5, mouthStretchRight: 0.56, jawOpen: 0.18,
      mouthLowerDownLeft: 0.16, mouthLowerDownRight: 0.2, mouthPressLeft: 0.05,
    },
    head: { pitch: -3, yaw: 3, roll: 0 },
    gaze: [-0.04, -0.01],
    life: { blinkEvery: 2.6, blinkDur: 0.18, breath: 2.6, wander: 1.4 },
  },
  anger: {
    name: 'Furie',
    w: {
      browDownLeft: 0.82, browDownRight: 0.78, eyeWideLeft: 0.22, eyeWideRight: 0.2, eyeSquintLeft: 0.44,
      eyeSquintRight: 0.4, mouthPressLeft: 0.6, mouthPressRight: 0.56, mouthRollLower: 0.12, noseSneerLeft: 0.18,
      noseSneerRight: 0.22, jawForward: 0.1, mouthShrugLower: 0.2,
    },
    head: { pitch: 5, yaw: 0, roll: 0 },
    gaze: [0, -0.1],
    life: { blinkEvery: 6.5, blinkDur: 0.2, breath: 3, wander: 0.3 },
  },
  disgust: {
    name: 'Dezgust',
    w: {
      noseSneerLeft: 0.66, noseSneerRight: 0.58, mouthUpperUpLeft: 0.52, mouthUpperUpRight: 0.42, browDownLeft: 0.38,
      browDownRight: 0.34, eyeSquintLeft: 0.36, eyeSquintRight: 0.3, cheekSquintLeft: 0.28, cheekSquintRight: 0.22,
      mouthFrownLeft: 0.22, mouthFrownRight: 0.18, mouthShrugLower: 0.28,
    },
    head: { pitch: -2, yaw: -6, roll: 2 },
    gaze: [0.05, 0],
    life: { blinkEvery: 4, blinkDur: 0.26, breath: 3.8, wander: 0.8 },
  },
  contempt: {
    name: 'Dispreț',
    // Unilateral by definition (AU14 on one side).
    w: {
      mouthDimpleRight: 0.62, mouthSmileRight: 0.22, mouthPressLeft: 0.12, eyeSquintLeft: 0.1, eyeSquintRight: 0.14,
      browDownLeft: 0.05, eyeBlinkLeft: 0.1, eyeBlinkRight: 0.14,
    },
    head: { pitch: -5, yaw: 6, roll: -3 },
    gaze: [-0.06, 0.03],
    life: { blinkEvery: 4.5, blinkDur: 0.26, breath: 4.4, wander: 0.5 },
  },
};

/** Order shown in the UI; the sad family is shown as one entry with a depth control. */
export const EMOTION_ORDER = ['neutral', 'sad', 'joy', 'surprise', 'fear', 'anger', 'disgust', 'contempt'];
export const SAD_DEPTHS = ['melancholy', 'sad', 'grief'];

// ---------------------------------------------------------------------------------------------
// Recognition: which emotion a set of weights (e.g. from a photo) is closest to.
// Cosine similarity on side-averaged weights, ignoring eye-look and blink (they say where and
// whether someone is looking, not what they feel). Contempt is judged on its asymmetry instead.
// ---------------------------------------------------------------------------------------------
const IGNORE = /^(eyeLook|eyeBlink|_neutral)/;
function features(w) {
  const f = {};
  for (const n of SHAPE_NAMES) {
    if (IGNORE.test(n)) continue;
    const base = n.replace(/(Left|Right)$/, '');
    f[base] = (f[base] ?? 0) + (w[n] ?? 0) / (n === base ? 1 : 2);
  }
  return f;
}
const cosine = (a, b) => {
  let d = 0, na = 0, nb = 0;
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[k] ?? 0, y = b[k] ?? 0;
    d += x * y; na += x * x; nb += y * y;
  }
  return na && nb ? d / Math.sqrt(na * nb) : 0;
};

export function recognise(w) {
  const f = features(w);
  const activity = Object.values(f).reduce((s, v) => s + v, 0);
  const scores = [];
  for (const key of ['sad', 'joy', 'surprise', 'fear', 'anger', 'disgust']) {
    scores.push({ key, name: EMOTIONS[key].name, score: Math.max(0, cosine(f, features(EMOTIONS[key].w))) });
  }
  const asym = Math.abs((w.mouthDimpleLeft ?? 0) - (w.mouthDimpleRight ?? 0)) + 0.5 * Math.abs((w.mouthSmileLeft ?? 0) - (w.mouthSmileRight ?? 0));
  scores.push({ key: 'contempt', name: EMOTIONS.contempt.name, score: Math.min(1, asym * 1.6) });
  // A face with little muscle activity is neutral, whatever it is faintly similar to.
  scores.push({ key: 'neutral', name: EMOTIONS.neutral.name, score: Math.max(0, 1 - activity / 1.2) });
  const sum = scores.reduce((s, x) => s + x.score ** 3, 0) || 1;
  return scores.map((x) => ({ ...x, p: x.score ** 3 / sum })).sort((a, b) => b.p - a.p);
}

// ---------------------------------------------------------------------------------------------
// Performer: turns a target expression into a living one, frame by frame.
// ---------------------------------------------------------------------------------------------

// Seeded pseudo-random, so a given face "has" the same idiosyncrasies every session.
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
// Smooth 1-D noise: a sum of incommensurate sines with random phases (cheap, never repeats visibly).
function noise1(seed) {
  const r = rng(seed);
  const ph = [r(), r(), r(), r()].map((x) => x * Math.PI * 2);
  return (t) => (Math.sin(t * 0.31 + ph[0]) * 0.5 + Math.sin(t * 0.73 + ph[1]) * 0.3 + Math.sin(t * 1.37 + ph[2]) * 0.15 + Math.sin(t * 2.9 + ph[3]) * 0.05);
}

// How fast each part of the face follows a change of expression (per second). The brows lead,
// the mouth and chin follow, the head settles last — the order in which a feeling arrives.
const RATES = { brows: 5.5, eyes: 6, mouth: 3.4, chin: 2.8 };

export class Performer {
  constructor(seed = 7) {
    this.seed = seed;
    this.settings = { life: 1, asym: 1 };
    this.reset();
  }

  /**
   * Back to a resting face at time 0, with the same random stream as a fresh performer — so a
   * timeline replayed from the start (or scrubbed to a moment) always produces the same face.
   * The user's settings (life, asymmetry) are kept.
   */
  reset() {
    const seed = this.seed;
    this.target = {};           // desired weights (after intensity, groups, asymmetry)
    this.w1 = {};               // first smoothing stage
    this.w = {};                // current weights (second stage: S-shaped onset)
    for (const n of SHAPE_NAMES) { this.target[n] = 0; this.w1[n] = 0; this.w[n] = 0; }
    this.head = { pitch: 0, yaw: 0, roll: 0 };
    this.headT = { pitch: 0, yaw: 0, roll: 0 };
    this.gazeT = [0, 0];
    this.gaze = [0, 0];
    this.skinT = { flush: 0, wet: 0 };
    this.skin = { flush: 0, wet: 0 };
    this.lifeT = EMOTIONS.neutral.life;
    this.time = 0;
    this.nextBlink = 1.5;
    this.blinkT = -1;
    this.blinkDur = 0.25;
    this.saccade = [0, 0];
    this.nextSaccade = 1;
    this.r = rng(seed);
    this.n = Array.from({ length: 12 }, (_, i) => noise1(seed * 31 + i));
    // Per-channel asymmetry this face always has: a few percent, fixed for the session.
    this.asymBias = {};
    for (const n of SHAPE_NAMES) this.asymBias[n] = (this.r() - 0.5) * 0.12;
  }

  /**
   * Set the expression to move toward.
   * @param {object} expr { w, head, gaze, life?, skin? } (e.g. from EMOTIONS or a saved expression)
   * @param {object} o { intensity 0..1.5, groups { brows, eyes, mouth, chin, head } multipliers }
   */
  setTarget(expr, { intensity = 1, groups = {} } = {}) {
    const g = (name) => groups[groupOf(name)] ?? 1;
    for (const n of SHAPE_NAMES) {
      let v = (expr.w[n] ?? 0) * intensity * g(n);
      // The session's own asymmetry, scaled by the slider (1 = natural, 0 = perfectly even).
      if (/(Left|Right)$/.test(n)) v *= 1 + this.asymBias[n] * this.settings.asym;
      this.target[n] = Math.min(1, Math.max(0, v));
    }
    const hk = intensity * (groups.head ?? 1);
    this.headT = { pitch: (expr.head?.pitch ?? 0) * hk, yaw: (expr.head?.yaw ?? 0) * hk, roll: (expr.head?.roll ?? 0) * hk };
    this.gazeT = [(expr.gaze?.[0] ?? 0) * hk, (expr.gaze?.[1] ?? 0) * hk];
    this.skinT = { flush: (expr.skin?.flush ?? 0) * intensity, wet: (expr.skin?.wet ?? 0) * intensity };
    this.lifeT = expr.life ?? EMOTIONS.neutral.life;
  }

  /** Jump straight to the target (no transition), e.g. before taking a thumbnail. */
  snap() {
    for (const n of SHAPE_NAMES) { this.w1[n] = this.target[n]; this.w[n] = this.target[n]; }
    Object.assign(this.head, this.headT);
    this.gaze = [...this.gazeT];
    Object.assign(this.skin, this.skinT);
  }

  /**
   * Advance by dt seconds. Returns the frame to show:
   * { w (weights incl. blinks and micro-motion), head (radians), gaze [yaw, pitch], skin }
   */
  update(dt) {
    this.time += dt;
    const t = this.time;
    const life = this.settings.life;
    const L = this.lifeT;

    // Two-stage exponential smoothing per part of the face: an S-shaped onset instead of a snap.
    for (const n of SHAPE_NAMES) {
      const k = 1 - Math.exp(-dt * RATES[groupOf(n)] * 2);
      this.w1[n] += (this.target[n] - this.w1[n]) * k;
      this.w[n] += (this.w1[n] - this.w[n]) * k;
    }
    const kh = 1 - Math.exp(-dt * 1.8);
    for (const a of ['pitch', 'yaw', 'roll']) this.head[a] += (this.headT[a] - this.head[a]) * kh;
    const kg = 1 - Math.exp(-dt * 3);
    this.gaze[0] += (this.gazeT[0] - this.gaze[0]) * kg;
    this.gaze[1] += (this.gazeT[1] - this.gaze[1]) * kg;
    const ks = 1 - Math.exp(-dt * 0.8); // redness and tears build up slowly
    this.skin.flush += (this.skinT.flush - this.skin.flush) * ks;
    this.skin.wet += (this.skinT.wet - this.skin.wet) * ks;

    const out = { ...this.w };

    // Micro-motion: every active muscle wavers by a few percent, never in sync with the others.
    if (life > 0) {
      let k = 0;
      for (const n of SHAPE_NAMES) {
        if (out[n] < 0.02) continue;
        const nz = this.n[k++ % this.n.length](t * 0.9 + k * 3.1);
        out[n] = Math.min(1, Math.max(0, out[n] * (1 + 0.06 * life * nz)));
      }
      // Grief: a small, intermittent tremor of the chin and lip corners (6-7 Hz, in bursts).
      if (L.tremor) {
        const burst = Math.max(0, this.n[5](t * 0.5)) ** 2 * 3;
        const q = Math.sin(t * Math.PI * 2 * 6.5) * L.tremor * burst * life;
        out.mouthShrugLower = Math.min(1, Math.max(0, out.mouthShrugLower + q));
        out.mouthFrownLeft = Math.min(1, Math.max(0, out.mouthFrownLeft + q * 0.5));
        out.mouthFrownRight = Math.min(1, Math.max(0, out.mouthFrownRight + q * 0.6));
      }
    }

    // Blinks: stochastic intervals around the emotion's rate; fast close, slower open. Now and
    // then a double blink. A blink closes the lid from wherever it is (heavy sad lids included).
    if (life > 0) {
      if (this.blinkT < 0 && t >= this.nextBlink) {
        this.blinkT = 0;
        this.blinkDur = L.blinkDur * (0.85 + this.r() * 0.3);
      }
      let b = 0;
      if (this.blinkT >= 0) {
        this.blinkT += dt;
        const u = this.blinkT / this.blinkDur;
        b = u < 0.35 ? Math.sin((u / 0.35) * Math.PI / 2) : u < 1 ? Math.cos(((u - 0.35) / 0.65) * Math.PI / 2) ** 1.6 : 0;
        if (u >= 1) {
          this.blinkT = -1;
          const dbl = this.r() < 0.12;
          this.nextBlink = t + (dbl ? 0.18 : L.blinkEvery * (0.45 + this.r() * 1.1));
        }
      }
      for (const n of ['eyeBlinkLeft', 'eyeBlinkRight']) out[n] = out[n] + (1 - out[n]) * b;
    }

    // Gaze: fixations with small saccades; in sadness the eyes drift down and away.
    if (life > 0 && t >= this.nextSaccade) {
      const amp = 0.035 * (L.wander ?? 1);
      this.saccade = [(this.r() - 0.5) * 2 * amp, (this.r() - 0.4) * 1.4 * amp];
      this.nextSaccade = t + 0.7 + this.r() * 2.6;
    }
    const gaze = [this.gaze[0] + this.saccade[0] * life, this.gaze[1] + this.saccade[1] * life];

    // Breathing and postural sway: the head is never quite still.
    const breath = Math.sin((t / (L.breath ?? 4.2)) * Math.PI * 2);
    const head = {
      pitch: (this.head.pitch + life * (0.45 * breath + 0.8 * this.n[8](t * 0.35))) * DEG,
      yaw: (this.head.yaw + life * 1.1 * this.n[9](t * 0.27)) * DEG,
      roll: (this.head.roll + life * 0.7 * this.n[10](t * 0.3)) * DEG,
    };

    return { w: out, head, gaze, skin: { ...this.skin } };
  }
}
