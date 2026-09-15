---
type: proiect
status: activ
tags:
  - proiect
  - viziune
created: 2026-09-15
updated: 2026-09-15
related:
  - "[[Arhitectură]]"
  - "[[MOC Roadmap]]"
---

# Viziune

## Pe scurt
Un sistem care **măsoară precis mișcarea feței** și folosește aceleași măsurători pentru două ieșiri:
1. **Avatar** — un personaj fotorealist care copiază fidel mișcările și expresiile unei persoane ([[Avatar Rig]]).
2. **Insight** — metrici obiective utile în medicină și alte domenii ([[MOC Domenii de aplicare]]).

## Formularea corectă
Nu construim un model care „simte” sau „citește” emoții. Construim **analiză a comportamentului facial**: [[Action Unit|Action Units]], simetrie, amplitudine, viteză, frecvență — raportate la [[Calibrare neutră|baseline-ul]] fiecărei persoane. Motivul științific: [[Expresie facială vs emoție]]. Motivul legal: [[EU AI Act]].

## Primul pas recomandat
Analiza simetriei și mobilității faciale pentru **recuperarea după paralizie facială** ([[Paralizie facială]]): măsurabil, comparabil cu scale clinice, risc etic scăzut, construit direct pe ce avem ([[Scor de simetrie facială live]]).

## Principii
- **Local-first**: procesarea rulează pe dispozitiv ([[Procesare pe dispozitiv]]).
- **Date, nu video** ([[ADR-007 Serii de trăsături în loc de video]]).
- **Validare înainte de afirmații** (vezi [[Zone de evitat]]).
- **Documentăm tot**, inclusiv ce pare imposibil ([[MOC Idei]]).

MOC: [[MOC Proiect]]
