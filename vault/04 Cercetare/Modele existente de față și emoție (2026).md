---
type: literatura
status: activ
tags:
  - literatura
  - modele
  - stare-a-artei
created: 2026-09-28
updated: 2026-09-28
related:
  - "[[Modele 3D morfabile ale feței]]"
  - "[[Estimare Action Units]]"
  - "[[Plan de integrare - formatul comun]]"
---

# Modele existente de față și emoție (2026)

Research din 2026-09-28: ce există și unde s-ar conecta la Neural Face. Punctul comun: cele **52 de blendshapes ARKit** ([[Baza de expresii (52 blendshapes)]]).

| Categorie | Model | Ce face | Unde se conectează la noi |
|---|---|---|---|
| Action Units | [LibreFace](https://boese0601.github.io/libreface/) (WACV 2024) | AU + intensitate + expresii; PCC 0,63 pe [[DISFA]], ~2× mai rapid decât OpenFace 2.0 | evaluator mai bun decât MediaPipe în [[EXP-003 Validare round-trip MediaPipe]] |
| Action Units | [OpenFace 3.0](https://github.com/CMU-MultiComp-Lab/OpenFace-3.0) (CMU, 2025, [paper](https://arxiv.org/pdf/2506.02891)) | landmarks + AU + privire + emoție într-un singur model; 29,4M parametri, 38 ms/cadru pe CPU | la fel; rulează local |
| 3D din poză | [EMOCA v2](https://github.com/radekd91/emoca) (CVPR 2022) | reconstrucție 3D FLAME cu loss de emoție; v2 folosește landmarks MediaPipe | captură mai bună în [[Captură expresie din imagine]] — **licență necomercială** |
| 3D din poză | [SMIRK](https://georgeretsi.github.io/smirk/) (CVPR 2024) | expresii subtile, extreme, asimetrice, prin randare neuronală | idem |
| Voce → față | [NVIDIA Audio2Face-3D](https://github.com/NVIDIA/Audio2Face-3D-Samples) (open-source 2025) | audio (+ emoție) → blendshapes ARKit, inclusiv limbă și ochi | avatar vorbitor, direct în [[Studio emoții]] |
| LLM de emoții | [Emotion-LLaMA](https://github.com/ZebangCheng/Emotion-LLaMA) (NeurIPS 2024), [EMO-LLaMA](https://arxiv.org/pdf/2408.11424), [FEALLM](https://arxiv.org/pdf/2505.13419) | recunoaștere + explicație în text (față, voce, text) | adnotator / al doilea evaluator; explicații |
| Date sintetice | [FaceSynthetics](https://microsoft.github.io/FaceSynthetics/) (Wood et al., ICCV 2021) | 100.000 de fețe randate; modele antrenate **doar** pe sintetic egalează datele reale | model pentru [[Fabrică de date sintetice etichetate]] |
| Benchmark | [ABAW 8](https://openaccess.thecvf.com/content/CVPR2025W/ABAW/papers/Kollias_Advancements_in_Affective_and_Behavior_Analysis_The_8th_ABAW_Workshop_CVPRW_2025_paper.pdf) (CVPR 2025) | valență/arousal, 8 expresii, 12 AU, 7 emoții compuse | ținte pentru [[Harta emoțiilor]] → [[Aff-Wild2 și ABAW]] |

## Ce ne diferențiază
Modelele de mai sus sunt „cutii negre” învățate. Neural Face e **anatomic și explicabil**: emoție → creier → nerv → mușchi → piele ([[Rețeaua neuromotorie]]). Lipsa noastră: nu avem încă nicio rețea antrenată.

## Atenționare
Expresia facială nu dovedește emoția trăită (Barrett et al. 2019) → [[Expresie facială vs emoție]]. Modelul descrie expresii, nu stări interioare.

MOC: [[MOC Cercetare]] · [[MOC Date și Modele]]
