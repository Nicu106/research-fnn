---
type: tehnologie
status: activ
tags:
  - tehnologie
  - emotii
  - studio
created: 2026-09-28
updated: 2026-09-28
related:
  - "[[Baza de expresii (52 blendshapes)]]"
  - "[[Captură expresie din imagine]]"
  - "[[Rețeaua neuromotorie]]"
---

# Studio emoții

Tab-ul „Studio emoții” (`js/emotion/studio.js`, `emotions.js`, `driver.js`). Aici se aleg, se reglează și se salvează expresii pe fața fotorealistă.

## Ce conține
- **Grila de emoții** — presetări (`EMOTIONS`): neutru, melancolie, trist, durere (grief), bucurie, surpriză, frică, furie, dezgust, dispreț. Fiecare are ponderi `w` (52 canale), poziția capului, privire, „viață” și piele.
- **Adâncimi de tristețe** (`SAD_DEPTHS`): melancolie → trist → durere. Efort special pe tristețe: sprânceana interioară ridicată (AU1, `browInnerUp` 0,92), colțurile gurii coborâte, capul ușor aplecat (pitch 3°, redus ca să rămână vizibile sprâncenele).
- **Slidere** pentru intensitate + mușchi avansați (canalele individuale).
- **Performer** — stratul de „viață”: clipit, sacade, respirație, micro-zgomot, asimetrie, viteze diferite de apariție pe regiuni (sprâncenele înaintea gurii).
- **Piele**: riduri procedurale (frunte, glabelă, laba gâștii, șanț nazolabial, bărbie, mentolabial), înroșire (flush) și ochi umezi (wet) → vezi [[Avatar Rig]].
- **Captură din imagine** + **bibliotecă** de expresii → [[Captură expresie din imagine]].
- **Legenda** (emoCaption) arată calea emoție → creier → nerv → mușchi din [[Rețeaua neuromotorie]].

## Recunoaștere internă
`recognise(w)` compară ponderile cu prototipurile EMFACS; folosită în [[EXP-003 Validare round-trip MediaPipe]].

MOC: [[MOC Tehnologie]]
