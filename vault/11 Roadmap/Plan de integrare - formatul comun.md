---
type: roadmap
status: propus
tags:
  - roadmap
  - integrare
created: 2026-09-28
updated: 2026-09-28
related:
  - "[[Modele existente de față și emoție (2026)]]"
  - "[[Schema etichetelor de emoție]]"
---

# Plan de integrare — formatul comun

Rezultatul analizei din 2026-09-28: cum legăm tab-urile construite și ce devine modelul.

## Cum se leagă azi
| Piesă | Aduce | Legătura lipsă |
|---|---|---|
| [[Harta emoțiilor]] | ce e fiecare emoție + schema de etichete | capturile nu primesc eticheta |
| [[Creierul emoțional (Atlasul emoțiilor)]] | timpi, spontan vs voluntar | nu controlează viteza expresiei în studio |
| [[Rețeaua neuromotorie]] | emoție → mușchi → piele | ✅ legată de studio și cameră |
| [[Studio emoții]] + [[Captură expresie din imagine]] | expresii în 52 de valori | biblioteca nu salvează eticheta |
| [[EXP-003 Validare round-trip MediaPipe]] | 6/10 recunoscute | nu actualizează capabilitatea din hartă |

## Pași, în ordine
1. [ ] **Formatul comun** ([[Schema etichetelor de emoție]]) în hartă, studio, bibliotecă și export.
2. [ ] **Evaluator AU** local → [[Evaluator AU cu LibreFace sau OpenFace 3]]; rezultatele actualizează automat harta.
3. [ ] **Dinamica din atlas** → curbele Performer-ului (spontan vs jucat).
4. [ ] **Date sintetice + primul model antrenat** → [[Fabrică de date sintetice etichetate]].
5. [ ] **Voce / text** → [[Avatar condus de voce și text]].

Recomandare: 1 și 2 întâi — rapide și arată unde e modelul slab.

MOC: [[MOC Roadmap]]
