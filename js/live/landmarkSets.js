/*
 * MediaPipe Face Mesh landmark groups shared by the live rig and the expression basis.
 * Indices follow the canonical 478-point topology (468 mesh + 10 iris).
 */

export const UPPER_LIP = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];
export const LOWER_LIP = [146, 91, 181, 84, 17, 314, 405, 321, 375, 95, 88, 178, 87, 14, 317, 402, 318, 324];
/** Mouth corners, outer and inner; they sit on the lip seam and belong to both lips. */
export const MOUTH_CORNERS = [61, 291, 78, 308];

// Eyelid landmarks. The scan's eyes are closed, so these are driven procedurally, never by weights.
export const LID_LANDMARKS = [
  246, 161, 160, 159, 158, 157, 173, 7, 163, 144, 145, 153, 154, 155,
  466, 388, 387, 386, 385, 384, 398, 249, 390, 373, 374, 380, 381, 382,
];

export const MIDLINE = [10, 151, 9, 8, 168, 6, 197, 195, 5, 4, 1, 19, 94, 2, 164, 0, 11, 12, 13, 14, 15, 16, 17, 18, 200, 199, 175, 152];

/** Per side: index 0 = subject's right (−X), index 1 = subject's left (+X). */
export const SIDES = {
  browUpper: [[107, 66, 105, 63, 70], [336, 296, 334, 293, 300]], // inner -> outer
  browLower: [[55, 65, 52, 53, 46], [285, 295, 282, 283, 276]],
  eye: [[33, 133, 159, 145], [263, 362, 386, 374]], // outer corner, inner corner, upper mid, lower mid
  mouthCorner: [61, 291],
  alar: [[64, 129], [294, 358]],
  cheek: [[50, 205], [280, 425]],
  malar: [116, 345],
};

/** The 52 MediaPipe blendshape categories (ARKit names), in MediaPipe's output order. */
export const BLENDSHAPES = [
  '_neutral', 'browDownLeft', 'browDownRight', 'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight',
  'cheekPuff', 'cheekSquintLeft', 'cheekSquintRight', 'eyeBlinkLeft', 'eyeBlinkRight',
  'eyeLookDownLeft', 'eyeLookDownRight', 'eyeLookInLeft', 'eyeLookInRight', 'eyeLookOutLeft',
  'eyeLookOutRight', 'eyeLookUpLeft', 'eyeLookUpRight', 'eyeSquintLeft', 'eyeSquintRight',
  'eyeWideLeft', 'eyeWideRight', 'jawForward', 'jawLeft', 'jawOpen', 'jawRight', 'mouthClose',
  'mouthDimpleLeft', 'mouthDimpleRight', 'mouthFrownLeft', 'mouthFrownRight', 'mouthFunnel',
  'mouthLeft', 'mouthLowerDownLeft', 'mouthLowerDownRight', 'mouthPressLeft', 'mouthPressRight',
  'mouthPucker', 'mouthRight', 'mouthRollLower', 'mouthRollUpper', 'mouthShrugLower',
  'mouthShrugUpper', 'mouthSmileLeft', 'mouthSmileRight', 'mouthStretchLeft', 'mouthStretchRight',
  'mouthUpperUpLeft', 'mouthUpperUpRight', 'noseSneerLeft', 'noseSneerRight',
];

/**
 * Upper/lower lip landmark pairs facing each other across the seam (inner edge, then outer
 * border). Used to keep closed lips in contact instead of letting one pass through the other.
 */
export const LIP_CONTACT = [
  [13, 14], [82, 87], [81, 178], [80, 88], [191, 95], [312, 317], [311, 402], [310, 318], [415, 324],
];

/** Anatomical left/right counterparts (subject's right index, subject's left index). */
export const MIRROR_PAIRS = [
  [61, 291], [78, 308], [107, 336], [105, 334], [70, 300], [55, 285], [46, 276], [66, 296], [52, 282],
  [33, 263], [133, 362], [159, 386], [145, 374], [64, 294], [129, 358], [98, 327], [48, 278],
  [205, 425], [50, 280], [116, 345], [117, 346], [118, 347], [119, 348], [111, 340], [123, 352],
  [187, 411], [206, 426], [216, 436], [92, 322], [57, 287], [43, 273], [106, 335], [182, 406],
  [83, 313], [146, 375], [91, 321], [181, 405], [84, 314], [40, 270], [39, 269], [37, 267],
  [185, 409], [136, 365], [150, 379], [149, 378], [176, 400], [148, 377], [221, 441], [223, 443], [225, 445],
];
