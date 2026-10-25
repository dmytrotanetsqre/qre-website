/* ==========================================================================
   Site behaviour (the ASCII hero is script.js):
   1. Menu toggles for small screens, one per header.
   2. Header 2 slides in once header 1 has scrolled out of view.
   3. Page tone: the page turns dark or light with the section at the
      middle of the screen.
   4. Services stack: each card pins and the next slides over it.
   5. Case images: the hover lens.
   6. Copy buttons.
   7. Buttons: the letter roll on hover.
   8. Consultation drawer.
   ========================================================================== */

(() => {
  'use strict';

  /* ------------------------------------------------------------------------
     1. Menu toggles
     ------------------------------------------------------------------------ */
  const wide = window.matchMedia('(min-width: 961px)'); // matches the CSS breakpoint

  function setupMenu(header) {
    const toggle = header.querySelector('.site-header__toggle');
    const nav = header.querySelector('.site-nav');

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

    return setOpen;
  }

  const heroHeader = document.querySelector('[data-header="hero"]');
  const stickyHeader = document.querySelector('[data-header="sticky"]');
  const setHeroMenuOpen = setupMenu(heroHeader);
  const setStickyMenuOpen = setupMenu(stickyHeader);

  /* ------------------------------------------------------------------------
     2. Header 2: visible once the hero has passed the tone line (3), and
        leaves when the hero takes the line back. style.css holds its slide
        for --tone-delay, to start with the background's crossfade.
     ------------------------------------------------------------------------ */
  const TONE_LINE = 0.5; // how far down the screen (0 top → 1 bottom) a section takes over
  // Shrinks the viewport to a line TONE_LINE of the way down it.
  const toneLineMargin = `-${TONE_LINE * 100}% 0px -${(1 - TONE_LINE) * 100}% 0px`;

  new IntersectionObserver(([entry]) => {
    const show = !entry.isIntersecting && entry.boundingClientRect.top < 0; // the hero is above the line
    stickyHeader.classList.toggle('is-visible', show);
    stickyHeader.inert = !show; // out of the tab order and hidden from screen readers while tucked away
    // Swapping headers closes whichever menu belonged to the one going away.
    if (show) setHeroMenuOpen(false);
    else setStickyMenuOpen(false);
  }, { rootMargin: toneLineMargin }).observe(document.querySelector('.hero'));

  /* ------------------------------------------------------------------------
     3. Page tone: each section declares data-tone (dark or light), and the
        one crossing the tone line sets it on <html>. style.css crossfades
        every colour to match, so dark and light sections never meet at an
        edge on screen.
     ------------------------------------------------------------------------ */
  const root = document.documentElement;
  let toneSet = false;

  const toneObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) root.dataset.tone = entry.target.dataset.tone;
    }
    if (!toneSet) {
      // Apply the first tone as is (reading a style commits it), then let later
      // changes animate — a page opened part-way down doesn't fade into place.
      toneSet = true;
      getComputedStyle(root).getPropertyValue('--surface');
      root.classList.add('tone-ready');
    }
  }, { rootMargin: toneLineMargin });
  document.querySelectorAll('body [data-tone]').forEach((section) => toneObserver.observe(section));

  /* ------------------------------------------------------------------------
     4. Services stack
     ------------------------------------------------------------------------ */
  const cards = Array.from(document.querySelectorAll('.service'));

  /**
   * Where each card pins. Normally 1 px under header 2's bottom edge, so the
   * header's rule covers the card's top rule instead of doubling it; a card
   * taller than the space below pins lower (negative top), so it scrolls fully
   * into view — button and all — before the next card covers it.
   */
  function measure() {
    const pinTop = stickyHeader.offsetHeight - 1;
    for (const card of cards) {
      const top = Math.min(pinTop, window.innerHeight - card.offsetHeight);
      card.style.setProperty('--stack-top', `${top}px`);
    }
  }

  new ResizeObserver(measure).observe(document.documentElement);

  /* ------------------------------------------------------------------------
     5. Case images: hovering one slides a glass lens under the pointer. A
        WebGL canvas over the image redraws it: the lens magnifies what's
        beneath it, its rim bends the picture and splits the colours like a
        prism, and the whole image ripples faintly. The canvas is made on the
        first hover and only draws while the lens is swelling, moving or
        settling; at rest it matches the image and hides.
     ------------------------------------------------------------------------ */
  const LENS = {
    radius: 0.3,       // share of the image's height
    strength: 0.4,     // how far the centre magnifies (0.4 → 1.67x)
    dispersion: 0.008, // colour split at the rim, in image heights
    ripple: 0.0035,    // the faint waves across the whole image, in image heights
    zoom: 0.04,        // the image scales up this much on hover, so bent edges never show
    follow: 9,         // how quickly the lens catches up with the pointer (per second)
    fade: 5,           // how quickly it swells in and settles out (per second)
  };

  const lensMotion = window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');

  const LENS_VERTEX = `
    attribute vec2 aPosition;
    varying vec2 vUv;
    void main() {
      vUv = vec2(aPosition.x * 0.5 + 0.5, 0.5 - aPosition.y * 0.5); // y down, like the image
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }`;

  const LENS_FRAGMENT = `
    precision mediump float;
    uniform sampler2D uImage;
    uniform vec2 uCanvas;
    uniform vec2 uImageSize;
    uniform vec2 uPointer;
    uniform float uHover;
    uniform float uTime;
    varying vec2 vUv;

    // object-fit: cover, centred
    vec2 cover(vec2 uv) {
      float canvasRatio = uCanvas.x / uCanvas.y;
      float imageRatio = uImageSize.x / uImageSize.y;
      vec2 scale = canvasRatio > imageRatio
        ? vec2(1.0, imageRatio / canvasRatio)
        : vec2(canvasRatio / imageRatio, 1.0);
      return (uv - 0.5) * scale + 0.5;
    }

    void main() {
      float ratio = uCanvas.x / uCanvas.y;
      vec2 toUv = vec2(1.0 / ratio, 1.0);
      vec2 uv = (vUv - 0.5) / (1.0 + ${LENS.zoom.toFixed(4)} * uHover) + 0.5;

      // The lens, in image heights: 1 at its centre, easing to 0 at the rim.
      vec2 p = (vUv - uPointer) * vec2(ratio, 1.0);
      float radius = ${LENS.radius.toFixed(4)} * uHover * (1.0 + 0.03 * sin(uTime * 2.1));
      float bump = 1.0 - smoothstep(0.0, 1.0, length(p) / max(radius, 0.0001));
      vec2 bend = -p * bump * bump * ${LENS.strength.toFixed(4)};

      // Prism at the rim, where the lens bends hardest.
      float rim = bump * (1.0 - bump) * 4.0;
      vec2 split = p / (length(p) + 0.0001) * rim * ${LENS.dispersion.toFixed(4)} * uHover;

      vec2 wave = vec2(
        sin(vUv.y * 9.0 + uTime * 1.4 + sin(vUv.x * 6.0 - uTime)),
        cos(vUv.x * 8.0 - uTime * 1.1 + cos(vUv.y * 5.0 + uTime * 0.7))
      ) * ${LENS.ripple.toFixed(4)} * uHover;

      vec2 base = uv + (bend + wave) * toUv;
      gl_FragColor = vec4(
        texture2D(uImage, cover(base + split * toUv)).r,
        texture2D(uImage, cover(base)).g,
        texture2D(uImage, cover(base - split * toUv)).b,
        1.0
      );
    }`;

  /** The lens for one case image, or null where WebGL isn't available (the image just stays still). */
  function createLens(visual) {
    const img = visual.querySelector('img');
    const canvas = document.createElement('canvas');
    canvas.className = 'case__lens';
    canvas.setAttribute('aria-hidden', 'true');
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false });
    if (!gl) return null;

    function compile(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    }
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, LENS_VERTEX));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, LENS_FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
    gl.useProgram(program);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const uniform = (name) => gl.getUniformLocation(program, name);
    const u = {
      canvas: uniform('uCanvas'),
      imageSize: uniform('uImageSize'),
      pointer: uniform('uPointer'),
      hover: uniform('uHover'),
      time: uniform('uTime'),
    };

    // Clamped and unmipmapped, so any image size works in WebGL 1.
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    let ready = false;
    function upload() {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      gl.uniform2f(u.imageSize, img.naturalWidth, img.naturalHeight);
      ready = true;
    }
    if (img.complete && img.naturalWidth) upload();
    else img.addEventListener('load', upload, { once: true });

    visual.append(canvas);

    let hover = 0;
    let hoverTarget = 0;
    const pointer = { x: 0.5, y: 0.5 };
    const aim = { x: 0.5, y: 0.5 };
    let frame = 0;
    let last = 0;

    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.round(visual.clientWidth * ratio);
      const height = Math.round(visual.clientHeight * ratio);
      if (canvas.width === width && canvas.height === height) return;
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      gl.uniform2f(u.canvas, width, height);
    }

    function aimAt(event) {
      const box = visual.getBoundingClientRect();
      aim.x = (event.clientX - box.left) / box.width;
      aim.y = (event.clientY - box.top) / box.height;
    }

    function draw(now) {
      const dt = Math.min((now - (last || now)) / 1000, 0.05);
      last = now;
      const follow = 1 - Math.exp(-LENS.follow * dt);
      pointer.x += (aim.x - pointer.x) * follow;
      pointer.y += (aim.y - pointer.y) * follow;
      hover += (hoverTarget - hover) * (1 - Math.exp(-LENS.fade * dt));

      if (hoverTarget === 0 && hover < 0.002) {
        // Settled: the image underneath looks the same, so let it show.
        hover = 0;
        canvas.classList.remove('is-live');
        frame = 0;
        last = 0;
        return;
      }

      if (ready) {
        gl.uniform2f(u.pointer, pointer.x, pointer.y);
        gl.uniform1f(u.hover, hover);
        gl.uniform1f(u.time, now / 1000);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        canvas.classList.add('is-live');
      }
      frame = requestAnimationFrame(draw);
    }

    return {
      enter(event) {
        resize();
        aimAt(event);
        // A fresh hover swells from where the pointer came in.
        if (hover === 0) { pointer.x = aim.x; pointer.y = aim.y; }
        hoverTarget = 1;
        if (!frame) frame = requestAnimationFrame(draw);
      },
      move: aimAt,
      leave() { hoverTarget = 0; },
    };
  }

  document.querySelectorAll('.case__visual').forEach((visual) => {
    let lens; // undefined until the first hover; null if WebGL failed
    visual.addEventListener('pointerenter', (event) => {
      if (!lensMotion.matches) return;
      if (lens === undefined) lens = createLens(visual);
      lens?.enter(event);
    });
    visual.addEventListener('pointermove', (event) => lens?.move(event));
    visual.addEventListener('pointerleave', () => lens?.leave());
  });

  /* ------------------------------------------------------------------------
     6. Copy buttons: data-copy goes to the clipboard, and the label says so
        for a moment.
     ------------------------------------------------------------------------ */

  /** The Clipboard API, or where it's refused (embedded browsers, plain http), a selection copy. */
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const focused = document.activeElement;
      const field = document.createElement('textarea');
      field.value = text;
      field.setAttribute('readonly', '');
      field.style.cssText = 'position: fixed; top: 0; opacity: 0;';
      document.body.append(field);
      field.select();
      const copied = document.execCommand('copy');
      field.remove();
      focused?.focus();
      return copied;
    }
  }

  document.querySelectorAll('[data-copy]').forEach((button) => {
    const label = button.textContent;
    let restore = 0;
    button.addEventListener('click', async () => {
      if (!(await copyText(button.dataset.copy))) return;
      button.textContent = 'Copied';
      clearTimeout(restore);
      restore = setTimeout(() => { button.textContent = label; }, 2000);
    });
  });

  /* ------------------------------------------------------------------------
     7. Buttons and header nav links: on hover the label rolls, one letter after another, into an
        identical copy of itself (the CSS does the motion). Mouse only, and
        not for reduced motion; elsewhere the label stays plain text.
     ------------------------------------------------------------------------ */
  const rollMotion = window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');

  if (rollMotion.matches) {
    // The roll starts on the first move of the pointer over the label, not on entering it: a
    // button a scroll carries under a resting pointer is entered too (the hero's cross mid-screen
    // just as the tone turns, and rolled by themselves). A scroll never moves the pointer, and
    // any move event it prompts repeats the last position, so it can't start a roll.
    // (Positions are compared between pointer events only: they're fractional on high-density
    // screens, while mouse events round them.)
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
      // Both: some browsers send only the mouse version when a scroll moves the label away.
      button.addEventListener('pointerleave', () => { rolled = false; });
      button.addEventListener('mouseleave', () => { rolled = false; });
      end.addEventListener('animationend', () => button.classList.remove('is-rolling'));
    });
  }

  /* ------------------------------------------------------------------------
     8. Consultation drawer: [data-drawer-open] opens the <dialog> it names;
        the close button, Escape and a click outside the panel close it. The
        CSS animates .is-open, so closing waits for the panel to leave before
        the dialog is removed. The form has no backend yet: a valid submit
        shows the thank-you state.
     ------------------------------------------------------------------------ */
  document.querySelectorAll('dialog.drawer').forEach((drawer) => {
    const panel = drawer.querySelector('.drawer__panel');
    const form = drawer.querySelector('.drawer__form');
    const done = drawer.querySelector('.drawer__done');
    const email = form.elements.email;
    const consent = form.elements.consent;
    let closing = 0;

    function open() {
      clearTimeout(closing);
      form.hidden = false;
      done.hidden = true;
      document.documentElement.classList.add('has-drawer');
      if (!drawer.open) drawer.showModal();
      requestAnimationFrame(() => requestAnimationFrame(() => drawer.classList.add('is-open')));
    }

    function close() {
      if (!drawer.open) return;
      drawer.classList.remove('is-open');
      const finish = () => {
        clearTimeout(closing);
        panel.removeEventListener('transitionend', onEnd);
        drawer.close();
        document.documentElement.classList.remove('has-drawer');
      };
      const onEnd = (event) => { if (event.target === panel && event.propertyName === 'transform') finish(); };
      panel.addEventListener('transitionend', onEnd);
      closing = setTimeout(finish, 600); // in case the transition never runs
    }

    document.querySelectorAll(`[data-drawer-open="${drawer.id}"]`).forEach((trigger) => {
      trigger.addEventListener('click', open);
    });
    drawer.querySelectorAll('[data-drawer-close]').forEach((button) => button.addEventListener('click', close));
    drawer.addEventListener('cancel', (event) => { event.preventDefault(); close(); });
    drawer.addEventListener('click', (event) => { if (event.target === drawer) close(); });

    function setEmailError(message) {
      const field = email.closest('.field');
      field.querySelector('.field__error')?.remove();
      email.removeAttribute('aria-invalid');
      email.removeAttribute('aria-describedby');
      if (!message) return;
      email.setAttribute('aria-invalid', 'true');
      const error = document.createElement('p');
      error.className = 'field__error';
      error.id = 'consult-email-error';
      error.textContent = message;
      email.setAttribute('aria-describedby', error.id);
      field.append(error);
    }

    email.addEventListener('input', () => { if (email.hasAttribute('aria-invalid') && email.validity.valid) setEmailError(''); });
    consent.addEventListener('change', () => consent.closest('.consent').classList.remove('is-invalid'));

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      setEmailError(email.validity.valid ? '' : 'Enter an e-mail we can reply to.');
      const label = consent.closest('.consent');
      label.classList.remove('is-invalid');
      if (!consent.checked) {
        void label.offsetWidth; // replay the nudge
        label.classList.add('is-invalid');
      }
      if (!email.validity.valid) return email.focus();
      if (!consent.checked) return consent.focus();

      form.reset();
      form.hidden = true;
      done.hidden = false;
      done.querySelector('button').focus();
    });
  });
})();
