import * as THREE from 'three';
import { UPPER_LIP, LOWER_LIP, MOUTH_CORNERS, LID_LANDMARKS as LID_LIST, MIDLINE } from './landmarkSets.js';

/*
 * Drives the photoreal scanned head from MediaPipe face landmarks.
 *
 * assets/head/anchors.json holds the 478 landmarks detected on a frontal render of the scan and
 * projected onto its surface (neutral pose). Every frame:
 *   1. the user's landmarks are mirrored (optional) and their head pose is removed by aligning a
 *      rigid upper-face frame to the scan's frame;
 *   2. the expression delta against a short neutral calibration is transferred to nearby skin
 *      vertices (gaussian weights over the K nearest anchors, upper / lower lip kept apart);
 *   3. eyelids are opened procedurally from the blink blendshapes (the scan's eyes are closed), and
 *      the skin shader cuts real openings between the lids and the lips (see head.js);
 *   4. the head is rotated around the neck, blending to the static shoulders.
 * The neural-network nodes are bound with the same weights, so they stay glued to the face.
 */

const N_LM = 478;
const N_DRIVE = 468; // iris landmarks don't drive the skin
const K = 8;
const SIGMA = 0.32;
const REACH = 0.22;
const FALLOFF = 0.45;
const BINS = 24;
const NECK_LOW = -2.7;
const NECK_HIGH = -1.3;
const PIVOT = new THREE.Vector3(0, -1.9, -0.3);
const CALIB_FRAMES = 24;
const GAIN = 1.1;
const LIP_GAIN = 1.45; // lips move little in landmark space; amplify so small lip motion reads
const DEAD_ZONE = 0.004; // ignore jitter below this (model units) so a still face stays still
const LIMIT = { yaw: 55, pitch: 35, roll: 35 };
const DEG = 180 / Math.PI;

// Lid travel from the scan's closed seam to a relaxed open eye. Measured against a real eye: the
// lids of a closed eye meet at the lower third of the cornea, so opening is mostly the upper lid
// rising (~6.8 mm) while the lower lid drops only ~1.7 mm; the relaxed upper lid then covers
// ~1.5 mm of the iris and the lower lid rests at its lower edge. The first values (5 mm / 1.3 mm)
// left a 5.7 mm opening that covered 2 mm of iris top AND bottom: a face analyser read every
// expression, neutral included, as squinting and looking down.
const EYE_LIFT = 0.127; // upper-lid retraction at a fully open eye (model units)
const EYE_DROP = 0.032; // lower-lid drop
// Lower lid raised by a tightened orbicularis (squint, a genuine smile, crying): ~2 mm.
const SQUINT_RAISE = 0.038;
// Lid-gaze coupling: the upper lid follows the eye's vertical rotation. Without it a downward
// look leaves the lids up and the face reads as staring; with it a lowered gaze looks lowered.
const LID_FOLLOW = 0.9; // fraction of opening lost per radian of downward gaze
const LIP_CONTACT_GAP = 0.024; // ~1.3 mm
const LID_SKEW_UP = 0.12; // almond eye: keep in sync with FEATURE_CUT_GLSL in head.js
const LID_SKEW_DOWN = 0.15;
// Gaze: horizontal from the iris position between the eye corners (both eyes averaged, so the
// avatar's eyes always move together and never cross), vertical from the look-up/down blendshapes.
const GAZE_YAW_GAIN = 0.9; // radians per unit of normalised iris offset
const GAZE_YAW_MAX = 0.45;
const GAZE_PITCH = 0.3; // radians at full eyeLookUp / eyeLookDown
const GAZE_DEAD = 0.03;
const GAZE_EYES = [[33, 133, 468], [263, 362, 473]]; // [outer corner, inner corner, iris centre]

const STABLE = [10, 151, 9, 8, 168, 6, 197, 195, 5, 4, 1, 33, 133, 362, 263, 234, 454, 127, 356];
const RIGHT_PAIRS = [[33, 263], [133, 362], [234, 454], [127, 356]]; // subject's right -> left
const UP_PAIRS = [[4, 10], [5, 151], [195, 9], [1, 168]]; // lower -> upper (all above the jaw)
const LIP_SET = new Set([...UPPER_LIP, ...LOWER_LIP]);
// Eyelid landmarks follow the user's blink, which the closed-eyed scan can't express by
// deformation alone; they're driven procedurally instead of through the anchor weights.
const LID_LANDMARKS = new Set(LID_LIST);
const CORNERS = new Set(MOUTH_CORNERS);
// Openings cut in the skin: [corner, corner, seam upper-mid, seam lower-mid].
// 0 = subject's right eye (−X), 1 = subject's left eye (+X), 2 = mouth.
const FEATURES = [[33, 133, 159, 145], [263, 362, 386, 374], [78, 308, 13, 14]];
const CHIN = 152;

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _r = new THREE.Vector3();
const _u = new THREE.Vector3();
const _f = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();
const _t = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const IDENTITY = new THREE.Quaternion();

/**
 * AU1 lifts the inner part of the upper lid skin with the inner brow, AU2 the outer part: the lid
 * line tilts with the brows. This is what makes sad eyes look sad rather than merely sleepy.
 */
export const lidTiltFromBrows = (inner, outer) => Math.max(-0.5, Math.min(0.85, 0.7 * inner - 0.35 * outer));

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const clamp01 = (v) => Math.min(1, Math.max(0, v));

export class AvatarRig {
  /**
   * @param {object} o
   * @param {(number|null)[]} o.anchors flat [x,y,z,...] for 478 landmarks (null = not on the mesh)
   * @param {THREE.Mesh} o.mesh the scanned head (its geometry is deformed in place)
   * @param {object} o.net network data whose `positions` back the rendered nodes
   * @param {object} o.view NetworkView for `net`
   * @param {object} [o.features] skin-shader opening uniforms from head.js
   */
  constructor({ anchors, mesh, net, view, features }) {
    this.A = new Float32Array(N_LM * 3);
    this.valid = new Uint8Array(N_LM);
    for (let i = 0; i < N_LM; i++) {
      if (anchors[i * 3] === null || anchors[i * 3] === undefined) continue;
      this.A.set([anchors[i * 3], anchors[i * 3 + 1], anchors[i * 3 + 2]], i * 3);
      this.valid[i] = 1;
    }
    const ok = (i) => this.valid[i] === 1;
    this.stable = STABLE.filter(ok);
    this.rightPairs = RIGHT_PAIRS.filter(([a, b]) => ok(a) && ok(b));
    this.upPairs = UP_PAIRS.filter(([a, b]) => ok(a) && ok(b));
    this.sym = this.#symmetry();
    this.bA = this.#basis(this.A);
    this.bU = { c: new THREE.Vector3(), R: new THREE.Matrix4(), s: 1 };

    const at = (i) => new THREE.Vector3(this.A[i * 3], this.A[i * 3 + 1], this.A[i * 3 + 2]);
    this.featureGeo = FEATURES.map(([a, b, u, l]) => {
      const A = at(a), B = at(b);
      const mid = at(u).add(at(l)).multiplyScalar(0.5);
      const chord = A.clone().add(B).multiplyScalar(0.5);
      return { a, b, A, B, bowY: mid.y - chord.y, bowZ: mid.z - chord.z };
    });
    this.features = features ?? null;
    if (this.features) {
      this.featureGeo.forEach((g, i) => {
        this.features.uFA.value[i].copy(g.A);
        this.features.uFB.value[i].copy(g.B);
        this.features.uFBow.value[i].set(g.bowY, g.bowZ, 0, 0);
        this.features.uFOff.value[i].set(0, 0, 0);
      });
    }

    this.mirror = true;
    this.U = new Float32Array(N_LM * 3);
    this.N = new Float32Array(N_LM * 3);
    this.D = new Float32Array(N_LM * 3);
    this.Ds = new Float32Array(N_LM * 3);
    this.Q = new THREE.Quaternion();
    this.Qs = new THREE.Quaternion();
    this.mats = Array.from({ length: BINS }, () => new THREE.Matrix4());
    /** Full head rotation about the neck pivot (for rigid parts such as eyeballs and teeth). */
    this.headMatrix = this.mats[BINS - 1];
    this.pose = { yaw: 0, pitch: 0, roll: 0 };
    /** Smoothed facial controls, consumed by FaceParts. */
    this.face = { eyeOpen: [0, 0], lid: [0, 0], gaze: [[0, 0], [0, 0]], mouth: { up: 0, down: 0, midY: 0, midZ: 0 }, jaw: { dy: 0, dz: 0 } };
    // lidTilt > 0 lifts the upper lid more at its inner end (the oblique lid of sadness), < 0 at
    // the outer end. cheek = orbicularis orbital part (AU6), which also raises the lower lid.
    this.faceTarget = { eyeOpen: [1, 1], gaze: [[0, 0], [0, 0]], wide: [0, 0], squint: [0, 0], cheek: [0, 0], lidTilt: [0, 0] };
    this.lidTilt = [0, 0];
    /** When set, expressions come from code (emotion studio) instead of the webcam. */
    this.synthetic = null;
    this.Qsyn = new THREE.Quaternion();
    this.blinkBase = [0.1, 0.1];
    this.blinkAcc = [0, 0];
    this.gazeBase = [0, 0]; // [horizontal iris offset, vertical blendshape balance] when looking at the camera
    this.gazeAcc = [0, 0];

    this.active = false;
    this.calibN = 0;
    this.calibrated = false;
    this.tracking = false;
    this.lostFor = 0;
    this.relaxed = true;

    mesh.frustumCulled = false;
    const geo = mesh.geometry;
    const pos = geo.getAttribute('position');
    const expr = geo.getAttribute('aExpr');
    this.targets = [
      this.#bind(pos.array, pos.count, () => {
        pos.needsUpdate = true;
        if (expr) expr.needsUpdate = true;
        geo.computeVertexNormals();
      }, expr?.array),
      this.#bind(net.positions, net.count, () => view.updatePositions(), undefined, true),
    ];
    /** Per network node: how far its skin has moved from rest (scan units). Drives node glow. */
    this.activation = this.targets[1].act;
  }

  start() {
    this.active = true;
    this.calibrate();
  }

  /**
   * Make any point set follow the face: bound like the skin and the network (nearest-anchor
   * weights for expression, neck-graded rotation for the head). Points deep inside the head get
   * no expression weight and only turn with it.
   * @param {Float32Array} array flat positions, modified in place every frame
   * @param {number} count number of points
   * @param {() => void} onUpdate called after each write
   */
  bindTarget(array, count, onUpdate) {
    const T = this.#bind(array, count, onUpdate);
    this.targets.push(T);
    return T;
  }

  /** Re-capture the neutral face (look at the camera, relaxed). */
  calibrate() {
    this.calibN = 0;
    this.calibrated = false;
    this.N.fill(0);
    this.blinkAcc = [0, 0];
    this.gazeAcc = [0, 0];
  }

  /** Stop following; the avatar eases back to its rest pose (eyes and mouth closed). */
  release() {
    this.active = false;
    this.tracking = false;
    this.synthetic = null;
  }

  /**
   * Drive the face from code instead of the webcam. Call every frame with the current frame.
   * @param {object} f
   * @param {Float32Array} f.D landmark displacement (scan units, 478 * 3), e.g. from faceBasis.compose
   * @param {{pitch:number,yaw:number,roll:number}} f.head radians; pitch > 0 = chin down,
   *        yaw > 0 = face turns to the subject's left, roll > 0 = head tilts to the subject's right
   * @param {number[]} f.eyeOpen per eye, 0 closed .. 1 open (index 0 = subject's right)
   * @param {number[]} f.wide, f.squint, f.cheek per eye 0..1
   * @param {number[][]} f.gaze per eye [yaw, pitch] radians; pitch > 0 = looking down
   * @param {number[]} f.lidTilt per eye
   */
  drive(f) {
    this.synthetic = f;
    this.active = true;
    this.calibrated = true;
  }

  /**
   * @param result tracker output: undefined = no new frame, null = no face, else landmarks.
   * @returns {{ tracking: boolean, calibrating: boolean, progress: number }}
   */
  update(result, dt) {
    if (this.active && this.synthetic) {
      const f = this.synthetic;
      this.D.set(f.D);
      this.Qsyn.setFromEuler(_e.set(f.head.pitch, f.head.yaw, f.head.roll, 'YXZ'));
      this.#clampRotation(this.Qsyn);
      this.Q.copy(this.Qsyn);
      const ft = this.faceTarget;
      for (let i = 0; i < 2; i++) {
        ft.eyeOpen[i] = f.eyeOpen[i];
        ft.wide[i] = f.wide[i];
        ft.squint[i] = f.squint[i];
        ft.cheek[i] = f.cheek[i];
        ft.lidTilt[i] = f.lidTilt[i];
        ft.gaze[i][0] = f.gaze[i][0];
        ft.gaze[i][1] = f.gaze[i][1];
      }
      this.tracking = true;
      this.lostFor = 0;
      this.relaxed = false;
    } else if (this.active && result) {
      this.#toUser(result.landmarks, result.aspect);
      this.#basis(this.U, this.bU);
      this.#readBlendshapes(result.blendshapes ?? []);

      // Head rotation relative to the scan's rest orientation.
      _m.copy(this.bA.R).transpose().premultiply(this.bU.R);
      this.Q.setFromRotationMatrix(_m);
      this.#clampRotation(this.Q);

      // Pose-free landmarks expressed in the scan's rest frame.
      _m2.copy(this.bU.R).transpose().premultiply(this.bA.R);
      const k = this.bA.s / this.bU.s;
      const { U, N, D } = this;
      for (let i = 0; i < N_LM; i++) {
        _v.set(U[i * 3], U[i * 3 + 1], U[i * 3 + 2]).sub(this.bU.c).applyMatrix4(_m2).multiplyScalar(k).add(this.bA.c);
        if (!this.calibrated) {
          N[i * 3] += _v.x; N[i * 3 + 1] += _v.y; N[i * 3 + 2] += _v.z;
        } else {
          const g = LIP_SET.has(i) ? LIP_GAIN : GAIN;
          for (let c = 0; c < 3; c++) {
            const d = _v.getComponent(c) - N[i * 3 + c];
            // Soft dead zone: removes tracking jitter but keeps small deliberate motion.
            D[i * 3 + c] = Math.sign(d) * Math.max(0, Math.abs(d) - DEAD_ZONE) * g;
          }
        }
      }
      if (!this.calibrated) {
        D.fill(0);
        if (++this.calibN >= CALIB_FRAMES) {
          for (let i = 0; i < N.length; i++) N[i] /= this.calibN;
          this.blinkBase = this.blinkAcc.map((a) => Math.min(0.5, a / this.calibN));
          this.gazeBase = this.gazeAcc.map((a) => a / this.calibN);
          this.calibrated = true;
        }
      }
      this.tracking = true;
      this.lostFor = 0;
      this.relaxed = false;
    } else if (this.active && result === null) {
      this.lostFor += dt;
      if (this.lostFor > 0.5) {
        this.tracking = false;
        this.D.fill(0);
        this.Q.identity();
        this.faceTarget.gaze = [[0, 0], [0, 0]];
      }
    } else if (!this.active) {
      this.D.fill(0);
      this.Q.identity();
    }

    const status = { tracking: this.tracking, calibrating: this.active && !this.calibrated, progress: this.calibN / CALIB_FRAMES };
    if (this.relaxed) return status;

    // Temporal smoothing (frame-rate independent); eyes react faster so blinks read.
    const a = 1 - Math.exp(-dt * 30);
    const fa = 1 - Math.exp(-dt * 48);
    let residual = 0;
    for (let i = 0; i < this.Ds.length; i++) {
      this.Ds[i] += (this.D[i] - this.Ds[i]) * a;
      residual = Math.max(residual, Math.abs(this.D[i] - this.Ds[i]), this.active ? 0 : Math.abs(this.Ds[i]));
    }
    this.Qs.slerp(this.Q, a);
    _e.setFromQuaternion(this.Qs, 'YXZ');
    this.pose.yaw = _e.y * DEG;
    this.pose.pitch = _e.x * DEG;
    this.pose.roll = _e.z * DEG;

    const f = this.face;
    const ft = this.faceTarget;
    for (let i = 0; i < 2; i++) {
      const openT = this.active ? ft.eyeOpen[i] : 0;
      f.eyeOpen[i] += (openT - f.eyeOpen[i]) * fa;
      for (let j = 0; j < 2; j++) f.gaze[i][j] += ((this.active ? ft.gaze[i][j] : 0) - f.gaze[i][j]) * a;
      this.lidTilt[i] += ((this.active ? ft.lidTilt[i] : 0) - this.lidTilt[i]) * a;
      residual = Math.max(residual, Math.abs(openT - f.eyeOpen[i]), this.active ? 0 : f.eyeOpen[i]);
    }
    const Ds = this.Ds;
    // Mouth opening = the actual gap between the inner lips (13 above, 14 below), around their
    // own midpoint. It used to be measured against the mouth CORNERS, which read any frown (corners
    // down, centre level) as an opening: a sad face, or a user frowning at the webcam, showed teeth
    // through closed lips. The seam's centre now follows the lips too (see #apply).
    const lu = FEATURES[2][2] * 3, ll = FEATURES[2][3] * 3;
    // Soft lips stay in contact until they are really apart: below LIP_CONTACT_GAP there is no
    // opening, which otherwise rendered as a jagged hairline slit (grief's stretched mouth).
    const gap = Math.max(0, Ds[lu + 1] - Ds[ll + 1] - LIP_CONTACT_GAP);
    f.mouth.up = (gap / 2) * 0.9;
    f.mouth.down = (gap / 2) * 0.9;
    f.mouth.midY = (Ds[lu + 1] + Ds[ll + 1]) / 2;
    f.mouth.midZ = (Ds[lu + 2] + Ds[ll + 2]) / 2;
    f.jaw.dy = Ds[CHIN * 3 + 1];
    f.jaw.dz = Ds[CHIN * 3 + 2];

    if (!this.active && residual < 1e-4 && this.Qs.angleTo(IDENTITY) < 1e-3) {
      this.Ds.fill(0);
      this.Qs.identity();
      f.eyeOpen = [0, 0];
      f.lid = [0, 0];
      f.gaze = [[0, 0], [0, 0]];
      f.mouth.up = f.mouth.down = f.mouth.midY = f.mouth.midZ = f.jaw.dy = f.jaw.dz = 0;
      this.#restore();
      this.relaxed = true;
      return status;
    }
    this.#apply();
    return status;
  }

  #readBlendshapes(list) {
    const bs = {};
    for (const c of list) bs[c.categoryName] = c.score;
    // Avatar eye 0 is the subject's right eye; in mirror mode it follows the user's left.
    const sides = this.mirror ? ['Left', 'Right'] : ['Right', 'Left'];
    const ft = this.faceTarget;
    let vert = 0;
    for (let i = 0; i < 2; i++) {
      const get = (name) => bs[name + sides[i]] ?? 0;
      const blink = get('eyeBlink');
      if (!this.calibrated) this.blinkAcc[i] += blink;
      const base = this.blinkBase[i];
      // Sensitive enough that a half-closed eye or a wink shows; full close well below 1.0.
      ft.eyeOpen[i] = clamp01(1 - Math.max(0, blink - base) / Math.max(0.2, 0.55 - base));
      ft.wide[i] = get('eyeWide');
      ft.squint[i] = get('eyeSquint');
      ft.cheek[i] = get('cheekSquint');
      ft.lidTilt[i] = lidTiltFromBrows(bs.browInnerUp ?? 0, get('browOuterUp'));
      vert += (get('eyeLookUp') - get('eyeLookDown')) / 2;
    }

    // Horizontal gaze from the iris centres (already mirrored into avatar space in U).
    const U = this.U;
    let horiz = 0;
    for (const [outer, inner, iris] of GAZE_EYES) {
      const mid = (U[outer * 3] + U[inner * 3]) / 2;
      const half = Math.abs(U[outer * 3] - U[inner * 3]) / 2 || 1;
      horiz += (U[iris * 3] - mid) / half / 2;
    }
    if (!this.calibrated) {
      this.gazeAcc[0] += horiz;
      this.gazeAcc[1] += vert;
      for (const g of ft.gaze) g[0] = g[1] = 0;
      return;
    }
    const dead = (v) => Math.sign(v) * Math.max(0, Math.abs(v) - GAZE_DEAD);
    const yaw = Math.max(-GAZE_YAW_MAX, Math.min(GAZE_YAW_MAX, dead(horiz - this.gazeBase[0]) * GAZE_YAW_GAIN));
    const pitch = -dead(vert - this.gazeBase[1]) * GAZE_PITCH;
    // Conjugate: identical rotation for both eyes, so they can't cross.
    for (const g of ft.gaze) { g[0] = yaw; g[1] = pitch; }
  }

  #toUser(lm, aspect) {
    const U = this.U;
    for (let i = 0; i < N_LM; i++) {
      const p = lm[this.mirror ? this.sym[i] : i];
      const x = (p.x - 0.5) * aspect;
      U[i * 3] = this.mirror ? -x : x;
      U[i * 3 + 1] = 0.5 - p.y;
      U[i * 3 + 2] = -p.z * aspect;
    }
  }

  // Rigid upper-face frame: centroid, rotation (right, up, forward) and a size measure.
  #basis(P, out = { c: new THREE.Vector3(), R: new THREE.Matrix4(), s: 1 }) {
    const at = (i, v) => v.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
    out.c.set(0, 0, 0);
    for (const i of this.stable) out.c.add(at(i, _v));
    out.c.divideScalar(this.stable.length);
    let s = 0;
    _r.set(0, 0, 0);
    for (const [a, b] of this.rightPairs) {
      at(b, _v).sub(at(a, _w));
      s += _v.length();
      _r.add(_v);
    }
    _u.set(0, 0, 0);
    for (const [a, b] of this.upPairs) {
      at(b, _v).sub(at(a, _w));
      s += _v.length();
      _u.add(_v);
    }
    _r.normalize();
    _u.addScaledVector(_r, -_u.dot(_r)).normalize();
    _f.crossVectors(_r, _u);
    out.R.makeBasis(_r, _u, _f);
    out.s = s;
    return out;
  }

  // Left/right landmark pairs from the scan's (near) symmetric anchors, used for mirroring.
  #symmetry() {
    const A = this.A;
    let xm = 0, n = 0;
    for (const i of MIDLINE) if (this.valid[i]) { xm += A[i * 3]; n++; }
    xm /= n || 1;
    const sym = new Uint16Array(N_LM);
    for (let i = 0; i < N_LM; i++) {
      sym[i] = i;
      if (!this.valid[i]) continue;
      const mx = 2 * xm - A[i * 3], my = A[i * 3 + 1], mz = A[i * 3 + 2];
      let best = Infinity;
      for (let j = 0; j < N_LM; j++) {
        if (!this.valid[j]) continue;
        const d = (A[j * 3] - mx) ** 2 + (A[j * 3 + 1] - my) ** 2 + (A[j * 3 + 2] - mz) ** 2;
        if (d < best) { best = d; sym[i] = j; }
      }
    }
    return sym;
  }

  // Position along a feature's corner-to-corner chord and its (bowed) seam at that point.
  #seam(g, x, y) {
    const dx = g.B.x - g.A.x, dy = g.B.y - g.A.y;
    const t = ((x - g.A.x) * dx + (y - g.A.y) * dy) / (dx * dx + dy * dy);
    const s = 2 * t - 1;
    const bow = Math.max(0, 1 - s * s);
    return {
      s,
      y: g.A.y + dy * t + g.bowY * bow,
      z: g.A.z + (g.B.z - g.A.z) * t + g.bowZ * bow,
    };
  }

  #bind(array, count, onUpdate, expr, withActivation = false) {
    const rest = new Float32Array(array.subarray(0, count * 3));
    const idx = new Uint16Array(count * K);
    const wts = new Float32Array(count * K);
    const bins = new Uint8Array(count);
    const lidEye = new Int8Array(count).fill(-1);
    const lidW = new Float32Array(count);
    const lidS = new Float32Array(count); // position along the lid: -1 outer corner .. +1 inner
    const cands = [];
    for (let i = 0; i < N_DRIVE; i++) if (this.valid[i] && !LID_LANDMARKS.has(i)) cands.push(i);

    const m = this.featureGeo[2];
    const lip = {
      cx: (m.A.x + m.B.x) / 2,
      half: (Math.abs(m.A.x - m.B.x) / 2) * 1.35,
      lineY: (this.A[FEATURES[2][2] * 3 + 1] + this.A[FEATURES[2][3] * 3 + 1]) / 2,
      z0: Math.min(m.A.z, m.B.z) - 0.6,
      // The corners are shared by both lips, so they are never excluded. They sit in UPPER_LIP,
      // and excluding them from the lower lip's skin made the lower lip lag at the corners: a
      // smile lifted the corners of the upper lip only, the lip line stayed flat, and a face
      // analyser saw no smile at all.
      upper: new Set(UPPER_LIP.filter((i) => !CORNERS.has(i))),
      lower: new Set(LOWER_LIP.filter((i) => !CORNERS.has(i))),
    };
    const A = this.A;
    const bd = new Float64Array(K);
    const bi = new Int32Array(K);
    const tmp = new Float64Array(K);
    const inv2s2 = 1 / (2 * SIGMA * SIGMA);

    for (let v = 0; v < count; v++) {
      const x = rest[v * 3], y = rest[v * 3 + 1], z = rest[v * 3 + 2];
      let exclude = null;
      if (Math.abs(x - lip.cx) < lip.half && Math.abs(y - lip.lineY) < lip.half * 0.9 && z > lip.z0) {
        exclude = y >= lip.lineY ? lip.lower : lip.upper;
      }
      bd.fill(Infinity);
      bi.fill(-1);
      for (const a of cands) {
        if (exclude && exclude.has(a)) continue;
        const d2 = (A[a * 3] - x) ** 2 + (A[a * 3 + 1] - y) ** 2 + (A[a * 3 + 2] - z) ** 2;
        if (d2 >= bd[K - 1]) continue;
        let j = K - 1;
        while (j > 0 && bd[j - 1] > d2) { bd[j] = bd[j - 1]; bi[j] = bi[j - 1]; j--; }
        bd[j] = d2;
        bi[j] = a;
      }
      const dmin = Math.sqrt(bd[0]);
      const fall = dmin <= REACH ? 1 : Math.exp(-((dmin - REACH) ** 2) / (2 * FALLOFF * FALLOFF));
      let sum = 0;
      for (let k = 0; k < K; k++) {
        tmp[k] = bi[k] < 0 ? 0 : Math.exp(-bd[k] * inv2s2);
        sum += tmp[k];
      }
      for (let k = 0; k < K; k++) {
        idx[v * K + k] = Math.max(0, bi[k]);
        wts[v * K + k] = sum > 0 ? (tmp[k] / sum) * fall : 0;
      }
      bins[v] = Math.round(smooth(NECK_LOW, NECK_HIGH, y) * (BINS - 1));

      // Eyelid membership: upper lid (positive weight) retracts, lower lid (negative) drops.
      for (let e = 0; e < 2; e++) {
        const seam = this.#seam(this.featureGeo[e], x, y);
        if (Math.abs(seam.s) >= 1 || Math.abs(z - seam.z) > 0.3) continue;
        const dy = y - seam.y;
        if (dy > 0.35 || dy < -0.25) continue;
        const lens = Math.sqrt(1 - seam.s * seam.s);
        lidEye[v] = e;
        lidS[v] = seam.s;
        // Almond profile (see FEATURE_CUT_GLSL in head.js): upper lid peaks toward the nose,
        // lower lid dips toward the ear.
        lidW[v] = dy >= -0.003
          ? Math.exp(-((Math.max(dy, 0) / 0.11) ** 2)) * lens * (1 + LID_SKEW_UP * seam.s)
          : -Math.exp(-((dy / 0.07) ** 2)) * lens * (1 - LID_SKEW_DOWN * seam.s);
        break;
      }
    }
    return { array, rest, expr, idx, wts, bins, lidEye, lidW, lidS, act: withActivation ? new Float32Array(count) : null, count, onUpdate };
  }

  #apply() {
    for (let b = 0; b < BINS; b++) {
      _q.identity().slerp(this.Qs, b / (BINS - 1));
      this.mats[b]
        .makeTranslation(PIVOT.x, PIVOT.y, PIVOT.z)
        .multiply(_m.makeRotationFromQuaternion(_q))
        .multiply(_t.makeTranslation(-PIVOT.x, -PIVOT.y, -PIVOT.z));
    }
    const up = [0, 0];
    const dn = [0, 0];
    const tilt = this.lidTilt;
    for (let e = 0; e < 2; e++) {
      const o = this.face.eyeOpen[e];
      const ft = this.faceTarget;
      // Lower-lid tension: AU7 directly, AU6 through the orbital ring.
      const sq = Math.max(ft.squint[e], 0.6 * ft.cheek[e]);
      const follow = Math.min(1.2, Math.max(0.55, 1 - LID_FOLLOW * this.face.gaze[e][1]));
      up[e] = EYE_LIFT * o * follow * (1 + 0.25 * ft.wide[e]) * (1 - 0.35 * ft.squint[e]);
      this.face.lid[e] = up[e] / EYE_LIFT;
      dn[e] = EYE_DROP * o * (1 - 0.8 * sq) - SQUINT_RAISE * sq * o;
    }

    const Ds = this.Ds;
    for (const T of this.targets) {
      const { array, rest, expr, idx, wts, bins, lidEye, lidW, lidS, act, count } = T;
      for (let v = 0; v < count; v++) {
        let ox = 0, oy = 0, oz = 0;
        const o = v * K;
        for (let k = 0; k < K; k++) {
          const w = wts[o + k];
          if (w === 0) continue;
          const a = idx[o + k] * 3;
          ox += w * Ds[a];
          oy += w * Ds[a + 1];
          oz += w * Ds[a + 2];
        }
        if (act) act[v] = Math.sqrt(ox * ox + oy * oy + oz * oz);
        const x = rest[v * 3] + ox;
        let y = rest[v * 3 + 1] + oy;
        let z = rest[v * 3 + 2] + oz;
        const le = lidEye[v];
        if (le >= 0) {
          const w = lidW[v];
          if (w > 0) {
            // Oblique lid (tilt > 0): the OUTER part droops and the inner end rises only a little.
            // Raising the inner end fully opened the lid past the eyeball: a black socket showed.
            const sv = lidS[v];
            const lift = up[le] * Math.max(0, 1 + tilt[le] * (sv < 0 ? sv : 0.25 * sv));
            y += lift * w;
            z -= lift * w * 0.3;
          } else {
            y += dn[le] * w;
          }
        }
        if (expr) {
          expr[v * 3] = x;
          expr[v * 3 + 1] = y;
          expr[v * 3 + 2] = z;
        }
        const e = this.mats[bins[v]].elements;
        array[v * 3] = e[0] * x + e[4] * y + e[8] * z + e[12];
        array[v * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
        array[v * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
      }
      T.onUpdate();
    }

    if (this.features) {
      const F = this.features;
      this.featureGeo.forEach((g, i) => {
        F.uFOff.value[i].set(
          (Ds[g.a * 3] + Ds[g.b * 3]) / 2,
          (Ds[g.a * 3 + 1] + Ds[g.b * 3 + 1]) / 2,
          (Ds[g.a * 3 + 2] + Ds[g.b * 3 + 2]) / 2,
        );
        const bow = F.uFBow.value[i];
        if (i < 2) {
          bow.z = up[i] * 0.94;
          bow.w = dn[i] * 0.9;
          if (F.uFShape) F.uFShape.value[i].set(tilt[i], 0);
        } else {
          // The seam bows between the corners; shift its middle by how far the lip centre moved
          // relative to the corners, so it stays ON the lips when the corners turn down or up.
          const off = F.uFOff.value[i];
          bow.x = g.bowY + (this.face.mouth.midY - off.y);
          bow.y = g.bowZ + (this.face.mouth.midZ - off.z);
          bow.z = this.face.mouth.up;
          bow.w = this.face.mouth.down;
        }
      });
    }
  }

  #restore() {
    for (const T of this.targets) {
      T.array.set(T.rest);
      if (T.expr) T.expr.set(T.rest);
      T.onUpdate();
    }
    this.activation.fill(0);
    this.lidTilt = [0, 0];
    if (this.features) {
      for (let i = 0; i < FEATURES.length; i++) {
        this.features.uFShape?.value[i].set(0, 0);
        this.features.uFOff.value[i].set(0, 0, 0);
        this.features.uFBow.value[i].set(this.featureGeo[i].bowY, this.featureGeo[i].bowZ, 0, 0);
      }
    }
    for (const m of this.mats) m.identity();
  }

  #clampRotation(q) {
    _e.setFromQuaternion(q, 'YXZ');
    const c = (v, lim) => Math.max(-lim / DEG, Math.min(lim / DEG, v));
    _e.set(c(_e.x, LIMIT.pitch), c(_e.y, LIMIT.yaw), c(_e.z, LIMIT.roll), 'YXZ');
    q.setFromEuler(_e);
  }
}
