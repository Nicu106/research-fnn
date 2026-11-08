import * as THREE from 'three';
import { buildDentition } from './teeth.js';

/*
 * Eyeballs and mouth interior for the scanned head.
 * The scan was captured with closed eyes and a closed mouth, so these parts sit just behind the
 * skin and are only seen through the lid and lip openings the skin shader cuts while the webcam
 * drives the avatar. Placement is derived from the MediaPipe anchors projected onto the scan.
 */

const EYES = [
  { corners: [33, 133], upper: 159, lower: 145 }, // subject's right eye (−X)
  { corners: [263, 362], upper: 386, lower: 374 }, // subject's left eye (+X)
];
const MOUTH = { corners: [78, 308], upper: 13, lower: 14 };

const EYE_RAISE = 0.025; // ~1.3 mm

const anchorAt = (anchors, i) => new THREE.Vector3(anchors[i * 3], anchors[i * 3 + 1], anchors[i * 3 + 2]);

// Equirectangular eyeball texture; the iris is the cap around +Y (rotated to face +Z later).
function eyeTexture() {
  const W = 1024, H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  const PUPIL = 0.11, IRIS = 0.47;
  const mix = (a, b, t) => a + (b - a) * t;
  for (let y = 0; y < H; y++) {
    const theta = ((y + 0.5) / H) * Math.PI;
    for (let x = 0; x < W; x++) {
      const phi = ((x + 0.5) / W) * Math.PI * 2;
      let r, g, b;
      if (theta < PUPIL) {
        r = 6; g = 5; b = 6;
      } else if (theta < IRIS) {
        const u = (theta - PUPIL) / (IRIS - PUPIL);
        const fibers = 0.5 + 0.5 * Math.sin(phi * 140 + 6 * Math.sin(phi * 17 + u * 9) + u * 30);
        const crypts = 0.5 + 0.5 * Math.sin(phi * 23 + 3 * Math.cos(phi * 5));
        const collarette = Math.exp(-((u - 0.32) ** 2) / 0.004);
        let k = 0.55 + 0.3 * fibers * (0.7 + 0.3 * crypts) + 0.35 * collarette;
        k *= mix(1, 0.35, Math.max(0, (u - 0.82) / 0.18)); // limbal ring
        k *= mix(0.55, 1, Math.min(1, u / 0.12)); // pupil margin
        r = 158 * k; g = 108 * k; b = 66 * k;
      } else {
        const edge = Math.min(1, (theta - IRIS) / (Math.PI * 0.35));
        const vein = Math.max(0, Math.sin(phi * 9 + 4 * Math.sin(theta * 7)) - 0.96) * 25 * edge;
        r = mix(238, 226, edge) + vein * 20;
        g = mix(232, 205, edge) - vein * 30;
        b = mix(226, 198, edge) - vein * 30;
      }
      const o = (y * W + x) * 4;
      img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export class FaceParts {
  constructor(anchors) {
    // Transformed each frame with the rig's full head rotation (matrixAutoUpdate off).
    this.group = new THREE.Group();
    this.group.matrixAutoUpdate = false;

    const eyeMat = new THREE.MeshPhysicalMaterial({
      map: eyeTexture(),
      roughness: 0.25,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      envMapIntensity: 1.6,
    });
    this.eyes = EYES.map((e) => {
      const a = anchorAt(anchors, e.corners[0]);
      const b = anchorAt(anchors, e.corners[1]);
      const upper = anchorAt(anchors, e.upper);
      const width = a.distanceTo(b);
      // Sit the globe well inside the orbit so it never pokes through the lower lid or cheek.
      const radius = width * 0.39;
      const center = a.clone().add(b).multiplyScalar(0.5);
      // The scan's lid seam is where a CLOSED eye's lids meet, i.e. the lower third of the globe,
      // so the globe's centre sits ~3 mm above it (see EYE_LIFT in avatarRig.js).
      center.y = (center.y + upper.y) / 2 + 0.01 + EYE_RAISE;
      center.z = upper.z - radius - 0.075;
      const geo = new THREE.SphereGeometry(radius, 64, 48).rotateX(Math.PI / 2);
      const mesh = new THREE.Mesh(geo, eyeMat);
      mesh.position.copy(center);
      mesh.rotation.order = 'YXZ';
      this.group.add(mesh);
      return mesh;
    });

    /** Parts only meant to be seen through the lid and lip openings (see setSkin). */
    this.interior = [];
    // Conjunctiva behind each globe: what shows in the corners of the eye, where the sphere does not
    // reach (the pinkish caruncle at the inner corner, the moist fold at the outer one). Without it
    // those corners showed the empty socket, as black wedges.
    const lining = new THREE.MeshStandardMaterial({ color: 0x6b3d39, roughness: 0.5, metalness: 0 });
    this.eyes.forEach((mesh) => {
      const r = mesh.geometry.parameters.radius;
      const back = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), lining);
      back.scale.set(r * 1.3, r * 1.0, r * 0.7);
      back.position.copy(mesh.position);
      back.position.z -= r * 0.42;
      this.group.add(back);
      this.interior.push(back);
    });

    const c0 = anchorAt(anchors, MOUTH.corners[0]);
    const c1 = anchorAt(anchors, MOUTH.corners[1]);
    const up = anchorAt(anchors, MOUTH.upper);
    const lo = anchorAt(anchors, MOUTH.lower);
    const width = c0.distanceTo(c1);
    const cx = (c0.x + c1.x) / 2;
    const seamY = (up.y + lo.y) / 2;
    const lipZ = Math.max(up.z, lo.z);

    // Near-black cavity: what is seen through the lips is mostly shadow, as in a real mouth.
    const cavity = new THREE.Mesh(
      new THREE.SphereGeometry(1, 40, 28),
      new THREE.MeshStandardMaterial({ color: 0x140406, roughness: 1, side: THREE.BackSide }),
    );
    cavity.scale.set(width * 0.72, width * 0.7, width * 0.95);
    cavity.position.set(cx, seamY - 0.15, lipZ - width * 0.8);
    this.group.add(cavity);
    this.interior.push(cavity);

    // Full dentition, anchored at the lip seam. The lower arch and tongue ride on the jaw.
    const teeth = buildDentition({ width });
    const mouth = new THREE.Group();
    mouth.position.set(cx, seamY, lipZ);
    mouth.add(teeth.upper);
    this.jaw = new THREE.Group();
    this.jaw.add(teeth.lower, teeth.tongue);
    mouth.add(this.jaw);
    this.group.add(mouth);
    this.interior.push(mouth);

    // Soft socket shadow: darkens the top of each eyeball where the upper lid overhangs it.
    const shadowMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uCenterY: { value: 0 }, uRadius: { value: 1 }, uLid: { value: 0.35 } },
      vertexShader: /* glsl */ `
        varying float vY;
        // Height on the globe in its own frame (the sphere is centred on the eye). This used to be
        // world Y compared against a head-local centre, which only agreed while the head stood
        // still at the origin: any head turn or tilt slid the shadow off the lid line.
        void main() { vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        uniform float uCenterY; uniform float uRadius; uniform float uLid; varying float vY;
        void main() {
          float t = vY / uRadius;
          // uLid: height of the upper lid margin on the globe (in radii). The lid overhangs the eye
          // and shades the band just below it; a lowered, heavy lid shades further down. Without
          // this the white of a half-closed eye stayed bright right up to the lashes.
          float a = smoothstep(uLid - 0.8, uLid - 0.02, t) * 0.78 + smoothstep(-0.2, -1.0, t) * 0.25;
          gl_FragColor = vec4(0.02, 0.01, 0.01, a);
        }
      `,
    });
    this.eyes.forEach((mesh) => {
      const r = mesh.geometry.parameters.radius * 1.012;
      const shade = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), shadowMat.clone());
      shade.material.uniforms.uCenterY.value = mesh.position.y;
      shade.material.uniforms.uRadius.value = r;
      shade.position.copy(mesh.position);
      shade.renderOrder = 1;
      this.group.add(shade);
      (this.shades ??= []).push(shade);
    });
  }

  /**
   * Visibility by skin opacity. The eyes help a see-through face look alive, so they stay from
   * fairly low opacity; the mouth interior and the eye-corner lining are only meant to be seen
   * through the openings, and through semi-transparent skin the full dentition showed behind
   * closed lips.
   */
  setSkin(opacity) {
    this.group.visible = opacity > 0.2;
    const inner = opacity > 0.85;
    for (const o of this.interior) o.visible = inner;
  }

  /**
   * @param face  rig.face: { gaze: [[yaw, pitch], [yaw, pitch]] (radians), jaw: { dy, dz } }
   * @param headMatrix  full head rotation about the neck pivot (rig.headMatrix)
   */
  update(face, headMatrix) {
    this.group.matrix.copy(headMatrix);
    this.group.matrixWorldNeedsUpdate = true;
    this.eyes.forEach((mesh, i) => {
      mesh.rotation.set(face.gaze[i][1], face.gaze[i][0], 0);
      // Lid margin height on the globe, in radii: ~0.5 fully open, lower as the lid comes down
      // (openness already includes the lid following a downward gaze).
      // Lid margin above the globe centre, in radii: (0.94 * EYE_LIFT * lid - centre offset) / r.
      if (this.shades) this.shades[i].material.uniforms.uLid.value = -0.28 + 0.6 * (face.lid?.[i] ?? face.eyeOpen[i]);
    });
    // The jaw hinges near the ear: dropping the chin also swings the lower arch slightly back.
    const drop = Math.max(-0.32, Math.min(0, face.jaw.dy));
    this.jaw.position.set(0, drop, face.jaw.dz - drop * 0.35);
  }
}
