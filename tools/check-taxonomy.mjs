// Validates the emotion taxonomy: structure, links, FACS recipes, abilities, datasets.
// Run: node tools/check-taxonomy.mjs
import { NODES, LINKS, ABILITIES, DATASETS, capability, familyOf } from '../js/taxonomy/data.js';
import { parseRecipe, recipeToExpression, AU } from '../js/taxonomy/facs.js';
import { EMOTIONS } from '../js/emotion/emotions.js';
import { BLENDSHAPES } from '../js/live/landmarkSets.js';

let fails = 0;
const check = (c, m) => { if (!c) { console.log(`  FAIL ${m}`); fails++; } };
const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));

check(new Set(NODES.map((n) => n.id)).size === NODES.length, 'ids unique');
for (const n of NODES) {
  if (n.parent) check(byId[n.parent], `${n.id}: parent ${n.parent} missing`);
  check(n.v >= -1 && n.v <= 1 && n.a >= -1 && n.a <= 1, `${n.id}: valence/arousal out of range`);
  for (const k of n.needs) check(ABILITIES[k], `${n.id}: unknown ability ${k}`);
  for (const d of n.data) check(DATASETS[d], `${n.id}: unknown dataset ${d}`);
  if (n.preset) check(EMOTIONS[n.preset], `${n.id}: preset ${n.preset} missing`);
  if (n.facs) {
    try {
      for (const t of parseRecipe(n.facs)) check(AU[t.au], `${n.id}: AU${t.au} not defined`);
      const e = recipeToExpression(n.facs);
      for (const k of Object.keys(e.w)) check(BLENDSHAPES.includes(k), `${n.id}: recipe maps to unknown blendshape ${k}`);
    } catch (err) { check(false, `${n.id}: ${err.message}`); }
  }
  // no cycles
  let p = n, steps = 0;
  while (p?.parent && steps < 20) { p = byId[p.parent]; steps++; }
  check(steps < 20, `${n.id}: parent cycle`);
}
for (const [a, b, kind] of LINKS) {
  check(byId[a] && byId[b], `link ${a} -> ${b} references a missing node`);
  check(['intensity', 'blend', 'confusion'].includes(kind), `link ${a} -> ${b}: kind ${kind}`);
}

const levels = {}, caps = {}, fam = {};
for (const n of NODES) {
  levels[n.level] = (levels[n.level] ?? 0) + 1;
  const c = capability(n);
  caps[c] = (caps[c] ?? 0) + 1;
  if (n.level !== 'root') fam[familyOf(n.id, byId)] = (fam[familyOf(n.id, byId)] ?? 0) + 1;
}
const gaps = {};
for (const n of NODES) for (const k of n.needs) if (!ABILITIES[k].have) gaps[k] = (gaps[k] ?? 0) + 1;
console.log(`nodes ${NODES.length} · links ${LINKS.length}`);
console.log('levels     ', levels);
console.log('capability ', caps);
console.log('families   ', fam);
console.log('missing abilities (nodes that need each):', Object.entries(gaps).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' '));
console.log(fails ? `\n${fails} FAILED` : '\nall checks passed');
process.exit(fails ? 1 : 0);
