---
type: idee
status: idee
tags:
  - idee
  - posibila
  - validare
created: 2026-09-28
updated: 2026-09-28
fezabilitate: 4
impact: 4
related:
  - "[[EXP-003 Validare round-trip MediaPipe]]"
  - "[[Estimare Action Units]]"
---

# Evaluator AU cu LibreFace sau OpenFace 3

## Descriere
Adăugăm în round-trip un al doilea detector, antrenat pe Action Units codate de experți (LibreFace sau OpenFace 3.0), rulat local în Python. Acoperă punctele slabe ale MediaPipe (`mouthFrown`, dezgust, dispreț) și dă intensități AU comparabile cu literatura.

## Ce ar trebui să fie adevărat ca să meargă
- Licență de cercetare acceptabilă; instalare locală pe macOS (CPU).
- Un mic server local care primește randările și întoarce AU.

## Primul pas mic
Instalare LibreFace, rulare pe cele 10 presetări randate, tabel comparativ cu MediaPipe.

MOC: [[MOC Idei]]
