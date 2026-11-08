---
type: incident
status: rezolvat
tags:
  - incident
  - bug
created: 2026-09-28
updated: 2026-09-28
related:
  - "[[Registru incidente]]"
---

# INC-005 Încruntarea citită ca gură deschisă

## Simptom
La expresia tristă (colțuri coborâte), shader-ul pielii tăia o deschidere între buze — gura părea întredeschisă.

## Cauză
Deschiderea gurii era dedusă din deplasarea generală a buzei inferioare, care coboară și la încruntare.

## Rezolvare
Deschiderea se calculează din **distanța reală dintre landmarks 13 și 14** (centrul buzelor), cu prag `LIP_CONTACT_GAP` = 1,3 mm. Colțurile gurii sunt comune ambelor buze.

## Lecție
Deschiderile din piele trebuie legate de o măsură directă (distanța buză–buză), nu de mișcarea unei singure buze.

Legat de: [[Avatar Rig]] · [[Registru incidente]]
