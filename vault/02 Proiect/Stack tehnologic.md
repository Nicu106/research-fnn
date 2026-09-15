---
type: proiect
status: activ
tags:
  - proiect
  - stack
created: 2026-09-15
updated: 2026-09-15
related:
  - "[[Arhitectură]]"
  - "[[ADR-001 Stack zero-install cu CDN]]"
---

# Stack tehnologic

## Acum (zero instalări)
| Componentă | Alegere | Detalii |
|---|---|---|
| Randare 3D | Three.js **r170** | ES modules din CDN jsDelivr prin `importmap` |
| Tracking facial | MediaPipe **tasks-vision 0.10.14** | WASM + model `face_landmarker.task` (float16) din CDN; delegat GPU cu fallback CPU |
| Aplicație | JavaScript modular, fără build | vezi [[Structura codului]] |
| Server local | `serve.py` (Python stdlib) | fișiere statice cu `Cache-Control: no-store` ([[ADR-006 Server fără cache]]) |
| Pornire | `start.command` | dublu-click pe macOS |
| Model 3D | scan Lee Perry-Smith (CC BY 3.0) | [[ADR-002 Cap scanat Lee Perry-Smith]] |

Motivul: laptopul are spațiu limitat → [[ADR-001 Stack zero-install cu CDN]].

## Viitor (propus)
| Componentă | Propunere | Pentru |
|---|---|---|
| Analiză și antrenare | Python, NumPy/SciPy, PyTorch | [[Estimare Action Units]], [[Modele temporale]] |
| API | FastAPI | stocarea și analiza sesiunilor |
| Grafuri | networkx | analiză pe [[Rețeaua neuronală facială]] |
| Build (opțional) | Vite + TypeScript | când proiectul crește |

MOC: [[MOC Proiect]] · [[MOC Tehnologie]]
