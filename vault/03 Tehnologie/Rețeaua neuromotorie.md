---
type: tehnologie
status: activ
tags:
  - tehnologie
  - neuro
  - anatomie
created: 2026-09-28
updated: 2026-09-28
related:
  - "[[Rețeaua neuronală facială]]"
  - "[[FACS și Action Units]]"
  - "[[Creierul emoțional (Atlasul emoțiilor)]]"
---

# Rețeaua neuromotorie

Modulele `js/neuro/neuromotor.js` și `js/neuro/neuromotorView.js`. Arată **cum ajunge o emoție pe față** — o rețea anatomică, nu una antrenată.

## 7 niveluri
emoție → sistem limbic → cortex → nuclei (VII superior/inferior, III, V motor) → nervi (5 ramuri ale VII: temporală, zigomatică, bucală, mandibulară, cervicală + III, V3) → **38 de mușchi** → piele.

| Element | Număr |
|---|---|
| Noduri | 71 |
| Căi (muchii) | 91 |
| Proiecții pe piele | 213 |

## Etichete pe structurile creierului (2026-11-08)
- `js/neuro/brainLabels.js`: câte o etichetă pentru fiecare structură din creier (amigdalele, cingularul anterior, cortexul motor al feței, nucleul facial sus/jos, nucleul motor al trigemenului, nucleul oculomotor), 12 în total, cu „D”/„S” pentru partea subiectului.
- Etichetele stau pe două coloane, de o parte și de alta a creierului, cu linii spre noduri, și sunt distanțate ca să nu se suprapună (nucleii sunt la câțiva mm unul de altul).
- Click pe etichetă: inspectorul arată explicația (`BRAIN_INFO` din `neuromotor.js`). Butonul „Etichete creier” din panou le ascunde.
- Explicațiile pe larg sunt în [[Ghid de studiu - părțile creierului]] (generat cu `node tools/build-brain-guide.mjs`).

## Reguli anatomice
- **Fața superioară are inervație bilaterală, fața inferioară contralaterală** (de aceea un AVC cruță fruntea, iar o paralizie Bell nu) → [[Paralizie facială]], [[AVC]].
- Nodurile profunde sunt poziționate din **coordonate MNI** prin `mniToModel` (`js/brain/atlas.js`): AC = (0; 2,18; 0,455), 0,0205 unități/mm.
- Activarea vine din ponderile expresiei (studio sau cameră) și e desenată pe [[Rețeaua neuronală facială]] (`setActivation`, atributul `aAct`).

## Verificare
`node tools/check-neuromotor.mjs`: la tristețe lucrează ramurile temporală și mandibulară, frontalul medial (AU1) e cel mai activ mușchi al sprâncenei, zâmbetul și mandibula rămân oprite; la bucurie — ramura zigomatică și zigomaticul mare. Toate trec.

Toggle în tab-ul Rețea. MOC: [[MOC Tehnologie]]
