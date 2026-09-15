import * as THREE from 'three';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';

/*
 * Facial neural topology — pure data, no rendering.
 * Deterministic: the same seed always yields the same node IDs, positions and edges,
 * so later experiments (JS or Python) can reference nodes by ID.
 *
 * Coordinates are in model units: +Y up, +Z out of the face, +X = subject's left.
 */

export const LAYERS = [
  { key: 'surface', name: 'Suprafață', color: '#9ff3ff' },
  { key: 'deep', name: 'Strat intern', color: '#5b8cff' },
  { key: 'core', name: 'Nucleu', color: '#c77dff' },
];

export const REGIONS = [
  { key: 'forehead', name: 'Frunte', color: '#7fd8ff' },
  { key: 'eye_l', name: 'Ochi stâng', color: '#ffd479' },
  { key: 'eye_r', name: 'Ochi drept', color: '#ffb067' },
  { key: 'nose', name: 'Nas', color: '#ff7aa8' },
  { key: 'mouth', name: 'Gură', color: '#ff5d73' },
  { key: 'cheek_l', name: 'Obraz stâng', color: '#a48cff' },
  { key: 'cheek_r', name: 'Obraz drept', color: '#7f9cff' },
  { key: 'jaw', name: 'Maxilar', color: '#62f0c8' },
  { key: 'ear', name: 'Urechi', color: '#f3a6ff' },
  { key: 'cranium', name: 'Craniu', color: '#5d86a8' },
  { key: 'neck', name: 'Gât', color: '#3fb0a0' },
];
const R = Object.fromEntries(REGIONS.map((r, i) => [r.key, i]));

const NECK_CUT = -2.35;

// Approximate anatomical landmarks on the scan (model units) used for density and regions.
const FEATURES = [
  { p: [1.02, 1.62, 1.72], s: 0.55 }, // eye L
  { p: [-1.02, 1.62, 1.72], s: 0.55 }, // eye R
  { p: [0, 1.05, 2.45], s: 0.6 }, // nose
  { p: [0, -0.05, 1.95], s: 0.6 }, // mouth
];

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function featureWeight(x, y, z) {
  let w = 0;
  for (const f of FEATURES) {
    const dx = x - f.p[0], dy = y - f.p[1], dz = z - f.p[2];
    w = Math.max(w, Math.exp(-(dx * dx + dy * dy + dz * dz) / (f.s * f.s)));
  }
  return w;
}

function classify(x, y, z, nz) {
  const ax = Math.abs(x);
  if (y < -1.7) return R.neck;
  if (ax > 1.9 && y > -0.6 && y < 1.9 && z < 0.9 && z > -1.2) return R.ear;
  if (z < 0.35 || nz < -0.35) return R.cranium;
  if (y > 2.15) return R.forehead;
  if (ax < 0.55 && y > 0.55 && z > 1.7) return R.nose;
  if (y > 1.25) return x > 0 ? R.eye_l : R.eye_r;
  if (ax < 1.0 && y > -0.55 && y <= 0.55) return R.mouth;
  if (y <= -0.55) return R.jaw;
  return x > 0 ? R.cheek_l : R.cheek_r;
}

// Greedy Poisson-disc selection with a per-point radius, backed by a uniform grid.
function poisson(cands, radiusOf, rMax) {
  // Cell = largest radius, so every conflicting neighbour lies in the 27 surrounding cells.
  const cell = rMax;
  const span = 1;
  const grid = new Map();
  const key = (i, j, k) => (i + 512) * 1048576 + (j + 512) * 1024 + (k + 512);
  const out = [];
  for (const c of cands) {
    const r = radiusOf(c);
    const ci = Math.floor(c.x / cell), cj = Math.floor(c.y / cell), ck = Math.floor(c.z / cell);
    let ok = true;
    search: for (let i = -span; i <= span; i++) {
      for (let j = -span; j <= span; j++) {
        for (let k = -span; k <= span; k++) {
          const bucket = grid.get(key(ci + i, cj + j, ck + k));
          if (!bucket) continue;
          for (const o of bucket) {
            const dx = o.x - c.x, dy = o.y - c.y, dz = o.z - c.z;
            const rr = (r + o.r) * 0.5;
            if (dx * dx + dy * dy + dz * dz < rr * rr) { ok = false; break search; }
          }
        }
      }
    }
    if (!ok) continue;
    const p = { ...c, r };
    out.push(p);
    const kk = key(ci, cj, ck);
    if (!grid.has(kk)) grid.set(kk, []);
    grid.get(kk).push(p);
  }
  return out;
}

function connectKnn(from, to, k, maxDist, addEdge, same) {
  const max2 = maxDist * maxDist;
  for (const a of from) {
    const best = [];
    for (const b of to) {
      if (same && a.id === b.id) continue;
      const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > max2) continue;
      if (best.length < k) {
        best.push([d2, b.id]);
        best.sort((p, q) => p[0] - q[0]);
      } else if (d2 < best[k - 1][0]) {
        best[k - 1] = [d2, b.id];
        best.sort((p, q) => p[0] - q[0]);
      }
    }
    for (const [, id] of best) addEdge(a.id, id);
  }
}

export function buildNetwork(mesh, { seed = 1337 } = {}) {
  const rng = mulberry32(seed);
  const sampler = new MeshSurfaceSampler(mesh);
  sampler.setRandomGenerator(rng);
  sampler.build();

  // 1 — dense candidate cloud on the scanned surface
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const cands = [];
  for (let i = 0; i < 110000; i++) {
    sampler.sample(p, n);
    if (p.y < NECK_CUT) continue;
    cands.push({ x: p.x, y: p.y, z: p.z, nx: n.x, ny: n.y, nz: n.z });
  }

  // 2 — surface layer: finer on the face, finest around eyes / nose / mouth
  const surface = poisson(cands, (c) => {
    const front = smooth(-0.1, 0.8, c.nz) * smooth(-0.2, 1.4, c.z);
    const r = 0.27 + (0.135 - 0.27) * front;
    return r * (1 - 0.3 * featureWeight(c.x, c.y, c.z));
  }, 0.27);
  // Lift surface nodes slightly off the skin so they are not hidden by its depth.
  for (const s of surface) {
    s.x += s.nx * 0.035;
    s.y += s.ny * 0.035;
    s.z += s.nz * 0.035;
  }

  // Inner shells are the surface pulled toward the head's vertical axis.
  const toward = (s, t) => {
    const cy = Math.min(2.6, Math.max(-2.0, s.y));
    return { x: s.x * (1 - t), y: s.y + (cy - s.y) * t, z: s.z + (0.05 - s.z) * t, nx: s.nx, ny: s.ny, nz: s.nz };
  };
  const shuffled = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const deep = poisson(shuffled(surface).map((s) => toward(s, 0.3)), () => 0.34, 0.34);
  const core = poisson(shuffled(surface).map((s) => toward(s, 0.64)), () => 0.5, 0.5);

  // 3 — assign stable IDs
  const all = [];
  const push = (list, layer) => {
    for (const s of list) {
      all.push({ id: all.length, layer, region: classify(s.x, s.y, s.z, s.nz), ...s });
    }
  };
  push(surface, 0);
  push(deep, 1);
  push(core, 2);
  // Inner nodes take the region of the surface point they were projected from (inverse of `toward`).
  for (const node of all) {
    if (node.layer === 0) continue;
    const t = node.layer === 1 ? 0.3 : 0.64;
    node.region = classify(node.x / (1 - t), node.y, (node.z - 0.05 * t) / (1 - t), node.nz);
  }
  const byLayer = [0, 1, 2].map((l) => all.filter((a) => a.layer === l));

  // 4 — synapses
  const edgeSet = new Set();
  const edges = [];
  const addEdge = (a, b) => {
    if (a === b) return;
    const lo = Math.min(a, b), hi = Math.max(a, b);
    const k = lo * 100000 + hi;
    if (edgeSet.has(k)) return;
    edgeSet.add(k);
    edges.push(lo, hi);
  };
  connectKnn(byLayer[0], byLayer[0], 5, 0.46, addEdge, true);
  connectKnn(byLayer[1], byLayer[1], 4, 0.8, addEdge, true);
  connectKnn(byLayer[2], byLayer[2], 4, 1.15, addEdge, true);
  connectKnn(byLayer[1], byLayer[0], 3, 1.3, addEdge, false);
  connectKnn(byLayer[2], byLayer[1], 3, 1.6, addEdge, false);

  // 5 — packed arrays for rendering / analysis
  const N = all.length;
  const positions = new Float32Array(N * 3);
  const normals = new Float32Array(N * 3);
  const layers = new Uint8Array(N);
  const regions = new Uint8Array(N);
  all.forEach((a, i) => {
    positions.set([a.x, a.y, a.z], i * 3);
    normals.set([a.nx, a.ny, a.nz], i * 3);
    layers[i] = a.layer;
    regions[i] = a.region;
  });
  const edgeArray = new Uint32Array(edges);
  const neighbors = Array.from({ length: N }, () => []);
  const incident = Array.from({ length: N }, () => []);
  for (let e = 0; e < edgeArray.length / 2; e++) {
    const a = edgeArray[e * 2], b = edgeArray[e * 2 + 1];
    neighbors[a].push(b);
    neighbors[b].push(a);
    incident[a].push(e);
    incident[b].push(e);
  }
  const layerCounts = byLayer.map((l) => l.length);
  const usedRegions = new Set(regions).size;

  return {
    seed,
    count: N,
    edgeCount: edgeArray.length / 2,
    positions,
    normals,
    layers,
    regions,
    edges: edgeArray,
    neighbors,
    incident,
    layerCounts,
    usedRegions,
    toJSON() {
      const r4 = (v) => Math.round(v * 1e4) / 1e4;
      return {
        meta: {
          name: 'neural-face-topology',
          version: 1,
          seed,
          units: 'model',
          axes: { up: '+Y', forward: '+Z', left: '+X' },
          nodeCount: N,
          edgeCount: edgeArray.length / 2,
        },
        layers: LAYERS.map((l) => l.key),
        regions: REGIONS.map((r) => r.key),
        nodes: all.map((a, i) => ({
          id: i,
          layer: LAYERS[a.layer].key,
          region: REGIONS[regions[i]].key,
          position: [r4(a.x), r4(a.y), r4(a.z)],
          normal: [r4(a.nx), r4(a.ny), r4(a.nz)],
        })),
        edges: Array.from({ length: edgeArray.length / 2 }, (_, e) => [edgeArray[e * 2], edgeArray[e * 2 + 1]]),
      };
    },
  };
}
