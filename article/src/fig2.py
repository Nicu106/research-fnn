import json, os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from PIL import Image

D = os.path.dirname(os.path.abspath(__file__))
plt.rcParams['font.family'] = 'Times New Roman'
tr = json.load(open(os.path.join(D, 'traj.json')))
EM = ['neutral', 'joy', 'sadness', 'fear', 'anger', 'surprise', 'disgust', 'contempt']
COL = ['#d9d9d9', '#f2c14e', '#4a7fd4', '#9b6fd6', '#d9534f', '#5bc8d6', '#6fbf4f', '#e8964a']

text = 'Am câștigat concursul, dar mi-a murit câinele.'
t = tr[text]
frames = Image.open(os.path.join(D, 'fig2_textnet.jpg'))
frames = frames.crop((0, 0, frames.width, frames.height - 14))

fig = plt.figure(figsize=(7.0, 2.5), dpi=300)
ax = fig.add_axes([0.06, 0.585, 0.8, 0.37])
n = len(t['toks'])
bottom = [0.0] * n
for k in range(8):
    vals = [s[k] for s in t['states']]
    if max(vals) < 0.02:
        continue
    ax.bar(range(n), vals, bottom=bottom, color=COL[k], width=0.82, label=EM[k], edgecolor='white', linewidth=0.3)
    bottom = [b + v for b, v in zip(bottom, vals)]
for i, s in enumerate(t['seg']):
    if s and i:
        ax.axvline(i - 0.5, color='#222', lw=0.7, ls=(0, (3, 2)))
ax.set_xticks(range(n), t['toks'], fontsize=6.6)
ax.set_xlim(-0.5, n - 0.5); ax.set_ylim(0, 1)
ax.set_yticks([0, 0.5, 1]); ax.tick_params(axis='y', labelsize=5.8, length=2); ax.tick_params(axis='x', length=0, pad=2)
for sp in ('top', 'right'):
    ax.spines[sp].set_visible(False)
ax.set_ylabel('state', fontsize=6.2, labelpad=1)
ax.text(-0.012, 1.02, 'a)', fontsize=7, fontweight='bold', transform=fig.transFigure if False else ax.transAxes, ha='right', va='bottom')
ax.legend(loc='center left', bbox_to_anchor=(1.0, 0.5), fontsize=5.8, frameon=False, handlelength=1, handleheight=0.8, borderaxespad=0.3)

ax2 = fig.add_axes([0.0, 0.0, 1.0, 0.485])
ax2.imshow(frames); ax2.axis('off')
ax2.text(4, 22, 'b)', fontsize=7, fontweight='bold', color='white')
fig.savefig(os.path.join(D, 'fig2_textnet_full.jpg'), pil_kwargs={'quality': 92})
print(Image.open(os.path.join(D, 'fig2_textnet_full.jpg')).size)
