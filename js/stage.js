import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const TARGET = new THREE.Vector3(0, 1.05, 0);
const PANEL_SHIFT = 150; // px — keeps the head clear of the right-hand panel on wide screens

const VIEWS = {
  front: { az: 0, el: 0.05 },
  three: { az: 0.72, el: 0.1 },
  profile: { az: Math.PI / 2, el: 0.04 },
};

// Cinematic finish: subtle chromatic aberration, vignette and film grain (runs after tone mapping).
const FinishShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uRes;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 c = vUv - 0.5;
      float r2 = dot(c, c);
      vec2 off = c * r2 * 0.012;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;
      vec2 ac = c * vec2(uRes.x / uRes.y, 1.0);
      float vig = smoothstep(1.15, 0.2, length(ac));
      col *= mix(0.35, 1.0, vig);
      col += (hash(vUv * uRes + fract(uTime * 7.13) * 91.7) - 0.5) * 0.028;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

function makeBackground() {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(512, 430, 0, 512, 512, 720);
  grad.addColorStop(0, '#0d1822');
  grad.addColorStop(0.45, '#060b11');
  grad.addColorStop(1, '#010203');
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 1024);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeDust() {
  const COUNT = 900;
  const pos = new Float32Array(COUNT * 3);
  const seed = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 22;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 14 + 0.5;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 16 - 2;
    seed[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vA;
      void main() {
        vec3 p = position;
        p.y += sin(uTime * 0.05 + aSeed * 50.0) * 0.6;
        p.x += cos(uTime * 0.04 + aSeed * 31.0) * 0.4;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (0.6 + aSeed * 1.6) * uPixelRatio * (20.0 / -mv.z);
        vA = (0.25 + 0.75 * aSeed) * smoothstep(30.0, 8.0, -mv.z) * (0.6 + 0.4 * sin(uTime * 0.7 + aSeed * 90.0));
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        gl_FragColor = vec4(vec3(0.55, 0.8, 0.95), exp(-d * d * 4.0) * vA * 0.35);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Points(geo, mat);
}

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = makeBackground();

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.22;

  const camera = new THREE.PerspectiveCamera(28, window.innerWidth / window.innerHeight, 0.1, 100);

  // Lighting: warm key, cool fill, cyan + magenta rims for a cinematic silhouette.
  const key = new THREE.DirectionalLight(0xffe4cc, 2.5);
  key.position.set(-6, 7, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.03;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x9cb8ff, 0.55);
  fill.position.set(8, 1, 6);
  scene.add(fill);

  const rimCyan = new THREE.DirectionalLight(0x5fe3ff, 4.2);
  rimCyan.position.set(7, 4, -8);
  scene.add(rimCyan);

  const rimMagenta = new THREE.DirectionalLight(0xff5c9a, 0.7);
  rimMagenta.position.set(-8, 2, -6);
  scene.add(rimMagenta);

  const dust = makeDust();
  dust.material.uniforms.uPixelRatio.value = pixelRatio;
  scene.add(dust);

  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(TARGET);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.7;
  controls.minDistance = 7;
  controls.maxDistance = 26;
  controls.autoRotateSpeed = 0.45;

  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.7, 0.5, 0.88);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const finish = new ShaderPass(FinishShader);
  composer.addPass(finish);

  function fitDistance() {
    const a = camera.aspect;
    return a >= 1.1 ? 15.5 : 15.5 * Math.min(2.1, 1.25 / a);
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    if (w > 900) camera.setViewOffset(w, h, PANEL_SHIFT, 0, w, h);
    else camera.setViewOffset(w, h, 0, h * 0.06, w, h);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(w, h);
    finish.uniforms.uRes.value.set(w * pixelRatio, h * pixelRatio);
  }

  const spherical = new THREE.Spherical();
  function placeCamera(az, el, dist) {
    spherical.set(dist, Math.PI / 2 - el, az);
    camera.position.setFromSpherical(spherical).add(controls.target);
    camera.lookAt(controls.target);
  }

  let tween = null;
  function flyTo(name) {
    const v = VIEWS[name];
    if (!v) return;
    const from = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    let toAz = v.az;
    while (toAz - from.theta > Math.PI) toAz -= Math.PI * 2;
    while (toAz - from.theta < -Math.PI) toAz += Math.PI * 2;
    tween = {
      t: 0,
      from: { az: from.theta, el: Math.PI / 2 - from.phi, dist: from.radius },
      to: { az: toAz, el: v.el, dist: fitDistance() },
    };
    controls.enabled = false;
  }

  function update(dt, time) {
    dust.material.uniforms.uTime.value = time;
    finish.uniforms.uTime.value = time;
    if (tween) {
      tween.t = Math.min(1, tween.t + dt / 1.6);
      const e = easeInOutCubic(tween.t);
      const { from, to } = tween;
      placeCamera(
        from.az + (to.az - from.az) * e,
        from.el + (to.el - from.el) * e,
        from.dist + (to.dist - from.dist) * e,
      );
      if (tween.t >= 1) {
        tween = null;
        controls.enabled = true;
      }
    } else {
      controls.update(dt);
    }
  }

  resize();
  placeCamera(-0.55, 0.08, fitDistance() * 1.25);
  window.addEventListener('resize', resize);

  return {
    renderer,
    scene,
    camera,
    controls,
    pixelRatio,
    flyTo,
    update,
    render: () => composer.render(),
  };
}
