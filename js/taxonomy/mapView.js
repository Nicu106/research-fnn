/*
 * "Harta emoțiilor": the affective spectrum as an interactive graph.
 *
 * Three layouts of the same nodes:
 *   tree     radial hierarchy (family -> emotion -> sub-emotion)
 *   va       Russell's circumplex: valence left-right, arousal bottom-top
 *   force    a network where compound emotions and confusions pull related nodes together
 *
 * Every node is coloured by family and ringed by what the model can do with it; the panel shows
 * its FACS recipe, the abilities it needs, the data that covers it and what it is confused with,
 * and sends it to the face. d3 is loaded from the CDN the first time the tab opens.
 */

import { NODES, LINKS, ABILITIES, DATASETS, FAMILY_COLORS, CAPABILITY, capability, familyOf } from './data.js';
import { describeRecipe } from './facs.js';
import { BLENDSHAPES } from '../live/landmarkSets.js';

const D3 = 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const RADIUS = { root: 16, family: 12, emotion: 7.5, sub: 5 };
const LINK_STYLE = {
  tree: { ro: 'Ierarhie', color: 'rgba(160,225,255,0.22)', dash: null },
  intensity: { ro: 'Intensitate (Plutchik)', color: 'rgba(255,209,102,0.7)', dash: '5 4' },
  blend: { ro: 'Emoție compusă', color: 'rgba(159,243,255,0.55)', dash: '1 4' },
  confusion: { ro: 'Se confundă pe față', color: 'rgba(255,93,115,0.75)', dash: '6 3' },
};

export class EmotionMap {
  /**
   * @param {object} o
   * @param {(node) => void} o.onShow send a node to the face (Studio emoții)
   * @param {(msg: string, kind?: string) => void} o.notify
   */
  constructor({ onShow, notify }) {
    this.onShow = onShow;
    this.notify = notify;
    this.byId = Object.fromEntries(NODES.map((n) => [n.id, n]));
    this.nodes = NODES.map((n) => ({
      ...n,
      family: familyOf(n.id, this.byId),
      cap: capability(n),
      r: RADIUS[n.level],
    }));
    this.nodeById = Object.fromEntries(this.nodes.map((n) => [n.id, n]));
    this.links = [
      ...this.nodes.filter((n) => n.parent).map((n) => ({ source: n.parent, target: n.id, kind: 'tree' })),
      ...LINKS.map(([a, b, kind]) => ({ source: a, target: b, kind })),
    ];
    this.neighbours = Object.fromEntries(this.nodes.map((n) => [n.id, new Set([n.id])]));
    for (const l of this.links) { this.neighbours[l.source].add(l.target); this.neighbours[l.target].add(l.source); }

    this.layout = 'tree';
    this.showKinds = { tree: true, intensity: true, blend: true, confusion: true };
    this.capFilter = new Set(Object.keys(CAPABILITY));
    this.focus = null;       // highlighted ability or search
    this.selected = null;
    this.ready = false;
    this.#buildPanel();
  }

  /** Called the first time the tab opens. */
  async open() {
    if (this.ready) { this.#resize(); return; }
    this.d3 = await import(D3);
    this.#buildGraph();
    this.ready = true;
    this.select('sadness');
  }

  // ------------------------------------------------------------------ panel

  #buildPanel() {
    // Capability legend doubles as a filter.
    const counts = {};
    for (const n of this.nodes) counts[n.cap] = (counts[n.cap] ?? 0) + 1;
    $('#mapCaps').innerHTML = Object.entries(CAPABILITY).map(([k, c]) => `
      <button class="cap-chip on" data-cap="${k}" style="--c:${c.color}"><i></i><span>${c.ro}</span><em>${counts[k] ?? 0}</em></button>`).join('');
    $('#mapCaps').addEventListener('click', (e) => {
      const b = e.target.closest('[data-cap]');
      if (!b) return;
      const k = b.dataset.cap;
      if (this.capFilter.has(k) && this.capFilter.size > 1) this.capFilter.delete(k); else this.capFilter.add(k);
      for (const x of document.querySelectorAll('#mapCaps [data-cap]')) x.classList.toggle('on', this.capFilter.has(x.dataset.cap));
      this.#restyle();
    });

    // Missing abilities, ranked by how many emotions each would unlock.
    const gaps = {};
    for (const n of this.nodes) for (const k of n.needs) if (!ABILITIES[k].have) (gaps[k] ??= []).push(n.id);
    const ranked = Object.entries(gaps).sort((a, b) => b[1].length - a[1].length);
    const max = ranked[0]?.[1].length ?? 1;
    $('#mapGaps').innerHTML = ranked.map(([k, ids]) => `
      <li data-ability="${k}" title="${esc(ABILITIES[k].how)}"><span>${ABILITIES[k].ro}</span><output>${ids.length}</output><i style="--v:${(ids.length / max).toFixed(3)}"></i></li>`).join('');
    $('#mapGaps').addEventListener('click', (e) => {
      const li = e.target.closest('[data-ability]');
      if (!li) return;
      const k = li.dataset.ability;
      const on = this.focus?.ability === k;
      this.focus = on ? null : { ability: k, ids: new Set(gaps[k]) };
      for (const x of document.querySelectorAll('#mapGaps li')) x.classList.toggle('on', !on && x.dataset.ability === k);
      const how = ABILITIES[k].how;
      $('#mapFocus').textContent = on ? '' : `${gaps[k].length} emoții au nevoie de „${ABILITIES[k].ro}”. Cum s-ar adăuga: ${how}.`;
      this.#restyle();
    });
    $('#mapHave').innerHTML = Object.values(ABILITIES).filter((a) => a.have).map((a) => `<span>${a.ro}</span>`).join('');

    // Layout and link toggles.
    $('#mapLayout').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-layout]');
      if (!b) return;
      for (const x of document.querySelectorAll('#mapLayout button')) x.classList.toggle('on', x === b);
      this.setLayout(b.dataset.layout);
    });
    $('#mapLinks').innerHTML = Object.entries(LINK_STYLE).map(([k, s]) => `
      <button class="toggle" data-link="${k}" aria-pressed="true"><b class="line" style="--c:${s.color}"></b><span>${s.ro}</span><i></i></button>`).join('');
    $('#mapLinks').addEventListener('click', (e) => {
      const b = e.target.closest('[data-link]');
      if (!b) return;
      const on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(on));
      this.showKinds[b.dataset.link] = on;
      this.#restyle();
    });

    // Search.
    const input = $('#mapSearch');
    const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    input.addEventListener('input', () => {
      const q = norm(input.value.trim());
      this.focus = q ? { search: q, ids: new Set(this.nodes.filter((n) => norm(n.ro).includes(q) || norm(n.en).includes(q)).map((n) => n.id)) } : null;
      const k = this.focus?.ids.size ?? 0;
      $('#mapFocus').textContent = q ? (k === 0 ? 'Niciun rezultat' : k === 1 ? '1 rezultat · Enter pentru detalii' : `${k} rezultate · Enter pentru primul`) : '';
      this.#restyle();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this.focus?.ids.size) this.select([...this.focus.ids][0], true);
      if (e.key === 'Escape') { input.value = ''; input.dispatchEvent(new Event('input')); }
    });

    $('#mapExportJson').addEventListener('click', () => this.#exportJSON());
    $('#mapExportCsv').addEventListener('click', () => this.#exportCSV());
  }

  // ------------------------------------------------------------------ graph

  #buildGraph() {
    const d3 = this.d3;
    const host = $('#mapView');
    this.svg = d3.select(host).append('svg').attr('class', 'map-svg');
    this.root = this.svg.append('g');
    this.axes = this.root.append('g').attr('class', 'map-axes');
    this.linkSel = this.root.append('g').selectAll('path').data(this.links).join('path')
      .attr('class', (d) => `map-link ${d.kind}`)
      .attr('stroke', (d) => LINK_STYLE[d.kind].color)
      .attr('stroke-dasharray', (d) => LINK_STYLE[d.kind].dash)
      .attr('fill', 'none');
    this.nodeSel = this.root.append('g').selectAll('g').data(this.nodes, (d) => d.id).join('g')
      .attr('class', (d) => `map-node ${d.level}`)
      .style('cursor', 'pointer')
      .on('mouseenter', (e, d) => { this.hover = d.id; this.#restyle(); })
      .on('mouseleave', () => { this.hover = null; this.#restyle(); })
      .on('click', (e, d) => { e.stopPropagation(); this.select(d.id); })
      .on('dblclick', (e, d) => { e.stopPropagation(); this.select(d.id); this.#show(d); });
    this.nodeSel.append('circle').attr('class', 'ring').attr('r', (d) => d.r + 3.2)
      .attr('fill', 'none').attr('stroke', (d) => CAPABILITY[d.cap]?.color ?? 'transparent').attr('stroke-width', 1.6);
    this.nodeSel.append('circle').attr('class', 'core').attr('r', (d) => d.r)
      .attr('fill', (d) => d3.color(FAMILY_COLORS[d.family]).darker(d.level === 'sub' ? 1.4 : d.level === 'emotion' ? 0.9 : 0.3))
      .attr('stroke', (d) => FAMILY_COLORS[d.family]).attr('stroke-width', 1);
    // Radial tree: families use a short name, so their spoke labels stop well short of the centre
    // (the long ones crossed there). The full name is in the panel and the tooltip.
    const SHORT = { love: 'Iubire', social: 'Sociale', states: 'Stări' };
    this.nodeSel.append('title').text((d) => `${d.ro} · ${CAPABILITY[d.cap]?.ro ?? ''}`);
    this.nodeSel.append('text').attr('class', 'label').text((d) => d.ro)
      .attr('data-short', (d) => SHORT[d.id] ?? d.ro).attr('data-full', (d) => d.ro)
      .attr('dy', (d) => d.r + 14).attr('text-anchor', 'middle');

    this.zoom = d3.zoom().scaleExtent([0.35, 4]).on('zoom', (e) => {
      this.root.attr('transform', e.transform);
      this.k = e.transform.k;
      this.#labels();
    });
    this.svg.call(this.zoom).on('dblclick.zoom', null).on('click', () => { this.select(null); });

    this.drag = d3.drag()
      .on('start', (e, d) => { if (this.layout !== 'force') return; if (!e.active) this.sim.alphaTarget(0.25).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag', (e, d) => { if (this.layout !== 'force') return; d.fx = e.x; d.fy = e.y; })
      .on('end', (e, d) => { if (this.layout !== 'force') return; if (!e.active) this.sim.alphaTarget(0); d.fx = null; d.fy = null; });
    this.nodeSel.call(this.drag);

    window.addEventListener('resize', () => this.#resize());
    this.#resize();
    this.setLayout(this.layout, false);
  }

  #resize() {
    if (!this.svg) return;
    const host = $('#mapView');
    this.W = host.clientWidth;
    this.H = host.clientHeight;
    this.svg.attr('width', this.W).attr('height', this.H);
    // The panel covers the right-hand side on wide screens: centre the graph in what is left.
    const panel = window.innerWidth > 900 ? 400 : 0;
    this.cx = (this.W - panel) / 2;
    this.cy = this.H / 2 + 10;
    this.span = Math.min(this.W - panel, this.H - 80);
    // The circumplex uses the whole free area: wider than tall, so the (genuinely) crowded
    // negative / high-arousal corner gets room to spread.
    this.rx = (this.W - panel) * 0.37;
    this.ry = (this.H - 190) * 0.44;
  }

  setLayout(name, animate = true) {
    this.layout = name;
    this.sim?.stop();
    const d3 = this.d3;
    // The tree's outer labels extend past its last ring: leave them room below the tab bar.
    const R = this.span * (name === 'tree' ? 0.35 : 0.44);
    const targets = {};

    if (name === 'tree') {
      const strat = d3.stratify().id((d) => d.id).parentId((d) => d.parent)(this.nodes);
      d3.tree().size([2 * Math.PI, R]).separation((a, b) => (a.parent === b.parent ? 1 : 2) / Math.max(1, a.depth))(strat);
      // Rings at chosen radii rather than evenly spaced: ten families on an evenly spaced inner
      // ring sat so close to the centre that their names overlapped.
      const RING = [0, 0.42, 0.74, 1];
      // Balanced sectors. d3.tree shares the circle by leaf count, so "Stări" (21 nodes) took a
      // quarter of it and the small families (surprise, contempt, disgust) were crushed together
      // at the bottom with overlapping names. Each family gets a sector proportional to
      // 2 + sqrt(size) instead, and its subtree is remapped into that sector.
      const fams = strat.children.slice().sort((a, b) => a.x - b.x);
      const weight = fams.map((f) => 2 + Math.sqrt(f.descendants().length));
      const total = weight.reduce((a, b) => a + b, 0);
      let start = 0;
      fams.forEach((f, i) => {
        const span = (weight[i] / total) * 2 * Math.PI;
        const nodes = f.descendants();
        const lo = Math.min(...nodes.map((d) => d.x)), hi = Math.max(...nodes.map((d) => d.x));
        const pad = span * 0.12;
        for (const d of nodes) d.x = hi > lo ? start + pad + ((d.x - lo) / (hi - lo)) * (span - 2 * pad) : start + span / 2;
        f.x = start + span / 2; // the family itself in the middle of its sector
        start += span;
      });
      strat.each((h) => {
        const r = RING[h.depth] * R;
        targets[h.id] = [r * Math.cos(h.x - Math.PI / 2), r * Math.sin(h.x - Math.PI / 2)];
      });
    } else if (name === 'va') {
      // Circumplex; a short collision pass keeps nodes apart without moving them far.
      const { rx, ry } = this;
      const pts = this.nodes.map((n) => ({ id: n.id, r: n.r + 9, x: n.v * rx, y: -n.a * ry, tx: n.v * rx, ty: -n.a * ry }));
      const s = d3.forceSimulation(pts)
        .force('x', d3.forceX((p) => p.tx).strength(0.6))
        .force('y', d3.forceY((p) => p.ty).strength(0.6))
        .force('c', d3.forceCollide((p) => p.r))
        .stop();
      for (let i = 0; i < 160; i++) s.tick();
      for (const p of pts) targets[p.id] = [p.x, p.y];
    }

    this.#drawAxes(name, R);

    if (name === 'force') {
      for (const n of this.nodes) { n.x ??= 0; n.y ??= 0; }
      const links = this.links.map((l) => ({ ...l }));
      this.sim = d3.forceSimulation(this.nodes)
        .force('link', d3.forceLink(links).id((d) => d.id)
          .distance((l) => (l.kind === 'tree' ? (l.source.level === 'root' ? 150 : 60) : 90))
          .strength((l) => (l.kind === 'tree' ? 0.7 : l.kind === 'confusion' ? 0.05 : 0.12)))
        .force('charge', d3.forceManyBody().strength((d) => (d.level === 'family' ? -520 : -160)))
        .force('collide', d3.forceCollide((d) => d.r + 10))
        .force('center', d3.forceCenter(0, 0))
        .on('tick', () => this.#place(false))
        .stop();
      // Settle it up front (300 ticks, a few ms) and frame the result, instead of letting it
      // wobble into place over seconds: the animated version also stalls whenever the tab is in
      // the background, since d3's timer runs on requestAnimationFrame. Dragging restarts it.
      for (let i = 0; i < 300; i++) this.sim.tick();
      this.#place(false);
      this.fit(animate ? 700 : 0);
      this.#restyle();
      return;
    } else {
      for (const n of this.nodes) { [n.tx, n.ty] = targets[n.id]; }
      if (animate) {
        const t0 = performance.now();
        const from = this.nodes.map((n) => [n.x ?? 0, n.y ?? 0]);
        const step = (now) => {
          const k = Math.min(1, (now - t0) / 700);
          const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
          this.nodes.forEach((n, i) => { n.x = from[i][0] + (n.tx - from[i][0]) * e; n.y = from[i][1] + (n.ty - from[i][1]) * e; });
          this.#place(name === 'tree');
          if (k < 1 && this.layout === name) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      } else {
        for (const n of this.nodes) { n.x = n.tx; n.y = n.ty; }
        this.#place(name === 'tree');
      }
    }
    this.svg.transition().duration(animate ? 600 : 0).call(this.zoom.transform, d3.zoomIdentity.translate(this.cx, this.cy).scale(1));
    this.#restyle();
  }

  /** Zoom so every node fits in the free area (left of the panel). */
  fit(duration = 700) {
    const xs = this.nodes.map((n) => n.x), ys = this.nodes.map((n) => n.y);
    const x0 = Math.min(...xs) - 40, x1 = Math.max(...xs) + 80, y0 = Math.min(...ys) - 40, y1 = Math.max(...ys) + 40;
    const panel = window.innerWidth > 900 ? 400 : 0;
    const k = Math.min(4, 0.95 * Math.min((this.W - panel) / (x1 - x0), (this.H - 150) / (y1 - y0)));
    const tx = this.cx - ((x0 + x1) / 2) * k, ty = this.cy + 20 - ((y0 + y1) / 2) * k;
    const t = this.d3.zoomIdentity.translate(tx, ty).scale(k);
    // No transition for duration 0: d3 transitions run on requestAnimationFrame, which a
    // background tab never fires.
    if (duration > 0) this.svg.transition().duration(duration).call(this.zoom.transform, t);
    else this.svg.call(this.zoom.transform, t);
  }

  #drawAxes(name, R) {
    this.axes.selectAll('*').remove();
    if (name !== 'va') return;
    const a = this.axes;
    const X = this.rx, Y = this.ry;
    a.append('ellipse').attr('rx', X).attr('ry', Y).attr('class', 'ax-circle');
    a.append('line').attr('x1', -X * 1.06).attr('x2', X * 1.06).attr('class', 'ax');
    a.append('line').attr('y1', -Y * 1.08).attr('y2', Y * 1.08).attr('class', 'ax');
    const lab = [[X * 1.08, 4, 'Plăcut →', 'start'], [-X * 1.08, 4, '← Neplăcut', 'end'], [0, -Y * 1.1, 'Activare ridicată', 'middle'], [0, Y * 1.1 + 12, 'Calm / energie scăzută', 'middle']];
    for (const [x, y, t, anchor] of lab) a.append('text').attr('x', x).attr('y', y).attr('text-anchor', anchor).attr('class', 'ax-label').text(t);
    const quad = [[X * 0.66, -Y * 0.72, 'entuziasm'], [-X * 0.66, -Y * 0.72, 'alarmă'], [-X * 0.66, Y * 0.72, 'descurajare'], [X * 0.66, Y * 0.72, 'relaxare']];
    for (const [x, y, t] of quad) a.append('text').attr('x', x).attr('y', y).attr('text-anchor', 'middle').attr('class', 'ax-quad').text(t);
  }

  #place(curved) {
    this.nodeSel.attr('transform', (d) => `translate(${d.x},${d.y})`);
    // Tree: emotions and sub-emotions label outward along their branch (the usual radial-tree
    // reading), flipped on the left half so text is never upside down. Other layouts: below.
    const radial = this.layout === 'tree';
    this.nodeSel.select('text.label').each(function (d) {
      const t = this;
      t.textContent = radial && d.level === 'family' ? t.dataset.short : t.dataset.full;
      if (radial && d.level === 'family') {
        // Families: along their spoke, reading toward the centre. The spokes diverge, so these
        // cannot collide the way horizontal labels did, and the space between the centre and the
        // family ring is otherwise empty.
        const ang = Math.atan2(d.y, d.x) * 180 / Math.PI;
        const left = Math.abs(ang) > 90;
        t.setAttribute('transform', `rotate(${left ? ang + 180 : ang})`);
        t.setAttribute('text-anchor', left ? 'start' : 'end');
        t.setAttribute('dx', (left ? 1 : -1) * (d.r + 6));
        t.setAttribute('dy', '0.32em');
        return;
      }
      if (radial && d.level === 'root') {
        t.style.display = 'none';
        return;
      }
      if (!radial || d.level === 'root' || d.level === 'family') {
        t.setAttribute('transform', '');
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('dy', d.r + 14);
        t.setAttribute('dx', 0);
        return;
      }
      const ang = Math.atan2(d.y, d.x) * 180 / Math.PI;
      const left = Math.abs(ang) > 90;
      t.setAttribute('transform', `rotate(${left ? ang + 180 : ang})`);
      t.setAttribute('text-anchor', left ? 'end' : 'start');
      t.setAttribute('dy', '0.32em');
      t.setAttribute('dx', (left ? -1 : 1) * (d.r + 6));
    });
    this.linkSel.attr('d', (l) => {
      const s = this.nodeById[typeof l.source === 'object' ? l.source.id : l.source];
      const t = this.nodeById[typeof l.target === 'object' ? l.target.id : l.target];
      if (l.kind === 'tree' && curved) {
        // Radial elbow toward the centre, so the tree reads as branches.
        const mx = (s.x + t.x) / 2 * 0.9, my = (s.y + t.y) / 2 * 0.9;
        return `M${s.x},${s.y}Q${mx},${my} ${t.x},${t.y}`;
      }
      if (l.kind === 'tree') return `M${s.x},${s.y}L${t.x},${t.y}`;
      // Cross links bow outward so they don't hide behind the tree lines.
      const dx = t.x - s.x, dy = t.y - s.y;
      const cx = (s.x + t.x) / 2 - dy * 0.18, cy = (s.y + t.y) / 2 + dx * 0.18;
      return `M${s.x},${s.y}Q${cx},${cy} ${t.x},${t.y}`;
    });
    this.#labels();
  }

  // Labels: families and emotions always; sub-emotions when zoomed in or relevant.
  #labels() {
    if (!this.nodeSel) return;
    const k = this.k ?? 1;
    const lit = this.#litSet();
    this.nodeSel.select('text.label').style('display', (d) => {
      if (d.level === 'root') return this.layout === 'tree' ? 'none' : null;
      if (d.level === 'family') return null;
      if (lit && lit.has(d.id)) return null;
      if (this.layout === 'va') return k > (d.level === 'emotion' ? 1.3 : 1.9) ? null : 'none';
      if (d.level === 'emotion') return k > 0.7 ? null : 'none';
      return k > 1.5 ? null : 'none';
    });
  }

  #litSet() {
    if (this.hover) return this.neighbours[this.hover];
    if (this.selected) return this.neighbours[this.selected];
    return this.focus?.ids ?? null;
  }

  #restyle() {
    if (!this.nodeSel) return;
    const lit = this.#litSet();
    const shown = (d) => this.capFilter.has(d.cap) || d.cap === 'root';
    const focusIds = this.focus?.ids;
    this.nodeSel
      .classed('dim', (d) => !shown(d) || (focusIds && !focusIds.has(d.id) && !(lit?.has(d.id))) || (!!lit && !focusIds && !lit.has(d.id)))
      .classed('sel', (d) => d.id === this.selected)
      .classed('hit', (d) => !!focusIds?.has(d.id));
    const id = (x) => (typeof x === 'object' ? x.id : x);
    this.linkSel
      .style('display', (l) => {
        if (!this.showKinds[l.kind]) return 'none';
        if (l.kind === 'tree' && this.layout === 'va' && !(lit && lit.has(id(l.source)) && lit.has(id(l.target)))) return 'none';
        return null;
      })
      .classed('lit', (l) => !!lit && lit.has(id(l.source)) && lit.has(id(l.target)) && (id(l.source) === (this.hover ?? this.selected) || id(l.target) === (this.hover ?? this.selected)))
      .classed('dim', (l) => !!lit && !(lit.has(id(l.source)) && lit.has(id(l.target))));
    this.#labels();
  }

  // ------------------------------------------------------------------ selection

  select(id, center = false) {
    this.selected = id;
    this.#restyle();
    this.#renderDetail(id ? this.nodeById[id] : null);
    if (center && id && this.svg) {
      const n = this.nodeById[id];
      const k = Math.max(1.4, this.k ?? 1);
      this.svg.transition().duration(600).call(this.zoom.transform, this.d3.zoomIdentity.translate(this.cx - n.x * k, this.cy - n.y * k).scale(k));
    }
  }

  #show(n) {
    if (!n.facs && !n.preset) {
      this.notify(`„${n.ro}” nu are o expresie facială proprie: ${ABILITIES.context.how}`, 'err');
      return;
    }
    this.onShow(n);
  }

  #renderDetail(n) {
    const box = $('#mapDetail');
    if (!n) { box.innerHTML = '<p class="muted">Apasă pe un nod pentru detalii. Dublu-clic îl arată pe față.</p>'; return; }
    const cap = CAPABILITY[n.cap] ?? { ro: 'Rădăcina spectrului', color: '#e9f5f9' };
    const fam = this.nodeById[n.family];
    const path = [];
    for (let p = n; p && p.level !== 'root'; p = this.nodeById[p.parent]) path.unshift(p.ro);
    const aus = n.facs ? describeRecipe(n.facs) : [];
    const needs = n.needs.map((k) => `<li class="${ABILITIES[k].have ? 'have' : 'miss'}"><span>${ABILITIES[k].have ? '✓' : '＋'}</span>${ABILITIES[k].ro}</li>`).join('');
    const rel = (kind, title) => {
      const list = LINKS.filter(([a, b, k]) => k === kind && (a === n.id || b === n.id)).map(([a, b]) => (a === n.id ? b : a));
      return list.length ? `<div class="rel"><b>${title}</b>${list.map((id) => `<button data-go="${id}">${this.nodeById[id].ro}</button>`).join('')}</div>` : '';
    };
    const children = this.nodes.filter((c) => c.parent === n.id);
    const va = (v, a) => `
      <svg class="va-mini" viewBox="-50 -50 100 100" aria-label="valență ${v}, activare ${a}">
        <circle r="44" /><line x1="-48" x2="48" /><line y1="-48" y2="48" />
        <circle class="dot" cx="${(v * 44).toFixed(1)}" cy="${(-a * 44).toFixed(1)}" r="5" />
      </svg>`;
    box.innerHTML = `
      <div class="det-head" style="--c:${FAMILY_COLORS[n.family]}">
        <b>${esc(n.ro)}</b><em>${esc(n.en)}</em>
      </div>
      <div class="det-path">${path.map(esc).join(' › ') || 'Spectrul afectiv'}</div>
      <div class="det-cap" style="--c:${cap.color}"><i></i>${cap.ro}</div>
      <p class="det-def">${esc(n.def)}</p>
      <div class="det-grid">
        ${va(n.v, n.a)}
        <dl>
          <dt>Valență</dt><dd>${n.v > 0 ? '+' : ''}${n.v.toFixed(2)}</dd>
          <dt>Activare</dt><dd>${n.a > 0 ? '+' : ''}${n.a.toFixed(2)}</dd>
          <dt>Din față</dt><dd class="recog ${n.recog}">${n.recog}</dd>
        </dl>
      </div>
      ${aus.length ? `<div class="det-sec"><b>Rețeta FACS</b><code>${esc(n.facs)}</code><ul class="au-list">${aus.map((t) => `<li><span>${t.side ?? ''}AU${t.au}${t.level}</span>${esc(t.name)}</li>`).join('')}</ul></div>`
    : n.level !== 'root' && n.facs !== '' ? '<div class="det-sec"><b>Rețeta FACS</b><p class="muted">Nu are o expresie facială proprie — se recunoaște din context, voce sau comportament.</p></div>' : ''}
      ${needs ? `<div class="det-sec"><b>Are nevoie de</b><ul class="needs">${needs}</ul></div>` : ''}
      ${n.cues ? `<div class="det-sec"><b>Semne</b><p>${esc(n.cues)}</p></div>` : ''}
      ${rel('confusion', 'Se confundă cu')}${rel('blend', 'Compusă din / cu')}${rel('intensity', 'Aceeași emoție, altă intensitate')}
      ${children.length ? `<div class="rel"><b>${n.level === 'family' || n.level === 'root' ? 'Conține' : 'Nuanțe'}</b>${children.map((c) => `<button data-go="${c.id}">${c.ro}</button>`).join('')}</div>` : ''}
      ${n.data.length ? `<div class="det-sec"><b>Date</b><ul class="data-list">${n.data.map((k) => `<li><span>${DATASETS[k].name}</span>${DATASETS[k].what}</li>`).join('')}</ul></div>` : ''}
      ${n.level !== 'root' ? `<div class="det-sec"><b>Etichetă</b><code class="label-code">${esc(this.#labelPath(n))}</code></div>` : ''}
      <div class="row2">
        <button class="primary" id="detShow" ${n.facs || n.preset ? '' : 'disabled'}>Arată pe față</button>
        <button class="ghost" id="detCopy" ${n.level === 'root' ? 'disabled' : ''}>Copiază eticheta</button>
      </div>`;
    box.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => this.select(b.dataset.go, true)));
    $('#detShow')?.addEventListener('click', () => this.#show(n));
    $('#detCopy')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(JSON.stringify(this.#labelFor(n)));
        this.notify('Eticheta a fost copiată');
      } catch {
        this.notify('Browserul nu permite copierea aici', 'err');
      }
    });
  }

  // ------------------------------------------------------------------ labels and export

  // Hierarchical label: family / emotion / sub-emotion (missing levels stay empty).
  #labelFor(n) {
    const chain = [];
    for (let p = n; p && p.level !== 'root'; p = this.nodeById[p.parent]) chain.unshift(p.id);
    return { family: chain[0] ?? null, emotion: chain[1] ?? null, sub_emotion: chain[2] ?? null, valence: n.v, arousal: n.a };
  }

  #labelPath(n) {
    const l = this.#labelFor(n);
    return [l.family, l.emotion, l.sub_emotion].filter(Boolean).join('/');
  }

  #download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  #exportJSON() {
    const data = {
      format: 'neural-face-emotion-taxonomy',
      version: 1,
      exportedAt: new Date().toISOString(),
      labelSchema: LABEL_SCHEMA,
      capabilities: CAPABILITY,
      abilities: ABILITIES,
      datasets: DATASETS,
      nodes: this.nodes.map((n) => ({
        id: n.id, ro: n.ro, en: n.en, level: n.level, parent: n.parent, family: n.family,
        label: n.level === 'root' ? null : this.#labelFor(n),
        valence: n.v, arousal: n.a, facs: n.facs || null, preset: n.preset,
        capability: n.cap, recognisability: n.recog, needs: n.needs, cues: n.cues, definition: n.def, datasets: n.data,
      })),
      links: LINKS.map(([source, target, kind]) => ({ source, target, kind })),
    };
    this.#download('neural-face-taxonomie-emotii.json', JSON.stringify(data, null, 1), 'application/json');
  }

  // An empty annotation sheet with every field the schema asks for, plus one example row.
  #exportCSV() {
    const aus = [1, 2, 4, 5, 6, 7, 9, 10, 12, 14, 15, 16, 17, 18, 20, 22, 23, 24, 25, 26, 27, 28, 43, 45];
    const cols = ['file', 'person_id', 'capture', 'family', 'emotion', 'sub_emotion', 'intensity', 'valence', 'arousal',
      ...aus.map((a) => `AU${a}`), 'head_pitch', 'head_yaw', 'head_roll', 'gaze', 'tears', 'blush', 'context', 'annotator', 'confidence'];
    const ex = ['img_0001.jpg', 'p01', 'spontan', 'sadness', 'melancholy', '', '0.6', '-0.5', '-0.5',
      ...aus.map((a) => ({ 1: 3, 15: 2, 17: 1, 43: 1 }[a] ?? 0)), '4', '0', '2', 'jos', '0', '0', 'a primit o veste proastă', 'A1', '0.8'];
    const csv = [cols.join(','), ex.map((v) => (/[,"]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(',')].join('\n');
    this.#download('neural-face-sablon-etichetare.csv', csv, 'text/csv');
  }
}

// How to label faces so the data can train (and evaluate) this model. Exported with the taxonomy.
export const LABEL_SCHEMA = {
  categorical: 'family / emotion / sub_emotion — ierarhic; lasă nivelurile adânci goale dacă nu ești sigur',
  intensity: '0–1 (sau 1–5): cât de puternică e expresia',
  dimensional: 'valence și arousal în [-1, 1] — permit comparații între categorii și prind stările mixte',
  facs: 'intensitatea fiecărei AU pe scara FACS 0–5 (A–E); exact mușchii pe care îi are modelul',
  nonFacial: 'tears, blush, posture, voice — booleene; fără ele durerea, jena, mândria nu se pot învăța',
  meta: 'person_id (împarte train/test pe persoane, nu pe imagini), capture = pozat | spontan, unghi, lumină',
  agreement: 'cel puțin 2 adnotatori pe imagine; raportează acordul (Cohen κ / Krippendorff α)',
  blendshapes: BLENDSHAPES.filter((n) => n !== '_neutral'),
};
