---
type: tehnologie
status: activ
tags:
  - tehnologie
  - retea
  - graf
created: 2026-09-15
updated: 2026-09-28
related:
  - "[[Avatar Rig]]"
  - "[[Format export JSON]]"
---

# Rețeaua neuronală facială

Graful de noduri și sinapse desenat pe capul scanat. **Vizualizare și suport de date**, nu o rețea neuronală antrenată.

## Straturi (seed 1337)
| Strat | Cheie | Noduri | Cum se generează |
|---|---|---|---|
| Suprafață | `surface` | 1.229 | [[Poisson disk sampling]] pe 110.000 de puncte candidate de pe mesh; ridicate 0,035 pe normală |
| Strat intern | `deep` | 238 | suprafața trasă 30% spre axa verticală a capului, Poisson cu raza 0,34 |
| Nucleu | `core` | 50 | suprafața trasă 64% spre axă, Poisson cu raza 0,5 |

Total ≈ **1.517 noduri** și ≈ **4.792 sinapse** (valorile afișate în aplicație).

## Densitate
- Raza pe suprafață variază între 0,27 (spate/lateral) și 0,135 (față).
- Încă −30% în jurul ochilor, nasului și gurii.
- Punctele sub gât (y < −2,35) sunt excluse.

## Sinapse ([[kNN]])
| Legătură | k | Distanță maximă |
|---|---|---|
| suprafață ↔ suprafață | 5 | 0,46 |
| intern ↔ intern | 4 | 0,8 |
| nucleu ↔ nucleu | 4 | 1,15 |
| intern → suprafață | 3 | 1,3 |
| nucleu → intern | 3 | 1,6 |

## Regiuni
11 definite (frunte, ochi stâng/drept, nas, gură, obraz stâng/drept, maxilar, urechi, craniu, gât); 10 folosite. Clasificare după poziție în coordonatele modelului (+Y sus, +Z în afara feței, +X stânga subiectului). Nodurile interne preiau regiunea punctului de suprafață din care provin.

## Comportament live
Cu camera pornită, pozițiile nodurilor sunt deformate de [[Avatar Rig]] și trimise la GPU prin `NetworkView.updatePositions()`.

## Activare (2026-09-28)
Nodurile se aprind după activarea mușchilor (`setActivation`, atributul `aAct`) din [[Rețeaua neuromotorie]], atât din studio cât și din cameră.

## Idei
[[Rețeaua ca hartă de activare pe regiuni]]

Decizie: [[ADR-003 Rețea deterministă cu seed]] · Export: [[Format export JSON]] · MOC: [[MOC Tehnologie]]
