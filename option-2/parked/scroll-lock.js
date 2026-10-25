/* Parked 2026-10-03: the hero ⇄ reel scroll lock (was site.js section 3b).
   User wants free, normal scrolling. To restore, paste back into site.js
   after section 3 (needs lerp, easeInOut, still, frame from section 3). */
  /* ------------------------------------------------------------------------
     3b. Hero ⇄ reel is one move. Between the top of the page and the reel
         frame reaching the top of the screen, the page doesn't follow the
         wheel, touch or keys: the first nudge down plays the whole scroll to
         the frame, the first nudge up from the frame (or anywhere in that
         stretch) plays it back to the top. Input during the move, and the
         trackpad's momentum after it, is swallowed so the move can't be
         stopped or overshot. Anything else that leaves the page part-way
         (the scrollbar, a reload) is finished once the scroll comes to rest.
     ------------------------------------------------------------------------ */
  const MOVE_MS = 1100;  // the whole stretch; shorter in proportion when part-done
  const QUIET_MS = 180;  // wheel silence that ends a gesture's momentum
  const easeMove = easeInOut; // the only easing on the move: the reel's blend follows the scroll linearly

  let moving = false;
  let gestureLocked = false; // swallow the rest of the gesture that started (or followed) a move
  let quietTimer;
  let restTimer;
  let lastScrollY = window.scrollY;
  let lastDir = 1;

  const travelY = () => frame.offsetTop;
  const inStretch = (y) => y > 1 && y < travelY() - 1;

  function moveTo(to) {
    const from = window.scrollY;
    if (Math.abs(to - from) < 1) return;
    if (still.matches) {
      window.scrollTo(0, to);
      return;
    }
    moving = true;
    const ms = Math.max(MOVE_MS * Math.abs(to - from) / Math.max(travelY(), 1), 350);
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min((now - t0) / ms, 1);
      window.scrollTo(0, lerp(from, to, easeMove(t)));
      if (t < 1) requestAnimationFrame(step);
      else moving = false;
    };
    requestAnimationFrame(step);
  }

  // Which way a nudge at scroll position y should play the move, or 0 for
  // ordinary scrolling.
  function moveFor(y, dir) {
    const end = travelY();
    if (dir > 0 && y < end - 1) return end;  // below the hero's top → to the reel
    if (dir < 0 && y > 1 && y <= end + 1) return 0; // within the stretch, up → to the top
    return null;
  }

  function nudge(dir) {
    if (moving || gestureLocked) return true;
    const to = moveFor(window.scrollY, dir);
    if (to === null) return false;
    moveTo(to);
    return true;
  }

  function holdGesture() {
    gestureLocked = true;
    clearTimeout(quietTimer);
    quietTimer = setTimeout(() => { gestureLocked = false; }, QUIET_MS);
  }

  window.addEventListener('wheel', (event) => {
    if (event.ctrlKey || Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
    if (nudge(Math.sign(event.deltaY))) {
      event.preventDefault();
      holdGesture();
    }
  }, { passive: false });

  let touchY = null;
  let swipeUsed = false; // this swipe started a move: the rest of it is swallowed
  window.addEventListener('touchstart', (event) => {
    touchY = event.touches[0].clientY;
    swipeUsed = false;
  }, { passive: true });
  window.addEventListener('touchmove', (event) => {
    if (moving || swipeUsed) { event.preventDefault(); return; }
    if (touchY === null) return;
    const dy = touchY - event.touches[0].clientY;
    if (Math.abs(dy) < 8) return;
    if (nudge(Math.sign(dy))) {
      event.preventDefault();
      swipeUsed = true; // one move per swipe
    }
  }, { passive: false });
  window.addEventListener('touchend', () => { touchY = null; swipeUsed = false; }, { passive: true });

  const KEYS = { ArrowDown: 1, PageDown: 1, ' ': 1, ArrowUp: -1, PageUp: -1 };
  window.addEventListener('keydown', (event) => {
    const dir = KEYS[event.key];
    if (!dir || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target.closest('input, textarea, select, button, [contenteditable]')) return;
    if (nudge(event.key === ' ' && event.shiftKey ? -1 : dir)) event.preventDefault();
  });

  // Scrollbar drags, restored positions and the like: finish once at rest.
  function settle() {
    if (moving || !inStretch(window.scrollY)) return;
    moveTo(lastDir > 0 ? travelY() : 0);
  }
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (y !== lastScrollY) lastDir = Math.sign(y - lastScrollY);
    lastScrollY = y;
    clearTimeout(restTimer);
    if (!moving) restTimer = setTimeout(settle, 150);
  }, { passive: true });
  window.addEventListener('load', () => setTimeout(settle, 150));

