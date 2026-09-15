---
type: proiect
status: activ
tags:
  - proiect
  - arhitectura
created: 2026-09-15
updated: 2026-09-15
related:
  - "[[Stack tehnologic]]"
  - "[[Structura codului]]"
---

# Arhitectură

```
 ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐
 │ 1. CAPTURĂ   │ → │ 2. DATE      │ → │ 3. MODELE    │ → │ 4. IEȘIRI            │
 │ webcam       │   │ serii de timp│   │ AU, V/A,     │   │ a) avatar (rig)      │
 │ MediaPipe    │   │ pe sesiune   │   │ temporale,   │   │ b) insight/dashboard │
 │ (browser)    │   │ fără video   │   │ personalizare│   │                      │
 └──────────────┘   └──────────────┘   └──────────────┘   └──────────────────────┘
```

## 1. Captură — *implementat*
- [[MediaPipe Face Landmarker]] în browser: 478 [[Landmark|landmarks]], 52 [[Blendshape|blendshapes]], matrice de transformare.
- Viitor: privire, rată de clipire, puls [[rPPG - fotopletismografie la distanță|rPPG]].

## 2. Date — *parțial*
- Azi: [[Format export JSON]] (topologie + cadru live).
- Propus: [[Schema datelor de sesiune]] (serii de timp).

## 3. Modele — *planificat*
- [[Estimare Action Units]] · [[Model valență-arousal]] · [[Modele temporale]] · [[Personalizare față de baseline]]
- Backend propus: Python + PyTorch + FastAPI ([[Stack tehnologic]]).

## 4a. Ieșire avatar — *implementat (v1)*
- [[Avatar Rig]] deformează capul scanat și [[Rețeaua neuronală facială]].
- Limită: scanul are ochii închiși → [[Avatar cu 52 blendshapes ARKit]].

## 4b. Ieșire insight — *planificat*
- [[Dashboard de expresivitate în timp]] · [[Scor de simetrie facială live]]

MOC: [[MOC Proiect]] · [[MOC Tehnologie]]
