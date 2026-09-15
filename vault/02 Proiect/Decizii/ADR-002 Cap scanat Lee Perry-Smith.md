---
type: decizie
status: acceptată
tags:
  - decizie
  - adr
created: 2026-09-15
updated: 2026-09-15
related:
  - "[[Jurnal de decizii]]"
---

# ADR-002 Cap scanat Lee Perry-Smith

## Context
Cerința: o față **fotorealistă** pentru prezentare. Generarea procedurală nu atinge acest nivel.

## Decizie
Folosim scanul „Lee Perry-Smith” (Infinite-Realities, **CC BY 3.0**), distribuit cu exemplele three.js: `LeePerrySmith.glb` (9.279 vârfuri) + texturi color, normal și specular.

## Alternative
- `facecap.glb` (three.js) — are morph targets ARKit, dar e mai puțin fotorealist.
- Avatar MetaHuman — calitate mare, dar pipeline greu și licență de verificat.

## Consecințe
- ✅ Realism ridicat, fără cost.
- ⚠️ Atribuire obligatorie (CC BY 3.0).
- ⚠️ **Ochii sunt închiși** și nu există rig de expresii → rezolvat parțial prin [[Avatar Rig]]; limită documentată în [[Ochi deschiși pe scanul cu ochii închiși]].
- ⚠️ E o persoană reală — nu îl prezentăm ca pe cineva inventat.

Legat de: [[Randare și post-procesare]] · [[Jurnal de decizii]] · [[MOC Proiect]]
