---
type: idee
status: idee
tags:
  - idee
  - posibila
  - avatar
created: 2026-09-28
updated: 2026-09-28
fezabilitate: 4
impact: 4
related:
  - "[[Studio emoții]]"
  - "[[Modele existente de față și emoție (2026)]]"
---

# Avatar condus de voce și text

## Descriere
- **Text**: un LLM citește textul și alege emoția + intensitatea (un nod din [[Harta emoțiilor]]) → `Performer.setTarget` în [[Studio emoții]].
- **Voce**: NVIDIA Audio2Face-3D (open-source) transformă audio în blendshapes ARKit — exact spațiul nostru de 52 de valori → buze sincronizate + emoție.

## Ce ar trebui să fie adevărat ca să meargă
- Audio2Face rulează local sau ca serviciu (necesită GPU NVIDIA) — de verificat pe Mac.
- Amestecarea buzelor (vorbire) cu emoția (sprâncene, obraji) fără conflicte.

## Primul pas mic
Un câmp text în studio: textul → LLM → numele emoției → presetare.

MOC: [[MOC Idei]]
