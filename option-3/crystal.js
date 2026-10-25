/* ==========================================================================
   Option 3 — services crystal.

   The glyphs are a fixed Geist Mono 0/1 grid. They never move, rotate,
   or scale; a cell may flip 0↔1 on its own slow clock. Three.js draws the
   current shape as a solid lit mesh (key light + rim) into a small
   offscreen buffer. Each frame that buffer is sampled one pixel per cell,
   the same getImageData path as the ASCII renderer, and the brightness
   becomes the cell's alpha. Outside the shape the cells stay off, so
   rotation reads as light moving across a still grid.

   createCrystal(container, { shape, dpr }) → { morphTo, pause, resume, destroy }

   Shapes, all normalised to the same size:
     crystal, network, devices, globe, gear, bars

   morphTo(name, { duration }) crossfades the two meshes over ~0.9s.
   A newer target replaces the in-flight one from the current weights,
   so a fast scroll never queues. prefers-reduced-motion: no spin,
   a short crossfade. Off-screen and a hidden tab pause the loop.
   The glyph canvas caps device pixel ratio at CONFIG.dprMax; below
   CONFIG.phoneQuery the cells are the smaller ASCII size.
   ========================================================================== */

import * as THREE from './vendor/three.module.js';

const TAU = Math.PI * 2;

const FONT = '"Geist Mono", ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

export const CONFIG = {
  // site.js still reads these to choose the compact remount. The grid
  // itself is sized from the panel and the glyph box below.
  count: 3200,
  countPhone: 1200,
  phoneQuery: '(max-width: 1023px)',
  dprMax: 2,

  glyphPx: 14,
  glyphPxPhone: 12,
  letterSpacing: 0.5,

  // Longest axis of every shape, in world units, before the camera fit.
  radius: 1,
  fov: 30,
  fit: 1.32,
  pose: 0.2,
  tiltX: 0.46,
  tiltZ: 0.08,
  spin: 18,

  // Offscreen buffer, short side. Desktop has more pixels per cell.
  renderShort: 240,
  renderShortPhone: 160,

  // Sampled brightness below this (0–255) draws no glyph.
  inkFloor: 14,

  flipMin: 2.4,
  flipMax: 6.2,

  morphDuration: 900,
  reducedMorph: 200,

  key: [0.46, 0.84, 0.5],
  back: [-0.7, 0.24, -0.64],
};

export const SHAPES = {
  crystal: { title: 'Crystal' },
  network: { title: 'Network' },
  devices: { title: 'Devices' },
  globe: { title: 'Globe' },
  gear: { title: 'Gear' },
  bars: { title: 'Bars' },
};

const MESH_VERT = `
varying vec3 vN;
varying vec3 vV;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalMatrix * normal;
  vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

const MESH_FRAG = `
uniform vec3 uKey;
uniform vec3 uBack;
uniform float uGain;
varying vec3 vN;
varying vec3 vV;
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(vV);
  float key = clamp(dot(N, uKey), 0.0, 1.0);
  float back = clamp(dot(N, uBack), 0.0, 1.0);
  float fres = pow(1.0 - clamp(abs(dot(N, V)), 0.0, 1.0), 1.15);
  float shade = 0.26 + key * 0.52 + back * 0.16;
  shade = mix(shade, 1.0, fres);
  shade = clamp(shade * uGain, 0.0, 1.0);
  gl_FragColor = vec4(vec3(shade), 1.0);
}
`;

const MIX_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const MIX_FRAG = `
uniform sampler2D uA;
uniform sampler2D uB;
uniform float uMix;
varying vec2 vUv;
void main() {
  vec3 color = texture2D(uA, vUv).rgb;
  if (uMix > 0.001) color = mix(color, texture2D(uB, vUv).rgb, uMix);
  gl_FragColor = vec4(color, 1.0);
}
`;

function clamp01(t) {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

function inOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
}

function hash(n) {
  let x = Math.imul(n + 1, 374761393);
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return (x ^ (x >>> 16)) >>> 0;
}

function normalize3(xyz) {
  const len = Math.hypot(xyz[0], xyz[1], xyz[2]) || 1;
  return new THREE.Vector3(xyz[0] / len, xyz[1] / len, xyz[2] / len);
}

function ring(n, y, r, rot) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU;
    pts.push([Math.cos(a) * r, y, Math.sin(a) * r]);
  }
  return pts;
}

function pushTri(faces, a, b, c) {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const abz = b[2] - a[2];
  const acx = c[0] - a[0];
  const acy = c[1] - a[1];
  const acz = c[2] - a[2];
  const nx = aby * acz - abz * acy;
  const ny = abz * acx - abx * acz;
  const nz = abx * acy - aby * acx;
  const cx = (a[0] + b[0] + c[0]) / 3;
  const cy = (a[1] + b[1] + c[1]) / 3;
  const cz = (a[2] + b[2] + c[2]) / 3;
  if (nx * cx + ny * cy + nz * cz < 0) faces.push([a, c, b]);
  else faces.push([a, b, c]);
}

function bridge(faces, A, B) {
  const n = A.length;
  for (let i = 0; i < n; i++) {
    const a0 = A[i];
    const a1 = A[(i + 1) % n];
    const b0 = B[i];
    const b1 = B[(i + 1) % n];
    pushTri(faces, a0, b0, b1);
    pushTri(faces, a0, b1, a1);
  }
}

function fan(faces, ringPts, apex) {
  for (let i = 0; i < ringPts.length; i++) {
    pushTri(faces, ringPts[i], ringPts[(i + 1) % ringPts.length], apex);
  }
}

function geometryFromFaces(faces) {
  const position = new Float32Array(faces.length * 9);
  let o = 0;
  for (let i = 0; i < faces.length; i++) {
    const face = faces[i];
    for (let k = 0; k < 3; k++) {
      position[o++] = face[k][0];
      position[o++] = face[k][1];
      position[o++] = face[k][2];
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geo.computeVertexNormals();
  return geo;
}

function roundRect(w, h, r) {
  const shape = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  const rr = Math.min(r, w / 2 - 0.001, h / 2 - 0.001);
  shape.moveTo(x + rr, y);
  shape.lineTo(x + w - rr, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + rr);
  shape.lineTo(x + w, y + h - rr);
  shape.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  shape.lineTo(x + rr, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - rr);
  shape.lineTo(x, y + rr);
  shape.quadraticCurveTo(x, y, x + rr, y);
  return shape;
}

function slab(w, h, r, depth) {
  const geo = new THREE.ExtrudeGeometry(roundRect(w, h, r), {
    depth,
    bevelEnabled: true,
    bevelThickness: Math.min(0.018, depth * 0.3),
    bevelSize: Math.min(0.016, r * 0.22),
    bevelSegments: 1,
    curveSegments: 6,
  });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

function makeMaterial(gain) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uKey: { value: normalize3(CONFIG.key) },
      uBack: { value: normalize3(CONFIG.back) },
      uGain: { value: gain },
    },
    vertexShader: MESH_VERT,
    fragmentShader: MESH_FRAG,
    side: THREE.FrontSide,
    toneMapped: false,
  });
}

function addMesh(group, geometry, material, x, y, z) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.frustumCulled = false;
  group.add(mesh);
  return mesh;
}

function fitObject(group) {
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  group.position.sub(center);
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const fitted = new THREE.Group();
  fitted.scale.setScalar((CONFIG.radius * 2) / maxDim);
  fitted.add(group);
  const pivot = new THREE.Group();
  pivot.frustumCulled = false;
  pivot.add(fitted);
  return pivot;
}

function finish(group) {
  const pivot = fitObject(group);
  const geometries = new Set();
  const materials = new Set();
  pivot.traverse((obj) => {
    obj.frustumCulled = false;
    if (!obj.isMesh) return;
    geometries.add(obj.geometry);
    materials.add(obj.material);
  });
  return { pivot, geometries: [...geometries], materials: [...materials] };
}

function buildCrystal() {
  // Four-sided gem: a flat table, a kinked crown, a long pavilion.
  // At grid size a hexagon reads as a circle, so the silhouette stays a kite.
  const n = 4;
  const turn = Math.PI / 4;
  const girdle = ring(n, 0.04, 0.86, turn);
  const crown = ring(n, 0.34, 0.62, turn + Math.PI / n);
  const table = ring(n, 0.7, 0.34, turn);
  const pavilion = ring(n, -0.2, 0.66, turn + Math.PI / n);
  const culet = [0, -1.28, 0];
  const faces = [];
  bridge(faces, girdle, crown);
  bridge(faces, crown, table);
  fan(faces, table, [0, 0.7, 0]);
  bridge(faces, pavilion, girdle);
  fan(faces, pavilion, culet);
  const group = new THREE.Group();
  addMesh(group, geometryFromFaces(faces), makeMaterial(1), 0, 0, 0);
  return group;
}

function buildNetwork() {
  const group = new THREE.Group();
  const nodeMat = makeMaterial(1);
  const linkMat = makeMaterial(0.92);
  const nodeGeo = new THREE.SphereGeometry(0.22, 16, 12);
  // Spread in front of the camera. Gaps stay wider than a node so the
  // graph survives the cell grid instead of closing into a blob.
  const nodes = [
    [0.0, 0.1, 0.2],
    [-1.15, 0.78, 0.02],
    [1.15, 0.86, -0.06],
    [-0.95, -0.86, 0.08],
    [1.05, -0.7, 0.0],
    [0.08, 1.4, -0.1],
    [-0.12, -1.42, 0.06],
    [1.62, 0.08, 0.16],
  ];
  const links = [
    [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6],
    [1, 5], [2, 5], [2, 7], [4, 7], [3, 6], [1, 3],
  ];
  nodes.forEach((p) => {
    addMesh(group, nodeGeo, nodeMat, p[0], p[1], p[2]);
  });
  links.forEach(([i, j]) => {
    const pa = nodes[i];
    const pb = nodes[j];
    const dx = pb[0] - pa[0];
    const dy = pb[1] - pa[1];
    const dz = pb[2] - pa[2];
    const len = Math.hypot(dx, dy, dz);
    const geo = new THREE.CylinderGeometry(0.072, 0.072, Math.max(0.08, len - 0.36), 8, 1, false);
    const mesh = new THREE.Mesh(geo, linkMat);
    mesh.position.set((pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, (pa[2] + pb[2]) / 2);
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(dx / len, dy / len, dz / len),
    );
    group.add(mesh);
  });
  return group;
}

function buildDevices() {
  const group = new THREE.Group();
  const body = makeMaterial(1);
  const glass = makeMaterial(0.32);

  const phone = new THREE.Group();
  phone.position.set(-1.2, 0.04, 0);
  phone.rotation.y = 0.42;
  addMesh(phone, slab(0.74, 1.48, 0.12, 0.3), body, 0, 0, 0);
  addMesh(phone, new THREE.BoxGeometry(0.5, 1.02, 0.05), glass, 0, 0.05, 0.2);
  group.add(phone);

  const desk = new THREE.Group();
  desk.position.set(1.05, 0.08, 0);
  desk.rotation.y = -0.32;
  addMesh(desk, slab(1.72, 1.1, 0.05, 0.24), body, 0, 0.22, 0);
  addMesh(desk, new THREE.BoxGeometry(1.4, 0.82, 0.05), glass, 0, 0.24, 0.17);
  addMesh(desk, new THREE.BoxGeometry(0.18, 0.42, 0.18), body, 0, -0.52, 0);
  addMesh(desk, new THREE.BoxGeometry(0.7, 0.12, 0.46), body, 0, -0.78, 0);
  group.add(desk);
  return group;
}

function buildGlobe() {
  const group = new THREE.Group();
  const sphereMat = makeMaterial(0.42);
  const lineMat = makeMaterial(1);
  addMesh(group, new THREE.SphereGeometry(0.86, 48, 32), sphereMat, 0, 0, 0);
  const meridian = new THREE.TorusGeometry(1.02, 0.07, 8, 64);
  for (let i = 0; i < 4; i++) {
    const mesh = addMesh(group, meridian, lineMat, 0, 0, 0);
    mesh.rotation.y = (i / 4) * Math.PI;
  }
  [-0.5, 0, 0.5].forEach((y) => {
    const r = Math.sqrt(Math.max(0.12, 1 - y * y)) * 1.02;
    const geo = new THREE.TorusGeometry(r, y === 0 ? 0.085 : 0.065, 8, 64);
    const mesh = addMesh(group, geo, lineMat, 0, y * 1.02, 0);
    mesh.rotation.x = Math.PI / 2;
  });
  return group;
}

function buildGear() {
  const teeth = 8;
  const root = 0.7;
  const tip = 1.24;
  const hole = 0.5;
  const shape = new THREE.Shape();
  const step = TAU / teeth;
  let started = false;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const gap = step * 0.2;
    const tooth = step * 0.15;
    const mid = a + step * 0.5;
    const pts = [
      [a + gap, root],
      [mid - tooth, root],
      [mid - tooth * 0.45, tip],
      [mid + tooth * 0.45, tip],
      [mid + tooth, root],
      [a + step - gap, root],
    ];
    for (let k = 0; k < pts.length; k++) {
      const ang = pts[k][0];
      const r = pts[k][1];
      const x = Math.cos(ang) * r;
      const y = Math.sin(ang) * r;
      if (!started) {
        shape.moveTo(x, y);
        started = true;
      } else shape.lineTo(x, y);
    }
  }
  shape.closePath();
  const holePath = new THREE.Path();
  holePath.absarc(0, 0, hole, 0, TAU, true);
  shape.holes.push(holePath);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.52,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.022,
    bevelSegments: 1,
    curveSegments: 10,
  });
  geo.translate(0, 0, -0.26);
  const group = new THREE.Group();
  const mesh = addMesh(group, geo, makeMaterial(1), 0, 0, 0);
  // Flat on the horizontal plane, so a yaw keeps the hole and the teeth in view.
  mesh.rotation.x = -Math.PI / 2;
  return group;
}

function buildBars() {
  const group = new THREE.Group();
  const material = makeMaterial(1);
  const heights = [0.4, 0.86, 0.55, 1.32, 0.68];
  const width = 0.34;
  const depth = 0.3;
  const gap = 0.3;
  const total = heights.length * width + (heights.length - 1) * gap;
  let x = -total / 2 + width / 2;
  heights.forEach((h) => {
    addMesh(group, new THREE.BoxGeometry(width, h, depth), material, x, h / 2, 0);
    x += width + gap;
  });
  return group;
}

const BUILDERS = {
  crystal: buildCrystal,
  network: buildNetwork,
  devices: buildDevices,
  globe: buildGlobe,
  gear: buildGear,
  bars: buildBars,
};

function resolveDpr(options) {
  const requested = options.dpr > 0 ? options.dpr : (window.devicePixelRatio || 1);
  return Math.min(requested, CONFIG.dprMax);
}

function bufferSize(width, height, compact) {
  const shortSide = compact ? CONFIG.renderShortPhone : CONFIG.renderShort;
  const aspect = width / Math.max(height, 1);
  let rw;
  let rh;
  if (aspect >= 1) {
    rh = shortSide;
    rw = Math.round(shortSide * aspect);
  } else {
    rw = shortSide;
    rh = Math.round(shortSide / Math.max(aspect, 0.001));
  }
  const cap = 640;
  if (rw > cap) {
    rh = Math.max(2, Math.round((rh * cap) / rw));
    rw = cap;
  }
  if (rh > cap) {
    rw = Math.max(2, Math.round((rw * cap) / rh));
    rh = cap;
  }
  return [Math.max(2, rw), Math.max(2, rh)];
}

export function createCrystal(container, options = {}) {
  if (!container) throw new Error('createCrystal needs a container.');

  const names = Object.keys(SHAPES);
  const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = reducedQuery.matches;
  let dpr = resolveDpr(options);
  const initialName = SHAPES[options.shape] ? options.shape : 'crystal';

  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';

  const view = document.createElement('canvas');
  view.setAttribute('aria-hidden', 'true');
  view.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none';
  container.append(view);
  const viewCtx = view.getContext('2d');

  const mask = document.createElement('canvas');
  const maskCtx = mask.getContext('2d');
  const sample = document.createElement('canvas');
  const sampleCtx = sample.getContext('2d', { willReadFrequently: true, alpha: false });

  const glCanvas = document.createElement('canvas');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: glCanvas,
      alpha: false,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });
  } catch (error) {
    view.remove();
    throw error;
  }
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(0x000000, 1);
  renderer.autoClear = true;

  const rtOpts = {
    depthBuffer: true,
    stencilBuffer: false,
    magFilter: THREE.LinearFilter,
    minFilter: THREE.LinearFilter,
    generateMipmaps: false,
  };
  const rtA = new THREE.WebGLRenderTarget(2, 2, rtOpts);
  const rtB = new THREE.WebGLRenderTarget(2, 2, rtOpts);
  rtA.texture.colorSpace = THREE.LinearSRGBColorSpace;
  rtB.texture.colorSpace = THREE.LinearSRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CONFIG.fov, 1, 0.1, 40);
  const tilt = new THREE.Group();
  tilt.rotation.order = 'XYZ';
  tilt.rotation.x = CONFIG.tiltX;
  tilt.rotation.z = CONFIG.tiltZ;
  const spin = new THREE.Group();
  spin.rotation.y = CONFIG.pose;
  tilt.add(spin);
  scene.add(tilt);

  const mixUniforms = {
    uA: { value: rtA.texture },
    uB: { value: rtB.texture },
    uMix: { value: 0 },
  };
  const mixScene = new THREE.Scene();
  const mixCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
  const mixQuad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: mixUniforms,
      vertexShader: MIX_VERT,
      fragmentShader: MIX_FRAG,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  mixQuad.frustumCulled = false;
  mixScene.add(mixQuad);

  const cache = {};
  function ensure(name) {
    if (cache[name]) return cache[name];
    const built = finish(BUILDERS[name]());
    built.pivot.visible = false;
    spin.add(built.pivot);
    cache[name] = built;
    return built;
  }

  const weight = {};
  names.forEach((name) => { weight[name] = name === initialName ? 1 : 0; });
  let fromName = initialName;
  let toName = initialName;
  let morphFrom = { ...weight };
  let morphT = 1;
  let morphLen = CONFIG.morphDuration;

  let grid = null;
  let bits = null;
  let nextFlip = null;
  let flipClock = 0;
  let bufW = 0;
  let bufH = 0;

  function frameCamera(aspect) {
    camera.aspect = aspect;
    const half = CONFIG.radius * CONFIG.fit;
    camera.position.z = half / Math.tan((CONFIG.fov * Math.PI) / 360);
    camera.updateProjectionMatrix();
  }

  function maskState() {
    maskCtx.setTransform(grid.dpr, 0, 0, grid.dpr, 0, 0);
    maskCtx.font = grid.font;
    maskCtx.fillStyle = '#fff';
    maskCtx.textAlign = 'center';
    maskCtx.textBaseline = 'middle';
    maskCtx.globalAlpha = 1;
    maskCtx.globalCompositeOperation = 'source-over';
    if ('letterSpacing' in maskCtx) maskCtx.letterSpacing = '0px';
  }

  function paintCell(i) {
    const col = i % grid.columns;
    const row = (i / grid.columns) | 0;
    const x = col * grid.cellWidth;
    const y = row * grid.cellHeight;
    maskCtx.clearRect(x + 0.5, y + 0.5, Math.max(0, grid.cellWidth - 1), Math.max(0, grid.cellHeight - 1));
    maskCtx.fillText(bits[i] ? '1' : '0', x + grid.cellWidth * 0.5, y + grid.cellHeight * 0.5);
  }

  function paintAll() {
    maskCtx.setTransform(1, 0, 0, 1, 0, 0);
    maskCtx.clearRect(0, 0, mask.width, mask.height);
    maskState();
    for (let i = 0; i < bits.length; i++) {
      const col = i % grid.columns;
      const row = (i / grid.columns) | 0;
      const x = col * grid.cellWidth + grid.cellWidth * 0.5;
      const y = row * grid.cellHeight + grid.cellHeight * 0.5;
      maskCtx.fillText(bits[i] ? '1' : '0', x, y);
    }
  }

  function seedBits(count) {
    bits = new Uint8Array(count);
    nextFlip = new Float32Array(count);
    const span = CONFIG.flipMax - CONFIG.flipMin;
    for (let i = 0; i < count; i++) {
      const n = hash(i);
      bits[i] = n & 1;
      nextFlip[i] = flipClock + CONFIG.flipMin + ((n >>> 1) % 1000) / 1000 * span;
    }
  }

  function layout(force) {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width < 2 || height < 2) return false;
    const compact = window.matchMedia(CONFIG.phoneQuery).matches;
    const fontSize = compact ? CONFIG.glyphPxPhone : CONFIG.glyphPx;
    const font = `400 ${fontSize}px ${FONT}`;
    maskCtx.setTransform(1, 0, 0, 1, 0, 0);
    if ('letterSpacing' in maskCtx) maskCtx.letterSpacing = '0px';
    maskCtx.font = font;
    const glyphWidth = Math.max(maskCtx.measureText('0').width, maskCtx.measureText('1').width, fontSize * 0.55);
    const pitch = glyphWidth * (1 + CONFIG.letterSpacing);
    const columns = Math.max(1, Math.floor(width / pitch));
    const rows = Math.max(1, Math.round(height / fontSize));
    const same = !force && grid
      && grid.columns === columns
      && grid.rows === rows
      && grid.dpr === dpr
      && grid.fontSize === fontSize
      && grid.width === width
      && grid.height === height;
    if (same) return false;

    const count = columns * rows;
    if (!bits || bits.length !== count) seedBits(count);
    grid = {
      width,
      height,
      columns,
      rows,
      dpr,
      fontSize,
      font,
      glyphWidth,
      cellWidth: width / columns,
      cellHeight: height / rows,
    };

    const storeW = Math.max(1, Math.round(width * dpr));
    const storeH = Math.max(1, Math.round(height * dpr));
    if (view.width !== storeW || view.height !== storeH) {
      view.width = storeW;
      view.height = storeH;
    }
    if (mask.width !== storeW || mask.height !== storeH) {
      mask.width = storeW;
      mask.height = storeH;
    }
    if (sample.width !== columns || sample.height !== rows) {
      sample.width = columns;
      sample.height = rows;
    }
    paintAll();

    const [rw, rh] = bufferSize(width, height, compact);
    if (rw !== bufW || rh !== bufH) {
      bufW = rw;
      bufH = rh;
      renderer.setSize(rw, rh, false);
      rtA.setSize(rw, rh);
      rtB.setSize(rw, rh);
    }
    frameCamera(rw / rh);
    return true;
  }

  function scaleFor(name, mix) {
    if (reduced || fromName === toName) return 1;
    if (name === toName) return 1.06 - 0.06 * mix;
    if (name === fromName) return 1 - 0.04 * mix;
    return 1;
  }

  function renderShape(name, target) {
    for (let i = 0; i < names.length; i++) {
      const built = cache[names[i]];
      if (!built) continue;
      const on = names[i] === name;
      built.pivot.visible = on;
      if (on) built.pivot.scale.setScalar(scaleFor(name, weight[toName] || 0));
    }
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
  }

  function renderOffscreen() {
    const mix = fromName === toName ? 0 : (weight[toName] || 0);
    if (mix <= 0.001 || mix >= 0.999) {
      renderShape(mix >= 0.999 ? toName : fromName, rtA);
      mixUniforms.uMix.value = 0;
    } else {
      renderShape(fromName, rtA);
      renderShape(toName, rtB);
      mixUniforms.uMix.value = mix;
    }
    renderer.setRenderTarget(null);
    renderer.render(mixScene, mixCamera);
  }

  function composite() {
    const { columns, rows, cellWidth, cellHeight, width, height } = grid;
    sampleCtx.imageSmoothingEnabled = true;
    sampleCtx.imageSmoothingQuality = 'high';
    sampleCtx.drawImage(glCanvas, 0, 0, columns, rows);
    const pixels = sampleCtx.getImageData(0, 0, columns, rows).data;
    const floor = CONFIG.inkFloor;

    viewCtx.setTransform(grid.dpr, 0, 0, grid.dpr, 0, 0);
    viewCtx.globalCompositeOperation = 'source-over';
    viewCtx.globalAlpha = 1;
    viewCtx.clearRect(0, 0, width, height);
    viewCtx.fillStyle = '#fff';
    for (let row = 0; row < rows; row++) {
      const y = row * cellHeight;
      const rowStart = row * columns;
      for (let col = 0; col < columns; col++) {
        const v = pixels[(rowStart + col) * 4];
        if (v < floor) continue;
        viewCtx.globalAlpha = v / 255;
        viewCtx.fillRect(col * cellWidth, y, cellWidth + 0.75, cellHeight + 0.75);
      }
    }
    viewCtx.globalAlpha = 1;
    viewCtx.globalCompositeOperation = 'destination-in';
    viewCtx.imageSmoothingEnabled = true;
    viewCtx.drawImage(mask, 0, 0, width, height);
    viewCtx.globalCompositeOperation = 'source-over';
  }

  const flipped = [];
  function runFlips() {
    if (reduced || !grid || !bits) return;
    flipped.length = 0;
    const span = CONFIG.flipMax - CONFIG.flipMin;
    for (let i = 0; i < bits.length; i++) {
      if (flipClock < nextFlip[i]) continue;
      bits[i] ^= 1;
      nextFlip[i] = flipClock + CONFIG.flipMin + Math.random() * span;
      flipped.push(i);
    }
    if (!flipped.length) return;
    maskState();
    for (let k = 0; k < flipped.length; k++) paintCell(flipped[k]);
  }

  function advance(dt) {
    if (morphT < 1) {
      morphT = Math.min(1, morphT + dt / morphLen);
      const e = inOutCubic(morphT);
      for (let i = 0; i < names.length; i++) {
        const name = names[i];
        const goal = name === toName ? 1 : 0;
        const from = morphFrom[name] || 0;
        weight[name] = from + (goal - from) * e;
      }
      if (morphT >= 1) {
        for (let i = 0; i < names.length; i++) weight[names[i]] = names[i] === toName ? 1 : 0;
        fromName = toName;
      }
    }
    if (!reduced) spin.rotation.y += (dt / 1000) * (TAU / CONFIG.spin);
    if (!reduced) flipClock += dt / 1000;
    runFlips();
  }

  function draw(dt) {
    if (!grid && !layout(false)) return;
    advance(dt);
    renderOffscreen();
    composite();
  }

  let dead = false;
  let raf = 0;
  let last = 0;
  let apiHold = false;
  let hidden = document.hidden;
  let seen = true;

  function running() {
    return !dead && !apiHold && !hidden && seen && grid;
  }

  function frame(now) {
    raf = 0;
    if (!running()) return;
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(48, Math.max(0, now - last)) : 0;
    last = now;
    draw(dt);
  }

  function startLoop() {
    if (!running() || raf) return;
    last = 0;
    raf = requestAnimationFrame(frame);
  }

  function stopLoop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
  }

  function onVis() {
    hidden = document.hidden;
    if (hidden) stopLoop();
    else startLoop();
  }

  function onReduce() {
    reduced = reducedQuery.matches;
  }

  const observer = new IntersectionObserver(([entry]) => {
    seen = !!entry && entry.isIntersecting;
    if (seen) startLoop();
    else stopLoop();
  });
  observer.observe(container);
  document.addEventListener('visibilitychange', onVis);
  reducedQuery.addEventListener('change', onReduce);

  let dprWatch = null;
  function watchDpr() {
    if (options.dpr > 0) return;
    if (dprWatch) dprWatch.removeEventListener('change', watchDpr);
    dprWatch = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    dprWatch.addEventListener('change', () => {
      dpr = resolveDpr(options);
      layout(true);
      if (!dead) draw(0);
      watchDpr();
    }, { once: true });
  }

  const resizeObserver = new ResizeObserver(() => {
    if (!layout(false) || dead) return;
    draw(0);
    startLoop();
  });
  resizeObserver.observe(container);

  glCanvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    stopLoop();
  });

  ensure(initialName);
  layout(true);
  if (grid) draw(0);
  startLoop();
  watchDpr();

  let warmAt = 0;
  function warmShapes() {
    if (dead || warmAt >= names.length) return;
    ensure(names[warmAt]);
    warmAt += 1;
    if (warmAt < names.length) requestAnimationFrame(warmShapes);
  }
  requestAnimationFrame(warmShapes);

  if (document.fonts && document.fonts.load) {
    document.fonts.load(`400 ${CONFIG.glyphPx}px "Geist Mono"`).then(() => {
      if (dead) return;
      layout(true);
      draw(0);
    }).catch(() => {});
  }

  return {
    morphTo(name, morphOptions = {}) {
      if (dead || !SHAPES[name] || name === toName) return;
      ensure(name);
      let keep = null;
      let best = -1;
      for (let i = 0; i < names.length; i++) {
        const key = names[i];
        if (key === name) continue;
        if (weight[key] > best) {
          best = weight[key];
          keep = key;
        }
      }
      if (keep) {
        for (let i = 0; i < names.length; i++) {
          const key = names[i];
          if (key !== name && key !== keep) {
            weight[keep] += weight[key];
            weight[key] = 0;
          }
        }
      }
      fromName = keep || name;
      toName = name;
      morphFrom = {};
      for (let i = 0; i < names.length; i++) morphFrom[names[i]] = weight[names[i]] || 0;
      morphT = 0;
      const requested = morphOptions.duration;
      morphLen = reduced
        ? CONFIG.reducedMorph
        : Math.max(16, requested > 0 ? requested : CONFIG.morphDuration);
      startLoop();
    },
    pause() {
      apiHold = true;
      stopLoop();
    },
    resume() {
      apiHold = false;
      startLoop();
    },
    destroy() {
      if (dead) return;
      dead = true;
      stopLoop();
      observer.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      reducedQuery.removeEventListener('change', onReduce);
      if (dprWatch) dprWatch.removeEventListener('change', watchDpr);
      names.forEach((name) => {
        const built = cache[name];
        if (!built) return;
        built.geometries.forEach((geo) => geo.dispose());
        built.materials.forEach((material) => material.dispose());
      });
      mixQuad.geometry.dispose();
      mixQuad.material.dispose();
      rtA.dispose();
      rtB.dispose();
      renderer.dispose();
      view.remove();
    },
  };
}
