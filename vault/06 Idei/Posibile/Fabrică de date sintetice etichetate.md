---
type: idee
status: idee
tags:
  - idee
  - posibila
  - date
created: 2026-09-28
updated: 2026-09-28
fezabilitate: 3
impact: 5
related:
  - "[[Baza de expresii (52 blendshapes)]]"
  - "[[FaceSynthetics]]"
  - "[[Harta emoțiilor]]"
---

# Fabrică de date sintetice etichetate

## Descriere
Randăm mii de expresii din [[Studio emoții]] (inclusiv compuse), cu **etichete exacte**: 52 de valori, AU, mușchi, emoție din [[Harta emoțiilor]], poză, lumină. Pe ele antrenăm **prima rețea neuronală reală** a proiectului (ex. un MLP mic 52 → emoție, apoi imagine → AU), testată pe poze reale. Precedent: [[FaceSynthetics]].

## Ce ar trebui să fie adevărat ca să meargă
- Mai multe identități (acum avem un singur cap scanat), variație de lumină, unghi, piele.
- Un evaluator independent care confirmă că expresiile sunt citite corect ([[EXP-003 Validare round-trip MediaPipe]]).
- Un set real de test (ex. [[DISFA]], [[Aff-Wild2 și ABAW]]), cu licența respectată.

## Primul pas mic
Script care randează toate cele 93 de noduri din hartă × 5 intensități × 3 unghiuri și salvează PNG + JSON în [[Schema etichetelor de emoție]].

MOC: [[MOC Idei]]
