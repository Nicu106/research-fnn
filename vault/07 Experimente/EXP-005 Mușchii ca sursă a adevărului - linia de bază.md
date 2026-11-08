---
type: experiment
status: încheiat
tags:
  - experiment
  - mușchi
  - validare
created: 2026-11-08
updated: 2026-11-08
related:
  - "[[Strategia - modelul complet al emoției]]"
  - "[[Stratul muscular]]"
  - "[[EXP-003 Validare round-trip MediaPipe]]"
  - "[[ADR-009 Anatomia înaintea scorului detectorului]]"
---

# EXP-005 Mușchii ca sursă a adevărului: linia de bază

Etapa A din [[Strategia - modelul complet al emoției]]. Prima cifră pentru „cât de bun e modelul”, pe fiecare mușchi.

## Ipoteză
1. Toate expresiile proiectului (presetări + rețete FACS) pot fi produse **doar din mușchi**, fără pierdere vizibilă.
2. Un detector independent (MediaPipe, antrenat pe fețe reale) vede fiecare mușchi mișcat singur.

## Setup
- Stratul muscular: `js/muscle/muscles.js` ([[Stratul muscular]]): 20 de mușchi × 2 părți, 26 de unități funcționale (FACS), 52 de canale.
- `node tools/check-muscles.mjs`: test offline (structură, identificabilitate, round-trip, anatomie).
- `tools/roundtrip.js` în Chrome:
  - `rt.muscles()`: fiecare unitate singură (0,35 și 0,7) → randare frontală → blendshapes MediaPipe → mușchi;
  - `rt.geometry()`: aceeași randare, dar comparăm **deplasarea punctelor** (mm) intenționată vs măsurată, după alinierea pe puncte rigide (colțurile ochilor, rădăcina nasului).

## Rezultate

### 1. Expresiile se pot face din mușchi ✅
| Test | Rezultat |
|---|---|
| 10 presetări ale studioului | eroare maximă **0,002** (din 1) |
| 77 de rețete FACS din [[Harta emoțiilor]] | RMSE mediu **0,0003**, maxim 0,004 |
| Mușchii dominanți pe emoție | corecți: bucurie = zigomatic mare + orbicular orbitar (Duchenne); tristețe = frontal medial + coborâtorul unghiului gurii; furie = corugator / procer; dezgust = ridicătorul buzei și aripii nasului |
| Viteză inversă | ~60 µs pe cadru |

### 2. Ce vede detectorul independent
**Clasificatorul de blendshapes MediaPipe** (`rt.muscles()`): PCC **0,33**, doar **7 / 25** unități detectate la 0,7. Zâmbetul (AU12) la 0,7 e citit 0,09.

**Geometria punctelor** (`rt.geometry()`): **11 / 16** unități măsurabile vizibile corect (gain > 0,5, cos > 0,6), gain mediu 0,57.

| Unitate | Gain | Cos | Concluzie |
|---|---|---|---|
| AU12 zâmbet | 1,14 | 0,95 | perfect vizibil |
| AU10, AU2, AU15, AU20 | 0,73–0,84 | > 0,9 | bine |
| AU22, AU18, AU4, AU7 | 0,52–0,67 | > 0,85 | bine, amplitudine puțin redusă |
| AU1, AU16, AU26 maxilar | 0,45–0,51 | 0,75–0,92 | jumătate din amplitudine |
| AU9 nas | 0,24 | 0,78 | slab |
| AU17 bărbie | 0,25 | 0,46 | slab, tipar greșit |
| **AU6 obraz** | **0,07** | 0,44 | practic invizibil |
| AU5, AU14, AU23/24, AU28, AU29/30, AU43 | n/a | n/a | mișcare în adâncime sau în rig-ul pleoapei: nu se poate măsura frontal |

## Concluzii
1. **Zâmbetul e vizibil geometric (gain 1,14), dar clasificatorul îl citește 0,09.** Deci scorul mic din clasificator e în mare parte o limită a MediaPipe pentru unități izolate, nu a feței noastre. Clasificatorul **nu e un bun etalon pe mușchi**; geometria e.
2. **AU6 nu se poate judeca doar cu MediaPipe.** Ridicarea obrazului se vede mai ales prin umbre, iar MediaPipe urmărește contururi. Conform [[ADR-009 Anatomia înaintea scorului detectorului]], **nu umflăm amplitudinile** ca să-i placă detectorului.
3. **Maxilarul (0,51) e probabil problema noastră**: punctele de pe o gură deschisă se detectează bine. Legat de [[INC-010 Gura nu se deschidea cu jawOpen]]. Intră în etapa E.
4. **Ce nu se poate distinge din ARKit, nici noi nu distingem**, și o spunem explicit:
   - corugator vs procer (gemeni);
   - partea pentru AU1, AU17, pucker, maxilar (forme bilaterale);
   - platisma (pe gât, invizibilă).

## Pași următori (devin sarcini)
- [ ] **Al doilea detector, pe AU:** LibreFace sau OpenFace 3.0, local, ca etalon independent de MediaPipe.
- [ ] **Vedere 3/4** în `rt.geometry()` pentru unitățile de adâncime (AU14, AU23/24, AU28, AU29).
- [ ] **Adevărul de teren în mm:** amplitudinile pe AU din scanări 4D reale (D3DFACS; licență academică) în loc de valori autorate. Abia atunci corectăm AU6, AU9, AU17.
- [ ] **Maxilarul:** de ce apare doar jumătate din deschidere în randare (etapa E).
- [ ] Ambele metrici rulate automat și afișate în tabloul de bord al calității.

MOC: [[MOC Experimente]]
