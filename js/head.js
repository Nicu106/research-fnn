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
      float up = uFBow[i].z * lens;
      float down = uFBow[i].w * lens;
      float dy = p.y - seamY;
      bool behind = p.z < seamZ - 0.2;
      float reach = behind ? 0.3 : 0.0;
      if (dy < up + reach && dy > -down - reach) discard;
      float edge = min(abs(dy - up), abs(dy + down));
      // Eyes: wider, darker lid margin (lash line + crease shadow). Mouth: thin inner-lip edge.
      float w = i < 2 ? 0.05 : 0.025;
      rim = max(rim, (1.0 - smoothstep(0.0, w, edge)) * smoothstep(0.0, 0.02, open));
    }
    return rim;
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

  // Openings cut between the lids and lips while the webcam drives the face (set by AvatarRig).
  // Per feature (0 right eye, 1 left eye, 2 mouth): corners A/B, bow (seam Y, seam Z, opening
  // above the seam, opening below it) and the corners' current expression offset.
  const vec3s = () => [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const features = {
    uFA: { value: vec3s() },
    uFB: { value: vec3s() },
    uFBow: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
    uFOff: { value: vec3s() },
  };
  // Expression-space position (before head rotation), written by the rig; rest pose by default.
  geometry.setAttribute('aExpr', geometry.getAttribute('position').clone());

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
    Object.assign(shader.uniforms, features);
    shader.vertexShader = 'attribute vec3 aExpr;\nvarying float vSkinY;\nvarying vec3 vExpr;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n  vSkinY = position.y;\n  vExpr = aExpr;',
    );
    shader.fragmentShader = 'uniform float uCut;\nvarying float vSkinY;\n' + FEATURE_CUT_GLSL + shader.fragmentShader
      .replace('void main() {', 'void main() {\n  if (vSkinY < uCut) discard;\n  float featureRim = featureCut(vExpr);')
      // Darken the lid margin / lash line and the inner lip edge around each opening.
      .replace('#include <map_fragment>', '#include <map_fragment>\n  diffuseColor.rgb *= 1.0 - featureRim * 0.7;')
      // The scan ships a specular map (bright = glossy); use it as inverted roughness.
      .replace('#include <roughnessmap_fragment>', /* glsl */ `
        float roughnessFactor = roughness;
        #ifdef USE_ROUGHNESSMAP
          vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
          roughnessFactor *= 1.0 - texelRoughness.g * 0.6;
        #endif
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
  const holoDepth = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ colorWrite: false }));
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

  return { group, mesh, features, update };
}
