// Builds the reading version of everything the app knows: a text-only article (no 3D, no graph)
// generated from the same data modules the app uses, so the two never drift apart.
//
//   node tools/build-blog.mjs                -> blog/index.html (standalone page, served at /blog/)
//   node tools/build-blog.mjs --fragment OUT -> OUT, the same page without <html>/<head>/<body>
//                                               (for publishing where the host adds its own skeleton)
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { STRUCTURES, PATHWAYS, SCENARIOS, SOURCES, THEORIES, MYTHS, CHEMICALS, IMPLICATIONS, SYSTEMS, PATH_KINDS } from '../js/brain/atlas.js';
import { NODES, LINKS, ABILITIES, DATASETS, CAPABILITY, capability } from '../js/taxonomy/data.js';
import { AU, describeRecipe } from '../js/taxonomy/facs.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sign = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}`;

// ---------------------------------------------------------------- citations: numbered by first use
const order = [];
const cite = (keys = []) => keys.map((k) => {
  if (!SOURCES[k]) throw new Error(`unknown source ${k}`);
  if (!order.includes(k)) order.push(k);
  return `<a class="cite" href="#src-${k}" title="${esc(SOURCES[k].t)}">[${order.indexOf(k) + 1}]</a>`;
}).join('');

// ---------------------------------------------------------------- sections
const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));
const structById = Object.fromEntries(STRUCTURES.map((s) => [s.id, s]));

function brainSection() {
  const groups = {};
  for (const s of STRUCTURES) (groups[s.system] ??= []).push(s);
  const structs = Object.entries(groups).map(([sys, list]) => `
    <h3 id="sistem-${sys}">${esc(SYSTEMS[sys].ro)}</h3>
    ${list.map((s) => `
      <section class="entry" id="${s.id}">
        <h4>${esc(s.ro)} <span class="en">${esc(s.en)}</span></h4>
        <p>${esc(s.what)}</p>
        <p class="evidence"><span class="tag">Dovezi</span> ${esc(s.evidence)} ${cite(s.cite)}</p>
        ${s.myth ? `<p class="myth"><span class="tag">Atenție la mit</span> ${esc(s.myth)}</p>` : ''}
        <p class="meta">Poziție MNI (mm): <code>${s.pair ? '±' : ''}${Math.abs(s.mni[0])}, ${s.mni[1]}, ${s.mni[2]}</code>${s.pair ? ' · în ambele emisfere' : ''}</p>
      </section>`).join('')}`).join('');

  const kinds = {};
  for (const p of PATHWAYS) (kinds[p.kind] ??= []).push(p);
  const paths = Object.entries(kinds).map(([k, list]) => `
    <dt>${esc(PATH_KINDS[k].ro)}</dt>
    <dd><ul>${list.map((p) => `<li>${esc(p.ro)} ${cite(p.cite)}</li>`).join('')}</ul></dd>`).join('');

  return `
  <section id="creierul">
    <h2>Cum lucrează creierul emoțiile</h2>
    <p class="lede">Nu există un singur „centru al emoțiilor”. O emoție apare din mai multe rețele care lucrează împreună: unele detectează ce e important, altele pregătesc corpul, altele o simt, o numesc și o reglează. O meta-analiză a studiilor de imagistică nu a găsit regiuni dedicate fiecărei emoții, ci rețele comune multor emoții ${cite(['lindquist2012'])}; emoțiile pot fi totuși deosebite după tiparele de activitate răspândite prin tot creierul ${cite(['kragel2016'])}.</p>
    <p>Mai jos, cele ${STRUCTURES.length} structuri cele mai implicate, grupate pe sisteme. Pozițiile sunt coordonate MNI, spațiul standard din neuroimagistică (x pozitiv = emisfera dreaptă, y = înainte, z = în sus), luate ca valori tipice din literatură.</p>
    ${structs}
    <h3 id="caile">Căile dintre ele</h3>
    <dl class="paths">${paths}</dl>
  </section>`;
}

function scenariosSection() {
  return `
  <section id="scenarii">
    <h2>De la stimul la față</h2>
    <p class="lede">Patru situații, pas cu pas. Timpii măsurați au sursa lângă ei; cei marcați cu <span class="est">≈</span> sunt estimări, nu valori dintr-un studiu anume.</p>
    ${SCENARIOS.map((sc) => `
      <h3 id="scenariu-${sc.id}">${esc(sc.ro)}</h3>
      <div class="table-wrap"><table class="timeline">
        <thead><tr><th>Când</th><th>Ce se întâmplă</th><th>Structuri</th></tr></thead>
        <tbody>${sc.steps.map((st) => `
          <tr>
            <td class="when">${st.est ? '<span class="est" title="estimare">≈</span> ' : ''}${esc(st.t)}</td>
            <td><strong>${esc(st.title)}.</strong> ${esc(st.text)} ${cite(st.cite)}</td>
            <td class="structs">${st.on.map((id) => `<a href="#${id}">${esc(structById[id].ro)}</a>`).join(', ') || '—'}</td>
          </tr>`).join('')}</tbody>
      </table></div>`).join('')}
  </section>`;
}

function theorySection() {
  return `
  <section id="teorii">
    <h2>Teoriile de azi</h2>
    ${THEORIES.map((t) => `<section class="entry"><h4>${esc(t.ro)} <span class="en">${esc(t.who)}</span></h4><p>${esc(t.text)} ${cite(t.cite)}</p></section>`).join('')}
  </section>
  <section id="mituri">
    <h2>Mituri corectate</h2>
    <div class="table-wrap"><table class="myths">
      <thead><tr><th>Se spune</th><th>Ce arată studiile</th></tr></thead>
      <tbody>${MYTHS.map((m) => `<tr><td><s>${esc(m.myth)}</s></td><td>${esc(m.fact)} ${cite(m.cite)}</td></tr>`).join('')}</tbody>
    </table></div>
  </section>
  <section id="neurochimie">
    <h2>Neurochimie</h2>
    <div class="table-wrap"><table>
      <thead><tr><th>Substanța</th><th>Sursa</th><th>Rolul</th></tr></thead>
      <tbody>${CHEMICALS.map((c) => `<tr><td><strong>${esc(c.ro)}</strong></td><td>${esc(c.from)}</td><td>${esc(c.text)} ${cite(c.cite)}</td></tr>`).join('')}</tbody>
    </table></div>
  </section>`;
}

function spectrumSection() {
  const caps = {};
  for (const n of NODES) { const c = capability(n); if (c !== 'root') caps[c] = (caps[c] ?? 0) + 1; }
  const confusions = (id) => LINKS.filter(([a, b, k]) => k === 'confusion' && (a === id || b === id)).map(([a, b]) => (a === id ? b : a));
  const blends = (id) => LINKS.filter(([a, b, k]) => k === 'blend' && (a === id || b === id)).map(([a, b]) => (a === id ? b : a));
  const labelPath = (n) => { const c = []; for (let p = n; p && p.level !== 'root'; p = byId[p.parent]) c.unshift(p.id); return c.join('/'); };
  const link = (id) => `<a href="#e-${id}">${esc(byId[id].ro)}</a>`;

  const entry = (n) => {
    const cap = CAPABILITY[capability(n)];
    const aus = n.facs ? describeRecipe(n.facs) : [];
    const miss = n.needs.filter((k) => !ABILITIES[k].have).map((k) => ABILITIES[k].ro);
    const conf = confusions(n.id), bl = blends(n.id);
    return `
      <section class="entry emo ${n.level}" id="e-${n.id}">
        <h4>${esc(n.ro)} <span class="en">${esc(n.en)}</span></h4>
        <p>${esc(n.def)}</p>
        <ul class="facts">
          <li><span>Valență / activare</span>${sign(n.v)} / ${sign(n.a)}</li>
          <li><span>Din față</span>${esc(n.recog)}</li>
          <li><span>Modelul</span>${esc(cap.ro)}</li>
          <li><span>Etichetă</span><code>${esc(labelPath(n))}</code></li>
        </ul>
        ${aus.length ? `<p class="facs"><span class="tag">FACS</span> <code>${esc(n.facs)}</code> — ${aus.map((t) => `${t.side ? (t.side === 'R' ? 'dreapta ' : 'stânga ') : ''}${esc(t.name.toLowerCase())} (AU${t.au}${t.level})`).join('; ')}</p>`
      : n.facs === null ? '<p class="facs"><span class="tag">FACS</span> nu are o expresie facială proprie; se recunoaște din context, voce sau comportament.</p>' : ''}
        ${miss.length ? `<p><span class="tag">Îi lipsește modelului</span> ${esc(miss.join(', '))}</p>` : ''}
        ${n.cues ? `<p><span class="tag">Semne</span> ${esc(n.cues)}</p>` : ''}
        ${conf.length ? `<p><span class="tag warn">Se confundă cu</span> ${conf.map(link).join(', ')}</p>` : ''}
        ${bl.length ? `<p><span class="tag">Legată de</span> ${bl.map(link).join(', ')}</p>` : ''}
        ${n.data.length ? `<p class="meta">Date: ${n.data.map((k) => esc(DATASETS[k].name)).join(' · ')}</p>` : ''}
      </section>`;
  };

  const families = NODES.filter((n) => n.level === 'family');
  const kids = (id) => NODES.filter((n) => n.parent === id);
  const body = families.map((f) => `
    <h3 id="familie-${f.id}">${esc(f.ro)}</h3>
    ${entry(f)}
    ${kids(f.id).map((e) => `${entry(e)}${kids(e.id).map(entry).join('')}`).join('')}`).join('');

  const toc = families.map((f) => `<a href="#familie-${f.id}">${esc(f.ro)}</a>`).join(' · ');
  return `
  <section id="spectrul">
    <h2>Spectrul emoțiilor</h2>
    <p class="lede">${NODES.length - 1} emoții, nuanțe și stări, în ${families.length} familii. Structura urmează arborele lui Parrott, completat cu emoțiile de bază ale lui Ekman și cu emoțiile sociale descrise de Tracy și Robins; intensitățile și combinațiile urmează roata lui Plutchik. Valența și activarea sunt poziții aproximative în cercul lui Russell, nu norme măsurate.</p>
    <p>Pentru fiecare: definiția, rețeta de mușchi faciali (codurile FACS: numărul unității de acțiune și intensitatea, de la A, urmă, la E, maxim), cât de sigur se recunoaște din față, ce îi lipsește modelului ca să o arate, cu ce se confundă și ce seturi de date o acoperă.</p>
    <p class="counts">${Object.entries(caps).map(([k, v]) => `<span><strong>${v}</strong> ${esc(CAPABILITY[k].ro.toLowerCase())}</span>`).join('')}</p>
    <p class="familytoc">${toc}</p>
    ${body}
  </section>`;
}

function referenceSection() {
  const auRows = Object.entries(AU).map(([n, a]) => `<tr><td><code>AU${n}</code></td><td>${esc(a.name)}</td><td>${esc(a.muscle ?? (a.head ? 'poziția capului' : 'direcția privirii'))}</td></tr>`).join('');
  const gaps = {};
  for (const n of NODES) for (const k of n.needs) if (!ABILITIES[k].have) (gaps[k] ??= []).push(n.id);
  const gapRows = Object.entries(gaps).sort((a, b) => b[1].length - a[1].length).map(([k, ids]) => `
    <tr><td><strong>${esc(ABILITIES[k].ro)}</strong></td><td class="num">${ids.length}</td><td>${esc(ABILITIES[k].how)}</td></tr>`).join('');
  const have = Object.values(ABILITIES).filter((a) => a.have).map((a) => esc(a.ro)).join(' · ');
  const dsRows = Object.values(DATASETS).map((d) => `<tr><td><strong>${esc(d.name)}</strong></td><td>${esc(d.what)}</td></tr>`).join('');
  const cols = ['file', 'person_id', 'capture', 'family', 'emotion', 'sub_emotion', 'intensity', 'valence', 'arousal', 'AU1 … AU45', 'head_pitch', 'head_yaw', 'head_roll', 'gaze', 'tears', 'blush', 'context', 'annotator', 'confidence'];
  return `
  <section id="muschi">
    <h2>Mușchii feței</h2>
    <p class="lede">Unitățile de acțiune FACS (Facial Action Coding System) folosite mai sus și mușchii care le produc. Codurile 51–64 nu sunt mușchi faciali, ci mișcări ale capului și ale privirii.</p>
    <div class="table-wrap"><table><thead><tr><th>Cod</th><th>Mișcarea</th><th>Mușchiul</th></tr></thead><tbody>${auRows}</tbody></table></div>
  </section>
  <section id="abilitati">
    <h2>Ce poate modelul și ce îi lipsește</h2>
    <p>Are deja: ${have}.</p>
    <p>Abilitățile care lipsesc, ordonate după câte emoții ar debloca:</p>
    <div class="table-wrap"><table><thead><tr><th>Abilitatea</th><th class="num">Emoții</th><th>Cum s-ar adăuga</th></tr></thead><tbody>${gapRows}</tbody></table></div>
  </section>
  <section id="date">
    <h2>Cum faci și clasifici datele</h2>
    <ol class="steps">
      <li><strong>Etichetă ierarhică</strong>: familie / emoție / nuanță, de exemplu <code>sadness/melancholy</code>. Lasă nivelurile adânci goale dacă nu ești sigur; o etichetă largă și corectă e mai utilă decât una fină și greșită.</li>
      <li><strong>Intensitate</strong> între 0 și 1, plus <strong>valență și activare</strong> între −1 și 1. Dimensiunile prind stările mixte și trecerile pe care categoriile le pierd.</li>
      <li><strong>Mușchii</strong>: intensitatea fiecărei unități de acțiune pe scara FACS 0–5.</li>
      <li><strong>Semnale din afara feței</strong> ca da/nu: lacrimi, roșeață, postură, voce. Fără ele, durerea, jena și mândria nu pot fi învățate.</li>
      <li><strong>Metadate</strong>: persoana (împarte datele de antrenare și de test pe persoane, nu pe imagini), expresie pozată sau spontană, unghiul, lumina.</li>
      <li><strong>Perechile care se confundă</strong> (vezi „Se confundă cu” la fiecare emoție) cer instrucțiuni clare pentru cei care etichetează și mai multe exemple.</li>
      <li><strong>Cel puțin doi adnotatori</strong> pe imagine, cu acordul dintre ei raportat (Cohen κ sau Krippendorff α).</li>
      <li><strong>Contextul</strong>: aceeași mișcare a feței poate însemna emoții diferite în situații și culturi diferite ${cite(['barrett2019'])}, deci notează situația.</li>
    </ol>
    <p>Coloanele unui fișier de etichetare:</p>
    <p class="cols">${cols.map((c) => `<code>${c}</code>`).join(' ')}</p>
    <h3 id="seturi">Seturi de date</h3>
    <div class="table-wrap"><table><thead><tr><th>Set</th><th>Ce conține</th></tr></thead><tbody>${dsRows}</tbody></table></div>
  </section>
  <section id="model">
    <h2>Ce înseamnă pentru un model al feței</h2>
    ${IMPLICATIONS.map((m) => `<section class="entry"><h4>${esc(m.ro)}</h4><p>${esc(m.text)} ${cite(m.cite)}</p></section>`).join('')}
  </section>`;
}

// Body first (it assigns citation numbers), then the source list in that order.
const main = [brainSection(), scenariosSection(), theorySection(), spectrumSection(), referenceSection()].join('\n');
for (const k of Object.keys(SOURCES)) if (!order.includes(k)) order.push(k);
const sources = `
  <section id="surse">
    <h2>Surse</h2>
    <ol class="sources">${order.map((k) => `<li id="src-${k}">${esc(SOURCES[k].t)} <a href="${SOURCES[k].url}" target="_blank" rel="noopener">link</a></li>`).join('')}</ol>
  </section>`;

const TOC = [
  ['creierul', 'Cum lucrează creierul emoțiile'], ['scenarii', 'De la stimul la față'], ['teorii', 'Teoriile de azi'],
  ['mituri', 'Mituri corectate'], ['neurochimie', 'Neurochimie'], ['spectrul', 'Spectrul emoțiilor'], ['muschi', 'Mușchii feței'],
  ['abilitati', 'Ce poate modelul'], ['date', 'Cum faci și clasifici datele'], ['model', 'Ce înseamnă pentru model'], ['surse', 'Surse'],
];

const CSS = `
:root {
  --bg: #f5f7f7; --paper: #ffffff; --ink: #172122; --ink-2: #3f4e50; --muted: #667779; --rule: #d7e0e0;
  --accent: #0b6f79; --accent-soft: #e2f0f1; --warn: #9a5410; --warn-soft: #f6ecdf; --code-bg: #eaf0f0;
  --serif: "Literata", "Iowan Old Style", Georgia, serif;
  --sans: "Schibsted Grotesk", "Segoe UI", system-ui, sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, Menlo, monospace;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #0d1314; --paper: #121a1b; --ink: #e2eceb; --ink-2: #b9c8c7; --muted: #8a9d9c; --rule: #24302f;
    --accent: #5cc9d2; --accent-soft: #15292b; --warn: #e2a25e; --warn-soft: #2a2117; --code-bg: #1a2526;
    color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --bg: #0d1314; --paper: #121a1b; --ink: #e2eceb; --ink-2: #b9c8c7; --muted: #8a9d9c; --rule: #24302f;
  --accent: #5cc9d2; --accent-soft: #15292b; --warn: #e2a25e; --warn-soft: #2a2117; --code-bg: #1a2526;
  color-scheme: dark;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font-family: var(--serif); font-size: 17px; line-height: 1.65; }
.page { display: grid; grid-template-columns: minmax(0, 1fr); gap: 48px; max-width: 1120px; margin: 0 auto; padding-inline: 20px; padding-block: 40px 96px; }
@media (min-width: 1040px) { .page { grid-template-columns: 230px minmax(0, 1fr); } }
nav.toc { font-family: var(--sans); font-size: 14px; }
@media (min-width: 1040px) { nav.toc { position: sticky; top: calc(env(safe-area-inset-top, 0px) + 24px); align-self: start; max-height: calc(100vh - 48px); overflow-y: auto; } }
nav.toc b { display: block; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); margin-bottom: 10px; }
nav.toc ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
nav.toc a { color: var(--ink-2); text-decoration: none; }
nav.toc a:hover, nav.toc a:focus-visible { color: var(--accent); }
article { min-width: 0; max-width: 70ch; }
header.hero { display: grid; gap: 12px; padding-bottom: 28px; border-bottom: 1px solid var(--rule); margin-bottom: 12px; }
.kicker { font-family: var(--sans); font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent); margin: 0; }
h1 { font-family: var(--sans); font-weight: 700; font-size: clamp(32px, 5vw, 46px); line-height: 1.08; letter-spacing: -0.02em; margin: 0; text-wrap: balance; }
.sub { font-size: 19px; color: var(--ink-2); margin: 0; }
h2 { font-family: var(--sans); font-weight: 700; font-size: 28px; line-height: 1.2; letter-spacing: -0.01em; margin: 64px 0 12px; text-wrap: balance; scroll-margin-top: 20px; }
h3 { font-family: var(--sans); font-weight: 600; font-size: 20px; margin: 40px 0 8px; color: var(--accent); scroll-margin-top: 20px; }
h4 { font-family: var(--sans); font-weight: 600; font-size: 17px; margin: 0 0 4px; }
h4 .en { font-weight: 400; color: var(--muted); font-size: 14px; margin-left: 6px; }
p { margin: 0 0 12px; }
.lede { font-size: 18px; color: var(--ink-2); }
a { color: var(--accent); }
code { font-family: var(--mono); font-size: 0.84em; background: var(--code-bg); padding: 1px 5px; border-radius: 4px; }
.entry { padding: 18px 0; border-top: 1px solid var(--rule); scroll-margin-top: 20px; }
.entry p { margin-bottom: 8px; }
.entry.sub { padding-left: 22px; border-left: 2px solid var(--rule); border-top-style: dashed; }
.tag { font-family: var(--sans); font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); margin-right: 4px; }
.tag.warn, .myth .tag { color: var(--warn); }
.evidence { background: var(--accent-soft); padding: 10px 12px; border-radius: 6px; }
.myth { background: var(--warn-soft); padding: 10px 12px; border-radius: 6px; }
.meta { font-family: var(--sans); font-size: 13px; color: var(--muted); }
.cite { font-family: var(--sans); font-size: 12px; text-decoration: none; vertical-align: super; line-height: 0; margin-left: 1px; }
.facts { list-style: none; margin: 8px 0 10px; padding: 0; display: flex; flex-wrap: wrap; gap: 6px 18px; font-family: var(--sans); font-size: 13.5px; }
.facts span { color: var(--muted); margin-right: 6px; }
.facs { font-size: 15.5px; }
.table-wrap { overflow-x: auto; margin: 12px 0 20px; }
table { border-collapse: collapse; width: 100%; font-size: 15px; }
th { font-family: var(--sans); font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); text-align: left; font-weight: 600; }
th, td { padding: 9px 10px; border-bottom: 1px solid var(--rule); vertical-align: top; }
td.when { font-family: var(--mono); font-size: 13px; white-space: nowrap; color: var(--accent); }
td.structs { font-family: var(--sans); font-size: 13.5px; min-width: 150px; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; font-family: var(--sans); }
.est { font-family: var(--sans); color: var(--warn); font-weight: 700; }
.myths s { color: var(--warn); text-decoration-thickness: 1px; }
dl.paths dt { font-family: var(--sans); font-weight: 600; font-size: 15px; margin-top: 14px; }
dl.paths dd { margin: 4px 0 0; }
dl.paths ul { margin: 0; padding-left: 20px; }
.counts { display: flex; flex-wrap: wrap; gap: 8px 22px; font-family: var(--sans); font-size: 14px; }
.counts strong { font-size: 20px; margin-right: 4px; font-variant-numeric: tabular-nums; }
.familytoc { font-family: var(--sans); font-size: 14px; line-height: 1.9; }
.steps { padding-left: 22px; display: grid; gap: 10px; }
.cols { line-height: 2.1; }
.sources { font-size: 14.5px; padding-left: 26px; display: grid; gap: 8px; }
.sources li { scroll-margin-top: 20px; }
.sources li:target { background: var(--accent-soft); }
footer { margin-top: 56px; padding-top: 18px; border-top: 1px solid var(--rule); font-family: var(--sans); font-size: 13px; color: var(--muted); }
a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 2px; }
@media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }
`;

const content = `<title>Atlasul emoțiilor</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;1,7..72,400&family=Schibsted+Grotesk:wght@400;600;700&display=swap">
<style>${CSS}</style>
<div class="page">
  <nav class="toc" aria-label="Cuprins">
    <b>Cuprins</b>
    <ol>${TOC.map(([id, t]) => `<li><a href="#${id}">${t}</a></li>`).join('')}</ol>
  </nav>
  <article>
    <header class="hero">
      <p class="kicker">Neural Face · text de referință</p>
      <h1>Atlasul emoțiilor</h1>
      <p class="sub">Cum produce creierul o emoție, cum ajunge ea pe față, toate cele ${NODES.length - 1} emoții și stări cu mușchii lor și cum se etichetează datele pentru un model. Fiecare afirmație are sursa ei.</p>
    </header>
    ${main}
    ${sources}
    <footer>Generat din datele proiectului Neural Face (js/brain/atlas.js, js/taxonomy/data.js, js/taxonomy/facs.js) la ${new Date().toISOString().slice(0, 10)}. Pozițiile anatomice sunt valori tipice din literatură; timpii marcați cu ≈ sunt estimări.</footer>
  </article>
</div>`;

const args = process.argv.slice(2);
const fragIdx = args.indexOf('--fragment');
if (fragIdx >= 0) {
  const out = args[fragIdx + 1];
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, content);
  console.log(`fragment -> ${out} (${(content.length / 1024).toFixed(0)} KB)`);
} else {
  const out = new URL('../blog/index.html', import.meta.url);
  mkdirSync(new URL('../blog/', import.meta.url), { recursive: true });
  writeFileSync(out, `<!doctype html>\n<html lang="ro">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${content.replace('<div class="page">', '</head>\n<body>\n<div class="page">')}\n</body>\n</html>\n`);
  console.log(`page -> blog/index.html (${(content.length / 1024).toFixed(0)} KB), ${order.length} sources, ${NODES.length - 1} emotions, ${STRUCTURES.length} structures`);
}
