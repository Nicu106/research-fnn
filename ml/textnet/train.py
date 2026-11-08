"""
Train the affect-stream network, evaluate it and its ablations, export weights for the browser.

    python3 train.py            full model + ablations + lexicon baseline -> results.json
    python3 train.py --quick    full model only, fewer steps

Outputs: ../../js/emotion/textNetWeights.json (weights + a few reference outputs for the JS
parity check) and results.json (the numbers quoted in the article).
"""

import json
import os
import random
import sys
import time

import torch
import torch.nn.functional as F

import corpus
from corpus import EMOS, dominant
from model import AffectStream, LOOK, grams

torch.set_num_threads(4)
HERE = os.path.dirname(os.path.abspath(__file__))
OUT_W = os.path.join(HERE, '..', '..', 'js', 'emotion', 'textNetWeights.json')
QUICK = '--quick' in sys.argv
STEPS = 1500 if QUICK else 4000
BATCH = 64


def featurize(data):
    for d in data:
        d['g'] = [grams(t) for t in d['toks']]
    return data


def batch(items, live=False, rng=None):
    """Pad a batch. live=True simulates streaming: each text is cut at a random word and every
    word sees only the words that have arrived (lookahead clipped at the cut)."""
    T = max(len(d['toks']) for d in items)
    feats, offs = [], []
    seg = torch.zeros(len(items), T)
    look = torch.zeros(len(items), T, dtype=torch.long)
    y = torch.zeros(len(items), T, len(EMOS))
    mask = torch.zeros(len(items), T)
    for b, d in enumerate(items):
        n = len(d['toks'])
        cut = n - 1
        if live and rng.random() < 0.5:
            cut = rng.randrange(n)
        for t in range(T):
            offs.append(len(feats))
            if t < n:
                feats.extend(d['g'][t])
        for t in range(n):
            seg[b, t] = d['seg'][t]
            look[b, t] = max(0, min(LOOK, cut - t))
            y[b, t] = torch.tensor(d['y'][t])
            mask[b, t] = 1 if t <= cut else 0
    return torch.tensor(feats), torch.tensor(offs), seg.long(), look, y, mask, T


def run(model, items, live=False, rng=None, predicted_seg=False, look_override=None):
    feats, offs, seg, look, y, mask, T = batch(items, live, rng)
    x = model.embed(feats, offs).view(len(items), T, -1)
    if look_override is not None:
        look = torch.minimum(look, torch.full_like(look, look_override))
    if predicted_seg:
        seg = segment(model, x)
    state, bound, target, gate = model(x, seg.long(), look)
    return state, bound, gate, seg, y, mask


def segment(model, x):
    """Predicted clause starts (the segmenter only needs the GRU, so run it alone)."""
    with torch.no_grad():
        h, _ = model.gru(x)
        hprev = torch.cat([torch.zeros(x.shape[0], 1, h.shape[-1]), h[:, :-1]], 1)
        b = model.bound(torch.cat([hprev, x], -1)).squeeze(-1) > 0
        b[:, 0] = True
    return b.long()


def train(model, data, steps, seed=0, log=''):
    rng = random.Random(seed)
    opt = torch.optim.Adam(model.parameters(), lr=3e-3)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, steps)
    t0 = time.time()
    for step in range(steps):
        items = rng.sample(data, BATCH)
        state, bound, gate, seg, y, mask = run(model, items, live=True, rng=rng)
        ce = -(y * state.clamp(min=1e-5).log()).sum(-1)
        loss = (ce * mask).sum() / mask.sum()
        bl = F.binary_cross_entropy_with_logits(bound, seg.float(), reduction='none')
        loss = loss + 0.3 * (bl * mask).sum() / mask.sum()
        opt.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        opt.step()
        sched.step()
        if step % 500 == 0 or step == steps - 1:
            print(f'{log} step {step:5d}  loss {loss.item():.4f}  {time.time() - t0:.0f}s', flush=True)
    return model


# ---------------------------------------------------------------------------------- evaluation


def clause_ends(d):
    return [(a, b, g) for a, b, g in corpus.clause_gold(d['y'], d['seg'])]


@torch.no_grad()
def evaluate(model, data, predicted_seg=True):
    model.eval()
    hit = tot = whit = wtot = 0
    neg_hit = neg_tot = con_hit = con_tot = 0
    amb = {0: 0, 2: 0}
    amb_tot = 0
    jit_m = jit_y = 0.0
    flips_m = flips_y = 0
    mae = 0.0
    bt = bp = bh = 0
    for i in range(0, len(data), 128):
        items = data[i:i + 128]
        state, bound, gate, seg, y, mask = run(model, items, predicted_seg=predicted_seg)
        state0, *_ = run(model, items, predicted_seg=predicted_seg, look_override=0)
        for b, d in enumerate(items):
            n = len(d['toks'])
            st = state[b, :n].tolist()
            for a, e, g in clause_ends(d):
                ok = dominant(st[e - 1]) == g
                hit += ok; tot += 1
                if d['neg']:
                    neg_hit += ok; neg_tot += 1
                if d['contrast']:
                    con_hit += ok; con_tot += 1
            for t in range(n):
                whit += dominant(st[t]) == dominant(d['y'][t]); wtot += 1
                mae += sum(abs(p - q) for p, q in zip(st[t], d['y'][t])) / len(EMOS)
                if t:
                    jit_m += sum(abs(p - q) for p, q in zip(st[t], st[t - 1]))
                    jit_y += sum(abs(p - q) for p, q in zip(d['y'][t], d['y'][t - 1]))
                    flips_m += dominant(st[t]) != dominant(st[t - 1])
                    flips_y += dominant(d['y'][t]) != dominant(d['y'][t - 1])
            for t in d['ambig']:
                amb_tot += 1
                g = dominant(d['y'][t + 1]) if t + 1 < n else dominant(d['y'][t])
                g = dominant(d['y'][t])
                amb[2] += dominant(st[t]) == g
                amb[0] += dominant(state0[b, t].tolist()) == g
            ps = seg[b, :n].tolist()
            for t in range(1, n):
                bt += d['seg'][t]; bp += ps[t]; bh += d['seg'][t] and ps[t]
    model.train()
    f1 = 2 * bh / max(1, bt + bp)
    return {
        'clause_acc': hit / tot, 'word_acc': whit / wtot, 'state_mae': mae / wtot,
        'negation_clause_acc': neg_hit / max(1, neg_tot), 'contrast_clause_acc': con_hit / max(1, con_tot),
        'ambiguous_verb_acc_no_lookahead': amb[0] / max(1, amb_tot), 'ambiguous_verb_acc_lookahead': amb[2] / max(1, amb_tot),
        'flips_per_word_model': flips_m / wtot, 'flips_per_word_teacher': flips_y / wtot,
        'jitter_model': jit_m / wtot, 'jitter_teacher': jit_y / wtot, 'segment_f1': f1,
    }


LEX = {}
for forms, emo, x in corpus.ADJ:
    for f in forms[:2] + forms[3:]:
        LEX[f] = emo
        LEX[corpus.strip_diacritics(f)] = emo
for text, emo, *_ in corpus.EVENTS + [(t, e) for t, e, _ in corpus.FEEL]:
    w = corpus.tokenize(text.replace('{P}', '').replace('{O}', '').replace('{A}', ''))[-1]
    LEX.setdefault(w, emo)
    LEX.setdefault(corpus.strip_diacritics(w), emo)


def lexicon_baseline(data):
    """No context: a clause shows the emotion of its last lexicon word, else neutral."""
    hit = tot = 0
    for d in data:
        for a, e, g in clause_ends(d):
            emo = 'neutral'
            for t in d['toks'][a:e]:
                emo = LEX.get(t, emo)
            hit += EMOS.index(emo) == g; tot += 1
    return hit / tot


# --------------------------------------------------------------------------------------- export


def export(model, examples):
    sd = {k: v.detach() for k, v in model.state_dict().items()}
    r = lambda t: [round(v, 5) for v in t.flatten().tolist()]
    w = {
        'meta': {'buckets': model.emb.num_embeddings, 'dim': model.emb.embedding_dim, 'hid': model.gru.hidden_size,
                 'look': LOOK, 'emotions': EMOS},
        'emb': r(sd['emb.weight']),
        'gru': {k: r(sd[f'gru.{k}_l0']) for k in ('weight_ih', 'weight_hh', 'bias_ih', 'bias_hh')},
        'bound': {'w': r(sd['bound.weight']), 'b': r(sd['bound.bias'])},
        'q': r(sd['q.weight']), 'k': r(sd['k.weight']), 'v': r(sd['v.weight']),
        'null_k': r(sd['null_k']), 'null_v': r(sd['null_v']), 'recency': float(F.softplus(sd['recency'])),
        'app': {'w': r(sd['app.weight']), 'b': r(sd['app.bias'])},
        'target': {'w': r(sd['target.weight']), 'b': r(sd['target.bias'])},
        'gate': {'w': r(sd['gate.weight']), 'b': r(sd['gate.bias'])},
    }
    # Reference outputs for the JS parity check (computed from the rounded weights).
    with torch.no_grad():
        for name, p in model.named_parameters():
            p.copy_(torch.tensor(r(p.data)).view_as(p))
        ref = []
        for text in examples:
            toks = corpus.tokenize(text)
            d = {'toks': toks, 'g': [grams(t) for t in toks], 'seg': [0] * len(toks), 'y': [[0] * 8] * len(toks)}
            state, _, _, seg, _, _ = run(model, [d], predicted_seg=True)
            ref.append({'text': text, 'seg': seg[0].tolist(), 'state': [[round(v, 4) for v in s] for s in state[0].tolist()]})
    w['reference'] = ref
    with open(OUT_W, 'w') as f:
        json.dump(w, f, separators=(',', ':'))
    print('wrote', OUT_W, f'{os.path.getsize(OUT_W) / 1e6:.2f} MB')


REF_TEXTS = ['A murit fratele.', 'Am pierdut kilogramele în plus, dar mi-e dor de bunica!',
             'Nu sunt fericit. Totuși, am luat examenul.']

if __name__ == '__main__':
    torch.manual_seed(0)
    t0 = time.time()
    train_set = featurize(corpus.make(4000 if QUICK else 30000, 1, allow_held=False))
    test_seen = featurize(corpus.make(3000, 2, allow_held=False))
    test_unseen = featurize(corpus.make(1500, 3, allow_held=True, only_held=True))
    print(f'data ready {time.time() - t0:.0f}s')
    results = {'corpus': {'train': len(train_set), 'test_seen': len(test_seen), 'test_unseen_forms': len(test_unseen)}}
    configs = [('full', {})] if QUICK else [('full', {}), ('no_pre', {'pre': False}), ('no_post', {'post': False}),
                                             ('no_integrator', {'integrate': False})]
    for name, kw in configs:
        torch.manual_seed(0)
        m = train(AffectStream(**kw), train_set, STEPS, log=name)
        results[name] = {'seen': evaluate(m, test_seen), 'unseen_forms': evaluate(m, test_unseen)}
        if name == 'full':
            results[name]['seen_gold_segments'] = evaluate(m, test_seen, predicted_seg=False)
            results['params'] = sum(p.numel() for p in m.parameters())
            torch.save(m.state_dict(), os.path.join(HERE, 'affect_stream.pt'))
            full = m
        print(name, json.dumps(results[name], indent=1))
    results['lexicon_baseline'] = {'seen': lexicon_baseline(test_seen), 'unseen_forms': lexicon_baseline(test_unseen)}
    print('lexicon', results['lexicon_baseline'])
    with open(os.path.join(HERE, 'results.json'), 'w') as f:
        json.dump(results, f, indent=1)
    export(full, REF_TEXTS)
