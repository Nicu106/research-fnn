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
---

# INC-008 Straturi ascunse și dinți vizibili prin piele

## Simptom
1. Straturile interne ale rețelei nu se vedeau prin capul holografic.
2. Cu pielea semi-transparentă se vedeau dinții și limba.
3. Ochii/dinții apăreau în timpul intro-ului, înaintea pielii.

## Rezolvare
1. Pasul de adâncime `holoDepth` marcat `transparent: true`.
2. Părțile interne se ascund când opacitatea pielii < 0,85 (`setSkin`).
3. Părțile sunt condiționate de progresul tăieturii din intro.

Legat de: [[Randare și post-procesare]] · [[Registru incidente]]
