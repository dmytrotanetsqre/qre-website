/* ==========================================================================
   Option 3 — contact Q.

   The logo's first path (qre-logo.svg, viewBox 0 0 106 32) as a slab:
   outer contour + counter, Y flipped from SVG, ExtrudeGeometry, no bevel.
   Hidden-line edges (faces match the CTA surface; LineSegments from
   EdgesGeometry). Orthographic camera up and to the side; the letter
   stands upright and yaws about its own vertical axis.

   Three.js loads when the section is within one viewport. The loop runs
   only while the CTA is on screen. prefers-reduced-motion: one still frame
   at ~30° yaw.
   ========================================================================== */

const CONFIG = {
  depth: 8,
  height: 0.85,         // share of the art column
  bleed: 0.275,         // cut off by the left edge of the viewport
  turnMs: 24000,
  stillYaw: Math.PI / 6,
  parallax: 0,          // no cursor reaction
  follow: 0.08,
  dprMax: 2,
  camD: 6000,          // far enough that the scaled letter (hundreds of px) never crosses near/far
  camY: 0.6,            // camera at (d, d * camY, d)
  lineOpacity: 0.38,    // grey, not white
};

// qre-logo.svg first <path>, evenodd. SVG y goes down; flipped when built.
const OUTER = [
  [5.32218, 0],
  [27.0544, 0],
  [32.3766, 5.33333],
  [32.3766, 26.6667],
  [29.4929, 29.556],
  [31.5393, 32],
  [5.32218, 32],
  [0, 26.6667],
  [0, 5.33333],
];

const INNER = [
  [5.32218, 5.33333],
  [27.0544, 5.33333],
  [27.0544, 26.6437],
  [17.7696, 15.5556],
  [10.8219, 15.5556],
  [20.1258, 26.6667],
  [5.32218, 26.6667],
];

function area(pts) {
  let a = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % n];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

function flipY(pts) {
  return pts.map(([x, y]) => [x, -y]);
}

function trace(path, pts) {
  path.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) path.lineTo(pts[i][0], pts[i][1]);
  path.closePath();
}

function cssColor(THREE, el, prop, fallback) {
  const raw = getComputedStyle(el).getPropertyValue(prop).trim();
  const painted = getComputedStyle(el).backgroundColor;
  const color = new THREE.Color();
  for (const candidate of [raw, painted, fallback]) {
    if (!candidate) continue;
    try {
      color.setStyle(candidate);
      return color;
    } catch {
      /* try the next source */
    }
  }
  return color.set(fallback);
}

/* Desktop: the heading is centred on the Q, and the form's top meets the
   title. Padding does that without taking the form out of flow. Below 1024
   the heading already sits above the form, so the offset is cleared. */
function alignCtaForm(section) {
  // Top of the heading block: the kicker is title-sized now, so it starts the heading.
  const title = section.querySelector('.cta__kicker') || section.querySelector('.cta__title');
  const content = section.querySelector('.cta__content');
  if (!title || !content) return false;

  const desktop = window.matchMedia('(min-width: 1024px)').matches;
  if (!desktop) {
    if (content.style.paddingTop) {
      content.style.paddingTop = '';
      return true;
    }
    return false;
  }

  const current = parseFloat(content.style.paddingTop) || 0;
  const next = Math.max(0, Math.round(title.getBoundingClientRect().top - content.getBoundingClientRect().top));
  if (Math.abs(next - current) <= 1) return false;
  content.style.paddingTop = next ? `${next}px` : '';
  return true;
}

function bindCtaAlign(section) {
  const title = section.querySelector('.cta__copy');
  const align = () => {
    let guard = 0;
    while (guard++ < 8 && alignCtaForm(section)) {}
  };
  align();
  new ResizeObserver(align).observe(section);
  if (title) new ResizeObserver(align).observe(title);
  document.fonts?.ready?.then(align);
  window.addEventListener('resize', align);
}

function mountCtaQ() {
  const host = document.querySelector('.cta__art');
  const section = document.querySelector('.cta');
  if (!host || !section) return;

  bindCtaAlign(section);

  const still = window.matchMedia('(prefers-reduced-motion: reduce)');
  const fine = window.matchMedia('(pointer: fine)');
  let started = false;

  const near = new IntersectionObserver((entries) => {
    if (!entries[0]?.isIntersecting) return;
    near.disconnect();
    started = true;
    import('./vendor/three.module.js').then((THREE) => init(THREE, host, section, still, fine));
  }, { rootMargin: '100% 0px' });

  near.observe(section);
  // Already on screen (e.g. #contact): observe does not always fire until
  // a layout pass, so check once after paint.
  requestAnimationFrame(() => {
    if (started) return;
    const rect = section.getBoundingClientRect();
    const vh = window.innerHeight || 0;
    if (rect.bottom > -vh && rect.top < vh * 2) {
      near.disconnect();
      started = true;
      import('./vendor/three.module.js').then((THREE) => init(THREE, host, section, still, fine));
    }
  });
}

function buildShape(THREE) {
  let outer = flipY(OUTER);
  let inner = flipY(INNER);
  if (area(outer) < 0) outer = outer.slice().reverse();
  if (area(inner) > 0) inner = inner.slice().reverse();

  const shape = new THREE.Shape();
  trace(shape, outer);
  const hole = new THREE.Path();
  trace(hole, inner);
  shape.holes.push(hole);
  return shape;
}

function buildGeometry(THREE) {
  const geometry = new THREE.ExtrudeGeometry(buildShape(THREE), {
    depth: CONFIG.depth,
    bevelEnabled: false,
    curveSegments: 1,
    steps: 1,
  });
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox;
  geometry.translate(
    -(bb.min.x + bb.max.x) / 2,
    -(bb.min.y + bb.max.y) / 2,
    -(bb.min.z + bb.max.z) / 2,
  );
  return geometry;
}

function init(THREE, host, section, still, fine) {
  const canvas = document.createElement('canvas');
  canvas.className = 'cta__q';
  canvas.setAttribute('aria-hidden', 'true');
  section.prepend(canvas);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });
  } catch {
    canvas.remove();
    return;
  }

  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.autoClear = true;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 20000);
  const d = CONFIG.camD;
  camera.position.set(d, d * CONFIG.camY, d);
  camera.up.set(0, 1, 0);
  camera.lookAt(0, 0, 0);

  const geometry = buildGeometry(THREE);
  const surface = cssColor(THREE, section, '--surface', '#1A1A1A');
  const paper = cssColor(THREE, section, '--paper', '#FFFFFF');

  const faceMat = new THREE.MeshBasicMaterial({
    color: surface,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const lineMat = new THREE.LineBasicMaterial({
    color: paper,
    opacity: CONFIG.lineOpacity,
    transparent: true,
    depthWrite: false,
    linewidth: 1,
  });

  const mesh = new THREE.Mesh(geometry, faceMat);
  const lines = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 1), lineMat);
  mesh.add(lines);

  const pivot = new THREE.Group();
  pivot.add(mesh);
  scene.add(pivot);

  let restSize = new THREE.Vector3();
  let restCx = 0;
  let restCy = 0;
  let angle = 0;
  let parX = 0;
  let parY = 0;
  let aimX = 0;
  let aimY = 0;
  let onScreen = false;
  let reduced = still.matches;
  let raf = 0;
  let last = performance.now();
  const box = new THREE.Box3();
  const corner = new THREE.Vector3();
  const camMin = new THREE.Vector3();
  const camMax = new THREE.Vector3();

  function applyPose() {
    mesh.rotation.set(0, angle, 0);
    pivot.rotation.order = 'YXZ';
    pivot.rotation.x = parX;
    pivot.rotation.y = parY;
  }

  function camBounds() {
    pivot.updateMatrixWorld(true);
    box.setFromObject(pivot);
    camera.updateMatrixWorld();
    const inv = camera.matrixWorldInverse;
    camMin.set(Infinity, Infinity, Infinity);
    camMax.set(-Infinity, -Infinity, -Infinity);
    for (let i = 0; i < 8; i++) {
      corner.set(
        i & 1 ? box.max.x : box.min.x,
        i & 2 ? box.max.y : box.min.y,
        i & 4 ? box.max.z : box.min.z,
      ).applyMatrix4(inv);
      camMin.min(corner);
      camMax.max(corner);
    }
    return {
      w: camMax.x - camMin.x,
      h: camMax.y - camMin.y,
      cx: (camMin.x + camMax.x) / 2,
      cy: (camMin.y + camMax.y) / 2,
    };
  }

  function measureRest() {
    const saved = angle;
    const savedX = parX;
    const savedY = parY;
    parX = 0;
    parY = 0;
    pivot.scale.setScalar(1);
    let maxW = 0;
    let maxH = 0;
    const samples = 12;
    for (let i = 0; i < samples; i++) {
      angle = (i / samples) * Math.PI * 2;
      applyPose();
      const b = camBounds();
      if (b.w > maxW) maxW = b.w;
      if (b.h > maxH) maxH = b.h;
    }
    angle = 0;
    applyPose();
    const rest = camBounds();
    restSize.set(maxW, maxH, 1);
    restCx = rest.cx;
    restCy = rest.cy;
    angle = saved;
    parX = savedX;
    parY = savedY;
    applyPose();
  }

  function syncMaterials() {
    faceMat.color.copy(cssColor(THREE, section, '--surface', '#1A1A1A'));
    lineMat.color.copy(cssColor(THREE, section, '--paper', '#FFFFFF'));
  }

  function layout() {
    let guard = 0;
    while (guard++ < 8 && alignCtaForm(section)) {}

    const w = section.clientWidth;
    const h = section.clientHeight;
    if (w < 2 || h < 2) return;

    const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.dprMax);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    syncMaterials();

    const halfW = w / 2;
    const halfH = h / 2;
    const artH = host.clientHeight || h * 0.45;
    const scale = (artH * CONFIG.height) / restSize.y;
    pivot.scale.setScalar(scale);

    const sizeX = restSize.x * scale;
    const artBox = host.getBoundingClientRect();
    const secBox = section.getBoundingClientRect();
    const artMid = artBox.top - secBox.top + host.clientHeight / 2;
    const letterX = -halfW + (0.5 - CONFIG.bleed) * sizeX - restCx * scale;
    const letterY = halfH - artMid - restCy * scale;

    camera.left = -halfW - letterX;
    camera.right = halfW - letterX;
    camera.top = halfH - letterY;
    camera.bottom = -halfH - letterY;
    camera.updateProjectionMatrix();
  }

  function render() {
    applyPose();
    renderer.render(scene, camera);
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function isPlaying() {
    return onScreen && !document.hidden;
  }

  function tick(now) {
    raf = 0;
    if (!isPlaying()) return;
    const dt = Math.min(now - last, 64);
    last = now;

    if (!reduced) {
      angle += (dt / CONFIG.turnMs) * Math.PI * 2;
      const k = 1 - (1 - CONFIG.follow) ** (dt / (1000 / 60));
      parX += (aimX - parX) * k;
      parY += (aimY - parY) * k;
    }

    render();
    if (!reduced) raf = requestAnimationFrame(tick);
  }

  function play() {
    if (!isPlaying()) {
      stop();
      return;
    }
    if (reduced) {
      stop();
      angle = CONFIG.stillYaw;
      parX = 0;
      parY = 0;
      render();
      return;
    }
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }

  function setOnScreen(on) {
    onScreen = on;
    if (isPlaying()) play();
    else stop();
  }

  measureRest();
  layout();

  const view = new IntersectionObserver((entries) => {
    setOnScreen(!!entries[0]?.isIntersecting);
  });
  view.observe(section);

  const onResize = () => {
    layout();
    if (isPlaying() && reduced) render();
  };
  new ResizeObserver(onResize).observe(section);
  new ResizeObserver(onResize).observe(host);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else play();
  });

  still.addEventListener('change', () => {
    reduced = still.matches;
    if (reduced) {
      angle = CONFIG.stillYaw;
      parX = 0;
      parY = 0;
      aimX = 0;
      aimY = 0;
    }
    play();
  });


  const zeroAim = () => { aimX = 0; aimY = 0; };
  document.documentElement.addEventListener('mouseleave', zeroAim);
  fine.addEventListener('change', () => { if (!fine.matches) zeroAim(); });

  const rect = section.getBoundingClientRect();
  if (rect.bottom > 0 && rect.top < window.innerHeight) setOnScreen(true);
}

mountCtaQ();
