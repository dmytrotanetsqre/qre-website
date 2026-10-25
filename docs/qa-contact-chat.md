# QA: Option 3 Contact (ASCII blob) and chat drawer (P5)

Date: 2026-10-25. Branch `claude/contact-chat-plan-runner-q7ey1y`, tested at `contact-p4` (b807bbe), base df5ce8d.
Method: `python3 -m http.server 4180` at the repo root, Playwright Chromium (headless) on `http://localhost:4180/option-3/` at 1440×900, 1024×768, 390×844 and 1440×900 with `reducedMotion: 'reduce'`; intro skipped with a key press. Draw activity was measured by counting `fillText` / `putImageData` calls on `canvas.cta__art`; the blob video was found by wrapping `HTMLMediaElement.play`. ffmpeg / ffprobe for the video. Nothing in the site was changed.

Screenshots (`docs/screens/p5/`): `contact-1440.png`, `contact-1024.png`, `contact-390.png`, `contact-reduced.png`, `chat-summary-1440.png`, `chat-390.png`.

**Totals: 48 PASS, 1 FAIL (#16), 5 NOT CHECKED (#26, #27, #52, #53, #54).**

## Repository and process

| # | Check | Result | Note |
| --- | --- | --- | --- |
| 1 | Commits P0 to P4 and tags `contact-p0` to `contact-p4` | PASS | 5 commits since df5ce8d, each starts with its step id; all 5 tags exist. |
| 2 | `git diff --stat df5ce8d..HEAD` touches only allowed paths | PASS | Only `option-3/`, `assets/contact-blob.mp4` (added), `docs/`, `tools/`, `CLAUDE.md`. Option 1 root, `option-2/`, `option-2-cursor-reel/`, `_snapshots/` untouched. |
| 3 | `cta-rain.js` and `cta-q.js` still exist, not loaded | PASS | Both files present; `index.html` has only comments for them; no request for either at any width. |
| 4 | All URLs relative | PASS | No root-absolute `src`/`href`/`url()` in `option-3/` files; every local request at all widths is under `/option-3/` or `/assets/`. |
| 5 | No em dashes in new user-facing copy | PASS | Contact and chat copy have none (only in code comments; the page `<title>` dash predates this branch). |
| 6 | Old form and its code removed | PASS | No `input`/`.field`/`.consent`/`.drawer__form` in the dialog; no `wireConsultationForm`, `ctaForm`, `ctaDone`, `focusCtaEmail`, `data-contact-reset`; no orphan `.cta__rain/inner/stage/content/form/done/lead` or `.field*`/`.consent*` CSS. |
| 7 | `CLAUDE.md` describes the new Contact and chat | PASS | Contact paragraph and file list updated. Note: it says the art is "mounted when the section comes within one viewport", which the code does not do (see #16), and lists v1's `mediaScale` 1 / 1.6 before P3's 1.4 / 2. |

## Contact section (P1, P3)

| # | Check | Result | Note |
| --- | --- | --- | --- |
| 8 | v1 markup at all 4 runs | PASS | `.cta__backdrop > canvas.cta__art`, kicker "Ready to scale with AI?", "Let’s build intelligent systems together.", one button "Chat with us" (A-01) with `data-drawer-open="consultation"`; no form, no lead line. |
| 9 | Heading and button centred | PASS | Both centred in the content box at 1440, 1024, 390 (the 7.5 px offset from `innerWidth/2` is half the 15 px scrollbar). |
| 10 | Option 3 look, v1 layout | PASS | Inter, `text-transform: none`, button radius 999px; title 64 px at 1440, kicker runs on, button full width at 390, as in the snapshot CSS. |
| 11 | Section ≥ 100svh, `z-index: 4` | PASS | Height equals the viewport at all widths. |
| 12 | Slides over the last work case (1440, 1024, 390) | PASS | `margin-top: -100svh`; last case is `position: sticky`; with Contact's top at mid-screen, the upper half shows the last case and the lower half Contact. |
| 13 | Reduced motion resets the overlap | PASS | `margin-top: 0`, last case `position: relative`, as the plan says to keep. |
| 14 | Art = `asciiArt` with v1 settings and the blob | PASS | Source `../assets/contact-blob.mp4`, playing, `loop` on; brightness 0.62 × 0.6, `playIntro: false`, `mediaScale` 1.4 / `narrow.mediaScale` 2; hover deform and `restDim` left at CONFIG defaults (true / 0.45, same as v1) by code read; hover itself not exercised in the browser. |
| 15 | Art and blob pause off-screen (all 4 runs) | PASS | In view: about 1600 to 1900 draw calls a second; at the page top: 0 draw calls in 1.5 s and the blob video `paused: true`. |
| 16 | Art mounts lazily, within one viewport of the section | **FAIL** | `contact-blob.mp4` is requested about 140 ms after load while `#contact` is about 10 300 px below the viewport. Steps below. |
| 17 | Reduced motion: one still frame | PASS | Video never played; canvas drawn once (64 `fillText` calls, about 455 000 non-transparent pixels); see `contact-reduced.png`. |
| 18 | Nav "Contact" and hero "Book a consultation" (A-02) | PASS | Smooth-scroll to `#contact` (top within 1 px), focus lands on the Contact button, chat stays closed. At 390 only the hero button was tested (see #52). |
| 19 | Console on a full scroll (4 runs) | PASS | No errors or warnings. |
| 20 | Failed requests on a full scroll (4 runs) | PASS | None (36 to 41 requests per run). |
| 21 | Contact button opens the chat | PASS | Opens `dialog#consultation`. |

### FAIL #16: Contact art is not lazy

Steps:
1. Serve the repo root (`python3 -m http.server 4180`), open `http://localhost:4180/option-3/` at 1440×900 with DevTools Network filtered to `contact-blob`.
2. Do not scroll. `contact-blob.mp4` is requested about 140 ms after navigation (during the intro), with `document.getElementById('contact').getBoundingClientRect().top` ≈ 10 341.

Expected (P1 step 3): mount only once the section is within one viewport. Cause: in `option-3/site.js` 6b the mount observer is `new IntersectionObserver(([entry]) => { if (entry) mountCtaArt(); }, { rootMargin: '100% 0px' })`; an IntersectionObserver calls back once on `observe()` for every target, intersecting or not, so `if (entry)` is always true. It needs `entry.isIntersecting`. Impact today is small: drawing stays off until the section is on screen (#15) and the file is 60 KB, but the `asciiArt` instance and the video download start at load, competing with the hero film, and a larger replacement video would cost more.
Screenshot: none (nothing visible; it is a network-timing fault).

## Blob video (P2)

| # | Check | Result | Note |
| --- | --- | --- | --- |
| 22 | Format and size | PASS | `assets/contact-blob.mp4`: H.264, yuv420p, 640×484, 30 fps, 240 frames, 8.0 s, 60 827 bytes (well under 4 MB). |
| 23 | Seamless loop (frame 0 vs last) | PASS | Frame 0 vs 239: SSIM 0.9916, PSNR 42.5 dB; neighbouring frames 0 vs 1: SSIM 0.9972, PSNR 44.6 dB; 238 vs 239: 0.9986, 45.4 dB. The wrap step is in the range of a normal frame step (slightly larger, likely the keyframe). |
| 24 | Plays in Chromium | PASS | Plays and loops on the page (`paused: false`, `loop: true`). |
| 25 | `blob.js`, `blob-lab.html`, `tools/render-blob.mjs`, `docs/blob.md` | PASS | All present. Lab loads with 2 canvases, 7 sliders, Pause / Copy params / Reset; no errors; 4 "GPU stall due to ReadPixels" warnings, already recorded in open questions (P2). |
| 26 | `tools/render-blob.mjs` re-renders the video | NOT CHECKED | Not run (it would overwrite the asset). |
| 27 | Orb look (calm, premium) and size versus the v1 gem | NOT CHECKED | Judgement call; see `contact-1440.png`. No side-by-side with the v1 gem was made (also noted in open questions, P3). |

## Chat drawer (P4)

| # | Check | Result | Note |
| --- | --- | --- | --- |
| 28 | Header "Get in touch" (A-03) opens the chat | PASS | One `dialog` on the page; `is-open` set. |
| 29 | Chat header | PASS | Avatar `../assets/icons/qre-logo.svg` (A-06), "QRE assistant", "AI" label, close button; Start over hidden until the first answer, then shown. |
| 30 | Message list ARIA | PASS | `role="log"`, `aria-live="polite"`. |
| 31 | Typing indicator and word reveal | PASS | 3 animated dots, then words revealed one by one (26 pending at reveal); observed typing time 470 ms from the open click (it starts before the click handler returns, so this is a lower bound of the 500 ms minimum). |
| 32 | Greeting copy and chips exact | PASS | Matches the scenario word for word; 7 chips in order. |
| 33 | Chip sends its text, chips removed | PASS | User bubble "Website"; chips gone. |
| 34 | Send button | PASS | Round (50%), disabled while empty and while the assistant is typing (even with text). |
| 35 | Enter / Shift+Enter / auto-grow | PASS | Shift+Enter inserts a newline and sends nothing; 36 px at 1 line, 60 px at 2, capped at 108 px (4 × 24 px) with scrolling. |
| 36 | Chip path to the end, all step copy | PASS | details, stage, timeline, budget, name, email copy and chips match. `{service}` is lowered ("Great, website is…"; "AI agent" kept), a documented P4 choice. |
| 37 | Summary | PASS | "Thanks. Here’s what I’ll pass to the team:" (name skipped), rows Project / Details / Stage / Start / Budget / E-mail with the right values, "We’ll get back to you within 24 hours to set up a call.", chip Start over. See `chat-summary-1440.png`. |
| 38 | Lead logged once, no network | PASS | One `console.info('[QRE chat] lead', …)`; 0 requests during a full chip run. |
| 39 | Fully typed path | PASS | "I need a website for my bakery" → Website; typed stage / timeline / budget matched chips; "Anna Smith, Acme Bakery" → "Thanks, Anna Smith."; summary rows filled from the typed answers. |
| 40 | Bad e-mail then good | PASS | "not-an-email" gets the scenario's re-ask; "jane@example.com" accepted. Note: "anna@acme" (no dot) is accepted, as the old `type=email` check did (open questions, P4). |
| 41 | FAQ in the middle | PASS | Pricing on stage, timeline on timeline, "Are you a bot?" on budget: exact answer, then the step's question again with its chips. A FAQ after the summary is answered too. |
| 42 | Close and reopen keeps the chat | PASS | 20 messages before and after; reopened from the Contact button; focus on the first chip ("Skip"). |
| 43 | Start over | PASS | Header button and end chip both clear the log to the greeting; header button hidden again. |
| 44 | Esc, backdrop click, focus return | PASS | Both close; focus returns to "Get in touch". |
| 45 | Keyboard only | PASS | Tab to "Get in touch", Enter opens (focus in textarea), Shift+Tab to "AI agent", Enter; focus moves to "Not sure yet", Enter; then to "Just an idea". Tab stays inside the open dialog. |
| 46 | Focus on first open | PASS | Textarea (the greeting chips are not rendered yet at that moment, so "or the first chip" applies only on reopen). |
| 47 | Reduced motion | PASS | Dots not animated (`animation-name: none`), 296 ms pause, whole message at once. |
| 48 | 390×844 full screen | PASS | Panel 0,0,390×844; textarea at 739 to 775 px, send button inside; see `chat-390.png`. |
| 49 | 1024×768 | PASS | Panel 560 px wide from the right edge, full height, input visible. |
| 50 | Consent line (A-05) | PASS | "By chatting you agree to our Terms of Service and Privacy Policy.", both links without `href`. |
| 51 | Look and console | PASS | Inter, no uppercase anywhere in the dialog, chips are 999px pills; no console errors or warnings in any chat run (1440, typed, keyboard, reduced, 390, 1024). |

## Not checked

| # | Check | Result | Note |
| --- | --- | --- | --- |
| 52 | Nav "Contact" at 390 | NOT CHECKED | The nav is behind the Menu toggle at this width; the menu was not opened. |
| 53 | Phone on-screen keyboard over the composer | NOT CHECKED | Needs a real device (iOS `dvh` behaviour). |
| 54 | Screen reader announcements | NOT CHECKED | Only DOM / ARIA checked (#30). |

(NOT CHECKED total: #26, #27, #52, #53, #54.)
