---
type: decizie
status: acceptată
tags:
  - decizie
  - adr
created: 2026-09-28
updated: 2026-09-28
related:
  - "[[Creierul emoțional (Atlasul emoțiilor)]]"
---

# ADR-010 Tab-ul Creier ca articol text

## Context
Prima versiune a tab-ului „Creierul emoțional” era un creier 3D cu structuri și căi animate (`brainView.js`, `brainTab.js`). Cerința reală: informația să poată fi **citită și pusă la dispoziție**, ca text, fără avatar sau graf.

## Decizie
Tab-ul afișează articolul „Atlasul emoțiilor”, generat din date (`tools/build-blog.mjs` → `blog/index.html`) și încărcat într-un iframe. `brainView.js` și `brainTab.js` au fost șterse; datele au rămas în `js/brain/atlas.js`, folosit și de [[Rețeaua neuromotorie]].

## Alternative
- Creierul 3D + text lateral — respins de utilizator.
- Articol scris manual — s-ar desincroniza de date.

## Consecințe
- ✅ O singură sursă de date → aplicație, articol și artefact publicat.
- ✅ Tab ușor: nu randează 3D, oprește camera.
- ⚠️ După modificări în `atlas.js` / `taxonomy/data.js` trebuie rulat din nou `build-blog.mjs`.

Legat de: [[Jurnal de decizii]] · [[MOC Proiect]]
