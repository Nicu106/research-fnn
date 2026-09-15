---
type: tehnologie
status: activ
tags:
  - tehnologie
  - avatar
  - ochi
created: 2026-09-15
updated: 2026-09-15
related:
  - "[[Avatar Rig]]"
  - "[[Randare și post-procesare]]"
---

# Ochi și gură (FaceParts)

Modul: `js/live/faceParts.js`. Scanul folosit ([[ADR-002 Cap scanat Lee Perry-Smith]]) a fost capturat cu **ochii și gura închise**, deci nu are globi oculari vizibili, dinți sau interior al gurii. Aceste părți sunt construite separat și stau **chiar în spatele pielii**.

## Componente
- **Globi oculari** cu textură de iris generată procedural (pupilă, fibre, cripte, colerete) — fără fișiere externe.
- **Interiorul gurii**: cavitate întunecată, dinți și limbă; dinții de jos și limba urmează mandibula.
- Poziționarea vine din ancorele MediaPipe proiectate pe scan: colțurile ochilor (33/133 și 263/362), pleoapele (159/145, 386/374) și buzele (78/308, 13/14) — vezi [[ADR-004 Ancore MediaPipe prin render și raycast]].

## Cum devin vizibile
[[Avatar Rig]] calculează cât sunt deschise pleoapele și buzele, iar shader-ul pielii **taie deschideri** exact acolo. Când camera e oprită, deschiderile se închid și părțile dispar complet în spatele pielii.

## De evaluat
- Naturalețea marginilor (gene, margine de buză) pe fața reală.
- Culoarea irisului: acum implicită; ar putea fi setabilă.
- Costul suplimentar pe cadru.

MOC: [[MOC Tehnologie]] · Idee: [[Ochi deschiși pe scanul cu ochii închiși]]
