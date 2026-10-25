# Plan: Option 3 Contact with an ASCII blob and an AI chat drawer

Owner: Dmytro Tanets. Written 2026-10-25. Steps P0 to P5 run in order, one subagent each (see RUNNER at the end).
The Russian overview of this plan lives in Dima's Claude doc; this file is what the agents read.

## Decisions (already made, do not reopen)

1. Option 3 only (`option-3/`). The Contact section (`section.cta#contact`) goes back to the v1 layout: centred heading plus one button over an ASCII art. Source of v1: `_snapshots/option-1-dark-2026-10-22/` (read-only reference).
2. The on-page form is removed. The 0/1 rain (`option-3/cta-rain.js`) and the 3D Q (`option-3/cta-q.js`) are switched off but the files stay in the repo (parked).
3. The ASCII art shows an animated blob (a voice-assistant style orb) instead of the crystal. It is a looping video, `assets/contact-blob.mp4`, made the same way as the service crystals (640×484, black background) and drawn by the existing `asciiArt()` renderer in `option-3/script.js`. Dima may later replace that one file with his own video, so nothing may depend on the video's content.
4. The button opens a side drawer with a scripted "AI" chat that replaces the consultation form. No backend, no real model: the conversation follows the scenario below. The header "Get in touch" button opens the same chat. The old form drawer is removed.

## Rules for every step

- Read `CLAUDE.md` and `docs/PROJECT_LOG.md` first. Follow CLAUDE.md. Touch only `option-3/`, new files under `assets/`, `docs/`, `tools/` and `CLAUDE.md`. Never edit Option 1 (project root files), `option-2/`, `option-2-cursor-reel/` or `_snapshots/`.
- The site is static and is served by GitHub Pages under a sub-path (`https://dmytrotanetsqre.github.io/qre-website/`). Keep every URL relative (`../assets/...`), never root-absolute (`/assets/...`).
- Option 3 look: Inter / Inter Display, normal sentence case, no `text-transform: uppercase`, pill buttons, existing CSS custom properties only (no new hard-coded colours unless you add them as tokens next to the existing ones). Geist Mono only inside ASCII canvases.
- No long dashes (em dashes) in any user-facing copy you write.
- Check your work visually before you report: serve the repo root with `python3 -m http.server 4180` and open `http://localhost:4180/option-3/` with Playwright (Chromium is preinstalled; `require('playwright')` works, do not run `playwright install`). The hero intro locks the page for about 3 s; press any key or click to skip it. Take screenshots at 1440×900, 1024×768 and 390×844, and one with `reducedMotion: 'reduce'`. Save at most 6 PNGs per step in `docs/screens/<step>/` (for example `docs/screens/p1/1440.png`). Read the browser console: no new errors or warnings.
- Do not invent facts about the code. If you did not check something, say so. If a check is impossible here, say what you could not check.
- Unattended: nobody can answer questions. Where you would ask, take the most reasonable option, do the rest, and add an entry to `docs/open-questions.md` (step, question, what you chose, why). Never stop the step for a question.
- Finish every step with: update the Contact/Option 3 parts of `CLAUDE.md` that your step changed; add a journal entry to `docs/PROJECT_LOG.md` (in Russian, 3 to 6 lines: what changed, files, anything left open); one or more commits whose messages start with the step id (`P1: ...`); then `git tag contact-p<N>`.
- Commit author: use the git identity already configured in the session; do not change it.

---

## P0. Sync CLAUDE.md and set up the log (sonnet, low)

Do not change any site code in this step.

1. `CLAUDE.md`, Option 3 entry: it still says the Contact section draws the 3D logo Q (`cta-q.js`). The code is newer: `option-3/index.html` loads `cta-rain.js` (a full-section 0/1 rain behind the heading and an on-page form) and has the Q commented out as parked. Read `option-3/index.html`, `option-3/cta-rain.js`, `option-3/cta-q.js` and the `.cta` rules in `option-3/style.css`, then rewrite the Option 3 "Contact" paragraph so it describes what the code does now. Also add the files missing from the Option 3 file list (`cta-rain.js`, the favicons, `media/work/video/`).
2. Add a short "Workflow" section to `CLAUDE.md`: the GitHub repo `dmytrotanetsqre/qre-website` is the source of truth; the site is published by GitHub Pages from `main` at `https://dmytrotanetsqre.github.io/qre-website/`; paths must stay relative; work happens in cloud sessions on branches merged through PRs; each step is logged in `docs/PROJECT_LOG.md`.
3. Create `docs/PROJECT_LOG.md` (Russian) with: a status table of P0 to P5 (`не начат` / `готово` / `частично`), the assumptions A-01 to A-08 copied from the "Assumptions" section of this file (status `принято без подтверждения`), and an empty "Журнал" section, newest entry first.
4. Create `docs/open-questions.md` with a one-line header and nothing else.

---

## P1. Contact back to the v1 layout (sonnet, medium)

Reference (read, do not edit): `_snapshots/option-1-dark-2026-10-22/index.html` (the `section.cta#contact` block near line 390), `_snapshots/option-1-dark-2026-10-22/style.css` (`.cta*` rules around lines 569, 925 to 1000 and 1658) and the last call at the end of `_snapshots/option-1-dark-2026-10-22/script.js`: `asciiArt(document.querySelector('.cta'), { brightness: 0.62 * 0.6, playIntro: false, mediaScale: 1, focalPoint: { x: 0.5, y: 0.5 }, narrow: { query: '(max-width: 768px)', mediaScale: 1.6, focalPoint: { x: 0.5, y: 0.5 } } })`.

1. In `option-3/index.html`, replace the current Contact markup with the v1 structure: `.cta__backdrop` holding `canvas.cta__art`, `h2.cta__title` with `span.cta__kicker` ("Ready to scale with AI?") and the line "Let’s build intelligent systems together.", and one button `button button--primary cta__button` with `data-drawer-open="consultation"` and the label "Chat with us" (assumption A-01). Remove the on-page form, its thank-you block and the lead line. Remove the `<script type="module" src="cta-rain.js">` include and leave an HTML comment saying the rain is parked in `cta-rain.js` (keep the existing parked-Q comment). Do not delete `cta-rain.js` or `cta-q.js`.
2. Styles in `option-3/style.css`: port the v1 Contact layout (centred heading and button, art behind them fading towards the section edges) in Option 3 type and tokens. Keep what Option 3's `.cta` already does that v1 did not: `min-height: 100svh`, `z-index: 4`, `margin-top: -100svh` so the section still slides over the last work case (`.work__pin`), and the reduced-motion / narrow overrides that reset that margin. Remove rules that only styled removed elements (`.cta__rain`, `.cta__inner`, `.cta__stage`, `.cta__content`, `.cta__form`, `.cta__done`, `.cta__lead`, and anything else that no longer matches an element). Do not remove `.drawer*`, `.field*`, `.consent*` rules: the drawer still uses them until P4.
3. Art: mount `asciiArt` from `option-3/script.js` on the `.cta` section with the v1 overrides above and `mediaSource: '../assets/hero-gem.mp4'` as a placeholder (P3 swaps in the blob). Option 3's `asciiArt` has more CONFIG keys than v1's; read its CONFIG block and the services mount in `option-3/site.js` (search `asciiArt(crystalHost`) and keep v1 behaviour: hover deform on, no intro, `restDim` as v1 had it (check the snapshot's CONFIG default). Start it lazily when the section comes within one viewport and keep it paused while the section is off-screen (the services crystal already does this with `draw`; reuse the same approach). Reduced motion: one still frame.
4. `option-3/site.js`: remove the on-page CTA form wiring (`ctaForm`, `ctaDone`, `data-contact-reset`, `focusCtaEmail`). Links to `#contact` (hero "Book a consultation", nav "Contact") still smooth-scroll to the section, then move focus to the CTA button without scrolling again. Leave the drawer code as it is (P4 rewrites it). Remove `option-3/cta-rain.js` from any JS that imports it, if any.
5. Check: Contact at the three widths and with reduced motion; the button opens the existing drawer; the section still slides over the last work case; the art pauses off-screen (log or inspect that its frame loop stops); no console errors.

---

## P2. Make the blob video (opus, high)

Goal: `assets/contact-blob.mp4`, a seamless looping video of a voice-assistant style orb, in the same format as the service crystals so the ASCII renderer reads it well. Also a lab page to tune it and a script to re-render it. Do not wire it into the Contact section (P3 does that).

1. Study the reference first: extract a few frames of `assets/services/video/ai-agents.mp4` and `assets/hero-gem.mp4` with ffmpeg and note their size, fps, how much of the frame the object fills, and the brightness range (the black background must stay black). Match those.
2. Look of the blob: one soft sphere whose surface slowly undulates (smooth low-frequency 3D noise displacing the vertices, two or three slow wave layers), a gentle breathing scale (about ±4 %), soft rim light (fresnel) and a bright inner glow towards one side, so the brightness runs from near black at the edges to near white in the highlights. Monochrome (greys on black); the ASCII renderer colours it. Calm, premium, not bubbly or cartoonish. It fills about 60 to 70 % of the frame height, centred.
3. Build it with Three.js from `option-3/vendor/three.module.js` (r170). Write the shaders yourself. You may use Stefan Gustavson / Ashima "webgl-noise" simplex noise (MIT): keep its license header in the file. No other third-party code, images or downloaded assets.
4. Seamless loop: all motion must be periodic over the loop length (8 s at 30 fps = 240 frames). Drive the noise with time mapped onto a circle (for example 4D noise with `cos`/`sin` of the loop phase) so frame 240 equals frame 0. Verify by comparing frame 0 and frame 239 visually and with an ffmpeg PSNR/SSIM check; the jump must not be visible.
5. Files:
   - `option-3/blob.js`: an ES module `createBlob(canvas, params)` that renders the orb and exposes `renderAt(seconds)` for deterministic frames plus a normal animated mode.
   - `option-3/blob-lab.html`: a lab page like `crystal-lab.html`: the orb with sliders for its main parameters (noise amount, noise scale, speed, rim, glow, size), a "copy params" button that prints a JSON object, and a second view that runs the current orb through `asciiArt()` from `option-3/script.js` so the ASCII result can be judged live.
   - `tools/render-blob.mjs`: Node + Playwright script that opens the lab page from a local server with fixed params, renders the 240 frames deterministically with `renderAt` (no real-time capture), saves PNGs to a temp folder outside the repo, and encodes `assets/contact-blob.mp4` with ffmpeg: H.264, `yuv420p`, 640×484, 30 fps, no audio, `-preset veryfast -crf 20 -movflags +faststart`. If ffmpeg is missing, install it (apt or the `ffmpeg-static` npm package in a temp folder) and say which.
   - `docs/blob.md` (English, short): how to re-render, the params used, and how Dima can replace the video with his own (same name, 640×484 or same aspect, black background, seamless loop, H.264 mp4, under about 4 MB).
6. Check: the mp4 plays in Chromium, loops without a visible jump, size under about 4 MB; screenshots of the lab's plain view and ASCII view in `docs/screens/p2/`.

---

## P3. Use the blob in Contact (haiku, low)

1. In the Contact `asciiArt` mount added in P1 (`option-3/site.js` or wherever P1 put it), change `mediaSource` from `../assets/hero-gem.mp4` to `../assets/contact-blob.mp4`.
2. Tune only `mediaScale` / `narrow.mediaScale` / `brightness` so the blob sits behind the heading about as large as the gem did in v1 and the heading stays readable at all three widths. Do not touch the renderer.
3. Screenshots and a short note in the log with the final values.

---

## P4. AI chat drawer instead of the form (opus, high)

Replace the consultation form in `dialog#consultation` with a scripted chat. Keep the dialog element, its id, the slide-in panel, its open/close animation, Esc, backdrop click and the full-screen behaviour on phones from `option-3/site.js` and `option-3/style.css`. Both triggers (`data-drawer-open="consultation"`: header "Get in touch" and the Contact button) open it.

1. Layout inside the panel: a header (QRE mark as the assistant avatar from `../assets/icons/qre-logo.svg`, name "QRE assistant", a small "AI" label, close button, and a "Start over" text button that appears once the conversation has started); the message list; the input row at the bottom. The message list is `role="log"` with `aria-live="polite"`.
2. Messages: assistant messages left without a bubble fill or with a subtle one, user messages right in a filled bubble; use existing tokens only. Before each assistant message show a typing indicator (three dots) for 500 to 1200 ms depending on length, then reveal the text word by word (about 35 ms a word). With reduced motion: no dot animation, no word reveal, a fixed 300 ms pause.
3. Input: an auto-growing textarea (1 to 4 lines), Enter sends, Shift+Enter makes a new line, a round send button that is disabled while empty or while the assistant is typing. Quick-reply chips appear under the latest assistant message when its step has them; clicking a chip sends its text as the user's message and removes the chips. Users can always type instead of using chips.
4. Logic lives in `option-3/chat.js`; all copy lives in `option-3/chat-script.js` as plain data (steps with id, assistant text with `{name}`-style placeholders, chips, what free text the step accepts, next step). Implement the scenario in "Chat scenario" below exactly; do not add steps or copy.
   - Chip steps accept any typed text: match it to a chip case-insensitively by keywords, otherwise keep it as the user's own answer.
   - The e-mail step validates the address with the same pattern `wireConsultationForm` uses; on a bad address the assistant asks again (copy in the scenario).
   - Any time the user types a message matching one of the FAQ intents in the scenario (pricing, timeline, who you are), the assistant answers that FAQ first and then repeats the current step's question.
5. State: the conversation stays while the page is open (closing and reopening the drawer keeps it); a reload starts fresh. "Start over" clears it. On open, focus goes to the textarea, or the first chip if the step has chips. At the end, log the collected lead once with `console.info('[QRE chat] lead', lead)`; there is no network request.
6. Under the input, one small muted line: "By chatting you agree to our Terms of Service and Privacy Policy." with the two phrases as links without `href`, like the old consent text (assumption A-05).
7. Remove what the chat replaces: the drawer form markup and thank-you block, `wireConsultationForm` and its calls, and `.field*` / `.consent*` / `.drawer__form` / `.drawer__fields` / `.drawer__done` CSS if nothing else uses them (grep first).
8. Check with Playwright: the chip path to the end, a fully typed path, a bad e-mail then a good one, a FAQ question in the middle, close and reopen keeps the chat, "Start over", Esc closes, reduced motion, 390×844 full screen with the textarea visible, keyboard only (Tab to chips, Enter on a chip). Screenshots of the start, the middle, the summary, and the 390 view.

---

## P5. Independent QA (opus, medium)

You did not build any of this. Do not fix anything; only test and report.

1. Read this plan, `docs/PROJECT_LOG.md`, `docs/open-questions.md` and `git log --oneline` since the tag before P0 (or the first commit of this branch).
2. Check every requirement of P1 to P4 against the running page with Playwright at 1440×900, 1024×768, 390×844 and with reduced motion. Also: the Contact section still slides over the last work case; the ASCII art and the blob pause off-screen; no console errors or failed requests on a full scroll of the page; all URLs are relative; `git diff --stat` from the start of the branch touches only allowed paths (Option 1 root files, `option-2/`, `option-2-cursor-reel/`, `_snapshots/` untouched); `cta-rain.js` and `cta-q.js` still exist.
3. Write `docs/qa-contact-chat.md`: a table of checks with PASS / FAIL / NOT CHECKED and one line each, FAIL items with exact steps and a screenshot path in `docs/screens/p5/`. Commit as `P5: QA report` and tag `contact-p5`.

---

## Chat scenario

All assistant copy, in English. `{x}` is filled from earlier answers. Steps run top to bottom.

1. **greeting.** "Hi, I’m the QRE assistant. I can help you scope your project and set up a free consultation with our team. What would you like to build?"
   Chips: AI agent · Custom AI model · Mobile or desktop app · Website · Business automation · Analytics · Something else
2. **details.** "Great, {service} is something we do a lot. Tell me a bit more: what should it do, and who will use it?"
   Free text. Chip: Not sure yet
3. **stage.** "Thanks, that helps. Where are you right now?"
   Chips: Just an idea · I have designs or a spec · I have a product to improve
4. **timeline.** "When would you like to get started?"
   Chips: As soon as possible · In 1 to 3 months · Later this year · Just exploring
5. **budget.** "Do you have a budget range in mind? A rough idea is fine."
   Chips: Under $25k · $25k to $100k · Over $100k · Not sure yet
6. **name.** "Who am I talking to? Your name and company, please."
   Free text. Chip: Skip
7. **email.** "Last thing: what’s the best e-mail to reach you?"
   Free text, must be a valid e-mail. On a bad address: "That doesn’t look like an e-mail address. Could you check it?"
8. **summary.** "Thanks{, name}. Here’s what I’ll pass to the team:" then a compact list: Project {service}, Details {details}, Stage {stage}, Start {timeline}, Budget {budget}, E-mail {email}. Then: "We’ll get back to you within 24 hours to set up a call."
   Chip: Start over

FAQ intents (answer, then repeat the current step's question):
- pricing (price, cost, how much, rate): "Every project is different. After a short call the team will send you an estimate."
- timeline (how long, timeline, deadline, weeks, months): "A first version usually takes a few weeks to a few months, depending on scope. The team will give you a real timeline after the call."
- who (who are you, are you human, bot, real person): "I’m an AI assistant for QRE. Our team reads every conversation and will follow up personally."

## Assumptions (made without confirmation, Dima can change them)

- A-01: the Contact button says "Chat with us" (v1 said "Book a call").
- A-02: the hero "Book a consultation" button and nav "Contact" keep scrolling to the Contact section; they do not open the chat directly.
- A-03: the header button keeps its label "Get in touch".
- A-04: budgets are in US dollars.
- A-05: a one-line consent note under the chat input replaces the consent checkbox.
- A-06: the assistant is called "QRE assistant" and uses the QRE mark as its avatar.
- A-07: the conversation lives until the page is reloaded; nothing is stored.
- A-08: the blob is monochrome; colour comes from the ASCII renderer as for the crystals.

---

## RUNNER

Paste into one new cloud session (model Sonnet 5.5, effort medium, permission mode that accepts edits and commands without asking):

```
You are the runner for docs/plan-contact-chat.md in this repo. Read it fully, plus CLAUDE.md. Do not edit site code yourself.

Run P0, P1, P2, P3, P4, P5 strictly in this order, each as its own subagent (Agent tool) with a fresh context and the model named in the step header (sonnet / opus / haiku). Give each subagent: the "Decisions" and "Rules for every step" sections, its own step section exactly as written, and for P4 also the "Chat scenario" and "Assumptions" sections. Tell each one it works unattended: questions go to docs/open-questions.md, never stop to ask.

After each subagent, before starting the next one, check yourself: git status is clean, its commits start with its step id, the tag contact-p<N> exists, the files it claims to have changed are in git show --stat, and its screenshots exist. If a step is incomplete or broke the page, send it back once with the specifics; if it still fails, stop the run, write what happened to docs/open-questions.md, commit, push, and report.

After P5: if docs/qa-contact-chat.md has FAIL items with clear repro steps, run one fix subagent (sonnet, medium) for those items only, commit as "P5-fix: ...", and have a fresh P5-style subagent (opus, medium) re-check only those items and update the report. Do this once, not in a loop.

Finally: set every step's status in docs/PROJECT_LOG.md, commit, push the branch (do not merge into main), and reply in Russian with a short table: step, done / partly / not done, one line each; the open questions; and which screenshots to look at first.
```

To run a step by hand instead: new cloud session, the model and effort from its header, and the prompt "Do step P<N> of docs/plan-contact-chat.md. Read the Decisions and Rules sections first."
