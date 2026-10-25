# Open questions (step, question, what was chosen, why)

## P2

- **Frame rate.** The reference videos (`assets/services/video/*.mp4`, `assets/hero-gem.mp4`) are 24 fps; the plan asks for 30 fps (8 s = 240 frames). Chosen: 30 fps as planned. Why: the plan is explicit, `asciiArt` samples on each presented video frame, so either rate works; re-rendering at 24 fps only needs `FPS` in `tools/render-blob.mjs` (keep the loop length a whole number of frames).
- **Size in frame.** The crystals fill about 83 to 95 % of the frame height (bounding box); the plan asks 60 to 70 % for the orb. Chosen: about 62 % (60 to 64 % with displacement and breath), as planned. Why: an orb reads larger than a crystal of the same box, and Contact already scales the art with `mediaScale`. Can be changed with `size` in the lab.
- **Lab console warning.** In headless Chromium the lab prints "GPU stall due to ReadPixels" (4 times, then the driver mutes it) because its ASCII view reads the WebGL canvas with `getImageData`. Chosen: left as is. Why: it is inherent to sampling a live WebGL canvas, it is the lab only, and the site itself plays the mp4.

## P3

- **Scale matched by eye.** The plan asks the blob to be about as large as the v1 gem. I did not render the v1 gem side by side. Chosen: `mediaScale` 1.4 (desktop, tablet) and `narrow.mediaScale` 2 (phones), from the frame geometry: both videos are 1.32:1, the gem fills about 89 % of the frame height at scale 1 and the orb about 62 %, so 1.4 gives an orb about 0.9 of the frame. Why: the numbers match, and the screenshots look right. Dima can nudge the two numbers if the v1 comparison shows otherwise.
- **Phone legibility.** At 390 px the orb sits behind the heading and the bright ones show between the lines. Chosen: brightness unchanged (0.62 × 0.6, as v1). Why: the heading stays readable in the screenshot; a darker orb would also change the look the plan asked to keep.

## P4

- **Avatar.** "QRE mark" from `qre-logo.svg`, which is the full wordmark (106:32). Chosen: the same file cropped to its Q (`object-fit: cover`, left) in a 40 px ring. Why: the whole wordmark is unreadable at avatar size; CLAUDE.md already calls the Q the logo mark. Use the full wordmark by removing the crop if preferred.
- **No placeholder in the textarea.** A placeholder ("Type a message") would be new copy, which the step forbids. Chosen: none; the textarea has `aria-label="Message"`. Why: rule on copy. Dima can add one.
- **E-mail pattern.** `wireConsultationForm` relied on the browser's `type=email` check (`email.validity.valid`), not an own regex. Chosen: the same WHATWG pattern in `chat.js`, which accepts `name@host` without a dot. A message with one word containing `@` ("it is anna@acme.com") counts as that address.
- **FAQ vs answers.** Plain keyword matching made answers trigger FAQ ("in 6 months" on the timeline step, "a support bot" on the greeting). Chosen: FAQ fires on a question (`?` or a leading question word) with a whole-word keyword, or on a fixed phrase anywhere ("how much", "how long", "who are you", "are you human", "real person", ...); on its own topic step (timeline, budget) only as a question; a chip keyword match wins over FAQ. Why: keeps the scenario's intents without eating answers.
- **{service} inside a sentence.** "Great, Website is ..." reads wrong. Chosen: `{service|lower}` lowers the first letter unless the answer starts with an acronym ("AI agent" stays). The summary keeps the chip label as is.
- **{name} in the summary.** The step asks for name and company. Chosen: the greeting uses the part before the first comma or " from / at " ("Anna Smith, Acme" gives "Thanks, Anna Smith."); the lead keeps the full answer as `name`.
- **Typing after the summary.** The scenario has no copy for it. Chosen: "start over" / "restart" keywords restart; a FAQ question gets its answer; anything else gets the summary's last line again ("We’ll get back to you within 24 hours to set up a call."). Why: reuses scenario copy, no new copy.
- **Focus after a chip.** The clicked chip is removed. Chosen: focus moves to the log (tabindex -1, no phone keyboard) and then to the first new chip. On open, focus goes to the textarea (or the first chip), as specified; on phones this may raise the keyboard on the first open (not checked on a device).
- **Not checked here:** the phone on-screen keyboard over the composer (iOS `dvh` does not shrink with the keyboard), and screen-reader announcements (only the DOM/ARIA was checked).
