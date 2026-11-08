// Builds the study guide for the brain structures in the app, as an Obsidian note in the vault.
// Generated from the same data the app uses (js/brain/atlas.js for the emotional-brain atlas,
// BRAIN_INFO in js/neuro/neuromotor.js for the labels in 3D), so the guide never drifts from what
// is on screen. Only the plain-language locations and the basics live here.
//
//   node tools/build-brain-guide.mjs  -> vault/03 Tehnologie/Ghid de studiu - părțile creierului.md
import { writeFileSync } from 'node:fs';
import { STRUCTURES, PATHWAYS, SOURCES, SYSTEMS, CHEMICALS, MYTHS, PATH_KINDS } from '../js/brain/atlas.js';
import { BRAIN_INFO } from '../js/neuro/neuromotor.js';

const OUT = 'vault/03 Tehnologie/Ghid de studiu - părțile creierului.md';
const TODAY = new Date().toISOString().slice(0, 10);

// Where each structure is, in words (the atlas keeps MNI coordinates, which nobody can picture).
const WHERE = {
  amygdala: 'Adânc în lobul temporal, câte una în fiecare emisferă, chiar în fața hipocampului. Are cam mărimea și forma unei migdale (de aici numele).',
  hippocampus: 'În lobul temporal medial (spre interior), în spatele amigdalei. Formă alungită și curbată, ca un căluț de mare (de aici numele).',
  hypothalamus: 'La baza creierului, sub talamus, pe linia mediană. Mic: cât o migdală, sub 1% din creier.',
  pituitary: 'Atârnă sub hipotalamus, de care e legată printr-o tijă, într-o mică cavitate a osului de la baza craniului („șaua turcească”), în spatele ochilor.',
  thalamus: 'În centrul creierului: două mase ovale, una în fiecare emisferă, de o parte și de alta a ventriculului III.',
  colliculus: 'Pe „acoperișul” mezencefalului (partea de sus a trunchiului cerebral), în spate: două umflături mici, una pe fiecare parte.',
  v1: 'În lobul occipital, la ceafă, pe fața internă, în jurul șanțului calcarin.',
  ffa: 'Pe fața de jos a lobului temporal, spre spate (girusul fusiform). De obicei mai puternică în emisfera dreaptă.',
  psts: 'Pe fața laterală a lobului temporal, în partea din spate a sulcului temporal superior, aproape de joncțiunea cu lobul parietal.',
  insula: 'Ascunsă în adâncul șanțului lateral (Sylvius), acoperită de lobii frontal, parietal și temporal. Se vede doar dacă depărtezi lobii.',
  dacc: 'Pe fața internă (medială) a lobului frontal, deasupra corpului calos (puntea de fibre dintre emisfere), în partea din față-sus.',
  sgacc: 'Pe fața medială, sub „genunchiul” (curbura din față a) corpului calos. Numerotată aria 25 Brodmann.',
  vmpfc: 'Partea de jos și de mijloc a lobului frontal, deasupra ochilor, pe linia mediană.',
  ofc: 'Pe fața de jos a lobului frontal, chiar deasupra orbitelor (de aici „orbito-frontal”), spre lateral.',
  dlpfc: 'Pe fața laterală a lobului frontal, sus și în față (girusul frontal mijlociu). Aproximativ sub frunte, spre tâmple, sus.',
  vlpfc: 'Pe fața laterală a lobului frontal, jos (girusul frontal inferior), deasupra insulei. În stânga include aria lui Broca.',
  nacc: 'La baza striatului, unde se unesc nucleul caudat și putamenul, adânc, în fața și sub ventriculii laterali.',
  vta: 'În mezencefal, pe linia mediană, în partea din față (ventrală) a trunchiului cerebral.',
  pag: 'În mezencefal, în jurul apeductului lui Sylvius (canalul cu lichid cefalorahidian care străbate mezencefalul).',
  lc: 'În punte, lângă podeaua ventriculului IV, câte unul pe fiecare parte. Are pigment și apare albastru-închis la disecție („pata albastră”).',
  raphe: 'Pe linia mediană a trunchiului cerebral, între mezencefal și punte („rafeu” = cusătură).',
  facialN: 'În partea de jos a punții, câte unul pe fiecare parte. Fibrele lui ocolesc nucleul nervului VI înainte să iasă din trunchi.',
  ssn: 'În punte, chiar lângă nucleul facial.',
  m1face: 'Girusul precentral (lobul frontal, imediat în fața șanțului central), în partea de jos-laterală, aproape de șanțul lateral. Pe „homunculusul motor”, fața ocupă o zonă mare.',
  cma: 'Pe fața medială a lobului frontal, în interiorul șanțului cingular, deasupra cortexului cingular anterior.',
};

// The 3D labels -> atlas entries, and where the two structures missing from the atlas are.
const LABEL_TO_ATLAS = { amygdala: ['amygdala'], cingulate: ['dacc', 'cma'], cortex: ['m1face'], VIIsup: ['facialN'], VIIinf: ['facialN'], Vm: [], III: [] };
const WHERE_3D = {
  Vm: 'În punte, în partea de mijloc, lângă nucleul senzitiv principal al trigemenului; câte unul pe fiecare parte.',
  III: 'În mezencefal, aproape de linia mediană, la nivelul coliculilor superiori, în fața substanței cenușii periapeductale.',
};

const missing = STRUCTURES.filter((s) => !WHERE[s.id]).map((s) => s.id);
if (missing.length) throw new Error(`no location text for: ${missing.join(', ')}`);

const used = new Set();
const cites = (keys = []) => keys.map((k) => { if (!SOURCES[k]) throw new Error(`unknown source ${k}`); used.add(k); return `[[#^${k}|${k}]]`; }).join(', ');
const byId = Object.fromEntries(STRUCTURES.map((s) => [s.id, s]));
const L = [];
const w = (s = '') => L.push(s);

w(`---
type: tehnologie
status: activ
tags:
  - tehnologie
  - creier
  - anatomie
  - studiu
created: ${TODAY}
updated: ${TODAY}
related:
  - "[[Rețeaua neuromotorie]]"
  - "[[Creierul emoțional (Atlasul emoțiilor)]]"
  - "[[Creierul emoțional - surse]]"
---

# Ghid de studiu: părțile creierului

> [!info] Generat automat
> Generat din \`js/brain/atlas.js\` și \`BRAIN_INFO\` din \`js/neuro/neuromotor.js\`, cu \`node tools/build-brain-guide.mjs\`. Nu edita textul de aici: modifică datele și rulează scriptul din nou.

Acest ghid explică **fiecare parte a creierului** care apare în proiect: unde se află, ce face, ce dovezi există și ce mituri circulă despre ea.

- **${Object.keys(BRAIN_INFO).length} tipuri de structuri cu etichete în 3D** (tab-ul *Rețea neuronală*, modurile Hibrid / Rețea, butonul „Etichete creier”). Click pe o etichetă și apare explicația.
- **${STRUCTURES.length} structuri** în atlasul emoțional (tab-ul *Creierul emoțional*).

## Cum să înveți din ghid
1. **Orientarea.** Citește secțiunea „Noțiuni de bază” ca să știi ce înseamnă *medial*, *ventral*, *punte* etc.
2. **Calea din 3D.** Deschide aplicația în modul Hibrid, rotește capul și urmărește etichetele de sus în jos: emoție → amigdală / cingular → cortex motor → nuclei → nervi → mușchi. Click pe fiecare.
3. **Sistemele.** Parcurge atlasul pe sisteme, în ordinea în care circulă informația: *percepție → limbic → trunchi cerebral (corpul) → recompensă → cortex (reglare) → motor (fața)*.
4. **Testează-te.** La final ai o fișă de recapitulare și întrebări.

## Noțiuni de bază (orientare)

| Termen | Înseamnă |
|---|---|
| Anterior / posterior | spre frunte / spre ceafă |
| Dorsal (superior) / ventral (inferior) | spre creștet / spre bază |
| Medial / lateral | spre linia mediană (între emisfere) / spre exterior (tâmple) |
| Ipsilateral / contralateral | pe aceeași parte / pe partea opusă |
| Bilateral | din ambele părți |
| Cortex | stratul exterior, cutat, de substanță cenușie (neuroni) |
| Nucleu | grup compact de neuroni în interiorul creierului |
| Girus / sulc (șanț) | o cută / o adâncitură a cortexului |
| Trunchi cerebral | legătura cu măduva: **mezencefal** (sus), **punte** (mijloc), **bulb** (jos) |
| Lobi | **frontal** (frunte: planificare, mișcare), **parietal** (creștet: simțuri ale corpului), **temporal** (tâmple: auz, memorie, fețe), **occipital** (ceafă: văz) |
| Sistem limbic | denumire veche pentru structurile de pe marginea interioară a emisferelor (amigdală, hipocamp, cingular); vezi miturile de mai jos |

**Coordonatele MNI** din atlas (mm, față de comisura anterioară): *x* pozitiv = dreapta subiectului, *y* pozitiv = în față, *z* pozitiv = în sus. Sunt valori tipice din literatură, folosite ca să plasăm structurile în capul scanat.

## Partea 1 — Structurile etichetate în 3D

Aceasta e calea pe care o arată rețeaua neuromotorie ([[Rețeaua neuromotorie]]): cum ajunge o emoție pe față. „D” / „S” de pe etichetă înseamnă dreapta / stânga subiectului.
`);

for (const [key, b] of Object.entries(BRAIN_INFO)) {
  const atlas = LABEL_TO_ATLAS[key].map((id) => byId[id]);
  w(`### ${b.label}`);
  w(`- **Ce face (pe scurt):** ${b.info}`);
  const where = atlas.length ? WHERE[atlas[0].id] : WHERE_3D[key];
  w(`- **Unde se află:** ${where}`);
  if (atlas.length) w(`- **În atlas:** ${atlas.map((s) => `[[#${s.ro}]]`).join(', ')}`);
  w();
}

w(`## Partea 2 — Atlasul emoțional, pe sisteme
`);
const order = ['sensory', 'limbic', 'brainstem', 'reward', 'cortex', 'motor'];
for (const sys of order) {
  const list = STRUCTURES.filter((s) => s.system === sys);
  if (!list.length) continue;
  w(`### ${SYSTEMS[sys].ro}`);
  w();
  for (const s of list) {
    w(`#### ${s.ro}`);
    w(`*${s.en}* · ${s.pair ? 'pereche (câte una în fiecare emisferă)' : 'una singură, pe linia mediană'} · MNI ≈ (${s.mni.join(', ')}) mm`);
    w();
    w(`- **Unde se află:** ${WHERE[s.id]}`);
    w(`- **Ce face:** ${s.what}`);
    w(`- **Ce arată studiile:** ${s.evidence}`);
    if (s.myth) w(`- **Atenție (mit):** ${s.myth}`);
    const paths = PATHWAYS.filter((p) => p.from === s.id || p.to === s.id);
    if (paths.length) w(`- **Legături:** ${paths.map((p) => p.ro).join('; ')}`);
    if (s.cite?.length) w(`- **Surse:** ${cites(s.cite)}`);
    w();
  }
}

w(`## Partea 3 — Căile (cum circulă informația)
`);
const kinds = [...new Set(PATHWAYS.map((p) => p.kind))];
for (const k of kinds) {
  w(`**${PATH_KINDS[k]?.ro ?? k}**`);
  for (const p of PATHWAYS.filter((q) => q.kind === k)) w(`- ${p.ro}${p.cite?.length ? ` (${cites(p.cite)})` : ''}`);
  w();
}

w(`## Partea 4 — Substanțele chimice
`);
w('| Substanță | De unde vine | Ce face |');
w('|---|---|---|');
for (const c of CHEMICALS) w(`| ${c.ro} | ${c.from} | ${c.text} |`);
w();

w(`## Partea 5 — Mituri frecvente
`);
for (const m of MYTHS) w(`- ❌ *${m.myth}*  \n  ✅ ${m.fact} (${cites(m.cite)})`);
w();

w(`## Fișă de recapitulare
`);
w('| Structură | Sistem | Rolul într-o frază |');
w('|---|---|---|');
for (const s of STRUCTURES) w(`| ${s.ro} | ${SYSTEMS[s.system].ro} | ${s.what.split(/(?<=[.:])\s/)[0]} |`);
w();

w(`## Întrebări de autoverificare
1. De ce un AVC în cortexul motor paralizează gura pe partea opusă, dar lasă fruntea să se miște? *(indiciu: nucleul facial · sus / jos)*
2. Care e diferența dintre calea **voluntară** și cea **emoțională** spre față? Ce structuri folosește fiecare?
3. Cum ajunge o față speriată la amigdală în ~74 ms fără cortexul vizual? Numește cele trei verigi.
4. Ce face hipotalamusul cu o emoție și de ce cortizolul rămâne ridicat după ce expresia a dispărut?
5. Diferența dintre „vreau” și „îmi place”: ce sisteme chimice stau în spatele fiecăruia?
6. De ce nu e corect să spui că amigdala e „centrul fricii” sau insula „centrul dezgustului”?
7. Ce nerv deschide ochii larg la surpriză și ce nerv deschide gura? (Niciunul nu e nervul facial.)
8. Ce structuri prefrontale reglează emoția și cum?

## Surse
`);
for (const k of used) w(`- ${SOURCES[k].t} [link](${SOURCES[k].url}) ^${k}`);
w();
w(`## Legat de
[[Rețeaua neuromotorie]] · [[Creierul emoțional (Atlasul emoțiilor)]] · [[Creierul emoțional - surse]] · [[MOC Tehnologie]]`);

writeFileSync(OUT, L.join('\n') + '\n');
console.log(`${OUT}: ${STRUCTURES.length} structuri atlas, ${Object.keys(BRAIN_INFO).length} etichete 3D, ${used.size} surse`);
