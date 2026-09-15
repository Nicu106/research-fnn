---
type: moc
status: activ
tags:
  - home
  - neural-face
created: 2026-09-15
updated: 2026-09-15
---

# 🏠 Neural Face — vault de cercetare

**Neural Face** este un proiect care pornește de la o față 3D fotorealistă acoperită de o rețea neuronală facială (≈1.500 de noduri pe 3 straturi) și care, prin camera web, **copiază mișcările și expresiile unei persoane reale**. Direcția pe termen lung: aceleași măsurători faciale folosite pentru **avatare** și pentru **insight** în medicină și alte domenii (vezi [[Viziune]]).

> [!tip] Principiul vault-ului
> Documentăm **orice** — posibil sau „imposibil”. O idee „imposibilă” scrisă azi devine roadmap mâine.

## Hărți (MOC)
| Zonă | Hartă |
|---|---|
| Proiectul, arhitectura, deciziile | [[MOC Proiect]] |
| Tehnologia construită | [[MOC Tehnologie]] |
| Literatură științifică | [[MOC Cercetare]] |
| Unde se poate aplica | [[MOC Domenii de aplicare]] |
| Banca de idei | [[MOC Idei]] |
| Experimente | [[MOC Experimente]] |
| Seturi de date și modele | [[MOC Date și Modele]] |
| Etică și reglementare | [[MOC Etică și Reglementare]] |
| Etape | [[MOC Roadmap]] |

Hartă vizuală: `01 MOC/Harta proiectului.canvas`.

## Cum folosești vault-ul
1. **Captură rapidă** — orice gând merge în `00 Inbox` (fișierele noi ajung acolo automat). Nu-l formata.
2. **Triere** (zilnic sau săptămânal) — vezi [[00 Inbox/README|regulile de triere]]: fiecare notă devine idee, experiment, literatură, decizie etc. și se mută în folderul potrivit, folosind un template din `99 Templates`.
3. **Leagă** — orice notă are cel puțin un link către un MOC și, ideal, 3+ linkuri către note înrudite.
4. **Jurnal** — nota zilnică (`Jurnal/`) păstrează ce s-a făcut și unde s-a ajuns: [[2026-09-15]].

## Convenții
- **Frontmatter** pe fiecare notă: `type`, `status`, `tags`, `created`, `updated`, `related`. Valori `type`: moc · proiect · tehnologie · literatura · domeniu · idee · experiment · dataset · model · reglementare · glosar · roadmap · decizie · incident · jurnal · template.
- **Idei** au în plus `fezabilitate` (1–5) și `impact` (1–5).
- **Domenii** au în plus `dovezi` (1–5) și `risc` (scăzut · mediu · ridicat).
- **Denumiri**: decizii `ADR-00X …`, incidente `INC-00X …`, experimente `EXP-00X …`.
- **Fapte nesigure** se marchează explicit cu „de verificat”. Nu inventăm cifre, DOI-uri sau citate.
- **Termeni** noi se definesc atomic în `10 Glosar` (ex. [[Landmark]], [[Blendshape]], [[Action Unit]]).

## Interogări viitoare
Frontmatter-ul consecvent permite, când vrei, pluginuri de tip Dataview sau Bases (ex. „toate ideile cu impact ≥ 4 și fezabilitate ≥ 3”). Vault-ul funcționează complet și fără ele.
