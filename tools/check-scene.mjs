// Checks the scenario timeline: the face goes through the intended stages, the reply moves the
// lips, scrubbing is deterministic. Run: node tools/check-scene.mjs
import { Performer } from '../js/emotion/emotions.js';
import { SCENARIOS, ScenePlayer, visemesOf } from '../js/emotion/timeline.js';

let fail = 0;
const ok = (cond, msg) => { console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fail++; };

const p = new Performer();
const lines = [];
const sp = new ScenePlayer(p, { onLine: (l) => lines.push(l) });
sp.sound = false;
sp.load(SCENARIOS[0]);
sp.play();

const at = {};
const dt = 1 / 60;
let maxJawReply = 0, maxJawListen = 0;
while (sp.playing) {
  const f = sp.update(dt);
  const t = sp.t;
  if (t > 9.1 && t < 9.1 + sp.lines[1].dur) maxJawReply = Math.max(maxJawReply, f.w.jawOpen);
  if (t < 2.3) maxJawListen = Math.max(maxJawListen, f.w.jawOpen);
  for (const s of [1.5, 2.9, 4.4, 7.8, 9.0, 12.5]) if (!at[s] && t >= s) at[s] = { w: { ...f.w }, head: { ...f.head }, gaze: [...f.gaze], label: sp.beatLabel };
}
const m = (s, n) => at[s].w[n] ?? 0;
console.log('beats:', Object.entries(at).map(([s, x]) => `${s}s ${x.label}`).join(' · '));
ok(m(1.5, 'browInnerUp') < 0.2 && maxJawListen < 0.05, 'listening: face calm, mouth shut while the news is said');
ok(m(2.9, 'eyeWideLeft') > 0.3 && m(2.9, 'browOuterUpLeft') > 0.3, `shock: eyes wide (${m(2.9, 'eyeWideLeft').toFixed(2)}), brows up`);
ok(m(4.4, 'browDownLeft') > 0.12 && m(4.4, 'browInnerUp') > 0.7, 'disbelief: inner brows up while knitting');
ok(m(7.8, 'mouthFrownRight') > 0.4 && m(7.8, 'browInnerUp') > 0.8 && at[7.8].gaze[1] > 0.1, 'sadness: corners down, oblique brow, eyes lowered');
ok(Math.abs(at[9.0].gaze[1]) < 0.1, `compassion: gaze back on the other person (${at[9.0].gaze[1].toFixed(2)})`);
ok(maxJawReply > 0.2, `reply moves the lips (jawOpen up to ${maxJawReply.toFixed(2)})`);
ok(m(12.5, 'browInnerUp') > 0.5, 'after: sadness lingers');
ok(lines.some((l) => l?.who === 'other') && lines.some((l) => l?.who === 'self'), 'both lines shown as subtitles');

// Scrub determinism: seeking to t gives the same face as playing to t.
const p2 = new Performer();
const sp2 = new ScenePlayer(p2);
sp2.sound = false;
sp2.load(SCENARIOS[0]);
sp2.seek(7.8);
const f2 = sp2.update(0);
const d = Math.max(...Object.keys(f2.w).map((n) => Math.abs(f2.w[n] - (at[7.8].w[n] ?? 0))));
ok(d < 0.05, `seek(7.8) matches playback (max diff ${d.toFixed(3)})`);

const v = visemesOf('Îmi pare rău.');
ok(v.dur > 0.8 && v.dur < 2.2, `"Îmi pare rău." lasts ${v.dur.toFixed(2)} s`);

console.log(fail ? `\n${fail} check(s) failed` : '\nall checks passed');
process.exit(fail ? 1 : 0);
