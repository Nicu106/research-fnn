# Neural Face

Prezentare 3D: un cap scanat fotorealist acoperit de o rețea neuronală facială pe 3 straturi
(~1.500 de noduri, ~4.800 de sinapse), cu inspecție pe fiecare nod și export al topologiei.

## Pornire (fără instalări)

Dublu-click pe `start.command`, sau în terminal:

```bash
python3 serve.py 5173
# apoi deschide http://localhost:5173
```

Nu există `node_modules` și nici pas de build: Three.js se încarcă de pe CDN (jsDelivr).
E nevoie de internet la prima deschidere.

## Stack

| Parte | Alegere | De ce |
|---|---|---|
| Randare 3D | Three.js r170 (ES modules, CDN) | standardul WebGL, suportă shadere custom și post-procesare |
| Aplicație | JavaScript modular, fără build | zero spațiu pe disc, se poate trece oricând la Vite/TypeScript |
| Model | scan „Lee Perry-Smith” (Infinite-Realities, CC BY 3.0) | cap fotorealist cu texturi color, normal și specular |
| Analiză (etapa 2) | Python (numpy / scipy / networkx) pe JSON-ul exportat | testele pe puncte se fac separat de interfață |

## Structură

```
index.html        HUD + importmap
css/style.css     design
js/main.js        orchestrare: intro, picking, buclă de randare
js/stage.js       renderer, lumini, cameră, bloom + grain/vignette
js/head.js        cap scanat: material de piele, dizolvare la intro, shell holografic
js/network.js     topologia (date pure, deterministă după seed)
js/networkView.js shadere pentru noduri, sinapse și impulsuri
js/hud.js         panou, statistici, inspector
assets/head/      modelul și texturile
```

## Topologia

- **Straturi:** `surface` (pe piele, mai dens pe ochi, nas și gură), `deep`, `core`.
- **Regiuni:** frunte, ochi, nas, gură, obraji, maxilar, urechi, craniu, gât.
- **Determinism:** același `seed` dă mereu aceleași ID-uri, poziții și muchii, deci testele se pot referi la `N-0630` între rulări.
- **Coordonate:** unități ale modelului; +Y în sus, +Z în afara feței, +X = stânga subiectului.
- **Export:** butonul „Exportă topologia” descarcă `nodes[]` (id, layer, region, position, normal) și `edges[]`.
- **Consola browserului:** `neuralFace.net` conține datele, iar `neuralFace.view.setActive(id)` evidențiază un nod.

## Cameră live

În panou alegi **Sursă → Cameră live** (sau apeși tasta `C`) și permiți accesul la cameră. De acolo totul merge automat: **fața fotorealistă scanată îți copiază mișcările**. Capul se rotește ca al tău, iar gura, obrajii și sprâncenele urmează expresiile tale. Rețeaua neuronală se deformează odată cu pielea.

- **Model:** MediaPipe Face Landmarker, încărcat de pe CDN (fără instalare). Rulează local în browser, iar imaginea nu pleacă nicăieri.
- **Parametri, la fiecare cadru:** 478 de puncte 3D, 52 de expresii (blendshapes) și poza capului (yaw / pitch / roll).
- **Calibrare:** în prima secundă privește camera cu fața relaxată. Butonul „Recalibrare” (sau tasta `N`) o reia.
- **Cum funcționează:** `assets/head/anchors.json` conține cele 478 de puncte MediaPipe proiectate pe scan. La fiecare cadru, poza e separată de expresie, iar diferența față de fața ta neutră e transferată pe vârfurile pielii din jur. Capul se rotește din gât, iar umerii rămân pe loc.
- **Mod oglindă:** activ implicit; poate fi oprit din panou.
- **Export:** în acest mod, „Exportă topologia” adaugă secțiunea `live` cu pozițiile deformate ale nodurilor, expresiile și poza.
- **Previzualizare:** opțiunea „Previzualizare cameră” arată imaginea brută. E oprită implicit.
- **Ochi și gură:** scanul are ochii și gura închise; pleoapele și buzele sunt tăiate în shader, iar în spate stau globi oculari (cu privire urmărită din poziția irisului, calibrată pe privirea spre cameră, conjugată ca să nu se încrucișeze), dentiție procedurală (`js/live/teeth.js`), gingii și limbă (`js/live/faceParts.js`).

## Taste

`1` / `2` / `3` comută straturile · `C` pornește/oprește camera · `Esc` deselectează nodul
