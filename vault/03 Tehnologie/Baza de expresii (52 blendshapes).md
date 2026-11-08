---
type: tehnologie
status: activ
tags:
  - tehnologie
  - expresii
  - blendshapes
created: 2026-09-28
updated: 2026-09-28
related:
  - "[[Blendshape]]"
  - "[[Action Unit]]"
  - "[[Avatar Rig]]"
  - "[[Studio emoții]]"
---

# Baza de expresii (52 blendshapes)

Modulul `js/emotion/faceBasis.js` (+ `js/live/landmarkSets.js`). Este **limbajul comun** al întregului proiect: studio, captură din imagine, cameră, rețea neuromotorie și export folosesc aceleași 52 de canale ARKit / MediaPipe.

## Ce face
- Pentru fiecare dintre cele 52 de [[Blendshape|blendshapes]] definește un **câmp de deplasare în milimetri** pe cele 478 de landmarks MediaPipe (autorat anatomic, nu învățat).
- `compose(basis, weights)` → suma ponderată a câmpurilor = poziția landmarks-urilor pentru o expresie; apoi [[Avatar Rig]] (`drive()`) o transferă pe piele exact ca pe un cadru de cameră.
- Normale calculate prin **PCA ponderat după rază** (σ = 10 mm) → simetrice stânga/dreapta; deplasările sunt proiectate tangențial.
- **Contactul buzelor** (`LIP_CONTACT`): buzele nu se pot întrepătrunde; `mouthClose` e condiționat de `jawOpen`.
- Seturi de landmarks denumite în `landmarkSets.js`: `UPPER_LIP`, `LOWER_LIP`, `MOUTH_CORNERS`, `LID_LANDMARKS`, `MIDLINE`, `SIDES`, `MIRROR_PAIRS`.

## Verificare
`node tools/check-basis.mjs` — ex. „frown lowers both corners (−5,4 mm)”, „AU1 lifts the inner brow (8,2 mm), not the tail”, gura deschisă nu mișcă sprâncenele. Toate trec.

## De ce contează
Aceleași 52 de canale sunt folosite de MediaPipe, Apple ARKit, NVIDIA Audio2Face și multe avatare → orice model extern care vorbește ARKit se poate conecta direct (vezi [[Modele existente de față și emoție (2026)]]).

Decizie: [[ADR-008 Bază de expresii autorată în mm pe landmarks]] · MOC: [[MOC Tehnologie]]
