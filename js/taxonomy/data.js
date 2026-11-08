/*
 * The affective spectrum: emotions, sub-emotions and states, with what this model can do about
 * each of them and what data it would take to learn them.
 *
 * Sources for the structure and the facial recipes:
 *   - Hierarchy: Parrott (2001) primary -> secondary -> tertiary emotions, extended with Ekman's
 *     disgust and contempt, and the self-conscious emotions of Tracy & Robins (2004, 2007).
 *   - Facial recipes (FACS action units): Ekman & Friesen EMFACS prototypes for the basic
 *     emotions; Du, Tao & Martinez (2014, PNAS) for compound expressions (happily surprised,
 *     appalled, hatred, awed, ...); Prkachin & Solomon PSPI for pain; Keltner (1995) for
 *     embarrassment; Tracy & Robins for pride and shame; Grafsgaard et al. for confusion.
 *   - Intensity chains and dyads: Plutchik's wheel (serenity -> joy -> ecstasy, ...; contempt =
 *     anger + disgust, awe = fear + surprise, ...).
 *   - Valence / arousal: positions in Russell's circumplex, approximate (-1..1), for layout and
 *     as a starting point for dimensional labels — not measured norms.
 *   - Confusions: well-documented facial confusions (fear/surprise, anger/disgust, ...) plus the
 *     ones measured on this model with tools/roundtrip.js (grief/anger, fear/sadness).
 *
 * Every node:
 *   id, ro, en, level ('root' | 'family' | 'emotion' | 'sub'), parent, v, a
 *   facs     FACS recipe (see facs.js) or null when the face alone does not show it
 *   preset   key of a tuned preset in emotions.js, when one exists
 *   recog    how reliably it can be read from the face alone: 'ridicată' | 'medie' | 'scăzută'
 *   needs    abilities beyond facial muscles that it requires (ABILITIES keys)
 *   cues     what else gives it away
 *   def      one-line definition
 *   data     dataset keys that cover it
 */

export const ABILITIES = {
  // What the model already has.
  muscles: { ro: '52 de mușchi faciali (FACS)', have: true },
  head: { ro: 'Poziția capului', have: true },
  gaze: { ro: 'Privire și pleoape', have: true },
  life: { ro: 'Clipit, respirație, micro-mișcări', have: true },
  wrinkles: { ro: 'Riduri de expresie', have: true },
  periocular: { ro: 'Roșeață în jurul ochilor', have: true },
  wetEyes: { ro: 'Ochi umezi', have: true },
  // What it does not have yet.
  tears: { ro: 'Lacrimi (picături, dâre)', have: false, how: 'particule / hartă de umezeală pe obraz, legate de plâns și intensitate' },
  blush: { ro: 'Roșeață pe obraji și față', have: false, how: 'extinderea zonei de roșeață din shaderul pielii la obraji, frunte, gât' },
  pallor: { ro: 'Paloare', have: false, how: 'desaturarea pielii (vasoconstricție) la frică intensă și șoc' },
  pupils: { ro: 'Dilatarea pupilei', have: false, how: 'raza pupilei ca parametru în textura ochiului' },
  sweat: { ro: 'Transpirație', have: false, how: 'hartă de luciu pe frunte și buza de sus' },
  dynamics: { ro: 'Dinamică temporală (micro-expresii, tresărire)', have: false, how: 'secvențe cu durate reale: debut, apex, retragere; micro-expresii < 0,5 s' },
  breath: { ro: 'Respirație vizibilă (oftat, hiperventilație)', have: false, how: 'mișcarea nărilor și a pieptului, ritm legat de emoție' },
  posture: { ro: 'Postura corpului (umeri, trunchi)', have: false, how: 'schelet pentru umeri și trunchi (scanul are doar bustul, static)' },
  voice: { ro: 'Voce și sunete (râs, suspin)', have: false, how: 'canal audio separat; în afara feței' },
  context: { ro: 'Context și situație', have: false, how: 'nu se vede pe față: etichete din auto-raportare sau descrierea situației' },
};

export const DATASETS = {
  ckplus: { name: 'CK+ (Extended Cohn-Kanade)', what: 'secvențe pozate, 7 emoții incl. dispreț, cod FACS complet' },
  affectnet: { name: 'AffectNet', what: '~1 milion de imagini din internet; 8 categorii + valență și activare continue' },
  rafdb: { name: 'RAF-DB', what: 'imagini spontane; 7 emoții de bază + 12 emoții compuse' },
  fer2013: { name: 'FER2013', what: '7 categorii, 48×48 alb-negru; mare, dar zgomotos' },
  kdef: { name: 'KDEF', what: '7 emoții pozate de 70 de actori, 5 unghiuri' },
  disfa: { name: 'DISFA', what: 'intensitatea a 12 AU (0–5), expresii spontane, video' },
  bp4d: { name: 'BP4D-Spontaneous', what: 'video 3D, AU codate, emoții induse' },
  emotionet: { name: 'EmotioNet', what: 'AU și emoții compuse, adnotare automată + manuală' },
  unbc: { name: 'UNBC-McMaster Shoulder Pain', what: 'durere spontană, scor PSPI din AU' },
  daisee: { name: 'DAiSEE', what: 'implicare, plictiseală, confuzie, frustrare (4 niveluri) la învățare' },
  drowsy: { name: 'UTA-RLDD / NTHU-DDD', what: 'somnolență la volan și în condiții reale' },
  goemotions: { name: 'GoEmotions (text)', what: '27 de emoții în text — pentru taxonomie, nu pentru fețe' },
  own: { name: 'Colectare proprie', what: 'nu există un set facial public solid: video + context + auto-raportare' },
};

const n = (id, ro, en, level, parent, v, a, facs, extra = {}) => ({
  id, ro, en, level, parent, v, a, facs,
  preset: null, recog: 'medie', needs: [], cues: '', def: '', data: [], ...extra,
});

export const NODES = [
  n('root', 'Spectrul afectiv', 'Affective spectrum', 'root', null, 0, 0, null, { def: 'Emoții (reacții scurte, cu cauză), stări și dispoziții de fond.' }),

  // ---------------------------------------------------------------- Bucurie
  n('joy', 'Bucurie', 'Joy', 'family', 'root', 0.8, 0.5, '6C+12D', { preset: 'joy', recog: 'ridicată', def: 'Plăcere față de ceva bun care se întâmplă.', data: ['ckplus', 'affectnet', 'rafdb', 'fer2013', 'kdef'] }),
  n('duchenne', 'Zâmbet autentic (Duchenne)', 'Felt smile', 'sub', 'joy', 0.8, 0.5, '6C+12D', { recog: 'medie', def: 'Zâmbet care implică ochii (AU6): laba gâștei, obraji ridicați.', cues: 'Diferența față de cel politicos e AU6 — cea mai importantă distincție de etichetat la bucurie.', data: ['disfa', 'bp4d'] }),
  n('socialsmile', 'Zâmbet politicos (social)', 'Social smile', 'sub', 'joy', 0.3, 0.2, '12C', { recog: 'medie', def: 'Colțurile gurii fără ochi (fără AU6); politețe, nu neapărat bucurie.', cues: 'Adesea simetric, debut și retragere rapide.', data: ['disfa', 'bp4d'] }),
  n('amusement', 'Amuzament', 'Amusement', 'emotion', 'joy', 0.8, 0.65, '6C+12D+25B+26B+53A', { recog: 'medie', needs: ['voice', 'dynamics'], cues: 'Râsul: sunet, capul pe spate, umerii se mișcă.', def: 'Ceva e amuzant.', data: ['bp4d', 'own'] }),
  n('delight', 'Încântare', 'Happily surprised', 'emotion', 'joy', 0.8, 0.75, '1B+2B+5A+12C+25B', { recog: 'medie', def: 'Bucurie și surpriză deodată (emoție compusă).', data: ['rafdb', 'emotionet'] }),
  n('ecstasy', 'Extaz', 'Ecstasy', 'emotion', 'joy', 0.95, 0.9, '6E+12E+25C+26C+53B', { recog: 'medie', needs: ['voice', 'dynamics'], def: 'Bucurie la intensitate maximă (Plutchik).', data: ['own'] }),
  n('contentment', 'Mulțumire', 'Contentment', 'emotion', 'joy', 0.7, -0.2, '6A+12B', { recog: 'medie', def: 'Liniștea de a avea ce îți trebuie.', data: ['affectnet'] }),
  n('serenity', 'Seninătate', 'Serenity', 'sub', 'contentment', 0.6, -0.55, '12A+43A', { recog: 'scăzută', needs: ['breath'], def: 'Bucurie la intensitate joasă, calmă (Plutchik).', data: ['own'] }),
  n('relief', 'Ușurare', 'Relief', 'emotion', 'joy', 0.6, -0.3, '12A+43B+54A', { recog: 'scăzută', needs: ['breath', 'dynamics'], cues: 'Expirul lung și relaxarea bruscă a feței, după tensiune.', def: 'O amenințare a trecut.', data: ['own'] }),
  n('enthusiasm', 'Entuziasm', 'Enthusiasm', 'emotion', 'joy', 0.8, 0.8, '1B+2B+5A+6B+12C+25B', { recog: 'medie', def: 'Bucurie orientată spre ceva ce urmează.', data: ['own'] }),
  n('hope', 'Speranță / optimism', 'Hope', 'emotion', 'joy', 0.5, 0.2, null, { recog: 'scăzută', needs: ['context'], def: 'Așteptarea a ceva bun (Plutchik: anticipare + bucurie).', data: ['goemotions', 'own'] }),
  n('gratitude', 'Recunoștință', 'Gratitude', 'emotion', 'joy', 0.7, 0.1, null, { recog: 'scăzută', needs: ['context'], def: 'Bucurie față de binele făcut de altcineva.', data: ['goemotions', 'own'] }),

  // ---------------------------------------------------------------- Tristețe
  n('sadness', 'Tristețe', 'Sadness', 'family', 'root', -0.7, -0.35, '1D+4A+15C+17B+54A+64B', { preset: 'sad', recog: 'ridicată', def: 'Pierderea a ceva important.', cues: 'Sprânceana oblică (AU1+4) e semnul cel mai sigur; privirea în jos.', data: ['ckplus', 'affectnet', 'rafdb', 'fer2013', 'kdef'] }),
  n('melancholy', 'Melancolie', 'Melancholy', 'emotion', 'sadness', -0.5, -0.5, '1C+15B+17A+43A+64B', { preset: 'melancholy', recog: 'medie', def: 'Tristețe liniștită, îndelungată, reflexivă.', data: ['affectnet', 'own'] }),
  n('grief', 'Durere sufletească', 'Grief', 'emotion', 'sadness', -0.9, 0.3, '1E+4B+6B+7B+15D+17D+20A+54B+64C', { preset: 'grief', recog: 'medie', needs: ['tears', 'voice'], cues: 'Lacrimile și suspinul o deosebesc de furie; fără ele se confundă cu ea.', def: 'Tristețe profundă după o pierdere.', data: ['own'] }),
  n('crying', 'Plâns', 'Crying', 'sub', 'grief', -0.85, 0.5, '1E+4C+6C+7C+15D+17D+20B+25B', { recog: 'ridicată', needs: ['tears', 'voice', 'breath'], def: 'Plânsul propriu-zis: ochi strânși, gura întinsă, bărbia tremurând.', data: ['own'] }),
  n('disappointment', 'Dezamăgire', 'Disappointment', 'emotion', 'sadness', -0.6, -0.1, '1B+4B+15B+24B+64A', { recog: 'scăzută', def: 'O așteptare nu s-a împlinit (Plutchik: surpriză + tristețe).', data: ['affectnet', 'own'] }),
  n('loneliness', 'Singurătate', 'Loneliness', 'emotion', 'sadness', -0.6, -0.3, null, { recog: 'scăzută', needs: ['context'], def: 'Lipsa legăturii cu ceilalți.', data: ['goemotions', 'own'] }),
  n('despair', 'Disperare', 'Despair', 'emotion', 'sadness', -0.95, 0.3, '1E+4D+15D+17C+43B+54C', { recog: 'medie', needs: ['tears', 'posture'], def: 'Pierderea oricărei speranțe, cu agitație.', data: ['own'] }),
  n('resignation', 'Resemnare', 'Resignation', 'sub', 'despair', -0.7, -0.65, '15A+43B+54B+64B', { recog: 'scăzută', needs: ['posture', 'breath'], def: 'Disperare fără energie: renunțare.', data: ['own'] }),
  n('nostalgia', 'Nostalgie', 'Nostalgia', 'emotion', 'sadness', 0.0, -0.3, '1A+12A+64A', { recog: 'scăzută', needs: ['context'], def: 'Dulce-amar: bucurie și tristețe pentru ce a fost.', data: ['own'] }),

  // ---------------------------------------------------------------- Frică
  n('fear', 'Frică', 'Fear', 'family', 'root', -0.7, 0.75, '1C+2C+4B+5D+7B+20C+26B', { preset: 'fear', recog: 'medie', cues: 'Se confundă cu surpriza; diferența e AU4 și AU20.', def: 'Pericol iminent.', data: ['ckplus', 'affectnet', 'rafdb', 'kdef'] }),
  n('terror', 'Teroare', 'Terror', 'emotion', 'fear', -0.95, 0.95, '1E+2E+4C+5E+20E+26D', { recog: 'ridicată', needs: ['pallor', 'pupils'], def: 'Frică la maximum (Plutchik).', data: ['own'] }),
  n('panic', 'Panică', 'Panic', 'sub', 'terror', -0.9, 0.95, '1D+2C+4C+5E+20D+26C', { recog: 'medie', needs: ['breath', 'dynamics', 'pallor'], def: 'Teroare cu pierderea controlului: hiperventilație, privire agitată.', data: ['own'] }),
  n('anxiety', 'Anxietate', 'Anxiety', 'emotion', 'fear', -0.6, 0.5, '1B+4B+24A', { recog: 'scăzută', needs: ['dynamics', 'breath'], cues: 'Privirea se mută des, clipit rapid, mușcarea buzelor.', def: 'Frică difuză, de ceva ce ar putea urma.', data: ['own'] }),
  n('worry', 'Îngrijorare', 'Worry', 'sub', 'anxiety', -0.5, 0.3, '1B+4B+24B+64A', { recog: 'scăzută', def: 'Anxietate legată de un gând anume.', data: ['own'] }),
  n('nervousness', 'Nervozitate', 'Nervousness', 'sub', 'anxiety', -0.4, 0.55, '1A+4A+24B', { recog: 'scăzută', needs: ['dynamics'], def: 'Neliniște înainte de ceva (examen, scenă).', data: ['own'] }),
  n('apprehension', 'Neliniște', 'Apprehension', 'emotion', 'fear', -0.4, 0.35, '1A+2A+4A+5A', { recog: 'scăzută', def: 'Frică la intensitate joasă (Plutchik).', data: ['own'] }),
  n('startle', 'Tresărire', 'Startle', 'emotion', 'fear', -0.1, 0.9, '7C+20C+45E+53A', { recog: 'medie', needs: ['dynamics'], cues: 'Reflex: sub 0,3 s — nu se poate recunoaște dintr-o singură imagine.', def: 'Reflexul la un stimul brusc.', data: ['own'] }),
  n('fearsurprise', 'Surpriză înfricoșată', 'Fearfully surprised', 'sub', 'fear', -0.5, 0.85, '1D+2D+5D+20C+25C', { recog: 'medie', def: 'Emoție compusă (Du et al.).', data: ['rafdb', 'emotionet'] }),

  // ---------------------------------------------------------------- Furie
  n('anger', 'Furie', 'Anger', 'family', 'root', -0.7, 0.75, '4D+5C+7C+23C+24B', { preset: 'anger', recog: 'ridicată', def: 'O nedreptate sau un obstacol.', data: ['ckplus', 'affectnet', 'rafdb', 'fer2013', 'kdef'] }),
  n('rage', 'Furie oarbă', 'Rage', 'emotion', 'anger', -0.9, 0.95, '4E+5D+7D+9B+10C+16B+25C+26B', { recog: 'ridicată', needs: ['blush'], cues: 'Fața se înroșește, dinții dezveliți.', def: 'Furie la maximum (Plutchik).', data: ['own'] }),
  n('irritation', 'Iritare', 'Annoyance', 'emotion', 'anger', -0.4, 0.3, '4B+7A+24B', { recog: 'scăzută', def: 'Furie la intensitate joasă (Plutchik).', data: ['affectnet', 'own'] }),
  n('frustration', 'Frustrare', 'Frustration', 'emotion', 'anger', -0.6, 0.5, '4C+17B+24C', { recog: 'medie', needs: ['dynamics'], cues: 'Clătinatul capului, oftatul.', def: 'Un scop blocat.', data: ['daisee', 'own'] }),
  n('indignation', 'Indignare', 'Indignation', 'emotion', 'anger', -0.6, 0.6, '4C+5B+24B+53A', { recog: 'scăzută', needs: ['context'], def: 'Furie morală, față de o nedreptate.', data: ['own'] }),
  n('exasperation', 'Exasperare', 'Exasperation', 'sub', 'frustration', -0.5, 0.4, '4A+63C+24B', { recog: 'medie', needs: ['dynamics', 'breath'], cues: 'Datul ochilor peste cap, expirul.', def: 'Frustrare care a durat prea mult.', data: ['own'] }),
  n('hatred', 'Ură', 'Hatred', 'emotion', 'anger', -0.9, 0.5, '4C+7C+10C', { recog: 'medie', def: 'Furie + dezgust față de cineva (Du et al.: 4, 7, 10).', data: ['rafdb', 'emotionet'] }),
  n('resentment', 'Resentiment', 'Resentment', 'emotion', 'anger', -0.6, 0.2, null, { recog: 'scăzută', needs: ['context'], def: 'Furie veche, păstrată față de cineva.', data: ['goemotions', 'own'] }),

  // ---------------------------------------------------------------- Surpriză
  n('surprise', 'Surpriză', 'Surprise', 'family', 'root', 0.1, 0.8, '1D+2D+5B+26C', { preset: 'surprise', recog: 'ridicată', needs: ['dynamics'], cues: 'Durează doar o secundă; mai lungă, devine altceva.', def: 'Ceva neașteptat.', data: ['ckplus', 'affectnet', 'rafdb', 'fer2013', 'kdef'] }),
  n('amazement', 'Uimire', 'Amazement', 'emotion', 'surprise', 0.4, 0.85, '1E+2E+5C+26D+53A', { recog: 'medie', def: 'Surpriză la maximum (Plutchik).', data: ['own'] }),
  n('awe', 'Venerație / sublim', 'Awe', 'emotion', 'surprise', 0.5, 0.55, '1C+2C+5B+25B+26B+53A', { recog: 'medie', def: 'În fața a ceva vast (Du et al. „awed”: 1, 2, 5, 25; Plutchik: frică + surpriză).', data: ['emotionet', 'own'] }),
  n('shock', 'Șoc', 'Shock', 'emotion', 'surprise', -0.5, 0.85, '1D+2C+4A+5D+26D', { recog: 'medie', needs: ['pallor'], def: 'Surpriză neplăcută, paralizantă.', data: ['own'] }),
  n('bewilderment', 'Nedumerire', 'Bewilderment', 'emotion', 'surprise', -0.1, 0.4, '1B+2A+4B+55B', { recog: 'scăzută', def: 'Surpriză amestecată cu neînțelegere.', data: ['daisee', 'own'] }),

  // ---------------------------------------------------------------- Dezgust
  n('disgust', 'Dezgust', 'Disgust', 'family', 'root', -0.7, 0.35, '9D+10C+15B+17B', { preset: 'disgust', recog: 'ridicată', cues: 'Se confundă cu furia; încrețirea nasului (AU9) e cheia.', def: 'Respingerea a ceva contaminat sau respingător.', data: ['ckplus', 'affectnet', 'rafdb', 'fer2013', 'kdef'] }),
  n('revulsion', 'Scârbă', 'Revulsion', 'emotion', 'disgust', -0.85, 0.5, '9E+10D+16B+25B+43A+51B', { recog: 'ridicată', def: 'Dezgust visceral, cu întoarcerea capului.', data: ['own'] }),
  n('loathing', 'Silă', 'Loathing', 'sub', 'revulsion', -0.9, 0.4, '4B+9C+10C+51A', { recog: 'medie', def: 'Dezgust la maximum (Plutchik).', data: ['own'] }),
  n('distaste', 'Neplăcere', 'Distaste', 'emotion', 'disgust', -0.4, 0.1, '9A+10B', { recog: 'scăzută', def: 'Dezgust la intensitate joasă.', data: ['own'] }),
  n('appalled', 'Oroare', 'Appalled', 'emotion', 'disgust', -0.8, 0.6, '4C+9C+10C', { recog: 'medie', def: 'Dezgust + furie (Du et al.: 4, 9, 10).', data: ['rafdb', 'emotionet'] }),
  n('moraldisgust', 'Dezgust moral', 'Moral disgust', 'emotion', 'disgust', -0.6, 0.3, null, { recog: 'scăzută', needs: ['context'], def: 'Dezgust față de un comportament, nu față de ceva fizic.', data: ['goemotions', 'own'] }),

  // ---------------------------------------------------------------- Dispreț
  n('contempt', 'Dispreț', 'Contempt', 'family', 'root', -0.5, 0.1, 'R12A+R14C', { preset: 'contempt', recog: 'medie', cues: 'Singura emoție de bază unilaterală; se confundă cu un zâmbet.', def: 'Superioritate față de altcineva (Plutchik: furie + dezgust).', data: ['ckplus', 'affectnet'] }),
  n('disdain', 'Aroganță', 'Disdain', 'emotion', 'contempt', -0.5, 0.0, 'R14B+53B+64A', { recog: 'scăzută', def: 'Privit „de sus”: capul ridicat, privirea coborâtă spre celălalt.', data: ['own'] }),
  n('scorn', 'Batjocură', 'Scorn', 'emotion', 'contempt', -0.6, 0.3, 'R10C+R12A', { recog: 'medie', def: 'Rânjet unilateral (buza de sus ridicată pe o parte).', data: ['own'] }),
  n('sarcasm', 'Ironie / sarcasm', 'Sarcasm', 'emotion', 'contempt', -0.3, 0.3, 'R12B+R14B', { recog: 'scăzută', needs: ['voice', 'context', 'dynamics'], def: 'Dispreț îmbrăcat în umor.', data: ['own'] }),
  n('disapproval', 'Dezaprobare', 'Disapproval', 'emotion', 'contempt', -0.5, 0.2, '4B+14A+24B', { recog: 'scăzută', needs: ['context'], def: 'Plutchik: surpriză + tristețe.', data: ['own'] }),

  // ---------------------------------------------------------------- Iubire
  n('love', 'Iubire & afecțiune', 'Love', 'family', 'root', 0.8, 0.2, '6A+12B+55A', { recog: 'scăzută', needs: ['context'], cues: 'Nu are o expresie facială proprie; se vede în privire, apropiere, atingere.', def: 'Atașament și grijă față de cineva (Parrott: emoție primară).', data: ['goemotions', 'own'] }),
  n('tenderness', 'Tandrețe', 'Tenderness', 'emotion', 'love', 0.7, -0.2, '6A+12A+43A+55B', { recog: 'scăzută', def: 'Blândețe față de cineva vulnerabil.', data: ['own'] }),
  n('compassion', 'Compasiune', 'Compassion', 'emotion', 'love', 0.3, -0.1, '1B+4A+12A+55A', { recog: 'scăzută', cues: 'Sprâncene oblice ca la tristețe, dar cu privire caldă (Keltner).', def: 'Durerea altuia, cu dorința de a ajuta.', data: ['own'] }),
  n('admiration', 'Admirație', 'Admiration', 'emotion', 'love', 0.7, 0.4, '1A+2A+5A+12B', { recog: 'scăzută', needs: ['context'], def: 'Prețuirea calității cuiva.', data: ['goemotions', 'own'] }),
  n('trust', 'Încredere', 'Trust', 'emotion', 'love', 0.6, -0.1, null, { recog: 'scăzută', needs: ['context'], def: 'Siguranța față de celălalt (Plutchik: emoție primară).', data: ['own'] }),
  n('longing', 'Dor', 'Longing', 'emotion', 'love', 0.1, 0.1, '1B+12A+64A', { recog: 'scăzută', needs: ['context'], def: 'Lipsa cuiva drag, dulce-amar.', data: ['own'] }),
  n('attraction', 'Atracție', 'Attraction', 'emotion', 'love', 0.7, 0.6, '12A+55A', { recog: 'scăzută', needs: ['pupils', 'context', 'dynamics'], cues: 'Pupile dilatate, privire prelungită.', def: 'Interes romantic sau fizic.', data: ['own'] }),

  // ---------------------------------------------------------------- Sociale
  n('social', 'Emoții sociale', 'Self-conscious emotions', 'family', 'root', -0.2, 0.3, null, { recog: 'scăzută', needs: ['context'], def: 'Emoții despre sine în ochii altora (Tracy & Robins): cer o imagine despre sine.', data: ['own'] }),
  n('shame', 'Rușine', 'Shame', 'emotion', 'social', -0.7, 0.1, '15A+54C+64C', { recog: 'medie', needs: ['posture'], cues: 'Capul și privirea în jos, umerii strânși (Tracy & Robins).', def: 'Sentimentul că ești „rău” ca persoană.', data: ['own'] }),
  n('embarrassment', 'Jenă', 'Embarrassment', 'emotion', 'social', -0.4, 0.5, '12B+24B+51A+64B', { recog: 'medie', needs: ['blush', 'dynamics'], cues: 'Zâmbet controlat, privire în jos, capul întors, roșeață (Keltner).', def: 'O gafă în fața altora.', data: ['own'] }),
  n('guilt', 'Vinovăție', 'Guilt', 'emotion', 'social', -0.6, 0.2, null, { recog: 'scăzută', needs: ['context'], cues: 'Nu are o expresie proprie documentată.', def: 'Regretul pentru o faptă anume.', data: ['goemotions', 'own'] }),
  n('remorse', 'Remușcare', 'Remorse', 'sub', 'guilt', -0.7, 0.1, '1B+4B+15B+64B', { recog: 'scăzută', needs: ['context'], def: 'Plutchik: tristețe + dezgust (față de sine).', data: ['own'] }),
  n('pride', 'Mândrie', 'Pride', 'emotion', 'social', 0.7, 0.4, '12A+53C', { recog: 'medie', needs: ['posture'], cues: 'Zâmbet mic, capul pe spate ~20°, pieptul în față (Tracy & Robins).', def: 'O reușită proprie, recunoscută.', data: ['own'] }),
  n('shyness', 'Timiditate', 'Shyness', 'emotion', 'social', -0.2, 0.3, '12A+54A+64C', { recog: 'scăzută', needs: ['dynamics', 'blush'], def: 'Reținere în fața altora.', data: ['own'] }),
  n('humiliation', 'Umilință', 'Humiliation', 'emotion', 'social', -0.8, 0.5, '4B+15B+54C+64C', { recog: 'scăzută', needs: ['context', 'blush'], def: 'Rușine + furie, provocată de altcineva.', data: ['own'] }),
  n('envy', 'Invidie', 'Envy', 'emotion', 'social', -0.5, 0.4, null, { recog: 'scăzută', needs: ['context'], def: 'Vrei ce are altcineva.', data: ['goemotions', 'own'] }),
  n('jealousy', 'Gelozie', 'Jealousy', 'emotion', 'social', -0.6, 0.6, null, { recog: 'scăzută', needs: ['context'], def: 'Teama de a pierde pe cineva în favoarea altcuiva.', data: ['own'] }),

  // ---------------------------------------------------------------- Stări
  n('states', 'Stări (nu emoții)', 'States', 'family', 'root', 0, -0.2, null, { recog: 'medie', def: 'Stări cognitive, fizice și dispoziții de fond: nu au o cauză emoțională, dar se văd pe față.', data: ['daisee', 'drowsy', 'unbc'] }),
  n('cognitive', 'Stări cognitive', 'Cognitive states', 'emotion', 'states', 0.1, 0.2, null, { recog: 'medie', def: 'Ce face mintea: atenție, înțelegere, interes.', data: ['daisee'] }),
  n('concentration', 'Concentrare', 'Concentration', 'sub', 'cognitive', 0.1, 0.3, '4B+7B+24B', { recog: 'medie', cues: 'Privire fixă, clipit rar; se confundă cu furia ușoară.', def: 'Atenție susținută.', data: ['daisee'] }),
  n('confusion', 'Confuzie', 'Confusion', 'sub', 'cognitive', -0.3, 0.3, '4C+7B+55B', { recog: 'medie', cues: 'AU4 + AU7 și capul înclinat (Grafsgaard et al.).', def: 'Nu înțelegi încă.', data: ['daisee'] }),
  n('interest', 'Interes / curiozitate', 'Interest', 'sub', 'cognitive', 0.4, 0.45, '1B+2B+5A+25A', { recog: 'scăzută', needs: ['pupils'], def: 'Vrei să afli mai mult (Plutchik: anticipare).', data: ['daisee', 'own'] }),
  n('contemplation', 'Reflecție', 'Contemplation', 'sub', 'cognitive', 0.1, -0.3, '4A+17A+61B+64A', { recog: 'scăzută', def: 'Gândire liniștită, privirea „în gol”.', data: ['own'] }),
  n('skepticism', 'Scepticism / îndoială', 'Skepticism', 'sub', 'cognitive', -0.2, 0.2, 'R2C+R14A', { recog: 'scăzută', def: 'O sprânceană ridicată: nu ești convins.', data: ['own'] }),
  n('anticipation', 'Anticipare', 'Anticipation', 'sub', 'cognitive', 0.3, 0.45, '1A+5A+24A', { recog: 'scăzută', needs: ['context'], def: 'Aștepți ceva (Plutchik: emoție primară).', data: ['own'] }),
  n('boredom', 'Plictiseală', 'Boredom', 'sub', 'cognitive', -0.3, -0.7, '43B+54A+62B', { recog: 'medie', needs: ['dynamics', 'posture'], cues: 'Privire care rătăcește, capul sprijinit.', def: 'Lipsa stimulării.', data: ['daisee'] }),

  n('physical', 'Stări fizice', 'Physical states', 'emotion', 'states', -0.3, 0.1, null, { recog: 'ridicată', def: 'Ce simte corpul.', data: ['unbc', 'drowsy'] }),
  n('pain', 'Durere fizică', 'Pain', 'sub', 'physical', -0.8, 0.65, '4C+6C+7C+9B+10B+43B', { recog: 'ridicată', cues: 'Scorul PSPI = AU4 + max(AU6, AU7) + max(AU9, AU10) + AU43 (Prkachin & Solomon).', def: 'Durere corporală.', data: ['unbc'] }),
  n('fatigue', 'Oboseală', 'Fatigue', 'sub', 'physical', -0.3, -0.8, '43C+54A', { recog: 'medie', needs: ['dynamics'], cues: 'Clipit lent, căscat, capul care cade.', def: 'Lipsa energiei.', data: ['drowsy'] }),
  n('sleepiness', 'Somnolență', 'Sleepiness', 'sub', 'physical', -0.1, -0.9, '43D+54B', { recog: 'medie', needs: ['dynamics'], def: 'Aproape de adormire: pleoape care cad, clipit lung.', data: ['drowsy'] }),
  n('yawn', 'Căscat', 'Yawn', 'sub', 'physical', 0, -0.6, '6B+27E+43C+53A', { recog: 'ridicată', needs: ['dynamics', 'breath'], def: 'Acțiune reflexă, semn de oboseală sau plictiseală.', data: ['drowsy'] }),
  n('effort', 'Efort fizic', 'Effort', 'sub', 'physical', -0.2, 0.8, '4C+6B+7C+10B+23D', { recog: 'medie', needs: ['blush', 'sweat', 'breath'], def: 'Încordare: dinți strânși, față roșie.', data: ['own'] }),

  n('baseline', 'Dispoziții de fond', 'Moods', 'emotion', 'states', 0.1, -0.3, null, { recog: 'scăzută', needs: ['dynamics'], def: 'Stări lungi, fără cauză precisă: colorează toate emoțiile.', cues: 'Se văd în timp, nu într-o imagine.', data: ['own'] }),
  n('neutral', 'Neutru', 'Neutral', 'sub', 'baseline', 0, 0, '', { preset: 'neutral', recog: 'ridicată', def: 'Fața în repaus: referința pentru orice altă expresie.', data: ['ckplus', 'affectnet', 'fer2013', 'kdef'] }),
  n('calm', 'Calm / relaxare', 'Calm', 'sub', 'baseline', 0.4, -0.7, '43A', { recog: 'scăzută', needs: ['breath'], def: 'Liniște, fără tensiune.', data: ['own'] }),
  n('lowmood', 'Dispoziție apăsată', 'Low mood', 'sub', 'baseline', -0.5, -0.5, '1A+15A+43A', { recog: 'scăzută', needs: ['dynamics', 'context'], def: 'Tristețe de fond, fără un motiv anume.', data: ['own'] }),
  n('irritable', 'Dispoziție iritabilă', 'Irritable mood', 'sub', 'baseline', -0.4, 0.3, '4A+24A', { recog: 'scăzută', needs: ['dynamics', 'context'], def: 'Prag scăzut pentru furie.', data: ['own'] }),
  n('euphoria', 'Euforie', 'Euphoria', 'sub', 'baseline', 0.85, 0.7, '6B+12C+25A', { recog: 'scăzută', needs: ['dynamics'], def: 'Bucurie de fond, amplificată.', data: ['own'] }),
];

// Links beyond the hierarchy.
//   intensity  the same emotion at a higher intensity (Plutchik)
//   blend      compound emotions / dyads: the source is made of the target (plus another)
//   confusion  easily confused from the face alone: label with care, collect more examples
export const LINKS = [
  ['serenity', 'joy', 'intensity'], ['joy', 'ecstasy', 'intensity'],
  ['melancholy', 'sadness', 'intensity'], ['sadness', 'grief', 'intensity'],
  ['apprehension', 'fear', 'intensity'], ['fear', 'terror', 'intensity'],
  ['irritation', 'anger', 'intensity'], ['anger', 'rage', 'intensity'],
  ['surprise', 'amazement', 'intensity'],
  ['distaste', 'disgust', 'intensity'], ['disgust', 'loathing', 'intensity'],
  ['interest', 'anticipation', 'intensity'],

  ['delight', 'surprise', 'blend'], ['fearsurprise', 'surprise', 'blend'],
  ['hatred', 'disgust', 'blend'], ['appalled', 'anger', 'blend'],
  ['contempt', 'anger', 'blend'], ['contempt', 'disgust', 'blend'],
  ['awe', 'fear', 'blend'], ['disapproval', 'surprise', 'blend'], ['disapproval', 'sadness', 'blend'],
  ['remorse', 'sadness', 'blend'], ['remorse', 'disgust', 'blend'],
  ['hope', 'anticipation', 'blend'], ['love', 'joy', 'blend'], ['love', 'trust', 'blend'],
  ['humiliation', 'anger', 'blend'], ['humiliation', 'shame', 'blend'],
  ['nostalgia', 'joy', 'blend'], ['compassion', 'sadness', 'blend'],
  ['disappointment', 'surprise', 'blend'],

  ['fear', 'surprise', 'confusion'], ['disgust', 'anger', 'confusion'],
  ['grief', 'anger', 'confusion'], ['fear', 'sadness', 'confusion'],
  ['sadness', 'fatigue', 'confusion'], ['contempt', 'socialsmile', 'confusion'],
  ['embarrassment', 'amusement', 'confusion'], ['pain', 'disgust', 'confusion'],
  ['concentration', 'anger', 'confusion'], ['confusion', 'concentration', 'confusion'],
  ['boredom', 'fatigue', 'confusion'], ['duchenne', 'socialsmile', 'confusion'],
];

export const FAMILY_COLORS = {
  root: '#e9f5f9', joy: '#ffd166', sadness: '#6fa8ff', fear: '#b28dff', anger: '#ff5d5d', surprise: '#7ff0ff',
  disgust: '#7ddf64', contempt: '#ffa45c', love: '#ff8fc7', social: '#f0b3ff', states: '#9fb8c8',
};

/** The family a node belongs to (walks up the tree). */
export function familyOf(id, byId) {
  let node = byId[id];
  while (node && node.level !== 'family' && node.parent) node = byId[node.parent];
  return node?.level === 'family' ? node.id : 'root';
}

/**
 * What the model can do with a node:
 *   ready    a tuned preset exists
 *   compose  the face can show it from its FACS recipe with what the model already has
 *   partial  it has a facial recipe, but needs abilities the model lacks
 *   context  the face alone does not show it
 */
export function capability(node) {
  if (node.level === 'root') return 'root';
  if (node.preset) return 'ready';
  if (node.facs === null) return 'context';
  const missing = node.needs.filter((k) => !ABILITIES[k]?.have);
  return missing.length ? 'partial' : 'compose';
}

export const CAPABILITY = {
  ready: { ro: 'Gata (preset reglat)', color: '#7ff0cf' },
  compose: { ro: 'Compozabilă din mușchi', color: '#9ff3ff' },
  partial: { ro: 'Parțială: lipsesc abilități', color: '#ffd166' },
  context: { ro: 'Nu se vede pe față', color: '#ff8a9a' },
};
