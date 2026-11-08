---
type: tehnologie
status: activ
tags:
  - tehnologie
  - emotii
  - timeline
created: 2026-10-04
updated: 2026-10-04
related:
  - "[[Studio emoții]]"
  - "[[Baza de expresii (52 blendshapes)]]"
---

# Scenarii în timp

Modulul `js/emotion/timeline.js` (`SCENARIOS`, `MOMENTS`, `ScenePlayer`, `visemesOf`), în [[Studio emoții]]. O emoție care se desfășoară în timp, nu o singură poză.

## Primul scenariu: „Vestea: a murit fratele”
| Timp | Etapă | Ce face fața |
|---|---|---|
| 0–2,3 s | Ascultă | atent, ochii pe celălalt; subtitrare „A murit fratele.” |
| 2,35 s | Șoc | sprâncene sus, ochi deschiși, maxilarul cade puțin; clipitul și respirația se opresc |
| 3,45 s | Neîncredere | sprâncene interioare sus + încruntare, buze presate, scuturare a capului |
| 5,0 s | Tristețe | colțuri în jos, bărbie sus, privirea coboară, clipit lent |
| 6,7 s | Tristețe adâncă | ochi umezi, roșeață |
| 8,4 s | Compasiune | privirea revine, capul se înclină spre celălalt |
| 9,1 s | Răspuns | „Îmi pare rău.” cu viseme românești, vorbit încet |
| 10,9 s | După | dat din cap încet, tristețea rămâne |

## Cum funcționează
- Fiecare **beat** setează doar ținta; tranziția o face Performer-ul (sprâncenele înaintea gurii).
- **Gesturi** (scuturare, dat din cap) adăugate peste poziția capului.
- **Viseme din text** (română ≈ fonetică): vocale deschise, labiale închise, sibilante întinse; adăugate peste emoție, relaxând mușchii care țin buzele lipite.
- **Voce** opțională: Web Speech API (vocea „Ioana”, ro-RO); timeline-ul așteaptă pornirea vocii ca buzele și sunetul să înceapă împreună.
- **Derulare deterministă**: `seek(t)` reia scena de la 0 cu pas fix → aceeași față ca la redare (verificat: diferență 0).
- Linia de timp: redă/pauză (Space), de la început, 0,5×/1×, drag pentru orice moment; replicile se editează în panou.

Verificare: `node tools/check-scene.mjs`. Bug găsit pe drum: [[INC-010 Gura nu se deschidea cu jawOpen]].

## De făcut
- [ ] Editor de beats (adaugă cadru din expresia curentă)
- [ ] Mai multe scenarii (vești bune, sperietură, ceartă)
- [ ] Text liber → LLM → scenariu ([[Avatar condus de voce și text]])

MOC: [[MOC Tehnologie]]
