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

# ADR-006 Server fără cache

## Context
`python3 -m http.server` nu trimite antete de cache; Chrome a păstrat un `hud.js` vechi alături de un `main.js` nou → `hud.setLive is not a function` ([[INC-002 Cache servea hud.js vechi]]).

## Decizie
`serve.py` (doar Python stdlib): servește fișierele statice cu `Cache-Control: no-store, must-revalidate`, tipuri MIME corecte pentru `.js`, `.mjs`, `.glb`, și ascultă doar pe `127.0.0.1`.

## Consecințe
- ✅ După fiecare modificare, browserul încarcă mereu versiunea curentă.
- ⚠️ Doar pentru dezvoltare locală, nu pentru producție.

Legat de: [[Stack tehnologic]] · [[Jurnal de decizii]] · [[MOC Proiect]]
