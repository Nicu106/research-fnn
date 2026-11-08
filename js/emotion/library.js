/*
 * Saved expressions: kept in this browser (localStorage) and exportable as JSON.
 *
 * An entry is the expression itself, not a picture of it: blendshape weights, head pose, gaze and
 * skin response, so it can be re-applied, edited and exported for analysis. The thumbnail is only
 * for recognising it in the list.
 */

import { SHAPE_NAMES } from './emotions.js';

const KEY = 'neuralFace.expressions.v1';
const FORMAT = 'neural-face-expressions';

const r3 = (v) => Math.round(v * 1000) / 1000;

/** Compact, validated copy of an expression (drops zero weights, rounds, clamps). */
export function normalise(e) {
  const w = {};
  for (const n of SHAPE_NAMES) {
    const v = Number(e.w?.[n] ?? 0);
    if (Number.isFinite(v) && v > 0.001) w[n] = r3(Math.min(1, v));
  }
  const num = (v, lim) => (Number.isFinite(Number(v)) ? r3(Math.max(-lim, Math.min(lim, Number(v)))) : 0);
  return {
    id: typeof e.id === 'string' ? e.id : `x${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: String(e.name ?? 'Expresie').slice(0, 60),
    source: ['emotion', 'image', 'edit'].includes(e.source) ? e.source : 'edit',
    createdAt: e.createdAt ?? new Date().toISOString(),
    w,
    head: { pitch: num(e.head?.pitch, 35), yaw: num(e.head?.yaw, 50), roll: num(e.head?.roll, 35) },
    gaze: [num(e.gaze?.[0], 0.5), num(e.gaze?.[1], 0.5)],
    skin: { flush: num(e.skin?.flush, 1), wet: num(e.skin?.wet, 1) },
    life: e.life && typeof e.life === 'object' ? e.life : undefined,
    raw: e.raw && typeof e.raw === 'object' ? e.raw : undefined,
    thumb: typeof e.thumb === 'string' && e.thumb.startsWith('data:image/') ? e.thumb : undefined,
  };
}

export class Library {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.items = [];
    this.error = null;
    this.load();
  }

  load() {
    try {
      const data = JSON.parse(this.storage?.getItem(KEY) ?? '[]');
      this.items = Array.isArray(data) ? data.map(normalise) : [];
    } catch {
      this.items = [];
    }
  }

  /** @returns true when persisted (storage can be full or unavailable, e.g. private windows). */
  #persist() {
    try {
      this.storage?.setItem(KEY, JSON.stringify(this.items));
      this.error = null;
      return true;
    } catch (err) {
      this.error = err?.name === 'QuotaExceededError' ? 'Spațiul de stocare al browserului e plin' : 'Browserul nu permite salvarea';
      return false;
    }
  }

  add(expr) {
    const item = normalise(expr);
    this.items.unshift(item);
    if (!this.#persist()) {
      // Retry without the thumbnail before giving up: it is the only large part.
      delete item.thumb;
      this.#persist();
    }
    return item;
  }

  rename(id, name) {
    const it = this.items.find((x) => x.id === id);
    if (!it) return;
    it.name = String(name).slice(0, 60) || it.name;
    this.#persist();
  }

  remove(id) {
    this.items = this.items.filter((x) => x.id !== id);
    this.#persist();
  }

  get(id) { return this.items.find((x) => x.id === id); }

  toJSON() {
    return { format: FORMAT, version: 1, exportedAt: new Date().toISOString(), expressions: this.items };
  }

  /** Merge an exported file. @returns number of expressions added */
  importJSON(text) {
    const data = JSON.parse(text);
    const list = Array.isArray(data) ? data : data?.format === FORMAT ? data.expressions : null;
    if (!Array.isArray(list)) throw new Error('Fișierul nu conține expresii Neural Face');
    const have = new Set(this.items.map((x) => x.id));
    let n = 0;
    for (const e of list) {
      const item = normalise(e);
      if (have.has(item.id)) continue;
      this.items.push(item);
      n++;
    }
    this.#persist();
    return n;
  }
}
