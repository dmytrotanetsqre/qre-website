# Contact blob video

`assets/contact-blob.mp4` is the looping orb that Option 3's Contact section draws as ASCII art (through `asciiArt()` in `option-3/script.js`). It is rendered from `option-3/blob.js`.

## Files

- `option-3/blob.js`: `createBlob(canvas, params)`, a Three.js orb (own shaders, 4D simplex noise from webgl-noise, MIT). `renderAt(seconds)` draws one deterministic frame; `start()` / `stop()` run it live.
- `option-3/blob-lab.html`: tuning page. Left: the orb as it goes into the video. Right: the same orb through `asciiArt()` with the Contact settings (switch to full brightness with the tone menu; hover it to see the Contact hover light). Sliders for noise amount, noise scale, speed, rim, glow, size and breath; "Copy params" prints the JSON. `?params={...}` sets the starting values.
- `tools/render-blob.mjs`: renders the video.

## Re-render

From the repo root (needs Node 18+, `playwright` with its Chromium, and `ffmpeg` on PATH or `FFMPEG=/path/to/ffmpeg`):

```sh
node tools/render-blob.mjs                # the PARAMS in the script
node tools/render-blob.mjs params.json    # JSON from the lab's "Copy params"
node tools/render-blob.mjs --keep         # also keep the PNG frames (temp folder, path is printed)
```

The script serves the repo on a free local port, opens the lab in headless Chromium, stops its clock and calls `renderAt(i / 30)` for 240 frames (8 s at 30 fps). Frames are drawn at 1280 × 968 and saved to a temp folder outside the repo; ffmpeg scales them to 640 × 484 and writes H.264, `yuv420p`, 30 fps, no audio, `-preset veryfast -crf 20 -movflags +faststart`. To keep the lab and the video in step, also put new values into `DEFAULTS` in `blob.js`.

## Params used (2026-10-25)

```json
{ "amount": 0.055, "scale": 0.8, "speed": 0.55, "rim": 0.9, "glow": 1.4, "size": 0.62, "breath": 0.04, "loop": 8 }
```

- `amount`: noise displacement, share of the radius. `scale`: noise frequency. `speed`: how far the noise travels per loop.
- `rim`: fresnel rim. `glow`: inner glow towards the upper left. `size`: diameter as a share of the frame height (about 0.60 to 0.64 with displacement and breath). `breath`: scale change, plus or minus, once per loop.
- The loop is seamless because every motion is periodic: the noise time is a point on a circle in two of the noise's four dimensions (each layer turns a whole number of times), and the breath is one sine per loop. `renderAt(0)` and `renderAt(8)` give identical pixels.

Result: 640 × 484, 240 frames, about 60 KB. Background pure black (0), highlights up to about 240, object median about 120, similar to the service crystal videos.

## Replacing it with your own video

Nothing on the site depends on what the video shows, so it can be swapped for any clip that follows these rules:

- Same path and name: `assets/contact-blob.mp4`.
- 640 × 484, or at least the same aspect ratio (about 4:3). The object centred, filling about 60 to 70 % of the height.
- Pure black background. Black turns into the page background in the ASCII art; any grey haze shows up as stray digits.
- Brightness from near black to near white on the object. Colour is ignored: the ASCII renderer works in grey.
- A seamless loop: the last frame must flow into the first.
- H.264 in an `.mp4`, `yuv420p`, no audio, with `+faststart`. Under about 4 MB.

A typical conversion:

```sh
ffmpeg -i my-orb.mov -vf "scale=640:484:force_original_aspect_ratio=decrease,pad=640:484:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p" \
  -c:v libx264 -preset veryfast -crf 20 -an -movflags +faststart assets/contact-blob.mp4
```

Check it in `option-3/` (Contact section) once P3 has wired it in.
