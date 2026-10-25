/* ==========================================================================
   Option 3 — contact rain.

   A full-section 0/1 grid in the services crystal’s glyph style (Geist Mono,
   same cell pitch as crystal.js CONFIG). Glyphs never move; brightness
   travels down the columns. Form alignment (was in cta-q.js) still pins the
   form to the top of the heading on desktop. The 3D Q is parked in cta-q.js.
   ========================================================================== */

const FONT = '"Geist Mono", ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

/* Same glyph metrics as crystal.js CONFIG — do not invent new sizes. */
const CONFIG = {
  phoneQuery: '(max-width: 1023px)',
  dprMax: 2,
  glyphPx: 14,
  glyphPxPhone: 12,
  letterSpacing: 0.5,
  headAlpha: 0.9,
  dimInside: 0.35,
  dimFeather: 96,
  tailMin: 8,
  tailMax: 24,
  speedMin: 6,
  speedMax: 14,
  fps: 30,
  flipChance: 0.55,
  reducedDrops: 14,
};

const FRAME_MS = 1000 / CONFIG.fps;

function hash(n) {
  n = Math.imul(n ^ 0x7f4a7c15, 0x27d4eb2d) >>> 0;
  n = Math.imul(n ^ (n >>> 15), 0x165667b1) >>> 0;
  return n ^ (n >>> 16);
}

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

function capDpr() {
  return Math.min(window.devicePixelRatio || 1, CONFIG.dprMax);
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function spawnDrop(rows, delay) {
  const length = Math.round(rand(CONFIG.tailMin, CONFIG.tailMax + 0.99));
  const inFlight = delay == null && Math.random() < 0.62;
  return {
    head: inFlight ? rand(-2, Math.max(rows, 1)) : -rand(1, 8),
    speed: rand(CONFIG.speedMin, CONFIG.speedMax),
    length,
    delay: inFlight ? 0 : (delay ?? rand(0, 4.2)),
  };
}

function dimAt(x, y, boxes, feather) {
  let inside = false;
  let nearest = Infinity;
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    const dx = x < b.left ? b.left - x : x > b.right ? x - b.right : 0;
    const dy = y < b.top ? b.top - y : y > b.bottom ? y - b.bottom : 0;
    if (dx === 0 && dy === 0) {
      inside = true;
      break;
    }
    const d = Math.hypot(dx, dy);
    if (d < nearest) nearest = d;
  }
  if (inside) return CONFIG.dimInside;
  if (nearest >= feather) return 1;
  const t = nearest / feather;
  const s = t * t * (3 - 2 * t);
  return CONFIG.dimInside + (1 - CONFIG.dimInside) * s;
}

function mountCtaRain() {
  const section = document.querySelector('.cta');
  if (!section) return;

  bindCtaAlign(section);

  let canvas = section.querySelector('.cta__rain');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'cta__rain';
    canvas.setAttribute('aria-hidden', 'true');
    section.prepend(canvas);
  }

  const view = canvas;
  const viewCtx = view.getContext('2d', { alpha: true });
  if (!viewCtx) return;

  const still = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = still.matches || document.documentElement.classList.contains('is-reduced');
  let dpr = capDpr();
  let grid = null;
  let bits = null;
  let columnsDrops = [];
  let paper = '#ffffff';
  let dimBoxes = [];
  let onScreen = false;
  let tabVisible = document.visibilityState !== 'hidden';
  let raf = 0;
  let last = 0;
  let dead = false;

  function readPaper() {
    const raw = getComputedStyle(section).getPropertyValue('--paper').trim();
    paper = raw || '#ffffff';
  }

  function measureDim() {
    const sr = section.getBoundingClientRect();
    dimBoxes = [];
    const nodes = section.querySelectorAll('.cta__copy, .cta__content');
    for (let i = 0; i < nodes.length; i++) {
      const r = nodes[i].getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      dimBoxes.push({
        left: r.left - sr.left,
        top: r.top - sr.top,
        right: r.right - sr.left,
        bottom: r.bottom - sr.top,
      });
    }
  }

  function seedBits(count) {
    bits = new Uint8Array(count);
    for (let i = 0; i < count; i++) bits[i] = hash(i) & 1;
  }

  function seedDrops(columns, rows) {
    columnsDrops = new Array(columns);
    for (let col = 0; col < columns; col++) {
      const n = hash(col * 997 + 13) % 100;
      const count = reduced
        ? (n < Math.round(100 * CONFIG.reducedDrops / Math.max(columns, 1)) ? 1 : 0)
        : n < 24 ? 0 : n < 82 ? 1 : 2;
      const drops = [];
      for (let k = 0; k < count; k++) {
        const drop = spawnDrop(rows, reduced ? 0 : k === 0 ? undefined : rand(1.4, 3.6));
        if (reduced) {
          drop.head = rand(0, Math.max(rows - 1, 1));
          drop.delay = 0;
        }
        drops.push(drop);
      }
      columnsDrops[col] = drops;
    }
  }

  function glyphState() {
    viewCtx.setTransform(grid.dpr, 0, 0, grid.dpr, 0, 0);
    viewCtx.font = grid.font;
    viewCtx.fillStyle = paper;
    viewCtx.textAlign = 'center';
    viewCtx.textBaseline = 'middle';
    viewCtx.globalCompositeOperation = 'source-over';
    if ('letterSpacing' in viewCtx) viewCtx.letterSpacing = '0px';
  }

  function layout(force) {
    const width = section.clientWidth;
    const height = section.clientHeight;
    if (width < 2 || height < 2) return false;
    const compact = window.matchMedia(CONFIG.phoneQuery).matches;
    const fontSize = compact ? CONFIG.glyphPxPhone : CONFIG.glyphPx;
    const font = `400 ${fontSize}px ${FONT}`;
    viewCtx.setTransform(1, 0, 0, 1, 0, 0);
    if ('letterSpacing' in viewCtx) viewCtx.letterSpacing = '0px';
    viewCtx.font = font;
    const glyphWidth = Math.max(
      viewCtx.measureText('0').width,
      viewCtx.measureText('1').width,
      fontSize * 0.55,
    );
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
    const rebuildBits = !bits || bits.length !== count;
    if (rebuildBits) seedBits(count);
    const rebuildDrops = !grid || grid.columns !== columns || grid.rows !== rows;
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
    if (rebuildDrops) seedDrops(columns, rows);

    const storeW = Math.max(1, Math.round(width * dpr));
    const storeH = Math.max(1, Math.round(height * dpr));
    if (view.width !== storeW || view.height !== storeH) {
      view.width = storeW;
      view.height = storeH;
    }
    view.style.width = `${width}px`;
    view.style.height = `${height}px`;
    readPaper();
    measureDim();
    return true;
  }

  function dropAlpha(row, drop) {
    if (drop.delay > 0) return 0;
    const dist = drop.head - row;
    if (dist < 0 || dist > drop.length) return 0;
    const t = 1 - dist / drop.length;
    return CONFIG.headAlpha * t;
  }

  function columnAlpha(col, row) {
    const drops = columnsDrops[col];
    let a = 0;
    for (let i = 0; i < drops.length; i++) {
      const v = dropAlpha(row, drops[i]);
      if (v > a) a = v;
    }
    return a;
  }

  function paint() {
    if (!grid) return;
    const { columns, rows, cellWidth, cellHeight } = grid;
    const feather = CONFIG.dimFeather;
    measureDim();
    viewCtx.setTransform(1, 0, 0, 1, 0, 0);
    viewCtx.globalAlpha = 1;
    viewCtx.globalCompositeOperation = 'source-over';
    viewCtx.clearRect(0, 0, view.width, view.height);
    glyphState();

    for (let col = 0; col < columns; col++) {
      const drops = columnsDrops[col];
      let rowMin = rows;
      let rowMax = -1;
      for (let i = 0; i < drops.length; i++) {
        const drop = drops[i];
        if (drop.delay > 0) continue;
        const top = Math.floor(drop.head - drop.length);
        const bot = Math.ceil(drop.head);
        if (top < rowMin) rowMin = top;
        if (bot > rowMax) rowMax = bot;
      }
      if (rowMax < 0) continue;
      const from = Math.max(0, rowMin);
      const to = Math.min(rows - 1, rowMax);
      for (let row = from; row <= to; row++) {
        let a = columnAlpha(col, row);
        if (a <= 0.002) continue;
        const x = col * cellWidth + cellWidth * 0.5;
        const y = row * cellHeight + cellHeight * 0.5;
        a *= dimAt(x, y, dimBoxes, feather);
        if (a <= 0.002) continue;
        const i = row * columns + col;
        viewCtx.globalAlpha = a;
        viewCtx.fillText(bits[i] ? '1' : '0', x, y);
      }
    }
    viewCtx.globalAlpha = 1;
  }

  function maybeFlip(col, row) {
    if (row < 0 || row >= grid.rows) return;
    if (Math.random() > CONFIG.flipChance) return;
    bits[row * grid.columns + col] ^= 1;
  }

  function advance(dt) {
    if (reduced || !grid) return;
    const sec = dt / 1000;
    const rows = grid.rows;
    for (let col = 0; col < grid.columns; col++) {
      const drops = columnsDrops[col];
      for (let i = 0; i < drops.length; i++) {
        const drop = drops[i];
        if (drop.delay > 0) {
          drop.delay -= sec;
          if (drop.delay > 0) continue;
          drop.delay = 0;
          drop.head = -1;
        }
        const prev = drop.head;
        drop.head += drop.speed * sec;
        const from = Math.floor(prev) + 1;
        const to = Math.floor(drop.head);
        if (to >= from) {
          for (let row = from; row <= to; row++) maybeFlip(col, row);
        }
        if (drop.head - drop.length > rows + 2) {
          const next = spawnDrop(rows, rand(0.4, 2.8));
          drop.head = next.head;
          drop.speed = next.speed;
          drop.length = next.length;
          drop.delay = next.delay;
        }
      }
    }
  }

  function tick(now) {
    raf = 0;
    if (dead || !onScreen || !tabVisible) return;
    if (!last) last = now;
    const wait = now - last;
    if (wait < FRAME_MS - 2) {
      raf = requestAnimationFrame(tick);
      return;
    }
    const dt = Math.min(80, wait);
    last = now;
    if (!grid && !layout(false)) {
      raf = requestAnimationFrame(tick);
      return;
    }
    if (!reduced) advance(dt);
    paint();
    if (!reduced) raf = requestAnimationFrame(tick);
  }

  function startLoop() {
    if (dead || raf || !onScreen || !tabVisible) return;
    last = 0;
    raf = requestAnimationFrame(tick);
  }

  function stopLoop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
  }

  function drawStatic() {
    if (!layout(false) && !grid) return;
    paint();
  }

  still.addEventListener('change', () => {
    reduced = still.matches || document.documentElement.classList.contains('is-reduced');
    if (grid) seedDrops(grid.columns, grid.rows);
    if (reduced) {
      stopLoop();
      drawStatic();
    } else {
      startLoop();
    }
  });

  const vis = () => {
    tabVisible = document.visibilityState !== 'hidden';
    if (tabVisible) startLoop();
    else stopLoop();
  };
  document.addEventListener('visibilitychange', vis);

  const io = new IntersectionObserver((entries) => {
    onScreen = !!entries[0]?.isIntersecting;
    if (onScreen) {
      if (!grid) layout(true);
      measureDim();
      paint();
      if (!reduced) startLoop();
    } else {
      stopLoop();
    }
  }, { root: null, threshold: 0 });
  io.observe(section);

  const ro = new ResizeObserver(() => {
    dpr = capDpr();
    if (layout(false)) {
      measureDim();
      if (reduced || !onScreen) paint();
    } else {
      measureDim();
    }
  });
  ro.observe(section);

  if (window.matchMedia) {
    const dprQuery = () => {
      const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      const onChange = () => {
        mq.removeEventListener('change', onChange);
        dpr = capDpr();
        dprQuery();
        if (layout(true)) {
          if (reduced || !onScreen) paint();
        }
      };
      mq.addEventListener('change', onChange);
    };
    dprQuery();
  }

  if (document.fonts && document.fonts.load) {
    document.fonts.load(`400 ${CONFIG.glyphPx}px "Geist Mono"`).then(() => {
      if (dead) return;
      layout(true);
      if (reduced || !onScreen) paint();
    }).catch(() => {});
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountCtaRain, { once: true });
} else {
  mountCtaRain();
}
