---
type: tehnologie
status: activ
tags:
  - tehnologie
  - creier
  - articol
created: 2026-09-28
updated: 2026-09-28
related:
  - "[[Rețeaua neuromotorie]]"
  - "[[Expresie facială vs emoție]]"
  - "[[Creierul emoțional - surse]]"
---

# Creierul emoțional (Atlasul emoțiilor)

Tab-ul „Creierul emoțional” afișează un **articol text** (fără avatar, fără graf) — „Atlasul emoțiilor”. Decizie: [[ADR-010 Tab-ul Creier ca articol text]].

## Cum e construit
- Datele: `js/brain/atlas.js` — 25 de structuri, 24 de căi, 4 scenarii (frică, tristețe, bucurie, expresie jucată), teorii, mituri, substanțe chimice, implicații pentru model, **22 de surse verificate** ([[Creierul emoțional - surse]]).
- Generatorul: `node tools/build-blog.mjs` → `blog/index.html` (≈157 KB, include și cele 92 de emoții din [[Harta emoțiilor]]). Rulează din nou după orice modificare în `atlas.js` sau `data.js`.
- În aplicație: `main.js` încarcă `blog/index.html` într-un iframe la prima deschidere a tab-ului; camera și studioul se opresc.
- Publicat și ca artefact privat: https://claude.ai/artifact/B5Qe3ypUGJLjEDaHwE1VU8

## Structuri acoperite
Amigdala, hipocamp, hipotalamus, hipofiză, talamus, coliculul superior, cortex vizual, girusul fusiform, sulcul temporal superior, insula anterioară, cingularul anterior (dorsal și subgenual), cortex prefrontal ventromedial / orbitofrontal / dorsolateral / ventrolateral, nucleul accumbens, aria tegmentală ventrală, substanța cenușie periapeductală, locus coeruleus, rafeul dorsal, nucleul facial (VII), nucleul salivator superior (lacrimi), cortexul motor al feței, aria motorie cingulară.

## Idei cheie folosite în model
- Două căi motorii: **voluntară** (cortex motor → fața inferioară, contralateral) și **emoțională** (aria motorie cingulară / limbic) — dublă disociere la pacienți (Hopf 1992, Morecraft 2001).
- Emoțiile nu au câte o „zonă” proprie; sunt rețele distribuite (Lindquist 2012, Barrett 2019).

Verificare: `node tools/check-brain.mjs`. MOC: [[MOC Tehnologie]] · [[MOC Cercetare]]
