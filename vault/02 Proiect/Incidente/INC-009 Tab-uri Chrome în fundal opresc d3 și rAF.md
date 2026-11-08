---
type: incident
status: rezolvat
tags:
  - incident
  - testare
created: 2026-09-28
updated: 2026-09-28
related:
  - "[[Registru incidente]]"
  - "[[INC-004 Încărcare blocată la 86% în tab ascuns]]"
---

# INC-009 Tab-uri Chrome în fundal opresc d3 și rAF

## Simptom
La testarea automată în Chrome, harta emoțiilor rămânea neașezată, iar tastele și animațiile nu aveau efect.

## Cauză
În tab-urile din fundal, Chrome oprește `requestAnimationFrame`, tranzițiile d3 și inputul de la tastatură.

## Rezolvare
- Simularea de forțe d3 e rulată sincron până se stabilizează; `fit(0)` fără tranziție.
- În teste: cadrele se randează cu `neuralFace.step(t)`, canvas-ul se copiază în DOM pentru capturi, iar evenimentele se trimit din JS.

Legat de: [[Harta emoțiilor]] · [[Registru incidente]]
