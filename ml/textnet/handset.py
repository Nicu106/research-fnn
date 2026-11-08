"""
A small hand-written test set: natural Romanian sentences that were NOT produced by the corpus
generator (different phrasing, word order, unseen words), each with the emotion a listener is
left with at the end. Run after train.py:  python3 handset.py  -> appends to results.json
"""

import json
import os

import torch

import corpus
from corpus import EMOS, dominant
from model import AffectStream, grams
from train import LEX, run

# Set A was written first and then used to find what the generator was missing (development set).
# Set B was written after that, before the retrained model was run, and is not changed afterwards.
HAND = [
    ('Mi-a murit pisica azi-noapte.', 'sad'),
    ('Ieri a murit bunicul meu.', 'sad'),
    ('Am aflat că fratele meu a murit.', 'sad'),
    ('Sunt atât de fericită că ai venit!', 'joy'),
    ('Am luat examenul cu nota zece!', 'joy'),
    ('Ce bucurie să te văd!', 'joy'),
    ('Nu sunt deloc fericit azi.', 'sad'),
    ('Nu mai sunt trist, mi-a trecut.', 'neutral'),
    ('Mi-e frică să merg singur noaptea.', 'fear'),
    ('Am auzit pași în casă și sunt îngrozit.', 'fear'),
    ('M-a mințit din nou și sunt furios.', 'anger'),
    ('Sunt supărat pe tine.', 'anger'),
    ('Nu-mi vine să cred ce s-a întâmplat!', 'surprise'),
    ('Abia aștept vacanța, sunt foarte încântat!', 'joy'),
    ('Am găsit un fir de păr în supă, ce scârbos.', 'disgust'),
    ('Mi-e greață de mirosul ăsta.', 'disgust'),
    ('Se crede mai deștept decât toți, e penibil.', 'contempt'),
    ('Am fost la magazin și am cumpărat pâine.', 'neutral'),
    ('Mâine merg la serviciu cu autobuzul.', 'neutral'),
    ('Mi-e frică, dar sunt bucuros că ești aici.', 'joy'),
    ('Am câștigat concursul, dar mi-a murit câinele.', 'sad'),
    ('Eram trist, însă acum sunt fericit.', 'joy'),
    ('Am pierdut portofelul în autobuz.', 'sad'),
    ('Am pierdut kilogramele în plus și mă simt minunat.', 'joy'),
    ('Am primit o amendă uriașă.', 'anger'),
    ('Am primit o bursă la facultate!', 'joy'),
    ('M-a sunat spitalul azi-dimineață.', 'fear'),
    ('Din păcate, nu am luat examenul.', 'sad'),
    ('Din fericire, totul s-a terminat cu bine.', 'joy'),
    ('Sunt puțin îngrijorat pentru mâine.', 'fear'),
    ('Mă doare sufletul când mă gândesc la ea.', 'sad'),
    ('Mi-e dor de mama.', 'sad'),
    ('M-au concediat fără niciun motiv.', 'sad'),
    ('Copilul nostru s-a născut azi!', 'joy'),
    ('E dezgustător ce a făcut.', 'disgust'),
    ('Sunt nervos pentru că m-au înșelat.', 'anger'),
    ('A apărut un șarpe lângă cort!', 'fear'),
    ('Ce zi minunată!', 'joy'),
    ('Nu mi-e frică de nimic.', 'neutral'),
    ('Sunt obosit după o zi lungă.', 'neutral'),
]

HAND_B = [
    ('Bunica a murit aseară în spital.', 'sad'),
    ('Mi-a scris că nu mai vrea să mă vadă.', 'sad'),
    ('Sunt trist de când a plecat.', 'sad'),
    ('Ne-a părăsit câinele după paisprezece ani.', 'sad'),
    ('Am picat iar la examen.', 'sad'),
    ('Sunt foarte fericit pentru voi!', 'joy'),
    ('Am primit vestea că am fost admis!', 'joy'),
    ('Ce bine că ai ajuns cu bine!', 'joy'),
    ('Mă bucur mult că ne-am revăzut.', 'joy'),
    ('Am câștigat meciul în ultimul minut!', 'joy'),
    ('Mi-e frică de câinele vecinului.', 'fear'),
    ('Sunt speriat, aud zgomote afară.', 'fear'),
    ('Mi-e teamă că o să pierd trenul.', 'fear'),
    ('S-a stins lumina și cineva a deschis ușa.', 'fear'),
    ('Sunt furios pe colegul meu.', 'anger'),
    ('Iar mi-a furat cineva bicicleta!', 'anger'),
    ('M-am săturat de minciunile tale.', 'anger'),
    ('Mă enervează când întârzii.', 'anger'),
    ('Nu-mi vine să cred că ai făcut asta!', 'surprise'),
    ('Sunt uimit de cât de mult ai crescut.', 'surprise'),
    ('Mi-e silă de mâncarea asta.', 'disgust'),
    ('E mucegai peste tot în frigider.', 'disgust'),
    ('Ce scârbos e aici!', 'disgust'),
    ('E jalnic cum se laudă.', 'contempt'),
    ('Mi se pare ridicol ce spune.', 'contempt'),
    ('Azi am mers la piață.', 'neutral'),
    ('Diseară mă uit la un film.', 'neutral'),
    ('Am terminat raportul la birou.', 'neutral'),
    ('Nu sunt supărat pe tine.', 'neutral'),
    ('Nu mi-e frică de întuneric.', 'neutral'),
    ('Nu sunt fericit cu rezultatul.', 'sad'),
    ('Eram speriat, dar acum sunt liniștit.', 'joy'),
    ('Am luat examenul, dar a murit bunicul.', 'sad'),
    ('Mi-a murit telefonul pe drum.', 'anger'),
    ('Am pierdut cheile de la casă.', 'sad'),
    ('Am găsit ușa spartă când am ajuns acasă.', 'fear'),
    ('Din păcate, s-a îmbolnăvit mama.', 'sad'),
    ('Slavă domnului, s-a născut sănătos!', 'joy'),
    ('Sunt cam îngrijorat de analize.', 'fear'),
    ('M-a sunat poliția azi.', 'fear'),
]


@torch.no_grad()
def main():
    here = os.path.dirname(os.path.abspath(__file__))
    m = AffectStream()
    m.load_state_dict(torch.load(os.path.join(here, 'affect_stream.pt')))
    m.eval()
    res = {'A_development': score(m, HAND), 'B_heldout': score(m, HAND_B)}
    p = os.path.join(here, 'results.json')
    r = json.load(open(p))
    r['handset'] = res
    json.dump(r, open(p, 'w'), indent=1, ensure_ascii=False)


def score(m, items):
    hit = lex = 0
    rows = []
    for text, gold in items:
        toks = corpus.tokenize(text)
        d = {'toks': toks, 'g': [grams(t) for t in toks], 'seg': [0] * len(toks), 'y': [[0] * 8] * len(toks)}
        state, *_ = run(m, [d], predicted_seg=True)
        pred = EMOS[dominant(state[0, -1].tolist())]
        emo = 'neutral'
        for t in toks:
            emo = LEX.get(t, emo)
        hit += pred == gold
        lex += emo == gold
        rows.append({'text': text, 'gold': gold, 'net': pred, 'lexicon': emo})
        print(f"{'ok ' if pred == gold else 'XX '} {text:55s} gold {gold:9s} net {pred:9s} lexicon {emo}")
    print(f"\nnetwork {hit}/{len(items)}   lexicon {lex}/{len(items)}\n")
    return {'n': len(items), 'net_acc': hit / len(items), 'lexicon_acc': lex / len(items), 'rows': rows}


if __name__ == '__main__':
    main()
