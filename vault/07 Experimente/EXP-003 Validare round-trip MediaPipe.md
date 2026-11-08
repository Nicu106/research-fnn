---
type: experiment
status: parțial
tags:
  - experiment
  - validare
  - emotii
created: 2026-09-28
updated: 2026-09-28
related:
  - "[[Studio emoții]]"
  - "[[ADR-009 Anatomia înaintea scorului detectorului]]"
---

# EXP-003 Validare round-trip MediaPipe

## Ipoteză
Dacă o expresie generată de [[Studio emoții]] e naturală, un detector independent ([[MediaPipe Face Landmarker]]) o va citi ca emoția intenționată.

## Setup
- `tools/roundtrip.js` + `tools/harness.js` (doar pentru dezvoltare), rulate în Chrome.
- Randare frontală, camera la nivelul ochilor (vederea `portrait`).
- Randare → MediaPipe (IMAGE) → corectare bias → `recognise(w)`.

## Rezultate
| Emoție | Recunoscută? |
|---|---|
| neutru, melancolie, trist, bucurie, surpriză, furie | ✅ |
| durere (grief) | ❌ → citită ca furie |
| frică | ❌ → citită ca tristețe |
| dezgust, dispreț | ❌ |

**6 din 10.** Tristețea: MediaPipe `browInnerUp` a crescut de la 0,04 la valori corecte după reducerea înclinării capului (capul aplecat ascundea sprâncenele).

## Concluzie
Round-trip-ul a găsit erori reale ([[INC-005 Încruntarea citită ca gură deschisă]], [[INC-006 Zâmbet invizibil pentru MediaPipe]]). Eșecurile rămase sunt parțial biasuri ale MediaPipe (nu emite aproape deloc `mouthFrown`; privire în jos falsă) → [[ADR-009 Anatomia înaintea scorului detectorului]].

## Pași următori
- [ ] Al doilea evaluator pe Action Units: LibreFace sau OpenFace 3.0 ([[Modele existente de față și emoție (2026)]])
- [ ] Rezultatele să actualizeze automat nivelul de capabilitate din [[Harta emoțiilor]]
- [ ] Test pe emoțiile compuse din ABAW ([[Aff-Wild2 și ABAW]])

MOC: [[MOC Experimente]]
