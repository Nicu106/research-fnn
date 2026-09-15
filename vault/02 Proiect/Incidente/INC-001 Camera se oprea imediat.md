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

# INC-001 Camera se oprea imediat

## Simptom
Utilizatorul apăsa „Cameră live” și nu se întâmpla nimic; avatarul rămânea nemișcat, pastila afișa „Caut fața…”.

## Diagnostic
- Permisiunea camerei: `granted`; camera „FaceTime HD” vizibilă în browser.
- `getUserMedia` returna stream-ul, dar pista video ajungea imediat în starea **`ended`**; video-ul avea **2×2 pixeli** și `currentTime = 0`.

## Cauză
O cursă (race condition) în `faceTracker.js`: codul care trebuia să elibereze camera dacă permisiunea venea *după* timeout rula înainte ca `this.stream` să fie setat, deci oprea stream-ul valid.

## Rezolvare
- Stream-ul se oprește doar dacă timeout-ul chiar a expirat (flag `timedOut`).
- Așteptăm cadre reale: `videoWidth > 16` și `currentTime > 0`, altfel eroare `NoFrames`.
- Eroare explicită `TrackEnded` dacă pista se termină; `main.js` oprește modul cameră și afișează mesajul.
- Mesaje în română pentru fiecare cauză (`describeCameraError`) și loguri `[camera]` pe etape.

## Verificare
După fix: 1280×720, pista `live`, tracking activ, poza capului urmărită ([[EXP-002 Test live cu camera]]).

## Lecție
Orice cod de „curățenie” asincronă trebuie legat de o stare explicită, nu de o comparație care poate fi adevărată temporar.

Legat de: [[Registru incidente]] · [[MOC Proiect]]
