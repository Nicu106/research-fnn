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
js/live/          camera: tracker MediaPipe, rig, ochi și dentiție, grupuri de landmark-uri
js/emotion/       studio: mușchii (faceBasis), emoții și „viață” (emotions), captură din imagine,
                  bibliotecă, panoul (studio)
js/neuro/         rețeaua neuromotorie (date + randare)
js/taxonomy/      harta emoțiilor: taxonomia (data), rețete FACS (facs), graful interactiv (mapView)
js/brain/         atlasul creierului emoțional, cu surse (datele articolului)
blog/             articolul „Atlasul emoțiilor”, generat de tools/build-blog.mjs
tools/            verificări node și unelte de dezvoltare pentru browser
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

## Studio emoții

Al doilea tab (sus, „Studio emoții”). Fața scanată exprimă emoții generate din anatomie, nu din imagini: fiecare dintre cei **52 de mușchi** (blendshape-urile MediaPipe / ARKit, pe unitățile de acțiune FACS) e descris în `js/emotion/faceBasis.js` ca deplasare a pielii, în milimetri, pe acest cap anume. O emoție e o combinație de mușchi; o fotografie e analizată în aceiași mușchi; o expresie salvată e lista lor.

- **Emoții:** Neutru, Tristețe (în trei adâncimi: Melancolie · Tristețe · Durere), Bucurie, Surpriză, Frică, Furie, Dezgust, Dispreț. Sub față apar mușchii activi (ex. AU1 · sprâncene ridicate la interior) și calea semnalului.
- **Tristețea** e construită pe semnele pe care le citesc oamenii: sprânceana oblică (AU1, capetele interioare ridicate), pleoape grele cu partea exterioară coborâtă, privirea în jos, colțurile gurii trase în jos fără ca mijlocul buzelor să se curbeze (AU15), bărbia împinsă în sus (AU17). Durerea adaugă ochi strânși de plâns, roșeață în jurul ochilor și luciu pe pleoapa de jos.
- **Naturalețe:** nicio față reală nu e simetrică și niciuna nu stă nemișcată — fiecare expresie are asimetrii mici, iar fața clipește, respiră, face sacade cu privirea și mișcări fine (sliderul „Viață”). Ridurile apar doar cu mușchiul care le produce: fruntea centrală (AU1), între sprâncene (AU4), laba gâștei (AU6), șanțul nazolabial, bărbia „coajă de portocală” (AU17).
- **Scenariu în timp:** o emoție care se desfășoară, nu o poză. „Vestea: a murit fratele” — cineva spune fraza, fața trece prin etape (ascultă → șoc: sprâncene sus, ochi deschiși, clipitul și respirația se opresc o clipă → neîncredere, cu o mică scuturare a capului → tristețe care se adâncește, ochii se umezesc → compasiune: privirea revine la celălalt, capul se înclină spre el), apoi răspunde „Îmi pare rău” cu buzele sincronizate pe litere (viseme românești) și, opțional, cu voce sintetică (Web Speech, vocea „Ioana” pe macOS). Ambele replici se pot edita. Linia de timp de jos: redă/pauză (Space), de la început, 0.5×/1×, și trage pe ea ca să vezi orice moment (fața e recalculată exact, aceleași clipiri). Scenariile sunt date în `js/emotion/timeline.js` (`SCENARIOS`).
- **Din text (rețeaua neuronală):** o rețea proprie, mică (≈177 mii de parametri, ~1 ms pe frază în browser), citește fraza cuvânt cu cuvânt și dă o stare emoțională pentru fiecare cuvânt: n-grame de caractere (merge și pe forme flexionate și fără diacritice) → GRU → segmentare în propoziții → memoria propozițiilor anterioare + următoarele 2 cuvinte (corecție) → integrator, ca emoția să evolueze consecvent, nu să sară. Culorile de sub „Celălalt spune” arată ce citește la fiecare cuvânt; scenariul „Din text” își construiește singur linia de timp din această traiectorie (ascultă → șoc → tristețe → compasiune → răspuns), iar „Fața reacționează live” face fața să urmeze textul în timp ce scrii. Antrenare: `ml/textnet/` (PyTorch, corpus românesc generat și etichetat de un „profesor” cu reguli de evaluare cognitivă); forward-ul e rescris în `js/emotion/textNet.js`.
- **Lucrează pe față:** intensitate, multiplicatori pe grupe (sprâncene, ochi, gură, bărbie, cap), asimetrie, viață, și în „Avansat” fiecare mușchi separat.
- **Din imagine:** trage o fotografie, apasă sau lipește (⌘V). Fața e analizată local (MediaPipe, modul imagine) — imaginea nu pleacă nicăieri. Se păstrează doar expresia (mușchii, poziția capului, privirea), nu forma feței persoanei, deci se aplică pe cap fără să-l deformeze. „Folosește ca față neutră” setează o fotografie relaxată a aceleiași persoane ca referință: capturile următoare măsoară doar schimbarea față de fața ei.
- **Salvare:** expresiile se păstrează în browser (localStorage), cu miniatură; „Exportă .json” / „Importă” le mută între calculatoare. „Exportă topologia” din acest tab include expresia, pozițiile nodurilor și activarea lor.

## Rețeaua neuromotorie (7 niveluri)

`js/neuro/neuromotor.js` — calea pe care o emoție ajunge la piele:

```
emoții (7) → sistem limbic (amigdale, cortex cingular) → cortex motor facial (stâng/drept)
→ nuclei în trunchiul cerebral (VII superior/inferior, III, V motor)
→ nervi (5 ramuri ale nervului VII: temporală, zigomatică, bucală, marginală a mandibulei, cervicală; III; V3)
→ 38 de mușchi mimici → piele (rețeaua de suprafață)
```

Anatomia se vede în felul în care curge semnalul: partea de sus a feței primește semnal din **ambele** emisfere, cea de jos doar din emisfera **opusă** (de aceea un AVC cortical cruță fruntea); pleoapa superioară e ridicată de nervul III, nu de VII; maxilarul de V3. O cale se aprinde doar când ambele capete sunt active: tristețea aprinde ramura temporală (spre frontal) și cea mandibulară (spre coborâtorul unghiului gurii și mentonier), bucuria ramura zigomatică. Se vede în modurile Hibrid și Rețea; funcționează și cu camera live. Nodurile de suprafață se aprind proporțional cu cât s-a mișcat pielea de sub ele.

## Harta emoțiilor

Al treilea tab: tot spectrul afectiv ca graf interactiv — **93 de noduri** (10 familii, 53 de emoții, 29 de nuanțe și stări) și 43 de legături — ca să vezi ce poate modelul, ce abilități îi lipsesc și cum să faci datele. Datele sunt în `js/taxonomy/data.js`, cu sursele în antet: arborele lui Parrott, emoțiile de bază Ekman, emoțiile sociale Tracy & Robins, rețetele FACS (EMFACS; Du, Tao & Martinez 2014 pentru emoțiile compuse; PSPI pentru durere), intensitățile și diadele lui Plutchik, cercul valență–activare al lui Russell.

- **Trei aranjamente:** arbore radial (familie → emoție → nuanță), valență · activare (plăcut/neplăcut × energie) și rețea (emoțiile compuse și confuziile trag nodurile unul spre altul). Zoom, tragere, căutare fără diacritice.
- **Inelul fiecărui nod** spune ce poate modelul: verde = gata (preset reglat), cyan = compozabilă din cei 52 de mușchi, galben = parțială (lipsesc abilități), roz = nu se vede pe față. Legenda filtrează.
- **Abilități de adăugat**, ordonate după câte emoții ar debloca; un clic le evidențiază pe hartă și spune cum s-ar adăuga.
- **Liniile:** galbene = aceeași emoție la altă intensitate, punctate = emoții compuse, **roșii = se confundă pe față** — perechile care cer instrucțiuni clare pentru adnotatori și mai multe exemple.
- **Detaliile unui nod:** definiție, valență și activare, rețeta FACS explicată mușchi cu mușchi, abilitățile necesare, semne, seturi de date reale care o acoperă, eticheta ierarhică. **„Arată pe față”** (sau dublu-clic) o trimite în Studio: presetul reglat dacă există, altfel expresia compusă automat din rețeta FACS (`js/taxonomy/facs.js`).
- **Exporturi:** taxonomia completă (`.json`, cu schema de etichetare) și un șablon de etichetare (`.csv`, 42 de coloane: etichetă ierarhică, intensitate, valență/activare, intensitatea fiecărei AU, cap, privire, lacrimi, roșeață, context, adnotator).

## Creierul emoțional

Al patrulea tab e un articol de citit, doar text: **„Atlasul emoțiilor”**. Explică cum produce creierul o emoție și cum ajunge ea pe față (25 de structuri, patru scenarii cu timpi, teorii, mituri corectate, neurochimie), apoi toate cele 92 de emoții și stări cu mușchii lor, tabelul mușchilor feței, ce îi lipsește modelului și cum se fac și se clasifică datele. Fiecare afirmație are sursa ei (22 de surse verificate, cu linkuri); timpii marcați cu „≈” sunt estimări.

Pagina e `blog/index.html` (se deschide și singură, la `http://localhost:5173/blog/`) și e generată din aceleași date ca restul aplicației (`js/brain/atlas.js`, `js/taxonomy/data.js`, `js/taxonomy/facs.js`), deci rămâne sincronizată:

```bash
node tools/build-blog.mjs
```

Rețeaua neuromotorie din primul tab folosește aceleași coordonate anatomice (MNI) pentru amigdală, cortex și nuclei.

## Verificări

```bash
node tools/check-basis.mjs        # cei 52 de mușchi: simetrie, localitate, buzele nu se intersectează
node tools/check-neuromotor.mjs   # rețeaua: niveluri, simetrie, cablaj anatomic, căile tristeții/bucuriei
node tools/check-taxonomy.mjs     # harta: structură, legături, rețete FACS valide, abilități, seturi de date
node tools/check-brain.mjs        # creierul: surse citate, căi, scenarii, fiecare structură în interiorul craniului
node tools/check-scene.mjs        # scenariul: etapele feței în ordine, buzele se mișcă la răspuns, derularea e deterministă
node tools/check-textnet.mjs      # rețeaua text → emoție: aceleași ieșiri ca PyTorch, negație, contrast, corecție, scenă din text
```

În browser (consolă), pentru dezvoltare: `await import('/tools/harness.js')` (randări comparative) și `await import('/tools/roundtrip.js')` — randează fața într-o emoție cunoscută și o citește înapoi prin MediaPipe, un model antrenat pe fețe reale, ca test obiectiv. La ultima rulare (cameră frontală, la nivelul ochilor), modelul a recunoscut corect Neutru, Melancolie, Tristețe, Bucurie, Surpriză și Furie; Durere e citită ca furie (confuzie frecventă și la sistemele comerciale), Frică drept tristețe, iar Dezgust și Dispreț nu sunt recunoscute. `mouthFrown` (AU15) aproape nu e raportat de MediaPipe nici pe fețe reale, deci colțurile gurii se verifică vizual.

## Taste

`1` / `2` / `3` comută straturile · `C` pornește/oprește camera · `Esc` deselectează nodul
