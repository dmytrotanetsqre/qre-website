/* ==========================================================================
   Option 3 — logo-mask hero, plus dark Option 1 behaviour below proof
   (services videos, work tilt, consultation drawer).
   CONFIG.mask owns the hero intro.

   Reload to pick up a change.

   On load the film plays inside the QRE logo. A timed preloader zooms about
   the R's crossbar until the film is full bleed, then the copy and header
   appear and the page scrolls as a normal page.
   ========================================================================== */

const CONFIG = {
  mask: {
    // qre-logo.svg. The element is always this ratio, so the letters never stretch.
    viewBox: { w: 106, h: 32 },

    // Centre of the R's crossbar. That bar is solid from x 37.6987–64.7531
    // and y 15.5556–20.8889 (viewBox units). Scaling about this point grows
    // the bar until it covers the stage; the letters spread to every side.
    zoom: { x: 51.2259, y: 18.2222 },
    stroke: { x0: 37.6987, y0: 15.5556, x1: 64.7531, y1: 20.8889 },

    width: 0.65,          // share of the stage width at rest, desktop
    widthMobile: 0.85,    // ≤768
    mobileQuery: '(max-width: 768px)',

    enter: 800,           // ms the logo fades and scales in on load
    enterFrom: 0.96,      // scale at the first frame, relative to the resting logo
    hold: 600,            // ms the resting logo sits before the zoom
    zoomMs: 1600,         // ms the zoom takes, ease-in-out (heavy in, soft out)
    copy: 800,            // ms the copy and header fade in after the zoom
    timeout: 4000,        // ms to wait for the first film frame before starting anyway

    breath: 0.01,         // ±1% of the mask scale during the intro
    breathPeriod: 6800,   // ms per breath

    videoFrom: 1.15,      // film scale at the start of the zoom
    videoTo: 1,           // film scale once the bar covers the stage

    copyShift: 16,        // px the copy rises as it appears
  },
};

/** Scroll-scrub work case videos (Prompt 2). Filled on load; same order as the scrub cases in the markup. */
const scrubCases = [];

(() => {
  'use strict';

  /* ------------------------------------------------------------------------
     1. Menu — one header. The toggle is the nav at ≤960.
     ------------------------------------------------------------------------ */
  const wide = window.matchMedia('(min-width: 961px)');
  const header = document.querySelector('.site-header');

  function setupMenu(bar) {
    const toggle = bar.querySelector('.site-header__toggle');
    const nav = bar.querySelector('.site-nav');

    function setOpen(open) {
      bar.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? 'Close' : 'Menu';
    }

    toggle.addEventListener('click', () => setOpen(!bar.classList.contains('is-open')));

    nav.addEventListener('click', (event) => {
      if (event.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && bar.classList.contains('is-open')) {
        setOpen(false);
        toggle.focus();
      }
    });
    wide.addEventListener('change', (event) => {
      if (event.matches) setOpen(false);
    });
  }

  setupMenu(header);

  const still = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = { x: null, y: null }; // last mouse position while over the page
  let heroCoverAmount = 0;
  const workInView = new WeakMap();

  /* ------------------------------------------------------------------------
     2. Solid bar once the hero's bottom passes under the header.
        The page-tone observer below is separate and stays on the midline.
     ------------------------------------------------------------------------ */
  const TONE_LINE = 0.5;
  const toneLineMargin = `-${TONE_LINE * 100}% 0px -${(1 - TONE_LINE) * 100}% 0px`;
  const headerLine = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 64;
  const headerSentinel = document.querySelector('.site-header__sentinel');

  if (headerSentinel) {
    new IntersectionObserver(([entry]) => {
      header.classList.toggle('is-solid', entry.boundingClientRect.bottom < headerLine);
    }, { rootMargin: `-${headerLine}px 0px 0px 0px`, threshold: 0 }).observe(headerSentinel);
  }

  /* ------------------------------------------------------------------------
     3. Page tone. Both sections are dark; this still arms the crossfade
        the way Option 1 does, so a later section can join without a jump.
     ------------------------------------------------------------------------ */
  const root = document.documentElement;
  let toneSet = false;

  const toneObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) root.dataset.tone = entry.target.dataset.tone;
    }
    if (!toneSet) {
      toneSet = true;
      getComputedStyle(root).getPropertyValue('--surface');
      root.classList.add('tone-ready');
    }
  }, { rootMargin: toneLineMargin });
  document.querySelectorAll('body [data-tone]').forEach((section) => toneObserver.observe(section));

  /* ------------------------------------------------------------------------
     4. Services — one ASCII crystal, six videos.
     The service whose box crosses the viewport midline is the active one.
     SERVICE_VIDEOS is the only service → video map. A change keeps the
     current picture up and dissolves into the next; a fast scroll retargets
     the in-flight blend instead of queueing. script.js owns the sampling.
     ------------------------------------------------------------------------ */
  const SERVICE_VIDEOS = {
    'ai-agents': '../assets/services/video/ai-agents.mp4',
    'custom-ai-models': '../assets/services/video/custom-ai-models.mp4',
    'mobile-desktop-apps': '../assets/services/video/mobile-desktop-apps.mp4',
    websites: '../assets/services/video/websites.mp4',
    'business-automation': '../assets/services/video/business-automation.mp4',
    analytics: '../assets/services/video/analytics.mp4',
  };

  const services = document.querySelector('.services');
  const serviceItems = services ? Array.from(services.querySelectorAll('.service')) : [];

  if (services && serviceItems.length) {
    const crystalHost = services.querySelector('.services__crystal');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const videos = new Array(serviceItems.length).fill(null);
    let active = -1;
    let playing = -1;
    let pending = -1;
    let blendFrom = -1;
    let blendTo = -1;
    let dissolving = false;
    let blendToken = 0;
    let art = null;
    let booted = false;
    let scrollTick = 0;
    let inView = false;

    function readIndex() {
      const mid = window.innerHeight * 0.5;
      let index = 0;
      for (let i = 0; i < serviceItems.length; i++) {
        const rect = serviceItems[i].getBoundingClientRect();
        if (rect.top <= mid && rect.bottom > mid) return i;
        if (rect.top > mid) return index;
        index = i;
      }
      return index;
    }

    function sectionInView() {
      const rect = services.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < window.innerHeight;
    }

    function markActive(index) {
      serviceItems.forEach((item, i) => {
        const on = i === index;
        item.classList.toggle('is-active', on);
        if (on) item.setAttribute('aria-current', 'true');
        else item.removeAttribute('aria-current');
      });
      services.classList.add('is-ready');
    }

    function videoAt(index) {
      if (index < 0 || index >= serviceItems.length) return null;
      if (videos[index]) return videos[index];
      const src = SERVICE_VIDEOS[serviceItems[index].id];
      if (!src || !crystalHost) return null;
      const video = document.createElement('video');
      video.className = 'hero__source';
      video.muted = true;
      video.defaultMuted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'none';
      video.crossOrigin = 'anonymous';
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('aria-hidden', 'true');
      video.dataset.src = src;
      crystalHost.append(video);
      videos[index] = video;
      return video;
    }

    /** Fetch this video. Src stays unset until then, so the page doesn't pull all six. */
    function warm(index) {
      const video = videoAt(index);
      if (!video || video.dataset.warm) return video;
      video.dataset.warm = '1';
      video.preload = 'auto';
      video.src = video.dataset.src;
      return video;
    }

    function warmAround(index) {
      warm(index);
      warm(index - 1);
      warm(index + 1);
    }

    function playVideo(video) {
      if (!video || reduceMotion.matches) return;
      const pendingPlay = video.play();
      if (pendingPlay) pendingPlay.catch(() => {});
    }

    /**
     * Resolve once a frame can be drawn. A playing video reports that through
     * requestVideoFrameCallback; otherwise canplay / loadeddata is enough.
     */
    function whenFrame(video) {
      if (video.readyState >= 2 && video.videoWidth > 0) return Promise.resolve(video);
      return new Promise((resolve, reject) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          resolve(video);
        };
        const fail = () => {
          if (settled) return;
          settled = true;
          reject(new Error('video'));
        };
        video.addEventListener('error', fail, { once: true });
        const arm = () => {
          if (reduceMotion.matches || typeof video.requestVideoFrameCallback !== 'function') {
            finish();
            return;
          }
          const played = video.play();
          const presented = () => video.requestVideoFrameCallback(() => finish());
          const fallback = () => {
            if (video.readyState >= 2 && video.videoWidth > 0) finish();
            else video.addEventListener('loadeddata', finish, { once: true });
          };
          if (played && typeof played.then === 'function') played.then(presented, fallback);
          else presented();
        };
        if (video.readyState >= 2) arm();
        else video.addEventListener('canplay', arm, { once: true });
      });
    }

    function sourcesWanted() {
      const want = new Set();
      if (!inView || reduceMotion.matches) return want;
      if (pending >= 0) want.add(pending);
      if (dissolving) {
        if (blendFrom >= 0) want.add(blendFrom);
        if (blendTo >= 0) want.add(blendTo);
      } else if (playing >= 0) {
        want.add(playing);
      }
      return want;
    }

    function syncPlayback() {
      const want = sourcesWanted();
      videos.forEach((video, i) => {
        if (!video || !video.src) return;
        if (want.has(i)) playVideo(video);
        else if (!video.paused) video.pause();
      });
      if (art) art.setDrawing(inView);
    }

    function mountArt(index) {
      if (!crystalHost) return;
      let canvas = crystalHost.querySelector('canvas');
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.className = 'services__art';
        canvas.setAttribute('aria-hidden', 'true');
        crystalHost.prepend(canvas);
      }
      warmAround(index);
      const video = videos[index];
      playing = index;
      art = asciiArt(crystalHost, {
        mediaElement: video,
        mediaSource: video.dataset.src,
        playIntro: false,
        hoverDeform: false,
        restDim: 0,
        mediaScale: 1.35,
        focalPoint: { x: 0.5, y: 0.5 },
        narrow: null,
        keepFrame: true,
        quiet: true,
        draw: inView,
        stageBackground: {},
      });
      syncPlayback();
    }

    function requestCrystal(index) {
      if (!art) return;
      const token = ++blendToken;
      pending = index;
      warmAround(index);
      const video = videos[index];
      if (!video) return;
      syncPlayback();
      whenFrame(video).then(() => {
        if (token !== blendToken || !art) return;
        pending = -1;
        if (playing === index && !dissolving) {
          syncPlayback();
          return;
        }
        // A blend already on screen is frozen inside startBlend. Only a
        // settled video needs to keep decoding on the way out.
        const from = dissolving ? -1 : playing;
        dissolving = true;
        blendTo = index;
        blendFrom = from;
        art.startBlend(video, {
          duration: reduceMotion.matches ? 200 : 700,
          mode: reduceMotion.matches ? 'fade' : 'dissolve',
          onDone: () => {
            dissolving = false;
            blendFrom = -1;
            blendTo = -1;
            playing = index;
            syncPlayback();
          },
        });
        syncPlayback();
      }).catch(() => {
        if (token === blendToken) pending = -1;
      });
    }

    function syncServices() {
      scrollTick = 0;
      const next = readIndex();
      const changed = next !== active;
      if (changed) {
        active = next;
        markActive(next);
      }
      if (!booted) tryBoot();
      else if (changed) requestCrystal(next);
    }

    function tryBoot() {
      if (booted || !crystalHost) return;
      const rect = services.getBoundingClientRect();
      if (rect.top > window.innerHeight * 1.35) return;
      booted = true;
      const index = Math.max(active, 0);
      active = index;
      markActive(index);
      mountArt(index);
    }

    function onServiceScroll() {
      if (!scrollTick) scrollTick = requestAnimationFrame(syncServices);
    }

    inView = sectionInView();
    new IntersectionObserver(([entry]) => {
      inView = !!(entry && entry.isIntersecting);
      syncPlayback();
    }).observe(services);

    window.addEventListener('scroll', onServiceScroll, { passive: true });
    window.addEventListener('resize', onServiceScroll);
    window.addEventListener('load', () => {
      syncServices();
      tryBoot();
    });
    syncServices();
    tryBoot();
  }

  /* ------------------------------------------------------------------------
     5. Work: video backgrounds (lazy), loop vs scroll-scrub, plus tilt.
        Fine pointers only; still for reduced motion.
     ------------------------------------------------------------------------ */
  const workMobile = window.matchMedia('(max-width: 1024px)');
  const workVideos = [...document.querySelectorAll('.work-case__image')].filter(
    (el) => el instanceof HTMLVideoElement,
  );

  function workVideoPick(video) {
    return workMobile.matches ? video.dataset.srcMobile : video.dataset.src;
  }

  function mountWorkVideo(video) {
    if (still.matches) return false;
    const next = workVideoPick(video);
    if (!next) return false;
    if (video.dataset.mounted === next) return true;
    video.dataset.mounted = next;
    video.src = next;
    video.preload = 'auto';
    return true;
  }

  function syncWorkVideo(video, visible) {
    const mode = video.dataset.mode;
    const covered = parseFloat(video.closest('.work-case')?.querySelector('.work-case__frame')?.style.getPropertyValue('--cover') || '0') >= 0.999;
    if (!visible || covered) {
      video.pause();
      return;
    }
    if (!mountWorkVideo(video)) return;
    if (mode === 'loop') {
      const play = () => { video.play().catch(() => {}); };
      if (video.readyState >= 2) play();
      else video.addEventListener('loadeddata', play, { once: true });
      return;
    }
    if (mode === 'scrub') {
      const holdFirst = () => {
        video.pause();
        try { video.currentTime = 0; } catch (_) { /* not seekable yet */ }
      };
      if (video.readyState >= 1) holdFirst();
      else video.addEventListener('loadeddata', holdFirst, { once: true });
    }
  }

  workVideos.forEach((video) => {
    if (video.dataset.mode === 'scrub') scrubCases.push(video);
    new IntersectionObserver(([entry]) => {
      const on = !!(entry && entry.isIntersecting);
      workInView.set(video, on);
      syncWorkVideo(video, on);
    }, { rootMargin: '100%' }).observe(video.closest('.work-case') || video);
  });

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

  function aimWork(x, y) {
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
    if (event.pointerType === 'mouse') {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      aimWork(event.clientX, event.clientY);
    }
  }, { passive: true });
  window.addEventListener('scroll', () => aimWork(pointer.x, pointer.y), { passive: true });
  document.documentElement.addEventListener('mouseleave', () => {
    pointer.x = null;
    pointer.y = null;
    aimWork(null, null);
  });
  look.addEventListener('change', () => aimWork(null, null));
  still.addEventListener('change', () => aimWork(null, null));

  /* ------------------------------------------------------------------------
     6. Consultation forms (drawer + contact section) and drawer chrome
     ------------------------------------------------------------------------ */
  function wireConsultationForm(form, done, { emailErrorId = 'consult-email-error' } = {}) {
    const email = form.elements.email;
    const consent = form.elements.consent;

    function setEmailError(message) {
      const field = email.closest('.field');
      field.querySelector('.field__error')?.remove();
      email.removeAttribute('aria-invalid');
      email.removeAttribute('aria-describedby');
      if (!message) return;
      email.setAttribute('aria-invalid', 'true');
      const error = document.createElement('p');
      error.className = 'field__error';
      error.id = emailErrorId;
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
        void label.offsetWidth;
        label.classList.add('is-invalid');
      }
      if (!email.validity.valid) return email.focus();
      if (!consent.checked) return consent.focus();

      form.reset();
      form.hidden = true;
      done.hidden = false;
      done.querySelector('button, [href], input, textarea, select')?.focus();
    });
  }

  document.querySelectorAll('dialog.drawer').forEach((drawer) => {
    const panel = drawer.querySelector('.drawer__panel');
    const form = drawer.querySelector('.drawer__form');
    const done = drawer.querySelector('.drawer__done');
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
      closing = setTimeout(finish, 600);
    }

    document.querySelectorAll(`[data-drawer-open="${drawer.id}"]`).forEach((trigger) => {
      trigger.addEventListener('click', open);
    });
    drawer.querySelectorAll('[data-drawer-close]').forEach((button) => button.addEventListener('click', close));
    drawer.addEventListener('cancel', (event) => { event.preventDefault(); close(); });
    drawer.addEventListener('click', (event) => { if (event.target === drawer) close(); });

    wireConsultationForm(form, done, { emailErrorId: 'consult-email-error' });
  });

  const ctaSection = document.querySelector('.cta');
  const ctaForm = ctaSection?.querySelector('.cta__form');
  const ctaDone = ctaSection?.querySelector('.cta__done');
  if (ctaForm && ctaDone) {
    wireConsultationForm(ctaForm, ctaDone, { emailErrorId: 'cta-email-error' });
    ctaDone.querySelector('[data-contact-reset]')?.addEventListener('click', () => {
      ctaForm.hidden = false;
      ctaDone.hidden = true;
      ctaForm.elements.email?.focus();
    });
  }

  function focusCtaEmail() {
    const email = ctaForm?.elements.email;
    if (email && typeof email.focus === 'function') email.focus({ preventScroll: true });
  }

  document.querySelectorAll('a[href="#contact"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const section = document.getElementById('contact');
      if (!section) return;
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.addEventListener('scrollend', focusCtaEmail, { once: true });
      setTimeout(focusCtaEmail, 800);
    });
  });

  if (location.hash === '#contact') {
    requestAnimationFrame(() => focusCtaEmail());
  }

  /* ------------------------------------------------------------------------
     7. Logo mask. Timed preloader: the film is clipped to the QRE wordmark,
        then the word scales about the R's crossbar until the film is full
        bleed. Reduced motion skips this: the film and the copy are already
        full-bleed in CSS, and the page is never locked.
     ------------------------------------------------------------------------ */
  const reduced = root.classList.contains('is-reduced')
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const hero = document.querySelector('.hero');
  const frameEl = hero.querySelector('.hero__sticky');
  const stage = hero.querySelector('.hero__stage');
  const logo = hero.querySelector('.hero__logo');
  const media = hero.querySelector('.hero__media');
  const video = hero.querySelector('.hero__video');
  const copy = hero.querySelector('.hero__content');
  const copyLinks = copy.querySelectorAll('a');
  const phone = window.matchMedia(CONFIG.mask.mobileQuery);
  const M = CONFIG.mask;
  const VB = M.viewBox;
  const SCROLL_KEYS = new Set([
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'PageUp', 'PageDown', 'Home', 'End', ' ', 'Spacebar',
  ]);

  let geo = null;
  let raf = 0;
  let running = false;
  let seqStart = 0;
  let playBlocked = false;
  let heroSeen = true;
  let done = false;
  let locked = false;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function easeOut(t) {
    return 1 - (1 - t) ** 3;
  }

  // Quartic in-out: a firm start, a soft landing.
  function easeInOut(t) {
    return t < 0.5 ? 8 * t ** 4 : 1 - ((-2 * t + 2) ** 4) / 2;
  }

  function measure() {
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    if (W < 1 || H < 1) return;
    const restW = W * (phone.matches ? M.widthMobile : M.width);
    const restH = restW * (VB.h / VB.w);
    const s0 = restW / VB.w;
    const ox = (M.zoom.x / VB.w) * restW;
    const oy = (M.zoom.y / VB.h) * restH;
    // Put the zoom point on the stage centre so the letters grow in place.
    const originX = W / 2;
    const originY = H / 2;
    const L = originX - ox;
    const T = originY - oy;
    const halfW = (M.stroke.x1 - M.stroke.x0) / 2;
    const halfH = (M.stroke.y1 - M.stroke.y0) / 2;
    // The bar must reach every edge while the zoom point stays put. Pad by
    // the breath so its low point still covers the frame.
    const sCover = Math.max(
      originX / halfW,
      (W - originX) / halfW,
      originY / halfH,
      (H - originY) / halfH,
    );
    const mEnd = (sCover / (1 - M.breath)) / s0;
    geo = { W, H, L, T, ox, oy, mEnd };

    logo.style.left = L + 'px';
    logo.style.top = T + 'px';
    logo.style.width = restW + 'px';
    logo.style.height = restH + 'px';
    logo.style.transformOrigin = ox + 'px ' + oy + 'px';

    media.style.left = '0px';
    media.style.top = '0px';
    media.style.width = W + 'px';
    media.style.height = H + 'px';
    media.style.transformOrigin = '0 0';
  }

  function setCopy(amount) {
    const on = amount > 0.55;
    hero.classList.toggle('is-copy', on);
    hero.style.setProperty('--copy', amount.toFixed(3));
    hero.style.setProperty('--copy-shift', ((1 - amount) * M.copyShift).toFixed(2) + 'px');
    copyLinks.forEach((link) => {
      if (on) link.removeAttribute('tabindex');
      else link.setAttribute('tabindex', '-1');
    });
    if (header) {
      header.style.setProperty('--copy', amount.toFixed(3));
      header.classList.toggle('is-live', on);
      header.inert = !on;
    }
  }

  function pose(enter, zoomT, now) {
    if (!geo) return;
    const breath = Math.sin((now / M.breathPeriod) * Math.PI * 2) * M.breath;
    const m = (1 + (geo.mEnd - 1) * zoomT) * (1 + breath);
    const drawM = m * (M.enterFrom + (1 - M.enterFrom) * enter);
    const vScale = M.videoFrom + (M.videoTo - M.videoFrom) * zoomT;
    const k = vScale / drawM;
    const { W, H, L, T, ox, oy } = geo;
    const mediaX = ox + ((W * (1 - vScale)) / 2 - L - ox) / drawM;
    const mediaY = oy + ((H * (1 - vScale)) / 2 - T - oy) / drawM;

    logo.style.transform = 'scale(' + drawM + ')';
    logo.style.opacity = String(enter);
    media.style.transform = 'translate3d(' + mediaX.toFixed(2) + 'px,' + mediaY.toFixed(2) + 'px,0) scale(' + k + ')';
  }

  function apply(now) {
    if (!geo || done) return;
    if (locked) pinScroll();
    if (!seqStart) {
      pose(0, 0, now);
      setCopy(0);
      return;
    }

    const t = now - seqStart;
    const enter = easeOut(clamp(t / M.enter, 0, 1));
    const zoomT = easeInOut(clamp((t - M.enter - M.hold) / M.zoomMs, 0, 1));
    const copyT = easeOut(clamp((t - M.enter - M.hold - M.zoomMs) / M.copy, 0, 1));
    pose(enter, zoomT, now);
    setCopy(copyT);

    if (t >= M.enter + M.hold + M.zoomMs + M.copy) finish();
  }

  function tick(now) {
    raf = 0;
    if (!running) return;
    apply(now);
    if (running) raf = requestAnimationFrame(tick);
  }

  function start() {
    if (running || done) return;
    running = true;
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function lock() {
    if (locked) return;
    locked = true;
    root.classList.add('is-intro');
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    window.addEventListener('wheel', preventScroll, { passive: false, capture: true });
    window.addEventListener('touchmove', preventScroll, { passive: false, capture: true });
    window.addEventListener('scroll', pinScroll, { passive: false, capture: true });
    window.addEventListener('keydown', onIntroKey, { capture: true });
    window.addEventListener('pointerdown', onIntroPointer, { capture: true });
  }

  function unlock() {
    if (!locked) return;
    locked = false;
    root.classList.remove('is-intro');
    if ('scrollRestoration' in history) history.scrollRestoration = 'auto';
    window.removeEventListener('wheel', preventScroll, { capture: true });
    window.removeEventListener('touchmove', preventScroll, { capture: true });
    window.removeEventListener('scroll', pinScroll, { capture: true });
    window.removeEventListener('keydown', onIntroKey, { capture: true });
    window.removeEventListener('pointerdown', onIntroPointer, { capture: true });
  }

  function preventScroll(event) {
    event.preventDefault();
  }

  function pinScroll() {
    if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0);
  }

  function onIntroKey(event) {
    if (SCROLL_KEYS.has(event.key)) event.preventDefault();
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    event.preventDefault();
    skip();
  }

  function onIntroPointer(event) {
    if (event.isPrimary === false) return;
    event.preventDefault();
    skip();
  }

  function clearInline() {
    logo.removeAttribute('style');
    media.removeAttribute('style');
  }

  function finish() {
    if (done) return;
    done = true;
    stop();
    unlock();
    setCopy(1);
    hero.classList.add('is-ready');
    clearInline();
    syncPlayback(true);
    queueCovers();
  }

  function skip() {
    finish();
  }

  function syncPlayback(shouldPlay) {
    if (!shouldPlay || document.hidden) {
      if (!video.paused) video.pause();
      return;
    }
    if (!video.paused || playBlocked) return;
    const attempt = video.play();
    if (!attempt) return;
    attempt.catch((error) => {
      if (error.name !== 'NotAllowedError') return;
      playBlocked = true;
      window.addEventListener('pointerdown', () => {
        playBlocked = false;
        video.play().catch(() => {});
      }, { once: true });
    });
  }

  function revealFrame() {
    if (video.readyState >= 2) logo.classList.add('has-frame');
  }

  function waitForFrame() {
    return new Promise((resolve) => {
      let settled = false;
      const settle = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const timer = setTimeout(settle, M.timeout);
      const onFrame = () => {
        clearTimeout(timer);
        settle();
      };
      video.addEventListener('error', onFrame, { once: true });
      video.addEventListener('canplay', onFrame, { once: true });
      if (typeof video.requestVideoFrameCallback === 'function') {
        video.requestVideoFrameCallback(() => onFrame());
      }
      if (video.readyState >= 2) onFrame();
    });
  }

  video.addEventListener('loadeddata', revealFrame);
  video.addEventListener('error', () => logo.classList.remove('has-frame'));
  if (video.readyState >= 2) revealFrame();

  function watchHero() {
    const show = () => {
      const rect = frameEl.getBoundingClientRect();
      heroSeen = rect.bottom > 0 && rect.top < window.innerHeight;
      syncPlayback(heroSeen && heroCoverAmount < 0.999 && !document.hidden);
    };
    new IntersectionObserver(show).observe(frameEl);
    document.addEventListener('visibilitychange', show);
    show();
  }

  if (reduced) {
    root.classList.remove('is-intro');
    setCopy(1);
    hero.classList.add('is-ready');
    revealFrame();
    watchHero();
    return;
  }

  copyLinks.forEach((link) => link.setAttribute('tabindex', '-1'));
  if (header) header.inert = true;
  lock();
  measure();
  pose(0, 0, performance.now());
  setCopy(0);
  syncPlayback(true);
  start();

  new ResizeObserver(() => {
    if (done) return;
    measure();
    apply(performance.now());
  }).observe(stage);

  phone.addEventListener('change', () => {
    if (done) return;
    measure();
    apply(performance.now());
  });

  waitForFrame().then(() => {
    if (done) {
      watchHero();
      return;
    }
    revealFrame();
    seqStart = performance.now();
    watchHero();
  });

  /* ----------------------------------------------------------------------
     8. Stacked covers. Incoming top at the viewport bottom → --cover 0;
        incoming top at the viewport top → --cover 1. One rAF tick.
     ---------------------------------------------------------------------- */
  const stackPairs = [];
  const heroCoverEl = document.querySelector('.hero__cover');
  const proofEl = document.querySelector('.proof');
  if (heroCoverEl && proofEl) {
    stackPairs.push({
      out: heroCoverEl,
      inn: proofEl,
      kind: 'hero',
    });
  }
  const stackCases = [...document.querySelectorAll('.work-case')];
  const ctaEl = document.querySelector('.cta');
  stackCases.forEach((el, i) => {
    const next = stackCases[i + 1] || ctaEl;
    if (!next) return;
    const frame = el.querySelector('.work-case__frame') || el;
    stackPairs.push({
      out: frame,
      inn: next,
      kind: 'work',
      video: el.querySelector('.work-case__image'),
    });
  });

  let coverRaf = 0;
  function writeCovers() {
    coverRaf = 0;
    const viewH = window.innerHeight || 1;
    const tops = stackPairs.map((pair) => pair.inn.getBoundingClientRect().top);
    for (let i = 0; i < stackPairs.length; i++) {
      const pair = stackPairs[i];
      /* The frames are 100svh, which stays put when the mobile address bar
         shows or hides. Dividing by that height keeps the fade from jumping
         when innerHeight changes without a scroll. */
      const span = pair.out.clientHeight || viewH;
      const amount = Math.min(1, Math.max(0, 1 - tops[i] / span));
      const value = amount.toFixed(4);
      pair.out.style.setProperty('--cover', value);
      if (pair.kind === 'hero') {
        heroCoverAmount = amount;
        if (amount >= 0.999) {
          if (!video.paused) video.pause();
        } else if (heroSeen && !document.hidden) {
          syncPlayback(true);
        }
      } else if (pair.video) {
        const box = pair.out.getBoundingClientRect();
        const onScreen = box.bottom > 0 && box.top < viewH;
        syncWorkVideo(pair.video, onScreen || workInView.get(pair.video) === true);
      }
    }
  }
  function queueCovers() {
    if (!coverRaf) coverRaf = requestAnimationFrame(writeCovers);
  }
  window.addEventListener('scroll', queueCovers, { passive: true });
  window.addEventListener('resize', queueCovers);
  writeCovers();
})();
