---
type: proiect
status: activ
tags:
  - decizii
  - adr
created: 2026-09-15
updated: 2026-09-28
---

# Jurnal de decizii

Deciziile arhitecturale se scriu ca **ADR** ([[ADR]]) cu template-ul `99 Templates/Decizie (ADR)`: context → decizie → alternative → consecințe.

| ID | Decizie | Stare |
|---|---|---|
| [[ADR-001 Stack zero-install cu CDN]] | JS modular + CDN, fără build | acceptată |
| [[ADR-002 Cap scanat Lee Perry-Smith]] | scan fotorealist public | acceptată |
| [[ADR-003 Rețea deterministă cu seed]] | topologie reproductibilă | acceptată |
| [[ADR-004 Ancore MediaPipe prin render și raycast]] | corespondență landmark ↔ mesh | acceptată |
| [[ADR-005 Rig de deformare în loc de mască separată]] | camera controlează fața fotorealistă | acceptată |
| [[ADR-006 Server fără cache]] | `serve.py` cu no-store | acceptată |
| [[ADR-007 Serii de trăsături în loc de video]] | confidențialitate și analiză | propusă |
| [[ADR-008 Bază de expresii autorată în mm pe landmarks]] | 52 de câmpuri anatomice, același rig | acceptată |
| [[ADR-009 Anatomia înaintea scorului detectorului]] | MediaPipe = verificare, nu adevăr | acceptată |
| [[ADR-010 Tab-ul Creier ca articol text]] | articol generat din date, fără 3D | acceptată |

MOC: [[MOC Proiect]]
