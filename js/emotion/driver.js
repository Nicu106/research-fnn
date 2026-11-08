/*
 * Turns an expression frame (blendshape weights, head pose, gaze) into what AvatarRig.drive()
 * consumes: a landmark displacement field plus the procedural eye controls.
 */

import { compose } from './faceBasis.js';
import { lidTiltFromBrows } from '../live/avatarRig.js';

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/**
 * Eyelid opening from the blink weight. Not linear: a heavy-lidded look (blink ~0.35) should
 * still show most of the iris, and only the last part of the range actually closes the eye.
 */
export const openFromBlink = (b) => clamp01(1 - clamp01(b) ** 1.3);

export function makeRigFrame() {
  return {
    D: new Float32Array(478 * 3),
    head: { pitch: 0, yaw: 0, roll: 0 },
    eyeOpen: [1, 1], wide: [0, 0], squint: [0, 0], cheek: [0, 0], lidTilt: [0, 0],
    gaze: [[0, 0], [0, 0]],
  };
}

/**
 * @param basis   faceBasis.buildBasis() result
 * @param f       { w, head (radians), gaze [yaw, pitch] }
 * @param out     makeRigFrame() result, filled in place
 */
export function toRigFrame(basis, f, out) {
  compose(basis, f.w, out.D);
  out.head.pitch = f.head.pitch;
  out.head.yaw = f.head.yaw;
  out.head.roll = f.head.roll;
  const sides = ['Right', 'Left']; // rig eye 0 = subject's right
  for (let e = 0; e < 2; e++) {
    const g = (n) => f.w[n + sides[e]] ?? 0;
    out.eyeOpen[e] = openFromBlink(g('eyeBlink'));
    out.wide[e] = g('eyeWide');
    out.squint[e] = g('eyeSquint');
    out.cheek[e] = g('cheekSquint');
    out.lidTilt[e] = lidTiltFromBrows(f.w.browInnerUp ?? 0, g('browOuterUp'));
    // Both eyes share one gaze (conjugate), as in the webcam path, so they can never cross.
    out.gaze[e][0] = f.gaze[0];
    out.gaze[e][1] = f.gaze[1];
  }
  return out;
}

/**
 * Gaze from MediaPipe's eye-look blendshapes (a photo): [yaw, pitch] radians, rig conventions.
 * Horizontal: looking toward the subject's own left means the left eye looks out and the right
 * eye looks in.
 */
export function gazeFromLook(w) {
  const g = (n) => w[n] ?? 0;
  const h = ((g('eyeLookOutLeft') - g('eyeLookInLeft')) + (g('eyeLookInRight') - g('eyeLookOutRight'))) / 2;
  const v = ((g('eyeLookDownLeft') + g('eyeLookDownRight')) - (g('eyeLookUpLeft') + g('eyeLookUpRight'))) / 2;
  return [Math.max(-0.45, Math.min(0.45, h * 0.9)), Math.max(-0.35, Math.min(0.35, v * 0.4))];
}
