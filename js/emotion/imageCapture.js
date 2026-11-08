/*
 * Capture a facial expression from a still image.
 *
 * MediaPipe Face Landmarker (IMAGE mode, same model as the webcam path, runs locally — the image
 * never leaves the browser) gives 478 landmarks, 52 blendshape scores and the head's transform.
 * Only the blendshapes, gaze and head pose are kept: they describe the expression, not the
 * person, so the capture can be applied to the scanned head without reshaping it into someone
 * else's face.
 */

import * as THREE from 'three';
import { BUNDLE, WASM, MODEL } from '../live/faceTracker.js';
import { gazeFromLook } from './driver.js';

/*
 * MediaPipe's raw scores need two corrections before they mean the same thing as the authored
 * shapes:
 *   BIAS  — what the model reports on a relaxed, neutral face. Without subtracting it every
 *           capture looks slightly tense (eyeSquint and the mouth shrugs are never zero).
 *   GAIN  — channels the model is known to under-report. mouthFrown in particular stays low even
 *           on clearly downturned mouths.
 * These are generic estimates of what the model reports on relaxed faces. They cannot be exact:
 * the baseline depends on the person (a resting face with heavy lids reads as "squint"), the
 * camera and the light. For accurate captures of one person, set a NEUTRAL REFERENCE photo of
 * that person (correctWeights' second argument): each channel is then measured from their own
 * resting value instead, the way the webcam path calibrates on the user's neutral face.
 * Round trips through a render of this head (tools/roundtrip.js) confirmed the side and angle
 * conventions below, but render-specific baselines (e.g. mouthPucker ~0.25 on this scan's lips)
 * were deliberately NOT folded in: they describe the render, not faces in photos.
 */
const BIAS = {
  eyeSquintLeft: 0.18, eyeSquintRight: 0.18, browDownLeft: 0.06, browDownRight: 0.06,
  mouthShrugUpper: 0.1, mouthShrugLower: 0.1, mouthPressLeft: 0.06, mouthPressRight: 0.06,
  mouthRollLower: 0.04, mouthRollUpper: 0.03, mouthClose: 0.02, eyeBlinkLeft: 0.06, eyeBlinkRight: 0.06,
  cheekSquintLeft: 0.02, cheekSquintRight: 0.02, mouthPucker: 0.04, mouthDimpleLeft: 0.02, mouthDimpleRight: 0.02,
};
const GAIN = {
  mouthFrownLeft: 1.8, mouthFrownRight: 1.8, browInnerUp: 1.15, mouthShrugLower: 1.1,
};
// Sign conventions of MediaPipe relative to the rig, verified by round trip (render -> capture):
// closing the subject's left eye raised eyeBlinkLeft (0.48 vs 0.22), so "Left" is the subject's
// own left; a known +15 / +12 / +10 degree yaw / pitch / roll read back as +17 / +13 / +10.
export const CONVENTION = { SIDE_SWAP: false, YAW: 1, PITCH: 1, ROLL: 1 };

const swapSide = (n) => (n.endsWith('Left') ? n.slice(0, -4) + 'Right' : n.endsWith('Right') ? n.slice(0, -5) + 'Left' : n);

export class ImageAnalyzer {
  constructor() {
    this.mp = null;
    this.landmarker = null;
    this.loading = null;
  }

  async load() {
    if (this.landmarker) return;
    if (!this.loading) {
      this.loading = (async () => {
        this.mp = await import(BUNDLE);
        const fileset = await this.mp.FilesetResolver.forVisionTasks(WASM);
        const opts = (delegate) => ({
          baseOptions: { modelAssetPath: MODEL, delegate },
          runningMode: 'IMAGE',
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
          minFaceDetectionConfidence: 0.3,
          minFacePresenceConfidence: 0.3,
        });
        try {
          this.landmarker = await this.mp.FaceLandmarker.createFromOptions(fileset, opts('GPU'));
        } catch {
          this.landmarker = await this.mp.FaceLandmarker.createFromOptions(fileset, opts('CPU'));
        }
      })();
    }
    await this.loading;
  }

  /**
   * @param {HTMLImageElement|HTMLCanvasElement|ImageBitmap} image
   * @returns null when no face is found, else { raw, landmarks, matrix, width, height }
   */
  async analyze(image) {
    await this.load();
    const r = this.landmarker.detect(image);
    if (!r.faceLandmarks?.length) return null;
    const raw = {};
    for (const c of r.faceBlendshapes?.[0]?.categories ?? []) raw[c.categoryName] = c.score;
    return {
      raw,
      landmarks: r.faceLandmarks[0],
      matrix: r.facialTransformationMatrixes?.[0]?.data ?? null,
      width: image.width ?? image.naturalWidth,
      height: image.height ?? image.naturalHeight,
    };
  }

  /** Face-mesh contour connections, for drawing the overlay. */
  get contours() {
    return this.mp?.FaceLandmarker?.FACE_LANDMARKS_CONTOURS ?? [];
  }
}

/**
 * Correct raw scores into weights for the expression basis.
 * @param {Record<string, number>} raw MediaPipe scores
 * @param {Record<string, number>} [neutral] raw scores of the same person's neutral face; when
 *        given, it replaces the generic BIAS channel by channel
 */
export function correctWeights(raw, neutral = null) {
  const w = {};
  for (const [name, v0] of Object.entries(raw)) {
    if (name === '_neutral') continue;
    const n = CONVENTION.SIDE_SWAP ? swapSide(name) : name;
    // Gaze is where someone looks, not an expression: never subtract a baseline from it.
    const b = /^eyeLook/.test(n) ? 0 : Math.min(0.9, neutral ? (neutral[name] ?? 0) : (BIAS[n] ?? 0));
    let v = Math.max(0, (v0 - b) / (1 - b));
    v *= GAIN[n] ?? 1;
    w[n] = Math.min(1, v);
  }
  return w;
}

/** Head pose in degrees (rig conventions) from MediaPipe's facial transformation matrix. */
export function headFromMatrix(data) {
  if (!data) return { pitch: 0, yaw: 0, roll: 0 };
  const m = new THREE.Matrix4().fromArray(data);
  const e = new THREE.Euler().setFromRotationMatrix(m, 'YXZ');
  const d = 180 / Math.PI;
  const lim = (v, l) => Math.max(-l, Math.min(l, v));
  return {
    pitch: lim(e.x * d * CONVENTION.PITCH, 35),
    yaw: lim(e.y * d * CONVENTION.YAW, 50),
    roll: lim(e.z * d * CONVENTION.ROLL, 35),
  };
}

/** Everything the app stores for a captured expression. */
export function toExpression(result, neutral = null) {
  const w = correctWeights(result.raw, neutral?.raw ?? null);
  return {
    w,
    head: headFromMatrix(result.matrix),
    gaze: gazeFromLook(w),
    raw: Object.fromEntries(Object.entries(result.raw).map(([k, v]) => [k, Math.round(v * 1e4) / 1e4])),
  };
}

/**
 * Draw the image with the detected face mesh on top, fitted into `canvas`.
 * @returns the rectangle the image was drawn into
 */
export function drawOverlay(canvas, image, result, contours) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const iw = image.naturalWidth ?? image.width, ih = image.naturalHeight ?? image.height;
  const k = Math.min(W / iw, H / ih);
  const dw = iw * k, dh = ih * k, dx = (W - dw) / 2, dy = (H - dh) / 2;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#02070b';
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(image, dx, dy, dw, dh);
  if (!result) return { dx, dy, dw, dh };
  const lm = result.landmarks;
  const P = (i) => [dx + lm[i].x * dw, dy + lm[i].y * dh];
  ctx.fillStyle = 'rgba(2, 7, 11, 0.35)';
  ctx.fillRect(dx, dy, dw, dh);
  ctx.lineWidth = Math.max(1, W / 420);
  ctx.strokeStyle = 'rgba(159, 243, 255, 0.85)';
  ctx.shadowColor = 'rgba(159, 243, 255, 0.8)';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  for (const { start, end } of contours) {
    const [x0, y0] = P(start), [x1, y1] = P(end);
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(159, 243, 255, 0.55)';
  const r = Math.max(0.6, W / 900);
  for (let i = 0; i < 468; i += 2) {
    const [x, y] = P(i);
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return { dx, dy, dw, dh };
}

/** A square JPEG thumbnail (data URL) around the detected face. */
export function faceThumbnail(image, result, size = 112) {
  const iw = image.naturalWidth ?? image.width, ih = image.naturalHeight ?? image.height;
  let x0 = 0, y0 = 0, x1 = iw, y1 = ih;
  if (result) {
    x0 = Infinity; y0 = Infinity; x1 = -Infinity; y1 = -Infinity;
    for (const p of result.landmarks) {
      x0 = Math.min(x0, p.x * iw); x1 = Math.max(x1, p.x * iw);
      y0 = Math.min(y0, p.y * ih); y1 = Math.max(y1, p.y * ih);
    }
  }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const side = Math.max(x1 - x0, y1 - y0) * 1.35;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  c.getContext('2d').drawImage(image, cx - side / 2, cy - side / 2, side, side, 0, 0, size, size);
  return c.toDataURL('image/jpeg', 0.82);
}
