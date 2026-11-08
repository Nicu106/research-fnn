---
type: experiment
status: făcut
tags:
  - experiment
  - nlp
  - emotii
created: 2026-10-20
updated: 2026-10-20
related:
  - "[[Rețeaua text → emoție (affect-stream)]]"
---

# EXP-004 Rețeaua text → emoție

## Ipoteză
O rețea mică, cu context înainte și după fiecare cuvânt și cu stare integrată, extrage emoția din text mai bine decât un lexicon, inclusiv pe forme de cuvinte nevăzute și pe fraze naturale.

## Rezultate (acuratețe pe propoziții, %)
| Model | Forme văzute | Forme nevăzute | Verbe ambigue | Fraze naturale (set B) |
|---|---|---|---|---|
| Lexicon (fără context) | 67,1 | 45,7 | – | 47,5 |
| Fără memoria propozițiilor | 98,6 | 87,7 | 97,8 | – |
| Fără cuvintele următoare | 97,6 | 87,2 | 41,6 | – |
| Fără integrator | 98,0 | 87,1 | 94,5 | – |
| **Rețeaua completă** | **98,6** | **88,8** | **97,5** | **80,0** |

- **Set A** (40 de fraze, folosit la dezvoltare): rețea 35/40, lexicon 28/40.
- **Set B** (40 de fraze scrise înainte de antrenarea finală, nemodificate): rețea **32/40**, lexicon 19/40.
- **Prima versiune**, înainte de a lărgi generatorul: 28/40 pe setul A, la fel ca lexiconul. Greșea când după emoție mai urmau cuvinte („sunt supărat pe tine”) și când subiectul stătea înaintea verbului.
- **Cuvintele următoare** contează cel mai mult: verbele ambigue urcă de la 41,6% la 97,5%.
- **Integratorul** ajută pe formele nevăzute și face starea stabilă: 0,161 schimbări pe cuvânt, față de 0,157 la profesor.
- **Memoria propozițiilor anterioare** aduce doar +1,1 puncte pe acest corpus; trecutul e purtat deja de integrator.

## Limite
- Corpus sintetic: rețeaua învață regulile profesorului.
- Set natural mic, etichetat de autor.

**Următorul pas:** un corpus românesc adnotat de oameni.

Detalii: `ml/textnet/results.json`, `handset.log`.
