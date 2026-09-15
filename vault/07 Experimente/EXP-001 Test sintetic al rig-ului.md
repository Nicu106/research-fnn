---
type: experiment
status: finalizat
tags:
  - experiment
  - avatar
  - rig
created: 2026-09-15
updated: 2026-09-15
related:
  - "[[Avatar Rig]]"
  - "[[Faza 0 - Demo]]"
---

# EXP-001 Test sintetic al rig-ului

## Ipoteză
[[Avatar Rig]] elimină poza, calibrează fața neutră și transferă expresia pe mesh și pe rețea, cu un cost pe cadru potrivit pentru timp real.

## Setup
- Ancorele din `assets/head/anchors.json` sunt proiectate printr-o cameră virtuală (fov 24°, poziția (0, 1, 16)) în coordonate de tip MediaPipe (x, y normalizate, z relativ).
- Calibrare: 30 de cadre neutre.
- Expresie sintetică:
  - mandibulă și buza inferioară coborâte cu 0,34
  - colțurile gurii trase în lateral
  - sprâncenele ridicate cu 0,16
  - rotația capului în jurul gâtului: yaw 0,42 rad (≈24°), pitch −0,14 rad, roll 0,1 rad
- 40 de cadre la dt = 1/30; mod oglindă activ.

## Rezultate
| Metrică | Valoare |
|---|---|
| Legare inițială (mesh + rețea) | 400 ms |
| Cost pe cadru | **5,75 ms** |
| Calibrare | finalizată |
| Poză estimată | yaw −16,7° · pitch −6,2° · roll −4,7° |
| Vârfuri mișcate > 0,05 | **8.700 / 9.279** |
| Deplasare maximă pe mesh | 1,112 |
| Deplasare maximă a rețelei | 1,119 |

## Concluzie
- Pipeline-ul funcționează end-to-end; semnul yaw e inversat, cum era de așteptat în modul oglindă.
- Magnitudinea unghiului estimat (≈17° față de ≈24° introdus) e mai mică — probabil din estimarea cadrului rigid sub perspectivă. **De investigat.**
- Costul permite ≥ 60 fps pentru rig.

## Pași următori
- [ ] Test cu mod oglindă oprit, pentru comparația directă a unghiurilor
- [ ] Captură de ecran în `Assets/`
- [ ] Validare pe fața reală ([[EXP-002 Test live cu camera]])

MOC: [[MOC Experimente]]
