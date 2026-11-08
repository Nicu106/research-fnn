import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

plt.rcParams['font.family'] = 'Times New Roman'
fig, ax = plt.subplots(figsize=(7.0, 1.25), dpi=300)
ax.set_xlim(0, 100); ax.set_ylim(17, 32.6); ax.axis('off')

def box(x, y, w, h, title, body, fill='#ffffff'):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle='round,pad=0.2,rounding_size=1.0', fc=fill, ec='#222', lw=0.7))
    ax.text(x + w / 2, y + h - 1.6, title, ha='center', va='top', fontsize=6.3, fontweight='bold')
    ax.text(x + w / 2, y + h - 5.0, body, ha='center', va='top', fontsize=5.6, linespacing=1.3)

def arrow(a, b, style='-|>'):
    ax.add_patch(FancyArrowPatch(a, b, arrowstyle=style, mutation_scale=6, lw=0.7, color='#222', shrinkA=0, shrinkB=0))

W, H, Y = 14.8, 14.5, 17.5
xs = [0.4 + i * 16.75 for i in range(6)]
box(xs[0], Y, W, H, 'Text input', '"A murit fratele."\nword by word, live', '#f0f0f0')
box(xs[1], Y, W, H, 'Affect-stream net', 'n-grams → GRU,\nsegmenter, clause\nmemory, lookahead,\nleaky integrator', '#e8f1fb')
box(xs[2], Y, W, H, 'Emotion taxonomy', '93 nodes, 10 families\nvalence–arousal\nFACS recipe per node')
box(xs[3], Y, W, H, 'Scenario timeline', 'emotion per word →\nbeats: shock → sadness\n→ compassion; visemes')
box(xs[4], Y, W, H, '52-muscle basis', 'action units → mm\nfields on landmarks;\nneuromotor model')
box(xs[5], Y, W, H, '3D avatar', 'skin deformation,\neyes, lips, wrinkles;\nWebGL, real time', '#f0f0f0')
for i in range(5):
    arrow((xs[i] + W + 0.25, Y + H / 2), (xs[i + 1] - 0.25, Y + H / 2))

fig.savefig(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fig1_architecture.png'), bbox_inches='tight', pad_inches=0.02)
