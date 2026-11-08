/*
 * Expression basis: how each facial muscle moves the skin of this particular scan.
 *
 * Every one of the 52 MediaPipe/ARKit blendshapes is authored here as a displacement field over
 * the 478 face-mesh landmarks, in millimetres, from facial anatomy (FACS action units). An
 * expression is then a weighted sum of these fields; the rig transfers the landmark field onto
 * the skin and the neural network exactly as it does for the webcam.
 *
 * Why blendshapes rather than raw landmark positions: they describe muscle activity, not face
 * shape. A photo of someone else analysed into blendshapes carries their expression without
 * their bone structure, so it can be put on this head without turning it into their face.
 *
 * Conventions
 *   - Face frame in mm: origin at the midline, at nasion height and depth; +X = subject's LEFT,
 *     +Y up, +Z out of the face. The scan's axes are the same, only scaled.
 *   - "Left"/"Right" in shape names are the subject's own sides (ARKit convention).
 *   - Magnitudes are for weight 1.0 and follow measured ranges of facial motion (roughly: brow
 *     raise 8-10 mm, lip-corner pull ~10 mm, corner depression ~5 mm, jaw drop ~25 mm).
 *   - In-plane motion is projected onto the skin surface (so it slides along the face instead
 *     of cutting into it); "out" components go along the surface normal.
 *
 * Pure data: no three.js, so it can be checked in node (see tools/check-basis.mjs).
 */

import { BLENDSHAPES, UPPER_LIP, LOWER_LIP, MOUTH_CORNERS, MIDLINE, SIDES, LIP_CONTACT } from '../live/landmarkSets.js';

const N = 478;
const OUTER_CANTHAL_MM = 90; // adult outer-canthal width, used to calibrate scan units to mm

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const gauss = (d2, s) => Math.exp(-d2 / (2 * s * s));

/** Build the face frame (mm) and the per-landmark helpers every shape uses. */
function makeFrame(anchors, valid) {
  const raw = (i) => [anchors[i * 3], anchors[i * 3 + 1], anchors[i * 3 + 2]];
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const [eo0, eo1] = [raw(SIDES.eye[0][0]), raw(SIDES.eye[1][0])];
  const unitsPerMM = dist(eo0, eo1) / OUTER_CANTHAL_MM;

  let mx = 0, n = 0;
  for (const i of MIDLINE) if (valid[i]) { mx += anchors[i * 3]; n++; }
  mx /= n;
  const nasion = raw(168);
  const origin = [mx, nasion[1], nasion[2]];

  // Landmark positions in mm.
  const P = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    if (!valid[i]) continue;
    for (let c = 0; c < 3; c++) P[i * 3 + c] = (anchors[i * 3 + c] - origin[c]) / unitsPerMM;
  }
  const at = (i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
  const avg = (ids) => {
    const ok = ids.filter((i) => valid[i]);
    const s = [0, 0, 0];
    for (const i of ok) for (let c = 0; c < 3; c++) s[c] += P[i * 3 + c];
    return s.map((v) => v / ok.length);
  };

  // Named anatomical points, per side where it applies (0 = right, 1 = left).
  const F = {
    innerBrow: [0, 1].map((s) => avg([SIDES.browUpper[s][0], SIDES.browLower[s][0]])),
    eyeC: [0, 1].map((s) => avg(SIDES.eye[s])),
    eyeOuter: [0, 1].map((s) => at(SIDES.eye[s][0])),
    corner: [0, 1].map((s) => at(SIDES.mouthCorner[s])),
    alar: [0, 1].map((s) => avg(SIDES.alar[s])),
    cheek: [0, 1].map((s) => avg(SIDES.cheek[s])),
    lipUpper: at(0),
    lipLower: at(17),
    seam: avg([13, 14]),
    chin: avg([199, 175]),
  };
  F.eyeTopY = Math.max(...[0, 1].map((s) => at(SIDES.eye[s][2])[1]));
  F.mouthHalf = Math.abs(F.corner[1][0] - F.corner[0][0]) / 2;

  // Brow height as a function of |X|, per side, from the landmark rows themselves.
  const row = (ids) => ids.filter((i) => valid[i]).map((i) => at(i)).map((p) => [Math.abs(p[0]), p[1]]).sort((a, b) => a[0] - b[0]);
  const lerpRow = (pts, ax) => {
    if (ax <= pts[0][0]) return pts[0][1];
    for (let k = 1; k < pts.length; k++) {
      if (ax <= pts[k][0]) {
        const t = (ax - pts[k - 1][0]) / (pts[k][0] - pts[k - 1][0]);
        return pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * t;
      }
    }
    return pts[pts.length - 1][1];
  };
  const browUp = [0, 1].map((s) => row(SIDES.browUpper[s]));
  const browLo = [0, 1].map((s) => row(SIDES.browLower[s]));
  F.browY = (x) => lerpRow(browUp[x < 0 ? 0 : 1], Math.abs(x));
  F.browLowY = (x) => lerpRow(browLo[x < 0 ? 0 : 1], Math.abs(x));

  // Lip seam height across the mouth (a shallow bow between the corners). Centred on the mouth,
  // not the face midline: on this scan they are ~1 mm apart, enough to skew the jaw's share of
  // the lip line between the two sides.
  const cornerY = (F.corner[0][1] + F.corner[1][1]) / 2;
  F.mouthCx = (F.corner[0][0] + F.corner[1][0]) / 2;
  F.seamY = (x) => {
    const t = Math.min(1, Math.abs(x - F.mouthCx) / F.mouthHalf);
    return cornerY + (F.seam[1] - cornerY) * (1 - t * t);
  };

  // Which lip a landmark belongs to: 1 = upper, 0 = lower, 0.5 = corner. Lip landmarks use their
  // topology (a lip is thin; geometry alone mislabels its inner edge), the rest their height.
  const up = new Set(UPPER_LIP), lo = new Set(LOWER_LIP), corners = new Set(MOUTH_CORNERS);
  const upperness = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    if (corners.has(i)) upperness[i] = 0.5;
    else if (up.has(i)) upperness[i] = 1;
    else if (lo.has(i)) upperness[i] = 0;
    else upperness[i] = smooth(-1.5, 1.5, P[i * 3 + 1] - F.seamY(P[i * 3]));
  }
  return { P, F, unitsPerMM, origin, upperness };
}

/**
 * Surface normal at each landmark: the least-variance direction of the landmark cloud around it,
 * with gaussian weights over a fixed RADIUS (not a fixed count), oriented away from the head.
 *
 * Both choices matter. Around the mouth MediaPipe packs landmarks along the lip contour, so "the
 * nearest N" are points on a curve, and a plane fitted to a curve is undetermined: the normals of
 * two mirror-image lip landmarks came out 40 degrees apart, and projecting motion onto them made
 * the smile lopsided by 3.6 mm. A fixed radius always takes in the cheek, chin and nose around it,
 * i.e. the face surface rather than the lip line.
 */
const NORMAL_SIGMA_MM = 10;
export function landmarkNormals(anchors) {
  const out = new Float32Array(N * 3);
  const ids = [];
  for (let i = 0; i < N; i++) if (anchors[i * 3] !== null && anchors[i * 3] !== undefined) ids.push(i);
  const dist = (a, b) => Math.hypot(anchors[a * 3] - anchors[b * 3], anchors[a * 3 + 1] - anchors[b * 3 + 1], anchors[a * 3 + 2] - anchors[b * 3 + 2]);
  const sigma = (dist(33, 263) / OUTER_CANTHAL_MM) * NORMAL_SIGMA_MM;
  const cut2 = (3 * sigma) ** 2;
  let mx = 0, my = 0, mz = 0;
  for (const i of ids) { mx += anchors[i * 3]; my += anchors[i * 3 + 1]; mz += anchors[i * 3 + 2]; }
  mx /= ids.length; my /= ids.length; mz = mz / ids.length - 2.5; // behind the face
  for (const i of ids) {
    const px = anchors[i * 3], py = anchors[i * 3 + 1], pz = anchors[i * 3 + 2];
    let W = 0;
    const m = [0, 0, 0];
    const nb = [];
    for (const j of ids) {
      const d2 = (anchors[j * 3] - px) ** 2 + (anchors[j * 3 + 1] - py) ** 2 + (anchors[j * 3 + 2] - pz) ** 2;
      if (d2 > cut2) continue;
      const w = Math.exp(-d2 / (2 * sigma * sigma));
      nb.push([j, w]);
      W += w;
      for (let c = 0; c < 3; c++) m[c] += w * anchors[j * 3 + c];
    }
    for (let c = 0; c < 3; c++) m[c] /= W;
    const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (const [j, w] of nb) {
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
        C[a][b] += w * (anchors[j * 3 + a] - m[a]) * (anchors[j * 3 + b] - m[b]);
      }
    }
    // Smallest eigenvector: power iteration on (trace * I - C).
    const tr = C[0][0] + C[1][1] + C[2][2];
    let v = [px - mx, py - my, pz - mz];
    for (let it = 0; it < 60; it++) {
      const w = [0, 1, 2].map((a) => tr * v[a] - (C[a][0] * v[0] + C[a][1] * v[1] + C[a][2] * v[2]));
      const L = Math.hypot(w[0], w[1], w[2]) || 1;
      v = w.map((x) => x / L);
    }
    if (v[0] * (px - mx) + v[1] * (py - my) + v[2] * (pz - mz) < 0) v = v.map((x) => -x);
    out.set(v, i * 3);
  }
  return out;
}

/**
 * Author all shapes.
 * @param {object} o
 * @param {ArrayLike<number|null>} o.anchors flat scan-space landmark positions (478 * 3)
 * @param {ArrayLike<number>} [o.normals] flat unit surface normals (default: landmarkNormals)
 * @returns {{ names: string[], fields: Record<string, Float32Array>, unitsPerMM: number, frame: object }}
 *          fields are in scan units, ready to be summed into the rig's displacement buffer.
 */
export function buildBasis({ anchors, normals = landmarkNormals(anchors) }) {
  const valid = new Uint8Array(N);
  for (let i = 0; i < N; i++) valid[i] = anchors[i * 3] === null || anchors[i * 3] === undefined ? 0 : 1;
  const { P, F, unitsPerMM, origin, upperness } = makeFrame(anchors, valid);

  const fields = {};
  const lipZoneUpper = (i) => upperness[i];
  const lipZoneLower = (i) => 1 - upperness[i];
  // Share of a midline feature that belongs to one side (they sum to 1 across both sides).
  const sideW = (x, s) => (s === 1 ? smooth(-7, 7, x) : 1 - smooth(-7, 7, x));
  const out = (s) => (s === 1 ? 1 : -1); // lateral (outward) direction on side s

  const d2 = (i, c) => {
    const dx = P[i * 3] - c[0], dy = P[i * 3 + 1] - c[1], dz = P[i * 3 + 2] - c[2];
    return dx * dx + dy * dy + dz * dz;
  };
  // Anisotropic gaussian in the face plane (depth ignored so a kernel doesn't weaken on the
  // sloping sides of the face).
  const ga = (i, c, sx, sy) => {
    const dx = (P[i * 3] - c[0]) / sx, dy = (P[i * 3 + 1] - c[1]) / sy;
    return Math.exp(-(dx * dx + dy * dy) / 2);
  };

  /**
   * Define one shape. `fn(i, x, y, z, add)` calls add(tx, ty, out, [mx, my, mz]) where (tx, ty)
   * slides along the skin, `out` pushes along the normal and m is a raw model-frame offset.
   */
  function shape(name, fn) {
    const f = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      if (!valid[i]) continue;
      let tx = 0, ty = 0, on = 0, rx = 0, ry = 0, rz = 0;
      fn(i, P[i * 3], P[i * 3 + 1], P[i * 3 + 2], (a, b, o = 0, m = null) => {
        tx += a; ty += b; on += o;
        if (m) { rx += m[0]; ry += m[1]; rz += m[2]; }
      });
      const nx = normals[i * 3], ny = normals[i * 3 + 1], nz = normals[i * 3 + 2];
      // Project the in-plane motion onto the tangent plane, keeping its length (a brow sliding up
      // a forehead that leans back still travels its full distance, it just follows the skin).
      const len = Math.hypot(tx, ty);
      let px = tx, py = ty, pz = 0;
      if (len > 1e-6) {
        const dot = tx * nx + ty * ny;
        px -= dot * nx; py -= dot * ny; pz -= dot * nz;
        const pl = Math.hypot(px, py, pz);
        const k = pl > 1e-6 ? Math.min(1.6, len / pl) : 0;
        px *= k; py *= k; pz *= k;
      }
      f[i * 3] = (px + on * nx + rx) * unitsPerMM;
      f[i * 3 + 1] = (py + on * ny + ry) * unitsPerMM;
      f[i * 3 + 2] = (pz + on * nz + rz) * unitsPerMM;
    }
    fields[name] = f;
  }

  // ---------- brows (frontalis, corrugator, depressor supercilii, procerus) ----------

  // How much of a brow movement a point shares, by height: the brow and the skin just above it
  // move fully; the forehead moves less toward the hairline (the muscle shortens there); the
  // soft tissue between brow and upper lid stretches; the lid itself is procedural (weight 0).
  const browProfile = (x, y, fade = 0.65, reach = 32) => {
    const by = F.browY(x), bl = F.browLowY(x);
    if (y >= bl) return 1 - fade * smooth(by, by + reach, y);
    return smooth(F.eyeTopY + 1.5, bl, y) ** 0.8;
  };
  const beyond = (x, y) => (1 - smooth(62, 74, Math.abs(x))) * (1 - smooth(58, 70, y));

  // AU1 inner brow raiser: the inner heads rise, the tails barely move. Together with AU4 this is
  // the oblique "grief" brow, the single most reliable sign of sadness.
  shape('browInnerUp', (i, x, y, z, add) => {
    const d = Math.max(0, Math.abs(x) - 13);
    const w = gauss(d * d, 14) * browProfile(x, y) * beyond(x, y);
    add(-Math.sign(x) * 0.9 * w, 9 * w);
  });

  // AU4 brow lowerer: brows pulled down and together, the inner heads bunching forward; the
  // glabella drops with them (procerus) and the tissue above the lids is pushed down (hooding).
  for (const s of [0, 1]) {
    shape(s ? 'browDownLeft' : 'browDownRight', (i, x, y, z, add) => {
      const ax = Math.abs(x);
      const prof = browProfile(x, y, 0.8, 28);
      const lat = 1 - 0.6 * smooth(16, 57, ax);
      const medial = smooth(3, 15, ax) * (1 - 0.7 * smooth(20, 55, ax));
      const bulge = gauss((ax - 18) ** 2, 10);
      const glab = gauss(x * x, 7) * smooth(-6, 4, y) * (1 - smooth(18, 30, y));
      const side = sideW(x, s) * beyond(x, y);
      add(-Math.sign(x) * 3.2 * medial * prof * side, (-5.5 * lat * prof - 2.5 * glab) * side, 1.2 * bulge * prof * side);
    });
  }

  // AU2 outer brow raiser.
  for (const s of [0, 1]) {
    shape(s ? 'browOuterUpLeft' : 'browOuterUpRight', (i, x, y, z, add) => {
      const w = gauss((Math.abs(x) - 48) ** 2, 15) * browProfile(x, y) * sideW(x, s) * beyond(x, y);
      add(0, 8 * w);
    });
  }

  // ---------- eyes and cheeks (orbicularis oculi) ----------

  // Tissue below the eye, used by the lower-lid tighteners.
  const infra = (i, s) => ga(i, [F.eyeC[s][0], F.eyeC[s][1] - 10], 14, 7) * (P[i * 3 + 1] < F.eyeC[s][1] - 1.5 ? 1 : 0);

  for (const s of [0, 1]) {
    // AU7 lid tightener: lower lid raised and tensed (the lid itself is procedural in the rig).
    shape(s ? 'eyeSquintLeft' : 'eyeSquintRight', (i, x, y, z, add) => {
      const w = infra(i, s);
      const c = gauss(d2(i, F.eyeOuter[s]), 6);
      add(-out(s) * 1.0 * c, 2.2 * w, 0.6 * w);
    });
    // AU5 upper lid raiser: the skin above the lid follows the lid up a little.
    shape(s ? 'eyeWideLeft' : 'eyeWideRight', (i, x, y, z, add) => {
      const w = gauss((x - F.eyeC[s][0]) ** 2, 14) * smooth(F.eyeTopY + 1, F.eyeTopY + 5, y) * (1 - smooth(F.browLowY(x) - 1, F.browY(x), y));
      add(0, 1.5 * w);
    });
    // Blink: the fold above the lid follows it down slightly.
    shape(s ? 'eyeBlinkLeft' : 'eyeBlinkRight', (i, x, y, z, add) => {
      const w = ga(i, [F.eyeC[s][0], F.eyeC[s][1] + 6], 12, 4);
      add(0, -1.0 * w);
    });
    // AU6 cheek raiser: the orbital ring of orbicularis draws skin toward the eye from all around.
    // Below the eye that lifts and bunches the cheek (the part that makes a smile "reach the
    // eyes"); above it, it pulls the brow tail down a little. Crow's feet are drawn in the shader.
    shape(s ? 'cheekSquintLeft' : 'cheekSquintRight', (i, x, y, z, add) => {
      const e = F.eyeC[s];
      const dx = e[0] - x, dy = e[1] - y;
      const r = Math.hypot(dx, dy) || 1;
      // Above the eye the ring only nudges the brow tail: at half strength it lowered the brow
      // enough that a face analyser read a Duchenne smile's eyes as a frown.
      const ring = smooth(12, 18, r) * (1 - smooth(28, 42, r)) * (y < e[1] ? 1 : 0.22);
      const apple = ga(i, [e[0] - out(s) * 4, e[1] - 24], 16, 12);
      add((dx / r) * 2.5 * ring, (dy / r) * 2.5 * ring + 1.5 * apple, 1.2 * apple);
    });
    shape(s ? 'eyeLookDownLeft' : 'eyeLookDownRight', () => {});
    shape(s ? 'eyeLookUpLeft' : 'eyeLookUpRight', () => {});
    shape(s ? 'eyeLookInLeft' : 'eyeLookInRight', () => {});
    shape(s ? 'eyeLookOutLeft' : 'eyeLookOutRight', () => {});
  }

  shape('cheekPuff', (i, x, y, z, add) => {
    let w = 0;
    for (const s of [0, 1]) w += ga(i, [out(s) * 38, F.corner[s][1] + 12], 16, 14);
    add(Math.sign(x) * 1.5 * w, 0, 4 * w + 0.8 * ga(i, F.seam, 12, 8));
  });

  // ---------- nose ----------

  // AU9 nose wrinkler: nose wings and the top of the nasolabial fold pulled up, the inner brow and
  // the nasal root pulled down, the upper lip's outer part lifted a little.
  for (const s of [0, 1]) {
    shape(s ? 'noseSneerLeft' : 'noseSneerRight', (i, x, y, z, add) => {
      const a = F.alar[s];
      const wing = ga(i, [a[0], a[1] + 6], 8, 14);
      const lip = ga(i, [a[0] + out(s) * 3, F.lipUpper[1] + 9], 9, 7) * lipZoneUpper(i);
      const brow = gauss(d2(i, F.innerBrow[s]), 11);
      const root = ga(i, [0, 3], 8, 8) * sideW(x, s);
      const infraIn = ga(i, [F.eyeC[s][0] * 0.6, F.eyeC[s][1] - 16], 9, 8);
      add(-Math.sign(x) * 1.2 * brow, 4 * wing + 2.2 * lip - 2.5 * brow - 2 * root + 1.5 * infraIn, -0.5 * wing);
    });
  }

  // ---------- mouth ----------

  for (const s of [0, 1]) {
    const C = F.corner[s];
    const S = s ? 'Left' : 'Right';

    // AU12 lip corner puller (zygomaticus major): the corner travels up and out toward the
    // cheekbone and slightly back; the cheek above it rises and fills out. The lip centres barely
    // move — a smile is at the corners.
    shape('mouthSmile' + S, (i, x, y, z, add) => {
      const wc = ga(i, C, 10, 9);
      const wk = ga(i, F.cheek[s], 15, 13) * smooth(C[1] + 2, C[1] + 8, y);
      const lid = ga(i, [F.eyeC[s][0], F.eyeC[s][1] - 13], 12, 6);
      const mid = ga(i, F.lipUpper, 10, 6) * lipZoneUpper(i) * sideW(x, s);
      add(out(s) * (7 * wc + 1.0 * wk), 6.5 * wc + 3.5 * wk + 1.2 * lid + 0.8 * mid, -3 * wc + 2.2 * wk);
    });

    // AU15 lip corner depressor (depressor anguli oris): the corners are drawn down and slightly
    // out toward the jaw. Deliberately local: the middle of the lips stays level, which is what
    // separates a real downturned mouth from a cartoon arch.
    shape('mouthFrown' + S, (i, x, y, z, add) => {
      const wc = ga(i, C, 9, 8);
      const wm = ga(i, [C[0] + out(s) * 5, C[1] - 12], 9, 9) * lipZoneLower(i);
      const wl = ga(i, [C[0] * 0.6, F.lipLower[1] + 2], 8, 5) * lipZoneLower(i);
      add(out(s) * (1.8 * wc + 0.6 * wm), -4.8 * wc - 2.2 * wm - 1.5 * wl, -0.6 * wc);
    });

    // AU20 lip stretcher (risorius): corners pulled straight out and a little down; lips flatten.
    shape('mouthStretch' + S, (i, x, y, z, add) => {
      const wc = ga(i, C, 10, 9);
      const wl = ga(i, [C[0] * 0.6, F.lipLower[1] + 2], 9, 5) * lipZoneLower(i);
      const neck = ga(i, [C[0] + out(s) * 6, C[1] - 20], 12, 12);
      add(out(s) * (5 * wc + 2 * wl), -1.6 * wc - 1.2 * wl - 1.0 * neck, -1.5 * wc);
    });

    // AU14 dimpler (buccinator): corner pulled back into the cheek.
    shape('mouthDimple' + S, (i, x, y, z, add) => {
      const wc = ga(i, C, 8, 8);
      const wk = ga(i, [C[0] + out(s) * 8, C[1] + 2], 9, 9);
      add(out(s) * 1.5 * wc, 1.0 * wc, -3 * wc - 1.2 * wk);
    });

    // AU24 lip presser: both red lips thin and press together.
    shape('mouthPress' + S, (i, x, y, z, add) => {
      const sy = F.seamY(x);
      const wu = ga(i, [C[0] * 0.5, sy + 3], 14, 3.5) * lipZoneUpper(i) * sideW(x, s);
      const wl = ga(i, [C[0] * 0.5, sy - 4], 14, 4) * lipZoneLower(i) * sideW(x, s);
      const wc = gauss(d2(i, C), 6);
      add(-out(s) * 0.8 * wc, -1.2 * wu + 1.6 * wl, -1.4 * (wu + wl));
    });

    // AU10 upper lip raiser: the outer upper lip lifts (baring the upper teeth), the fold deepens.
    shape('mouthUpperUp' + S, (i, x, y, z, add) => {
      const wl = ga(i, [C[0] * 0.55, F.lipUpper[1] - 1], 9, 6) * lipZoneUpper(i);
      const wc = ga(i, F.lipUpper, 7, 6) * lipZoneUpper(i) * sideW(x, s);
      const fold = ga(i, [F.alar[s][0] + out(s) * 8, F.alar[s][1] - 8], 8, 9);
      const wing = gauss(d2(i, F.alar[s]), 7);
      add(0, 4.2 * wl + 1.4 * wc + 2.5 * fold + 1.5 * wing, 0.8 * wl);
    });

    // AU16 lower lip depressor: the outer lower lip pulled down, exposing the lower teeth.
    shape('mouthLowerDown' + S, (i, x, y, z, add) => {
      const wl = ga(i, [C[0] * 0.5, F.lipLower[1] + 1], 9, 6) * lipZoneLower(i);
      const wc = ga(i, F.lipLower, 7, 6) * lipZoneLower(i) * sideW(x, s);
      add(0, -4 * wl - 1.5 * wc, 1.0 * wl);
    });
  }

  // AU17 chin raiser (mentalis): the chin boss rises and pushes the lower lip up and forward.
  // With AU15 it gives the sad "horseshoe" mouth and the dimpled chin (drawn in the shader).
  shape('mouthShrugLower', (i, x, y, z, add) => {
    const wch = ga(i, F.chin, 15, 11);
    const wll = ga(i, F.lipLower, 13, 6) * lipZoneLower(i);
    const wul = ga(i, [0, F.seam[1] + 1], 11, 6) * lipZoneUpper(i);
    add(0, 4.5 * wch + 3.2 * wll + 1.8 * wul, 2.2 * wch + 2.4 * wll + 0.8 * wul);
  });
  shape('mouthShrugUpper', (i, x, y, z, add) => {
    const w = ga(i, F.lipUpper, 13, 7) * lipZoneUpper(i);
    add(0, 2.4 * w, 1.2 * w);
  });
  shape('mouthRollLower', (i, x, y, z, add) => {
    const w = ga(i, [0, F.lipLower[1] + 2], 18, 5) * lipZoneLower(i);
    add(0, 1.2 * w, -3 * w);
  });
  shape('mouthRollUpper', (i, x, y, z, add) => {
    const w = ga(i, [0, F.lipUpper[1] - 1.5], 18, 4.5) * lipZoneUpper(i);
    add(0, -1.2 * w, -3 * w);
  });
  // AU18 lip pucker: corners drawn together, lips pushed forward.
  shape('mouthPucker', (i, x, y, z, add) => {
    let tx = 0, on = 0;
    for (const s of [0, 1]) {
      const wc = ga(i, F.corner[s], 9, 8);
      tx -= out(s) * 6 * wc;
      on += 2.5 * wc;
    }
    on += 4.5 * ga(i, F.seam, 16, 10);
    add(tx, 0, on);
  });
  // AU22 lip funneler: lips pushed forward and flared apart.
  shape('mouthFunnel', (i, x, y, z, add) => {
    let tx = 0, on = 0;
    for (const s of [0, 1]) {
      const wc = ga(i, F.corner[s], 9, 8);
      tx -= out(s) * 4 * wc;
      on += 2 * wc;
    }
    const wu = ga(i, F.lipUpper, 14, 6) * lipZoneUpper(i);
    const wl = ga(i, F.lipLower, 14, 6) * lipZoneLower(i);
    add(tx, 2 * wu - 2.5 * wl, on + 4 * (wu + wl));
  });
  // Whole mouth shifted sideways (ARKit: toward the subject's own left / right).
  for (const [name, dir] of [['mouthLeft', 1], ['mouthRight', -1]]) {
    shape(name, (i, x, y, z, add) => add(dir * 5 * ga(i, F.seam, 22, 14), 0));
  }

  // ---------- jaw ----------

  // Share of the jaw's rotation a point follows: the lower lip and chin fully, the corners about
  // half, less toward the hinge near the ear (displacement grows with distance from the hinge).
  // The lips themselves (lower lip, corners) always ride with the jaw. The fade just below the
  // seam is for the surrounding skin only: applied to the lips as well, it cancelled the jaw for
  // every lip landmark near the seam — jawOpen 1 dropped the chin 24 mm while the inner lower lip
  // moved 0.1 mm, so the mouth never opened (not in speech, not in surprise).
  const jawLip = new Set([...LOWER_LIP, ...MOUTH_CORNERS]);
  const jawShare = (i, x, y) => {
    const u = upperness[i];
    let t = 1 - smooth(F.seamY(x) - 6, F.seamY(x) + 3, y);
    if (u === 0) t = 1;
    else if (u === 1) t = 0;
    else if (u === 0.5) t = 0.42;
    const skinFade = jawLip.has(i) ? 1 : 1 - smooth(-20, -8, y - F.seamY(x) - 8);
    return t * (1 - 0.75 * smooth(18, 62, Math.abs(x))) * skinFade;
  };
  shape('jawOpen', (i, x, y, z, add) => {
    const t = jawShare(i, x, y);
    add(0, 0, 0, [0, -24 * t, -6.7 * t]);
  });
  shape('jawForward', (i, x, y, z, add) => { const t = jawShare(i, x, y); add(0, 0, 0, [0, 0.5 * t, 4.5 * t]); });
  shape('jawLeft', (i, x, y, z, add) => { const t = jawShare(i, x, y); add(5 * t, 0); });
  shape('jawRight', (i, x, y, z, add) => { const t = jawShare(i, x, y); add(-5 * t, 0); });
  // Lips held together while the jaw is open (only meaningful together with jawOpen).
  shape('mouthClose', (i, x, y, z, add) => {
    const wl = ga(i, F.lipLower, 14, 7) * lipZoneLower(i);
    const wu = ga(i, F.lipUpper, 14, 6) * lipZoneUpper(i);
    add(0, 0, 0, [0, 8 * wl - 1.5 * wu, 2 * wl]);
  });

  shape('_neutral', () => {});

  const names = BLENDSHAPES.filter((n) => fields[n]);
  const missing = BLENDSHAPES.filter((n) => !fields[n]);
  if (missing.length) throw new Error('faceBasis: shapes not authored: ' + missing.join(', '));

  const frame = { origin, unitsPerMM, points: F };
  const contact = LIP_CONTACT.filter(([u, l]) => valid[u] && valid[l]).map(([u, l]) => ({
    u, l, gap: Math.max(0, anchors[u * 3 + 1] - anchors[l * 3 + 1]),
  }));
  return { names, fields, unitsPerMM, frame, contact };
}

/**
 * Sum a weighted set of shapes into `out` (scan units, 478 * 3).
 *
 * Two constraints are applied on top of the plain sum, because real lips obey them and a linear
 * sum does not:
 *   - mouthClose is gated by jawOpen: on its own it would press the lips through each other.
 *   - Closed lips stay in contact. When shapes push the lower lip up further than the upper lip
 *     (the chin raiser in a sad face does exactly that), the overlap is shared out — the lower lip
 *     pushes the upper one up, as it does on a real face — instead of one passing through the other.
 */
export function compose(basis, weights, out) {
  out.fill(0);
  const jaw = weights.jawOpen ?? 0;
  for (const name of basis.names) {
    let w = weights[name] ?? 0;
    if (name === 'mouthClose') w = Math.min(w, jaw * 1.2);
    if (w === 0) continue;
    const f = basis.fields[name];
    for (let k = 0; k < f.length; k++) out[k] += w * f[k];
  }
  for (const { u, l, gap } of basis.contact) {
    const overlap = (out[l * 3 + 1] - out[u * 3 + 1]) - gap;
    if (overlap <= 0) continue;
    out[u * 3 + 1] += overlap * 0.6;
    out[l * 3 + 1] -= overlap * 0.4;
  }
  return out;
}
