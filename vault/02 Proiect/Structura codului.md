---
type: proiect
status: activ
tags:
  - proiect
  - cod
created: 2026-09-15
updated: 2026-09-28
related:
  - "[[Stack tehnologic]]"
  - "[[Arhitectură]]"
---

# Structura codului

Rădăcina proiectului: `neuronal network face/`

| Fișier | Rol |
|---|---|
| `index.html` | 4 tab-uri (Rețea, Studio emoții, Harta emoțiilor, Creierul emoțional) + HUD (panou, statistici, inspector, previzualizare cameră) + `importmap` pentru Three.js |
| `css/style.css` | designul: glassmorphism, tipografie Inter Tight / JetBrains Mono, responsive, teme |
| `js/main.js` | orchestrare: intro, picking de noduri, bucla de randare, pornire/oprire cameră, export |
| `js/stage.js` | renderer, lumini, cameră + OrbitControls, bloom și pasul final (grain, vignetă, aberație) → [[Randare și post-procesare]] |
| `js/head.js` | încărcarea capului scanat, materialul de piele, dizolvarea la intro, shell holografic, wireframe |
| `js/network.js` | topologia (date pure, deterministă după seed) → [[Rețeaua neuronală facială]] |
| `js/networkView.js` | shadere pentru noduri, sinapse, impulsuri; `updatePositions()` pentru deformare live |
| `js/hud.js` | legarea UI: segmente, toggle-uri, slider, inspector, parametri live, stări cameră |
| `js/live/faceTracker.js` | webcam + [[MediaPipe Face Landmarker]], cu timeout-uri și mesaje de eroare |
| `js/live/avatarRig.js` | [[Avatar Rig]]: deformarea capului și a rețelei din landmarks |
| `js/live/faceParts.js` | [[Ochi și gură (FaceParts)]]: globi oculari, dinți, limbă |
| `assets/head/` | `LeePerrySmith.glb`, texturi (color, normal, specular), `anchors.json` |
| `assets/head/anchors.json` | 478 landmarks MediaPipe proiectate pe scan ([[ADR-004 Ancore MediaPipe prin render și raycast]]) |
| `js/live/landmarkSets.js` | seturi de landmarks denumite (buze, colțuri, pleoape, perechi oglindă) |
| `js/emotion/faceBasis.js` | [[Baza de expresii (52 blendshapes)]] |
| `js/emotion/emotions.js` | presetări, `recognise()`, `Performer` → [[Studio emoții]] |
| `js/emotion/driver.js` | conversii studio → cadru de rig |
| `js/emotion/imageCapture.js`, `library.js` | [[Captură expresie din imagine]] |
| `js/emotion/studio.js` | UI-ul tab-ului Studio emoții |
| `js/neuro/neuromotor.js`, `neuromotorView.js` | [[Rețeaua neuromotorie]] |
| `js/taxonomy/data.js`, `facs.js`, `mapView.js` | [[Harta emoțiilor]] |
| `js/brain/atlas.js` | datele despre creier + `mniToModel` → [[Creierul emoțional (Atlasul emoțiilor)]] |
| `blog/index.html` | articolul generat (nu se editează manual) |
| `tools/build-blog.mjs` | generează articolul |
| `tools/check-*.mjs` | verificări: `node tools/check-basis.mjs` (și neuromotor, taxonomy, brain) |
| `tools/harness.js`, `roundtrip.js` | teste în browser → [[EXP-003 Validare round-trip MediaPipe]] |
| `serve.py` | server local fără cache |
| `start.command` | pornește `serve.py` și deschide browserul |
| `README.md` | instrucțiuni de pornire |
| `vault/` | acest vault |

## Unelte de consolă
`window.neuralFace` expune `net`, `view`, `stage`, `head`, `tracker`, `rig` și `step(t)` (randează un moment anume — util pentru teste, vezi [[EXP-001 Test sintetic al rig-ului]]).

MOC: [[MOC Proiect]] · [[MOC Tehnologie]]
