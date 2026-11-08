---
type: tehnologie
status: activ
tags:
  - tehnologie
  - captura
  - biblioteca
created: 2026-09-28
updated: 2026-09-28
related:
  - "[[MediaPipe Face Landmarker]]"
  - "[[Studio emoții]]"
  - "[[Calibrare neutră]]"
---

# Captură expresie din imagine

Modulele `js/emotion/imageCapture.js` și `js/emotion/library.js`, din [[Studio emoții]].

## Flux
1. Utilizatorul încarcă o poză → [[MediaPipe Face Landmarker]] în modul **IMAGE** → 52 blendshapes + matricea de poză a capului.
2. `correctWeights(raw, neutral)` corectează biasul detectorului (BIAS/GAIN). Dacă există o poză neutră a aceleiași persoane („Folosește ca față neutră”), se scade neutrul ei ([[Calibrare neutră]]). Canalele de privire (`eyeLook*`) nu se corectează.
3. `headFromMatrix` → yaw/pitch/roll; `toExpression` → o expresie în același format ca presetările.
4. Overlay cu landmarks pe poză + miniatură a feței.
5. Expresia se aplică pe avatar și se poate **salva** în bibliotecă.

## Biblioteca
- `localStorage` cheia `neuralFace.expressions.v1` — adăugare, redenumire, ștergere.
- Import/export JSON (expresie + activarea din [[Rețeaua neuromotorie]]).
- Convenție verificată: fără inversare stânga/dreapta (`SIDE_SWAP = false`), toate semnele +1.

## Limite
- Datele stau doar în browserul curent (nu sunt sincronizate).
- Capturile nu au încă etichetă din [[Harta emoțiilor]] → vezi [[Plan de integrare - formatul comun]].
- Pozele sunt procesate local; nimic nu se trimite pe server ([[Procesare pe dispozitiv]]).

MOC: [[MOC Tehnologie]]
