import { readFileSync, writeFileSync } from 'node:fs';
import { TextNet } from '/Users/nicucociorva/Documents/neuronal network face/js/emotion/textNet.js';
const net = new TextNet(JSON.parse(readFileSync('/Users/nicucociorva/Documents/neuronal network face/js/emotion/textNetWeights.json')));
const out = {};
for (const t of ['Am câștigat concursul, dar mi-a murit câinele.', 'Am pierdut', 'Am pierdut kilogramele în plus.', 'A murit fratele.']) {
  const a = net.analyse(t); const p = net.analyse(t, { look: 0 });
  out[t] = { toks: a.toks, seg: a.seg, states: a.states, provisional: p.states, dom: a.dom };
  console.log(t, a.toks.map((w, i) => w + ':' + a.dom[i] + '/' + p.dom[i]).join(' '));
}
writeFileSync(new URL('./traj.json', import.meta.url), JSON.stringify(out));
