/* ==========================================================================
   Option 2 — site behaviour (from Option 1's ../site.js):
   1. Header: solid with a line once scrolled; the Menu toggle for small screens.
   2. Hero: the showreel drifts inside its frame as the page scrolls (parallax).
   3. Services: the hovered row slides right; its image follows the cursor.
   4. Work: each case's image tilts and drifts after the cursor (3D view).
   5. Contact: the logo's Q as an isometric wireframe, spinning continuously.
   ========================================================================== */

(() => {
  'use strict';

  /* ------------------------------------------------------------------------
     1. Header
     ------------------------------------------------------------------------ */
  const wide = window.matchMedia('(min-width: 961px)'); // matches the CSS breakpoint
  const header = document.querySelector('[data-header="hero"]');
  const toggle = header.querySelector('.site-header__toggle');
  const nav = header.querySelector('.site-nav');

  // The bottom line shows only once the page has left the top.
  const markScrolled = () => header.classList.toggle('is-scrolled', window.scrollY > 0);
  window.addEventListener('scroll', markScrolled, { passive: true });
  markScrolled();

  function setOpen(open) {
    header.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Close' : 'Menu';
  }

  toggle.addEventListener('click', () => setOpen(!header.classList.contains('is-open')));

  // Following a link, pressing Escape or widening the window all close the panel.
  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && header.classList.contains('is-open')) {
      setOpen(false);
      toggle.focus();
    }
  });
  wide.addEventListener('change', (event) => {
    if (event.matches) setOpen(false);
  });

  /* ------------------------------------------------------------------------
     2. Reel parallax. The video is taller than its frame (--reel-drift
        above and below) and slides inside it as the frame crosses the
        screen: from its top edge showing while the frame enters at the
        bottom, to its bottom edge as the frame leaves at the top. So it
        moves slower than the page. Off for reduced motion.
     ------------------------------------------------------------------------ */
  const frame = document.querySelector('.hero__reel');
  const video = frame.querySelector('video');
  const still = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Muted autoplay can be paused by the browser (a hidden tab) and isn't
  // always resumed: play again when visible.
  const keepPlaying = () => {
    if (video.paused && !document.hidden) video.play().catch(() => {});
  };
  video.addEventListener('pause', keepPlaying);
  document.addEventListener('visibilitychange', keepPlaying);

  let queued = false;
  function drift() {
    queued = false;
    const r = frame.getBoundingClientRect();
    const vh = window.innerHeight;
    // 0 as the frame enters at the bottom, 1 as it leaves at the top.
    const t = Math.min(Math.max((vh - r.top) / (vh + r.height), 0), 1);
    const room = video.offsetHeight - r.height; // the extra height, both ends
    const y = still.matches ? 0 : (t - 0.5) * room;
    video.style.transform = `translate3d(0, ${y}px, 0)`;
  }
  const queueDrift = () => {
    if (!queued) { queued = true; requestAnimationFrame(drift); }
  };
  window.addEventListener('scroll', queueDrift, { passive: true });
  window.addEventListener('resize', queueDrift);
  still.addEventListener('change', queueDrift);
  drift();

  /* ------------------------------------------------------------------------
     3. Services: hovering a row opens it (.is-active: it slides right and
        shows its arrow, the others dim) and a square of its image follows
        the cursor, eased (each frame closes 14% of the gap), after
        estatelens.pl. Mouse and wide screens only; elsewhere the CSS shows
        each row's own image.
     ------------------------------------------------------------------------ */
  const list = document.querySelector('.services__list');
  const rows = [...list.querySelectorAll('.services__item')];
  const fine = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 861px)');
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)');

  // The float: one image per row, stacked; the active one is shown.
  const float = document.createElement('div');
  float.className = 'services__float';
  float.setAttribute('aria-hidden', 'true');
  const shots = rows.map((row) => {
    const img = row.querySelector('.services__media img').cloneNode();
    img.loading = 'eager';
    float.append(img);
    return img;
  });
  list.after(float); // in the section, so the rows' names can blend over it

  // The float is as tall as three rows, line to line (every row is one height).
  function sizeFloat() {
    float.style.setProperty('--float-size', `${3 * rows[0].getBoundingClientRect().height}px`);
  }
  sizeFloat();
  new ResizeObserver(sizeFloat).observe(rows[0]);

  let activeRow = null;
  const pointer = { x: null, y: null }; // the mouse, while it's over the page
  const at = { x: 0, y: 0 };            // the float's centre
  let floatFrame = 0;

  function place() {
    float.style.left = `${at.x}px`;
    float.style.top = `${at.y}px`;
  }

  function follow() {
    at.x += (pointer.x - at.x) * 0.14;
    at.y += (pointer.y - at.y) * 0.14;
    place();
    const settled = Math.abs(pointer.x - at.x) < 0.5 && Math.abs(pointer.y - at.y) < 0.5;
    floatFrame = activeRow && !settled ? requestAnimationFrame(follow) : 0;
  }

  function setRow(row) {
    if (row === activeRow) return;
    if (activeRow) activeRow.classList.remove('is-active');
    shots.forEach((img) => img.classList.remove('is-current'));
    const wasOn = Boolean(activeRow);
    activeRow = row;
    list.classList.toggle('has-active', Boolean(row));
    float.classList.toggle('is-on', Boolean(row));
    if (!row) return;
    row.classList.add('is-active');
    shots[rows.indexOf(row)].classList.add('is-current');
    // Appearing: start at the cursor rather than gliding in from the last spot.
    if (!wasOn || calm.matches) {
      at.x = pointer.x;
      at.y = pointer.y;
      place();
    }
  }

  window.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (!activeRow) return;
    if (calm.matches) {
      at.x = pointer.x;
      at.y = pointer.y;
      place();
    } else if (!floatFrame) {
      floatFrame = requestAnimationFrame(follow);
    }
  }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => { pointer.x = pointer.y = null; });

  rows.forEach((row) => {
    row.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'mouse' && fine.matches) setRow(row);
    });
  });
  list.addEventListener('pointerleave', () => setRow(null));
  fine.addEventListener('change', () => setRow(null));
  // A scroll moves the rows under a still cursor, without pointer events.
  window.addEventListener('scroll', () => {
    if (pointer.x === null || !fine.matches) return;
    const el = document.elementFromPoint(pointer.x, pointer.y);
    setRow(el ? el.closest('.services__item') : null);
  }, { passive: true });

  /* ------------------------------------------------------------------------
     4. Work: each case's image tilts and drifts after the cursor, as a view
        into a 3D scene. The cursor's place on screen (-1…1 each axis) is
        eased (each frame closes 8% of the gap) into --tx/--ty on the case
        under it; the CSS turns those into the image's rotation and shift.
        Leaving a case eases it back to centre. Fine pointers only; still
        for reduced motion.
     ------------------------------------------------------------------------ */
  const cases = [...document.querySelectorAll('.work-case')];
  const look = window.matchMedia('(hover: hover) and (pointer: fine)');
  const states = cases.map((el) => ({ el, x: 0, y: 0, gx: 0, gy: 0 }));
  let lookFrame = 0;

  function tilt() {
    let moving = false;
    states.forEach((s) => {
      s.x += (s.gx - s.x) * 0.08;
      s.y += (s.gy - s.y) * 0.08;
      if (Math.abs(s.gx - s.x) > 0.001 || Math.abs(s.gy - s.y) > 0.001) moving = true;
      else { s.x = s.gx; s.y = s.gy; }
      s.el.style.setProperty('--tx', s.x.toFixed(4));
      s.el.style.setProperty('--ty', s.y.toFixed(4));
    });
    lookFrame = moving ? requestAnimationFrame(tilt) : 0;
  }
  const queueTilt = () => {
    if (!lookFrame) lookFrame = requestAnimationFrame(tilt);
  };

  // Only the case under the cursor looks at it; the rest return to centre.
  function aim(x, y) {
    const on = x !== null && look.matches && !still.matches;
    const el = on ? document.elementFromPoint(x, y) : null;
    const current = el ? el.closest('.work-case') : null;
    states.forEach((s) => {
      const here = s.el === current;
      s.gx = here ? (x / window.innerWidth) * 2 - 1 : 0;
      s.gy = here ? (y / window.innerHeight) * 2 - 1 : 0;
    });
    queueTilt();
  }

  window.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'mouse') aim(event.clientX, event.clientY);
  }, { passive: true });
  // A scroll carries a case under a still cursor.
  window.addEventListener('scroll', () => aim(pointer.x, pointer.y), { passive: true });
  document.documentElement.addEventListener('mouseleave', () => aim(null, null));
  look.addEventListener('change', () => aim(null, null));
  still.addEventListener('change', () => aim(null, null));

  /* ------------------------------------------------------------------------
     5. Contact: the logo's Q (two straight-edged outlines: the outside, and
        the counter with the tail cut) extruded to a slab and drawn as a
        wireframe behind the statement: front and back outlines and an edge
        at every corner, all hairlines, no fills. Parallel projection, tipped
        at the isometric angle; it starts face turned to the left (its
        horizontals fall 30° to the right, its verticals stay upright) and
        spins about its upright axis, continuously. From the parked hero Q
        (parked/hero-q.js). Still at the starting angle for reduced motion;
        only drawn while the section is on screen.
     ------------------------------------------------------------------------ */
  const qCanvas = document.querySelector('.cta__q');
  const cta = qCanvas.parentElement;
  const ctx = qCanvas.getContext('2d');

  const OUTER = [
    [32.3766, 5.33333], [32.3766, 26.6667], [29.4929, 29.556], [31.5393, 32],
    [5.32218, 32], [0, 26.6667], [0, 5.33333], [5.32218, 0], [27.0544, 0],
  ];
  const INNER = [
    [5.32218, 26.6667], [20.1258, 26.6667], [10.8219, 15.5556], [17.7696, 15.5556],
    [27.0544, 26.6437], [27.0544, 5.33333], [5.32218, 5.33333],
  ];
  const Q_CENTRE = [16.19, 16];
  const Q_DEPTH = 7;              // slab thickness, in the logo's units (it's 32 tall)
  const Q_HEIGHT = 0.82;          // drawn height, as a share of the section's
  const Q_STROKE = '#3F3F3F';     // 16 % white over the #1A1A1A page
  const Q_TIP = Math.atan(Math.SQRT1_2);   // isometric: 35.26° down
  const Q_START = Math.PI / 4;             // 45° round: face turned to the left
  const Q_TURN = 24000;                    // ms per full turn

  const cX = Math.cos(Q_TIP), sX = Math.sin(Q_TIP);
  let qSize = { w: 0, h: 0, dpr: 1 };

  function sizeQ() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = cta.clientWidth;
    const h = cta.clientHeight;
    qCanvas.width = Math.round(w * dpr);
    qCanvas.height = Math.round(h * dpr);
    qSize = { w, h, dpr };
  }
  new ResizeObserver(sizeQ).observe(cta);
  sizeQ();

  // Turn about the upright axis, then tip; parallel projection (screen y
  // points down, the far side of the slab is up).
  function turnQ([px, py], pz, cY, sY) {
    const x0 = px - Q_CENTRE[0];
    const y0 = py - Q_CENTRE[1];
    const x1 = x0 * cY + pz * sY;
    const z1 = -x0 * sY + pz * cY;
    return [x1, y0 * cX - z1 * sX];
  }

  // Its largest extent over a whole turn, so it spins without rescaling or
  // touching the edges.
  const qSpan = (() => {
    const span = { w: 0, h: 0 };
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 90) {
      const pts = OUTER.flatMap((pt) => [-1, 1].map((side) => turnQ(pt, side * Q_DEPTH / 2, Math.cos(a), Math.sin(a))));
      span.w = Math.max(span.w, 2 * Math.max(...pts.map((p) => Math.abs(p[0]))));
      span.h = Math.max(span.h, 2 * Math.max(...pts.map((p) => Math.abs(p[1]))));
    }
    return span;
  })();

  function drawQ(angle) {
    const { w, h, dpr } = qSize;
    const scale = Math.min((h * Q_HEIGHT) / qSpan.h, (w - 32) / qSpan.w);   // and never wider than the screen
    const cY = Math.cos(angle), sY = Math.sin(angle);
    const project = (pt, pz) => {
      const [x, y] = turnQ(pt, pz, cY, sY);
      return [w / 2 + x * scale, h / 2 + y * scale];
    };

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = Q_STROKE;
    ctx.lineWidth = 1;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (const outline of [OUTER, INNER]) {
      const front = outline.map((pt) => project(pt, -Q_DEPTH / 2));
      const back = outline.map((pt) => project(pt, Q_DEPTH / 2));
      for (const face of [front, back]) {
        face.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.closePath();
      }
      front.forEach(([x, y], i) => {
        ctx.moveTo(x, y);
        ctx.lineTo(back[i][0], back[i][1]);
      });
    }
    ctx.stroke();
  }

  let qVisible = false;
  new IntersectionObserver(([entry]) => { qVisible = entry.isIntersecting; }).observe(cta);

  // The spin only advances while it's drawn, so it picks up where it left off.
  let qAngle = Q_START;
  let qLast = performance.now();
  function tickQ(now) {
    const dt = Math.min(now - qLast, 100);
    qLast = now;
    if (qVisible) {
      if (!still.matches) qAngle += (dt / Q_TURN) * Math.PI * 2;
      drawQ(still.matches ? Q_START : qAngle);
    }
    requestAnimationFrame(tickQ);
  }
  requestAnimationFrame(tickQ);
})();
