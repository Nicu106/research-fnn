/*
 * From the affect-stream network to the face: the emotional state per word becomes a scene.
 *
 * The other person's line is timed as speech; each word is understood ~0.3 s after it is said
 * (comprehension lag), and where the state has moved enough a beat is placed. A beat's expression
 * is the state itself, blended: every emotion's preset weighted by how much of it the listener
 * feels, so mixed and fading emotions show as mixtures, not as switches. Surprise that turns into a
 * negative emotion is shown as the shock moment (frozen, brows up). After the line the emotion
 * settles; if it is sadness the face turns to compassion before the avatar replies.
 *
 * live(): the same mapping for text being typed — the face follows the words as they arrive.
 */

import { EMOTIONS } from './emotions.js';
import { MOMENTS, visemesOf } from './timeline.js';
import { TEXT_EMOTIONS as EM, dominant } from './textNet.js';

const PRESET = { neutral: 'neutral', joy: 'joy', sad: 'sad', fear: 'fear', anger: 'anger', surprise: 'surprise', disgust: 'disgust', contempt: 'contempt' };
const NEGATIVE = new Set(['sad', 'fear', 'anger', 'disgust', 'contempt']);
export const EMOTION_RO = {
  neutral: 'Neutru', joy: 'Bucurie', sad: 'Tristețe', fear: 'Frică', anger: 'Furie', surprise: 'Surpriză',
  disgust: 'Dezgust', contempt: 'Dispreț', shock: 'Șoc', compassion: 'Compasiune', listen: 'Ascultă',
};

const LAG = 0.3; // s from the end of a word to its effect on the face
// A feeling takes time to show: the next beat waits at least this long (the shock is a freeze that
// lasts about a second before the meaning sinks in).
const DWELL = { shock: 1.1, surprise: 0.8, listen: 0 };
const START = 0.5; // the other person starts speaking

/** A state (distribution over the 8 emotions) as one blended expression. */
export function blendState(state, { shock = false } = {}) {
  const w = {};
  const head = { pitch: 0, yaw: 0, roll: 0 };
  const gaze = [0, 0];
  const skin = { flush: 0, wet: 0 };
  let lifeKey = 'neutral';
  let best = -1;
  state.forEach((x, i) => {
    if (x < 0.01) return;
    const key = EM[i];
    const e = key === 'surprise' && shock ? MOMENTS.shock : EMOTIONS[PRESET[key]];
    for (const [n, v] of Object.entries(e.w)) w[n] = (w[n] ?? 0) + v * x;
    for (const k of ['pitch', 'yaw', 'roll']) head[k] += (e.head?.[k] ?? 0) * x;
    gaze[0] += (e.gaze?.[0] ?? 0) * x;
    gaze[1] += (e.gaze?.[1] ?? 0) * x;
    skin.flush += (e.skin?.flush ?? 0) * x;
    skin.wet += (e.skin?.wet ?? 0) * x;
    if (i > 0 && x > best) { best = x; lifeKey = key; }
  });
  const life = (lifeKey === 'surprise' && shock ? MOMENTS.shock : EMOTIONS[PRESET[best > 0.25 ? lifeKey : 'neutral']]).life;
  return { w, head, gaze, skin, life };
}

/** When each word ends inside its spoken line (s from the line's start), from the visemes' pace. */
function wordEnds(text, toks) {
  const vis = visemesOf(text);
  const lower = text.toLowerCase();
  const ends = [];
  let from = 0;
  for (const t of toks) {
    const i = lower.indexOf(t, from);
    const end = i < 0 ? from : i + t.length;
    from = end;
    ends.push((end / Math.max(1, text.length)) * vis.dur);
  }
  return { ends, dur: vis.dur };
}

const dist = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0);

/**
 * @param net TextNet
 * @returns a scenario for ScenePlayer, plus the analysis (for the word strip and the article)
 */
export function sceneFromText(net, heard, reply) {
  const a = net.analyse(heard);
  const { ends, dur } = wordEnds(heard, a.toks);
  const finalDom = EM[dominant(a.states.at(-1) ?? [1])];
  const shock = NEGATIVE.has(finalDom);
  const beats = [{ t: 0, expr: MOMENTS.listen, kind: 'listen', label: EMOTION_RO.listen }];
  let last = [1, 0, 0, 0, 0, 0, 0, 0];
  let lastDom = 0;
  a.states.forEach((s, i) => {
    const d = a.dom[i];
    if (dist(s, last) < 0.18 && d === lastDom) return;
    const key = EM[d];
    const kind = key === 'surprise' && shock ? 'shock' : key;
    const prev = beats.at(-1);
    const t = Math.max(START + ends[i] + LAG, prev.t + (DWELL[prev.kind] ?? 0.6));
    const b = { t, expr: blendState(s, { shock }), kind, label: `${EMOTION_RO[kind]} · ${a.toks[i]}`, word: i };
    if (kind === 'shock') b.blink = 'hold';
    // Surprise giving way to a negative emotion: the "no" of disbelief, a small head shake.
    if (lastDom === EM.indexOf('surprise') && NEGATIVE.has(key)) b.gesture = { kind: 'shake', dur: 1.4, amp: 3.5 };
    beats.push(b);
    last = s;
    lastDom = d;
  });
  // After the line: the emotion settles and deepens a little.
  const end = Math.max(START + dur, beats.at(-1).t - 0.6);
  const fin = a.states.at(-1) ?? last;
  const deeper = fin.map((v, i) => (i === 0 ? v * 0.75 : v * (1 + 0.25 * fin[0] / Math.max(1e-3, 1 - fin[0]))));
  const kindF = EM[dominant(fin)];
  beats.push({ t: end + 1.2, expr: blendState(deeper), kind: kindF, label: `${EMOTION_RO[kindF]} (după)`, blink: 'now' });
  let replyAt = end + 2.2;
  if (finalDom === 'sad') {
    beats.push({ t: end + 2.6, expr: MOMENTS.compassion, kind: 'compassion', label: EMOTION_RO.compassion });
    replyAt = end + 3.3;
    beats.push({ t: replyAt + 3.0, expr: MOMENTS.compassion, intensity: 0.85, kind: 'compassion', label: 'După', gesture: { kind: 'nod', dur: 1.6, amp: 3.2 } });
  }
  beats.sort((x, y) => x.t - y.t);
  return {
    id: 'text',
    name: 'Din text (rețeaua neuronală)',
    heard,
    reply,
    beats,
    lines: [{ who: 'other', t: START, key: 'heard' }, { who: 'self', t: replyAt, key: 'reply' }],
    duration: replyAt + 4.5,
    analysis: a,
    wordTimes: ends.map((e) => START + e),
  };
}

/** Live: the face's target for text as it is being typed (the last word still provisional). */
export function liveTarget(net, text) {
  const a = net.analyse(text);
  const s = a.states.at(-1) ?? [1, 0, 0, 0, 0, 0, 0, 0];
  return { expr: blendState(s), analysis: a };
}
