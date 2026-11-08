/*
 * The "Studio emoții" tab: pick an emotion, shape it, capture one from a photo, keep a library.
 * Owns the Performer (which animates the face) and the panel's DOM; main.js feeds its frames to
 * the rig.
 */

import { EMOTIONS, EMOTION_ORDER, SAD_DEPTHS, Performer, recognise } from './emotions.js';
import { UNITS, MUSCLES, CH, musclesToWeights, weightsToMuscles, muscleActivity } from '../muscle/muscles.js';
import { Library } from './library.js';
import { ImageAnalyzer, toExpression, drawOverlay, faceThumbnail } from './imageCapture.js';
import { SCENARIOS, ScenePlayer } from './timeline.js';
import { TextNet, TEXT_EMOTIONS } from './textNet.js';
import { sceneFromText, liveTarget, EMOTION_RO } from './textScene.js';

const $ = (s, root = document) => root.querySelector(s);

// Caption labels: each anatomical muscle with the FACS action units it produces.
const MUSCLE_NAME = Object.fromEntries(MUSCLES.map((m) => [m.key, m.name]));
const MUSCLE_AU = Object.fromEntries(MUSCLES.map((m) => [m.key, [...new Set(UNITS.filter((u) => u.muscles.includes(m.key)).map((u) => u.au))].join(' ')]));

const GROUPS = [
  ['brows', 'Sprâncene'],
  ['eyes', 'Ochi și pleoape'],
  ['mouth', 'Gură'],
  ['chin', 'Bărbie și maxilar'],
  ['head', 'Cap și privire'],
];

export class EmotionStudio {
  /**
   * @param {object} o
   * @param {() => string|null} o.snapshot returns a thumbnail (data URL) of the current face
   * @param {(msg: string, kind?: string) => void} o.notify status line
   */
  constructor({ snapshot, notify }) {
    this.snapshot = snapshot;
    this.notify = notify;
    this.performer = new Performer();
    this.library = new Library();
    this.analyzer = new ImageAnalyzer();
    this.active = false;

    this.base = EMOTIONS.neutral; // expression being shown, before adjustments
    this.baseKey = 'neutral';
    this.baseLabel = EMOTIONS.neutral.name;
    this.baseSource = 'emotion';
    this.intensity = 1;
    this.groups = { brows: 1, eyes: 1, mouth: 1, chin: 1, head: 1 };
    this.overrides = {}; // per-unit muscle edits from the advanced panel: { unitKey: 0..1 }
    this.capture = null; // last analysed photo
    this.neutralRef = null; // { name, raw } a neutral photo of the same person

    this.#buildEmotionGrid();
    this.#buildGroupSliders();
    this.#buildAdvanced();
    this.#wireCapture();
    this.#wireLibrary();
    this.#wireMisc();
    this.#wireScene();
    this.renderLibrary();
    this.select('sad');
  }

  // ------------------------------------------------------------------ state -> performer

  /**
   * The expression as the muscles make it, with the per-muscle edits applied (what gets shown
   * and saved). Every face passes through the muscle layer (js/muscle/muscles.js): presets,
   * photos and library entries are turned into muscle activations and back, so what is shown is
   * always something the anatomy can do (round-trip error under 0.005, tools/check-muscles.mjs).
   */
  current() {
    const a = this.#muscles();
    return { ...this.base, w: musclesToWeights(a, this.base.w) };
  }

  /** Unit activations of the current expression (both sides), edits included. */
  #muscles() {
    const a = weightsToMuscles(this.base.w);
    for (const [k, v] of Object.entries(this.overrides)) { a[CH[k + 'R']] = v; a[CH[k + 'L']] = v; }
    return a;
  }

  #apply() {
    this.performer.setTarget(this.current(), { intensity: this.intensity, groups: this.groups });
    this.#syncAdvanced();
  }

  select(key) {
    this.#leaveScene();
    if (this.live) this.#setLive(false);
    this.baseKey = key;
    this.base = EMOTIONS[key];
    this.baseLabel = this.base.name;
    this.baseSource = 'emotion';
    this.overrides = {};
    const family = this.base.family === 'sad' ? 'sad' : key;
    for (const b of document.querySelectorAll('#emoGrid button')) b.classList.toggle('on', b.dataset.emo === family);
    $('#sadDepth').hidden = this.base.family !== 'sad';
    for (const b of document.querySelectorAll('#sadDepth button')) b.classList.toggle('on', b.dataset.depth === key);
    this.#apply();
  }

  /** Show a stored or captured expression. */
  showExpression(expr, label, source) {
    this.#leaveScene();
    this.baseKey = null;
    this.base = {
      name: label,
      w: { ...expr.w },
      head: { ...expr.head },
      gaze: [...expr.gaze],
      skin: expr.skin ? { ...expr.skin } : undefined,
      life: expr.life ?? EMOTIONS.neutral.life,
    };
    this.baseLabel = label;
    this.baseSource = source;
    this.overrides = {};
    for (const b of document.querySelectorAll('#emoGrid button')) b.classList.remove('on');
    $('#sadDepth').hidden = true;
    this.#apply();
  }

  /** Per frame. @returns { w, head (radians), gaze, skin } */
  update(dt) {
    const sc = this.scene;
    const f = sc.active ? sc.update(dt) : this.performer.update(dt);
    if (sc.active) {
      this.baseLabel = sc.beatLabel;
      this.#sceneUI();
    }
    this.#caption(f.w);
    return f;
  }

  // ------------------------------------------------------------------ scenario (timeline)

  #wireScene() {
    this.scene = new ScenePlayer(this.performer, { onLine: (l) => this.#subtitle(l) });
    const list = [...SCENARIOS, { id: 'text', name: 'Din text (rețeaua neuronală)' }];
    $('#sceneList').innerHTML = list.map((sc) => `<button data-scene="${sc.id}">${sc.name}</button>`).join('');
    // The text-to-emotion network (weights ~1.5 MB) loads in the background.
    this.netReady = TextNet.load().then((net) => { this.net = net; this.#renderWords(); }).catch((e) => {
      console.warn('[textnet]', e);
      $('#sceneWords').textContent = 'Rețeaua text → emoție nu s-a încărcat.';
    });
    $('#sceneList').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) this.playScene(b.dataset.scene);
    });
    const first = SCENARIOS[0];
    $('#sceneHeard').value = first.heard;
    $('#sceneReply').value = first.reply;
    for (const [id, key] of [['#sceneHeard', 'heard'], ['#sceneReply', 'reply']]) {
      $(id).addEventListener('input', () => {
        if (key === 'heard') {
          this.#renderWords();
          if (this.live) { this.#liveFace(); return; }
        }
        if (!this.scene.active) return;
        // A scene made from text is re-made from the new text; a written scene only re-times.
        if (this.scene.scene.id === 'text') this.#loadTextScene(this.scene.t);
        else this.scene.setText(key, $(id).value);
        this.#renderTrack();
      });
      $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') this.playScene(this.scene.scene?.id ?? first.id); });
    }
    $('#sceneSound').addEventListener('click', (e) => {
      const b = e.currentTarget;
      const on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(on));
      this.scene.sound = on;
      if (!on) this.scene.stopVoice();
    });
    $('#sceneExit').addEventListener('click', () => this.select('neutral'));
    $('#textLive').addEventListener('click', (e) => {
      const b = e.currentTarget;
      this.live = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(this.live));
      if (this.live) this.#liveFace();
    });
    $('#scenePlay').addEventListener('click', () => (this.scene.playing ? this.scene.pause() : this.scene.play()));
    $('#sceneRestart').addEventListener('click', () => { this.scene.seek(0); this.scene.play(); });
    $('#sceneSpeed').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      this.scene.speed = Number(b.dataset.speed);
      for (const x of $('#sceneSpeed').children) x.classList.toggle('on', x === b);
    });
    // Scrub: drag along the track to see any moment.
    const track = $('#sceneTrack');
    const at = (e) => {
      const r = track.getBoundingClientRect();
      return clamp01((e.clientX - r.left) / r.width) * this.scene.duration;
    };
    track.addEventListener('pointerdown', (e) => {
      this.scrubbing = { wasPlaying: this.scene.playing };
      this.scene.pause();
      track.setPointerCapture(e.pointerId);
      this.scene.seek(at(e));
    });
    track.addEventListener('pointermove', (e) => {
      if (!this.scrubbing) return;
      // Replaying to the moment costs a few ms; skip intermediate positions while dragging fast.
      const now = performance.now();
      if (now - (this.scrubT ?? 0) < 40) return;
      this.scrubT = now;
      this.scene.seek(at(e));
    });
    const end = (e) => {
      if (!this.scrubbing) return;
      this.scene.seek(at(e));
      if (this.scrubbing.wasPlaying) this.scene.play();
      this.scrubbing = null;
    };
    track.addEventListener('pointerup', end);
    track.addEventListener('pointercancel', () => { this.scrubbing = null; });
    window.addEventListener('keydown', (e) => {
      if (!this.active || !this.scene.active || e.target instanceof HTMLInputElement) return;
      if (e.key === ' ') { e.preventDefault(); $('#scenePlay').click(); }
    });
  }

  /** Start a scenario from the beginning (with the texts typed in the panel). */
  playScene(id) {
    if (id === 'text' && !this.net) { this.netReady.then(() => this.net && this.playScene(id)); return; }
    const sc = id === 'text' ? sceneFromText(this.net, $('#sceneHeard').value, $('#sceneReply').value) : SCENARIOS.find((s) => s.id === id);
    if (!sc) return;
    this.#setLive(false);
    this.baseKey = null;
    this.baseSource = 'scene';
    this.overrides = {};
    for (const b of document.querySelectorAll('#emoGrid button')) b.classList.remove('on');
    $('#sadDepth').hidden = true;
    for (const b of document.querySelectorAll('#sceneList button')) b.classList.toggle('on', b.dataset.scene === id);
    this.scene.load(sc, { heard: $('#sceneHeard').value, reply: $('#sceneReply').value });
    this.scene.play();
    this.#renderTrack();
    $('#sceneBar').hidden = false;
    $('#sceneExit').hidden = false;
    document.body.classList.add('scene');
  }

  #loadTextScene(t = 0) {
    const sc = sceneFromText(this.net, $('#sceneHeard').value, $('#sceneReply').value);
    const playing = this.scene.playing;
    this.scene.load(sc, { heard: sc.heard, reply: sc.reply });
    this.scene.seek(Math.min(t, this.scene.duration));
    if (playing) this.scene.play();
  }

  /** The words of "Celălalt spune" coloured by the emotion the network reads at each of them. */
  #renderWords() {
    const box = $('#sceneWords');
    if (!this.net) return;
    const a = this.net.analyse($('#sceneHeard').value);
    box.innerHTML = a.toks.map((t, i) => {
      const k = TEXT_EMOTIONS[a.dom[i]];
      const x = a.states[i][a.dom[i]];
      const pct = Math.round(x * 100);
      return `${a.seg[i] && i ? '<i class="tw-cut"></i>' : ''}<span class="tw k-${k}" style="--x:${x.toFixed(2)}" title="${EMOTION_RO[k]} ${pct}%">${escapeHtml(t)}</span>`;
    }).join('');
  }

  #setLive(on) {
    this.live = on;
    $('#textLive').setAttribute('aria-pressed', String(on));
  }

  /** Live: the face follows the text as it is typed. */
  #liveFace() {
    if (!this.net) return;
    this.#leaveScene();
    const { expr, analysis: a } = liveTarget(this.net, $('#sceneHeard').value);
    const k = TEXT_EMOTIONS[a.dom.at(-1) ?? 0];
    this.baseKey = null;
    this.base = { name: EMOTION_RO[k], ...expr };
    this.baseLabel = `Live · ${EMOTION_RO[k]}`;
    this.baseSource = 'text';
    this.overrides = {};
    for (const b of document.querySelectorAll('#emoGrid button')) b.classList.remove('on');
    $('#sadDepth').hidden = true;
    this.#apply();
  }

  #leaveScene() {
    if (!this.scene?.active) return;
    // The caller (select / showExpression) sets the next target; the face moves on from here.
    this.scene.unload();
    $('#sceneBar').hidden = true;
    $('#sceneExit').hidden = true;
    document.body.classList.remove('scene');
    for (const b of document.querySelectorAll('#sceneList button')) b.classList.remove('on');
  }

  #renderTrack() {
    const sc = this.scene;
    const D = sc.duration;
    const pct = (t) => `${((t / D) * 100).toFixed(2)}%`;
    $('#sceneBeats').innerHTML = sc.beats.map((b, i) => {
      const end = sc.beats[i + 1]?.t ?? D;
      return `<div class="sb-beat k-${b.kind ?? b.expr}" style="left:${pct(b.t)};width:${pct(end - b.t)}" title="${b.label}"><span>${b.label}</span></div>`;
    }).join('');
    $('#sceneLines').innerHTML = sc.lines.filter((l) => l.text).map((l) => `
      <div class="sb-line ${l.who}" style="left:${pct(l.t)};width:${pct(l.dur)}" title="${escapeHtml(l.text)}"><span>„${escapeHtml(l.text)}”</span></div>`).join('');
  }

  #sceneUI() {
    const sc = this.scene;
    $('#sceneHead').style.left = `${((sc.t / sc.duration) * 100).toFixed(3)}%`;
    $('#sceneBar').classList.toggle('playing', sc.playing);
    const m = Math.floor(sc.t / 60);
    $('#sceneTime').textContent = `${m}:${(sc.t % 60).toFixed(1).padStart(4, '0')}`;
    for (const [i, el] of [...$('#sceneBeats').children].entries()) el.classList.toggle('now', i === sc.beat);
  }

  #subtitle(l) {
    const box = $('#sceneSub');
    box.hidden = !l;
    if (!l) return;
    box.classList.toggle('self', l.who === 'self');
    $('#sceneSubWho').textContent = l.who === 'self' ? 'Avatarul' : 'Celălalt';
    $('#sceneSubText').textContent = l.text;
  }

  // ------------------------------------------------------------------ panel

  #buildEmotionGrid() {
    $('#emoGrid').innerHTML = EMOTION_ORDER.map((k) => `<button data-emo="${k}">${EMOTIONS[k].name}</button>`).join('');
    $('#emoGrid').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      this.select(b.dataset.emo);
    });
    $('#sadDepth').innerHTML = SAD_DEPTHS.map((k) => `<button data-depth="${k}">${EMOTIONS[k].name}</button>`).join('');
    $('#sadDepth').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) this.select(b.dataset.depth);
    });
    this.#slider($('#emoIntensity'), 100, (v) => { this.intensity = v / 100; this.#apply(); });
  }

  #buildGroupSliders() {
    const box = $('#emoGroups');
    box.innerHTML = GROUPS.map(([k, label]) => `
      <div class="slider"><span>${label}</span><output>100</output><input type="range" min="0" max="150" value="100" data-group="${k}" /></div>`).join('') + `
      <div class="slider"><span>Asimetrie naturală</span><output>100</output><input type="range" min="0" max="250" value="100" data-setting="asym" /></div>
      <div class="slider"><span>Viață (clipit, respirație, micro-mișcări)</span><output>100</output><input type="range" min="0" max="150" value="100" data-setting="life" /></div>`;
    for (const input of box.querySelectorAll('input')) {
      this.#slider(input, Number(input.value), (v) => {
        if (input.dataset.group) this.groups[input.dataset.group] = v / 100;
        else this.performer.settings[input.dataset.setting] = v / 100;
        this.#apply();
      });
    }
    $('#emoReset').addEventListener('click', () => {
      for (const input of box.querySelectorAll('input')) this.#setSlider(input, 100);
      this.groups = { brows: 1, eyes: 1, mouth: 1, chin: 1, head: 1 };
      this.performer.settings = { life: 1, asym: 1 };
      this.overrides = {};
      this.intensity = 1;
      this.#setSlider($('#emoIntensity'), 100);
      this.#apply();
    });
  }

  // One slider per functional unit (both sides), named by what it does, its FACS code and the
  // muscle(s) doing it.
  #buildAdvanced() {
    const box = $('#emoMuscles');
    const mName = Object.fromEntries(MUSCLES.map((m) => [m.key, m.name]));
    box.innerHTML = UNITS.map((u) => `
      <div class="muscle" data-m="${u.key}" title="${u.muscles.map((m) => mName[m]).join(' + ')}${u.hidden ? ' — nu se vede din camera (gât)' : ''}">
        <span>${u.ro}</span><output>0</output><input type="range" min="0" max="100" value="0" />
        <small>${u.au} · ${u.muscles.map((m) => mName[m]).join(' + ')}</small>
      </div>`).join('');
    for (const row of box.querySelectorAll('.muscle')) {
      const input = $('input', row);
      this.#slider(input, 0, (v) => {
        this.overrides[row.dataset.m] = v / 100;
        this.baseSource = 'edit';
        this.#apply();
      });
    }
  }

  #syncAdvanced() {
    const a = this.#muscles();
    for (const row of document.querySelectorAll('#emoMuscles .muscle')) {
      const input = $('input', row);
      if (document.activeElement === input) continue;
      const k = row.dataset.m;
      this.#setSlider(input, Math.round(((a[CH[k + 'R']] + a[CH[k + 'L']]) / 2) * 100));
    }
  }

  #slider(input, value, onInput) {
    this.#setSlider(input, value);
    input.addEventListener('input', () => {
      const v = Number(input.value);
      this.#setSlider(input, v);
      onInput(v);
    });
  }

  #setSlider(input, v) {
    input.value = String(v);
    input.style.setProperty('--p', `${(v / Number(input.max)) * 100}%`);
    const out = input.parentElement.querySelector('output');
    if (out) out.textContent = String(v);
  }

  // Top active muscles, named, under the face.
  #caption(w) {
    const now = performance.now();
    if (now - (this.capT ?? 0) < 250) return;
    this.capT = now;
    // The muscles doing the work, by name (both sides together), with their FACS codes.
    this.capUnits = weightsToMuscles(w, { out: this.capUnits, iters: 20 });
    const act = muscleActivity(this.capUnits);
    const agg = {};
    for (const m of MUSCLES) agg[m.key] = Math.max(act[m.key + 'R'] ?? 0, act[m.key + 'L'] ?? 0);
    delete agg.orbOculiPalp; // blinking is life, not expression
    const top = Object.entries(agg).filter(([, v]) => v > 0.12).sort((a, b) => b[1] - a[1]).slice(0, 4);
    $('#emoCapName').textContent = this.baseLabel;
    $('#emoCapAU').innerHTML = top.length
      ? top.map(([k, v]) => `<li style="--v:${v.toFixed(2)}"><b>${MUSCLE_AU[k]}</b>${MUSCLE_NAME[k]}</li>`).join('')
      : '<li class="rest">mușchii feței în repaus</li>';
  }

  // ------------------------------------------------------------------ photo capture

  #wireCapture() {
    const drop = $('#capDrop');
    const file = $('#capFile');
    drop.addEventListener('click', () => file.click());
    file.addEventListener('change', () => { if (file.files[0]) this.analyseFile(file.files[0]); file.value = ''; });
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      drop.classList.remove('over');
      const f = [...(e.dataTransfer?.files ?? [])].find((x) => x.type.startsWith('image/'));
      if (f) this.analyseFile(f);
    });
    window.addEventListener('paste', (e) => {
      if (!this.active) return;
      const item = [...(e.clipboardData?.items ?? [])].find((x) => x.type.startsWith('image/'));
      if (item) this.analyseFile(item.getAsFile());
    });
    $('#capApply').addEventListener('click', () => this.#applyCapture());
    $('#capSave').addEventListener('click', () => {
      if (!this.capture) return;
      this.#applyCapture();
      const name = this.capture.name.replace(/\.[a-z0-9]+$/i, '') || 'Din imagine';
      this.#save(name, 'image', this.capture.thumb);
    });
    $('#capNeutral').addEventListener('click', () => {
      if (!this.capture) return;
      this.neutralRef = { name: this.capture.name, raw: { ...this.capture.res.raw } };
      this.#renderNeutralRef();
      this.notify('Referință neutră setată · capturile următoare se măsoară față de ea');
    });
    $('#capNeutralClear').addEventListener('click', () => {
      this.neutralRef = null;
      this.#renderNeutralRef();
    });
    $('#capPose').addEventListener('click', (e) => {
      const b = e.currentTarget;
      b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
      if (this.capture && this.baseSource === 'image') this.#applyCapture();
    });
  }

  async analyseFile(f) {
    const status = $('#capStatus');
    status.textContent = 'Încarc imaginea…';
    status.className = 'cap-status';
    let img;
    try {
      img = await loadImage(f);
    } catch {
      status.textContent = 'Nu pot citi această imagine';
      status.className = 'cap-status err';
      return;
    }
    const canvas = $('#capCanvas');
    canvas.hidden = false;
    drawOverlay(canvas, img, null, []);
    status.textContent = this.analyzer.landmarker ? 'Analizez expresia…' : 'Încarc modelul facial (prima dată)…';
    let res;
    try {
      res = await this.analyzer.analyze(img);
    } catch (err) {
      console.error('[capture]', err);
      status.textContent = 'Modelul facial nu s-a încărcat · verifică internetul';
      status.className = 'cap-status err';
      return;
    }
    drawOverlay(canvas, img, res, this.analyzer.contours);
    if (!res) {
      this.capture = null;
      $('#capResult').hidden = true;
      status.textContent = 'Nu am găsit nicio față · încearcă o imagine frontală, bine luminată';
      status.className = 'cap-status err';
      return;
    }
    const expr = toExpression(res, this.neutralRef);
    this.capture = { expr, res, name: f.name ?? 'imagine', thumb: faceThumbnail(img, res) };
    const rec = recognise(expr.w);
    $('#capRecog').innerHTML = rec.slice(0, 3).map((r) => `
      <li style="--v:${r.p.toFixed(3)}"><span>${r.name}</span><output>${Math.round(r.p * 100)}%</output><i></i></li>`).join('');
    $('#capResult').hidden = false;
    status.textContent = `Expresie capturată · ${Object.values(expr.w).filter((v) => v > 0.1).length} mușchi activi`;
    status.className = 'cap-status ok';
    this.#applyCapture();
  }

  #renderNeutralRef() {
    const box = $('#capRef');
    box.hidden = !this.neutralRef;
    if (this.neutralRef) $('#capRefName').textContent = this.neutralRef.name;
  }

  #applyCapture() {
    if (!this.capture) return;
    const withPose = $('#capPose').getAttribute('aria-pressed') === 'true';
    const e = this.capture.expr;
    const expr = {
      w: e.w,
      head: withPose ? e.head : { pitch: 0, yaw: 0, roll: 0 },
      gaze: e.gaze,
      raw: e.raw,
    };
    this.showExpression(expr, 'Din imagine', 'image');
    this.captureExpr = expr;
  }

  // ------------------------------------------------------------------ library

  #wireLibrary() {
    $('#saveBtn').addEventListener('click', () => {
      const name = $('#saveName').value.trim() || this.#defaultName();
      this.#save(name, this.baseSource, null);
      $('#saveName').value = '';
    });
    $('#saveName').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#saveBtn').click(); });
    $('#lib').addEventListener('click', (e) => {
      const li = e.target.closest('li[data-id]');
      if (!li) return;
      const item = this.library.get(li.dataset.id);
      if (!item) return;
      if (e.target.closest('[data-act="del"]')) {
        if (li.classList.contains('confirm')) {
          this.library.remove(item.id);
          this.renderLibrary();
        } else {
          li.classList.add('confirm');
          setTimeout(() => li.classList.remove('confirm'), 2600);
        }
        return;
      }
      this.showExpression(item, item.name, 'edit');
      this.notify(`„${item.name}” aplicată`);
    });
    $('#libExport').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(this.library.toJSON(), null, 1)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `neural-face-expresii-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
    $('#libImport').addEventListener('click', () => $('#libFile').click());
    $('#libFile').addEventListener('change', async () => {
      const f = $('#libFile').files[0];
      $('#libFile').value = '';
      if (!f) return;
      try {
        const n = this.library.importJSON(await f.text());
        this.renderLibrary();
        this.notify(n ? `${n} expresii importate` : 'Toate expresiile existau deja');
      } catch (err) {
        this.notify(err.message || 'Fișier invalid', 'err');
      }
    });
  }

  #defaultName() {
    const pct = Math.round(this.intensity * 100);
    return pct === 100 ? this.baseLabel : `${this.baseLabel} ${pct}%`;
  }

  #save(name, source, thumb) {
    // What is saved is the TARGET (intensity and adjustments baked in), not the living frame with
    // a blink or a breath caught in it.
    const t = this.performer;
    const expr = {
      name,
      source,
      w: { ...t.target },
      head: { ...t.headT },
      gaze: [...t.gazeT],
      skin: { ...t.skinT },
      life: this.base.life,
      raw: source === 'image' ? this.captureExpr?.raw : undefined,
      thumb: thumb ?? this.snapshot(),
    };
    const item = this.library.add(expr);
    this.renderLibrary();
    this.notify(this.library.error ? `Salvată fără miniatură · ${this.library.error}` : `„${item.name}” salvată`, this.library.error ? 'err' : 'ok');
  }

  renderLibrary() {
    const items = this.library.items;
    $('#libCount').textContent = String(items.length);
    const src = { emotion: 'emoție', image: 'imagine', edit: 'ajustată' };
    $('#lib').innerHTML = items.length
      ? items.map((it) => `
        <li data-id="${it.id}">
          ${it.thumb ? `<img src="${it.thumb}" alt="" />` : '<div class="noimg"></div>'}
          <div><b>${escapeHtml(it.name)}</b><em>${src[it.source]} · ${new Date(it.createdAt).toLocaleDateString('ro-RO')}</em></div>
          <button data-act="del" title="Șterge (apasă de două ori)" aria-label="Șterge">×</button>
        </li>`).join('')
      : '<li class="empty">Nicio expresie salvată încă</li>';
  }

  #wireMisc() {
    $('#emoCaption').hidden = true;
  }

  setActive(on) {
    this.active = on;
    $('#emoCaption').hidden = !on;
    // Leaving the tab pauses the scene (and its voice); coming back shows it where it stopped.
    if (!on && this.scene?.active) this.scene.pause();
    const show = on && this.scene?.active;
    $('#sceneBar').hidden = !show;
    if (!show) $('#sceneSub').hidden = true;
    document.body.classList.toggle('scene', !!show);
  }
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
    img.src = url;
  });
}
