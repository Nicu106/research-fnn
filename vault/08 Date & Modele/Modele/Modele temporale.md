---
type: model
status: propus
tags:
  - model
created: 2026-09-15
updated: 2026-09-15
---

# Modele temporale

## De ce
Expresiile sunt **dinamice**: debut, apex, dispariție. Un cadru izolat e ambiguu; mișcarea în timp aduce informație (viteză, durată, simetria temporală).

## Opțiuni
- Trăsături ferestruite (medie, varianță, viteză) + model clasic.
- Rețele recurente (GRU/LSTM) sau Temporal Convolutional Networks.
- Transformere pe secvențe de trăsături.

## Intrare
[[Schema datelor de sesiune]] (serii de blendshapes, landmarks, poză).

## Aplicații
Clipire ([[Rată de clipire și oboseală]]), hipomimie ([[Parkinson - hipomimie]]), progres în recuperare.

MOC: [[MOC Date și Modele]]
