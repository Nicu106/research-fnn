---
type: tehnologie
status: activ
tags:
  - tehnologie
  - taxonomie
  - date
created: 2026-09-28
updated: 2026-09-28
related:
  - "[[FACS și Action Units]]"
  - "[[Modele valență-arousal]]"
  - "[[Schema etichetelor de emoție]]"
---

# Harta emoțiilor

Tab-ul „Harta emoțiilor” (`js/taxonomy/data.js`, `facs.js`, `mapView.js`, d3 v7.9.0). Graf interactiv cu tot spectrul de emoții. Răspunde la: **ce abilități îi dăm modelului, ce date facem și cum le clasificăm**.

## Conținut
- **93 de noduri** (1 rădăcină, 10 familii, 29 sub-familii, 53 emoții) și 43 de legături (intensitate / amestec / confuzie).
- Familii: bucurie 12, tristețe 9, frică 9, furie 8, surpriză 5, dezgust 6, dispreț 5, iubire 7, sociale 10, stări 21.
- Surse ale taxonomiei: Parrott, Ekman, Tracy & Robins (emoții conștiente de sine), Plutchik, circumplexul lui Russell ([[Modele valență-arousal]]).
- Fiecare nod are o rețetă FACS (`parseRecipe`, `recipeToExpression`); compusele urmează Du, Tao & Martinez (2014). Butonul „Arată pe față” o aplică pe avatar.

## Capabilitate (ce poate modelul azi)
| Nivel | Noduri | Sens |
|---|---|---|
| ready | 10 | se face direct din față |
| compose | 27 | amestec de expresii existente |
| partial | 41 | fața ajută, dar lipsesc semnale |
| context | 14 | nu se poate citi din față |

**Abilități lipsă** (câte noduri le cer): context 23 · dinamică 22 · respirație 10 · voce 5 · postură 5 · roșeață 5 · lacrimi 3 · paloare 3 · pupile 3 · transpirație 1 → vezi [[Plan de integrare - formatul comun]].

## Funcții
Layout-uri d3, sectoare echilibrate, etichete radiale, filtre, lista de lipsuri, căutare, detalii, export JSON/CSV (schema de etichete, seturi de date recomandate).

Verificare: `node tools/check-taxonomy.mjs`. MOC: [[MOC Tehnologie]]
