---
type: incident
status: rezolvat
tags:
  - incident
  - bug
created: 2026-09-15
updated: 2026-09-15
related:
  - "[[Registru incidente]]"
---

# INC-002 Cache servea hud.js vechi

## Simptom
Click pe „Cameră live” → `TypeError: hud.setLive is not a function`.

## Cauză
`python3 -m http.server` nu trimite antete de cache. Chrome a refolosit din cache un `hud.js` vechi (transferSize 0), în timp ce `main.js` era nou.

## Rezolvare
- Pe moment: re-descărcarea modulelor cu `fetch(..., { cache: 'reload' })`.
- Permanent: [[ADR-006 Server fără cache]] (`serve.py` cu `no-store`), iar `start.command` folosește `serve.py`.

## Lecție
La aplicații fără build (fără hash în numele fișierelor), cache-ul trebuie controlat explicit.

Legat de: [[Registru incidente]] · [[MOC Proiect]]
