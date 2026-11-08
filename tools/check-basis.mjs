// Sanity checks for the expression basis: coverage, left/right symmetry, locality, magnitudes.
// Run: node tools/check-basis.mjs
import { readFileSync } from 'node:fs';
import { buildBasis, compose } from '../js/emotion/faceBasis.js';
import { BLENDSHAPES, MIRROR_PAIRS } from '../js/live/landmarkSets.js';

const anchors = JSON.parse(readFileSync(new URL('../assets/head/anchors.json', import.meta.url))).positions;
const N = 478;
const ok = (i) => anchors[i * 3] !== null;
const at = (i) => [anchors[i * 3], anchors[i * 3 + 1], anchors[i * 3 + 2]];

const B = buildBasis({ anchors });
const mm = 1 / B.unitsPerMM;
let fails = 0;
const check = (cond, msg) => { console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fails++; };

console.log(`blendshapes listed: ${BLENDSHAPES.length}, authored: ${B.names.length}, 1 mm = ${B.unitsPerMM.toFixed(5)} units`);
check(BLENDSHAPES.length === 52 && B.names.length === 52, 'all 52 MediaPipe categories authored');

const maxMM = (f, ids = [...Array(N).keys()]) => Math.max(0, ...ids.filter(ok).map((i) => Math.hypot(f[i*3], f[i*3+1], f[i*3+2]) * mm));
console.log('\nmax displacement per shape (mm):');
const rows = B.names.filter((n) => maxMM(B.fields[n]) > 0).map((n) => `${n}=${maxMM(B.fields[n]).toFixed(1)}`);
for (let k = 0; k < rows.length; k += 5) console.log('   ' + rows.slice(k, k + 5).join('  '));

// Symmetry over anatomical counterparts: a Left shape at a left landmark must equal the Right
// shape at the matching right landmark, with X flipped. (Pairing by position instead fails on
// this scan, whose mouth sits ~2 mm off the midline.)
console.log('\nsymmetry (Left shape vs mirrored Right shape, anatomical pairs):');
for (const name of B.names.filter((n) => n.endsWith('Left'))) {
  const R = B.fields[name.replace(/Left$/, 'Right')], L = B.fields[name];
  let err = 0, mag = 0;
  for (const [r, l] of MIRROR_PAIRS) {
    if (!ok(r) || !ok(l)) continue;
    err = Math.max(err, Math.hypot(L[l*3] + R[r*3], L[l*3+1] - R[r*3+1], L[l*3+2] - R[r*3+2]) * mm);
    mag = Math.max(mag, Math.hypot(L[l*3], L[l*3+1], L[l*3+2]) * mm);
  }
  // The jaw line is the edge of the landmark cloud: its normals are fitted from one side only and
  // the scan itself is ~2 mm asymmetric there, so sideways jaw motion gets a looser bound.
  const tol = name.startsWith('jaw') ? 0.25 : 0.2;
  if (mag > 0.05) check(err < Math.max(0.6, mag * tol), `${name.padEnd(20)} max mirror error ${err.toFixed(2)} mm of ${mag.toFixed(1)}`);
}

// Locality: regions a shape must NOT move.
const byY = (lo, hi) => [...Array(N).keys()].filter((i) => ok(i) && (anchors[i*3+1]-anchors[168*3+1])*mm >= lo && (anchors[i*3+1]-anchors[168*3+1])*mm <= hi);
const mouthRegion = byY(-120, -40), browRegion = byY(8, 70);
console.log('\nlocality:');
for (const n of ['browInnerUp', 'browDownLeft', 'browOuterUpRight'])
  check(maxMM(B.fields[n], mouthRegion) < 0.3, `${n} leaves the mouth alone (${maxMM(B.fields[n], mouthRegion).toFixed(2)} mm)`);
for (const n of ['mouthFrownLeft', 'mouthSmileRight', 'mouthShrugLower', 'jawOpen', 'mouthPressLeft'])
  check(maxMM(B.fields[n], browRegion) < 0.3, `${n} leaves the brows alone (${maxMM(B.fields[n], browRegion).toFixed(2)} mm)`);

// A frown must bend the corners, not the middle of the lips.
const dy = (f, i) => f[i*3+1] * mm;
const fr = compose(B, { mouthFrownLeft: 1, mouthFrownRight: 1 }, new Float32Array(N*3));
check(dy(fr, 61) < -3.5 && dy(fr, 291) < -3.5, `frown lowers both corners (${dy(fr,61).toFixed(1)}, ${dy(fr,291).toFixed(1)} mm)`);
check(Math.abs(dy(fr, 0)) < 1.0 && Math.abs(dy(fr, 17)) < 1.2, `frown keeps lip centres level (upper ${dy(fr,0).toFixed(2)}, lower ${dy(fr,17).toFixed(2)} mm)`);
const au1 = B.fields.browInnerUp;
check(dy(au1, 107) > 6 && dy(au1, 70) < 1.0, `AU1 lifts the inner brow (${dy(au1,107).toFixed(1)}) not the tail (${dy(au1,70).toFixed(2)} mm)`);

// Lips must never cross: upper lip landmarks stay above their lower partners in a strong mix.
const mix = compose(B, { mouthShrugLower: 1, mouthFrownLeft: 1, mouthFrownRight: 1, mouthPressLeft: 1, mouthPressRight: 1, mouthRollLower: 0.5 }, new Float32Array(N*3));
const pairs = [[13, 14], [82, 87], [312, 317], [81, 178], [311, 402], [0, 17]];
const gaps = pairs.map(([u, l]) => ((anchors[u*3+1] + mix[u*3+1]) - (anchors[l*3+1] + mix[l*3+1])) * mm);
check(gaps.every((g) => g > -0.5), `sad mouth keeps upper lip above lower (${gaps.map((g)=>g.toFixed(1)).join(', ')} mm)`);

// The jaw must actually part the lips (inner 13/14), not only drop the chin: a jaw share that
// skipped the lip landmarks once left every mouth shut, in speech and in surprise.
const lipGap = (j) => { const D = compose(B, { jawOpen: j }, new Float32Array(N*3)); return (D[13*3+1] - D[14*3+1]) * mm; };
check(lipGap(0.3) > 5 && lipGap(1) > 18, `jawOpen parts the inner lips (0.3 → ${lipGap(0.3).toFixed(1)} mm, 1 → ${lipGap(1).toFixed(1)} mm)`);

console.log(fails ? `\n${fails} FAILED` : '\nall checks passed');
process.exit(fails ? 1 : 0);
