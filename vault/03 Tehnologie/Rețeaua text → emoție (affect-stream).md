---
type: tehnologie
status: activ
tags:
  - tehnologie
  - emotii
  - nlp
  - retea-neuronala
created: 2026-10-20
updated: 2026-10-20
related:
  - "[[Scenarii în timp]]"
  - "[[Studio emoții]]"
  - "[[EXP-004 Rețeaua text → emoție]]"
---

# Rețeaua text → emoție (affect-stream)

Pasul 2 din arhitectură (text → emoție). **Nu folosim un LLM.** E o rețea proprie, mică: ≈177 mii de parametri, ~1 ms pe frază în browser. Citește textul **cuvânt cu cuvânt** și dă o **stare emoțională pentru fiecare cuvânt** (8 clase: neutru, bucurie, tristețe, frică, furie, surpriză, dezgust, dispreț).

## Arhitectura
1. **Cuvânt → n-grame de caractere** (2–4, hashing în 4096 de găleți, 32 de dimensiuni): „trist”, „triști” și „tristă” au trăsături comune; merge și fără diacritice.
2. **GRU** (64 de unități): ce s-a spus până acum.
3. **Segmentare:** prezice unde începe o propoziție nouă (F1 ≈ 98%).
4. **Pre-context:** atenție asupra propozițiilor anterioare, cu penalizare pentru vechime.
5. **Post-context:** următoarele 2 cuvinte; cuvântul e corectat când sosesc cuvintele de după („am pierdut” + telefonul ↔ kilogramele).
6. **Integrator:** s_t = (1 − g_t)·s_{t−1} + g_t·p_t. Cuvintele de legătură aproape nu mută starea, deci emoția e **consecventă** și nu sare.

**Live:** se reia pe fiecare cuvânt nou. Ultimul cuvânt are o citire provizorie, revizuită pe măsură ce vin cuvintele următoare.

## Date
Nu există un corpus românesc etichetat cuvânt cu cuvânt. Corpusul e **generat**: 30.000 de texte, etichetate de un „profesor” cu reguli de evaluare cognitivă:
- negația;
- intensificatorii („foarte”, „puțin”);
- contrastul („dar”, „însă”);
- șocul înaintea unei vești rele;
- verbele care depind de obiect.

Pluralul masculin al adjectivelor e scos din antrenare, ca test pe forme nevăzute.

## Legătura cu fața
`js/emotion/textScene.js` transformă traiectoria în scenă:
- un cuvânt e înțeles cam la 0,3 s după ce e auzit;
- un beat apare acolo unde starea se schimbă;
- expresia e un amestec de preseturi ponderat cu starea;
- surpriza urmată de o emoție negativă devine **șoc**; tristețea trece în **compasiune**, apoi vine răspunsul.

În studio:
- scenariul „Din text (rețeaua neuronală)”;
- cuvintele colorate sub „Celălalt spune”;
- butonul „Fața reacționează live, cât scrii”.

## Fișiere
- `ml/textnet/corpus.py` — generator și profesor
- `ml/textnet/model.py`, `train.py` — antrenare, ablații, export
- `ml/textnet/handset.py` — fraze naturale scrise de mână
- `js/emotion/textNet.js` — forward în JS (identic cu PyTorch, diferență maximă 5e-5)
- `js/emotion/textNetWeights.json` — ponderile
- `tools/check-textnet.mjs` — verificări

Rezultate: [[EXP-004 Rețeaua text → emoție]].
