// Checks the neuromotor network: size, symmetry, wiring rules, and which pathways a sad face uses.
// Run: node tools/check-neuromotor.mjs
import { readFileSync } from 'node:fs';
import { buildBasis } from '../js/emotion/faceBasis.js';
import { EMOTIONS, recognise } from '../js/emotion/emotions.js';
import { buildNeuromotor, LEVELS } from '../js/neuro/neuromotor.js';

const anchors = JSON.parse(readFileSync(new URL('../assets/head/anchors.json', import.meta.url))).positions;
const basis = buildBasis({ anchors });
// Stand-in surface network: the landmarks themselves, all on the surface layer.
const ids = [...Array(478).keys()].filter((i) => anchors[i * 3] !== null);
const net = { count: ids.length, positions: Float32Array.from(ids.flatMap((i) => [anchors[i * 3], anchors[i * 3 + 1], anchors[i * 3 + 2]])), layers: new Uint8Array(ids.length) };
const nm = buildNeuromotor({ anchors, frame: basis.frame, net });

let fails = 0;
const check = (c, m) => { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fails++; };
const byKey = Object.fromEntries(nm.nodes.map((n) => [n.key, n]));
const perLevel = LEVELS.map((l, i) => `${l.key}:${nm.nodes.filter((n) => n.level === i).length}`).join(' ');
console.log(`nodes ${nm.nodes.length} · pathway edges ${nm.edges.length} · skin projections ${nm.skin.length}\n  per level: ${perLevel}`);
check(new Set(nm.nodes.map((n) => n.level)).size === 6, 'six structural levels (+ the skin network as the seventh)');

// Mirror symmetry of positions about the face midline.
const mx = basis.frame.origin[0];
let worst = 0, worstKey = '';
for (const n of nm.nodes) {
  if (!n.key.endsWith('R')) continue;
  const m = byKey[n.key.slice(0, -1) + 'L'];
  if (!m) continue;
  const err = Math.hypot((n.pos[0] - mx) + (m.pos[0] - mx), n.pos[1] - m.pos[1], n.pos[2] - m.pos[2]) / basis.unitsPerMM;
  if (err > worst) { worst = err; worstKey = n.key; }
}
check(worst < 8, `left/right structures mirror each other (worst ${worst.toFixed(1)} mm at ${worstKey})`);
check(nm.nodes.filter((n) => n.key.endsWith('R') && n.level === 5).every((n) => n.pos[0] < mx) &&
      nm.nodes.filter((n) => n.key.endsWith('L') && n.level === 5).every((n) => n.pos[0] > mx), 'every right muscle is on the right, every left one on the left');

// Wiring rules.
const has = (a, b) => nm.edges.some((e) => e.a === byKey[a].id && e.b === byKey[b].id);
check(has('cortexL', 'VIIinfR') && !has('cortexL', 'VIIinfL'), 'lower face: contralateral cortex only');
check(has('cortexL', 'VIIsupR') && has('cortexL', 'VIIsupL'), 'upper face: both hemispheres');
check(has('IIIR', 'levPalpR') && !has('temporalR', 'levPalpR'), 'upper lid raiser is oculomotor (III), not facial');
check(has('V3R', 'jawOpenerR') && has('V3R', 'pterygoidLatR'), 'jaw via trigeminal (V3)');
check(has('mandibularR', 'depAnguliR') && has('temporalR', 'frontalisMedR'), 'branches serve the right muscles');

// Sadness: which way does the signal go?
const w = EMOTIONS.sad.w;
nm.compute(w, recognise(w));
const a = (k) => nm.act[byKey[k].id];
console.log('\nsad face, activation:');
for (const k of ['sad', 'joy', 'amygdalaR', 'cortexR', 'VIIsupR', 'VIIinfR', 'temporalR', 'zygomaticR', 'buccalR', 'mandibularR', 'cervicalR', 'frontalisMedR', 'corrugatorR', 'depAnguliR', 'mentalisR', 'zygMajorR', 'jawOpenerR'])
  console.log(`  ${k.padEnd(14)} ${'█'.repeat(Math.round(a(k) * 30)).padEnd(30)} ${a(k).toFixed(2)}`);
check(a('sad') > 0.5 && a('sad') > 2 * a('joy'), 'emotion level: sadness, not joy');
check(a('temporalR') > 0.5 && a('mandibularR') > 0.5, 'temporal (brows) and mandibular (mouth, chin) branches carry it');
check(a('frontalisMedR') > 0.6, 'medial frontalis (AU1, the grief brow) is the most active brow muscle');
check(a('zygMajorR') < 0.05 && a('jawOpenerR') < 0.05, 'smile muscle and jaw stay off');

// Joy uses the zygomatic branch instead.
nm.compute(EMOTIONS.joy.w, recognise(EMOTIONS.joy.w));
check(a('zygomaticR') > a('mandibularR') && a('zygMajorR') > 0.5 && a('joy') > a('sad'), 'joy: zygomatic branch, zygomaticus major, joy prototype');

console.log(fails ? `\n${fails} FAILED` : '\nall checks passed');
process.exit(fails ? 1 : 0);
