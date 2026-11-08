---
type: tehnologie
status: activ
tags:
  - tehnologie
  - mușchi
  - facs
created: 2026-11-08
updated: 2026-11-08
related:
  - "[[Rețeaua neuromotorie]]"
  - "[[Baza de expresii (52 blendshapes)]]"
  - "[[FACS și Action Units]]"
  - "[[EXP-005 Mușchii ca sursă a adevărului - linia de bază]]"
---

# Stratul muscular

Modulul `js/muscle/muscles.js`. **Sursa adevărului pentru față:** o expresie e un set de activări musculare (0..1). Cele 52 de blendshapes ARKit sunt *produse* de mușchi, nu invers.

## Trei niveluri
1. **Mușchi anatomici** (`MUSCLES`, 20 × 2 părți): ce desenează [[Rețeaua neuromotorie]], fiecare cu ramura lui de nerv. Maxilarul are acum doi mușchi: digastricul (deschide) și pterigoidianul lateral (înainte și lateral), ambii pe V3.
2. **Unități funcționale** (`UNITS`, 26): aliniate cu FACS. Orbicularul gurii face 6 lucruri distincte (presează, țuguiază, pâlnie, rulează sus / jos, ține buzele lipite), iar orbicularul ochiului 3 (obraz, încordare, închidere); fiecare are unitatea lui.
3. **Ieșiri** (`out`): ce blendshape mișcă fiecare unitate, exact ca tabelul AU din `js/taxonomy/facs.js`.

## Două direcții
- `musclesToWeights(a)`: **înainte**, din mușchi în față (studio, generare).
- `weightsToMuscles(w)`: **invers**, din orice expresie (cameră, poză, presetare) în mușchi. Cele mai mici pătrate cu limite 0..1, coborâre pe coordonate; ~60 µs, rulează la fiecare cadru.

## Ce nu se poate distinge (și e spus explicit)
- **Gemeni:** corugator și procer coboară amândoi sprânceana; inversul îi rezolvă ca o singură variabilă.
- **Forme bilaterale** (browInnerUp, mouthPucker, jawOpen, mouthShrug...): n-au parte, deci inversul dă ambelor părți aceeași valoare. Altfel soluția nu e unică și algoritmul ar pune tot pe o parte.
- **Ascunși:** platisma (pe gât) se comandă doar înainte; din cameră nu se vede.
- **Axa laterală a maxilarului** e una singură, cu semn (pterigoidienii lucrează unul contra celuilalt), transformată la final în jawLeft / jawRight.

## Unde e folosit
- **Studio:** fiecare față afișată trece prin mușchi (presetări, poze, bibliotecă). Panoul *Avansat* are câte un slider pe unitate, cu numele mușchiului și codul FACS. Legenda de sub față arată mușchii activi.
- **Rețeaua neuromotorie:** activarea fiecărui mușchi vine de aici (înainte venea dintr-un tabel aproximativ).
- **Camera:** pentru vizualizarea mușchilor; fața din cameră nu e încă filtrată prin mușchi.

## Vizualizare: modul „Mușchi” (2026-11-08)
- `js/muscle/muscleAnatomy.js`: atlasul. Fiecare mușchi are originea (pe os, fixă) și inserția (în piele, se mișcă), adâncimea în mm și numărul de fascicule. Mușchii circulari (orbicularul gurii și al ochiului) sunt inele.
- `js/muscle/muscleView.js`: foi de fibre sub piele, ca într-un atlas de anatomie. Burta e roșie, tendoanele de la capete sunt pale, iar striațiile urmează direcția fibrelor.
  - Legate de rig: când pielea de la inserție se mișcă, mușchiul se scurtează de la sine.
  - Activarea (din stratul muscular) îl face portocaliu-luminos și trimite o undă de contracție de la inserție spre origine, adică în direcția în care trage.
  - Foile de pe partea îndepărtată se estompează; mușchii adânci (buccinator, ridicătorul pleoapei, maxilarul) sunt mai palizi.
- Butonul **Mușchi** de lângă Piele / Hibrid / Rețea: pielea devine translucidă, rețeaua se ascunde (și revine la ieșire), iar mușchii apar cu etichete (câte una pe mușchi, pe părți alternate).
- Click pe o etichetă: inspectorul arată ce face mușchiul (AU + descriere) și nervul care îl comandă.
- Limită: pozițiile sunt estimate pe scanare (fără RMN), cu erori de câțiva mm; mușchii maxilarului sunt aproximativi.

## Verificare
`node tools/check-muscles.mjs`. În browser: `rt.muscles()` și `rt.geometry()` din `tools/roundtrip.js`. Rezultatele sunt în [[EXP-005 Mușchii ca sursă a adevărului - linia de bază]].

MOC: [[MOC Tehnologie]]
