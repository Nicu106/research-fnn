---
type: model
status: propus
tags:
  - model
created: 2026-09-15
updated: 2026-09-15
---

# Estimare Action Units

## Scop
Din landmarks și blendshapes (sau direct din imagine), estimăm prezența și intensitatea [[Action Unit|Action Units]].

## Variante
1. **Mapare euristică** blendshapes → AU (rapid, fără antrenare, precizie necunoscută).
2. **Model mic** (MLP sau gradient boosting) pe trăsături MediaPipe, antrenat pe [[DISFA]] / [[BP4D]].
3. **CNN pe imagine** (mai precis, dar mai greu de rulat în browser).

## Evaluare
Corelație și F1 pe AU față de adnotări; testare încrucișată pe persoane noi.

## Primul experiment propus
Corelația dintre blendshapes MediaPipe și AU pe [[DISFA]] → document în [[MOC Experimente]].

Bază: [[FACS și Action Units]] · MOC: [[MOC Date și Modele]]
