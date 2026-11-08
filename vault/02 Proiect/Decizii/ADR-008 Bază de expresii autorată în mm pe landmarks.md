---
type: decizie
status: acceptată
tags:
  - decizie
  - adr
created: 2026-09-28
updated: 2026-09-28
related:
  - "[[Baza de expresii (52 blendshapes)]]"
---

# ADR-008 Bază de expresii autorată în mm pe landmarks

## Context
Studioul de emoții trebuie să genereze expresii naturale pe capul scanat, fără cameră. Scanul nu are blendshapes proprii, iar [[Avatar Rig]] știe deja să transfere pe piele deplasări ale celor 478 de landmarks.

## Decizie
Cele 52 de blendshapes ARKit sunt definite ca **câmpuri de deplasare în milimetri pe landmarks**, autorate anatomic (FACS), apoi trecute prin același rig ca un cadru de cameră (`drive()`).

## Alternative
- Sculptarea a 52 de morph targets pe mesh — mult mai lent, legat de un singur mesh.
- Un model 3DMM (FLAME) — licență necomercială și alt mesh ([[Modele 3D morfabile ale feței]]).
- O rețea generativă — fără date de antrenare și fără control anatomic.

## Consecințe
- ✅ Camera, studioul și captura din poză folosesc același spațiu de 52 de valori.
- ✅ Compatibil ARKit / MediaPipe / Audio2Face.
- ✅ Testabil numeric (`tools/check-basis.mjs`).
- ⚠️ Calitatea depinde de autorare; se validează cu [[EXP-003 Validare round-trip MediaPipe]].

Legat de: [[Jurnal de decizii]] · [[MOC Proiect]]
