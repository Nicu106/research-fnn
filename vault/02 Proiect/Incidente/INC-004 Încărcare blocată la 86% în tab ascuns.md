---
type: incident
status: rezolvat
tags:
  - incident
  - bug
created: 2026-09-15
updated: 2026-09-15
related:
  - "[[Registru incidente]]"
---

# INC-004 Încărcare blocată la 86% în tab ascuns

## Simptom
Loader-ul rămânea la „Construire topologie 086%”.

## Cauză
`main.js` aștepta `requestAnimationFrame` înainte de construirea rețelei; Chrome nu rulează rAF în taburile din fundal.

## Rezolvare
Pauza folosește `setTimeout(30)` în loc de rAF (timerele sunt doar încetinite în fundal, nu oprite).

## Lecție
- Pașii de inițializare nu trebuie să depindă de rAF.
- Pentru teste automate în tab ascuns există `neuralFace.step(t)`, care randează un moment anume.
- Tot din acest motiv, calibrarea din [[EXP-002 Test live cu camera]] a înaintat foarte încet în testul automat.

Legat de: [[Registru incidente]] · [[MOC Proiect]]
