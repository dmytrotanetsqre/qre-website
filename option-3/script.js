/* ==========================================================================
   ASCII GEM — Option 1's renderer. Option 3 uses it for the Services
   crystals (one looping video each).

   The hero no longer samples this. Services passes its own videos and
   crossfades them per cell (startBlend).
   Sampling follows the video's own frames where the browser can
   (requestVideoFrameCallback). There is no film grain and no 0/1 field.

   Colour ASCII art from an image or a video, drawn on <canvas>.

   Every frame:
   1. Sample  The media is drawn into a tiny off-screen canvas where one pixel
              is one character cell, then read back with getImageData;
              `clarity` then sharpens the edges between its areas.
   2. Glyphs  Each pixel's luminance picks a character from the ramp, drawn
              with fillText in plain white: a mask.
   3. Colour  The tiny canvas is stretched over the mask with 'source-in', so
              every character takes the RGB of the pixel it represents, or
              its gray level with `monochrome` on, toned by `midtones`,
              `contrast`, `brightness`, `highlights` and `shadows` (one GPU
              pass instead of thousands of fillStyle changes). Never darker
              than the background (--hero-bg), so glyphs blend into it
              instead of leaving dark blotches on a lighter page.

   The cursor deformation —
   symbols near the pointer pushed aside like liquid, position only — happens
   here instead: it needs each glyph's own position, which a CSS effect
   layered on top of the canvas can't reach. The art rests a little dark
   (`restDim`), and the same hover lights the characters near the pointer
   back up, in the colour pass, so the background around them stays dark.

   The canvas is cleared to transparent every frame. The colour behind the art
   lives in style.css (--hero-bg); nothing in this file touches it. When the
   page's light tone takes over (site.js, data-tone on <html>), style.css fades
   the art out and this file stops drawing until the dark tone is back.
   ========================================================================== */

/**
 * One ASCII art: `root` holds the <canvas>, `overrides` replaces CONFIG keys for this
 * instance. Run for the hero, and for the contact band's dimmer copy (see the end).
 */
function asciiArt(root, overrides) {
  'use strict';

  /* ------------------------------------------------------------------------
     CONFIG: everything worth tweaking lives here.
     ------------------------------------------------------------------------ */
  const CONFIG = {
    // Media
    mediaSource: 'assets/hero-gem.mp4', // path or URL (other domains must send CORS headers)
                                      // (the eye: 'assets/hero-background.mp4' with fit 'cover',
                                      // mediaScale 1, narrow: null and Depth off: midtones 1,
                                      // highlights 0, clarity 0)
    mediaType: 'video',               // 'image' | 'video'
    fit: 'contain',                   // 'cover' fills the frame, 'contain' shows all of it
    mediaScale: 0.8,                  // size relative to `fit`: 1 = as fit sizes it, 0.8 = 80 % of that.
                                      // The gem video's background is black, which sinks into --hero-bg,
                                      // so below 1 the gem floats in the hero with room around it
    focalPoint: { x: 0.5, y: 0.5 },   // where the media sits, or what stays in view when cropped:
                                      // 0–1, 0.5 = centre (like CSS object-position)
    narrow: {                         // phones: replaces mediaScale and focalPoint below style.css's
      query: '(max-width: 768px)',    // 768 px breakpoint, where the copy stacks over the lower half
      mediaScale: 1.25,               // 'contain' sizes by the width there, and the gem spans only
                                      // 63 % of its video's width, so it needs more to read
      focalPoint: { x: 0.5, y: 0.25 }, // higher, into the space above the headline
    },

    // Characters
    asciiCharacters: '01',             // darkest → brightest; the colour pass still shades each
                                      // digit continuously, so brightness reads through greyscale,
                                      // not just which digit is drawn
    fontFamily: '"Geist Mono", ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                                      // ^ self-hosted (see style.css's @font-face); falls back to
                                      //   the system's own monospace if that file can't load
    fontSize: 14,                     // px. Rows are fontSize × lineHeight tall
    lineHeight: 1,
    letterSpacing: 0.5,               // gap between characters, as a share of their width (0.5 = half)
    columns: 240,                     // most characters a row may hold; the spacing decides how many
                                      // fit across the screen (about 120 on a 1512 px wide window)
    autoContrast: true,               // spread each frame's darkest → brightest pixels over the
                                      // whole ramp (picks characters only; colours stay untouched)
    invert: false,                    // true: dense characters for dark pixels (light backgrounds)
    monochrome: true,                 // shades of gray (each pixel's brightness); false = original colours
    brightness: 0.62,                 // multiplies the characters' brightness: 1 = as in the media, 0.5 = half
    contrast: 1.3,                    // 1 = as in the media; 1.3 = 30 % more: shadows darker, lights lighter
                                      // (spread around mid-gray, before brightness; colours only). Past ~1.3
                                      // this video's brightest parts max out, so going higher only darkens
    shadows: 0.6,                     // dark tones that would sink into the background show as faint characters
                                      // instead, in steps: 0 = off, 1 = every shade the contrast leaves
                                      // (only the darkest tones move; mids and lights stay as they are)

    // Depth: what lets the object read as a solid, lit form rather than a flat field of digits
    midtones: 1.6,                    // lifts the darker and middle tones before contrast, like the middle
                                      // slider in Levels: 1 = as in the media. The gem's glass is mostly
                                      // dark, and above 1 its darker facets show as dim characters instead
                                      // of holes, so it reads as a solid object
    highlights: 1,                    // lifts the brightest tones towards white, leaving the rest: 0 = off,
                                      // 1 = the very brightest reach white (glints on edges and corners)
    clarity: 1,                       // local contrast: each cell pushed away from its neighbourhood, so
                                      // facet edges and the outline stand out. 0 = off

    // Motion: images only (a video brings its own)
    imageZoom: 0.06,                  // slow push towards focalPoint and back: 0.06 = 6 %, 0 = still
    imageZoomDuration: 16,            // seconds per in-and-out cycle

    // Effects
    hoverDeform: true,                // symbols near the cursor are pushed aside like liquid, position only:
                                      // their size never changes (pointer devices only — a touch's last
                                      // tap would stick)
    hoverRadius: 260,                 // px, how far the deformation reaches
    hoverStrength: 0.2,               // how far symbols at the very centre travel, as a share of
                                      // hoverRadius: 0.2 = 20 % (52 px at 260), easing to 0 at its edge
    hoverScatter: 1,                  // stray symbols: 0 = none, a smooth flow; 1 = one in five, picked
                                      // at random, breaks away and travels further, up to 2.2× as far
    hoverSpeed: 0.5,                  // the hover's pace: 1 = brisk, 0.5 = twice as slow, a thicker liquid.
                                      // It trails the cursor further, swells in and settles back more
                                      // gently, and its swirl and ripples drift more slowly
    restDim: 0.45,                    // the art rests this much darker, closer to the background: 0 = as
                                      // toned above, 0.45 = 45 %. The hover lights the characters back up,
                                      // fully at its centre, easing out to hoverRadius; the background
                                      // stays as it is (with no hover — touch screens, or hoverDeform
                                      // off — the art stays dim)

    // Intro: the page opens on the gem alone, larger and centred, then it settles into place as
    // the header and copy fade in. Only the sampled area moves, so the characters keep their size.
    // (Switched on by the .is-intro class index.html sets on <html>; skipped with reduced motion.)
    playIntro: true,                  // false: no intro (the contact band's copy, and Option 3's hero)
    intro: {
      scale: 1.3,                     // the gem's size during the intro, relative to its resting size
      hold: 1000,                     // ms the gem shows alone, from its first frame
      duration: 1400,                 // ms it takes to settle into place
      timeout: 5000,                  // ms to wait for the media before showing the page without it
    },

    // Services stage: faint 0/1 field behind the crystal (same grid). null = off.
    stageBackground: null, // enable: {} — defaults below
  };
  Object.assign(CONFIG, overrides);
  const STAGE_BG = CONFIG.stageBackground && typeof CONFIG.stageBackground === 'object'
    ? Object.assign({
      seed: 20261024,
      density: 0.35,
      alphaMin: 0.06,
      alphaMax: 0.10,
      flashAlpha: 0.20,
      flickerRate: 0.015,
      fadeMs: 600,
      fps: 12,
      edgeFalloff: 1.6,
    }, CONFIG.stageBackground)
    : null;

  /* ------------------------------------------------------------------------
     Internals
     ------------------------------------------------------------------------ */
  const MAX_PIXEL_RATIO = 2;        // crisp on retina, without 9× the pixels on 3× phones
  const FRAME_INTERVAL = 1000 / 60; // render at most 60× a second, even on 120 Hz screens
  const MIN_ALPHA = 16;             // (near-)transparent pixels get no character
  const CONTRAST_EASE = 0.12;       // how fast autoContrast follows a changing video (per frame)
  const MIN_CONTRAST_SPAN = 64;     // stops autoContrast from amplifying noise in flat frames
  const SPACE = 32;
  const CLARITY_RADIUS = 3;         // cells: the neighbourhood clarity compares each cell with

  // The hover's liquid feel (strength, scatter and speed are in CONFIG; times are at hoverSpeed 1).
  const HOVER_FOLLOW = 90 / CONFIG.hoverSpeed; // ms the deformation takes to catch up with the cursor: it trails it
  const HOVER_FADE = 220 / CONFIG.hoverSpeed;  // ms to swell in on hover, and to settle back once the cursor leaves
  const HOVER_SWIRL = 0.6;          // radians the push may veer from straight outward, drifting over time
  const HOVER_WAKE = 40;            // ms of the cursor's movement that symbols near it are carried along by

  const hero = root;
  const canvas = hero.querySelector('canvas');
  const ctx = canvas.getContext('2d');

  // Hidden, off-screen sampling canvas: never added to the page.
  const sampler = document.createElement('canvas');
  const samplerCtx = sampler.getContext('2d', { willReadFrequently: true });

  // Video only: a GPU canvas that shrinks each frame before it's copied to the CPU sampler.
  // Drawn straight into the sampler, a 1080p frame would be converted to CPU pixels in full.
  const stage = document.createElement('canvas');
  const stageCtx = stage.getContext('2d');

  const isVideo = CONFIG.mediaType === 'video';
  // Sample a playing video when it presents a frame. Turned off if that
  // callback is missing or throws, and the rAF loop takes over.
  let sampleOnVideoFrame = isVideo && 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrowScreen = CONFIG.narrow ? window.matchMedia(CONFIG.narrow.query) : null;
  const imageMotion = !isVideo && !reduceMotion && CONFIG.imageZoom > 0 && CONFIG.imageZoomDuration > 0;

  const glyphs = Array.from(CONFIG.asciiCharacters || ' .:-=+*#%@');
  const glyphCodes = glyphs.map((glyph) => glyph.charCodeAt(0));
  const glyphIsBlank = glyphs.map((glyph) => glyph.trim() === '');
  const glyphForLuma = new Uint8Array(256); // luminance (0–255) → index into the ramp
  const histogram = new Uint32Array(256);
  mapLumaToGlyphs(0, 255);

  // midtones, then contrast: each channel value (0–255) lifted along a gamma curve, then pushed away
  // from mid-gray; the clamped array keeps it in range.
  const contrastCurve = new Uint8ClampedArray(256);
  function refreshTone() {
    for (let value = 0; value < 256; value++) {
      const lifted = 255 * (value / 255) ** (1 / CONFIG.midtones);
      contrastCurve[value] = (lifted - 128) * CONFIG.contrast + 128;
    }
  }
  refreshTone();

  let media = null;      // the hidden image or video element
  let grid = null;       // character grid geometry, rebuilt on resize
  let lastPixels = null; // previous frame's samples, to skip repeated frames
  let levels = null;     // autoContrast's current { low, high } luminance
  let tintFrame = null;  // reusable buffer for the gray / dimmed version of each frame
  let sharpFrame = null; // clarity's version of each frame, so the frame-skip check still sees the media's
  let lumaPlane = null, blurPlane = null, blurScratch = null; // per-cell work planes for clarity's blur
  let backgroundFloor = [0, 0, 0]; // no character drawn darker than this (read from the CSS background)
  let stageGlyphRgb = [255, 255, 255]; // stage field glyphs: inherited text colour when set
  let pointer = null;    // { x, y } in the hero's own CSS px, or null when not hovering
  // The deformation as drawn: centred on a point that trails the pointer, moving at (vx, vy) px/ms,
  // at a strength that swells to 1 while hovering and settles back to 0 after.
  const hover = { x: 0, y: 0, vx: 0, vy: 0, strength: 0, time: 0 };
  let hadHover = false;  // the last drawn frame was deformed: forces one clean redraw once it ends
  const loose = [];      // symbols the hover carried off this frame: code, x, y, pixel index, …
  let looseColours = new Uint32Array(0); // …their colours, packed RGBA, to draw them grouped
  const looseOrder = []; // …and the order to draw them in
  const offset = { x: 0, y: 0 }; // liquidOffset's result, reused
  let lastFrameTime = -Infinity;
  let frameRequest = 0;
  let videoFrameId = 0;
  let renderPending = false;
  let inView = true;
  let stopped = false;
  // Option 3: idle until site.js turns drawing on (`draw: false`).
  let drawing = CONFIG.draw !== false;
  let booting = true;    // setScene before the first sample is held and applied at the end of init
  let queuedScene = null;
  let readySent = false;
  let forceLook = false; // size or dim changed: redraw even if the video frame repeated
  // The intro's state: true while it runs (no hover yet), its start time once the gem first shows.
  let intro = CONFIG.playIntro && document.documentElement.classList.contains('is-intro');
  let introStart = null;
  let introTimeout = 0;

  // Services: two videos sampled into one grid, then the ordinary glyph and
  // colour passes. A cell flips when eased time passes its threshold.
  const BLEND_BAND = 0.25; // each cell crossfades across this share of the timeline
  const BLEND_DIP = 0.4;   // mid-band brightness falls to 1 - this (about 60%)
  let queuedBlend = null;
  const blend = {
    active: false,
    fromMedia: null,
    toMedia: null,
    fromFrozen: null, // retarget: the blended frame we left, so nothing queues
    out: null,
    gain: null,
    thresholds: null,
    cols: 0,
    rows: 0,
    seed: 1,
    start: 0,
    duration: 700,
    mode: 'dissolve',
    eased: 0,
    rawT: 0,
    midSent: false,
    onMid: null,
    onDone: null,
    heldAt: 0,
  };

  // Services stage ASCII field (behind the crystal mask; not part of the dissolve).
  let bgPattern = null;     // 1 = cell in the seeded field
  let bgChar = null;        // 0 | 1 glyph index per cell
  let bgFlashStart = null;  // ms when a flicker started, else 0
  let bgCols = 0;
  let bgRows = 0;
  let lastBgTick = -Infinity;

  /** Rec. 709 luma of the pixel at byte offset i, in integer maths (weights × 256). */
  function luma(pixels, i) {
    return (pixels[i] * 54 + pixels[i + 1] * 183 + pixels[i + 2] * 19) >> 8;
  }

  /** Fill the lookup table so luminance low → first character, high → last character. */
  function mapLumaToGlyphs(low, high) {
    for (let value = 0; value < 256; value++) {
      let level = Math.min(Math.max((value - low) / (high - low), 0), 1);
      if (CONFIG.invert) level = 1 - level;
      glyphForLuma[value] = Math.min(glyphs.length - 1, Math.floor(level * glyphs.length));
    }
  }

  function glyphAt(pixels, i) {
    if (pixels[i + 3] < MIN_ALPHA) return SPACE;
    return glyphCodes[glyphForLuma[luma(pixels, i)]];
  }

  // A cell belongs to the crystal only when its glyph is visibly brighter than the
  // background. With '01' every cell gets a glyph, even the black video background,
  // so checking the glyph alone marked every cell as covered and hid the stage field.
  const STAGE_COVER_LIFT = 14; // luma steps above the background floor
  function crystalCoversCell(pixels, i) {
    if (pixels[i + 3] < MIN_ALPHA) return false;
    const [r, g, b] = backgroundFloor;
    const floorLuma = (r * 54 + g * 183 + b * 19) >> 8;
    return luma(pixels, i) > floorLuma + STAGE_COVER_LIFT;
  }

  /** autoContrast: map this frame's 1st–99th percentile brightness onto the full ramp. */
  function fitRampToFrame(pixels) {
    histogram.fill(0);
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] < MIN_ALPHA) continue;
      histogram[luma(pixels, i)]++;
      count++;
    }
    if (count < 24) return;

    let low = percentile(count * 0.01);
    let high = percentile(count * 0.99);
    if (high - low < MIN_CONTRAST_SPAN) {
      const middle = (low + high) / 2;
      low = Math.min(Math.max(middle - MIN_CONTRAST_SPAN / 2, 0), 255 - MIN_CONTRAST_SPAN);
      high = low + MIN_CONTRAST_SPAN;
    }
    if (levels) {
      // Ease towards the new range, like a camera's auto exposure, so video doesn't flicker.
      low = levels.low + (low - levels.low) * CONTRAST_EASE;
      high = levels.high + (high - levels.high) * CONTRAST_EASE;
    }
    levels = { low, high };
    mapLumaToGlyphs(low, high);
  }

  function percentile(rank) {
    for (let value = 0, seen = 0; value < 256; value++) {
      seen += histogram[value];
      if (seen > rank) return value;
    }
    return 255;
  }

  /** A stable pseudo-random number in [0, 1) per cell and salt: each symbol keeps its own quirks. */
  function cellRandom(col, row, salt) {
    let h = Math.imul(col, 374761393) ^ Math.imul(row, 668265263) ^ Math.imul(salt, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1103515245);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  /**
   * Advance the hover to `time` (ms): its centre eases after the pointer, so the deformation
   * trails the cursor like a wake, and its strength swells in while hovering and settles out
   * after. Returns true while there's any deformation to draw.
   */
  function updateHover(time) {
    const dt = Math.min(Math.max(time - hover.time, 1), 50); // a stall mustn't make it jump
    hover.time = time;
    if (pointer) {
      if (!hover.strength) Object.assign(hover, { x: pointer.x, y: pointer.y, vx: 0, vy: 0 });
      const follow = 1 - Math.exp(-dt / HOVER_FOLLOW);
      const x = hover.x + (pointer.x - hover.x) * follow;
      const y = hover.y + (pointer.y - hover.y) * follow;
      hover.vx = (x - hover.x) / dt;
      hover.vy = (y - hover.y) / dt;
      hover.x = x;
      hover.y = y;
    } else {
      hover.vx = hover.vy = 0;
    }
    hover.strength += ((pointer ? 1 : 0) - hover.strength) * (1 - Math.exp(-dt / HOVER_FADE));
    if (!pointer && hover.strength < 0.005) hover.strength = 0;
    return hover.strength > 0;
  }

  /**
   * Where the hover carries the symbol of cell (col, row), whose centre is (cx, cy), into `offset`.
   * Like liquid, the flow is smooth: outward from the hover centre, veering with a slowly
   * drifting swirl and rippling outward over time, as far as hoverStrength × hoverRadius at the
   * centre and easing to nothing at the radius's edge (no seam where the deformation ends),
   * dragged along while the cursor moves. A few symbols, picked at random, break away from
   * it and travel further. Returns false outside the radius. `time` is 0 with reduced motion,
   * which stills the swirl and the ripples.
   */
  function liquidOffset(col, row, cx, cy, time) {
    const dx = cx - hover.x, dy = cy - hover.y;
    const dist = Math.hypot(dx, dy);
    const radius = CONFIG.hoverRadius;
    if (dist >= radius) return false;
    const t = 1 - dist / radius;
    const falloff = t * t * (3 - 2 * t) * hover.strength; // smoothstep, faded in and out

    const swirl = HOVER_SWIRL * Math.sin(cx * 0.031 + time * 0.0009) * Math.cos(cy * 0.027 - time * 0.0011);
    const ripple = 1 + 0.12 * Math.sin(dist * 0.045 - time * 0.005); // ~140 px waves, ~110 px/s outward
    // One symbol in five strays; the strongest strays go up to (1 + 1.2 × hoverScatter) as far.
    const quirk = cellRandom(col, row, 1);
    const stray = quirk > 0.8 ? CONFIG.hoverScatter * 1.2 * ((quirk - 0.8) / 0.2) ** 2 : 0;
    const veer = stray ? (cellRandom(col, row, 2) - 0.5) * 0.8 : 0;
    const angle = Math.atan2(dy, dx) + swirl + veer;
    const push = falloff * ripple * (1 + stray) * CONFIG.hoverStrength * radius;

    // The wake: the cursor's own movement, capped so a flick can't fling symbols off screen.
    let wx = hover.vx * HOVER_WAKE * falloff, wy = hover.vy * HOVER_WAKE * falloff;
    const wake = Math.hypot(wx, wy), cap = CONFIG.hoverStrength * radius;
    if (wake > cap) { wx *= cap / wake; wy *= cap / wake; }

    offset.x = Math.cos(angle) * push + wx;
    offset.y = Math.sin(angle) * push + wy;
    return true;
  }

  /**
   * How far the hover lights the cell centred at (cx, cy) back up from restDim: 1 at the hover's
   * centre, easing to 0 at hoverRadius with the same smoothstep as the deformation, and fading
   * in and out with it.
   */
  function hoverLight(cx, cy) {
    if (!hover.strength) return 0;
    const dist = Math.hypot(cx - hover.x, cy - hover.y);
    if (dist >= CONFIG.hoverRadius) return 0;
    const t = 1 - dist / CONFIG.hoverRadius;
    return t * t * (3 - 2 * t) * hover.strength;
  }

  /* ------------------------------------------------------------------------
     Layout
     ------------------------------------------------------------------------ */

  /** Size the canvas to the hero and fit the character grid inside it. */
  function measureGrid() {
    const { width, height } = hero.getBoundingClientRect();
    if (width < 1 || height < 1) return null;

    // The floor below which no glyph is drawn: the hero's dark background, read from --hero-bg
    // (registered as a <color>, so it reads back as rgb()) — not the hero's backgroundColor, which
    // follows the page tone — so style.css stays the one place that colour is set.
    const styles = getComputedStyle(hero);
    const bg = styles.getPropertyValue('--hero-bg').match(/[\d.]+/g);
    if (bg) backgroundFloor = bg.slice(0, 3).map(Number);
    const text = styles.color.match(/[\d.]+/g);
    if (text) stageGlyphRgb = text.slice(0, 3).map(Number);

    // Backing store at device resolution. Resizing a canvas resets its context state,
    // so only touch the buffer when the size actually changed — the dissolve retunes
    // the glyph size many times, and a needless resize would flash an empty frame.
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    const storeWidth = Math.round(width * ratio);
    const storeHeight = Math.round(height * ratio);
    if (canvas.width !== storeWidth || canvas.height !== storeHeight) {
      canvas.width = storeWidth;
      canvas.height = storeHeight;
    }
    ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    // The previous grid's letterSpacing stays on the context. Skipping the
    // canvas resize (it would flash an empty frame) also skips the reset a
    // resize used to give us. Measured with that spacing, the glyphs read
    // wider than they are, the column count collapses and the picture stops
    // short of the right edge.
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.font = `${CONFIG.fontSize}px ${CONFIG.fontFamily}`;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';            // glyph mask; the colour pass replaces it
    ctx.imageSmoothingEnabled = false; // colour pass: one flat colour per cell
    // Setting the font can leave the spacing we just cleared. Measure at 0.
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

    // Columns: as many cells (glyph + letterSpacing gap) as fit across, up to CONFIG.columns.
    // Cells then stretch by a fraction of a pixel so the row spans the full width exactly.
    const advances = glyphs.map((glyph) => ctx.measureText(glyph).width);
    const glyphWidth = Math.max(...advances);
    const pitch = glyphWidth * (1 + CONFIG.letterSpacing);
    const columns = Math.max(1, Math.min(CONFIG.columns, Math.floor(width / pitch)));
    const rows = Math.max(1, Math.round(height / (CONFIG.fontSize * CONFIG.lineHeight)));
    const cellWidth = width / columns;
    const cellHeight = height / rows;

    // Fast path: one fillText per row, spread onto the grid with letterSpacing.
    // Needs canvas letterSpacing and a ramp whose glyphs all match the space's width (monospace).
    const spaceWidth = ctx.measureText(' ').width;
    const rowMode = 'letterSpacing' in ctx &&
      glyphs.every((glyph, i) => glyph.length === 1 && Math.abs(advances[i] - spaceWidth) < 0.01);
    if (rowMode) ctx.letterSpacing = `${cellWidth - spaceWidth}px`;

    // The sampler mirrors the grid: one pixel per character.
    sampler.width = columns;
    sampler.height = rows;
    samplerCtx.imageSmoothingQuality = 'high';
    if (isVideo) {
      stage.width = columns * 2;
      stage.height = rows * 2;
      stageCtx.imageSmoothingQuality = 'high';
    }

    lastPixels = null;
    const layout = {
      width, height, columns, rows, cellWidth, cellHeight, rowMode,
      rowX: (cellWidth - spaceWidth) / 2,                          // centres row-mode glyphs in their cells
      glyphX: advances.map((advance) => (cellWidth - advance) / 2), // same, per glyph, for the fallback
      rowCodes: new Uint16Array(columns),
    };
    ensureStageBackground(layout);
    return layout;
  }

  /* ------------------------------------------------------------------------
     Rendering
     ------------------------------------------------------------------------ */

  function sourceSize(el) {
    if (el instanceof HTMLVideoElement) return [el.videoWidth, el.videoHeight];
    if (el instanceof HTMLCanvasElement) return [el.width, el.height];
    return [el.naturalWidth || 0, el.naturalHeight || 0];
  }

  /** Draw a frame into the sampler and return its pixels: RGBA, one per cell. */
  function sampleMedia(el, time, opts = {}) {
    const [mediaWidth, mediaHeight] = sourceSize(el);
    if (!mediaWidth || !mediaHeight) return null;

    const { width, height, columns, rows, cellWidth, cellHeight } = grid;
    const placement = opts.placement
      || (CONFIG.narrow && narrowScreen?.matches ? CONFIG.narrow : CONFIG);
    const settle = opts.settle == null ? introProgress(time) : opts.settle;
    const fitMode = opts.fit != null ? opts.fit : CONFIG.fit;
    const mediaScale = (opts.mediaScale != null ? opts.mediaScale : placement.mediaScale)
      * (CONFIG.intro.scale + (1 - CONFIG.intro.scale) * settle);
    const fp = opts.focalPoint || placement.focalPoint || { x: 0.5, y: 0.5 };
    const focalPoint = {
      x: 0.5 + (fp.x - 0.5) * settle,
      y: 0.5 + (fp.y - 0.5) * settle,
    };
    const fit = fitMode === 'contain' ? Math.min : Math.max;
    const scale = fit(width / mediaWidth, height / mediaHeight) * mediaScale * zoomAt(time);
    const drawWidth = mediaWidth * scale;
    const drawHeight = mediaHeight * scale;

    const x = ((width - drawWidth) * focalPoint.x) / cellWidth;
    const y = ((height - drawHeight) * focalPoint.y) / cellHeight;
    const w = drawWidth / cellWidth;
    const h = drawHeight / cellHeight;

    samplerCtx.clearRect(0, 0, columns, rows);
    const video = el instanceof HTMLVideoElement;
    if (video) {
      stageCtx.clearRect(0, 0, stage.width, stage.height);
      stageCtx.drawImage(el, x * 2, y * 2, w * 2, h * 2);
      samplerCtx.drawImage(stage, 0, 0, columns, rows);
    } else {
      samplerCtx.drawImage(el, x, y, w, h);
    }
    return samplerCtx.getImageData(0, 0, columns, rows).data;
  }

  /** Draw the current frame into the sampler and return its pixels: RGBA, one per cell. */
  function sampleFrame(time) {
    if (!media) return null;
    return sampleMedia(media, time);
  }

  /**
   * How far the intro has settled at `time`: 0 while the gem shows alone, easing to 1 as it moves
   * into place. Drops .is-intro (the page fades in) as the move begins, and ends the intro after.
   */
  function introProgress(time) {
    if (!intro) return 1;
    if (introStart === null) return 0; // not drawn yet: the first frame sets the clock
    const t = (time - introStart - CONFIG.intro.hold) / CONFIG.intro.duration;
    if (t <= 0) return 0;
    document.documentElement.classList.remove('is-intro');
    if (t >= 1) {
      intro = false;
      return 1;
    }
    return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2; // ease in-out (cubic)
  }

  /** Show the page at once, without the intro: when the media is slow or fails, or off screen. */
  function skipIntro() {
    clearTimeout(introTimeout);
    if (!intro) return;
    intro = false;
    document.documentElement.classList.remove('is-intro');
    invalidate();
  }

  /** Image zoom at a given time, easing 1 → 1 + imageZoom → 1. */
  function zoomAt(time) {
    if (!imageMotion) return 1;
    const phase = (time / 1000 / CONFIG.imageZoomDuration) * 2 * Math.PI;
    return 1 + (CONFIG.imageZoom * (1 - Math.cos(phase))) / 2;
  }

  /**
   * Draw every character in white: the mask the colour pass paints into.
   * Cells within hoverRadius of the hover are left out of it and collected in
   * `loose` instead, at the place the hover carries them, to be drawn after the
   * colour pass; everywhere else is untouched, so the effect costs nothing beyond
   * the neighbourhood it reaches.
   */
  function drawGlyphs(pixels, time) {
    const { width, height, columns, rows, cellWidth, cellHeight, rowMode, rowX, glyphX, rowCodes } = grid;
    ctx.clearRect(0, 0, width, height); // transparent: the CSS background shows through
    loose.length = 0;

    const live = hover.strength > 0;
    const reach = CONFIG.hoverRadius;
    const rowMin = live ? Math.max(0, Math.floor((hover.y - reach) / cellHeight)) : 0;
    const rowMax = live ? Math.min(rows - 1, Math.ceil((hover.y + reach) / cellHeight)) : -1;
    const colMin = live ? Math.max(0, Math.floor((hover.x - reach) / cellWidth)) : 0;
    const colMax = live ? Math.min(columns - 1, Math.ceil((hover.x + reach) / cellWidth)) : -1;
    const motionTime = reduceMotion ? 0 : time * CONFIG.hoverSpeed; // the swirl and ripples' own clock

    for (let row = 0, i = 0; row < rows; row++) {
      const y = (row + 0.5) * cellHeight;
      const rowInReach = row >= rowMin && row <= rowMax;

      if (rowMode) {
        // One string per row; letterSpacing lands each character in its cell.
        for (let col = 0; col < columns; col++, i += 4) {
          rowCodes[col] = glyphAt(pixels, i);
        }
        // Reachable characters leave the row string for `loose`, at the same left edge the row
        // string would have given them (so nothing jumps where the deformation fades out).
        if (rowInReach) {
          for (let col = colMin; col <= colMax; col++) {
            const code = rowCodes[col];
            if (code === SPACE || !liquidOffset(col, row, (col + 0.5) * cellWidth, y, motionTime)) continue;
            loose.push(code, col * cellWidth + rowX + offset.x, y + offset.y, (row * columns + col) * 4);
            rowCodes[col] = SPACE;
          }
        }
        ctx.fillText(String.fromCharCode.apply(null, rowCodes), rowX, y);
      } else {
        // Fallback: one fillText per character.
        for (let col = 0; col < columns; col++, i += 4) {
          const code = glyphAt(pixels, i);
          if (code === SPACE) continue;
          const glyph = glyphCodes.indexOf(code);
          if (glyph < 0 || glyphIsBlank[glyph]) continue;

          const x = col * cellWidth + glyphX[glyph];
          if (rowInReach && col >= colMin && col <= colMax &&
              liquidOffset(col, row, (col + 0.5) * cellWidth, y, motionTime)) {
            loose.push(glyphCodes[glyph], x + offset.x, y + offset.y, i);
          } else {
            ctx.fillText(glyphs[glyph], x, y);
          }
        }
      }
    }
  }

  /**
   * Draw the characters the hover carried off, each in its own cell's colour: the colour
   * pass paints by position, so a character moved over a neighbour's cell would take on
   * the neighbour's shade. Ones at the background's level are skipped — invisible anyway,
   * they would only blot out the characters they land on.
   */
  function drawLooseGlyphs() {
    const count = loose.length / 4;
    if (!count) return;
    const tint = tintFrame.data;
    const [floorR, floorG, floorB] = backgroundFloor;
    if (looseColours.length < count) looseColours = new Uint32Array(count * 2);
    looseOrder.length = 0;
    for (let k = 0; k < count; k++) {
      const i = loose[k * 4 + 3];
      const src = tint;
      if (src[i] <= floorR && src[i + 1] <= floorG && src[i + 2] <= floorB) continue;
      looseColours[k] = ((src[i] << 24) | (src[i + 1] << 16) | (src[i + 2] << 8) | src[i + 3]) >>> 0;
      looseOrder.push(k);
    }
    // Grouped by colour, so fillStyle (a CSS colour the canvas has to parse) changes once per
    // shade rather than once per character; brighter shades come last, landing on top.
    looseOrder.sort((a, b) => looseColours[a] - looseColours[b]);
    let colour = -1;
    for (const k of looseOrder) {
      if (looseColours[k] !== colour) {
        colour = looseColours[k];
        ctx.fillStyle = `rgb(${colour >>> 24} ${(colour >>> 16) & 255} ${(colour >>> 8) & 255} / ${(colour & 255) / 255})`;
      }
      ctx.fillText(String.fromCharCode(loose[k * 4]), loose[k * 4 + 1], loose[k * 4 + 2]);
    }
    ctx.fillStyle = '#fff'; // back to the mask's white for the next frame
  }

  /**
   * One channel value (0–255) → its level on screen: contrast, then brightness, never below
   * `floor` (the background's level for that channel). A tone that lands under the floor would
   * vanish into the background; `shadows` lifts the darkest of those just above it instead,
   * spreading them up to twice the floor's level, where tones are left as they are.
   */
  function tone(value, floor, scale) {
    let level = contrastCurve[value] * CONFIG.brightness;
    if (scale) {
      level *= scale.bright;
      level = 128 + (level - 128) * scale.contrast;
    }
    // highlights: the top half of the range bends upwards, so its very top reaches white
    const top = 255 * CONFIG.brightness * (scale?.bright ?? 1);
    if (level > top / 2) level += ((level - top / 2) / (top / 2)) ** 2 * Math.max(0, 255 - top) * CONFIG.highlights;
    const knee = floor * 2;                      // from here up, untouched
    if (level >= knee) return level;
    const fade = floor * (1 - CONFIG.shadows);  // from here down, gone into the background
    if (level <= fade) return floor;
    return floor + ((level - fade) * (knee - floor)) / (knee - fade);
  }

  /**
   * Rewrite the sampler's colours for the colour pass: gray (monochrome), toned (above),
   * dimmed by restDim except where the hover lights them, and floored so nothing renders
   * darker than the background — a dim or near-black character would otherwise sit as a
   * visible dark blotch on top of it.
   */
  function tintSampler(pixels) {
    const { columns, rows, cellWidth, cellHeight } = grid;
    if (!tintFrame || tintFrame.width !== columns || tintFrame.height !== rows) {
      tintFrame = samplerCtx.createImageData(columns, rows);
    }
    const tint = tintFrame.data; // Uint8ClampedArray: rounds and clamps to 0–255 on its own
    const [floorR, floorG, floorB] = backgroundFloor;
    for (let row = 0, i = 0; row < rows; row++) {
      const cy = (row + 0.5) * cellHeight;
      for (let col = 0; col < columns; col++, i += 4) {
        // The share of each tone's height above the background kept: 1 - restDim at rest, 1 when lit.
        // During a dissolve the cells in the soft band dip, then come back.
        const k = row * columns + col;
        const gain = blend.active && blend.gain && k < blend.gain.length ? blend.gain[k] : 1;
        const keep = (1 - CONFIG.restDim * (1 - hoverLight((col + 0.5) * cellWidth, cy))) * gain;
        if (CONFIG.monochrome) {
          // The background is a neutral gray, so its red channel is also its gray level.
          tint[i] = tint[i + 1] = tint[i + 2] = floorR
            + (tone(luma(pixels, i), floorR) - floorR) * keep;
        } else {
          tint[i] = floorR + (tone(pixels[i], floorR) - floorR) * keep;
          tint[i + 1] = floorG + (tone(pixels[i + 1], floorG) - floorG) * keep;
          tint[i + 2] = floorB + (tone(pixels[i + 2], floorB) - floorB) * keep;
        }
        tint[i + 3] = pixels[i + 3];
      }
    }
    samplerCtx.putImageData(tintFrame, 0, 0);
  }

  /** Box blur of one row or column of `src` into `dst`, by running sums: any radius, same cost. */
  function blurLine(src, dst, start, step, length, radius) {
    let sum = 0;
    let count = Math.min(radius, length - 1) + 1;
    for (let k = 0; k < count; k++) sum += src[start + k * step];
    for (let k = 0; k < length; k++) {
      dst[start + k * step] = sum / count;
      if (k + radius + 1 < length) { sum += src[start + (k + radius + 1) * step]; count++; }
      if (k - radius >= 0) { sum -= src[start + (k - radius) * step]; count--; }
    }
  }

  /** Soft blur of a per-cell plane, in place: two box blurs, which come close to a gaussian. */
  function blurPlaneInPlace(plane, radius) {
    const { columns, rows } = grid;
    for (let pass = 0; pass < 2; pass++) {
      for (let row = 0; row < rows; row++) blurLine(plane, blurScratch, row * columns, 1, columns, radius);
      for (let col = 0; col < columns; col++) blurLine(blurScratch, plane, col, columns, rows, radius);
    }
  }

  function preparePlanes(cells) {
    if (lumaPlane && lumaPlane.length === cells) return;
    lumaPlane = new Float32Array(cells);
    blurPlane = new Float32Array(cells);
    blurScratch = new Float32Array(cells);
    sharpFrame = new Uint8ClampedArray(cells * 4);
  }

  /**
   * clarity: each cell's brightness pushed away from its neighbourhood's average (a wide unsharp
   * mask), so the edges between facets and around the outline stand out. Works on a copy.
   */
  function sharpen(pixels, clarityScale = 1) {
    const cells = pixels.length / 4;
    preparePlanes(cells);
    for (let k = 0, i = 0; k < cells; k++, i += 4) {
      lumaPlane[k] = blurPlane[k] = pixels[i + 3] < MIN_ALPHA ? 0 : luma(pixels, i);
    }
    blurPlaneInPlace(blurPlane, CLARITY_RADIUS);
    for (let k = 0, i = 0; k < cells; k++, i += 4) {
      const lift = (lumaPlane[k] - blurPlane[k]) * CONFIG.clarity * clarityScale;
      sharpFrame[i] = pixels[i] + lift;
      sharpFrame[i + 1] = pixels[i + 1] + lift;
      sharpFrame[i + 2] = pixels[i + 2] + lift;
      sharpFrame[i + 3] = pixels[i + 3];
    }
    return sharpFrame;
  }

  /** Paint each character with the colour (or gray) of the pixel it represents. */
  function colourGlyphs() {
    ctx.globalCompositeOperation = 'source-in'; // keeps colour only where a glyph was drawn
    ctx.drawImage(sampler, 0, 0, grid.width, grid.height);
    ctx.globalCompositeOperation = 'source-over';
  }

  let inRender = false;

  /** Cubic ease-in-out. The intro uses the same curve. */
  function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
  }

  function hashUnit(x, y, salt) {
    let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(salt, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1103515245);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function ensureStageBackground(layout) {
    if (!STAGE_BG || !layout) return;
    const { columns, rows } = layout;
    const n = columns * rows;
    if (bgPattern && bgPattern.length === n && bgCols === columns && bgRows === rows) return;
    bgPattern = new Uint8Array(n);
    bgChar = new Uint8Array(n);
    bgFlashStart = new Float32Array(n);
    const { seed, density } = STAGE_BG;
    for (let row = 0, k = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++, k++) {
        if (hashUnit(col, row, seed) >= density) continue;
        bgPattern[k] = 1;
        bgChar[k] = hashUnit(col, row, seed + 11) > 0.5 ? 1 : 0;
      }
    }
    bgCols = columns;
    bgRows = rows;
    lastBgTick = -Infinity;
  }

  function stageBackgroundFlashing(time) {
    if (!STAGE_BG || reduceMotion || !bgFlashStart) return false;
    const { fadeMs } = STAGE_BG;
    for (let k = 0; k < bgFlashStart.length; k++) {
      const start = bgFlashStart[k];
      if (start > 0 && time - start < fadeMs) return true;
    }
    return false;
  }

  function stageBackgroundDue(time) {
    if (!STAGE_BG || reduceMotion) return false;
    const interval = 1000 / STAGE_BG.fps;
    return time - lastBgTick >= interval - 2;
  }

  function tickStageBackground(time) {
    if (!STAGE_BG || reduceMotion || !bgPattern) return;
    const interval = 1000 / STAGE_BG.fps;
    if (time - lastBgTick < interval - 2) return;
    lastBgTick = time;
    const { flickerRate, fadeMs } = STAGE_BG;
    for (let k = 0; k < bgPattern.length; k++) {
      if (!bgPattern[k]) continue;
      if (Math.random() >= flickerRate) continue;
      bgChar[k] ^= 1;
      bgFlashStart[k] = time;
    }
    for (let k = 0; k < bgFlashStart.length; k++) {
      const start = bgFlashStart[k];
      if (start > 0 && time - start >= fadeMs) bgFlashStart[k] = 0;
    }
  }

  function drawStageBackground(pixels, time) {
    if (!STAGE_BG || !bgPattern || !grid) return;
    if (!reduceMotion) tickStageBackground(time);
    const { columns, rows, cellWidth, cellHeight, glyphX } = grid;
    const { seed, alphaMin, alphaMax, flashAlpha, fadeMs, edgeFalloff } = STAGE_BG;
    const cap = flashAlpha;
    const [glyphR, glyphG, glyphB] = stageGlyphRgb;
    ctx.globalCompositeOperation = 'source-over';
    for (let row = 0, k = 0, i = 0; row < rows; row++) {
      const y = (row + 0.5) * cellHeight;
      for (let col = 0; col < columns; col++, k++, i += 4) {
        if (!bgPattern[k] || crystalCoversCell(pixels, i)) continue;
        const nx = (col + 0.5) / columns;
        const ny = (row + 0.5) / rows;
        const dx = (nx - 0.5) * 2;
        const dy = (ny - 0.5) * 2;
        const r = Math.min(1, Math.hypot(dx, dy));
        const edge = Math.max(0, 1 - r ** edgeFalloff);
        if (edge <= 0) continue;
        let alpha = alphaMin + (alphaMax - alphaMin) * hashUnit(col, row, seed + 5);
        const flashStart = bgFlashStart[k];
        if (!reduceMotion && flashStart > 0) {
          const age = time - flashStart;
          if (age < fadeMs) {
            const t = 1 - age / fadeMs;
            alpha += (flashAlpha - alpha) * t;
          }
        }
        alpha = Math.min(cap, alpha * edge);
        if (alpha < 0.002) continue;
        const idx = bgChar[k];
        ctx.fillStyle = `rgb(${glyphR} ${glyphG} ${glyphB} / ${alpha})`;
        ctx.fillText(glyphs[idx], col * cellWidth + glyphX[idx], y);
      }
    }
    ctx.fillStyle = '#fff';
  }

  /** Threshold in [0, 1): low-frequency blobs, with a little per-cell break-up. */
  function clusteredThreshold(col, row, seed) {
    const scale = 4.5;
    const x = col / scale;
    const y = row / scale;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = (x - x0);
    const ty = (y - y0);
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const v00 = hashUnit(x0, y0, seed);
    const v10 = hashUnit(x0 + 1, y0, seed);
    const v01 = hashUnit(x0, y0 + 1, seed);
    const v11 = hashUnit(x0 + 1, y0 + 1, seed);
    const blob = (v00 + (v10 - v00) * sx) * (1 - sy) + (v01 + (v11 - v01) * sx) * sy;
    return blob * 0.84 + hashUnit(col, row, seed + 17) * 0.16;
  }

  function ensureThresholds() {
    const { columns, rows } = grid;
    const n = columns * rows;
    if (blend.thresholds && blend.thresholds.length === n && blend.cols === columns && blend.rows === rows) return;
    const values = new Float32Array(n);
    for (let row = 0, k = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++, k++) values[k] = clusteredThreshold(col, row, blend.seed);
    }
    blend.thresholds = values;
    blend.gain = new Float32Array(n);
    blend.gain.fill(1);
    blend.cols = columns;
    blend.rows = rows;
  }

  function ensureBlendOut(length) {
    if (!blend.out || blend.out.length !== length) blend.out = new Uint8ClampedArray(length);
    const cells = length / 4;
    if (!blend.gain || blend.gain.length !== cells) {
      blend.gain = new Float32Array(cells);
      blend.gain.fill(1);
    }
    return blend.out;
  }

  /**
   * Raw cells of the in-flight dissolve at `time`. Does not draw.
   * A frozen plate stands in for the outgoing picture when a fast scroll
   * retargets mid-blend, so the new dissolve starts from what is on screen.
   */
  function blendedRaw(time) {
    if (!grid) return null;
    const now = blend.heldAt || time;
    const rawT = Math.min(1, Math.max(0, (now - blend.start) / blend.duration));
    const t = blend.mode === 'fade' ? rawT : easeInOut(rawT);
    blend.rawT = rawT;
    blend.eased = t;

    const toPx = blend.toMedia ? sampleMedia(blend.toMedia, time) : null;
    let fromPx = blend.fromFrozen;
    if (!fromPx && blend.fromMedia) fromPx = sampleMedia(blend.fromMedia, time);

    if (!toPx) {
      if (blend.gain) blend.gain.fill(1);
      return fromPx ? new Uint8ClampedArray(fromPx) : null;
    }
    if (!fromPx || fromPx.length !== toPx.length) {
      if (blend.gain) blend.gain.fill(1);
      return new Uint8ClampedArray(toPx);
    }

    const dest = ensureBlendOut(toPx.length);
    const cells = toPx.length / 4;

    if (blend.mode === 'fade') {
      const inv = 1 - t;
      for (let i = 0; i < dest.length; i += 4) {
        dest[i] = fromPx[i] * inv + toPx[i] * t;
        dest[i + 1] = fromPx[i + 1] * inv + toPx[i + 1] * t;
        dest[i + 2] = fromPx[i + 2] * inv + toPx[i + 2] * t;
        dest[i + 3] = fromPx[i + 3] * inv + toPx[i + 3] * t;
      }
      blend.gain.fill(1);
      return dest;
    }

    ensureThresholds();
    const span = 1 - BLEND_BAND;
    const values = blend.thresholds;
    for (let k = 0, i = 0; k < cells; k++, i += 4) {
      // The band sits fully inside 0–1, so t = 0 is the old picture and t = 1
      // is the new one. Nothing is already halfway on the first frame.
      let m = (t - values[k] * span) / BLEND_BAND;
      if (m < 0) m = 0;
      else if (m > 1) m = 1;
      const inv = 1 - m;
      dest[i] = fromPx[i] * inv + toPx[i] * m;
      dest[i + 1] = fromPx[i + 1] * inv + toPx[i + 1] * m;
      dest[i + 2] = fromPx[i + 2] * inv + toPx[i + 2] * m;
      dest[i + 3] = fromPx[i + 3] * inv + toPx[i + 3] * m;
      blend.gain[k] = 1 - BLEND_DIP * Math.sin(m * Math.PI);
    }
    return dest;
  }

  /** Copy the blended cells, then advance the caption and release the old video. */
  function presentBlend(time) {
    const raw = blendedRaw(time);
    if (!raw) return null;
    const copy = new Uint8ClampedArray(raw);
    if (!blend.midSent && blend.eased >= 0.5) {
      blend.midSent = true;
      if (typeof blend.onMid === 'function') blend.onMid();
    }
    if (blend.rawT >= 1) finishBlend();
    return copy;
  }

  function finishBlend() {
    const next = blend.toMedia;
    const done = blend.onDone;
    const keptLevels = levels;
    blend.active = false;
    blend.fromMedia = null;
    blend.toMedia = null;
    blend.fromFrozen = null;
    blend.onMid = null;
    blend.onDone = null;
    blend.heldAt = 0;
    if (next && next !== media) bindTransport(next);
    levels = keptLevels;
    if (typeof done === 'function') done();
  }

  /** Freeze the clock while the section is off-screen so a return doesn't jump. */
  function syncBlendHold() {
    const hold = blend.active && (!drawing || !inView);
    if (hold) {
      if (!blend.heldAt) blend.heldAt = performance.now();
    } else if (blend.heldAt) {
      blend.start += performance.now() - blend.heldAt;
      blend.heldAt = 0;
      forceLook = true;
      schedule();
    }
  }

  /**
   * Dissolve from whatever is on screen into `nextMedia`. A blend already
   * running is sampled once and that plate becomes the outgoing picture,
   * so a fast scroll never queues and the canvas is never cleared.
   */
  function startBlend(nextMedia, options = {}) {
    if (!nextMedia) return;
    if (booting || !grid) {
      queuedBlend = { media: nextMedia, options };
      return;
    }
    if (blend.active && blend.toMedia === nextMedia) {
      blend.onMid = typeof options.onMid === 'function' ? options.onMid : null;
      blend.onDone = typeof options.onDone === 'function' ? options.onDone : null;
      return;
    }
    if (!blend.active && nextMedia === media) return;

    let frozen = null;
    if (blend.active) {
      const raw = blendedRaw(performance.now());
      if (raw) frozen = new Uint8ClampedArray(raw);
    }

    blend.fromFrozen = frozen;
    blend.fromMedia = frozen ? null : media;
    blend.toMedia = nextMedia;
    blend.start = performance.now();
    blend.duration = options.duration > 0 ? options.duration : 700;
    blend.mode = options.mode === 'fade' ? 'fade' : 'dissolve';
    blend.midSent = false;
    blend.rawT = 0;
    blend.eased = 0;
    blend.onMid = typeof options.onMid === 'function' ? options.onMid : null;
    blend.onDone = typeof options.onDone === 'function' ? options.onDone : null;
    blend.seed = (blend.seed + 1) | 0;
    blend.thresholds = null;
    blend.heldAt = 0;
    blend.active = true;
    queuedBlend = null;
    forceLook = true;
    syncBlendHold();
    schedule();
  }

  function flushQueuedBlend() {
    if (!queuedBlend || booting || !grid) return;
    const job = queuedBlend;
    queuedBlend = null;
    startBlend(job.media, job.options);
  }

  function render(time) {
    if (!grid || inRender) return;
    if (!media && !blend.active) return;
    inRender = true;
    try {
      if (!drawing) return;
      const pixels = blend.active ? presentBlend(time) : sampleFrame(time);
    // Skip an unchanged frame (e.g. a 30 fps video) — unless the hover is deforming it, or just
    // settled: on a still image or a paused video, the sampled pixels alone never show that, so
    // without this the last deformed frame would stay stuck after the cursor leaves.
    const hovering = CONFIG.hoverDeform && !intro && updateHover(time);
    const stageBg = STAGE_BG && (stageBackgroundDue(time) || stageBackgroundFlashing(time));
    if (!pixels || (!forceLook && !hovering && !hadHover && !stageBg && samePixels(pixels, lastPixels))) return;
    forceLook = false;
    hadHover = hovering;
    lastPixels = pixels;
    const shaded = CONFIG.clarity ? sharpen(pixels) : pixels;
    if (CONFIG.autoContrast) fitRampToFrame(shaded);
    tintSampler(shaded); // always: it also enforces the background floor
    drawGlyphs(shaded, time);
    colourGlyphs();
    drawLooseGlyphs();
    if (STAGE_BG) {
      ctx.globalCompositeOperation = 'destination-over';
      drawStageBackground(shaded, time);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (introStart === null) {
      introStart = time; // the gem is on screen (fading in, see style.css): the intro's clock starts
      clearTimeout(introTimeout);
    }
    hero.classList.add('is-ready');
    if (!readySent) {
      readySent = true;
      if (typeof CONFIG.onReady === 'function') CONFIG.onReady();
    }
    } finally {
      inRender = false;
    }
  }

  function samePixels(a, b) {
    if (!b || a.length !== b.length) return false;
    const x = new Uint32Array(a.buffer);
    const y = new Uint32Array(b.buffer);
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
    return true;
  }

  /* ------------------------------------------------------------------------
     Frame loop: runs only while something moves and the hero is on screen.
     A video is sampled when it presents a frame (24 fps here). rAF is the
     fallback, and the path a size or dim change takes.
     ------------------------------------------------------------------------ */

  function armVideoFrame() {
    if (!sampleOnVideoFrame || videoFrameId || !drawing || !inView || !media || media.paused || media.ended) return;
    try {
      videoFrameId = media.requestVideoFrameCallback(onVideoFrame);
    } catch {
      sampleOnVideoFrame = false;
      schedule();
    }
  }

  function disarmVideoFrame() {
    if (!videoFrameId || !media || typeof media.cancelVideoFrameCallback !== 'function') return;
    media.cancelVideoFrameCallback(videoFrameId);
    videoFrameId = 0;
  }

  function onVideoFrame() {
    videoFrameId = 0;
    if (!drawing || !inView || stopped || !media || media.paused) return;
    invalidate();
    armVideoFrame();
  }

  function frame(time) {
    frameRequest = 0;
    const animating = isAnimating();

    // 3 ms of slack absorbs timestamp jitter, so 60 Hz screens don't skip every other frame.
    if (renderPending || (animating && time - lastFrameTime >= FRAME_INTERVAL - 3)) {
      renderPending = false;
      lastFrameTime = time;
      try {
        render(time);
      } catch (error) {
        return fail(error); // e.g. SecurityError: pixels from another origin
      }
    }
    if (animating) schedule();
  }

  function schedule() {
    if (!frameRequest && !stopped) frameRequest = requestAnimationFrame(frame);
  }

  /** Redraw on the next frame, even if nothing is animating (resize, first frame). */
  function invalidate() {
    renderPending = true;
    schedule();
  }

  function isAnimating() {
    if (!drawing || !inView || stopped || toneHidesArt()) return false;
    if (STAGE_BG && !reduceMotion) {
      const now = performance.now();
      if (stageBackgroundDue(now) || stageBackgroundFlashing(now)) return true;
    }
    if (blend.active) return true;               // both videos, until the dissolve finishes
    if (intro) return true;                          // the old settle, off for the contact gem
    if (pointer || hover.strength > 0) return true; // the hover moves and settles, even over a still
    if (isVideo) return sampleOnVideoFrame ? false : !media.paused && !media.ended;
    return imageMotion;
  }

  /** Follow whichever video site.js is sampling. Listeners move with it. */
  function onMediaPlay() {
    if (sampleOnVideoFrame) armVideoFrame();
    else schedule();
  }

  function onMediaPause() {
    disarmVideoFrame();
  }

  let boundMedia = null;

  function bindTransport(next) {
    if (boundMedia === next) {
      if (isVideo && next && !next.paused) onMediaPlay();
      return;
    }
    if (boundMedia) {
      boundMedia.removeEventListener('play', onMediaPlay);
      boundMedia.removeEventListener('pause', onMediaPause);
      disarmVideoFrame();
      lastPixels = null;
      levels = null; // the next picture gets its own ramp, not the previous video's
    }
    media = next;
    boundMedia = next;
    if (!isVideo || !media) return;
    media.addEventListener('play', onMediaPlay);
    media.addEventListener('pause', onMediaPause);
    if (!media.paused) onMediaPlay();
  }

  /**
   * Swap the sampled video, its placement and its tone. Called every intro
   * frame for `subject`; the rest only when the picture changes. Before the
   * first sample, the call is kept and applied at the end of init.
   */
  function applyScene(scene) {
    if (scene.media) bindTransport(scene.media);
    if (scene.fit != null) CONFIG.fit = scene.fit;
    if (scene.mediaScale != null) CONFIG.mediaScale = scene.mediaScale;
    if (scene.focalPoint) CONFIG.focalPoint = scene.focalPoint;
    if ('narrow' in scene) CONFIG.narrow = scene.narrow;
    let tone = false;
    for (const key of ['brightness', 'contrast', 'midtones', 'highlights', 'shadows', 'clarity']) {
      if (scene[key] == null || scene[key] === CONFIG[key]) continue;
      CONFIG[key] = scene[key];
      if (key === 'contrast' || key === 'midtones') tone = true;
    }
    if (tone) refreshTone();
    if ('autoContrast' in scene && scene.autoContrast !== CONFIG.autoContrast) {
      CONFIG.autoContrast = scene.autoContrast;
      if (!scene.autoContrast) mapLumaToGlyphs(0, 255);
    }
    forceLook = true;
    invalidate();
  }

  /** True while the page's light tone has faded the art out (see site.js and style.css). */
  function toneHidesArt() {
    return document.documentElement.dataset.tone === 'light';
  }

  /* ------------------------------------------------------------------------
     Media
     ------------------------------------------------------------------------ */

  /** Create the hidden image/video element and resolve once its first frame can be drawn. */
  function loadMedia() {
    const element = document.createElement(isVideo ? 'video' : 'img');
    element.className = 'hero__source';
    element.setAttribute('aria-hidden', 'true');
    element.crossOrigin = 'anonymous'; // allows reading pixels from CORS-enabled URLs; set before src

    if (isVideo) {
      element.muted = true; // required for autoplay
      element.loop = true;
      element.playsInline = true;
      element.preload = 'auto';
    } else {
      element.alt = '';
    }

    // Kept in the page (visually hidden by CSS) so browsers keep decoding video frames.
    hero.append(element);

    return new Promise((resolve, reject) => {
      const onError = () =>
        reject(new Error(`Couldn't load the ${CONFIG.mediaType} "${CONFIG.mediaSource}".`));

      // 'loadeddata': the video's first frame is ready to draw.
      element.addEventListener(isVideo ? 'loadeddata' : 'load', () => resolve(element), { once: true });
      element.addEventListener('error', onError, { once: true });
      element.src = CONFIG.mediaSource;
    });
  }

  /**
   * The grain is plain CSS (see style.css); this just applies its config as a CSS
   * variable and toggles the class. The cursor deformation is tracked here instead,
   * rAF-throttled, and handed to the render loop as the `pointer` module variable.
   */
  function setupEffects() {
    // Only on devices with a real pointer: a touch's last tap position would otherwise stick.
    if (!CONFIG.hoverDeform || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    let queued = null;
    let pointerFrame = 0;
    function applyPointer() {
      pointerFrame = 0;
      if (!queued) return;
      pointer = queued;
      queued = null;
      invalidate(); // draws even over a still image, where nothing else would trigger a frame
    }

    hero.addEventListener('pointermove', (event) => {
      const rect = hero.getBoundingClientRect();
      queued = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      if (!pointerFrame) pointerFrame = requestAnimationFrame(applyPointer);
    }, { passive: true });
    hero.addEventListener('pointerleave', () => {
      pointer = null;
      invalidate(); // one final redraw so the deformation doesn't stick after the cursor leaves
    });
  }

  function playVideo() {
    media.play().catch((error) => {
      // Autoplay refused (e.g. Low Power Mode): keep the still frame, retry on the first tap.
      if (error.name === 'NotAllowedError') {
        window.addEventListener('pointerdown', playVideo, { once: true });
      }
    });
  }

  /* ------------------------------------------------------------------------
     Setup
     ------------------------------------------------------------------------ */

  /** Re-measure when the window moves to a screen with a different pixel density. */
  function watchPixelRatio() {
    window
      .matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
      .addEventListener('change', () => {
        grid = measureGrid();
        invalidate();
        watchPixelRatio();
      }, { once: true });
  }

  function fail(error) {
    stopped = true;
    skipIntro();
    let hint = `Check that "${CONFIG.mediaSource}" exists and is ${isVideo ? 'a video' : 'an image'} the browser can open.`;
    if (location.protocol === 'file:') {
      hint = 'Browsers block reading pixels on file:// pages. Serve the folder instead, e.g. `npx serve`.';
    } else if (error.name === 'SecurityError') {
      hint = 'The media is on another domain that does not allow it (no CORS headers). Use a local file or a CORS-enabled URL.';
    }
    console.error(`[ASCII hero] ${error.message}\n${hint}`);
  }

  async function init() {
    setupEffects();
    if (intro) introTimeout = setTimeout(skipIntro, CONFIG.intro.timeout);
    if (reduceMotion && !CONFIG.quiet) console.info('[ASCII hero] Reduced motion is on, so the art is shown as a still frame.');

    try {
      // Canvas text doesn't wait for web fonts; load the face before measuring glyphs.
      await document.fonts.load(`${CONFIG.fontSize}px ${CONFIG.fontFamily}`);
    } catch {
      // Unparseable font string: the browser's default monospace is used instead.
    }

    try {
      // Option 3 samples the hero's visible video, so one decode feeds the picture and the ASCII.
      if (CONFIG.mediaElement) {
        media = CONFIG.mediaElement;
        if (media instanceof HTMLCanvasElement) {
          if (media.width < 1 || media.height < 1) {
            throw new Error('The field canvas has no pixels.');
          }
        } else if (media.error) {
          throw new Error(`Couldn't load the ${CONFIG.mediaType} "${CONFIG.mediaSource}".`);
        } else if ((media.readyState || 0) < 2) {
          await new Promise((resolve, reject) => {
            media.addEventListener('loadeddata', () => resolve(), { once: true });
            media.addEventListener('error', () => {
              reject(new Error(`Couldn't load the ${CONFIG.mediaType} "${CONFIG.mediaSource}".`));
            }, { once: true });
          });
        }
      } else {
        media = await loadMedia();
      }
    } catch (error) {
      const fallback = queuedScene && queuedScene.media;
      if (!fallback) return fail(error);
      // The gem failed after site.js had already asked for the eye. Keep the
      // renderer: the intro still has to sample the film.
      media = fallback;
      if (media.readyState < 2) {
        try {
          await new Promise((resolve, reject) => {
            media.addEventListener('loadeddata', () => resolve(), { once: true });
            media.addEventListener('error', () => reject(error), { once: true });
          });
        } catch (again) {
          return fail(again);
        }
      }
    }

    // The first callback fires right away and does the initial layout and render.
    new ResizeObserver(() => {
      grid = measureGrid();
      invalidate();
      flushQueuedBlend();
    }).observe(hero);

    // Off-screen, or faded out by the light tone: no sampling, no drawing, no video decoding.
    function updatePlayback() {
      // The page's own video: site.js plays and pauses it. Pausing here would
      // freeze the picture while it is still meant to be playing.
      if (!CONFIG.mediaElement && isVideo && !reduceMotion) {
        if (inView && !toneHidesArt()) playVideo();
        else media.pause();
      }
      if (drawing) schedule();
    }
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (!inView) skipIntro(); // a safety net: index.html starts the intro at the top
      syncBlendHold();
      updatePlayback();
    }).observe(hero);
    new MutationObserver(updatePlayback).observe(document.documentElement, { attributeFilter: ['data-tone'] });

    bindTransport(media);
    booting = false;
    if (queuedScene) {
      const next = queuedScene;
      queuedScene = null;
      applyScene(next);
    }
    flushQueuedBlend();
    watchPixelRatio();
  }

  const api = {
    /** Sample and draw, or stop and clear. Off while the picture is still the video, and once it has gone dark. */
    setDrawing(on) {
      if (drawing === on) return;
      drawing = on;
      if (!on) {
        disarmVideoFrame();
        // Services keeps the last frame so coming back isn't an empty canvas.
        if (!CONFIG.keepFrame && grid) ctx.clearRect(0, 0, grid.width, grid.height);
        lastPixels = null;
        syncBlendHold();
        return;
      }
      forceLook = true;
      invalidate();
      armVideoFrame();
      syncBlendHold();
    },

    /** Glyph size in px. Half-pixel steps: the dissolve retunes this as the cells grow.
        The draw waits for the next frame, so a burst of sizes costs one sample. */
    setFontSize(px) {
      const next = Math.round(px * 2) / 2;
      if (Math.abs(next - CONFIG.fontSize) < 0.01) return;
      CONFIG.fontSize = next;
      if (!media) return;
      grid = measureGrid();
      if (!drawing || !grid) return;
      forceLook = true;
      invalidate();
    },

    /**
     * Pull the characters toward the background. 0 = the colour pass as tuned,
     * 1 = the same colour as --hero-bg, so the art disappears into it.
     */
    setRestDim(value) {
      if (Math.abs(value - CONFIG.restDim) < 0.002) return;
      CONFIG.restDim = value;
      if (!drawing || !grid) return;
      forceLook = true;
      invalidate();
    },

    /** Swap the sampled picture: media, fit, and tone. */
    setScene(scene) {
      if (booting) {
        queuedScene = Object.assign(queuedScene || {}, scene);
        return;
      }
      applyScene(scene);
    },

    /** Paint now, so the canvas matches the film before the browser paints. */
    redraw() {
      if (inRender || !drawing || !grid || (!media && !blend.active)) return;
      forceLook = true;
      try {
        render(performance.now());
      } catch (error) {
        fail(error);
      }
    },

    /**
     * Crossfade into `nextMedia` on this same canvas. `mode: 'fade'` is a flat
     * opacity mix (reduced motion); the default dissolves cell by cell.
     * Retargeting mid-way continues from the current blend. `onMid` fires
     * once eased progress passes one half.
     */
    startBlend,
  };

  init();
  return api;
}

