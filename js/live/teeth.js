import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/*
 * Procedural dentition: upper and lower dental arches with gums and a tongue.
 * Sizes are derived from the mouth width measured on the scan (model units; the head is
 * ~8 units wide, so 1 unit ≈ 2 cm). Tooth proportions follow average adult dimensions
 * (central incisor ≈ 8.5 mm wide, 10 mm crown; first molar ≈ 10 mm wide).
 */

// Per side, from the midline outward: [width, crown height, depth, corner radius, kind]
const UPPER = [
  [0.43, 0.52, 0.16, 0.05, 'incisor'],
  [0.33, 0.46, 0.15, 0.05, 'incisor'],
  [0.38, 0.52, 0.2, 0.08, 'canine'],
  [0.34, 0.4, 0.24, 0.07, 'premolar'],
  [0.33, 0.38, 0.25, 0.07, 'premolar'],
  [0.5, 0.36, 0.34, 0.08, 'molar'],
];
const LOWER = [
  [0.27, 0.44, 0.15, 0.04, 'incisor'],
  [0.29, 0.45, 0.15, 0.04, 'incisor'],
  [0.34, 0.5, 0.19, 0.07, 'canine'],
  [0.35, 0.4, 0.24, 0.07, 'premolar'],
  [0.35, 0.38, 0.25, 0.07, 'premolar'],
  [0.55, 0.36, 0.34, 0.08, 'molar'],
];
const GAP = 0.03; // between neighbouring crowns (fraction of scale)

function toothGeometry([w, h, d, r, kind], scale) {
  const geo = new RoundedBoxGeometry(w * scale, h * scale, d * scale, 3, r * scale);
  const pos = geo.getAttribute('position');
  const half = (h * scale) / 2;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = (y + half) / (h * scale); // 0 at incisal edge, 1 at the gum line
    let sx = 1, sz = 1;
    if (kind === 'incisor') { sx = 0.82 + 0.18 * (1 - t); sz = 0.55 + 0.45 * t; } // blade: thin at the edge
    else if (kind === 'canine') { const p = 1 - t; sx = 1 - 0.55 * p * p; sz = 0.7 + 0.3 * t; } // pointed cusp
    else { sx = 0.9 + 0.1 * t; sz = 0.9 + 0.1 * t; } // slight taper toward the root
    pos.setX(i, pos.getX(i) * sx);
    pos.setZ(i, pos.getZ(i) * sz);
    if (kind === 'molar' && t < 0.12) {
      // Two shallow cusps on the chewing surface.
      const cusp = Math.cos((pos.getX(i) / (w * scale)) * Math.PI * 2) * 0.03 * scale;
      pos.setY(i, y - cusp);
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// Parabolic arch in the XZ plane, front at z = 0 (toward the lips), opening toward −Z.
function archCurve(halfWidth, depth) {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const s = -1 + (2 * i) / 24;
    pts.push(new THREE.Vector3(s * halfWidth, 0, -depth * s * s));
  }
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
}

function buildArch(spec, { scale, halfWidth, depth, yEdge, up }, toothMat, gumMat) {
  const group = new THREE.Group();
  const curve = archCurve(halfWidth, depth);
  const length = curve.getLength();
  const dir = up ? 1 : -1;

  // Arc-length positions of the crowns, mirrored around the midline.
  let offset = 0;
  const placements = [];
  for (const tooth of spec) {
    const w = tooth[0] * scale;
    const center = offset + w / 2;
    placements.push({ tooth, arc: center }, { tooth, arc: -center });
    offset += w + GAP * scale;
  }

  const x = new THREE.Vector3(), y = new THREE.Vector3(0, 1, 0), z = new THREE.Vector3();
  const m = new THREE.Matrix4();
  for (const { tooth, arc } of placements) {
    const u = Math.min(0.999, Math.max(0.001, 0.5 + arc / length));
    const p = curve.getPointAt(u);
    const tangent = curve.getTangentAt(u);
    x.copy(tangent).setY(0).normalize();
    z.crossVectors(x, y).normalize(); // outward normal (+Z at the front)
    if (z.z < 0) z.negate();
    const h = tooth[1] * scale;
    const mesh = new THREE.Mesh(toothGeometry(tooth, scale), toothMat);
    // Crown hangs from (upper) or rises from (lower) the gum line; the edge sits at yEdge.
    m.makeBasis(x, y, z).setPosition(p.x, yEdge + dir * h / 2, p.z);
    mesh.applyMatrix4(m);
    if (up) mesh.rotateX(Math.PI); // incisal shaping points down for upper teeth
    // Upper incisors flare slightly forward, molars sit a touch inward.
    mesh.rotateX(dir * (tooth[4] === 'incisor' ? -0.12 : 0.04));
    group.add(mesh);
  }

  // Gum: a tube along the arch at the gum line, plus a thin sheet closing it toward the palate.
  const gumCurve = archCurve(halfWidth * 1.02, depth * 1.02);
  const gumY = yEdge + dir * (spec[0][1] * scale * 0.92);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(gumCurve, 48, 0.07 * scale, 12, false), gumMat);
  tube.position.y = gumY + dir * 0.03 * scale;
  tube.position.z = -0.08 * scale;
  group.add(tube);
  const roof = new THREE.Mesh(new THREE.CircleGeometry(halfWidth * 1.05, 32), gumMat);
  roof.rotation.x = up ? Math.PI / 2 : -Math.PI / 2;
  roof.position.set(0, gumY + dir * 0.02 * scale, -depth * 0.55);
  roof.scale.z = depth / halfWidth * 1.1;
  group.add(roof);

  return group;
}

/**
 * @param o.width  mouth width between the inner lip corners (model units)
 * @returns { upper: Group, lower: Group, tongue: Mesh } positioned relative to the mouth centre
 *          (x = 0, y = 0 at the lip seam, z = 0 at the lip surface).
 */
export function buildDentition({ width }) {
  // Mouth width ≈ 50 mm; a central incisor is 8.5 mm wide (spec 0.43) → scale = width·8.5/50/0.43.
  const scale = width * 0.395;
  const halfWidth = width * 0.55; // intermolar half-width ≈ 27 mm
  const depth = width * 0.9; // arch depth ≈ 45 mm

  const toothMat = new THREE.MeshPhysicalMaterial({
    color: 0xe9e2d4,
    roughness: 0.28,
    clearcoat: 0.6,
    clearcoatRoughness: 0.15,
    sheen: 0.4,
    sheenColor: new THREE.Color(0xfff4e0),
    sheenRoughness: 0.6,
  });
  const gumMat = new THREE.MeshPhysicalMaterial({
    color: 0xa14f58,
    roughness: 0.5,
    clearcoat: 0.35,
    clearcoatRoughness: 0.3,
  });

  const zFront = -0.2; // arch front behind the lip surface
  const upper = buildArch(UPPER, { scale, halfWidth, depth, yEdge: 0.02, up: true }, toothMat, gumMat);
  upper.position.z = zFront;
  // Lower incisal edges sit ~2 mm below the seam at rest; they then travel with the jaw.
  const lower = buildArch(LOWER, { scale, halfWidth: halfWidth * 0.94, depth: depth * 0.96, yEdge: -0.09, up: false }, toothMat, gumMat);
  lower.position.z = zFront - 0.05;

  const tongue = new THREE.Mesh(
    new THREE.SphereGeometry(1, 40, 24),
    new THREE.MeshPhysicalMaterial({ color: 0x8b3a43, roughness: 0.58, clearcoat: 0.3, clearcoatRoughness: 0.4 }),
  );
  tongue.scale.set(halfWidth * 0.62, 0.09, depth * 0.45);
  tongue.position.set(0, -0.1, zFront - depth * 0.42);

  return { upper, lower, tongue };
}
