---
type: roadmap
status: în lucru
tags:
  - roadmap
  - strategie
  - creier
  - mușchi
  - percepție
created: 2026-11-08
updated: 2026-11-08
related:
  - "[[Rețeaua neuromotorie]]"
  - "[[Ghid de studiu - părțile creierului]]"
  - "[[Modele existente de față și emoție (2026)]]"
  - "[[Expresie facială vs emoție]]"
  - "[[Faza 2 - Modele și avatar complet]]"
---

# Strategia: modelul complet al emoției

**Scop:** un model care face tot drumul unei emoții: **percepem** ceva → **creierul** îl evaluează → comanda **motorie** coboară → **mușchii** se contractă → **fața** (gura, ochii, pielea) se mișcă. Totul explicabil, validat pe date reale și rulând live.

## 1. Unde suntem și ce schimbăm fundamental

Azi lanțul rulează **invers**: pornim de la expresie (52 de blendshapes), deducem mușchii, apoi „aprindem” creierul ca să arate cât de activ ar fi. E o vizualizare, nu un model.

**Schimbarea centrală:** lanțul trebuie să ruleze **înainte**:

```
stimul (față / voce / text)
  → PERCEPȚIE (calea rapidă și cea lentă)
  → CREIER (evaluare, emoție, reglare)
  → CALEA MOTORIE (voluntară sau emoțională)
  → MUȘCHI (activări, în timp)
  → FAȚĂ (deformare, gură, ochi, piele, semnale corporale)
  → și înapoi: altcineva PERCEPE fața noastră (bucla închisă)
```

Fiecare săgeată devine un modul cu intrare, ieșire și **o metrică**. Așa îl putem îmbunătăți bucată cu bucată și putem spune cifric cât de bun e.

## 2. Ce înseamnă „cel mai înalt nivel” aici

Modelele de vârf existente (OpenFace 3.0, EMOCA, Audio2Face) sunt cutii negre învățate pe date, fiecare pentru o singură bucată. Ce nu există încă:

1. **Lanțul complet**, de la percepție la piele, într-un singur model.
2. **Anatomic și explicabil**: poți arăta *de ce* s-a mișcat colțul gurii (care regiune, care nucleu, care ramură de nerv, care mușchi).
3. **Validat pe fiecare nivel**, nu doar la final.
4. **Live, în browser, deschis.**

Asta e ținta. Nu încercăm să batem modelele mari pe terenul lor (recunoaștere din imagine), ci le folosim ca **evaluatori** și ca piese.

> [!warning] Limită de onestitate
> Nu copiem creierul neuron cu neuron: nimeni nu poate azi (vezi conversația din 2026-11-08). Lucrăm la nivel de **regiuni**, ca neuroștiința computațională. Și fața nu dovedește emoția trăită ([[Expresie facială vs emoție]]): modelul generează și descrie expresii plauzibile, nu citește minți.

## 3. Cei 6 piloni

### Pilonul 1: Percepția (cum percepem emoțiile)
- **Acum:** MediaPipe (478 de puncte, 52 de blendshapes), rețeaua text → emoție ([[Rețeaua text → emoție (affect-stream)]]).
- **Ținta:**
  - Două căi, ca la om. **Rapidă**: contururi grosiere, ~74 ms până la amigdală, fără să recunoaștem cine e. **Lentă**: AU detaliate, identitate, privire, ~170 ms și peste.
  - Plus vocea (prozodia) și textul, toate trei combinate.
- **Metodă:**
  - Calea lentă: detector de AU precis (LibreFace sau OpenFace 3.0, local).
  - Calea rapidă: un model mic pe imagine redusă / filtrată la frecvențe joase.
  - Fiecare semnal ajunge în creier cu întârzierea lui reală.
- **Metrică:** corelația AU pe [[DISFA]] (PCC), benchmark-urile ABAW (valență/arousal, 8 expresii).

### Pilonul 2: Creierul (evaluarea și emoția)
- **Acum:** 25 de structuri în atlas și 12 noduri în rețeaua neuromotorie, fără dinamică proprie.
- **Ținta:** o simulare pe regiuni care **produce** emoția în timp.
  - Fiecare regiune e un mic model dinamic (tip „neural mass”, ca în The Virtual Brain).
  - Legăturile vin din conectomul uman real.
- **Cele mai importante circuite:**
  - Amigdala ↔ insula ↔ cingularul anterior: relevanța și sentimentul corporal.
  - Hipotalamus → PAG / locus coeruleus: corpul (puls, pupile, roșeață).
  - Prefrontalul ventromedial și lateral → amigdală: **reglarea și masca** (ascunderea expresiei).
  - VTA → accumbens: recompensa.
- **Teoriile ca ipoteze comutabile:** „emoții de bază” vs „emoții construite” devin două configurații ale aceluiași model. Le comparăm pe date, în loc să alegem din principiu.
- **Metrică:**
  - Hărțile de activare per emoție față de meta-analize RMN (Neurosynth / NeuroQuery).
  - Ordinea și latențele față de literatură (atlas: [[Creierul emoțional (Atlasul emoțiilor)]]).

### Pilonul 3: Calea motorie (de la creier la nerv)
- **Acum:** ierarhia cortex → nucleul facial (sus / jos) → 5 ramuri VII + III + V3, cu regula anatomică „fruntea bilateral, fața de jos contralateral”.
- **Ținta:** două căi separate care produc expresii **diferite** în timp.
  - **Voluntară**: cortex motor → zâmbet „la comandă”, debut rapid, fără ochi (fără AU6).
  - **Emoțională**: aria motorie cingulară → zâmbet Duchenne, cu ochi, debut mai lent.
- **Testul de aur: disocierea clinică.** Simulăm leziuni și verificăm că modelul reproduce ce se vede la pacienți:
  - Leziune corticală → fața de jos paralizată pe partea opusă, fruntea cruțată, dar zâmbetul spontan rămâne.
  - Leziune de nerv periferic → toată hemifața paralizată.
  - Leziune pe calea emoțională → zâmbet la comandă posibil, dar zâmbetul spontan lipsește.
  - Se leagă direct de domeniile [[AVC]] și [[Paralizie facială]].
- **Metrică:** reproduce corect 100% din tiparele clinice documentate (Hopf 1992, Morecraft 2001).

### Pilonul 4: Mușchii și biomecanica (cum se mișcă fața și gura)
- **Acum:** 19 mușchi × 2 părți, *deduși* din blendshapes.
- **Schimbarea:** **mușchii devin sursa adevărului.** Expresia = vector de activări musculare (~20 de valori pe fiecare parte). Blendshapes și landmarks se calculează *din* mușchi, nu invers.
- **Ținta pe trepte:**
  1. Mapare învățată: activări musculare → deformarea pielii (din datele noastre de blendshapes și din scanări 4D).
  2. Biomecanică: țesut moale simulat (abordarea Phace, Ichim et al. SIGGRAPH 2017; activări musculare din mișcare, Sifakis et al. 2005).
  3. **Gura în detaliu**:
     - maxilarul cu rotație + translație (articulația temporo-mandibulară);
     - buzele care se ating și se presează, fără să treacă una prin alta;
     - dinții și limba;
     - vorbirea (visemes), combinată cu emoția (vorbit trist ≠ vorbit vesel).
- **Date:** scanări 4D cu FACS (D3DFACS, BP4D), EMG facial din literatură pentru timpi și intensități.
- **Metrică:** eroare în mm față de scanările 4D, sincronizare buze–audio.

### Pilonul 5: Fața și corpul (ce vede celălalt)
- **Acum:** piele fotorealistă, riduri din expresie, ochi, dinți.
- **Ținta:** semnalele care lipsesc, toate comandate de pilonul 2 prin hipotalamus și trunchiul cerebral:
  - fluxul de sânge (roșeață, paloare; legătură cu [[rPPG - fotopletismografie la distanță]]);
  - pupilele (noradrenalină);
  - lacrimile (nucleul salivator superior);
  - respirația, clipitul, micro-expresiile și „scurgerile” când expresia e mascată.
- **Metrică:** studiu perceptiv. Oameni reali ghicesc emoția și notează naturalețea, comparat cu videoclipuri reale.

### Pilonul 6: Bucla închisă și validarea
- **Idee:** avatarul generează o expresie → detectoare independente (OpenFace 3.0, LibreFace, oameni) o citesc → comparăm cu ce am vrut să producem. Extinde [[EXP-003 Validare round-trip MediaPipe]].
- **Tabloul de bord al calității:** o pagină cu metrica fiecărui pilon, rulată automat la fiecare schimbare (avem deja `tools/check-*.mjs`). Fără cifre nu putem spune „cel mai înalt nivel”.

## 4. Ordinea (fiecare etapă se închide cu un demo și o cifră)

| Etapă | Ce facem | Rezultat vizibil | Metrica de închidere |
|---|---|---|---|
| **A. Fundația** ✅ 2026-11-08 | Mușchii ca sursă a adevărului; harness de evaluare cu un detector AU independent | Studio controlat din mușchi, nu din blendshapes | Round-trip 0,002; geometric 11/16 mușchi vizibili ([[EXP-005 Mușchii ca sursă a adevărului - linia de bază]]) |
| **B. Anatomia reală** | Forme 3D reale ale creierului (MNI152, FreeSurfer, atlase de trunchi), tracturi din tractografie | Creier anatomic în cap, etichetat | Poziții verificate față de atlas (mm) |
| **C. Calea motorie dinamică** | Două căi (voluntară / emoțională) cu timpi reali; simulare de leziuni | Zâmbet jucat vs trăit; pacient AVC vs paralizie periferică | Tiparele clinice reproduse |
| **D. Creierul simulat** | Model pe regiuni pe conectom; percepția intră cu latențele ei | Emoția pornește din stimul și se propagă | Corelație cu hărțile meta-analitice; latențe |
| **E. Gura și vorbirea** | Maxilar, buze cu contact, limbă, visemes + emoție | Avatar care vorbește cu emoție | Sincronizare și eroare în mm |
| **F. Corpul și percepția celuilalt** | Sânge, pupile, lacrimi, mască; studiu perceptiv | Expresii greu de distins de real | Scoruri de la evaluatori umani |
| **G. Publicare** | Articol + demo deschis | Model public, reproductibil | Acceptare la ACII / FG / atelierul ABAW |

**A este prima** pentru că fără mușchi ca sursă nu putem rula lanțul înainte, iar fără harness nu știm dacă progresăm. B e a doua pentru că se vede imediat și e baza pentru D.

## 5. Principii de lucru
- **Date unde există, anatomie unde nu există.** Nu inventăm ce se poate măsura; nu învățăm orbește ce se știe din anatomie.
- **Fiecare afirmație are o sursă** (ca în `atlas.js`), fiecare modul are o metrică.
- **Totul live**: simularea pe placa video (WebGPU) sau în Web Worker, 60 FPS.
- **Fără afirmații medicale** până la [[Faza 3 - Pilot clinic]]; limitele din [[Zone de evitat]].

## 6. Riscuri
| Risc | Cum îl tratăm |
|---|---|
| Ne extindem prea mult | Câte o etapă, fiecare închisă cu metrica ei |
| Licențe de date (BP4D, EMOCA: necomerciale) | Folosim pentru cercetare; pentru produs, date proprii sau sintetice ([[Fabrică de date sintetice etichetate]]) |
| Pretindem că citim emoții | Spunem mereu „expresie”, nu „emoție trăită” |
| Model frumos, dar nevalidat | Tabloul de bord al calității e obligatoriu din etapa A |
| Performanță în browser | Simulare pe regiuni (sute, nu miliarde), WebGPU, niveluri de detaliu |

## Legat de
[[MOC Roadmap]] · [[Faza 2 - Modele și avatar complet]] · [[Rețeaua neuromotorie]] · [[Ghid de studiu - părțile creierului]] · [[Modele existente de față și emoție (2026)]]
