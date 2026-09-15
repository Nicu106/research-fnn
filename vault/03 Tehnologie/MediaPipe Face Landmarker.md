---
type: tehnologie
status: activ
tags:
  - tehnologie
  - mediapipe
  - tracking
created: 2026-09-15
updated: 2026-09-15
related:
  - "[[Avatar Rig]]"
  - "[[Landmark]]"
  - "[[Blendshape]]"
---

# MediaPipe Face Landmarker

Model Google care rulează în browser (WASM, delegat GPU sau CPU). Versiune folosită: `@mediapipe/tasks-vision@0.10.14`, model `face_landmarker.task` (float16).

## Ce oferă la fiecare cadru
| Ieșire | Detalii |
|---|---|
| **478 [[Landmark\|landmarks]]** | 468 de puncte ale mesh-ului facial + 10 pentru iris; `x`, `y` normalizate la imagine, `z` relativ (aceeași scară aproximativă ca `x`; negativ = mai aproape de cameră) |
| **[[Blendshape\|Blendshapes]]** | 52 de scoruri 0–1 (inclusiv categoria `_neutral`), nume în stil ARKit (`jawOpen`, `eyeBlinkLeft`, `browInnerUp`…). Diferențele exacte față de lista ARKit: de verificat |
| **Matrice de transformare** | 4×4, poziția și rotația capului |
| **Conexiuni** | constante precum `FACE_LANDMARKS_TESSELATION`, `LIPS`, `LEFT_EYE`, `RIGHT_EYE`, `LEFT_IRIS`, `FACE_OVAL` |

## Indici folosiți în proiect
- Ochi: 33 (exterior dreapta subiectului), 133 (interior dreapta), 362 (interior stânga), 263 (exterior stânga); pleoape 159/145 și 386/374.
- Nas: 1 (vârf), 4, 5, 168 (punte), 195, 197.
- Frunte 10, 151, 9 · bărbie 152 · tâmple/contur 234, 454, 127, 356.
- Gură: colțuri 61 / 291; buze interioare 13 (sus) și 14 (jos).

## Cum îl folosim
- Mod **VIDEO** în `js/live/faceTracker.js` (`detectForVideo`), un singur chip.
- Mod **IMAGE** pentru generarea ancorelor ([[ADR-004 Ancore MediaPipe prin render și raycast]]).
- Pornire robustă: timeout 20 s pentru cameră, 10 s pentru cadre, 60 s pentru model ([[INC-001 Camera se oprea imediat]]).

## Limite
- Landmarks ≠ mușchi: nu sunt [[Action Unit|Action Units]] (vezi [[Estimare Action Units]]).
- Precizia scade la unghiuri mari, lumină slabă și ocluzii — de cuantificat ([[Testarea bias-ului]]).

MOC: [[MOC Tehnologie]]
