---
type: experiment
status: activ
tags:
  - experimente
  - proces
created: 2026-09-15
updated: 2026-09-15
---

# Protocol de experiment

## Reguli
1. **Ipoteză înainte de test**: ce ne așteptăm să vedem și ce ar însemna un eșec.
2. **Setup reproductibil**: versiunea codului, parametrii, camera, lumina, browserul.
3. **Metrici numerice** (nu doar „arată bine”) + capturi de ecran în `Assets/`.
4. **Rezultat și concluzie** separate: ce s-a măsurat și ce înțelegem din asta.
5. **Pași următori** legați de roadmap sau de idei.

## Denumire
`EXP-00X Descriere scurtă` · template: `99 Templates/Experiment`.

## Stări
`planificat` → `în lucru` → `finalizat` · `parțial` (rezultat incomplet) · `abandonat`.

## Unelte utile
- `window.neuralFace.step(t)` — randează un moment fix (testele merg și în tab ascuns).
- `window.neuralFace.rig`, `tracker`, `net` — acces la stare din consolă.

MOC: [[MOC Experimente]]
