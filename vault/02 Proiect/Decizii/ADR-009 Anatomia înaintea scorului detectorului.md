---
type: decizie
status: acceptată
tags:
  - decizie
  - adr
created: 2026-09-28
updated: 2026-09-28
related:
  - "[[EXP-003 Validare round-trip MediaPipe]]"
---

# ADR-009 Anatomia înaintea scorului detectorului

## Context
Expresiile sunt validate automat: randare → MediaPipe → recunoaștere. MediaPipe are biasuri cunoscute: aproape nu emite `mouthFrown`, iar pe capul nostru raportează o privire în jos („lookDown”) chiar și la neutru.

## Decizie
MediaPipe e folosit ca **semnal de verificare, nu ca adevăr**. Când un reglaj ar mulțumi detectorul dar ar strica anatomia (ex. colțurile gurii, direcția privirii), păstrăm anatomia corectă și notăm biasul.

## Alternative
- Optimizarea expresiilor direct pe scorul MediaPipe — ar produce fețe „făcute pentru detector”, nenaturale.

## Consecințe
- ✅ Fețele rămân plauzibile anatomic.
- ⚠️ Scorul automat subestimează tristețea, dezgustul și disprețul → e nevoie de un al doilea evaluator (LibreFace / OpenFace 3.0, vezi [[Modele existente de față și emoție (2026)]]).

Legat de: [[Jurnal de decizii]] · [[MOC Proiect]]
