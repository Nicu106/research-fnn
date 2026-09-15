---
type: reglementare
status: activ
tags:
  - etica
  - reglementare
created: 2026-09-15
updated: 2026-09-15
---

# Procesare pe dispozitiv

## Situația actuală
Tot pipeline-ul rulează **în browser**, pe calculatorul utilizatorului: camera, [[MediaPipe Face Landmarker]], [[Avatar Rig]]. Imaginea video **nu pleacă** de pe dispozitiv; din CDN se descarcă doar codul și modelul.

## Avantaje
- Confidențialitate ([[GDPR și date biometrice]]), latență mică, cost de server zero.
- Argument puternic pentru clinici și pacienți.

## Compromisuri
- Performanța depinde de dispozitiv și de memorie ([[INC-003 Server oprit din lipsă de memorie]]).
- Modelele mari ([[Modele temporale]]) pot cere server → trimitem doar trăsături, nu video ([[ADR-007 Serii de trăsături în loc de video]]).

MOC: [[MOC Etică și Reglementare]]
