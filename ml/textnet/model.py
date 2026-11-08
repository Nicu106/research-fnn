"""
Affect-stream network: text in, a continuous emotional state per word out.

    word ──► char n-gram embedding ──► GRU (what has been said so far)
                                          │
              segmenter: does a new clause start here? ──► segment memory (one vector per clause)
                                          │
    attention over earlier clauses ("pre") + current clause so far + next 2 words ("post")
                                          │
                                 appraisal layer z_t
                        ┌─────────────────┴──────────────────┐
              target emotion p_t (8)                impact gate g_t
                        └──────► s_t = (1 − g_t)·s_{t−1} + g_t·p_t ◄──┘

The state s_t is an explicit leaky integrator, so the emotion cannot jump around: every word
moves it only as much as its learned impact allows, and function words leave it almost where it
was. That is what makes the trajectory consistent. The lookahead lets the network revise the
reading of a word once the next words arrive ("am pierdut ..." telefonul / kilogramele); in live
use it is first computed with no lookahead (provisional) and recomputed as words come in.

The same forward pass is written in plain JavaScript in js/emotion/textNet.js.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F

BUCKETS = 4096
DIM = 32
HID = 64
Z = 64
LOOK = 2
N_EMO = 8


def fnv1a(s):
    h = 0x811C9DC5
    for ch in s:
        h ^= ord(ch)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


def grams(word):
    """Hashed features of a word: its char 2-, 3- and 4-grams (with boundary marks) and the
    whole word. Inflected forms share most of their n-grams (trist / tristă / triști)."""
    w = f'<{word}>'
    feats = [fnv1a('W:' + word) % BUCKETS]
    for n in (2, 3, 4):
        for i in range(len(w) - n + 1):
            feats.append(fnv1a(w[i:i + n]) % BUCKETS)
    return feats


class AffectStream(nn.Module):
    def __init__(self, pre=True, post=True, integrate=True):
        """The flags switch parts off for the ablations: memory of earlier clauses, lookahead,
        and the leaky integrator (without it the state is the per-word target itself)."""
        super().__init__()
        self.use_pre, self.use_post, self.use_int = pre, post, integrate
        self.emb = nn.EmbeddingBag(BUCKETS, DIM, mode='mean')
        self.gru = nn.GRU(DIM, HID, batch_first=True)
        self.bound = nn.Linear(HID + DIM, 1)
        self.q = nn.Linear(HID, HID, bias=False)
        self.k = nn.Linear(HID, HID, bias=False)
        self.v = nn.Linear(HID, HID, bias=False)
        self.null_k = nn.Parameter(torch.zeros(HID))
        self.null_v = nn.Parameter(torch.zeros(HID))
        self.recency = nn.Parameter(torch.tensor(0.5))
        self.app = nn.Linear(HID + HID + HID + DIM + 1, Z)
        self.target = nn.Linear(Z, N_EMO)
        self.gate = nn.Linear(Z, 1)

    def embed(self, feats, offsets):
        return self.emb(feats, offsets)

    def forward(self, x, seg, look):
        """
        x     (B, T, DIM) word embeddings
        seg   (B, T) 1 where a clause starts (gold in training, predicted at inference)
        look  (B, T) how many of the next LOOK words are visible to each word (0..LOOK)
        returns state (B, T, 8), boundary logits (B, T), target (B, T, 8), gate (B, T)
        """
        B, T, _ = x.shape
        h, _ = self.gru(x)
        hprev = torch.cat([torch.zeros(B, 1, HID), h[:, :-1]], 1)
        bound = self.bound(torch.cat([hprev, x], -1)).squeeze(-1)

        # Segment ids and memory. seg_id[t] = index of t's clause; a clause's summary is the
        # mean of its hidden states, available to words of later clauses only.
        seg_id = torch.cumsum(seg, 1) - 1                                # (B, T)
        S = int(seg_id.max().item()) + 1
        onehot = F.one_hot(seg_id.clamp(min=0), S).float()               # (B, T, S)
        summ = torch.einsum('bts,bth->bsh', onehot, h) / onehot.sum(1).clamp(min=1).unsqueeze(-1)
        keys = torch.cat([self.null_k.expand(B, 1, HID), self.k(summ)], 1)
        vals = torch.cat([self.null_v.expand(B, 1, HID), self.v(summ)], 1)
        score = torch.einsum('bth,bsh->bts', self.q(h), keys) / HID ** 0.5
        sidx = torch.arange(S + 1).view(1, 1, -1) - 1                    # -1 = null slot
        cur = seg_id.unsqueeze(-1)
        visible = (sidx < cur) | (sidx == -1)
        age = (cur - sidx).clamp(min=0).float()
        score = score - F.softplus(self.recency) * age * (sidx >= 0)
        score = score.masked_fill(~visible, -1e9)
        ctx = torch.einsum('bts,bsh->bth', score.softmax(-1), vals)
        if not self.use_pre:
            ctx = torch.zeros_like(ctx)

        # Current clause so far (running mean of h within the clause).
        csum = torch.cumsum(h, 1)
        start = torch.zeros_like(seg_id)
        for t in range(1, T):
            start[:, t] = torch.where(seg[:, t] > 0, torch.full_like(start[:, t], t), start[:, t - 1])
        csum0 = torch.cat([torch.zeros(B, 1, HID), csum], 1)           # csum0[t] = sum of h before t
        before = torch.gather(csum0, 1, start.unsqueeze(-1).expand(-1, -1, HID))
        count = (torch.arange(T).view(1, -1) - start + 1).unsqueeze(-1).float()
        clause = (csum - before) / count

        # Lookahead: mean embedding of the next `look` words.
        if not self.use_post:
            look = torch.zeros_like(look)
        la = torch.zeros_like(x)
        for j in range(1, LOOK + 1):
            nxt = torch.cat([x[:, j:], torch.zeros(B, j, DIM)], 1)
            la = la + nxt * (look >= j).unsqueeze(-1)
        la = la / look.clamp(min=1).unsqueeze(-1)
        z = torch.tanh(self.app(torch.cat([h, ctx, clause, la, (look.float() / LOOK).unsqueeze(-1)], -1)))
        target = self.target(z).softmax(-1)
        gate = torch.sigmoid(self.gate(z)).squeeze(-1)
        if not self.use_int:
            gate = torch.ones_like(gate)

        s = torch.zeros(B, N_EMO)
        s[:, 0] = 1
        out = []
        for t in range(T):
            s = (1 - gate[:, t:t + 1]) * s + gate[:, t:t + 1] * target[:, t]
            out.append(s)
        return torch.stack(out, 1), bound, target, gate
