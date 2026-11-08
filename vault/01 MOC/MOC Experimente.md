---
type: moc
status: activ
tags:
  - moc
  - experimente
created: 2026-09-15
updated: 2026-09-28
---

# MOC Experimente

- [[07 Experimente/README|Protocol de experiment]] — cum rulăm și documentăm un test

## Realizate
| ID | Ce testează | Rezultat |
|---|---|---|
| [[EXP-001 Test sintetic al rig-ului]] | [[Avatar Rig]] pe date sintetice | poză și deformare corecte, 5,75 ms/cadru |
| [[EXP-002 Test live cu camera]] | cameră reală → avatar | tracking + poză OK, calibrare de confirmat |
| [[EXP-003 Validare round-trip MediaPipe]] | expresii studio → MediaPipe | 7/10 emoții recunoscute (rerulat 2026-10-19) |
| [[EXP-004 Rețeaua text → emoție]] | text → emoție, ablații | 80% pe fraze naturale vs 47,5% lexicon |
| [[EXP-005 Mușchii ca sursă a adevărului - linia de bază]] | expresii din mușchi; vizibilitate pe mușchi | round-trip 0,002; geometric 11/16 mușchi vizibili; clasificator MediaPipe PCC 0,33 |

## De făcut
- Al doilea evaluator pe AU ([[Evaluator AU cu LibreFace sau OpenFace 3]])
- Calibrare completă în tab vizibil (continuare [[EXP-002 Test live cu camera]])
- Corelație blendshapes ↔ AU pe [[DISFA]] (vezi [[Estimare Action Units]])
- Repetabilitatea [[Scor de simetrie facială live]] pe aceeași persoană

Legat de: [[MOC Tehnologie]] · [[Faza 1 - Înregistrare și metrici]] · [[🏠 Home]]
