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

# ADR-001 Stack zero-install cu CDN

## Context
Laptopul are spațiu limitat, iar cerința a fost „fără instalări”. Inițial s-a pornit cu Vite + TypeScript + `node_modules`, apoi s-a renunțat.

## Decizie
Aplicație statică: HTML + JavaScript ES modules. Three.js r170 și MediaPipe tasks-vision 0.10.14 se încarcă din CDN (jsDelivr) prin `importmap` / `import()`. Serverul e Python stdlib ([[ADR-006 Server fără cache]]).

## Alternative
- Vite + TypeScript — DX mai bun, dar `node_modules` pe disc.
- Python desktop (PyQt/Open3D) — randare mai puțin spectaculoasă, instalări.

## Consecințe
- ✅ Zero spațiu ocupat de dependențe, pornire cu dublu-click.
- ⚠️ Necesită internet la prima deschidere; versiunile trebuie fixate exact.
- ⚠️ Fără verificare de tipuri; migrarea la Vite/TS rămâne posibilă.

Legat de: [[Stack tehnologic]] · [[Jurnal de decizii]] · [[MOC Proiect]]
