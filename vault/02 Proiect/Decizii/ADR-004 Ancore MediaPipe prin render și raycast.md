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

# ADR-004 Ancore MediaPipe prin render și raycast

## Context
Ca fața scanată să copieze persoana, avem nevoie de corespondența dintre cele 478 de landmarks MediaPipe și suprafața scanului. Scanul nu are această informație.

## Decizie
1. Randăm scanul frontal într-un render target 1024×1024 (cameră fov 24°, poziție (0, 1, 16), fundal gri, rețeaua ascunsă).
2. Rulăm [[MediaPipe Face Landmarker]] în modul IMAGE pe această imagine.
3. Pentru fiecare landmark trimitem o rază prin pixelul lui și luăm intersecția cu mesh-ul.
4. Salvăm rezultatul în `assets/head/anchors.json`.

## Rezultat
Față detectată; **476 din 478** puncte au lovit mesh-ul (ratate: indicii 58 și 172, pe conturul feței). Toate punctele-cheie folosite de rig (colțurile ochilor, puntea nasului, fruntea, tâmplele, buzele) sunt valide.

## Observații
- Prima încercare, pe o captură a canvas-ului, nu a detectat nicio față; varianta cu render target a mers.
- Ancorele se regenerează doar dacă se schimbă modelul 3D.

Legat de: [[Avatar Rig]] · [[Jurnal de decizii]] · [[MOC Proiect]]
