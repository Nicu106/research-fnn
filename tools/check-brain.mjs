// Validates the emotional-brain atlas: sources, pathways, scenarios, and that every structure
// lands inside this head's skull after the MNI registration.
// Run: node tools/check-brain.mjs
import { readFileSync } from 'node:fs';
import { STRUCTURES, PATHWAYS, SCENARIOS, SOURCES, THEORIES, MYTHS, CHEMICALS, IMPLICATIONS, PATH_KINDS, SYSTEMS, mniToModel } from '../js/brain/atlas.js';

let fails = 0;
const check = (c, m) => { if (!c) { console.log(`  FAIL ${m}`); fails++; } };
const ids = new Set(STRUCTURES.map((s) => s.id));
const cites = [
  ...STRUCTURES.flatMap((s) => s.cite), ...PATHWAYS.flatMap((p) => p.cite),
  ...SCENARIOS.flatMap((sc) => sc.steps.flatMap((s) => s.cite ?? [])),
  ...THEORIES.flatMap((x) => x.cite), ...MYTHS.flatMap((x) => x.cite), ...CHEMICALS.flatMap((x) => x.cite), ...IMPLICATIONS.flatMap((x) => x.cite),
];
for (const c of cites) check(SOURCES[c], `unknown source ${c}`);
const used = new Set(cites);
for (const k of Object.keys(SOURCES)) check(used.has(k), `source ${k} is never cited`);
for (const s of STRUCTURES) check(SYSTEMS[s.system], `${s.id}: unknown system`);
for (const p of PATHWAYS) {
  check(ids.has(p.from) && ids.has(p.to), `pathway ${p.id}: ${p.from} -> ${p.to}`);
  check(PATH_KINDS[p.kind], `pathway ${p.id}: kind ${p.kind}`);
}
const pids = new Set(PATHWAYS.map((p) => p.id));
for (const sc of SCENARIOS) for (const st of sc.steps) {
  for (const o of st.on) check(ids.has(o), `${sc.id} "${st.title}": structure ${o}`);
  for (const p of st.paths) check(pids.has(p), `${sc.id} "${st.title}": pathway ${p}`);
}

// Inside the skull: behind the facial skin, inside the head's bounding shell.
const A = JSON.parse(readFileSync(new URL('../assets/head/anchors.json', import.meta.url))).positions;
const face = (i) => [A[i * 3], A[i * 3 + 1], A[i * 3 + 2]];
const forehead = face(10), glabella = face(9), nasion = face(168);
const rows = [];
for (const s of STRUCTURES) {
  for (const sign of s.pair ? [1, -1] : [1]) {
    const [x, y, z] = mniToModel([s.mni[0] * sign, s.mni[1], s.mni[2]]);
    const ok = y > 0.9 && y < 3.85 && z > -1.85 && z < 1.95 && Math.abs(x + 0.11) < 1.6;
    // Anything at forehead height must be well behind the forehead skin.
    const behindFace = !(y > nasion[1] && z > Math.min(forehead[2], glabella[2]) - 0.25);
    check(ok && behindFace, `${s.id}${s.pair ? (sign > 0 ? ' R' : ' L') : ''} outside the skull: (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`);
    if (sign > 0) rows.push(`${s.id.padEnd(12)} (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`);
  }
}
console.log(`structures ${STRUCTURES.length} · pathways ${PATHWAYS.length} · scenarios ${SCENARIOS.length} (${SCENARIOS.reduce((n, s) => n + s.steps.length, 0)} steps) · sources ${Object.keys(SOURCES).length}`);
console.log('placed (right hemisphere):');
for (let i = 0; i < rows.length; i += 3) console.log('   ' + rows.slice(i, i + 3).join('   '));
console.log(fails ? `\n${fails} FAILED` : '\nall checks passed');
process.exit(fails ? 1 : 0);
