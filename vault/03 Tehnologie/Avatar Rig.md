---
type: tehnologie
status: activ
tags:
  - tehnologie
  - avatar
  - rig
created: 2026-09-15
updated: 2026-09-28
related:
  - "[[MediaPipe Face Landmarker]]"
  - "[[Retargeting]]"
  - "[[Calibrare neutră]]"
---

# Avatar Rig

Modulul `js/live/avatarRig.js`: camera web controlează capul fotorealist. Decizie: [[ADR-005 Rig de deformare în loc de mască separată]].

## Pipeline pe cadru
1. **Oglindire** (implicit activă): `x → −x` + perechi de landmarks simetrice găsite automat pe ancore (reflexie față de planul median).
2. **Eliminarea pozei**: un cadru rigid din partea de sus a feței (colțuri de ochi, tâmple, nas, frunte — puncte care nu se mișcă la vorbit) → centroid, rotație (dreapta / sus / înainte) și scară. Punctele utilizatorului sunt aduse în cadrul de repaus al scanului.
3. **[[Calibrare neutră]]**: media primelor **24 de cadre** = fața neutră a persoanei.
4. **Delta de expresie** = (punct curent − neutru) × 1,1, pentru fiecare dintre cele 468 de puncte ale mesh-ului (irisul e ignorat).
5. **Transfer pe piele**: fiecare vârf (9.279) e legat de cele **K = 8** ancore apropiate cu ponderi gaussiene (σ = 0,32); influență completă până la 0,22, apoi atenuare (0,45).
6. **Separare buze / pleoape**: în zona gurii și a ochilor, vârfurile de deasupra liniei nu folosesc ancorele de dedesubt și invers.
7. **Rotația capului** din gât: 24 de trepte de interpolare între y = −2,7 (umeri fixi) și y = −1,3 (cap complet), pivot (0, −1,9, −0,3); limite yaw ±55°, pitch ±35°, roll ±35°.
8. **Netezire temporală** `1 − e^(−22·dt)`; la oprirea camerei, avatarul revine lin în repaus.

Aceleași legături se aplică nodurilor din [[Rețeaua neuronală facială]].

## Ochi, privire și gură
Deformarea singură nu poate deschide ochii unui scan cu pleoapele lipite, așa că aceste zone sunt tratate separat (vezi [[Ochi și gură (FaceParts)]]):
- **Pleoapele** sunt conduse procedural din blendshapes-urile de clipit (retracție ≈0,13 unități la ochi complet deschis), cu un prag de clipire personalizat și cu influență din `eyeWide` / `eyeSquint`.
- **Privirea** vine din `eyeLookIn/Out/Up/Down` (până la ≈0,5 rad pe orizontală și ≈0,35 rad pe verticală).
- **Shader-ul pielii taie deschideri reale** între pleoape și între buze: o lentilă între colțuri, deasupra și dedesubtul cusăturii, cu margine întunecată (linia genelor, marginea interioară a buzei).
- Părțile rigide (globi oculari, dinți, limbă) urmează rotația completă a capului; dinții de jos și limba urmează mandibula.

## Adăugiri 2026-09-28
- `drive()` — rig-ul poate fi condus sintetic (din [[Studio emoții]]), nu doar din cameră; `bindTarget()` îl leagă de alte ținte.
- **Gura** se deschide doar după distanța reală dintre landmarks 13 și 14 (prag 1,3 mm) → [[INC-005 Încruntarea citită ca gură deschisă]]; colțurile sunt comune ambelor buze → [[INC-006 Zâmbet invizibil pentru MediaPipe]].
- **Pleoape**: înclinare din sprâncene (căderea colțului exterior), ridicarea pleoapei inferioare la mijire, pleoapele urmează privirea; `EYE_LIFT` 0,127 → [[INC-007 Ochii păreau mijiți]].
- **Piele**: riduri procedurale anti-aliasate în spațiul de repaus (frunte, glabelă, laba gâștii, nazolabial, bărbie), înroșire și ochi umezi.
- Expune o **activare** pe regiuni, folosită de [[Rețeaua neuromotorie]].

## Performanță
Legare inițială ≈ 400 ms; ≈ 5,75 ms pe cadru (mesh + rețea) — [[EXP-001 Test sintetic al rig-ului]].

## Limite cunoscute
- Scanul are **ochii și gura închise**; rezolvat prin deschideri tăiate în piele plus geometrie proprie ([[Ochi deschiși pe scanul cu ochii închiși]], [[Ochi și gură (FaceParts)]]). Naturalețea marginilor e încă de evaluat pe fața reală.
- Calitatea deschiderii gurii depinde de topologia buzelor scanului — de testat pe fața reală.
- Transferul e geometric; din 2026-09-28 există și un spațiu muscular prin [[Baza de expresii (52 blendshapes)]] și [[Rețeaua neuromotorie]].

## Controale
„Recalibrare față neutră” (tasta `N`), „Mod oglindă”, previzualizare opțională a camerei.

Surse: [[MediaPipe Face Landmarker]] · [[ADR-004 Ancore MediaPipe prin render și raycast]] · Concepte: [[Retargeting]] · MOC: [[MOC Tehnologie]]
