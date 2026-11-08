/*
 * Scenarios: an emotion that unfolds in time instead of a single pose.
 *
 * A scenario is a short scene — someone says something, the face reacts in stages, then answers.
 * It is a list of beats (moments where the face starts moving toward a new expression) plus the
 * lines that are spoken. The Performer does the in-between: each beat only sets a target, and the
 * performer's per-region onset rates (brows first, mouth after, head last) make the transition.
 *
 * How bad news lands on a face, and the order the beats follow:
 *   1. Listening — attentive, eyes on the speaker.
 *   2. Orienting / shock, ~300 ms after the words: brows lift, lids open, the jaw drops a little,
 *      blinking and breathing stop for a moment (a startle-like freeze).
 *   3. Disbelief: the inner brows stay up while the brows knit (distress), lips press, a small
 *      head shake — the "no" before the meaning is accepted.
 *   4. Sadness arrives: corners down, chin up, gaze drops and turns away, a slow blink.
 *   5. It deepens, the eyes wet.
 *   6. Compassion: the gaze comes back to the other person, the head tilts toward them, the brows
 *      stay oblique — then the reply is said, slowly and quietly, with the sad face still on.
 *   7. After: a slow nod, lips pressed, the sadness lingering.
 *
 * Speech: Romanian is close to phonetic, so lip shapes (visemes) come straight from the letters.
 * They are added on top of the emotion, bypassing the performer's smoothing (lips move faster
 * than feelings), and they relax the muscles that would keep the lips shut (press, chin raise).
 */

import { EMOTIONS } from './emotions.js';

const DEG = Math.PI / 180;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

// ---------------------------------------------------------------------------------------------
// Expressions that only exist as moments of a scene (not offered on their own in the grid).
// ---------------------------------------------------------------------------------------------
export const MOMENTS = {
  listen: {
    name: 'Ascultă',
    w: {
      browInnerUp: 0.1, browOuterUpLeft: 0.07, browOuterUpRight: 0.05, eyeWideLeft: 0.08, eyeWideRight: 0.06,
      eyeBlinkLeft: 0.05, eyeBlinkRight: 0.07, mouthPressLeft: 0.04, mouthRollLower: 0.03,
    },
    head: { pitch: -1, yaw: 0, roll: 2 },
    gaze: [0, 0],
    life: { blinkEvery: 4, blinkDur: 0.24, breath: 4.4, wander: 0.5 },
  },
  shock: {
    name: 'Șoc',
    w: {
      browInnerUp: 0.72, browOuterUpLeft: 0.55, browOuterUpRight: 0.5, eyeWideLeft: 0.56, eyeWideRight: 0.5,
      jawOpen: 0.13, mouthLowerDownLeft: 0.05, mouthLowerDownRight: 0.06, mouthStretchLeft: 0.05, mouthStretchRight: 0.06,
    },
    head: { pitch: -3, yaw: 0, roll: 0.5 },
    gaze: [0, 0],
    // Frozen: blinking suppressed, breath held, the eyes fixed on the speaker.
    life: { blinkEvery: 9, blinkDur: 0.22, breath: 8, wander: 0.08 },
  },
  disbelief: {
    name: 'Neîncredere',
    w: {
      browInnerUp: 0.86, browDownLeft: 0.22, browDownRight: 0.26, eyeWideLeft: 0.2, eyeWideRight: 0.17,
      eyeSquintLeft: 0.08, eyeSquintRight: 0.1, jawOpen: 0.05, mouthPressLeft: 0.16, mouthPressRight: 0.13,
      mouthFrownLeft: 0.2, mouthFrownRight: 0.24, mouthShrugLower: 0.12,
    },
    head: { pitch: 0, yaw: -1, roll: 1 },
    gaze: [0.02, 0.05],
    life: { blinkEvery: 2.6, blinkDur: 0.26, breath: 3.2, wander: 0.9 },
  },
  // Empathic concern: the sad brow with softened eyes, a hint of warmth at the cheeks, the head
  // tilted toward the other person, eyes on them.
  compassion: {
    name: 'Compasiune',
    w: {
      browInnerUp: 0.74, browDownLeft: 0.06, browDownRight: 0.08, eyeBlinkLeft: 0.2, eyeBlinkRight: 0.23,
      eyeSquintLeft: 0.1, eyeSquintRight: 0.12, cheekSquintLeft: 0.07, cheekSquintRight: 0.06,
      mouthFrownLeft: 0.22, mouthFrownRight: 0.26, mouthPressLeft: 0.22, mouthPressRight: 0.18, mouthShrugLower: 0.16,
      mouthSmileLeft: 0.03, mouthSmileRight: 0.02,
    },
    head: { pitch: 2, yaw: -2, roll: 5 },
    gaze: [0, 0.02],
    life: { blinkEvery: 4.2, blinkDur: 0.36, breath: 5, wander: 0.35 },
    skin: { flush: 0.2, wet: 0.35 },
  },
};

// A beat names an expression (a preset or a moment) or carries one (e.g. blended from text).
const expressionOf = (key) => (typeof key === 'string' ? MOMENTS[key] ?? EMOTIONS[key] : key);

// ---------------------------------------------------------------------------------------------
// Scenarios. Times in seconds. A line's text comes from the scenario (and can be edited in the
// panel); the self line's duration follows from its text.
// ---------------------------------------------------------------------------------------------
export const SCENARIOS = [
  {
    id: 'brother',
    name: 'Vestea: a murit fratele',
    heard: 'A murit fratele.',
    reply: 'Îmi pare rău.',
    beats: [
      { t: 0, expr: 'listen' },
      { t: 2.35, expr: 'shock', blink: 'hold' },
      { t: 3.45, expr: 'disbelief', gesture: { kind: 'shake', dur: 1.5, amp: 4.5 } },
      { t: 5.0, expr: 'sad', intensity: 0.75, blink: 'now' },
      { t: 6.7, expr: 'sad', intensity: 1, label: 'Tristețe adâncă', skin: { flush: 0.3, wet: 0.5 } },
      { t: 8.4, expr: 'compassion' },
      { t: 10.9, expr: 'compassion', intensity: 0.85, label: 'După', gesture: { kind: 'nod', dur: 1.6, amp: 3.2 } },
    ],
    lines: [
      { who: 'other', t: 0.5, key: 'heard' },
      { who: 'self', t: 9.1, key: 'reply' },
    ],
    duration: 13.5,
  },
];

// ---------------------------------------------------------------------------------------------
// Visemes from Romanian text.
// ---------------------------------------------------------------------------------------------
const V = {
  a: { jawOpen: 0.42, mouthLowerDownLeft: 0.1, mouthLowerDownRight: 0.1 },
  ă: { jawOpen: 0.26, mouthLowerDownLeft: 0.05, mouthLowerDownRight: 0.05 },
  â: { jawOpen: 0.18, mouthStretchLeft: 0.12, mouthStretchRight: 0.12 },
  e: { jawOpen: 0.28, mouthStretchLeft: 0.2, mouthStretchRight: 0.2 },
  i: { jawOpen: 0.13, mouthStretchLeft: 0.3, mouthStretchRight: 0.3, mouthSmileLeft: 0.08, mouthSmileRight: 0.08 },
  o: { jawOpen: 0.32, mouthFunnel: 0.45, mouthPucker: 0.12 },
  u: { jawOpen: 0.12, mouthPucker: 0.6, mouthFunnel: 0.22 },
  mbp: { jawOpen: 0.02, mouthPressLeft: 0.35, mouthPressRight: 0.35, mouthRollLower: 0.1, mouthRollUpper: 0.06 },
  fv: { jawOpen: 0.07, mouthRollLower: 0.45, mouthUpperUpLeft: 0.08, mouthUpperUpRight: 0.08 },
  sibilant: { jawOpen: 0.07, mouthStretchLeft: 0.2, mouthStretchRight: 0.2 },
  tongue: { jawOpen: 0.17 },
  back: { jawOpen: 0.2 },
  rest: {},
};
const LETTER = {
  a: 'a', ă: 'ă', â: 'â', î: 'â', e: 'e', i: 'i', o: 'o', u: 'u',
  m: 'mbp', b: 'mbp', p: 'mbp', f: 'fv', v: 'fv',
  s: 'sibilant', z: 'sibilant', ș: 'sibilant', ş: 'sibilant', ț: 'sibilant', ţ: 'sibilant', j: 'sibilant', c: 'back',
  r: 'tongue', l: 'tongue', n: 'tongue', d: 'tongue', t: 'tongue',
  g: 'back', k: 'back', h: 'back', q: 'back', x: 'sibilant', w: 'u', y: 'i',
};
const VOWEL = new Set(['a', 'ă', 'â', 'e', 'i', 'o', 'u']);
// The channels a viseme may write; the emotion's lip-closing muscles yield to speech.
const LIP_HOLD = ['mouthPressLeft', 'mouthPressRight', 'mouthShrugLower', 'mouthRollLower'];

/**
 * Text → timed visemes. @param slow 1 = normal pace; sad speech is slower.
 * @returns { segs: [{ t, dur, v }], dur }
 */
export function visemesOf(text, slow = 1) {
  const s = text.toLowerCase().normalize('NFC');
  const segs = [];
  let t = 0.08;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    let key = LETTER[ch];
    // "ce", "ci", "ge", "gi": the consonant is soft (ch/j), lips spread.
    if ((ch === 'c' || ch === 'g') && /[ei]/.test(s[i + 1] ?? '')) key = 'sibilant';
    let dur;
    if (key) dur = VOWEL.has(ch) || ch === 'î' ? 0.13 : 0.075;
    else if (/[.!?…]/.test(ch)) { key = 'rest'; dur = 0.35; }
    else if (/[,;:—–-]/.test(ch)) { key = 'rest'; dur = 0.22; }
    else if (/\s/.test(ch)) { key = 'rest'; dur = 0.05; }
    else continue;
    // A final unstressed "i" in Romanian is barely voiced (e.g. "rău", "fratelui"): shorter.
    if (ch === 'i' && !/\p{L}/u.test(s[i + 1] ?? '')) dur *= 0.6;
    segs.push({ t, dur: dur * slow, v: V[key] });
    t += dur * slow;
  }
  // Trailing rest so the mouth closes softly instead of freezing on the last shape.
  segs.push({ t, dur: 0.2, v: V.rest });
  return { segs, dur: t + 0.2 };
}

/** Mouth shape at time u into the line: neighbouring visemes cross-fade (coarticulation). */
function visemeAt(vis, u) {
  const out = {};
  const segs = vis.segs;
  for (let k = 0; k < segs.length; k++) {
    const g = segs[k];
    // Each viseme rises over the first half of its slot, peaks, and fades into the next one.
    const c = g.t + g.dur * 0.5;
    const half = Math.max(g.dur, 0.09);
    const d = Math.abs(u - c) / half;
    if (d >= 1) continue;
    const a = 0.5 + 0.5 * Math.cos(d * Math.PI);
    for (const [n, x] of Object.entries(g.v)) out[n] = Math.max(out[n] ?? 0, x * a);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------------------------
export class ScenePlayer {
  /**
   * @param performer the studio's Performer (reset and driven by the scene while it plays)
   * @param o.onLine (line | null) => void   subtitle
   */
  constructor(performer, { onLine } = {}) {
    this.performer = performer;
    this.onLine = onLine ?? (() => {});
    this.scene = null;
    this.texts = {};
    this.t = 0;
    this.playing = false;
    this.speed = 1;
    this.sound = true;
    this.beat = -1;
    this.lineShown = null;
    this.waitVoice = 0; // seconds left to wait for the speech engine to start a line
    this.spoken = new Set();
  }

  get active() { return !!this.scene; }

  load(scene, texts = {}) {
    this.scene = scene;
    this.texts = { heard: scene.heard, reply: scene.reply, ...texts };
    this.#build();
    this.seek(0);
  }

  setText(key, value) {
    this.texts[key] = value;
    const t = this.t;
    this.#build();
    this.seek(Math.min(t, this.duration));
  }

  unload() {
    this.stopVoice();
    this.scene = null;
    this.playing = false;
    this.onLine(null);
  }

  /** Lines with their resolved text, visemes and timing; the scene stretches if a reply is long. */
  #build() {
    const sc = this.scene;
    this.lines = sc.lines.map((l) => {
      const text = (this.texts[l.key] ?? '').trim();
      const vis = visemesOf(text, l.who === 'self' ? 1.25 : 1);
      return { ...l, text, vis, dur: Math.max(0.6, vis.dur) };
    });
    const ends = this.lines.map((l) => l.t + l.dur + 1.5);
    this.duration = Math.max(sc.duration, ...ends);
    this.beats = sc.beats.map((b) => ({ ...b, label: b.label ?? expressionOf(b.expr).name }));
  }

  play() {
    if (!this.scene) return;
    if (this.t >= this.duration - 0.01) this.seek(0);
    this.playing = true;
  }

  pause() {
    this.playing = false;
    this.stopVoice();
  }

  /** Jump to a moment: replay the scene silently from 0 at a fixed step, so the face is exactly
   * what it would have been had it played through (same blinks, same transitions). */
  seek(t) {
    this.stopVoice();
    const p = this.performer;
    p.reset();
    this.t = 0;
    this.beat = -1;
    this.spoken = new Set(this.lines.filter((l) => l.t < t).map((l) => l.key));
    const step = 1 / 60;
    this.#beatsUpTo(0);
    p.snap();
    while (this.t + step <= t) {
      this.t += step;
      this.#beatsUpTo(this.t);
      p.update(step);
    }
    this.t = t;
    this.frame = null;
  }

  #beatsUpTo(t) {
    while (this.beat + 1 < this.beats.length && this.beats[this.beat + 1].t <= t) {
      this.beat++;
      const b = this.beats[this.beat];
      const e = expressionOf(b.expr);
      const expr = b.skin ? { ...e, skin: b.skin } : e;
      this.performer.setTarget(expr, { intensity: b.intensity ?? 1 });
      const p = this.performer;
      if (b.blink === 'hold') { p.nextBlink = p.time + 1.4; p.blinkT = -1; }
      if (b.blink === 'now') p.nextBlink = p.time + 0.05;
    }
  }

  get beatLabel() { return this.beats?.[Math.max(0, this.beat)]?.label ?? ''; }

  /** Per frame. @returns the performer frame with gestures and speech on top. */
  update(dt, studioOpts) {
    const p = this.performer;
    if (this.playing) {
      // Wait (briefly) for the speech engine before running a spoken line, so lips and voice start together.
      if (this.waitVoice > 0) {
        this.waitVoice -= dt;
        dt = 0;
      } else {
        dt *= this.speed;
        this.t = Math.min(this.duration, this.t + dt);
        if (this.t >= this.duration) this.playing = false;
      }
    } else {
      dt = 0;
    }
    this.#beatsUpTo(this.t);
    if (this.playing && this.sound) this.#voice();
    // Paused: the face holds still (no breathing drift), like a paused video.
    const f = dt > 0 || !this.frame ? p.update(dt) : structuredClone(this.frame);
    this.frame = structuredClone(f);
    this.#gestures(f);
    this.#speech(f);
    return f;
  }

  #gestures(f) {
    for (const b of this.beats) {
      const g = b.gesture;
      if (!g) continue;
      const u = (this.t - b.t) / g.dur;
      if (u <= 0 || u >= 1) continue;
      const env = Math.sin(Math.PI * u);
      if (g.kind === 'shake') f.head.yaw += g.amp * DEG * env * Math.sin(u * Math.PI * 2 * 2.2);
      if (g.kind === 'nod') f.head.pitch += g.amp * DEG * env * (0.5 - 0.5 * Math.cos(u * Math.PI * 2 * 1.5));
    }
  }

  #speech(f) {
    let show = null;
    for (const l of this.lines) {
      const u = this.t - l.t;
      if (u < -0.05 || u > l.dur + 0.9) continue;
      show = l;
      if (l.who !== 'self' || u < 0 || u > l.dur) continue;
      const v = visemeAt(l.vis, u);
      const open = clamp01((v.jawOpen ?? 0) * 3);
      for (const n of LIP_HOLD) f.w[n] *= 1 - 0.75 * open;
      for (const [n, x] of Object.entries(v)) f.w[n] = clamp01((f.w[n] ?? 0) + x);
    }
    if (show !== this.lineShown) {
      this.lineShown = show;
      this.onLine(show ? { who: show.who, text: show.text } : null);
    }
  }

  // ------------------------------------------------------------------ voice (Web Speech API)

  #voice() {
    if (typeof speechSynthesis === 'undefined') return;
    for (const l of this.lines) {
      if (this.spoken.has(l.key) || this.t < l.t || !l.text) continue;
      this.spoken.add(l.key);
      const u = new SpeechSynthesisUtterance(l.text);
      const voices = speechSynthesis.getVoices();
      const ro = voices.filter((v) => v.lang?.toLowerCase().startsWith('ro'));
      u.voice = ro[l.who === 'self' ? 0 : ro.length > 1 ? 1 : 0] ?? null;
      u.lang = 'ro-RO';
      // The other person: plain, a little lower. The reply: quiet and slow.
      u.rate = l.who === 'self' ? 0.8 : 0.9;
      u.pitch = l.who === 'self' ? 0.95 : 0.8;
      u.volume = l.who === 'self' ? 0.75 : 0.9;
      if (l.who === 'self') {
        this.waitVoice = 0.6;
        u.onstart = () => { this.waitVoice = 0; };
      }
      speechSynthesis.speak(u);
    }
  }

  stopVoice() {
    this.waitVoice = 0;
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  }
}

export { expressionOf };
