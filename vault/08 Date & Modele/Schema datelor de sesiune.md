---
type: model
status: propus
tags:
  - date
  - schema
created: 2026-09-15
updated: 2026-09-15
related:
  - "[[Format export JSON]]"
  - "[[Modele temporale]]"
---

# Schema datelor de sesiune (propunere v0)

Principiu: **trăsături, nu video** ([[ADR-007 Serii de trăsături în loc de video]]).

## Structură
```
session/
  meta.json         # participant pseudonimizat, consimțământ, dispozitiv, protocol, versiuni
  frames.parquet    # sau .csv/.jsonl pentru prototip — un rând pe cadru
  events.json       # marcaje: început/sfârșit exercițiu, instrucțiuni, calibrare
  derived.json      # metrici calculate (simetrie, clipiri/min, amplitudini)
```

## meta.json
```json
{
  "schema": "neural-face-session", "version": 0,
  "sessionId": "uuid", "participant": "P-0001",
  "consent": { "version": "2026-09", "scopes": ["research"], "signedAt": "ISO-8601" },
  "device": { "camera": "FaceTime HD", "resolution": [1280, 720], "fps": 30, "browser": "Chrome" },
  "software": { "app": "neural-face", "mediapipe": "0.10.14", "anchors": "v1" },
  "protocol": "facial-palsy-v0", "mirror": true, "startedAt": "ISO-8601"
}
```

## frames — coloane
| Coloană | Tip | Note |
|---|---|---|
| `t` | float (s) | timp de la începutul sesiunii |
| `face` | bool | față detectată |
| `yaw`, `pitch`, `roll` | float (°) | din [[Avatar Rig]] |
| `bs_<nume>` × 52 | float 0–1 | [[Blendshape\|blendshapes]] |
| `lm_<i>_x/y/z` × 478 | float | opțional (volum mare); forma fără poză, în cadrul de repaus |
| `quality` | float | încredere / lumină (de definit) |

## Estimare de volum
Doar blendshapes + poză la 30 fps: ≈ 58 de valori pe cadru, deci câteva MB pe oră necomprimat (de măsurat). Cu landmarks: ≈ 1.434 de valori în plus pe cadru → recomandat Parquet comprimat sau eșantionare redusă.

## Confidențialitate
Pseudonimizare; landmarks-urile pot fi totuși date biometrice ([[GDPR și date biometrice]]); stocare locală implicită ([[Procesare pe dispozitiv]]).

Legat de: [[Format export JSON]] · [[Înregistrare sesiuni ca serii de timp]] · MOC: [[MOC Date și Modele]]
