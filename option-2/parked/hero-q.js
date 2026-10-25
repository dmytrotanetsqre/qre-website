/* ==========================================================================
   Parked 2026-10-02: the hero Q, taken out of Option 2 until there's a place
   for it. To bring it back:
   - HTML, first child of .hero:
       <canvas class="hero__q" aria-hidden="true"></canvas>
   - CSS:
       .hero__q { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
   - JS: paste the block below into site.js's IIFE, after section 3 (it uses
     `fine`, `still` from there).

   The logo's letter (two straight-edged outlines: the outside, and the
   counter with the tail cut) extruded to a slab and drawn as a wireframe:
   the front and back outlines and an edge at every corner, all hairlines,
   no fills. It sits big off the bottom-right of the hero, so only part of it
   shows, and turns a few degrees towards the cursor.
   ========================================================================== */

  const qCanvas = document.querySelector('.hero__q');
  const hero = document.querySelector('.hero');
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
  const Q_DEPTH = 7;           // slab thickness, in the logo's units (it's 32 tall)
  const Q_CAMERA = 90;         // camera distance, same units: lower is more perspective
  const Q_STROKE = '#3F3F3F';  // 16 % white over the #1A1A1A page
  const Q_BASE = { x: 0.16, y: -0.36 }; // resting turn (radians): tipped back, turned left
  const Q_RANGE = { x: 0.1, y: 0.16 };  // how far the cursor can turn it
  const Q_FOLLOW = 0.06;

  const qAim = { x: Q_BASE.x, y: Q_BASE.y };
  const qTurn = { x: Q_BASE.x, y: Q_BASE.y };
  let qSize = { w: 0, h: 0, dpr: 1 };
  let qDirty = true;

  function sizeQ() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = hero.clientWidth;
    const h = hero.clientHeight;
    qCanvas.width = Math.round(w * dpr);
    qCanvas.height = Math.round(h * dpr);
    qSize = { w, h, dpr };
    qDirty = true;
  }
  new ResizeObserver(sizeQ).observe(hero);
  sizeQ();

  window.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' || !fine.matches) return;
    const nx = event.clientX / window.innerWidth - 0.5;  // -0.5 … 0.5
    const ny = event.clientY / window.innerHeight - 0.5;
    qAim.x = Q_BASE.x - ny * 2 * Q_RANGE.x;
    qAim.y = Q_BASE.y + nx * 2 * Q_RANGE.y;
  }, { passive: true });

  function drawQ() {
    const { w, h, dpr } = qSize;
    const vh = window.innerHeight;
    const scale = (vh * 0.95) / 32;  // the Q is 0.95 of a screen tall
    const ox = w - vh * 0.26;        // its centre: near the right edge…
    const oy = h - vh * 0.3;         // …and low, so it runs off both

    const cX = Math.cos(qTurn.x), sX = Math.sin(qTurn.x);
    const cY = Math.cos(qTurn.y), sY = Math.sin(qTurn.y);
    const project = ([px, py], pz) => {
      const x0 = px - Q_CENTRE[0];
      const y0 = py - Q_CENTRE[1];
      // Turn about Y, then X.
      const x1 = x0 * cY + pz * sY;
      const z1 = -x0 * sY + pz * cY;
      const y2 = y0 * cX - z1 * sX;
      const z2 = y0 * sX + z1 * cX;
      const k = Q_CAMERA / (Q_CAMERA + z2);
      return [ox + x1 * k * scale, oy + y2 * k * scale];
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

  // Only while the hero is on screen; and only redraw when the turn moves.
  let qVisible = true;
  new IntersectionObserver(([entry]) => { qVisible = entry.isIntersecting; }).observe(hero);

  let qLast = performance.now();
  function tickQ(now) {
    const dt = Math.min((now - qLast) / (1000 / 60), 4);
    qLast = now;
    if (qVisible) {
      const k = still.matches ? 1 : 1 - (1 - Q_FOLLOW) ** dt;
      const dx = qAim.x - qTurn.x;
      const dy = qAim.y - qTurn.y;
      if (Math.abs(dx) > 1e-5 || Math.abs(dy) > 1e-5) {
        qTurn.x += dx * k;
        qTurn.y += dy * k;
        qDirty = true;
      }
      if (qDirty) {
        drawQ();
        qDirty = false;
      }
    }
    requestAnimationFrame(tickQ);
  }
  requestAnimationFrame(tickQ);
