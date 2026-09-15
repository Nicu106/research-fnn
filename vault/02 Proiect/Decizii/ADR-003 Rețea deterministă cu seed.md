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

# ADR-003 Rețea deterministă cu seed

## Context
Rețeaua neuronală facială va fi folosită pentru teste pe puncte. Testele trebuie să poată referi același nod între rulări.

## Decizie
Generatorul pseudo-aleator **mulberry32** cu `seed = 1337` alimentează eșantionarea suprafeței, deci ID-urile, pozițiile și muchiile sunt identice la fiecare pornire. Detalii în [[Rețeaua neuronală facială]].

## Consecințe
- ✅ `N-0630` înseamnă mereu același nod; exportul e reproductibil ([[Format export JSON]]).
- ⚠️ Orice schimbare de parametri (raze, k) schimbă ID-urile → versionăm topologia (`meta.version`, `seed`).
- ⚠️ Doar geometria e deterministă; sclipirile și impulsurile vizuale folosesc `Math.random` și nu contează pentru date.

Legat de: [[Jurnal de decizii]] · [[MOC Proiect]]
