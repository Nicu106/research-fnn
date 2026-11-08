import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const BASE = './assets/head/';

// Openings cut between the lids and lips (see `features` below). Shared by the skin and the
// holographic shell so nothing of the scan's interior shows through. Returns the rim darkening.
const FEATURE_CUT_GLSL = /* glsl */ `
  uniform vec3 uFA[3];
  uniform vec3 uFB[3];
  uniform vec4 uFBow[3];
  uniform vec3 uFOff[3];
  uniform vec2 uFShape[3]; // x: upper-opening tilt along the seam (+ = larger toward corner B)
  varying vec3 vExpr;
  float featureCut(vec3 p) {
    float rim = 0.0;
    for (int i = 0; i < 3; i++) {
      vec3 A = uFA[i] + uFOff[i];
      vec3 B = uFB[i] + uFOff[i];
      vec2 chord = B.xy - A.xy;
      float len2 = dot(chord, chord);
      if (len2 < 1e-6) continue;
      float open = uFBow[i].z + uFBow[i].w;
      if (open < 0.002) continue;
      float t = dot(p.xy - A.xy, chord) / len2;
      float s = t * 2.0 - 1.0;
      if (abs(s) >= 1.0) continue;
      float bow = 1.0 - s * s;
      float seamY = mix(A.y, B.y, t) + uFBow[i].x * bow;
      float seamZ = mix(A.z, B.z, t) + uFBow[i].y * bow;
      // Only the outer skin near the seam is kept; everything behind it (the scan's closed
      // eyeballs, inner lips, mouth tunnel) is removed so the modelled parts show instead.
      if (p.z > seamZ + 0.35) continue;
      float lens = sqrt(bow);
      // Eyes are almond-shaped, not elliptical: the upper lid peaks toward the nose (s -> +1 is
      // the inner corner B) and the lower lid dips toward the ear. Must match AvatarRig's lid
      // profile (LID_SKEW_UP / LID_SKEW_DOWN), or the cut and the moving lid skin disagree.
      float skewU = i < 2 ? 1.0 + 0.12 * s : 1.0;
      float skewD = i < 2 ? 1.0 - 0.15 * s : 1.0;
      float up = uFBow[i].z * lens * skewU * max(0.0, 1.0 + uFShape[i].x * (s < 0.0 ? s : 0.25 * s));
      float down = uFBow[i].w * lens * skewD;
      float dy = p.y - seamY;
      bool behind = p.z < seamZ - 0.2;
      float reach = behind ? 0.3 : 0.0;
      if (dy < up + reach && dy > -down - reach) discard;
      float fade = smoothstep(0.0, 0.02, open);
      if (i < 2) {
        // Lash line: the upper lid margin is the darkest, widest line of the eye (lashes and
        // their shadow), strongest in the middle; the lower margin is a thin, lighter line.
        float eu = dy - up, ed = -down - dy;
        float lashUp = (1.0 - smoothstep(0.0, 0.07, eu)) * step(0.0, eu) * mix(0.75, 1.0, lens);
        float lashDown = (1.0 - smoothstep(0.0, 0.028, ed)) * step(0.0, ed) * 0.55;
        rim = max(rim, max(lashUp, lashDown) * fade);
      } else {
        float edge = min(abs(dy - up), abs(dy + down));
        rim = max(rim, (1.0 - smoothstep(0.0, 0.025, edge)) * fade);
      }
    }
    return rim;
  }
`;

// Expression wrinkles, drawn as a procedural bump on the skin in its REST position (so creases
// stay put on the skin instead of swimming as it moves). Each family is tied to the muscle that
// makes it, and fades in only with that muscle: AU1 central forehead lines, AU2 lateral forehead
// lines, AU4 vertical lines between the brows, AU6 crow's feet, AU12/AU10 deeper nasolabial folds,
// AU17 the dimpled chin and the crease under the lower lip. Plus two skin responses for crying:
// redness around the eyes and nose, and a wet shine along the lower lids.
// Positions are in a face frame in millimetres (see emotion/faceBasis.js).
const WRINKLE_GLSL = /* glsl */ `
  uniform float uWr[10];
  uniform vec3 uFP[10];
  uniform vec3 uFaceO;
  uniform float uMM;
  uniform float uBrowY;
  uniform float uFlush;
  uniform float uWet;
  uniform float uWrScale;
  varying vec3 vRest;

  float wrHash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float wrNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(wrHash(i), wrHash(i + vec2(1.0, 0.0)), u.x),
               mix(wrHash(i + vec2(0.0, 1.0)), wrHash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  // Size of one screen pixel on the skin, in mm (set in main from the derivatives of the face
  // position). A crease drawn narrower than ~1.5 px aliases into dashes and glitters; below that
  // it is widened and faded by the same factor, so it softens with distance instead.
  float wrPx = 0.0;
  float crease(float d, float w) {
    float W = max(w, wrPx * 1.5);
    return exp(-(d * d) / (W * W)) * (w / W);
  }

  // Distance from p to a quadratic bezier: to the SEGMENTS of a sampled polyline. (Distance to
  // the sample points alone left a bead around each one: the fold rendered as a row of stitches.)
  float segDist(vec2 p, vec2 a, vec2 b) {
    vec2 ab = b - a;
    float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
    return length(p - (a + ab * t));
  }
  float bezierDist(vec2 p, vec2 a, vec2 b, vec2 c) {
    float best = 1e5;
    vec2 prev = a;
    for (int k = 1; k <= 12; k++) {
      float t = float(k) / 12.0;
      vec2 q = mix(mix(a, b, t), mix(b, c, t), t);
      best = min(best, segDist(p, prev, q));
      prev = q;
    }
    return best;
  }

  // Returns the crease height in mm (<= 0); 'valley' 0..1 darkens the bottom of the creases.
  float wrinkles(vec3 q, out float valley) {
    float h = 0.0;
    valley = 0.0;
    if (q.z < -50.0) return 0.0;

    // Forehead: horizontal lines following the brow, wavy and broken like real ones. AU1 draws
    // them only in the middle (and arches them up there); AU2 draws them at the sides.
    float center = exp(-q.x * q.x / (2.0 * 16.0 * 16.0));
    float latR = exp(-pow(q.x + 36.0, 2.0) / (2.0 * 15.0 * 15.0));
    float latL = exp(-pow(q.x - 36.0, 2.0) / (2.0 * 15.0 * 15.0));
    float fAmt = max(uWr[0] * center, max(uWr[1] * latR, uWr[2] * latL));
    if (fAmt > 0.01) {
      float arch = 3.5 * uWr[0] * center;
      float yy = q.y - uBrowY - 6.0 - arch + 1.1 * sin(q.x * 0.085 + 1.3) + 0.5 * sin(q.x * 0.21 + 0.4);
      float k = yy / 8.5;
      float line = floor(k + 0.5);
      float d = (k - line) * 8.5;
      float vert = smoothstep(-3.0, 1.0, yy) * (1.0 - smoothstep(15.0, 23.0, yy));
      float along = 0.45 + 0.55 * wrNoise(vec2(q.x * 0.11, line * 7.3));
      float depth = mix(0.6, 1.0, wrHash(vec2(line, 3.1)));
      // A furrow is a soft valley ~2 mm across, not a cut: wide profile, shallow depth.
      float c = crease(d, 1.35) * vert * along * depth * fAmt;
      h -= 0.38 * c;
      valley = max(valley, c * 0.8);
    }

    // Glabella: vertical lines between the brows (corrugator), slightly diverging upward, plus the
    // horizontal crease at the root of the nose (procerus).
    if (uWr[3] > 0.01 && abs(q.x) < 14.0 && q.y > -2.0 && q.y < 26.0) {
      float vert = smoothstep(2.0, 7.0, q.y) * (1.0 - smoothstep(17.0, 25.0, q.y));
      float spread = 1.0 + 0.014 * (q.y - 5.0);
      float c = 0.0;
      c = max(c, crease(abs(q.x) - 3.6 * spread, 0.95));
      c = max(c, 0.55 * crease(abs(q.x) - 8.5 * spread, 0.85));
      c *= vert;
      float root = crease(q.y - 2.5, 1.1) * (1.0 - smoothstep(5.0, 9.0, abs(q.x))) * 0.6;
      c = max(c, root) * uWr[3];
      h -= 0.4 * c;
      valley = max(valley, c);
    }

    // Crow's feet: fine lines fanning out from each outer eye corner (orbicularis, AU6).
    for (int s = 0; s < 2; s++) {
      float amt = uWr[4 + s];
      if (amt < 0.01) continue;
      vec2 e = uFP[s].xy;
      vec2 v = q.xy - e;
      float dir = s == 0 ? -1.0 : 1.0;
      float u = v.x * dir;
      if (u < 0.5) continue;
      float r = length(v);
      if (r > 20.0) continue;
      float ang = atan(v.y, u) - 0.012 * r;
      float c = 0.0;
      c = max(c, crease(r * (ang + 0.58), 0.75));
      c = max(c, crease(r * (ang + 0.22), 0.8));
      c = max(c, 0.8 * crease(r * (ang - 0.1), 0.75));
      c = max(c, 0.6 * crease(r * (ang - 0.4), 0.7));
      c *= smoothstep(3.0, 6.0, r) * (1.0 - smoothstep(12.0, 18.0, r)) * amt;
      h -= 0.4 * c;
      valley = max(valley, c);
    }

    // Nasolabial folds: from the nose wing to just outside the mouth corner, deepening with the
    // cheek that rises over them.
    for (int s = 0; s < 2; s++) {
      float amt = uWr[6 + s];
      if (amt < 0.01) continue;
      float dir = s == 0 ? -1.0 : 1.0;
      vec2 a = uFP[4 + s].xy + vec2(4.0 * dir, -2.0);
      vec2 c2 = uFP[6 + s].xy + vec2(5.0 * dir, -5.0);
      vec2 b = mix(a, c2, 0.5) + vec2(6.0 * dir, 0.0);
      float d = bezierDist(q.xy, a, b, c2);
      if (d > 12.0) continue;
      // A fold, not a line: ~2.5 mm wide, shallow, with the rounded cheek above it casting a
      // soft shadow on its inner side.
      float c = crease(d, 2.4) * amt;
      float side = (q.x - mix(a.x, c2.x, 0.5)) * dir;
      float shade = exp(-(d * d) / 30.0) * smoothstep(-2.0, 3.0, -side) * 0.45 * amt;
      h -= 0.55 * c;
      valley = max(valley, max(c * 0.55, shade));
    }

    // Chin (mentalis, AU17): the crease under the lower lip and the dimpled "orange peel" skin.
    vec3 lipL = uFP[8];
    vec3 chin = uFP[9];
    if (uWr[9] > 0.01 && abs(q.x - lipL.x) < 20.0) {
      float dx = q.x - lipL.x;
      float y0 = lipL.y - 9.0 + 0.018 * dx * dx;
      float c = crease(q.y - y0, 2.2) * (1.0 - smoothstep(9.0, 15.0, abs(dx))) * uWr[9];
      h -= 0.45 * c;
      valley = max(valley, c * 0.55);
    }
    if (uWr[8] > 0.01) {
      vec2 dc = q.xy - vec2(chin.x, chin.y + 3.0);
      float mask = exp(-(dc.x * dc.x + dc.y * dc.y * 1.4) / (2.0 * 10.0 * 10.0));
      if (mask > 0.02) {
        // Soft, irregular dimples a few mm across (mentalis pulling the skin in at its insertions),
        // not pits: fine, high-contrast noise read as scratches.
        float n = wrNoise(q.xy / 3.4) * 0.75 + wrNoise(q.xy / 1.9 + 7.0) * 0.25;
        float pits = smoothstep(0.42, 0.95, n) * mask * uWr[8];
        h -= 0.28 * pits;
        valley = max(valley, pits * 0.3);
      }
    }
    return h;
  }

  // Redness around the eyes and the tip of the nose (crying), 0..1.
  float flushMask(vec3 q) {
    vec2 eR = uFP[2].xy, eL = uFP[3].xy;
    float m = max(exp(-dot(q.xy - eR, q.xy - eR) / (2.0 * 13.0 * 13.0)), exp(-dot(q.xy - eL, q.xy - eL) / (2.0 * 13.0 * 13.0)));
    vec2 n = q.xy - vec2(0.0, -40.0);
    m = max(m, exp(-dot(n, n) / (2.0 * 8.0 * 8.0)));
    return m;
  }
  // The wet line along the lower lids.
  float wetMask(vec3 q) {
    float m = 0.0;
    for (int s = 0; s < 2; s++) {
      vec2 e = uFP[2 + s].xy;
      float dx = (q.x - e.x) / 10.0, dy = (q.y - (e.y - 3.5)) / 2.2;
      m = max(m, exp(-(dx * dx + dy * dy) / 2.0));
    }
    return m;
  }
`;

// Scanned head "Lee Perry-Smith" by Infinite-Realities (CC BY 3.0), as distributed with three.js examples.
export async function loadHead(onProgress = () => {}) {
  const manager = new THREE.LoadingManager();
  manager.onProgress = (_url, loaded, total) => onProgress(loaded / total);

  const gltfLoader = new GLTFLoader(manager);
  const texLoader = new THREE.TextureLoader(manager);

  const [gltf, colorMap, normalMap, specMap] = await Promise.all([
    gltfLoader.loadAsync(BASE + 'LeePerrySmith.glb'),
    texLoader.loadAsync(BASE + 'Map-COL.jpg'),
    texLoader.loadAsync(BASE + 'Infinite-Level_02_Tangent_SmoothUV.jpg'),
    texLoader.loadAsync(BASE + 'Map-SPEC.jpg'),
  ]);

  colorMap.colorSpace = THREE.SRGBColorSpace;
  for (const t of [colorMap, normalMap, specMap]) t.anisotropy = 8;

  let source = null;
  gltf.scene.traverse((o) => { if (o.isMesh && !source) source = o; });
  const geometry = source.geometry;

  const uniforms = { uCut: { value: -10 } };
  const wrinkleUniforms = {
    uWr: { value: new Array(10).fill(0) },
    uFP: { value: Array.from({ length: 10 }, () => new THREE.Vector3()) },
    uFaceO: { value: new THREE.Vector3() },
    uMM: { value: 1 },
    uBrowY: { value: 20 },
    uFlush: { value: 0 },
    uWet: { value: 0 },
    uWrScale: { value: 1 },
  };

  // Openings cut between the lids and lips while the webcam drives the face (set by AvatarRig).
  // Per feature (0 right eye, 1 left eye, 2 mouth): corners A/B, bow (seam Y, seam Z, opening
  // above the seam, opening below it) and the corners' current expression offset.
  const vec3s = () => [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const features = {
    uFA: { value: vec3s() },
    uFB: { value: vec3s() },
    uFBow: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
    uFOff: { value: vec3s() },
    uFShape: { value: [new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2()] },
  };
  // Expression-space position (before head rotation), written by the rig; rest pose by default.
  geometry.setAttribute('aExpr', geometry.getAttribute('position').clone());
  // Rest position, never modified: wrinkles are painted on the skin here so they don't swim.
  geometry.setAttribute('aRest', geometry.getAttribute('position').clone());

  const skin = new THREE.MeshPhysicalMaterial({
    map: colorMap,
    normalMap,
    normalScale: new THREE.Vector2(0.9, 0.9),
    roughness: 0.62,
    roughnessMap: specMap,
    metalness: 0,
    sheen: 0.35,
    sheenColor: new THREE.Color(0xff8a6a),
    sheenRoughness: 0.55,
    clearcoat: 0.06,
    clearcoatRoughness: 0.45,
    transparent: true,
  });

  skin.onBeforeCompile = (shader) => {
    shader.uniforms.uCut = uniforms.uCut;
    Object.assign(shader.uniforms, features, wrinkleUniforms);
    shader.vertexShader = 'attribute vec3 aExpr;\nattribute vec3 aRest;\nvarying float vSkinY;\nvarying vec3 vExpr;\nvarying vec3 vRest;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n  vSkinY = position.y;\n  vExpr = aExpr;\n  vRest = aRest;',
    );
    shader.fragmentShader = 'uniform float uCut;\nvarying float vSkinY;\n' + FEATURE_CUT_GLSL + WRINKLE_GLSL + shader.fragmentShader
      .replace('void main() {', `void main() {
  if (vSkinY < uCut) discard;
  float featureRim = featureCut(vExpr);
  vec3 faceQ = (vRest - uFaceO) / uMM;
  wrPx = length(fwidth(faceQ)) * 0.6;
  float wrValley;
  float wrH = wrinkles(faceQ, wrValley);
  float wet = uWet > 0.001 ? uWet * wetMask(faceQ) : 0.0;`)
      // Darken the lid margin / lash line and the inner lip edge around each opening; shade the
      // bottom of the creases; flush the skin around the eyes and nose when crying.
      .replace('#include <map_fragment>', `#include <map_fragment>
  diffuseColor.rgb *= 1.0 - featureRim * 0.82;
  diffuseColor.rgb *= 1.0 - wrValley * 0.2;
  if (uFlush > 0.001) diffuseColor.rgb *= mix(vec3(1.0), vec3(1.06, 0.86, 0.86), uFlush * flushMask(faceQ));`)
      // Crease relief: perturb the shading normal by the gradient of the crease height, in
      // screen space (the same construction three.js uses for bump maps).
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  if (wrValley > 0.001) {
    float hh = wrH * uMM * uWrScale;
    vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
    vec3 r1 = cross(sy, normal), r2 = cross(normal, sx);
    float det = dot(sx, r1);
    vec2 dh = vec2(dFdx(hh), dFdy(hh));
    vec3 grad = sign(det) * (dh.x * r1 + dh.y * r2);
    normal = normalize(abs(det) * normal - grad);
  }`)
      // The scan ships a specular map (bright = glossy); use it as inverted roughness.
      .replace('#include <roughnessmap_fragment>', /* glsl */ `
        float roughnessFactor = roughness;
        #ifdef USE_ROUGHNESSMAP
          vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
          roughnessFactor *= 1.0 - texelRoughness.g * 0.6;
        #endif
        roughnessFactor *= 1.0 - 0.65 * wet;
      `)
      // Glowing edge while the skin materialises during the intro scan.
      .replace('#include <emissivemap_fragment>', /* glsl */ `
        #include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(0.4, 0.9, 1.0) * exp(-pow((vSkinY - uCut) * 5.0, 2.0)) * 3.0;
      `);
  };

  const mesh = new THREE.Mesh(geometry, skin);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.renderOrder = 0;

  // Holographic fresnel shell, visible as the skin fades out.
  const holoMat = new THREE.ShaderMaterial({
    uniforms: { uStrength: { value: 0 }, uTime: { value: 0 }, ...features },
    vertexShader: /* glsl */ `
      attribute vec3 aExpr;
      varying vec3 vN;
      varying vec3 vV;
      varying float vY;
      varying vec3 vExpr;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        vY = position.y;
        vExpr = aExpr;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uStrength;
      uniform float uTime;
      varying vec3 vN;
      varying vec3 vV;
      varying float vY;
      ${FEATURE_CUT_GLSL}
      void main() {
        featureCut(vExpr);
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.6);
        float lines = 0.9 + 0.1 * sin(vY * 70.0 - uTime * 1.5);
        vec3 col = mix(vec3(0.25, 0.55, 1.0), vec3(0.62, 0.95, 1.0), f);
        gl_FragColor = vec4(col, (f * 0.9 + 0.035) * lines * uStrength);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  // Depth-only pass drawn after the network: the shell then shows only its outermost surface
  // (hides the scan's interior eyeballs / mouth cavity) without occluding the inner layers.
  // `transparent: true` puts it in the same render list as the network so renderOrder applies.
  // As an opaque material it was drawn in three's opaque pass, which runs before every
  // transparent object regardless of renderOrder — so it hid everything inside the head,
  // including the network's own inner layers.
  const holoDepth = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true }));
  holoDepth.renderOrder = 4;
  const holo = new THREE.Mesh(geometry, holoMat);
  holo.renderOrder = 5;

  // Shares the head geometry so it follows the live (camera-driven) deformation.
  const wire = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: 0x4fc8ff,
      wireframe: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  wire.renderOrder = 5;

  const group = new THREE.Group();
  group.add(mesh, holoDepth, holo, wire);

  function update({ time, skin: skinLevel, cut, presence = 1 }) {
    group.visible = presence > 0.002;
    const s = skinLevel * presence;
    uniforms.uCut.value = cut;
    skin.opacity = s;
    skin.depthWrite = s > 0.9;
    // Specular / sheen / clearcoat ignore opacity, so fade them too (kept > 0 to avoid shader recompiles).
    const glow = Math.max(0.001, s * s);
    skin.specularIntensity = glow;
    skin.sheen = 0.35 * glow;
    skin.clearcoat = 0.06 * glow;
    skin.envMapIntensity = glow;
    mesh.visible = s > 0.002;
    const ghost = (1 - skinLevel) * presence;
    holoMat.uniforms.uTime.value = time;
    holoMat.uniforms.uStrength.value = (0.12 + (1 - skinLevel) * 0.5) * presence;
    wire.material.opacity = ghost * 0.03;
    wire.visible = ghost > 0.01;
    holoDepth.visible = s < 0.999;
  }

  /** Place the wrinkle geometry from the expression basis frame (faceBasis.buildBasis().frame). */
  function setFaceFrame(frame) {
    const u = wrinkleUniforms;
    u.uFaceO.value.fromArray(frame.origin);
    u.uMM.value = frame.unitsPerMM;
    const F = frame.points;
    const pts = [F.eyeOuter[0], F.eyeOuter[1], F.eyeC[0], F.eyeC[1], F.alar[0], F.alar[1], F.corner[0], F.corner[1], F.lipLower, F.chin];
    pts.forEach((p, i) => u.uFP.value[i].fromArray(p));
    u.uBrowY.value = (F.browY(-30) + F.browY(30)) / 2;
  }

  /**
   * Wrinkle strengths from blendshape weights (any source: emotion studio or webcam).
   * @param {Record<string, number>} w blendshape weights 0..1
   * @param {{flush?: number, wet?: number}} [skin]
   */
  function setExpression(w, skin = {}) {
    const g = (n) => w[n] ?? 0;
    const W = wrinkleUniforms.uWr.value;
    const ease = (x) => Math.min(1, Math.max(0, (x - 0.06) / 0.94)) ** 1.2;
    W[0] = ease(g('browInnerUp') * 1.1);
    W[1] = ease(g('browOuterUpRight') * 1.1);
    W[2] = ease(g('browOuterUpLeft') * 1.1);
    W[3] = ease(Math.max(g('browDownLeft'), g('browDownRight')) * 1.15 + 0.4 * Math.max(g('noseSneerLeft'), g('noseSneerRight')));
    W[4] = ease(g('cheekSquintRight') * 1.2 + 0.25 * g('eyeSquintRight'));
    W[5] = ease(g('cheekSquintLeft') * 1.2 + 0.25 * g('eyeSquintLeft'));
    W[6] = ease(0.75 * g('mouthSmileRight') + 0.6 * g('mouthUpperUpRight') + 0.4 * g('noseSneerRight'));
    W[7] = ease(0.75 * g('mouthSmileLeft') + 0.6 * g('mouthUpperUpLeft') + 0.4 * g('noseSneerLeft'));
    W[8] = ease(g('mouthShrugLower') * 1.15);
    W[9] = ease(g('mouthShrugLower') * 0.9 + 0.35 * Math.max(g('mouthPressLeft'), g('mouthPressRight')) + 0.3 * g('mouthRollLower'));
    wrinkleUniforms.uFlush.value = skin.flush ?? 0;
    wrinkleUniforms.uWet.value = skin.wet ?? 0;
  }

  /** The head's world scale, so crease relief is right whatever size the model is shown at. */
  function syncScale() {
    wrinkleUniforms.uWrScale.value = mesh.matrixWorld.getMaxScaleOnAxis();
  }

  return { group, mesh, features, update, setFaceFrame, setExpression, syncScale };
}
