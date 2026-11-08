/*
 * Where each mimic muscle lies: an atlas of the facial muscles, built on the face's landmarks.
 *
 * Every muscle is a sheet of fibres running from its ORIGIN (on bone or fascia; it does not move)
 * to its INSERTION (in the skin or the modiolus; it moves with the skin). Bound to the rig like the
 * skin, the insertion end follows the face, so a contracting muscle visibly shortens toward its
 * origin. Ring muscles (orbicularis oris and oculi) have circular fibres around the mouth / eye.
 *
 * Points: [landmark, lateral mm, up mm, forward mm], subject's RIGHT side; the left side is the
 * mirror image. Lateral > 0 = away from the midline. A sheet is snapped onto the skin surface
 * (fitted from the nearby landmarks) and then sunk to the muscle's depth. `free` muscles are deep
 * (jaw) and are placed by their offsets alone.
 *
 * Placement follows the standard descriptions of facial anatomy (origin, insertion, fibre
 * direction, layer); millimetre positions are estimates on this scan, which has no MRI.
 */

export const ANATOMY = {
  // ---- forehead and brows ----
  frontalisMed: { short: 'Frontal medial', kind: 'sheet', depth: 2.5, fibres: 9,
    origin: [[10, 1, 0], [109, 8, 0]], insertion: [[107, -8, 4], [66, 0, 4]] },
  frontalisLat: { short: 'Frontal lateral', kind: 'sheet', depth: 2.5, fibres: 9,
    origin: [[109, 4, 0], [67, 10, 0]], insertion: [[66, -4, 4], [63, 0, 4]] },
  corrugator: { short: 'Corugator', kind: 'sheet', depth: 6, fibres: 6,
    origin: [[193, 2, 8], [55, -5, 0]], insertion: [[66, -2, -2], [66, 4, -3]] },
  procerus: { short: 'Procer', kind: 'sheet', depth: 2.5, fibres: 5,
    origin: [[197, 1, 0], [197, 6, 0]], insertion: [[168, 1, 10], [168, 6, 12]] },

  // ---- eyes ----
  orbOculiOrb: { short: 'Orbicular ochi (orbitar)', kind: 'ring', depth: 3, fibres: 7,
    center: [[33], [133]], inner: [17, 10], outer: [28, 21], arc: [0, 360] },
  orbOculiPalp: { short: 'Orbicular ochi (palpebral)', kind: 'ring', depth: 1.5, fibres: 5,
    center: [[33], [133]], inner: [15, 6.5], outer: [18, 11], arc: [0, 360] },
  levPalp: { short: 'Ridicător pleoapă', kind: 'sheet', depth: 9, fibres: 5,
    origin: [[159, 0, 16]], insertion: [[159, -5, 5], [159, 5, 5]] },

  // ---- nose and upper lip ----
  levLabAlae: { short: 'Ridicător buză + nas', kind: 'sheet', depth: 3, fibres: 6,
    origin: [[133, -6, 2], [133, -3, 6]], insertion: [[98, 2, -1], [40, -4, 6]] },
  levLab: { short: 'Ridicător buză sup.', kind: 'sheet', depth: 5, fibres: 7,
    origin: [[119, -6, 1], [118, -4, 1]], insertion: [[39, 0, 4], [40, -2, 4]] },

  // ---- mouth corner (modiolus) ----
  zygMajor: { short: 'Zigomatic mare', kind: 'sheet', depth: 5, fibres: 7,
    origin: [[116, 0, 4], [116, -2, -6]], insertion: [[61, 1, 2], [61, 2, -2]] },
  risorius: { short: 'Risorius', kind: 'sheet', depth: 3, fibres: 6,
    origin: [[123, 8, -12], [123, 8, -22]], insertion: [[61, 2, 0], [61, 3, -1]] },
  buccinator: { short: 'Buccinator', kind: 'sheet', depth: 10, fibres: 9,
    origin: [[123, 0, -14], [123, -2, -30]], insertion: [[61, -2, 4], [61, -2, -4]] },
  depAnguli: { short: 'Coborâtor unghi gură', kind: 'sheet', depth: 3, fibres: 8,
    origin: [[150, 2, 2], [176, -2, 2]], insertion: [[61, 1, -3], [61, 2, -4]] },

  // ---- lips ----
  orbOrisSup: { short: 'Orbicular gură (sup.)', kind: 'ring', depth: 3, fibres: 7,
    center: [[61], [291]], inner: [22, 8], outer: [33, 18], arc: [0, 90], mouth: true },
  orbOrisInf: { short: 'Orbicular gură (inf.)', kind: 'ring', depth: 3, fibres: 7,
    center: [[61], [291]], inner: [22, 7], outer: [33, 17], arc: [-90, 0], mouth: true },
  depLabii: { short: 'Coborâtor buză inf.', kind: 'sheet', depth: 4, fibres: 6,
    origin: [[176, -2, 4], [148, -4, 4]], insertion: [[181, 0, -2], [84, 0, -2]] },

  // ---- chin and neck ----
  mentalis: { short: 'Mentonier', kind: 'sheet', depth: 4, fibres: 5,
    origin: [[18, 2, -4], [18, 7, -4]], insertion: [[175, 2, -2], [175, 8, -2]] },
  platysma: { short: 'Platisma', kind: 'sheet', depth: 2, fibres: 10,
    origin: [[150, 4, -28], [136, 4, -28]], insertion: [[176, 2, 4], [57, 4, -8]] },

  // ---- jaw (deep, trigeminal) ----
  jawOpener: { short: 'Digastric', kind: 'sheet', depth: 0, fibres: 4, free: true,
    origin: [[152, 5, 0, -10]], insertion: [[152, 14, -12, -32]] },
  pterygoidLat: { short: 'Pterigoidian lateral', kind: 'sheet', depth: 0, fibres: 5, free: true,
    origin: [[123, 6, 2, -32], [123, 6, -6, -32]], insertion: [[123, 18, 4, -58]] },
};
