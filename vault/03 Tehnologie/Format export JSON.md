---
type: tehnologie
status: activ
tags:
  - tehnologie
  - date
  - export
created: 2026-09-15
updated: 2026-09-15
related:
  - "[[Schema datelor de sesiune]]"
---

# Format export JSON

Butonul „Exportă topologia (.json)” din aplicație.

## Mod Scan 3D — `neural-face-topology-seed1337.json`
```json
{
  "meta": { "name": "neural-face-topology", "version": 1, "seed": 1337, "units": "model",
            "axes": { "up": "+Y", "forward": "+Z", "left": "+X" }, "nodeCount": 1517, "edgeCount": 4792 },
  "layers": ["surface", "deep", "core"],
  "regions": ["forehead", "eye_l", "eye_r", "nose", "mouth", "cheek_l", "cheek_r", "jaw", "ear", "cranium", "neck"],
  "nodes": [{ "id": 0, "layer": "surface", "region": "cranium", "position": [x, y, z], "normal": [nx, ny, nz] }],
  "edges": [[a, b]]
}
```
Pozițiile sunt rotunjite la 4 zecimale, în unitățile modelului.

## Mod Cameră live — `neural-face-live-<timestamp>.json`
Același conținut + secțiunea `live`:
```json
"live": { "capturedAt": "ISO-8601", "mirror": true,
          "pose": { "yaw": 0, "pitch": 0, "roll": 0 },
          "blendshapes": { "jawOpen": 0.12 },
          "positions": [[x, y, z]] }
```
`live.positions` conține pozițiile **deformate** ale nodurilor la momentul exportului; `nodes[].position` rămâne poziția de repaus.

## Limite
Un export = un cadru. Pentru analiză în timp: [[Schema datelor de sesiune]].

Legat de: [[Rețeaua neuronală facială]] · [[ADR-003 Rețea deterministă cu seed]] · MOC: [[MOC Tehnologie]] · [[MOC Date și Modele]]
