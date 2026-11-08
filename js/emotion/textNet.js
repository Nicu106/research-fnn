/*
 * Affect-stream network in the browser: text in, an emotional state per word out.
 *
 * The forward pass of ml/textnet/model.py, written out by hand (no ML runtime): char n-gram
 * embeddings -> GRU -> clause segmenter and clause memory -> attention over earlier clauses
 * ("pre"), the current clause so far and the next two words ("post") -> per-word target emotion
 * and impact gate -> leaky integrator. Weights come from ml/textnet/train.py
 * (textNetWeights.json), which also stores reference outputs that tools/check-textnet.mjs compares
 * against, so this file and the PyTorch model cannot drift apart.
 *
 * Live use: analyse() on the words typed so far is exactly the network in streaming mode — the
 * last words see no lookahead yet (a provisional reading) and are re-read as the next words come.
 */

export const TEXT_EMOTIONS = ['neutral', 'joy', 'sad', 'fear', 'anger', 'surprise', 'disgust', 'contempt'];

export function normalise(s) {
  return s.toLowerCase().normalize('NFC').replace(/ş/g, 'ș').replace(/ţ/g, 'ț').replace(/ã/g, 'ă');
}

/** Words (hyphenated clitics kept whole: mi-a, s-a, nu-mi) and punctuation, as in corpus.py. */
export function tokenize(text) {
  const out = [];
  let w = '';
  const flush = () => {
    const t = w.replace(/^-+|-+$/g, '');
    if (t) out.push(t);
    w = '';
  };
  for (const ch of normalise(text)) {
    if (/\p{L}/u.test(ch) || (ch === '-' && w)) w += ch;
    else {
      flush();
      if ('.,!?;:…'.includes(ch)) out.push(ch);
    }
  }
  flush();
  return out;
}

function fnv1a(s) {
  let h = 0x811c9dc5;
  for (const ch of s) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function grams(word, buckets) {
  const w = [...`<${word}>`];
  const f = [fnv1a('W:' + word) % buckets];
  for (const n of [2, 3, 4]) for (let i = 0; i + n <= w.length; i++) f.push(fnv1a(w.slice(i, i + n).join('')) % buckets);
  return f;
}

const sigmoid = (x) => 1 / (1 + Math.exp(-x));

/** y = W x (+ b); W row-major (out × inp). */
function affine(W, b, x, out) {
  const inp = x.length;
  const y = new Float32Array(out);
  for (let o = 0; o < out; o++) {
    let s = b ? b[o] : 0;
    const r = o * inp;
    for (let i = 0; i < inp; i++) s += W[r + i] * x[i];
    y[o] = s;
  }
  return y;
}

const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

/** The emotion a state shows: the strongest non-neutral one if it reaches `floor`, else neutral. */
export function dominant(s, floor = 0.2) {
  let top = 1;
  for (let k = 2; k < s.length; k++) if (s[k] > s[top]) top = k;
  return s[top] >= floor ? top : 0;
}

export class TextNet {
  static async load(url = new URL('./textNetWeights.json', import.meta.url)) {
    const res = await fetch(url);
    return new TextNet(await res.json());
  }

  constructor(w) {
    const F = (a) => Float32Array.from(a);
    this.m = w.meta;
    this.emb = F(w.emb);
    this.gru = Object.fromEntries(Object.entries(w.gru).map(([k, v]) => [k, F(v)]));
    this.bound = { w: F(w.bound.w), b: w.bound.b[0] };
    this.q = F(w.q); this.k = F(w.k); this.v = F(w.v);
    this.nullK = F(w.null_k); this.nullV = F(w.null_v);
    this.recency = w.recency;
    this.app = { w: F(w.app.w), b: F(w.app.b) };
    this.target = { w: F(w.target.w), b: F(w.target.b) };
    this.gate = { w: F(w.gate.w), b: w.gate.b[0] };
    this.reference = w.reference;
  }

  #embed(tok) {
    const { buckets, dim } = this.m;
    const f = grams(tok, buckets);
    const x = new Float32Array(dim);
    for (const id of f) for (let d = 0; d < dim; d++) x[d] += this.emb[id * dim + d];
    for (let d = 0; d < dim; d++) x[d] /= f.length;
    return x;
  }

  #gruStep(x, h) {
    const H = h.length;
    const gi = affine(this.gru.weight_ih, this.gru.bias_ih, x, 3 * H);
    const gh = affine(this.gru.weight_hh, this.gru.bias_hh, h, 3 * H);
    const out = new Float32Array(H);
    for (let j = 0; j < H; j++) {
      const r = sigmoid(gi[j] + gh[j]);
      const z = sigmoid(gi[H + j] + gh[H + j]);
      const n = Math.tanh(gi[2 * H + j] + r * gh[2 * H + j]);
      out[j] = (1 - z) * n + z * h[j];
    }
    return out;
  }

  /**
   * @param text  the words said so far
   * @param o.look  max lookahead (2 = the trained window; 0 = provisional, causal-only reading)
   * @returns { toks, seg, states: number[][], targets, gates, dom: number[] }
   */
  analyse(text, { look: maxLook = this.m.look } = {}) {
    const toks = tokenize(text);
    const n = toks.length;
    const H = this.m.hid;
    const xs = toks.map((t) => this.#embed(t));
    const hs = [];
    const seg = [];
    let h = new Float32Array(H);
    for (let t = 0; t < n; t++) {
      // Does a clause start at t? Decided from what came before and the word itself.
      const bx = new Float32Array(H + xs[t].length);
      bx.set(h); bx.set(xs[t], H);
      seg.push(t === 0 || dot(this.bound.w, bx) + this.bound.b > 0 ? 1 : 0);
      h = this.#gruStep(xs[t], h);
      hs.push(h);
    }

    // Clause summaries (mean of h), projected to keys and values.
    const segId = [];
    let c = -1;
    for (let t = 0; t < n; t++) { c += seg[t]; segId.push(c); }
    const S = c + 1;
    const summ = Array.from({ length: S }, () => new Float32Array(H));
    const cnt = new Array(S).fill(0);
    for (let t = 0; t < n; t++) { const s = summ[segId[t]]; for (let j = 0; j < H; j++) s[j] += hs[t][j]; cnt[segId[t]]++; }
    summ.forEach((s, i) => { for (let j = 0; j < H; j++) s[j] /= cnt[i]; });
    const keys = summ.map((s) => affine(this.k, null, s, H));
    const vals = summ.map((s) => affine(this.v, null, s, H));

    const states = [];
    const targets = [];
    const gates = [];
    const dom = [];
    let state = TEXT_EMOTIONS.map((_, i) => (i === 0 ? 1 : 0));
    let start = 0;
    const clause = new Float32Array(H);
    const D = this.m.dim;
    for (let t = 0; t < n; t++) {
      const ht = hs[t];
      // Pre: attention over the clauses before this one (plus a learned "nothing yet" slot).
      const q = affine(this.q, null, ht, H);
      const sc = [dot(q, this.nullK) / Math.sqrt(H)];
      for (let s = 0; s < segId[t]; s++) sc.push(dot(q, keys[s]) / Math.sqrt(H) - this.recency * (segId[t] - s));
      const mx = Math.max(...sc);
      const ex = sc.map((v) => Math.exp(v - mx));
      const Z = ex.reduce((a, b) => a + b, 0);
      const ctx = new Float32Array(H);
      for (let j = 0; j < H; j++) ctx[j] = (ex[0] * this.nullV[j]) / Z;
      for (let s = 0; s < segId[t]; s++) for (let j = 0; j < H; j++) ctx[j] += (ex[s + 1] * vals[s][j]) / Z;

      // The current clause so far.
      if (seg[t]) { start = t; clause.fill(0); }
      for (let j = 0; j < H; j++) clause[j] = (clause[j] * (t - start) + ht[j]) / (t - start + 1);

      // Post: the next words that have arrived.
      const look = Math.max(0, Math.min(maxLook, n - 1 - t));
      const la = new Float32Array(D);
      for (let k = 1; k <= look; k++) for (let d = 0; d < D; d++) la[d] += xs[t + k][d] / look;

      const inp = new Float32Array(3 * H + D + 1);
      inp.set(ht, 0); inp.set(ctx, H); inp.set(clause, 2 * H); inp.set(la, 3 * H); inp[3 * H + D] = look / this.m.look;
      const z = affine(this.app.w, this.app.b, inp, this.app.b.length).map(Math.tanh);
      const logits = affine(this.target.w, this.target.b, z, TEXT_EMOTIONS.length);
      const lm = Math.max(...logits);
      const pe = Array.from(logits, (v) => Math.exp(v - lm));
      const ps = pe.reduce((a, b) => a + b, 0);
      const target = pe.map((v) => v / ps);
      const g = sigmoid(dot(this.gate.w, z) + this.gate.b);
      state = state.map((v, i) => (1 - g) * v + g * target[i]);
      states.push(state);
      targets.push(target);
      gates.push(g);
      dom.push(dominant(state));
    }
    return { toks, seg, states, targets, gates, dom };
  }
}
