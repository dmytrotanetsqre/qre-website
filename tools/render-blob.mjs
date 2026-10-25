#!/usr/bin/env node
/*
 * Renders assets/contact-blob.mp4 from option-3/blob.js, frame by frame.
 *
 *   node tools/render-blob.mjs                  # the PARAMS below
 *   node tools/render-blob.mjs params.json      # params copied from blob-lab.html ("Copy params")
 *   node tools/render-blob.mjs --keep           # keep the PNG frames (path is printed)
 *
 * It serves the repo root on a free local port, opens option-3/blob-lab.html in
 * headless Chromium (Playwright), stops the lab's clock and calls
 * blob.renderAt(i / FPS) for every frame, so nothing depends on real time.
 * Frames are drawn at 2x and saved as PNGs in a temp folder outside the repo;
 * ffmpeg scales them to 640x484 and encodes H.264 (yuv420p, 30 fps, no audio).
 *
 * Needs: Node 18+, the `playwright` package with its Chromium, and ffmpeg on PATH
 * (or FFMPEG=/path/to/ffmpeg).
 */
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// The look of the shipped video. Keep in step with docs/blob.md.
export const PARAMS = {
  amount: 0.055,
  scale: 0.8,
  speed: 0.55,
  rim: 0.9,
  glow: 1.4,
  size: 0.62,
  breath: 0.04,
  loop: 8,
};

const FPS = 30;
const WIDTH = 640;
const HEIGHT = 484;
const SUPERSAMPLE = 2;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets', 'contact-blob.mp4');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';

const args = process.argv.slice(2);
const keep = args.includes('--keep');
const paramsFile = args.find((arg) => !arg.startsWith('--'));
const params = Object.assign({}, PARAMS, paramsFile ? JSON.parse(readFileSync(paramsFile, 'utf8')) : {});
const frames = Math.round(params.loop * FPS);

// createRequire honours NODE_PATH, so a global playwright install works too.
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.mp4': 'video/mp4',
  '.json': 'application/json',
};

function serve() {
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
    const file = join(ROOT, path);
    if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  return new Promise((done) => server.listen(0, '127.0.0.1', () => done(server)));
}

async function main() {
  const check = spawnSync(FFMPEG, ['-version'], { encoding: 'utf8' });
  if (check.status !== 0) {
    throw new Error(`ffmpeg not found ("${FFMPEG}"). Install it (apt install ffmpeg) or set FFMPEG.`);
  }

  const dir = mkdtempSync(join(tmpdir(), 'qre-blob-frames-'));
  const server = await serve();
  const { port } = server.address();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', (error) => console.error('[page]', error.message));
    const url = `http://127.0.0.1:${port}/option-3/blob-lab.html?params=${encodeURIComponent(JSON.stringify(params))}`;
    await page.goto(url);
    await page.waitForFunction(() => window.blobLab && window.blobLab.blob);
    await page.evaluate(([w, h]) => {
      const { blob } = window.blobLab;
      blob.stop();
      blob.onFrame = null; // no ASCII view while exporting
      blob.resize(w, h);
    }, [WIDTH * SUPERSAMPLE, HEIGHT * SUPERSAMPLE]);

    for (let i = 0; i < frames; i++) {
      const data = await page.evaluate((seconds) => {
        window.blobLab.blob.renderAt(seconds);
        return document.querySelector('#orb').toDataURL('image/png');
      }, i / FPS);
      const name = `frame_${String(i).padStart(4, '0')}.png`;
      writeFileSync(join(dir, name), Buffer.from(data.split(',')[1], 'base64'));
      if (i % 30 === 0) process.stdout.write(`frame ${i}/${frames}\n`);
    }
  } finally {
    await browser.close();
    server.close();
  }

  const encode = spawnSync(FFMPEG, [
    '-y', '-v', 'error',
    '-framerate', String(FPS),
    '-i', join(dir, 'frame_%04d.png'),
    '-vf', `scale=${WIDTH}:${HEIGHT}:flags=lanczos,format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
    '-pix_fmt', 'yuv420p', '-r', String(FPS), '-an',
    '-movflags', '+faststart',
    OUT,
  ], { stdio: 'inherit' });
  if (encode.status !== 0) throw new Error('ffmpeg failed');

  const size = statSync(OUT).size;
  console.log(`wrote ${OUT} (${frames} frames, ${(size / 1024).toFixed(0)} KB)`);
  if (keep) console.log(`frames kept in ${dir}`);
  else rmSync(dir, { recursive: true, force: true });
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
