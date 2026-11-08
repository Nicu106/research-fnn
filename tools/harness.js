/*
 * Dev-only visual harness for the emotion studio (never loaded by the app).
 *
 *   const h = await import('/tools/harness.js');
 *   await h.init();
 *   h.tiles(['melancholy', 'sad', 'grief']);             // presets side by side
 *   h.tiles([{ w: { browInnerUp: 1 }, label: 'AU1' }]);   // any weights, head level
 *
 * Renders frames on demand through neuralFace.step(), so it also works in a background tab
 * (where requestAnimationFrame is paused), and copies them into a DOM canvas, which is what a
 * screenshot of a background tab actually shows.
 */

const NF = () => window.neuralFace;
let t = 30;
let overlay = null;

export function tick(n = 60, dt = 1 / 30) {
  for (let i = 0; i < n; i++) { t += dt; NF().step(t); }
}

export async function init({ network = false } = {}) {
  document.querySelector('#tabs [data-tab=emotion]').click();
  // Background tabs throttle timers to ~1/s, so poll sparingly.
  for (let i = 0; i < 20 && !NF().basis; i++) await new Promise((r) => setTimeout(r, 500));
  document.querySelector('#panelEmotion [data-seg=preset] [data-value=skin]').click();
  if (!network) [0, 1, 2].forEach((i) => NF().view.setLayerVisible(i, false));
  NF().studio.performer.settings.life = 0;
  tick(6);
  if (!overlay) {
    overlay = document.createElement('canvas');
    Object.assign(overlay.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', zIndex: 50, background: '#000' });
    document.body.appendChild(overlay);
  }
  return 'ready';
}

export function hide() { overlay?.remove(); overlay = null; }

/** Show one item: a preset key, or { w, head?, gaze?, skin?, label }. */
function present(item) {
  const s = NF().studio;
  s.performer.settings.life = 0;
  if (typeof item === 'string') s.select(item);
  else s.showExpression({ w: item.w, head: item.head ?? { pitch: 0, yaw: 0, roll: 0 }, gaze: item.gaze ?? [0, 0], skin: item.skin }, item.label ?? 'test', 'edit');
  s.performer.snap();
  // step() advances with dt = 1 s, so every smoother has converged after a couple of frames.
  tick(4);
}

// Screen position (canvas pixels) of a landmark on the current, rotated head.
function screenOf(i) {
  const nf = NF();
  const THREE = nf.THREE;
  const a = nf.anchors;
  const p = new THREE.Vector3(a[i * 3], a[i * 3 + 1], a[i * 3 + 2]);
  if (nf.rig) {
    p.x += nf.rig.Ds[i * 3]; p.y += nf.rig.Ds[i * 3 + 1]; p.z += nf.rig.Ds[i * 3 + 2];
    p.applyMatrix4(nf.rig.headMatrix);
  }
  p.applyMatrix4(nf.head.group.matrixWorld).project(nf.stage.camera);
  const c = nf.stage.renderer.domElement;
  return [(p.x * 0.5 + 0.5) * c.width, (-p.y * 0.5 + 0.5) * c.height];
}

// Crop rectangle [x, y, w, h] in canvas pixels around a facial region of the current frame.
const FOCUS = {
  face: () => { const a = screenOf(10), b = screenOf(152); const h = Math.hypot(b[0] - a[0], b[1] - a[1]) * 1.3; return [(a[0] + b[0]) / 2 - h * 0.42, (a[1] + b[1]) / 2 - h * 0.5, h * 0.84, h]; },
  eyes: () => { const a = screenOf(33), b = screenOf(263); const w = Math.hypot(b[0] - a[0], b[1] - a[1]) * 1.45; return [(a[0] + b[0]) / 2 - w / 2, (a[1] + b[1]) / 2 - w * 0.3, w, w * 0.5]; },
  mouth: () => { const a = screenOf(61), b = screenOf(291); const w = Math.hypot(b[0] - a[0], b[1] - a[1]) * 2.3; return [(a[0] + b[0]) / 2 - w / 2, (a[1] + b[1]) / 2 - w * 0.36, w, w * 0.72]; },
};

/** Render items in a grid, each cropped around `focus` ('face' | 'eyes' | 'mouth'). */
export function tiles(items, focus = 'face') {
  const c = NF().stage.renderer.domElement;
  overlay.width = innerWidth * 2;
  overlay.height = innerHeight * 2;
  const g = overlay.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, overlay.width, overlay.height);
  const n = items.length;
  const cols = Math.min(n, focus === 'face' ? 4 : 2);
  const rows = Math.ceil(n / cols);
  const cellW = overlay.width / cols, cellH = overlay.height / rows;
  items.forEach((item, i) => {
    present(item);
    const [x, y, w, h] = FOCUS[focus]();
    const k = Math.min(cellW / w, cellH / h) * 0.98;
    const cx = (i % cols) * cellW, cy = Math.floor(i / cols) * cellH;
    g.drawImage(c, x, y, w, h, cx, cy, w * k, h * k);
    g.fillStyle = '#9ff3ff';
    g.font = `${Math.round(overlay.width / 90)}px monospace`;
    const label = typeof item === 'string' ? `${item} · ${NF().studio.baseLabel}` : item.label;
    g.fillText(label, cx + 16, cy + h * k - 16);
  });
  return `${n} tiles (${focus})`;
}
