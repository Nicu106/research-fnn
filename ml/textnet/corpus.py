"""
Synthetic Romanian corpus for the affect-stream network, annotated word by word.

Real Romanian text labelled per word with an evolving emotion does not exist, so the corpus is
generated: clauses are drawn from a hand-written lexicon (emotion adjectives, events, feeling
nouns, neutral fillers) and joined with the connectives that change how emotion flows
(", dar", ", apoi", " pentru că", "."). A rule-based appraisal teacher then walks the words and
writes, for every word, the affective state a listener would be in at that point:

  - an emotion word pulls the state toward its emotion, scaled by intensity modifiers
    ("foarte", "puțin") and flipped by negation in scope ("nu sunt fericit" -> sadness);
  - function words keep the state, with a slow decay toward neutral (consistency);
  - an unexpected strong event lands first as surprise (the shock) and then as its emotion;
  - a contrast ("dar", "însă") weakens what came before so the later clause dominates;
  - "!" amplifies the current state, "din păcate" / "din fericire" colour it.

The network is trained to reproduce these trajectories from the words alone. Some word forms are
held out of training to test whether it generalises across Romanian inflection (char n-grams).
"""

import json
import random
import unicodedata

EMOS = ['neutral', 'joy', 'sad', 'fear', 'anger', 'surprise', 'disgust', 'contempt']
E = {e: i for i, e in enumerate(EMOS)}

# ------------------------------------------------------------------------------------- lexicon
# Adjectives: (forms m.sg, f.sg, m.pl, f.pl), emotion, intensity. The masculine plural of each
# lemma is held out of training (tests inflection).
ADJ = [
    (['fericit', 'fericită', 'fericiți', 'fericite'], 'joy', 0.8),
    (['bucuros', 'bucuroasă', 'bucuroși', 'bucuroase'], 'joy', 0.75),
    (['vesel', 'veselă', 'veseli', 'vesele'], 'joy', 0.65),
    (['încântat', 'încântată', 'încântați', 'încântate'], 'joy', 0.8),
    (['mulțumit', 'mulțumită', 'mulțumiți', 'mulțumite'], 'joy', 0.5),
    (['entuziasmat', 'entuziasmată', 'entuziasmați', 'entuziasmate'], 'joy', 0.85),
    (['liniștit', 'liniștită', 'liniștiți', 'liniștite'], 'joy', 0.35),
    (['trist', 'tristă', 'triști', 'triste'], 'sad', 0.75),
    (['abătut', 'abătută', 'abătuți', 'abătute'], 'sad', 0.65),
    (['deprimat', 'deprimată', 'deprimați', 'deprimate'], 'sad', 0.8),
    (['îndurerat', 'îndurerată', 'îndurerați', 'îndurerate'], 'sad', 0.9),
    (['dezamăgit', 'dezamăgită', 'dezamăgiți', 'dezamăgite'], 'sad', 0.6),
    (['singur', 'singură', 'singuri', 'singure'], 'sad', 0.5),
    (['speriat', 'speriată', 'speriați', 'speriate'], 'fear', 0.75),
    (['îngrozit', 'îngrozită', 'îngroziți', 'îngrozite'], 'fear', 0.95),
    (['îngrijorat', 'îngrijorată', 'îngrijorați', 'îngrijorate'], 'fear', 0.5),
    (['neliniștit', 'neliniștită', 'neliniștiți', 'neliniștite'], 'fear', 0.45),
    (['panicat', 'panicată', 'panicați', 'panicate'], 'fear', 0.9),
    (['furios', 'furioasă', 'furioși', 'furioase'], 'anger', 0.85),
    (['supărat', 'supărată', 'supărați', 'supărate'], 'anger', 0.6),
    (['nervos', 'nervoasă', 'nervoși', 'nervoase'], 'anger', 0.6),
    (['revoltat', 'revoltată', 'revoltați', 'revoltate'], 'anger', 0.8),
    (['iritat', 'iritată', 'iritați', 'iritate'], 'anger', 0.45),
    (['surprins', 'surprinsă', 'surprinși', 'surprinse'], 'surprise', 0.65),
    (['uimit', 'uimită', 'uimiți', 'uimite'], 'surprise', 0.75),
    (['șocat', 'șocată', 'șocați', 'șocate'], 'surprise', 0.9),
    (['dezgustat', 'dezgustată', 'dezgustați', 'dezgustate'], 'disgust', 0.8),
    (['scârbit', 'scârbită', 'scârbiți', 'scârbite'], 'disgust', 0.85),
    (['dezgustător', 'dezgustătoare', 'dezgustători', 'dezgustătoare'], 'disgust', 0.8),
    (['disprețuitor', 'disprețuitoare', 'disprețuitori', 'disprețuitoare'], 'contempt', 0.7),
    (['jalnic', 'jalnică', 'jalnici', 'jalnice'], 'contempt', 0.65),
    (['penibil', 'penibilă', 'penibili', 'penibile'], 'contempt', 0.6),
    (['ridicol', 'ridicolă', 'ridicoli', 'ridicole'], 'contempt', 0.55),
    (['obosit', 'obosită', 'obosiți', 'obosite'], 'neutral', 0.0),
    (['ocupat', 'ocupată', 'ocupați', 'ocupate'], 'neutral', 0.0),
]

# Events: (words, emotion, intensity, shock). Slots: {P} person, {O} object, {A} animal.
EVENTS = [
    ('a murit {P}', 'sad', 0.95, True), ('mi-a murit {P}', 'sad', 0.95, True),
    ('a decedat {P}', 'sad', 0.95, True), ('s-a stins {P}', 'sad', 0.9, True),
    ('m-a părăsit {P}', 'sad', 0.8, True), ('mi-e dor de {P}', 'sad', 0.55, False),
    ('am pierdut {O}', 'sad', 0.6, False), ('s-a îmbolnăvit {P}', 'sad', 0.7, True),
    ('am picat examenul', 'sad', 0.65, False), ('m-au concediat', 'sad', 0.75, True),
    ('am câștigat {O}', 'joy', 0.85, False), ('am luat examenul', 'joy', 0.8, False),
    ('s-a născut copilul', 'joy', 0.9, False), ('m-am căsătorit', 'joy', 0.85, False),
    ('a venit {P} acasă', 'joy', 0.6, False), ('am primit {O} cadou', 'joy', 0.7, False),
    ('m-au angajat', 'joy', 0.8, False), ('ne-am revăzut după ani', 'joy', 0.75, False),
    ('m-a sunat {P}', 'joy', 0.4, False),
    ('a apărut {A}', 'fear', 0.8, True), ('m-a urmărit cineva', 'fear', 0.8, True),
    ('se aude ceva în casă', 'fear', 0.7, True), ('a luat foc bucătăria', 'fear', 0.9, True),
    ('mi-e frică de {A}', 'fear', 0.7, False), ('s-a stricat frâna', 'fear', 0.85, True),
    ('m-a mințit {P}', 'anger', 0.75, False), ('mi-a furat {O}', 'anger', 0.8, True),
    ('m-a jignit {P}', 'anger', 0.75, False), ('m-a lovit cineva', 'anger', 0.85, True),
    ('mi-a stricat {O}', 'anger', 0.7, False), ('m-au înșelat', 'anger', 0.8, False),
    ('a câștigat lotul vecinul', 'surprise', 0.75, True), ('a nins în iulie', 'surprise', 0.7, True),
    ('a venit {P} fără să anunțe', 'surprise', 0.6, True),
    ('miroase a gunoi', 'disgust', 0.7, False), ('am găsit un vierme în mâncare', 'disgust', 0.85, True),
    ('e mucegai pe pâine', 'disgust', 0.7, False), ('a vomitat pe masă', 'disgust', 0.85, True),
    ('se crede mai bun ca toți', 'contempt', 0.65, False), ('se laudă tot timpul', 'contempt', 0.55, False),
    ('a copiat la examen și se mândrește', 'contempt', 0.7, False),
]
# Ambiguous events: the verb alone does not say which emotion — the words after it do. The teacher
# labels the verb with the meaning of the whole clause, so a reader that sees only the past must
# guess and one that also sees the next words can settle it (the "post" context, a revision).
AMBIG = [
    ('am pierdut', [('telefonul', 'sad', 0.6, False), ('portofelul', 'sad', 0.6, False), ('meciul', 'sad', 0.55, False),
                    ('kilogramele în plus', 'joy', 0.6, False), ('frica de zbor', 'joy', 0.55, False)]),
    ('a murit', [('fratele', 'sad', 0.95, True), ('bunica', 'sad', 0.95, True), ('câinele nostru', 'sad', 0.85, True),
                 ('bateria', 'anger', 0.4, False), ('motorul pe autostradă', 'fear', 0.65, True)]),
    ('am primit', [('un cadou', 'joy', 0.7, False), ('o bursă', 'joy', 0.8, False),
                   ('o amendă', 'anger', 0.6, False), ('o factură uriașă', 'anger', 0.6, False), ('vești proaste', 'sad', 0.7, True)]),
    ('am găsit', [('portofelul pierdut', 'joy', 0.65, False), ('un cățel', 'joy', 0.6, False),
                  ('un gândac în supă', 'disgust', 0.8, True), ('ușa spartă', 'fear', 0.75, True)]),
    ('m-a sunat', [('mama', 'joy', 0.4, False), ('poliția', 'fear', 0.6, True), ('spitalul', 'fear', 0.7, True)]),
    ('a venit', [('prietenul meu', 'joy', 0.55, False), ('executorul', 'fear', 0.6, True), ('primăvara', 'joy', 0.5, False)]),
    ('mi-au spus', [('că am câștigat', 'joy', 0.85, False), ('că s-a închis firma', 'sad', 0.7, True),
                    ('că m-au mințit', 'anger', 0.75, False)]),
]
PERSONS = ['fratele', 'fratele meu', 'sora mea', 'bunicul', 'bunica', 'mama', 'tata', 'prietenul meu',
           'prietena mea', 'colegul meu', 'vecinul', 'unchiul', 'mătușa', 'câinele nostru', 'pisica']
OBJECTS = ['telefonul', 'portofelul', 'mașina', 'concursul', 'premiul', 'bicicleta', 'laptopul', 'cheile', 'biletul']
ANIMALS = ['un câine mare', 'un șarpe', 'un urs', 'un păianjen uriaș', 'un lup']

# Feeling nouns / impersonal: (phrase, emotion, intensity)
FEEL = [
    ('mi-e frică', 'fear', 0.7), ('mi-e teamă', 'fear', 0.6), ('mi-e groază', 'fear', 0.9),
    ('mi-e silă', 'disgust', 0.75), ('mi-e greață', 'disgust', 0.7), ('mi-e scârbă', 'disgust', 0.8),
    ('mi-e dor', 'sad', 0.55), ('mi-e greu', 'sad', 0.5), ('mă doare sufletul', 'sad', 0.85),
    ('am o mare bucurie', 'joy', 0.85), ('simt o bucurie', 'joy', 0.7), ('ce bucurie', 'joy', 0.8),
    ('simt o tristețe', 'sad', 0.7), ('ce tristețe', 'sad', 0.75), ('ce păcat', 'sad', 0.5),
    ('ce surpriză', 'surprise', 0.75), ('nu-mi vine să cred', 'surprise', 0.8),
    ('mă enervează', 'anger', 0.7), ('m-am săturat', 'anger', 0.65), ('ce nesimțire', 'anger', 0.75),
    ('ce scârbos', 'disgust', 0.8), ('ce penibil', 'contempt', 0.65), ('nici nu merită', 'contempt', 0.55),
    ('ce frumos', 'joy', 0.65), ('ce minunat', 'joy', 0.8), ('ce groaznic', 'sad', 0.7),
]

# What follows an emotion inside its clause (complements, time, place): words that carry no
# emotion of their own, so the state must hold through them.
TAILS = ['pe tine', 'pe el', 'azi', 'acum', 'din nou', 'de mirosul ăsta', 'că ai venit', 'să merg singur noaptea',
         'pentru mâine', 'în autobuz', 'cu nota zece', 'la facultate', 'după o zi lungă', 'de ce s-a întâmplat',
         'să te văd', 'pentru tine', 'de tot ce a fost', 'azi-dimineață', 'aseară', 'la serviciu', 'în parc',
         'când mă gândesc la asta', 'de câteva zile', 'pentru copii', 'în fața tuturor', 'de la început',
         'cu prietenii', 'în oraș', 'de dimineață', 'că s-a terminat', 'pe drum', 'în casă', 'la telefon']
# "ce zi minunată": an exclamation built from a neutral noun and an evaluative adjective.
EXCL_N = ['zi', 'veste', 'seară', 'întâmplare', 'priveliște', 'situație']
EXCL_A = [('minunată', 'joy', 0.75), ('frumoasă', 'joy', 0.65), ('groaznică', 'sad', 0.7), ('tristă', 'sad', 0.7),
          ('ciudată', 'surprise', 0.5), ('scârboasă', 'disgust', 0.75), ('jalnică', 'contempt', 0.6), ('înfricoșătoare', 'fear', 0.7)]
# Events also come subject-first: "fratele meu a murit".
SUBJ_FIRST = [('a murit', 'sad', 0.95, True), ('s-a îmbolnăvit', 'sad', 0.7, True), ('m-a părăsit', 'sad', 0.8, True),
              ('m-a mințit', 'anger', 0.75, False), ('m-a jignit', 'anger', 0.75, False), ('a venit acasă', 'joy', 0.6, False),
              ('m-a sunat', 'joy', 0.4, False), ('a plecat pentru totdeauna', 'sad', 0.75, False)]

NEUTRAL = [
    'azi am fost la magazin', 'mâine merg la serviciu', 'ne-am văzut în parc', 'am mâncat la prânz',
    'am vorbit la telefon', 'era ora cinci', 'am luat autobuzul', 'am citit o carte', 'plouă afară',
    'am stat acasă', 'am plecat dimineața', 'am lucrat toată ziua', 'era multă lume', 'am ajuns târziu',
    'am deschis ușa', 'am primit un mesaj', 'ne-am întâlnit la cafenea', 'am făcut curat',
    'am fost la doctor', 'am sunat-o pe mama', 'am ieșit afară', 'era duminică',
]

SUBJ_STATE = [('sunt', 0), ('mă simt', 0), ('am fost', 0), ('devin', 0), ('e', 0), ('a fost', 0),
              ('suntem', 2), ('ne simțim', 2), ('sunt', 1), ('e', 1), ('ea e', 1), ('el e', 0),
              ('au fost', 2), ('sunt', 3), ('suntem', 3)]
INTENS = [('foarte', 1.3), ('atât de', 1.35), ('extrem de', 1.5), ('tare', 1.25), ('puțin', 0.65),
          ('cam', 0.7), ('destul de', 0.85), ('așa de', 1.3), ('cumplit de', 1.5)]
NEG = ['nu', 'deloc nu', 'nu mai']
CONTRAST = ['dar', 'însă', 'totuși', 'doar că']
SEQ = ['apoi', 'după aceea', 'și', 'iar']
CAUSE = ['pentru că', 'fiindcă', 'deoarece', 'când']
COLOR = [('din păcate', 'sad', 0.6), ('din fericire', 'joy', 0.6), ('slavă domnului', 'joy', 0.6),
         ('vai', 'surprise', 0.35), ('ce să zic', 'neutral', 0.0)]
NEG_FLIP = {'joy': ('sad', 0.55), 'sad': ('joy', 0.25), 'fear': ('neutral', 0.0), 'anger': ('neutral', 0.0),
            'surprise': ('neutral', 0.0), 'disgust': ('neutral', 0.0), 'contempt': ('neutral', 0.0),
            'neutral': ('neutral', 0.0)}

HELD_OUT = {forms[2] for forms, _, _ in ADJ}

# ------------------------------------------------------------------------------- tokenisation


def normalise(s):
    s = unicodedata.normalize('NFC', s.lower())
    return s.replace('ş', 'ș').replace('ţ', 'ț').replace('ã', 'ă')


def strip_diacritics(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')


def tokenize(s):
    """Words (with Romanian hyphenated clitics kept whole: mi-a, s-a, nu-mi) and punctuation."""
    out, w = [], ''
    for ch in normalise(s):
        if ch.isalpha() or (ch == '-' and w):
            w += ch
        else:
            if w:
                out.append(w.strip('-'))
                w = ''
            if ch in '.,!?;:…':
                out.append(ch)
    if w:
        out.append(w.strip('-'))
    return [t for t in out if t]


# ------------------------------------------------------------------------------ clause builder
# A clause is a list of (token, tag) where tag marks how the teacher treats the token:
#   ('emo', emotion, intensity, shock) | ('int', factor) | ('neg',) | ('contrast',) |
#   ('color', emotion, intensity) | ('bang',) | ('q',) | ('stop',) | None (function word)


def words(phrase, tag=None):
    toks = tokenize(phrase)
    return [(t, None) for t in toks[:-1]] + [(toks[-1], tag)] if toks else []


def state_clause(rng, allow_held):
    forms, emo, x = rng.choice(ADJ)
    subj, g = rng.choice([sg for sg in SUBJ_STATE if allow_held or sg[1] != 2])
    form = forms[g]
    c = words(subj)
    neg = rng.random() < 0.22
    if neg:
        # Romanian negation goes before the verb: "nu sunt", "nu mai sunt", "deloc nu sunt".
        c = [(t, ('neg',) if t == 'nu' else None) for t in tokenize(rng.choice(NEG))] + c
    if rng.random() < 0.35:
        name, f = rng.choice(INTENS)
        c += words(name, ('int', f))
    c.append((form, ('emo', emo, x, False)))
    return c


def ambiguous_clause(rng):
    verb, objs = rng.choice(AMBIG)
    obj, emo, x, shock = rng.choice(objs)
    vt = tokenize(verb)
    c = [(t, None) for t in vt] + [(t, None) for t in tokenize(obj)]
    c[len(vt) - 1] = (vt[-1], ('emo', emo, x, shock, 'ambig'))
    return c


def subject_first_clause(rng):
    verb, emo, x, shock = rng.choice(SUBJ_FIRST)
    c = [(t, None) for t in tokenize(rng.choice(PERSONS))]
    vt = tokenize(verb)
    key = 1 if len(vt) > 1 and vt[0] in ('a', 's-a', 'm-a') else 0
    c += [(t, ('emo', emo, x, shock) if i == key else None) for i, t in enumerate(vt)]
    return c


def exclamation_clause(rng):
    adj, emo, x = rng.choice(EXCL_A)
    return [('ce', None), (rng.choice(EXCL_N), None), (adj, ('emo', emo, x, False))]


def event_clause(rng):
    r = rng.random()
    if r < 0.35:
        return ambiguous_clause(rng)
    if r < 0.5:
        return subject_first_clause(rng)
    text, emo, x, shock = rng.choice(EVENTS)
    text = text.replace('{P}', rng.choice(PERSONS)).replace('{O}', rng.choice(OBJECTS)).replace('{A}', rng.choice(ANIMALS))
    toks = tokenize(text)
    # The emotion lands on the content word that carries the event (first verb-ish token for
    # "a murit X": on "murit"; for "miroase a gunoi": on the last word).
    key = 1 if toks[0] in ('a', 'am', 'mi-a', 'm-a', 's-a', 'ne-am', 'mi-e', 'se', 'm-am', 'm-au', 'e') and len(toks) > 1 else len(toks) - 1
    if emo in ('disgust', 'contempt', 'surprise') or text.startswith('mi-e'):
        key = len(toks) - 1
    c = [(t, None) for t in toks]
    c[key] = (toks[key], ('emo', emo, x, shock))
    return c


def feel_clause(rng):
    text, emo, x = rng.choice(FEEL)
    c = words(text, ('emo', emo, x, False))
    if rng.random() < 0.3 and not text.startswith('ce') and not text.startswith('nu'):
        name, f = rng.choice(INTENS[:5])
        c = c[:-1] + words(name, ('int', f)) + [c[-1]] if len(c) > 1 else c
    return c


def neutral_clause(rng):
    return words(rng.choice(NEUTRAL))


def clause(rng, allow_held):
    r = rng.random()
    if r < 0.32:
        return state_clause(rng, allow_held)
    if r < 0.64:
        return event_clause(rng)
    if r < 0.76:
        return feel_clause(rng)
    if r < 0.82:
        return exclamation_clause(rng)
    return neutral_clause(rng)


def with_tail(rng, c):
    if rng.random() < 0.45 and any(g and g[0] == 'emo' for _, g in c):
        c = c + [(t, None) for t in tokenize(rng.choice(TAILS))]
    return c


def sentence(rng, allow_held=False):
    """A text of 1–4 clauses. Returns tokens, tags, segment starts."""
    n = rng.choice([1, 1, 2, 2, 2, 3, 3, 4])
    toks, tags, seg = [], [], []
    for k in range(n):
        if k > 0:
            r = rng.random()
            if r < 0.3:
                link = [(',', ('stop',))] + words(rng.choice(CONTRAST), ('contrast',))
            elif r < 0.5:
                link = [('.', ('stop',))]
            elif r < 0.7:
                link = [(',', ('stop',))] + words(rng.choice(SEQ))
            elif r < 0.85:
                link = words(rng.choice(CAUSE))
            else:
                link = [(',', ('stop',))]
            for i, (t, g) in enumerate(link):
                toks.append(t); tags.append(g); seg.append(1 if (t not in ',.' and i == (1 if link[0][0] in ',.' else 0)) else 0)
        if rng.random() < 0.12:
            name, emo, x = rng.choice(COLOR)
            for i, (t, g) in enumerate(words(name, ('color', emo, x))):
                toks.append(t); tags.append(g); seg.append(1 if i == 0 and (k == 0 or seg[-1] == 0 and toks[-2] in ',.') else 0)
        c = with_tail(rng, clause(rng, allow_held))
        for i, (t, g) in enumerate(c):
            first = i == 0 and (k == 0 or toks[-1] in ',.')
            toks.append(t); tags.append(g); seg.append(1 if first else 0)
    end = rng.random()
    toks.append('!' if end < 0.18 else '?' if end < 0.25 else '.')
    tags.append(('bang',) if end < 0.18 else ('q',) if end < 0.25 else ('stop',))
    seg.append(0)
    seg[0] = 1
    return toks, tags, seg


# ------------------------------------------------------------------------------- the teacher


def onehot(emo, x):
    v = [0.0] * len(EMOS)
    v[E[emo]] = x
    v[0] += 1 - x
    return v


def mix(a, b, g):
    return [(1 - g) * p + g * q for p, q in zip(a, b)]


def teacher(toks, tags):
    """Walk the words; return the listener's affective state after each word (a distribution
    over EMOS) and the clause-level gold emotion of each word."""
    s = onehot('neutral', 0)
    neg, neg_left, amp, amp_left, contrast = False, 0, 1.0, 0, False
    shock_left = 0
    pending = None  # emotion that follows the shock
    out = []
    for t, g in zip(toks, tags):
        kind = g[0] if g else None
        if kind == 'neg':
            neg, neg_left = True, 4
        elif kind == 'int':
            amp, amp_left = g[1], 3
        elif kind == 'contrast':
            # What came before loses weight; the next emotion lands harder.
            s = mix(s, onehot('neutral', 0), 0.5)
            contrast = True
        elif kind == 'color':
            s = mix(s, onehot(g[1], g[2]), 0.45)
        elif kind == 'emo':
            emo, x, shock = g[1], g[2], g[3]
            x = min(1.0, x * (amp if amp_left > 0 else 1.0))
            if neg and neg_left > 0:
                emo, f = NEG_FLIP[emo]
                x = x * f if emo != 'neutral' else 0.0
                shock = False
            neutralish = s[0] > 0.6
            if shock and neutralish and x >= 0.7 and emo != 'surprise':
                # The news lands first as surprise; the emotion follows over the next words.
                s = mix(s, onehot('surprise', 0.85), 0.8)
                pending, shock_left = (emo, x), 3
            else:
                gate = 0.85 if contrast else 0.72
                s = mix(s, onehot(emo, x), gate) if emo != 'neutral' else mix(s, onehot('neutral', 0), 0.6)
            neg, amp_left, contrast = False, 0, False
        if kind in ('bang', 'q', 'stop') and pending:
            # By the end of the sentence the meaning has sunk in: the shock gives way.
            s = mix(s, onehot(*pending), 0.75)
            pending = None
        if kind in ('emo', 'neg', 'int', 'contrast', 'color'):
            pass  # handled above
        elif kind == 'bang':
            top = max(range(1, len(EMOS)), key=lambda i: s[i])
            if s[top] > 0.15:
                s = mix(s, onehot(EMOS[top], min(1, s[top] * 1.35)), 0.5)
        elif kind == 'q':
            if max(s[1:]) > 0.3:
                s = mix(s, onehot('surprise', 0.5), 0.3)
        elif kind == 'stop':
            s = mix(s, onehot('neutral', 0), 0.06)
            neg = False
        else:
            s = mix(s, onehot('neutral', 0), 0.025)
        if pending and kind != 'emo':
            shock_left -= 1
            emo, x = pending
            s = mix(s, onehot(emo, x), 0.55)
            if shock_left <= 0:
                pending = None
        neg_left -= 1
        amp_left -= 1
        out.append([round(v, 4) for v in s])
    return out


def dominant(s, floor=0.2):
    """The emotion a state shows: the strongest non-neutral one if it reaches `floor`, else neutral."""
    top = max(range(1, len(EMOS)), key=lambda k: s[k])
    return top if s[top] >= floor else 0


def clause_gold(states, seg):
    """Gold emotion per segment = the dominant emotion at the segment's last word."""
    golds, start = [], 0
    for i in range(1, len(seg) + 1):
        if i == len(seg) or seg[i] == 1:
            golds.append((start, i, dominant(states[i - 1])))
            start = i
    return golds


def make(n, seed, allow_held, only_held=False, diacritic_free=0.25):
    rng = random.Random(seed)
    data = []
    while len(data) < n:
        toks, tags, seg = sentence(rng, allow_held)
        if only_held and not any(t in HELD_OUT for t in toks):
            continue
        states = teacher(toks, tags)
        if rng.random() < diacritic_free:
            toks = [strip_diacritics(t) for t in toks]
        data.append({'toks': toks, 'seg': seg, 'y': states,
                     'ambig': [i for i, g in enumerate(tags) if g and g[0] == 'emo' and len(g) > 4],
                     'neg': any(g and g[0] == 'neg' for g in tags),
                     'contrast': any(g and g[0] == 'contrast' for g in tags)})
    return data


if __name__ == '__main__':
    import sys
    rng = random.Random(1)
    for _ in range(int(sys.argv[1]) if len(sys.argv) > 1 else 6):
        toks, tags, seg = sentence(rng)
        st = teacher(toks, tags)
        print(' '.join(('|' if s else '') + t + '·' + EMOS[dominant(y)][:3] for t, s, y in zip(toks, seg, st)))
