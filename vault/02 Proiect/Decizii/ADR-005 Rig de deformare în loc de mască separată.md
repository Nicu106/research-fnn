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

# ADR-005 Rig de deformare în loc de mască separată

## Context
Prima variantă a modului cameră construia o **mască separată** (rețea pe cele 478 de puncte ale utilizatorului). Cerința clarificată: *„vreau să controlez această față fotorealistă, nu să-mi apară fața mea”*.

## Decizie
Camera controlează direct capul scanat printr-un rig de deformare pe CPU ([[Avatar Rig]]): poza e separată de expresie, iar diferența față de fața neutră e transferată pe vârfurile pielii. Rețeaua neuronală folosește aceleași ponderi. Modulul măștii a fost șters.

## Alternative
- Avatar cu blendshapes ARKit (control direct din cei 52 de parametri) — mai precis, dar mai puțin fotorealist → [[Avatar cu 52 blendshapes ARKit]].
- Rotirea întregului bust — nenatural (se rotesc și umerii).

## Consecințe
- ✅ Personajul fotorealist se mișcă; rețeaua rămâne lipită de piele.
- ⚠️ Ochii nu se pot deschide; buzele pot fi limitate de topologia scanului.
- ⚠️ Transfer aproximativ al expresiei (depinde de calibrare).

Legat de: [[Jurnal de decizii]] · [[MOC Proiect]]
