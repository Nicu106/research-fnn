import * as THREE from 'three';

/*
 * Floating anatomy labels: the name of each part, with a leader line to it. Used for the brain
 * structures of the neuromotor network (amygdala, cingulate, motor cortex, brainstem nuclei) and
 * for the facial muscles (muscle/muscleView.js).
 *
 * Laid out like an anatomy atlas: labels sit in two columns either side of the brain and are
 * spread vertically so they never overlap, however the head is turned. The nuclei are a few
 * millimetres apart, so labels placed right on the nodes would be an unreadable pile.
 *
 * Clicking a label selects that structure (onPick), which opens the inspector with its
 * explanation. Hovering highlights it.
 */

const ROW = 22;    // min vertical distance between two labels in a column, px
const GAP = 46;    // horizontal distance from the outermost node to a column, px
const SIDE_TXT = { R: 'D', L: 'S' };

export class BrainLabels {
  /**
   * @param items     [{ at (point index in `positions`), pick (id passed to onPick), label,
   *                    name (tooltip), color, side ('R' | 'L' | undefined) }]
   * @param positions live point positions (model units, bound to the rig)
   * @param onPick    (pick) => void
   */
  constructor(items, positions, { onPick, onHover } = {}) {
    this.nodePos = positions;
    this.items = items.map((n) => ({ id: n.at, node: n }));
    this.root = document.createElement('div');
    this.root.className = 'brain-labels';
    this.root.innerHTML = '<svg class="bl-lines"></svg>';
    this.svg = this.root.firstChild;
    const NS = 'http://www.w3.org/2000/svg';
    for (const it of this.items) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'bl';
      el.style.setProperty('--c', it.node.color);
      el.innerHTML = `<i></i><span>${it.node.label}</span>${it.node.side ? `<em>${SIDE_TXT[it.node.side]}</em>` : ''}`;
      el.title = `${it.node.name} — click pentru explicație`;
      el.addEventListener('click', (e) => { e.stopPropagation(); onPick?.(it.node.pick); });
      el.addEventListener('pointerenter', () => onHover?.(it.node.pick));
      el.addEventListener('pointerleave', () => onHover?.(-1));
      it.el = el;
      it.line = document.createElementNS(NS, 'polyline');
      it.line.style.setProperty('--c', it.node.color);
      this.svg.appendChild(it.line);
      this.root.appendChild(el);
    }
    document.body.appendChild(this.root);
    this.v = new THREE.Vector3();
    this.shown = false;
  }

  /**
   * @param camera  scene camera
   * @param matrix  world matrix of the group the nodes live in (head.group.matrixWorld)
   * @param vis     0..1 visibility (fades with the neuromotor view)
   * @param active  highlighted pick id or -1
   * @param act     (pick) => activation 0..1, optional
   */
  update(camera, matrix, vis, active = -1, act = null) {
    const show = vis > 0.05;
    if (show !== this.shown) { this.root.classList.toggle('on', show); this.shown = show; }
    if (!show) return;
    this.root.style.opacity = String(Math.min(1, vis * 1.2));

    const W = window.innerWidth, H = window.innerHeight;
    let minX = Infinity, maxX = -Infinity, cx = 0, n = 0;
    for (const it of this.items) {
      this.v.fromArray(this.nodePos, it.id * 3).applyMatrix4(matrix).project(camera);
      it.behind = this.v.z > 1;
      it.x = (this.v.x * 0.5 + 0.5) * W;
      it.y = (-this.v.y * 0.5 + 0.5) * H;
      if (it.behind) continue;
      minX = Math.min(minX, it.x); maxX = Math.max(maxX, it.x); cx += it.x; n++;
    }
    if (!n) return;
    cx /= n;

    // Two columns: each structure goes to the side of the screen it is on.
    const cols = { left: [], right: [] };
    for (const it of this.items) if (!it.behind) (it.x < cx ? cols.left : cols.right).push(it);
    for (const [side, list] of Object.entries(cols)) {
      list.sort((a, b) => a.y - b.y);
      // Spread: push down to keep ROW apart, then shift the block back up so it stays centred
      // on the nodes it labels (and inside the screen).
      let prev = -Infinity;
      for (const it of list) { it.ly = Math.max(it.y, prev + ROW); prev = it.ly; }
      if (list.length) {
        const drift = list.reduce((s, it) => s + it.ly - it.y, 0) / list.length;
        let shift = -drift;
        const top = list[0].ly + shift, bottom = list[list.length - 1].ly + shift;
        if (top < 70) shift += 70 - top;
        if (bottom > H - 40) shift -= bottom - (H - 40);
        for (const it of list) it.ly += shift;
      }
      const colX = side === 'left' ? Math.max(12, minX - GAP) : Math.min(W - 12, maxX + GAP);
      for (const it of list) {
        it.el.style.transform = side === 'left'
          ? `translate(calc(${colX}px - 100%), ${it.ly - 10}px)`
          : `translate(${colX}px, ${it.ly - 10}px)`;
        it.el.classList.toggle('flip', side === 'left');
        const elbow = side === 'left' ? colX + 8 : colX - 8;
        it.line.setAttribute('points', `${it.x},${it.y} ${elbow},${it.ly} ${colX},${it.ly}`);
      }
    }
    for (const it of this.items) {
      it.el.hidden = it.behind;
      it.line.style.display = it.behind ? 'none' : '';
      const hot = it.node.pick === active;
      it.el.classList.toggle('hot', hot);
      it.line.classList.toggle('hot', hot);
      it.el.classList.toggle('live', !!act && act(it.node.pick) > 0.3);
    }
  }

  setEnabled(on) { this.root.hidden = !on; }
}
