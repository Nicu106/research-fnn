---
type: model
status: propus
tags:
  - date
  - schema
created: 2026-09-28
updated: 2026-09-28
related:
  - "[[Harta emoțiilor]]"
  - "[[Plan de integrare - formatul comun]]"
  - "[[Schema datelor de sesiune]]"
---

# Schema etichetelor de emoție

Formatul propus pentru orice expresie din proiect (presetare, captură, cadru de cameră, randare sintetică). Harta exportă deja schema de etichete (JSON/CSV); următorul pas e ca toate modulele să o folosească.

```json
{
  "label": { "node": "sad", "family": "sadness", "intensity": 0.7, "capability": "ready" },
  "facs": ["AU1", "AU4", "AU15"],
  "blendshapes": { "browInnerUp": 0.92, "...": 0 },
  "head": { "yaw": 0, "pitch": 3, "roll": 0 },
  "gaze": { "x": 0, "y": -0.1 },
  "dynamics": { "onset_ms": 400, "apex_ms": 1500, "offset_ms": 800, "spontaneous": true },
  "neuromotor": { "branches": { "temporal": 0.8 }, "muscles": { "frontalisMedial": 0.9 } },
  "source": "synthetic | photo | camera",
  "rater": { "mediapipe": "sad", "au_detector": null, "human": null }
}
```

Câmpurile `dynamics` și `rater` sunt noi: primul vine din scenariile din [[Creierul emoțional (Atlasul emoțiilor)]], al doilea din [[EXP-003 Validare round-trip MediaPipe]].

MOC: [[MOC Date și Modele]]
