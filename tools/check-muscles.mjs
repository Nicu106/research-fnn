// Checks the muscle layer (js/muscle/muscles.js): coverage, identifiability, round trips on every
// preset and every FACS recipe, and whether the right muscles carry each emotion.
// Run: node tools/check-muscles.mjs   (add --json for machine-readable metrics)
import { BLENDSHAPES } from '../js/live/landmarkSets.js';
import { EMOTIONS } from '../js/emotion/emotions.js';
import { NODES } from '../js/taxonomy/data.js';
import { recipeToExpression } from '../js/taxonomy/facs.js';
import { UNITS, CHANNELS, MUSCLES, PASSTHROUGH, MUSCLE_SHAPES, musclesToWeights, weightsToMuscles, muscleActivity, activations, CH } from '../js/muscle/muscles.js';

const JSON_OUT = process.argv.includes('--json');
const log = (...a) => { if (!JSON_OUT) console.log(...a); };
let fails = 0;
const check = (c, m) => { log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fails++; };
const metrics = {};

// ---------------------------------------------------------------- structure
log(`muscles ${MUSCLES.length} × 2 · units ${UNITS.length} · channels ${CHANNELS.length} · shapes explained ${MUSCLE_SHAPES.length} · passthrough ${PASSTHROUGH.length}`);
const mkeys = new Set(MUSCLES.map((m) => m.key));
check(UNITS.every((u) => u.muscles.every((m) => mkeys.has(m))), 'every unit belongs to known muscles');
check(MUSCLES.every((m) => UNITS.some((u) => u.muscles.includes(m.key))), 'every muscle does something');
const uncovered = BLENDSHAPES.filter((n) => n !== '_neutral' && !MUSCLE_SHAPES.includes(n) && !PASSTHROUGH.includes(n));
check(uncovered.length === 0, `every blendshape is made by a muscle or passed through${uncovered.length ? ` (missing: ${uncovered})` : ''}`);

// ---------------------------------------------------------------- identifiability
// Each unit alone at 0.7: does the inverse give back that unit and nothing else?
log('\nidentifiability (one unit at 0.7 -> blendshapes -> muscles):');
let worstLeak = 0, worstLeakAt = '', worstSelf = 1, worstSelfAt = '';
// What ARKit cannot separate counts as one: a declared twin, and for units that only move
// bilateral shapes, the same unit on the other side.
const hidden = CHANNELS.filter((ch) => ch.unit.hidden).map((ch) => ch.key);
log(`  not observable from blendshapes (forward only): ${hidden.join(', ')}`);
for (const [c, ch] of CHANNELS.entries()) {
  if (ch.unit.hidden) continue;
  const a = new Float32Array(CHANNELS.length); a[c] = 0.7;
  const back = weightsToMuscles(musclesToWeights(a));
  const group = new Set([c]);
  if (ch.unit.twin) group.add(CH[ch.unit.twin + ch.side]);
  if (ch.unit.out.every(([s]) => !/[*~]$/.test(s))) group.add(CH[ch.unit.key + (ch.side === 'R' ? 'L' : 'R')]);
  // The group is judged by the movement it makes, in units of this one's (twins differ in
  // strength; a bilateral pair shares one shape).
  const gain = (j) => Math.abs(CHANNELS[j].unit.out[0][1]);
  let made = 0, leak = 0;
  back.forEach((v, j) => { if (group.has(j)) made += v * gain(j); else leak = Math.max(leak, v); });
  const self = made / gain(c);
  if (self < worstSelf) { worstSelf = self; worstSelfAt = ch.key; }
  if (leak > worstLeak) { worstLeak = leak; worstLeakAt = ch.key; }
}
check(worstSelf > 0.6, `every unit is recovered (worst ${worstSelf.toFixed(2)} of 0.70 at ${worstSelfAt}; twins and bilateral pairs counted together)`);
check(worstLeak < 0.08, `no unit leaks into another (worst ${worstLeak.toFixed(2)} from ${worstLeakAt})`);
metrics.identifiability = { worstSelf: +worstSelf.toFixed(3), worstLeak: +worstLeak.toFixed(3) };

// ---------------------------------------------------------------- round trips
// w -> muscles -> w'. The error is what an expression loses by being made of muscles: either the
// preset asks for something anatomy cannot do, or the layer is missing a muscle.
function roundTrip(w) {
  const wm = Object.fromEntries(Object.entries(w).filter(([n]) => !PASSTHROUGH.includes(n)));
  const back = musclesToWeights(weightsToMuscles(wm));
  let se = 0, max = 0, at = '', n = 0;
  for (const s of MUSCLE_SHAPES) {
    const e = Math.abs((wm[s] ?? 0) - (back[s] ?? 0));
    se += e * e; n++;
    if (e > max) { max = e; at = s; }
  }
  return { rmse: Math.sqrt(se / n), max, at };
}

log('\nround trip on the studio presets (w -> muscles -> w):');
let worstPreset = 0;
const presets = {};
for (const [k, e] of Object.entries(EMOTIONS)) {
  const r = roundTrip(e.w);
  presets[k] = { rmse: +r.rmse.toFixed(4), max: +r.max.toFixed(3), at: r.at };
  worstPreset = Math.max(worstPreset, r.max);
  log(`  ${k.padEnd(11)} rmse ${r.rmse.toFixed(4)}  max ${r.max.toFixed(3)}${r.max > 0.01 ? ` (${r.at})` : ''}`);
}
check(worstPreset < 0.05, `every preset is reproduced by muscles within 0.05 (worst ${worstPreset.toFixed(3)})`);
metrics.presets = presets;

const recipes = NODES.filter((n) => n.facs);
let worstRecipe = 0, worstRecipeAt = '', sumR = 0;
for (const n of recipes) {
  const r = roundTrip(recipeToExpression(n.facs).w);
  sumR += r.rmse;
  if (r.max > worstRecipe) { worstRecipe = r.max; worstRecipeAt = `${n.id} (${r.at})`; }
}
check(worstRecipe < 0.05, `all ${recipes.length} FACS recipes of the emotion map reproduced (mean rmse ${(sumR / recipes.length).toFixed(4)}, worst ${worstRecipe.toFixed(3)} at ${worstRecipeAt})`);
metrics.recipes = { count: recipes.length, meanRmse: +(sumR / recipes.length).toFixed(4), worst: +worstRecipe.toFixed(3) };

// ---------------------------------------------------------------- anatomy of each emotion
log('\nwhich muscles carry each emotion (top 4, right side):');
const top = (w, n = 4) => Object.entries(muscleActivity(weightsToMuscles(w))).filter(([k]) => k.endsWith('R')).sort((a, b) => b[1] - a[1]).slice(0, n);
const leading = {};
for (const k of ['sad', 'grief', 'joy', 'surprise', 'fear', 'anger', 'disgust', 'contempt']) {
  const t = top(EMOTIONS[k].w);
  leading[k] = t.map(([m]) => m.slice(0, -1));
  log(`  ${k.padEnd(9)} ${t.map(([m, v]) => `${m.slice(0, -1)} ${v.toFixed(2)}`).join(' · ')}`);
}
const leads = (k, ms) => ms.every((m) => leading[k].includes(m));
check(leads('joy', ['zygMajor', 'orbOculiOrb']), 'joy: zygomaticus major + orbicularis oculi (Duchenne)');
check(leads('sad', ['frontalisMed', 'depAnguli']), 'sadness: medial frontalis (AU1) + depressor anguli (AU15)');
check(leads('surprise', ['frontalisMed', 'levPalp']) && leading.surprise.some((m) => m === 'jawOpener' || m === 'frontalisLat'), 'surprise: frontalis, levator palpebrae, jaw');
check(leading.anger.includes('corrugator') || leading.anger.includes('procerus'), 'anger: brow lowered (corrugator / procerus)');
check(leading.disgust.includes('levLabAlae') || leading.disgust.includes('levLab'), 'disgust: levator labii (AU9/AU10)');

// Forward sanity: the Duchenne smile from muscles alone.
const duch = musclesToWeights(activations({ lipCornerPull: 0.8, cheekRaise: 0.6 }));
check(duch.mouthSmileLeft > 0.7 && duch.cheekSquintRight > 0.6 && !duch.mouthFrownLeft, 'forward: zygomaticus + orbicularis -> smile with the eyes');
const thrust = musclesToWeights(activations({ jawThrustR: 0.8 }));
check(thrust.jawLeft > 0.7 && !thrust.jawRight && thrust.jawForward > 0.3, 'forward: right lateral pterygoid swings the chin to the left');

// Speed: the inverse runs every frame.
const t0 = performance.now();
for (let i = 0; i < 2000; i++) weightsToMuscles(EMOTIONS.grief.w);
const us = ((performance.now() - t0) / 2000) * 1000;
check(us < 200, `inverse fast enough for every frame (${us.toFixed(0)} µs)`);
metrics.inverseMicroseconds = Math.round(us);

if (JSON_OUT) console.log(JSON.stringify({ fails, ...metrics }, null, 2));
else console.log(fails ? `\n${fails} FAILED` : '\nall checks passed');
process.exit(fails ? 1 : 0);
