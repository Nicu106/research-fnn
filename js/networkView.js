import * as THREE from 'three';
import { LAYERS, REGIONS } from './network.js';

const COMMON = /* glsl */ `
  uniform float uTime;
  uniform float uReveal;
  uniform float uColorMix;
  uniform float uFocus;
  uniform vec3 uLayerVis;
  uniform float uPresence;
  uniform float uActGain;
  float layerVis(float l) { return (l < 0.5 ? uLayerVis.x : (l < 1.5 ? uLayerVis.y : uLayerVis.z)) * uPresence; }
`;

const POINT_VS = /* glsl */ `
  ${COMMON}
  uniform float uPixelRatio;
  attribute float aLayer;
  attribute float aSize;
  attribute float aSeed;
  attribute float aHi;
  attribute float aAct;
  attribute vec3 aColorA;
  attribute vec3 aColorB;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vHi;
  varying float vAct;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float act = aAct * uActGain;
    gl_Position = projectionMatrix * mv;
    float vis = layerVis(aLayer);
    float reveal = smoothstep(uReveal, uReveal + 0.5, position.y);
    float scan = exp(-pow((position.y - uReveal - 0.25) * 3.0, 2.0));
    float twinkle = 0.72 + 0.28 * sin(uTime * (0.8 + aSeed * 2.2) + aSeed * 40.0);
    float focus = mix(1.0, mix(0.16, 1.0, step(0.01, aHi)), uFocus);
    float depth = smoothstep(26.0, 9.0, -mv.z);
    // Activation: a node over a contracting muscle swells and burns brighter; its twinkle steadies
    // (a firing neuron, not a flickering one).
    gl_PointSize = aSize * (1.0 + aHi * 1.5 + scan * 1.8 + act * 1.4) * uPixelRatio * (46.0 / -mv.z) * vis * reveal;
    vColor = mix(aColorA, aColorB, uColorMix);
    vAlpha = vis * reveal * (mix(twinkle, 1.0, act) * focus * mix(0.5, 1.0, depth) * (1.0 + act * 0.8) + scan);
    vHi = aHi;
    vAct = act;
  }
`;

const POINT_FS = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vHi;
  varying float vAct;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float core = smoothstep(0.38, 0.0, d);
    float halo = exp(-d * d * 5.0) * 0.6;
    float ring = smoothstep(0.1, 0.0, abs(d - 0.8)) * step(0.9, vHi);
    vec3 col = vColor * (halo + core * 1.5 + ring * 2.0) * (1.0 + vAct * 1.2) + vec3(1.0) * core * core * (0.9 + vAct * 1.4);
    gl_FragColor = vec4(col, vAlpha);
  }
`;

const LINE_VS = /* glsl */ `
  ${COMMON}
  attribute float aT;
  attribute float aPhase;
  attribute float aSpeed;
  attribute float aPulse;
  attribute float aLayer;
  attribute float aHi;
  attribute float aAct;
  attribute vec3 aColorA;
  attribute vec3 aColorB;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vT;
  varying float vPhase;
  varying float vSpeed;
  varying float vPulse;
  varying float vHi;
  varying float vAct;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float vis = layerVis(aLayer);
    float reveal = smoothstep(uReveal + 0.2, uReveal + 1.0, position.y);
    float focus = mix(1.0, mix(0.06, 1.0, step(0.01, aHi)), uFocus);
    float depth = smoothstep(26.0, 9.0, -mv.z);
    vColor = mix(aColorA, aColorB, uColorMix);
    vAlpha = vis * reveal * focus * mix(0.35, 1.0, depth);
    vT = aT; vPhase = aPhase; vSpeed = aSpeed; vPulse = aPulse; vHi = aHi;
    vAct = aAct * uActGain;
  }
`;

const LINE_FS = /* glsl */ `
  uniform float uTime;
  uniform float uPulse;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vT;
  varying float vPhase;
  varying float vSpeed;
  varying float vPulse;
  varying float vHi;
  varying float vAct;
  void main() {
    // Active synapses carry signal: every one pulses (not only the 30% that idle-pulse), faster.
    float head = fract(uTime * vSpeed * (1.0 + vAct * 1.5) + vPhase) * 1.6 - 0.3;
    float dist = vT - head;
    float trail = step(dist, 0.0) * smoothstep(-0.3, 0.0, dist);
    float pulse = trail * trail * max(vPulse, smoothstep(0.15, 0.6, vAct)) * uPulse;
    vec3 col = vColor * (0.34 + vHi * 1.1 + vAct * 1.3 + pulse * (2.6 + vAct * 2.0));
    gl_FragColor = vec4(col, vAlpha);
  }
`;

function colorArray(count, hexOf) {
  const arr = new Float32Array(count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    c.set(hexOf(i));
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  return arr;
}

export class NetworkView {
  constructor(net, { pixelRatio = 1, sizes = [0.85, 1.25, 1.7], presence = 1 } = {}) {
    this.net = net;
    this.sizes = sizes;
    this.group = new THREE.Group();
    this.layerTarget = [1, 1, 1];
    this.colorTarget = 0;
    this.pulseTarget = 1;
    this.presenceTarget = presence;
    this.active = -1;
    this.touchedNodes = [];
    this.touchedEdges = [];

    this.uniforms = {
      uTime: { value: 0 },
      uReveal: { value: 10 },
      uColorMix: { value: 0 },
      uFocus: { value: 0 },
      uLayerVis: { value: new THREE.Vector3(1, 1, 1) },
      uPixelRatio: { value: pixelRatio },
      uPulse: { value: 1 },
      uPresence: { value: presence },
      uActGain: { value: 1 },
    };

    this.#buildPoints();
    this.#buildLines();
  }

  #buildPoints() {
    const { net } = this;
    const N = net.count;
    const size = new Float32Array(N);
    const seed = new Float32Array(N);
    const layer = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const l = net.layers[i];
      layer[i] = l;
      seed[i] = Math.random();
      size[i] = this.sizes[l] * (0.8 + Math.random() * 0.45);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(net.positions, 3));
    geo.setAttribute('aLayer', new THREE.BufferAttribute(layer, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    geo.setAttribute('aHi', new THREE.BufferAttribute(new Float32Array(N), 1));
    geo.setAttribute('aAct', new THREE.BufferAttribute(new Float32Array(N), 1));
    geo.setAttribute('aColorA', new THREE.BufferAttribute(colorArray(N, (i) => LAYERS[net.layers[i]].color), 3));
    geo.setAttribute('aColorB', new THREE.BufferAttribute(colorArray(N, (i) => REGIONS[net.regions[i]].color), 3));
    // Generous fixed bounds: positions may be animated (live camera), and raycasting needs a sphere.
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 50);

    this.points = new THREE.Points(geo, new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: POINT_VS,
      fragmentShader: POINT_FS,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    this.points.renderOrder = 3;
    this.points.frustumCulled = false;
    this.group.add(this.points);
  }

  #buildLines() {
    const { net } = this;
    const E = net.edgeCount;
    const V = E * 2;
    const pos = new Float32Array(V * 3);
    const t = new Float32Array(V);
    const phase = new Float32Array(V);
    const speed = new Float32Array(V);
    const pulse = new Float32Array(V);
    const layer = new Float32Array(V);
    const colA = new Float32Array(V * 3);
    const colB = new Float32Array(V * 3);
    const nodeColA = this.points.geometry.getAttribute('aColorA').array;
    const nodeColB = this.points.geometry.getAttribute('aColorB').array;

    for (let e = 0; e < E; e++) {
      const flip = Math.random() < 0.5;
      const ph = Math.random();
      const sp = 0.12 + Math.random() * 0.35;
      const isPulse = Math.random() < 0.3 ? 1 : 0;
      for (let v = 0; v < 2; v++) {
        const node = net.edges[e * 2 + v];
        const o = e * 2 + v;
        pos.set(net.positions.subarray(node * 3, node * 3 + 3), o * 3);
        colA.set(nodeColA.subarray(node * 3, node * 3 + 3), o * 3);
        colB.set(nodeColB.subarray(node * 3, node * 3 + 3), o * 3);
        t[o] = flip ? 1 - v : v;
        phase[o] = ph;
        speed[o] = sp;
        pulse[o] = isPulse;
        layer[o] = net.layers[node];
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aT', new THREE.BufferAttribute(t, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
    geo.setAttribute('aPulse', new THREE.BufferAttribute(pulse, 1));
    geo.setAttribute('aLayer', new THREE.BufferAttribute(layer, 1));
    geo.setAttribute('aHi', new THREE.BufferAttribute(new Float32Array(V), 1));
    geo.setAttribute('aAct', new THREE.BufferAttribute(new Float32Array(V), 1));
    geo.setAttribute('aColorA', new THREE.BufferAttribute(colA, 3));
    geo.setAttribute('aColorB', new THREE.BufferAttribute(colB, 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 50);

    this.lines = new THREE.LineSegments(geo, new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: LINE_VS,
      fragmentShader: LINE_FS,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    this.lines.renderOrder = 2;
    this.lines.frustumCulled = false;
    this.group.add(this.lines);
  }

  /** Push `net.positions` (e.g. updated from the webcam) to the GPU for nodes and synapses. */
  updatePositions() {
    const { net } = this;
    const pts = this.points.geometry.getAttribute('position');
    pts.needsUpdate = true;
    const lp = this.lines.geometry.getAttribute('position');
    const src = net.positions;
    const dst = lp.array;
    for (let v = 0, n = net.edges.length; v < n; v++) {
      const s = net.edges[v] * 3;
      const d = v * 3;
      dst[d] = src[s];
      dst[d + 1] = src[s + 1];
      dst[d + 2] = src[s + 2];
    }
    lp.needsUpdate = true;
  }

  /**
   * Per-node activation from how far each node's skin has moved (rig.activation, scan units).
   * Mapped through a soft threshold so tracking jitter and faint motion stay dark: nothing below
   * ~0.4 mm lights up, and ~4 mm of travel is full activation.
   * @param {Float32Array|null} disp per node displacement, or null to clear
   * @param {number} unitsPerMM
   */
  setActivation(disp, unitsPerMM = 1) {
    const pa = this.points.geometry.getAttribute('aAct');
    const la = this.lines.geometry.getAttribute('aAct');
    const P = pa.array, L = la.array;
    const lo = 0.4 * unitsPerMM, hi = 4 * unitsPerMM;
    let any = false;
    for (let i = 0; i < P.length; i++) {
      let a = 0;
      if (disp) {
        const t = Math.min(1, Math.max(0, (disp[i] - lo) / (hi - lo)));
        a = t * t * (3 - 2 * t);
      }
      if (a !== P[i]) any = true;
      P[i] = a;
    }
    if (!any) return;
    const edges = this.net.edges;
    for (let v = 0; v < edges.length; v++) L[v] = P[edges[v]];
    pa.needsUpdate = true;
    la.needsUpdate = true;
  }

  setActivationGain(v) { this.uniforms.uActGain.value = v; }

  setPresence(v) { this.presenceTarget = v; }
  setLayerVisible(i, on) { this.layerTarget[i] = on ? 1 : 0; }
  isLayerVisible(i) { return this.layerTarget[i] > 0.5; }
  setColorMode(mode) { this.colorTarget = mode === 'region' ? 1 : 0; }
  setPulses(on) { this.pulseTarget = on ? 1 : 0; }

  /** Highlight a node, its neighbours and its synapses. Pass -1 to clear. */
  setActive(index) {
    if (index === this.active) return;
    const nodeHi = this.points.geometry.getAttribute('aHi');
    const edgeHi = this.lines.geometry.getAttribute('aHi');
    for (const n of this.touchedNodes) nodeHi.array[n] = 0;
    for (const e of this.touchedEdges) { edgeHi.array[e * 2] = 0; edgeHi.array[e * 2 + 1] = 0; }
    this.touchedNodes = [];
    this.touchedEdges = [];
    this.active = index;

    if (index >= 0) {
      nodeHi.array[index] = 1;
      this.touchedNodes.push(index);
      for (const nb of this.net.neighbors[index]) {
        nodeHi.array[nb] = 0.6;
        this.touchedNodes.push(nb);
      }
      for (const e of this.net.incident[index]) {
        edgeHi.array[e * 2] = 1;
        edgeHi.array[e * 2 + 1] = 1;
        this.touchedEdges.push(e);
      }
    }
    nodeHi.needsUpdate = true;
    edgeHi.needsUpdate = true;
  }

  update(time, dt, reveal) {
    const u = this.uniforms;
    const k = 1 - Math.exp(-dt * 5);
    u.uTime.value = time;
    u.uReveal.value = reveal;
    const lv = u.uLayerVis.value;
    lv.x += (this.layerTarget[0] - lv.x) * k;
    lv.y += (this.layerTarget[1] - lv.y) * k;
    lv.z += (this.layerTarget[2] - lv.z) * k;
    u.uColorMix.value += (this.colorTarget - u.uColorMix.value) * k;
    u.uPulse.value += (this.pulseTarget - u.uPulse.value) * k;
    u.uPresence.value += (this.presenceTarget - u.uPresence.value) * k;
    u.uFocus.value += ((this.active >= 0 ? 1 : 0) - u.uFocus.value) * k;
  }
}
