---
type: incident
status: rezolvat
tags:
  - incident
  - bug
created: 2026-10-04
updated: 2026-10-04
related:
  - "[[Registru incidente]]"
  - "[[Baza de expresii (52 blendshapes)]]"
---

# INC-010 Gura nu se deschidea cu jawOpen

## Simptom
În scenariu, avatarul „vorbea” fără să deschidă gura; nici surpriza nu deschidea buzele. Raportat de utilizator: „nu se deschide gura deloc”.

## Cauză
În `faceBasis.js`, `jawShare` avea un factor de atenuare sub linia buzelor care se aplica și **landmark-urilor buzelor**. La jawOpen = 1 bărbia cobora 24 mm, dar buza inferioară interioară (landmark 14) doar 0,1 mm → distanța 13↔14 rămânea sub pragul de contact (1,3 mm) → nicio deschidere.

## Rezolvare
Buza inferioară și colțurile urmează mereu maxilarul; atenuarea rămâne doar pentru pielea din jur. Acum: jawOpen 0,1 → 2,4 mm, 0,3 → 7,2 mm, 1 → 24 mm. Amplitudinea visemelor ridicată la 100%.

## Lecție
Verificările trebuie să măsoare și rezultatul vizibil (distanța dintre buze), nu doar că bărbia se mișcă. De adăugat în `check-basis.mjs`.

Legat de: [[Registru incidente]] · [[Scenarii în timp]]
