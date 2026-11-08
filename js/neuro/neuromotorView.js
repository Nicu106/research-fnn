import * as THREE from 'three';

/*
 * Renders the neuromotor network (neuromotor.js): nodes, the curved fibres between them, and the
 * projections from each muscle onto the skin network. Signals travel down the pathway level by
 * level (emotion first, skin last), and only along fibres whose two ends are active, so what you
 * see pulsing is the route this particular expression takes.
 *
 * All positions are bound to the AvatarRig (see bindTo), so muscles move with the face and the
 * whole pathway turns with the head.
 */

const SAMPLES = 18; // points per fibre

const NODE_VS = /* glsl */ `
  uniform float uPixelRatio;
  uniform float uVis;
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aAct;
  attribute float aHi;
  varying vec3 vColor;
  varying float vA;
  varying float vAct;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * (1.0 + aAct * 1.1 + aHi * 1.2) * uPixelRatio * (46.0 / -mv.z) * step(0.001, uVis);
    vColor = aColor;
    vA = uVis * (0.32 + 0.68 * max(aAct, aHi));
    vAct = aAct;
  }
`;
const NODE_FS = /* glsl */ `
  varying vec3 vColor;
  varying float vA;
  varying float vAct;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float core = smoothstep(0.42, 0.0, d);
    float halo = exp(-d * d * 4.0) * 0.55;
    float ring = smoothstep(0.08, 0.0, abs(d - 0.78)) * 0.7;
    vec3 col = vColor * (halo + core * 1.4 + ring) * (1.0 + vAct * 1.3) + vec3(1.0) * core * core * (0.6 + vAct);
    gl_FragColor = vec4(col, vA);
  }
`;

const FIBRE_VS = /* glsl */ `
  attribute float aT;
  attribute float aAct;
  attribute float aLevel;
  attribute vec3 aColor;
  varying float vT;
  varying float vAct;
  varying float vLevel;
  varying vec3 vColor;
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vT = aT; vAct = aAct; vLevel = aLevel; vColor = aColor;
  }
`;
const FIBRE_FS = /* glsl */ `
  uniform float uTime;
  uniform float uVis;
  varying float vT;
  varying float vAct;
  varying float vLevel;
  varying vec3 vColor;
  void main() {
    // One wave travelling down the hierarchy: each level starts a little after the one above,
    // so a signal is seen leaving the emotion and arriving at the skin.
    float head = fract(uTime * 0.55 - vLevel * 0.13) * 1.5 - 0.25;
    float dist = vT - head;
    float trail = step(dist, 0.0) * smoothstep(-0.28, 0.0, dist);
    float pulse = trail * trail * smoothstep(0.05, 0.35, vAct);
    // Idle fibres are a faint map of the wiring; active ones burn bright enough to bloom, which
    // is what makes a 1-pixel line read as a lit nerve among thousands of network edges.
    float base = 0.06 + vAct * vAct * 1.9;
    vec3 col = vColor * (base + pulse * 4.5) + vec3(1.0) * pulse * pulse * 0.9;
    gl_FragColor = vec4(col, uVis * clamp(base + pulse, 0.0, 1.0));
  }
`;

export class NeuromotorView {
  /**
   * @param nm   buildNeuromotor() result
   * @param net  the surface network (skin level), whose positions are read every frame
   */
  constructor(nm, net, { pixelRatio = 1 } = {}) {
    this.nm = nm;
    this.net = net;
    this.group = new THREE.Group();
    this.visTarget = 1;
    this.uniforms = { uTime: { value: 0 }, uVis: { value: 0 }, uPixelRatio: { value: pixelRatio } };

    const N = nm.nodes.length;
    const color = new THREE.Color();

    // ---- nodes ----
    this.nodePos = new Float32Array(N * 3);
    const nCol = new Float32Array(N * 3);
    const nSize = new Float32Array(N);
    // Structures, not cells: drawn clearly larger than the surface network's nodes (0.85-1.7).
    const SIZES = [4.6, 4.2, 4.0, 3.4, 3.1, 2.6];
    nm.nodes.forEach((n, i) => {
      this.nodePos.set(n.pos, i * 3);
      color.set(n.color);
      nCol.set([color.r, color.g, color.b], i * 3);
      nSize[i] = SIZES[n.level] ?? 1.5;
    });
    const ng = new THREE.BufferGeometry();
    ng.setAttribute('position', new THREE.BufferAttribute(this.nodePos, 3));
    ng.setAttribute('aColor', new THREE.BufferAttribute(nCol, 3));
    ng.setAttribute('aSize', new THREE.BufferAttribute(nSize, 1));
    ng.setAttribute('aAct', new THREE.BufferAttribute(new Float32Array(N), 1));
    ng.setAttribute('aHi', new THREE.BufferAttribute(new Float32Array(N), 1));
    ng.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 50);
    this.points = new THREE.Points(ng, new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: NODE_VS, fragmentShader: NODE_FS,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    // Before the head's depth-only pass (renderOrder 4), like the surface network: drawn after it,
    // everything inside the head was hidden behind its outer surface.
    this.points.renderOrder = 3;
    this.points.frustumCulled = false;

    // ---- fibres: sampled curves, stored once as sample points (bound to the rig) ----
    const E = nm.edges.length;
    this.samples = new Float32Array(E * SAMPLES * 3);
    const tmp = new THREE.Vector3();
    nm.edges.forEach((e, k) => {
      const pts = [nm.nodes[e.a].pos, ...e.via, nm.nodes[e.b].pos].map((p) => new THREE.Vector3(...p));
      const curve = pts.length > 2 ? new THREE.CatmullRomCurve3(pts, false, 'centripetal') : new THREE.LineCurve3(pts[0], pts[1]);
      // Straight links between deep structures read better with a gentle arc.
      const arc = pts.length === 2 ? pts[0].distanceTo(pts[1]) * 0.12 : 0;
      for (let j = 0; j < SAMPLES; j++) {
        const t = j / (SAMPLES - 1);
        curve.getPoint(t, tmp);
        if (arc) tmp.y += Math.sin(Math.PI * t) * arc;
        this.samples.set([tmp.x, tmp.y, tmp.z], (k * SAMPLES + j) * 3);
      }
    });
    const V = E * (SAMPLES - 1) * 2;
    const fPos = new Float32Array(V * 3);
    const fT = new Float32Array(V);
    const fLevel = new Float32Array(V);
    const fCol = new Float32Array(V * 3);
    const ca = new THREE.Color(), cb = new THREE.Color();
    nm.edges.forEach((e, k) => {
      ca.set(nm.nodes[e.a].color);
      cb.set(nm.nodes[e.b].color);
      for (let j = 0; j < SAMPLES - 1; j++) {
        for (let q = 0; q < 2; q++) {
          const v = (k * (SAMPLES - 1) + j) * 2 + q;
          const t = (j + q) / (SAMPLES - 1);
          fT[v] = t;
          fLevel[v] = nm.nodes[e.a].level;
          color.copy(ca).lerp(cb, t);
          fCol.set([color.r, color.g, color.b], v * 3);
        }
      }
    });
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
    fg.setAttribute('aT', new THREE.BufferAttribute(fT, 1));
    fg.setAttribute('aLevel', new THREE.BufferAttribute(fLevel, 1));
    fg.setAttribute('aColor', new THREE.BufferAttribute(fCol, 3));
    fg.setAttribute('aAct', new THREE.BufferAttribute(new Float32Array(V), 1));
    fg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 50);
    const fibreMat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: FIBRE_VS, fragmentShader: FIBRE_FS,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.fibres = new THREE.LineSegments(fg, fibreMat);
    this.fibres.renderOrder = 2;
    this.fibres.frustumCulled = false;

    // ---- muscle -> skin projections (straight, endpoints read live every frame) ----
    const S = nm.skin.length;
    const sPos = new Float32Array(S * 2 * 3);
    const sT = new Float32Array(S * 2);
    const sLevel = new Float32Array(S * 2).fill(5);
    const sCol = new Float32Array(S * 2 * 3);
    ca.set('#ff7a6b');
    cb.set('#9ff3ff');
    for (let k = 0; k < S; k++) {
      sT[k * 2 + 1] = 1;
      sCol.set([ca.r, ca.g, ca.b], k * 6);
      sCol.set([cb.r, cb.g, cb.b], k * 6 + 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    sg.setAttribute('aT', new THREE.BufferAttribute(sT, 1));
    sg.setAttribute('aLevel', new THREE.BufferAttribute(sLevel, 1));
    sg.setAttribute('aColor', new THREE.BufferAttribute(sCol, 3));
    sg.setAttribute('aAct', new THREE.BufferAttribute(new Float32Array(S * 2), 1));
    sg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 50);
    this.skinFibres = new THREE.LineSegments(sg, fibreMat);
    this.skinFibres.renderOrder = 2;
    this.skinFibres.frustumCulled = false;

    this.group.add(this.fibres, this.skinFibres, this.points);
    this.#layoutFibres();
    this.hi = -1;
  }

  /** Bind nodes and fibre samples to the rig so they follow the face and the head. */
  bindTo(rig) {
    const pa = this.points.geometry.getAttribute('position');
    rig.bindTarget(this.nodePos, this.nm.nodes.length, () => { pa.needsUpdate = true; });
    rig.bindTarget(this.samples, this.samples.length / 3, () => this.#layoutFibres());
  }

  #layoutFibres() {
    const src = this.samples;
    const pos = this.fibres.geometry.getAttribute('position');
    const dst = pos.array;
    const E = this.nm.edges.length;
    for (let k = 0; k < E; k++) {
      for (let j = 0; j < SAMPLES - 1; j++) {
        const v = (k * (SAMPLES - 1) + j) * 2;
        const a = (k * SAMPLES + j) * 3;
        dst[v * 3] = src[a]; dst[v * 3 + 1] = src[a + 1]; dst[v * 3 + 2] = src[a + 2];
        dst[v * 3 + 3] = src[a + 3]; dst[v * 3 + 4] = src[a + 4]; dst[v * 3 + 5] = src[a + 5];
      }
    }
    pos.needsUpdate = true;
  }

  setVisible(on) { this.visTarget = on ? 1 : 0; }

  /** Highlight one node (inspector); -1 clears. */
  setHighlight(id) {
    if (id === this.hi) return;
    const a = this.points.geometry.getAttribute('aHi');
    if (this.hi >= 0) a.array[this.hi] = 0;
    if (id >= 0) a.array[id] = 1;
    this.hi = id;
    a.needsUpdate = true;
  }

  update(time, dt) {
    const u = this.uniforms;
    u.uTime.value = time;
    u.uVis.value += (this.visTarget - u.uVis.value) * (1 - Math.exp(-dt * 5));
    this.group.visible = u.uVis.value > 0.005;
    if (!this.group.visible) return;

    const nm = this.nm;
    this.points.geometry.getAttribute('aAct').array.set(nm.act);
    this.points.geometry.getAttribute('aAct').needsUpdate = true;

    const fa = this.fibres.geometry.getAttribute('aAct');
    const per = (SAMPLES - 1) * 2;
    for (let k = 0; k < nm.edges.length; k++) fa.array.fill(nm.edgeAct[k], k * per, (k + 1) * per);
    fa.needsUpdate = true;

    // Skin projections: muscle node -> its skin nodes, wherever both are now.
    const sp = this.skinFibres.geometry.getAttribute('position');
    const sa = this.skinFibres.geometry.getAttribute('aAct');
    const np = this.net.positions, mp = this.nodePos;
    nm.skin.forEach((s, k) => {
      sp.array.set(mp.subarray(s.muscle * 3, s.muscle * 3 + 3), k * 6);
      sp.array.set(np.subarray(s.net * 3, s.net * 3 + 3), k * 6 + 3);
      sa.array[k * 2] = sa.array[k * 2 + 1] = nm.skinAct[k];
    });
    sp.needsUpdate = true;
    sa.needsUpdate = true;
  }
}
