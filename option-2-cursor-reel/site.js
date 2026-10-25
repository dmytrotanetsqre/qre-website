/* ==========================================================================
   Option 2 — site behaviour (from Option 1's ../site.js):
   1. Header: the bottom line once scrolled; the Menu toggle for small screens.
   2. Buttons and header nav links: the letter roll on hover.
   3. Showreel: a small card following the cursor over the hero, growing
      into the full-screen frame below it as the page scrolls.
   4. Services: the hovered row shows its image and description.
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
     2. Letter roll: on hover the label rolls, one letter after another, into
        an identical copy of itself (the CSS does the motion). Mouse only, and
        not for reduced motion. It starts on the first real pointer move over
        the label, so a scroll carrying a label under a resting pointer
        doesn't trigger it.
     ------------------------------------------------------------------------ */
  const rollMotion = window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
  if (rollMotion.matches) setupRoll();

  function setupRoll() {
    let lastX = null, lastY = null; // the pointer's position at its previous move
    window.addEventListener('pointermove', (event) => {
      lastX = event.clientX; // after the labels' own listeners, which compare with the previous move
      lastY = event.clientY;
    }, { passive: true });

    document.querySelectorAll('.button, .site-nav__link').forEach((button) => {
      const label = button.textContent.trim();
      let i = 0;
      const words = label.split(' ').map((word) => {
        const chars = [...word].map((ch) => `<span class="button__char" data-letter="${ch}" style="--i: ${i++}">${ch}</span>`);
        return `<span class="button__word">${chars.join('')}</span>`;
      });
      button.setAttribute('aria-label', label);
      button.innerHTML = `<span aria-hidden="true">${words.join(' ')}</span>`;

      const letters = button.querySelectorAll('.button__char');
      const end = letters[letters.length - 1];
      let rolled = false; // once per visit
      button.addEventListener('pointermove', (event) => {
        if (rolled || (event.clientX === lastX && event.clientY === lastY)) return;
        rolled = true;
        button.classList.remove('is-rolling');
        void button.offsetWidth; // restart the animation mid-roll
        button.classList.add('is-rolling');
      });
      button.addEventListener('pointerleave', () => { rolled = false; });
      button.addEventListener('mouseleave', () => { rolled = false; });
      end.addEventListener('animationend', () => button.classList.remove('is-rolling'));
    });
  }

  /* ------------------------------------------------------------------------
     3. Showreel. One fixed video, placed every frame between two boxes:
        - small: a square-cornered 16:9 card centred on the (smoothed) cursor, kept inside
          the screen; before the pointer moves, and on touch screens, it rests
          at REST (fractions of the screen). The smoothing is two chained
          eases, so the card gathers speed and settles instead of lurching;
        - full: the .showreel frame's box, wherever the scroll has put it.
        The blend follows the scroll from the top of the page to where the
        frame reaches the top of the screen, so past that point the video is
        simply the frame and scrolls away with it. Scrolling is free: the
        blend tracks wherever the page is.
     ------------------------------------------------------------------------ */
  const reel = document.querySelector('.reel');
  const frame = document.querySelector('.showreel');

  const SMALL_WIDTH = () => Math.min(Math.max(window.innerWidth * 0.372, 338), 575); // px
  const REST = { x: 0.62, y: 0.36 }; // where the card waits without a pointer
  // Shares of the gap closed per frame (60 fps): a lead point chases the
  // cursor, and the card chases the lead point.
  const LEAD_FOLLOW = 0.05;
  const CARD_FOLLOW = 0.09;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  const still = window.matchMedia('(prefers-reduced-motion: reduce)');

  const target = { x: null, y: null }; // the cursor, or null for REST
  const lead = { x: null, y: null };   // eased towards target
  const card = { x: null, y: null };   // the card's centre, eased towards lead
  let pointerIn = false;               // the cursor is over the page

  window.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' || !fine.matches) return;
    target.x = event.clientX;
    target.y = event.clientY;
    pointerIn = true;
  }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => { pointerIn = false; });


  // Muted autoplay can be paused by the browser (a hidden tab, a tiny or
  // off-screen element) and isn't always resumed: play again when visible.
  const video = reel.querySelector('video');
  const keepPlaying = () => {
    if (video.paused && !document.hidden) video.play().catch(() => {});
  };
  video.addEventListener('pause', keepPlaying);
  document.addEventListener('visibilitychange', keepPlaying);

  const lerp = (a, b, t) => a + (b - a) * t;

  let last = performance.now();
  function draw(now) {
    const dt = Math.min((now - last) / (1000 / 60), 4); // frames elapsed, at 60 fps
    last = now;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Small: the card at the cursor.
    const w = SMALL_WIDTH();
    const h = w * 9 / 16;
    // Keep the aim inside the screen before easing, so the card eases into
    // the edges rather than stopping dead against them.
    const margin = 16;
    const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));
    const tx = clamp(target.x ?? vw * REST.x, margin + w / 2, vw - margin - w / 2);
    const ty = clamp(target.y ?? vh * REST.y, margin + h / 2, vh - margin - h / 2);
    if (card.x === null || still.matches) {
      lead.x = card.x = tx;
      lead.y = card.y = ty;
    } else {
      const kl = 1 - (1 - LEAD_FOLLOW) ** dt;
      const kc = 1 - (1 - CARD_FOLLOW) ** dt;
      lead.x = lerp(lead.x, tx, kl);
      lead.y = lerp(lead.y, ty, kl);
      card.x = lerp(card.x, lead.x, kc);
      card.y = lerp(card.y, lead.y, kc);
    }
    const sx = card.x - w / 2;
    const sy = card.y - h / 2;

    // Full: the frame, where it is now.
    const f = frame.getBoundingClientRect();

    // How far the frame has come: 0 at the top of the page, 1 once it reaches
    // the top. Linear in the scroll, so the reel grows in step with the page.
    const travel = Math.max(frame.offsetTop, 1);
    const p = Math.min(Math.max(window.scrollY / travel, 0), 1);

    const x = lerp(sx, f.left, p);
    const y = lerp(sy, f.top, p);
    const rw = lerp(w, f.width, p);
    const rh = lerp(h, f.height, p);
    reel.style.width = `${rw}px`;
    reel.style.height = `${rh}px`;
    reel.style.transform = `translate3d(${x}px, ${y}px, 0)`;

    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  /* ------------------------------------------------------------------------
     4. Services: hovering a row opens it (.is-active: the CSS shows its
        image and description, each in its own column). Mouse only; touch
        screens show every description and no image.
     ------------------------------------------------------------------------ */
  const rows = [...document.querySelectorAll('.services__item')];
  let activeRow = null;

  function setRow(row) {
    if (row === activeRow) return;
    if (activeRow) activeRow.classList.remove('is-active');
    activeRow = row;
    if (row) row.classList.add('is-active');
  }

  if (fine.matches) {
    rows.forEach((row) => {
      row.addEventListener('pointerenter', (event) => {
        if (event.pointerType === 'mouse') setRow(row);
      });
    });
    document.querySelector('.services__list').addEventListener('pointerleave', () => setRow(null));
    // A scroll moves the rows under a still cursor, without pointer events.
    window.addEventListener('scroll', () => {
      if (!pointerIn || target.x === null) return;
      const el = document.elementFromPoint(target.x, target.y);
      setRow(el ? el.closest('.services__item') : null);
    }, { passive: true });
  }
})();
