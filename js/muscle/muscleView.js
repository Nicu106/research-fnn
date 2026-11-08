import * as THREE from 'three';
import { ANATOMY } from './muscleAnatomy.js';
import { MUSCLES } from './muscles.js';
import { landmarkNormals } from '../emotion/faceBasis.js';
import { MIRROR_PAIRS } from '../live/landmarkSets.js';

/*
 * The mimic muscles drawn on the face, like an anatomy atlas (écorché): fibre sheets under the
 * skin, red muscle bellies with pale tendons at the ends, striated along the fibre direction.
 *
 * Every vertex is bound to the rig (bindTo), so the sheets ride on the face: when the skin at an
 * insertion moves, the muscle shortens or stretches with it. Activation (from the muscle layer,
 * via the neuromotor network) brightens a muscle and sends a contraction wave from its insertion
 * toward its origin, the direction it pulls.
 *
 * Sheets facing away from the camera fade out, so the far side of the face does not show through.
 */

const NV_SHEET = 22; // samples along the fibres
const NV_RING = 56;  // samples around a ring

const VS = /* glsl */ `
  attribute vec2 aUV;      // u across the fibres, v along them (0 origin -> 1 insertion)
  attribute float aAct;
  attribute float aFib;    // number of fibre bundles across the sheet
  attribute float aDeep;   // 1 = deep muscle
  attribute vec3 aTip;     // position + outward normal (bound to the rig with the vertex)
  varying vec2 vUV;
  varying float vAct;
  varying float vFib;
  varying float vDeep;
  varying float vFacing;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize((modelViewMatrix * vec4(aTip, 1.0)).xyz - mv.xyz);
    vFacing = dot(n, normalize(-mv.xyz));
    vUV = aUV; vAct = aAct; vFib = aFib; vDeep = aDeep;
    gl_Position = projectionMatrix * mv;
  }
`;

const FS = /* glsl */ `
  uniform float uTime;
  uniform float uVis;
  varying vec2 vUV;
  varying float vAct;
  varying float vFib;
  varying float vDeep;
  varying float vFacing;
  void main() {
    float u = vUV.x, v = vUV.y;
    // Fibre bundles: rounded stripes across the sheet, with finer fibrils inside them.
    float bundle = 0.5 + 0.5 * cos(u * vFib * 6.2831853);
    float fibril = 0.5 + 0.5 * cos(u * vFib * 6.2831853 * 4.0 + sin(v * 9.0) * 0.6);
    float stri = 0.72 + 0.18 * bundle + 0.1 * fibril;
    // Tendons (pale, fibrous) at both ends; the belly in between.
    float tendon = 1.0 - smoothstep(0.0, 0.12, v) * smoothstep(1.0, 0.86, v);
    vec3 belly = vec3(0.62, 0.10, 0.09);
    vec3 tend = vec3(0.86, 0.80, 0.72);
    vec3 col = mix(belly, tend, tendon * 0.85) * stri;
    // Activation: the belly warms and brightens, and a wave runs from insertion to origin.
    float a = vAct;
    float wave = pow(0.5 + 0.5 * sin((v * 3.0 + uTime * 2.4) * 6.2831853), 6.0);
    col = mix(col, vec3(1.0, 0.36, 0.24) * stri, a * (1.0 - tendon) * 0.9);
    col += vec3(1.0, 0.55, 0.35) * wave * a * a * (1.0 - tendon) * 0.9;
    col *= 0.75 + 0.6 * a;
    // Soft edges across the sheet; deep muscles are dimmer; the far side fades out.
    float edge = smoothstep(0.0, 0.1, u) * smoothstep(1.0, 0.9, u);
    float facing = smoothstep(-0.05, 0.3, vFacing);
    float alpha = uVis * edge * mix(1.0, 0.45, vDeep) * mix(facing, 1.0, vDeep * 0.6) * (0.78 + 0.22 * a);
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

export class MuscleView {
  /**
   * @param {object} o
   * @param anchors scan-space landmarks (478 * 3)
   * @param frame   faceBasis frame ({ origin, unitsPerMM })
   */
  constructor({ anchors, frame }) {
    this.group = new THREE.Group();
    this.uniforms = { uTime: { value: 0 }, uVis: { value: 0 } };
    this.visTarget = 0;

    const u = frame.unitsPerMM;
    const mx = frame.origin[0];
    const normals = landmarkNormals(anchors);
    const valid = (i) => anchors[i * 3] !== null && anchors[i * 3] !== undefined;
    const P = (i) => [anchors[i * 3], anchors[i * 3 + 1], anchors[i * 3 + 2]];
    const mirror = mirrorTable(anchors, mx, valid);
    const ids = [];
    for (let i = 0; i < 468; i++) if (valid(i)) ids.push(i);

    // Surface through point p: plane fitted to the nearby landmarks (gaussian-weighted mean of
    // their positions and normals). Returns [point on the surface, unit normal].
    const surface = (p) => {
      const near = ids.map((i) => [((anchors[i * 3] - p[0]) ** 2 + (anchors[i * 3 + 1] - p[1]) ** 2 + (anchors[i * 3 + 2] - p[2]) ** 2), i])
        .sort((a, b) => a[0] - b[0]).slice(0, 7);
      const s2 = 2 * (9 * u) ** 2;
      const c = [0, 0, 0], n = [0, 0, 0];
      let wsum = 0;
      for (const [d2, i] of near) {
        const w = Math.exp(-d2 / s2) + 1e-6;
        wsum += w;
        for (let k = 0; k < 3; k++) { c[k] += anchors[i * 3 + k] * w; n[k] += normals[i * 3 + k] * w; }
      }
      const nl = Math.hypot(...n) || 1;
      for (let k = 0; k < 3; k++) { c[k] /= wsum; n[k] /= nl; }
      const d = (p[0] - c[0]) * n[0] + (p[1] - c[1]) * n[1] + (p[2] - c[2]) * n[2];
      return [[p[0] - d * n[0], p[1] - d * n[1], p[2] - d * n[2]], n];
    };

    // A point spec [landmark, lateral, up, forward] on side s (-1 right, +1 left), in scan units.
    const point = ([id, lat = 0, up = 0, fwd = 0], s) => {
      const i = s < 0 ? id : mirror[id];
      const p = P(i);
      return [p[0] + s * lat * u, p[1] + up * u, p[2] + fwd * u];
    };
    const along = (pts, t) => {
      if (pts.length === 1) return pts[0];
      const f = t * (pts.length - 1), k = Math.min(pts.length - 2, Math.floor(f)), r = f - k;
      return pts[k].map((v, c) => v + (pts[k + 1][c] - v) * r);
    };

    const pos = [], tip = [], uv = [], fib = [], deep = [], index = [];
    this.ranges = []; // { key (muscle + side), start, count, centroid index }
    const centroids = [];
    for (const m of MUSCLES) {
      const A = ANATOMY[m.key];
      if (!A) continue;
      for (const [S, s] of [['R', -1], ['L', 1]]) {
        const start = pos.length / 3;
        const NU = Math.max(4, A.fibres) + 1;
        const NV = A.kind === 'ring' ? NV_RING : NV_SHEET;
        let raw; // (iu, iv) -> scan-space point before snapping
        if (A.kind === 'ring') {
          const cs = A.center.map((q) => point(q, s));
          const c = cs.reduce((a, b) => a.map((v, k) => v + b[k] / cs.length), [0, 0, 0]);
          if (A.mouth) c[0] = mx; // the mouth ring is centred on the midline
          raw = (iu, iv) => {
            const t = iu / (NU - 1);
            const ang = (A.arc[0] + (A.arc[1] - A.arc[0]) * (iv / (NV - 1))) * Math.PI / 180;
            const rx = (A.inner[0] + (A.outer[0] - A.inner[0]) * t) * u;
            const ry = (A.inner[1] + (A.outer[1] - A.inner[1]) * t) * u;
            return [c[0] + s * rx * Math.cos(ang), c[1] + ry * Math.sin(ang), c[2] + 6 * u];
          };
        } else {
          const O = A.origin.map((q) => point(q, s)), I = A.insertion.map((q) => point(q, s));
          raw = (iu, iv) => {
            const t = iu / (NU - 1), v = iv / (NV - 1);
            const o = along(O, t), ins = along(I, t);
            return o.map((x, k) => x + (ins[k] - x) * v);
          };
        }
        for (let iv = 0; iv < NV; iv++) {
          for (let iu = 0; iu < NU; iu++) {
            const p = raw(iu, iv);
            let q, n;
            if (A.free) { q = p; n = [s, 0, 0.3]; }
            else {
              [q, n] = surface(p);
              // Sunk to the muscle's depth; the belly bulges a little toward the skin.
              const v = A.kind === 'ring' ? 0.5 : iv / (NV - 1);
              const d = (A.depth - 1.2 * Math.sin(Math.PI * v)) * u;
              q = q.map((x, k) => x - n[k] * Math.max(0.6 * u, d));
            }
            pos.push(...q);
            tip.push(q[0] + n[0] * u, q[1] + n[1] * u, q[2] + n[2] * u);
            // Rings: fibres run around (v), so the stripes go across the radius (u).
            uv.push(iu / (NU - 1), iv / (NV - 1));
            fib.push(A.fibres);
            deep.push(A.free || A.depth >= 8 ? 1 : 0);
          }
        }
        for (let iv = 0; iv < NV - 1; iv++) {
          for (let iu = 0; iu < NU - 1; iu++) {
            const a = start + iv * NU + iu, b = a + 1, c = a + NU, d = c + 1;
            index.push(a, c, b, b, c, d);
          }
        }
        const mid = start + Math.floor(NV / 2) * NU + Math.floor(NU / 2);
        centroids.push(...pos.slice(mid * 3, mid * 3 + 3));
        this.ranges.push({ key: m.key + S, muscle: m.key, side: S, start, count: NU * NV, label: A.short });
      }
    }
    // Rings have no ends, hence no tendons: their v is remapped into 0.15..0.85, which the
    // shader's tendon test treats as belly all the way round.
    this.ranges.forEach((r) => {
      if (ANATOMY[r.muscle].kind !== 'ring') return;
      for (let k = r.start; k < r.start + r.count; k++) uv[k * 2 + 1] = 0.15 + 0.7 * uv[k * 2 + 1];
    });

    this.count = pos.length / 3;
    this.pos = new Float32Array(pos);
    this.tip = new Float32Array(tip);
    this.centroids = new Float32Array(centroids);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aTip', new THREE.BufferAttribute(this.tip, 3));
    g.setAttribute('aUV', new THREE.BufferAttribute(new Float32Array(uv), 2));
    g.setAttribute('aFib', new THREE.BufferAttribute(new Float32Array(fib), 1));
    g.setAttribute('aDeep', new THREE.BufferAttribute(new Float32Array(deep), 1));
    g.setAttribute('aAct', new THREE.BufferAttribute(new Float32Array(this.count), 1));
    g.setIndex(index);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 50);
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: VS, fragmentShader: FS,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    }));
    // With the neuromotor network, before the head's depth-only pass (see neuromotorView.js).
    this.mesh.renderOrder = 3;
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
  }

  /** Bind to the rig: the sheets, their normals and the label anchors follow the face. */
  bindTo(rig) {
    const g = this.mesh.geometry;
    rig.bindTarget(this.pos, this.count, () => { g.getAttribute('position').needsUpdate = true; });
    rig.bindTarget(this.tip, this.count, () => { g.getAttribute('aTip').needsUpdate = true; });
    rig.bindTarget(this.centroids, this.ranges.length, () => {});
  }

  setVisible(on) { this.visTarget = on ? 1 : 0; }

  /**
   * @param {Record<string, number>} act activation per muscle + side (muscleActivity keys)
   */
  update(time, dt, act) {
    const un = this.uniforms;
    un.uTime.value = time;
    un.uVis.value += (this.visTarget - un.uVis.value) * (1 - Math.exp(-dt * 5));
    this.group.visible = un.uVis.value > 0.005;
    if (!this.group.visible || !act) return;
    const a = this.mesh.geometry.getAttribute('aAct');
    for (const r of this.ranges) a.array.fill(act[r.key] ?? 0, r.start, r.start + r.count);
    a.needsUpdate = true;
  }
}

/** Right landmark -> its left counterpart: the known pairs, else the nearest mirrored landmark. */
function mirrorTable(anchors, mx, valid) {
  const m = new Int32Array(478).fill(-1);
  for (const [r, l] of MIRROR_PAIRS) { m[r] = l; m[l] = r; }
  for (let i = 0; i < 468; i++) {
    if (m[i] >= 0 || !valid(i)) continue;
    const x = 2 * mx - anchors[i * 3], y = anchors[i * 3 + 1], z = anchors[i * 3 + 2];
    let best = i, bd = Infinity;
    for (let j = 0; j < 468; j++) {
      if (!valid(j)) continue;
      const d = (anchors[j * 3] - x) ** 2 + (anchors[j * 3 + 1] - y) ** 2 + (anchors[j * 3 + 2] - z) ** 2;
      if (d < bd) { bd = d; best = j; }
    }
    m[i] = best;
  }
  return m;
}
