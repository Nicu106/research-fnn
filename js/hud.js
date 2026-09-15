import { LAYERS, REGIONS } from './network.js';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

export function createHud() {
  const loader = $('#loader');
  const inspector = $('#inspector');
  const leader = $('#leader');
  const leaderLine = $('polyline', leader);
  const leaderDot = $('circle', leader);
  const handlers = {};

  const emit = (name, ...args) => handlers[name]?.(...args);

  function setProgress(p, text) {
    $('.loader-bar i', loader).style.transform = `scaleX(${p})`;
    $('.loader-pct', loader).textContent = String(Math.round(p * 100)).padStart(3, '0') + '%';
    if (text) $('.loader-label', loader).textContent = text;
  }

  function hideLoader() {
    loader.classList.add('done');
    document.body.classList.add('ready');
    setTimeout(() => loader.remove(), 1500);
  }

  function countUp(el, target, delay) {
    const start = performance.now() + delay;
    const dur = 2200;
    const step = (now) => {
      const k = Math.min(1, Math.max(0, (now - start) / dur));
      el.textContent = Math.round(target * (1 - Math.pow(1 - k, 4))).toLocaleString('ro-RO');
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function setNetwork(net, layersOn = [true, true, true], delay = 1700) {
    const values = { nodes: net.count, edges: net.edgeCount, layers: LAYERS.length, regions: net.usedRegions };
    Object.entries(values).forEach(([k, v], i) => countUp($(`[data-stat="${k}"]`), v, delay + i * 140));

    $('#layers').innerHTML = LAYERS.map((l, i) => `
      <button class="toggle" data-toggle="layer" data-index="${i}" aria-pressed="${layersOn[i]}" style="--c:${l.color}">
        <b class="swatch"></b><span>${l.name}</span><em class="count">${net.layerCounts[i]}</em><i></i>
      </button>`).join('');

    renderLegend('layer');
  }

  function renderLegend(mode) {
    const items = mode === 'region' ? REGIONS : [];
    $('#legend').innerHTML = items.map((r) => `<li style="--c:${r.color}"><i></i>${r.name}</li>`).join('');
  }

  // Segmented controls
  $$('[data-seg]').forEach((seg) => {
    seg.addEventListener('click', (ev) => {
      const btn = ev.target.closest('button');
      if (!btn) return;
      const name = seg.dataset.seg;
      if (name !== 'view') setSegment(name, btn.dataset.value);
      else flash(btn);
      if (name === 'color') renderLegend(btn.dataset.value);
      emit(name, btn.dataset.value);
    });
  });

  function setSegment(name, value) {
    $$(`[data-seg="${name}"] button`).forEach((b) => b.classList.toggle('on', b.dataset.value === value));
  }

  function flash(btn) {
    $$('button', btn.parentElement).forEach((b) => b.classList.toggle('on', b === btn));
    clearTimeout(btn._t);
    btn._t = setTimeout(() => btn.classList.remove('on'), 1700);
  }

  // Toggles (static + generated layer rows)
  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-toggle]');
    if (!btn) return;
    const on = btn.getAttribute('aria-pressed') !== 'true';
    btn.setAttribute('aria-pressed', String(on));
    emit(btn.dataset.toggle, on, Number(btn.dataset.index));
  });

  function setToggle(name, on, index) {
    const sel = index === undefined ? `[data-toggle="${name}"]` : `[data-toggle="${name}"][data-index="${index}"]`;
    $(sel)?.setAttribute('aria-pressed', String(on));
  }

  // Skin slider
  const skin = $('#skin');
  const skinVal = $('#skinVal');
  const paintSlider = (v) => {
    skin.style.setProperty('--p', `${v}%`);
    skinVal.textContent = v;
  };
  skin.addEventListener('input', () => {
    const v = Number(skin.value);
    paintSlider(v);
    const preset = v >= 95 ? 'skin' : v <= 5 ? 'network' : Math.abs(v - 35) < 8 ? 'hybrid' : null;
    setSegment('preset', preset);
    emit('skin', v / 100);
  });
  function setSkin(v) {
    skin.value = String(Math.round(v * 100));
    paintSlider(Math.round(v * 100));
  }

  $('#export').addEventListener('click', () => emit('export'));
  $('#recalib').addEventListener('click', () => emit('recalibrate'));

  // Inspector
  let lastKey = '';
  function showInspector(info, sx, sy, pinned) {
    const key = `${info.id}|${pinned}`;
    if (key !== lastKey) {
      lastKey = key;
      for (const [f, v] of Object.entries(info.fields)) $(`[data-f="${f}"]`, inspector).textContent = v;
      inspector.style.setProperty('--c', info.color);
      inspector.classList.toggle('pinned', pinned);
      inspector.hidden = false;
      leader.classList.remove('off');
    }
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cardW = 188;
    const cardH = inspector.offsetHeight || 150;
    const side = sx + 70 + cardW < w - 330 || w <= 900 ? 1 : -1;
    let x = side > 0 ? sx + 70 : sx - 70 - cardW;
    let y = sy - cardH - 40;
    x = Math.max(16, Math.min(w - cardW - 16, x));
    y = Math.max(16, Math.min(h - cardH - 16, y));
    inspector.style.transform = `translate(${x}px, ${y}px)`;
    const ax = side > 0 ? x : x + cardW;
    const ay = y + cardH;
    leaderLine.setAttribute('points', `${sx},${sy} ${sx + (ax - sx) * 0.45},${ay} ${ax},${ay}`);
    leaderDot.setAttribute('cx', sx);
    leaderDot.setAttribute('cy', sy);
  }

  function hideInspector() {
    if (!lastKey) return;
    lastKey = '';
    inspector.hidden = true;
    leader.classList.add('off');
  }

  leader.classList.add('off');

  // Live camera
  const liveParams = $('#liveParams');
  const blendList = $('#blend');
  const camPill = $('#camPill');
  const preview = $('#camPreview');
  let pillTimer = 0;
  let blendRows = [];
  let lastBlend = 0;

  function setLive(on) {
    document.body.classList.toggle('live', on);
    liveParams.hidden = !on;
    $('[data-toggle="preview"]').hidden = !on;
    if (!on) {
      showPreview(false);
      setToggle('preview', false);
    }
  }

  function setCamStatus(kind, text) {
    clearTimeout(pillTimer);
    if (kind === 'hidden') { camPill.hidden = true; return; }
    camPill.hidden = false;
    camPill.className = 'cam-pill' + (kind === 'ok' ? ' ok' : kind === 'err' ? ' err' : '');
    $('b', camPill).textContent = text;
    if (kind === 'ok' || kind === 'err') pillTimer = setTimeout(() => { camPill.hidden = true; }, kind === 'ok' ? 2600 : 12000);
  }

  function showPreview(on) { preview.classList.toggle('off', !on); }

  function setBlendshapes(categories) {
    const now = performance.now();
    if (now - lastBlend < 90) return;
    lastBlend = now;
    const top = categories.filter((c) => c.categoryName !== '_neutral').sort((a, b) => b.score - a.score).slice(0, 10);
    if (!blendRows.length) {
      blendList.innerHTML = Array.from({ length: 10 }, () => '<li><span></span><output></output><i></i></li>').join('');
      blendRows = $$('li', blendList);
    }
    blendRows.forEach((li, i) => {
      const c = top[i];
      li.children[0].textContent = c ? c.categoryName : '—';
      li.children[1].textContent = c ? c.score.toFixed(2) : '';
      li.style.setProperty('--v', c ? c.score.toFixed(3) : '0');
    });
  }

  function setPose(p) {
    for (const k of ['yaw', 'pitch', 'roll']) {
      $(`[data-pose="${k}"]`).textContent = `${p[k] >= 0 ? '+' : ''}${p[k].toFixed(0)}°`;
    }
  }

  return {
    setLive,
    setCamStatus,
    showPreview,
    setBlendshapes,
    setPose,
    on: (name, fn) => { handlers[name] = fn; },
    setProgress,
    hideLoader,
    setNetwork,
    setSegment,
    setToggle,
    setSkin,
    showInspector,
    hideInspector,
    setFps: (v) => { $('#fps').textContent = v; },
  };
}
