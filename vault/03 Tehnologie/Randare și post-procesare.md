---
type: tehnologie
status: activ
tags:
  - tehnologie
  - randare
  - shadere
created: 2026-09-15
updated: 2026-09-15
related:
  - "[[Bloom]]"
  - "[[Rețeaua neuronală facială]]"
---

# Randare și post-procesare

Fișiere: `js/stage.js`, `js/head.js`, `js/networkView.js`.

## Scenă
- Tone mapping **ACES Filmic**, expunere 1,05; umbre PCF soft (hartă 2048²).
- Mediu: `RoomEnvironment` prin PMREM, intensitate 0,22.
- Lumini: cheie caldă (2,5) · umplere rece (0,55) · contur cyan (4,2) · contur magenta (0,7).
- Fundal: gradient radial pe canvas; 900 de particule de praf animate.

## Piele
`MeshPhysicalMaterial` cu hartă de culoare, normal map, harta speculară folosită ca rugozitate inversată (shader modificat), sheen cald și clearcoat subtil. Dizolvare de sus în jos la intro, cu margine luminoasă. La opacitate redusă se estompează și luciul (specular, sheen, clearcoat), altfel pielea pare opacă.

## Holografic
Shell Fresnel aditiv + un pas care scrie doar adâncimea, ca să ascundă globii oculari și cavitatea gurii din interiorul scanului. Wireframe-ul folosește aceeași geometrie, deci se deformează cu [[Avatar Rig]].

## Rețea
Shadere proprii:
- **Noduri** — disc cu halo și sclipire.
- **Sinapse** — impulsuri care circulă pe ≈30% dintre muchii.
- **Evidențiere** — nodul inspectat și vecinii lui.
- **Tranziții** — între culori pe strat sau pe regiune.

## Post-procesare
`RenderPass` (MSAA 4×) → [[Bloom]] (UnrealBloom 0,7 / 0,5 / prag 0,88) → `OutputPass` → pas final: aberație cromatică discretă, vignetă, grain de film.

MOC: [[MOC Tehnologie]]
