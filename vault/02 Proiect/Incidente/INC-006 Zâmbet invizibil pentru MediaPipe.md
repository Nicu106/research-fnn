---
type: incident
status: rezolvat
tags:
  - incident
  - bug
created: 2026-09-28
updated: 2026-09-28
related:
  - "[[Registru incidente]]"
  - "[[EXP-003 Validare round-trip MediaPipe]]"
---

# INC-006 Zâmbet invizibil pentru MediaPipe

## Simptom
Bucuria randată nu era recunoscută: MediaPipe raporta `mouthSmile` aproape zero.

## Cauză
Colțurile gurii erau excluse din separarea buzei inferioare, așa că nu urmau ridicarea zâmbetului.

## Rezolvare
Setul `CORNERS` e scos din excluderea buzelor; colțurile sunt comune ambelor buze. Presetarea bucurie: smile 0,92 / 0,85.

## Lecție
Validarea automată (randare → detector) prinde erori pe care ochiul le ratează la un unghi fix.

Legat de: [[Avatar Rig]] · [[Registru incidente]]
