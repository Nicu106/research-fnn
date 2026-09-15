---
type: experiment
status: parțial
tags:
  - experiment
  - camera
  - live
created: 2026-09-15
updated: 2026-09-15
related:
  - "[[Avatar Rig]]"
  - "[[Faza 0 - Demo]]"
---

# EXP-002 Test live cu camera

## Ipoteză
Cu camera reală, fața fotorealistă urmărește poza și expresiile persoanei după calibrare.

## Setup
- MacBook, „FaceTime HD Camera”, Chrome, `serve.py` pe localhost:5173.
- [[MediaPipe Face Landmarker]] 0.10.14 în modul VIDEO.
- Pornit din panou („Cameră live”), după fix-ul din [[INC-001 Camera se oprea imediat]].

## Rezultate
| Verificare | Rezultat |
|---|---|
| Stream video | 1280×720, pistă `live` |
| Model facial încărcat | da |
| Față detectată / tracking | da |
| Poză urmărită | ex. yaw +4,9° · pitch −8,9° · roll −9,3° |
| Blendshapes afișate live | da (eyeSquint, eyeBlink, browDown…) |
| Deformare cap | deplasare maximă 1,357 |
| Calibrare | **în desfășurare** (2/24 cadre) — tabul era ascuns, deci bucla rAF era oprită ([[INC-004 Încărcare blocată la 86% în tab ascuns]]) |

## Concluzie
Captura, tracking-ul, poza și deformarea funcționează pe hardware real. **Calibrarea completă și calitatea expresiilor pe fața reală nu au fost încă confirmate.**

## Pași următori
- [ ] Rulare într-un tab vizibil: calibrare completă, apoi zâmbet, gura deschisă, sprâncene
- [ ] Evaluarea subiectivă a naturaleței (gură, obraji) și ajustarea σ, K și a gain-ului
- [ ] Măsurarea FPS-ului cu camera activă și a memoriei ([[INC-003 Server oprit din lipsă de memorie]])

MOC: [[MOC Experimente]]
