---
type: decizie
status: propusă
tags:
  - decizie
  - adr
created: 2026-09-15
updated: 2026-09-15
related:
  - "[[Jurnal de decizii]]"
---

# ADR-007 Serii de trăsături în loc de video

## Context
Pentru analiză (medicină, cercetare) trebuie să înregistrăm sesiuni. Video-ul brut e date biometrice identificabile, voluminos și greu de analizat.

## Decizie propusă
Stocăm **serii de timp de trăsături** (landmarks, blendshapes, poză, metrici derivate), nu video. Schema: [[Schema datelor de sesiune]].

## Consecințe
- ✅ Risc de confidențialitate mai mic ([[GDPR și date biometrice]]), fișiere mici, analiză directă.
- ⚠️ Nu putem re-procesa cu modele viitoare care au nevoie de pixeli → opțiune: video doar cu consimțământ separat, pentru studii.
- ⚠️ Landmarks-urile pot fi totuși considerate date biometrice — de verificat cu un jurist.

Legat de: [[Procesare pe dispozitiv]] · [[Jurnal de decizii]] · [[MOC Proiect]]
