// Checks the affect-stream network in JS: same outputs as PyTorch (reference texts stored with the
// weights), and the behaviours it was built for. Run: node tools/check-textnet.mjs
import { readFileSync } from 'node:fs';
import { TextNet, TEXT_EMOTIONS as EM } from '../js/emotion/textNet.js';
import { sceneFromText } from '../js/emotion/textScene.js';
import { Performer } from '../js/emotion/emotions.js';
import { ScenePlayer } from '../js/emotion/timeline.js';

let fail = 0;
const ok = (cond, msg) => { console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fail++; };

const net = new TextNet(JSON.parse(readFileSync(new URL('../js/emotion/textNetWeights.json', import.meta.url))));

let worst = 0;
for (const r of net.reference) {
  const a = net.analyse(r.text);
  const segSame = a.seg.join() === r.seg.join();
  for (const [t, s] of r.state.entries()) for (const [k, v] of s.entries()) worst = Math.max(worst, Math.abs(a.states[t][k] - v));
  ok(segSame, `segments match PyTorch: "${r.text}"`);
}
ok(worst < 2e-3, `states match PyTorch (max diff ${worst.toExponential(1)})`);

const show = (text, o) => {
  const a = net.analyse(text, o);
  console.log('   ', a.toks.map((t, i) => (a.seg[i] && i ? '| ' : '') + `${t}·${EM[a.dom[i]].slice(0, 3)}`).join(' '));
  return a;
};
const last = (a) => EM[a.dom.at(-1)];
const at = (a, word) => EM[a.dom[a.toks.indexOf(word)]];

let a = show('A murit fratele.');
ok(at(a, 'murit') === 'surprise' && last(a) === 'sad', 'bad news lands as shock, then sadness');
a = show('Sunt fericit.');
ok(last(a) === 'joy', 'joy');
a = show('Nu sunt fericit.');
ok(last(a) === 'sad', 'negation: "nu sunt fericit" reads as sadness');
a = show('Mi-e frică, dar sunt bucuros.');
ok(last(a) === 'joy', 'contrast: the clause after "dar" dominates');
a = show('Am pierdut kilogramele în plus.');
const b = show('Am pierdut portofelul.');
ok(at(a, 'pierdut') === 'joy' && at(b, 'pierdut') === 'sad', 'post: the object revises the verb (kilogramele vs portofelul)');
const p0 = net.analyse('Am pierdut', { look: 0 });
console.log(`    live, after "Am pierdut": ${EM[p0.dom.at(-1)]} (provisional)`);
a = show('Sunt foarte trist pentru că am pierdut meciul, dar mâine e o nouă zi.');
const flips = a.dom.slice(1).filter((d, i) => d !== a.dom[i]).length;
ok(flips <= 3, `consistency: few changes of the shown emotion in a long sentence (${flips})`);
a = show('Sunt triști.');
ok(last(a) === 'sad', 'unseen inflected form ("triști", held out of training) still reads as sadness');
a = show('Sunt fericita');
ok(last(a) === 'joy', 'works without diacritics');

// From text to a scene the face plays.
const sc = sceneFromText(net, 'A murit fratele.', 'Îmi pare rău.');
console.log('    scene:', sc.beats.map((b) => `${b.t.toFixed(2)}s ${b.label}`).join(' · '));
const kinds = sc.beats.map((b) => b.kind);
ok(kinds.indexOf('shock') > 0 && kinds.indexOf('sad') > kinds.indexOf('shock') && kinds.includes('compassion'),
  'text scene: listen → shock → sadness → compassion, built by the network');
const sp = new ScenePlayer(new Performer());
sp.sound = false;
sp.load(sc);
sp.play();
let jaw = 0, frown = 0;
const reply = sp.lines[1];
while (sp.playing) {
  const f = sp.update(1 / 60);
  if (sp.t > reply.t && sp.t < reply.t + reply.dur) jaw = Math.max(jaw, f.w.jawOpen);
  if (sp.t > 2.5 && sp.t < reply.t) frown = Math.max(frown, f.w.mouthFrownLeft);
}
ok(frown > 0.25 && jaw > 0.2, `the face turns sad (frown ${frown.toFixed(2)}) and says the reply (jaw ${jaw.toFixed(2)})`);
const t0 = performance.now();
for (let i = 0; i < 50; i++) net.analyse('Am câștigat concursul, dar mi-a murit câinele și sunt foarte trist.');
console.log(`    ${((performance.now() - t0) / 50).toFixed(2)} ms per 14-word sentence`);

console.log(fail ? `\n${fail} failed` : '\nall ok');
process.exit(fail ? 1 : 0);
