# Open questions (step, question, what was chosen, why)

## P2

- **Frame rate.** The reference videos (`assets/services/video/*.mp4`, `assets/hero-gem.mp4`) are 24 fps; the plan asks for 30 fps (8 s = 240 frames). Chosen: 30 fps as planned. Why: the plan is explicit, `asciiArt` samples on each presented video frame, so either rate works; re-rendering at 24 fps only needs `FPS` in `tools/render-blob.mjs` (keep the loop length a whole number of frames).
- **Size in frame.** The crystals fill about 83 to 95 % of the frame height (bounding box); the plan asks 60 to 70 % for the orb. Chosen: about 62 % (60 to 64 % with displacement and breath), as planned. Why: an orb reads larger than a crystal of the same box, and Contact already scales the art with `mediaScale`. Can be changed with `size` in the lab.
- **Lab console warning.** In headless Chromium the lab prints "GPU stall due to ReadPixels" (4 times, then the driver mutes it) because its ASCII view reads the WebGL canvas with `getImageData`. Chosen: left as is. Why: it is inherent to sampling a live WebGL canvas, it is the lab only, and the site itself plays the mp4.

## P3

- **Scale matched by eye.** The plan asks the blob to be about as large as the v1 gem. I did not render the v1 gem side by side. Chosen: `mediaScale` 1.4 (desktop, tablet) and `narrow.mediaScale` 2 (phones), from the frame geometry: both videos are 1.32:1, the gem fills about 89 % of the frame height at scale 1 and the orb about 62 %, so 1.4 gives an orb about 0.9 of the frame. Why: the numbers match, and the screenshots look right. Dima can nudge the two numbers if the v1 comparison shows otherwise.
- **Phone legibility.** At 390 px the orb sits behind the heading and the bright ones show between the lines. Chosen: brightness unchanged (0.62 × 0.6, as v1). Why: the heading stays readable in the screenshot; a darker orb would also change the look the plan asked to keep.
