---
type: incident
status: rezolvat
tags:
  - incident
  - bug
created: 2026-09-15
updated: 2026-09-15
related:
  - "[[Registru incidente]]"
---

# INC-003 Server oprit din lipsă de memorie

## Simptom
Pagina nu se mai încărca; sarcina de fundal a serverului apărea ca „stopped because the system is running low on memory” (de două ori).

## Cauză
Serverul rula ca sarcină de fundal a sesiunii de lucru, iar acele sarcini sunt oprite sub presiune de memorie. Tracking-ul facial cu MediaPipe în browser consumă multă memorie.

## Rezolvare
Serverul pornit ca proces separat (`nohup … & disown`), neatașat sesiunii. Memorie liberă măsurată ulterior: ~46%.

## Recomandări
- Oprește modul cameră (**Scan 3D**) când nu testezi.
- Închide taburile și aplicațiile inutile.
- Dacă pagina nu răspunde: dublu-click pe `start.command`.

Legat de: [[Registru incidente]] · [[MOC Proiect]]
