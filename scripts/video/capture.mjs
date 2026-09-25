/**
 * Capture stage of the PrivateOps pitch video pipeline.
 *
 * Produces, from the LIVE Vercel deployment:
 *   1. Crisp product screenshots (used inside the scenes and the README)
 *   2. A real screen recording of the app being used (the demo segment)
 *   3. Animated scene videos driven by deterministic CSS-animation frames
 *   4. The README thumbnail / poster image
 *
 * Everything is captured from the deployed product, so the video can never
 * drift away from what the app actually looks like.
 *
 *   node capture.mjs
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ffmpegPath from 'ffmpeg-static';
import hljs from 'highlight.js';
import { marked } from 'marked';
import { chromium } from 'playwright';
import sharp from 'sharp';

import { sceneDurations, sourceLength, usingRealAudio } from './durations.mjs';
import { backgroundHtml, SCENES } from './scenes.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const ASSETS = path.join(__dirname, 'assets');
const BUILD = path.join(__dirname, 'build');

const LIVE_URL = process.env.PRIVATEOPS_LIVE_URL || 'https://privateops-liard.vercel.app';
const REPO_URL = 'https://github.com/mosesifunanya/privateops';
const FPS = 24;

for (const dir of [ASSETS, BUILD]) fs.mkdirSync(dir, { recursive: true });

const log = (...a) => console.log('[capture]', ...a);
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/* ------------------------------------------------------------------ */
/* html renderers                                                      */
/* ------------------------------------------------------------------ */

const codeTheme = `
  .editor { width:100%; height:100%; background:#070c15; display:flex; flex-direction:column;
            font-family:"SFMono-Regular",ui-monospace,Menlo,Consolas,monospace; }
  .ed-bar { display:flex; align-items:center; gap:14px; padding:18px 26px; border-bottom:1px solid rgba(255,255,255,.08); background:#0a111c; }
  .ed-dots { display:flex; gap:9px; }
  .ed-dots i { width:12px; height:12px; border-radius:50%; display:block; }
  .ed-file { font-size:15px; color:#8ea0b8; letter-spacing:.04em; }
  .ed-tag { margin-left:auto; font-size:12px; letter-spacing:.16em; text-transform:uppercase; color:#84cc16;
            border:1px solid rgba(132,204,22,.32); background:rgba(132,204,22,.09); border-radius:999px; padding:6px 13px; }
  .ed-body { flex:1; padding:26px 30px; overflow:hidden; }
  .ed-body pre { font-size:23px; line-height:1.62; color:#cfdcec; }
  .hljs-keyword,.hljs-built_in,.hljs-type { color:#c084fc; }
  .hljs-string { color:#86efac; }
  .hljs-comment { color:#5b6b81; font-style:italic; }
  .hljs-title,.hljs-function { color:#7dd3fc; }
  .hljs-number,.hljs-literal { color:#fbbf24; }
  .hljs-attr,.hljs-property { color:#a5b4fc; }
  .hljs-variable { color:#f0abfc; }
`;

function codeHtml(code, lang, fileLabel, tag) {
  const body = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;} ${codeTheme}
  </style></head><body>
    <div class="editor">
      <div class="ed-bar">
        <span class="ed-dots"><i style="background:#f87171"></i><i style="background:#fbbf24"></i><i style="background:#34d399"></i></span>
        <span class="ed-file">${fileLabel}</span>
        <span class="ed-tag">${tag}</span>
      </div>
      <div class="ed-body"><pre><code class="hljs">${body}</code></pre></div>
    </div>
  </body></html>`;
}

function architectureHtml() {
  const box = (title, sub, accent, items) => `
    <div style="border:1px solid ${accent}55; background:linear-gradient(165deg,${accent}1f,${accent}08);
                border-radius:18px; padding:22px 24px; flex:1;">
      <div style="font-size:22px; font-weight:660; color:#eef4fb">${title}</div>
      <div style="font-size:15px; color:#8ea0b8; margin-top:6px">${sub}</div>
      <div style="margin-top:16px; display:flex; flex-direction:column; gap:7px">
        ${items.map((i) => `<div style="font-size:16px; color:#c3cfdf">· ${i}</div>`).join('')}
      </div>
    </div>`;

  const arrow = (label) => `
    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; width:150px; flex:0 0 150px">
      <div style="font-size:13px; letter-spacing:.14em; text-transform:uppercase; color:#8ea0b8">${label}</div>
      <svg width="130" height="20" viewBox="0 0 130 20" fill="none">
        <line x1="0" y1="10" x2="108" y2="10" stroke="#84cc16" stroke-width="2.4" stroke-dasharray="9 8"/>
        <path d="M108 4l14 6-14 6z" fill="#84cc16"/>
      </svg>
    </div>`;

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;width:1920px;height:1400px;overflow:hidden;}
    body{background:radial-gradient(circle at 22% 12%, rgba(132,204,22,.12), transparent 46%),
                 radial-gradient(circle at 88% 88%, rgba(34,211,238,.10), transparent 46%), #05080f;
         font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Arial,sans-serif; color:#f4f7fb; padding:56px 58px;}
    .title{font-size:26px; font-weight:680; letter-spacing:-.01em}
    .sub{font-size:16px; color:#8ea0b8; margin-top:8px}
    .row{display:flex; align-items:stretch; margin-top:34px}
  </style></head><body>
    <div class="title">PrivateOps · request path</div>
    <div class="sub">Everything above the ledger stays local to the user's browser.</div>
    <div class="row">
      ${box('User / AI agent', 'Browser session', '#22d3ee', ['Connect Midnight wallet', 'Submit action amount', 'Sign the proof'])}
      ${arrow('wallet + proving')}
      ${box('Front-end', 'Next.js · React', '#84cc16', ['WalletConnect', 'CircuitCall', 'Proof status'])}
      ${arrow('Midnight.js')}
      ${box('Contract', 'Compact · Preprod', '#a855f7', ['authorizeAction()', 'getPolicyLimit() witness', 'Discloses 2 values'])}
    </div>
    <div style="margin-top:40px; display:flex; gap:20px">
      <div style="flex:1; border:1px solid rgba(255,255,255,.10); border-radius:16px; padding:20px 24px; background:rgba(255,255,255,.03)">
        <div style="font-size:14px; letter-spacing:.16em; text-transform:uppercase; color:#84cc16">Disclosed on-chain</div>
        <div style="font-size:19px; margin-top:10px; color:#dbe6f2">actionAmount · authorized</div>
      </div>
      <div style="flex:1; border:1px solid rgba(251,113,133,.32); border-radius:16px; padding:20px 24px; background:rgba(251,113,133,.06)">
        <div style="font-size:14px; letter-spacing:.16em; text-transform:uppercase; color:#fb7185">Never disclosed</div>
        <div style="font-size:19px; margin-top:10px; color:#f2dde2">policyLimit · private state</div>
      </div>
    </div>
  </body></html>`;
}

function readmeHtml() {
  const md = read('README.md');
  const html = marked.parse(md.replace(/^[\s\S]*?## Overview/, '## Overview'));
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;width:2360px;height:1250px;overflow:hidden;}
    body{background:#ffffff; color:#0f172a; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Arial,sans-serif; padding:52px 64px;}
    h1{font-size:44px; margin:0 0 10px} h2{font-size:30px; margin:30px 0 12px}
    h3{font-size:22px; margin:20px 0 8px}
    p,li{font-size:19px; line-height:1.6; color:#334155}
    code,pre{font-family:ui-monospace,Menlo,Consolas,monospace; font-size:17px}
    pre{background:#f1f5f9; border:1px solid #e2e8f0; border-radius:12px; padding:16px 18px; overflow:hidden; white-space:pre-wrap}
    code{background:#f1f5f9; border-radius:6px; padding:2px 6px}
    table{border-collapse:collapse; font-size:18px} td,th{border:1px solid #e2e8f0; padding:8px 14px}
    hr{border:none; border-top:1px solid #e2e8f0; margin:26px 0}
  </style></head><body>${html}</body></html>`;
}

function thumbnailHtml() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;width:2560px;height:1440px;overflow:hidden}
    body{background:#04070d; color:#f4f7fb; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Arial,sans-serif;
         display:grid; place-items:center; position:relative}
    .glow{position:absolute; border-radius:50%; filter:blur(120px)}
    .g1{width:1200px;height:1200px;left:-260px;top:-420px;background:rgba(132,204,22,.20)}
    .g2{width:1000px;height:1000px;right:-220px;bottom:-380px;background:rgba(34,211,238,.15)}
    .grid{position:absolute; inset:0;
      background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);
      background-size:96px 96px;
      mask-image:radial-gradient(circle at 50% 50%, black 12%, transparent 74%);
      -webkit-mask-image:radial-gradient(circle at 50% 50%, black 12%, transparent 74%)}
    .inner{position:relative; text-align:center; padding:0 120px}
    .chip{display:inline-flex; align-items:center; gap:14px; border:1px solid rgba(132,204,22,.35);
          background:rgba(132,204,22,.10); color:#a3e635; border-radius:999px; padding:14px 30px;
          font-size:24px; font-weight:650; letter-spacing:.2em; text-transform:uppercase}
    .dot{width:14px;height:14px;border-radius:50%;background:#84cc16;box-shadow:0 0 26px #84cc16}
    h1{font-size:132px; line-height:1.02; letter-spacing:-.035em; margin:36px 0 0; font-weight:740}
    h1 span{background:linear-gradient(100deg,#84cc16,#22d3ee); -webkit-background-clip:text; background-clip:text; color:transparent}
    p{font-size:36px; color:#c3cfdf; margin:30px 0 0; line-height:1.5}
    .play{margin-top:54px; display:inline-flex; align-items:center; gap:20px;
          background:linear-gradient(100deg,#84cc16,#a3e635); color:#08120a; border-radius:999px;
          padding:22px 46px; font-size:32px; font-weight:720}
    .foot{margin-top:44px; font-size:24px; color:#8ea0b8; letter-spacing:.1em}
  </style></head><body>
    <div class="glow g1"></div><div class="glow g2"></div><div class="grid"></div>
    <div class="inner">
      <div class="chip"><span class="dot"></span> Midnight Network · Preprod</div>
      <h1>Verify AI actions.<br><span>Keep the rules private.</span></h1>
      <p>Privacy-preserving authorization with zero-knowledge proofs.</p>
      <div class="play">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5l11 6.5-11 6.5z"/></svg>
        Watch the 2-minute pitch
      </div>
      <div class="foot">PrivateOps · live on Vercel · ${REPO_URL.replace('https://', '')}</div>
    </div>
  </body></html>`;
}

/** Alpha PNG chrome drawn over the live-recording demo segment. */
function demoOverlayHtml() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;width:1920px;height:1080px;background:transparent;overflow:hidden}
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Arial,sans-serif; color:#fff}
    .bar{position:absolute; left:0; right:0; top:0; height:8px; background:linear-gradient(90deg,#84cc16,#22d3ee)}
    .edge{position:absolute; inset:0; box-shadow:inset 0 0 130px rgba(0,0,0,.75), inset 0 0 0 2px rgba(255,255,255,.06)}
    .lock{position:absolute; left:64px; top:760px; display:flex; align-items:center; gap:16px;
          background:rgba(4,7,13,.82); border:1px solid rgba(132,204,22,.34); border-radius:18px;
          padding:16px 26px; backdrop-filter:blur(8px)}
    .mark{width:50px;height:50px;border-radius:14px;display:grid;place-items:center;
          background:linear-gradient(150deg,rgba(132,204,22,.25),rgba(34,211,238,.10));
          border:1px solid rgba(132,204,22,.42); color:#84cc16}
    .name{font-size:26px;font-weight:700} .sub{font-size:14px;color:#8ea0b8;letter-spacing:.16em;text-transform:uppercase;margin-top:4px}
    .url{position:absolute; right:64px; top:760px; display:flex; align-items:center; gap:12px;
         background:rgba(4,7,13,.82); border:1px solid rgba(255,255,255,.12); border-radius:14px;
         padding:14px 24px; font-size:19px; color:#a9bad0; backdrop-filter:blur(8px)}
    .url b{color:#84cc16; font-weight:650}
    .live{position:absolute; right:64px; top:60px; display:flex; align-items:center; gap:12px;
          background:rgba(4,7,13,.80); border:1px solid rgba(132,204,22,.34); border-radius:999px;
          padding:12px 24px; font-size:16px; letter-spacing:.2em; text-transform:uppercase; color:#a3e635; font-weight:650}
    .pulse{width:12px;height:12px;border-radius:50%;background:#84cc16;animation:p 1.6s ease-in-out infinite}
    @keyframes p{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:1;transform:scale(1.15)}}
  </style></head><body>
    <div class="bar"></div><div class="edge"></div>
    <div class="live"><span class="pulse"></span> Live deployment</div>
    <div class="lock">
      <span class="mark"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2.5l7 3.2v6.1c0 4.4-2.9 8.2-7 9.7-4.1-1.5-7-5.3-7-9.7V5.7z"/><path d="M9.2 12.2l2 2 3.6-4"/></svg></span>
      <span><span class="name">PrivateOps</span><span class="sub" style="display:block">Live on Vercel</span></span>
    </div>
    <div class="url">
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#84cc16" stroke-width="2"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/></svg>
      <b>https</b>://privateops-liard.vercel.app
    </div>
  </body></html>`;
}

/* ------------------------------------------------------------------ */
/* live capture                                                        */
/* ------------------------------------------------------------------ */

async function waitForImages(page) {
  await page.evaluate(() =>
    Promise.all(
      Array.from(document.images).map((img) =>
        img.complete ? Promise.resolve() : new Promise((res) => {
          img.onload = res;
          img.onerror = res;
        }),
      ),
    ),
  );
}

async function shot(page, name, opts = {}) {
  const file = path.join(ASSETS, `${name}.png`);
  await page.screenshot({ path: file, ...opts });
  log('shot', name);
}

async function smoothScrollTo(page, selector, ms) {
  await page.evaluate(
    async ({ selector, ms }) => {
      const el = selector ? document.querySelector(selector) : null;
      const target = el
        ? Math.max(0, el.getBoundingClientRect().top + window.scrollY - 72)
        : 0;
      const start = window.scrollY;
      const dist = target - start;
      const t0 = performance.now();
      await new Promise((resolve) => {
        const step = (now) => {
          const p = Math.min(1, (now - t0) / ms);
          const eased = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
          window.scrollTo(0, start + dist * eased);
          if (p < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      });
    },
    { selector, ms },
  );
}

const wait = (page, ms) => page.waitForTimeout(ms);

/**
 * Drive the app's own theme toggle to a known theme.
 *
 * Chromium defaults to a light colour scheme, which would leave the captured
 * product looking nothing like the dark product graphics — so every capture
 * explicitly settles the theme first.
 */
async function forceTheme(page, want) {
  const btn = page.locator('button[aria-label^="Switch to"]').first();
  if (!(await btn.count())) {
    log(`WARN theme toggle not found — leaving theme as-is`);
    return null;
  }

  for (let i = 0; i < 3; i += 1) {
    const label = (await btn.getAttribute('aria-label')) || '';
    const current = /dark mode/i.test(label) ? 'light' : 'dark';
    if (current === want) {
      log(`theme: ${want}`);
      return current;
    }
    await btn.click();
    await wait(page, 1100);
  }

  log(`WARN could not switch theme to ${want}`);
  return null;
}

/** Screenshots from the deployed product. */
async function captureStills(browser) {
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
    reducedMotion: 'no-preference',
  });
  const page = await ctx.newPage();
  log('opening', LIVE_URL);
  await page.goto(LIVE_URL, { waitUntil: 'networkidle', timeout: 90_000 });
  await wait(page, 3200); // let the hero entrance animation settle
  await forceTheme(page, 'dark');
  await wait(page, 900);
  await waitForImages(page);

  await shot(page, 'live-hero');
  await shot(page, 'live-proof-panel', {
    clip: await page.locator('.proof-shell').boundingBox(),
  });

  await smoothScrollTo(page, '#how-it-works', 900);
  await wait(page, 1400);
  await shot(page, 'live-how-it-works');

  await smoothScrollTo(page, '#authorize', 900);
  await wait(page, 1200);
  await shot(page, 'live-authorize');

  // wallet chooser — real Midnight wallet detection
  const connect = page.getByRole('button', { name: /connect wallet/i }).first();
  if (await connect.count()) {
    await connect.click();
    await wait(page, 2600);
    await shot(page, 'live-wallet-modal');
    await page.mouse.click(60, 540); // dismiss via backdrop
    await wait(page, 700);
  } else {
    log('WARN connect-wallet button not found');
  }

  // action amount + the authorization gate
  const amount = page.locator('#privateops-action-amount');
  if (await amount.count()) {
    await amount.fill('300');
    await wait(page, 600);
    await shot(page, 'live-authorize-filled');

    const prove = page.getByRole('button', { name: /prove authorization/i }).first();
    if (await prove.count()) {
      await prove.click();
      await wait(page, 900);
      await shot(page, 'live-authorize-gated');
      log('captured the wallet-required gate on the authorization flow');
    }
  }

  await smoothScrollTo(page, '#privacy', 900);
  await wait(page, 1600);
  await shot(page, 'live-privacy');

  await smoothScrollTo(page, '#contact', 900);
  await wait(page, 1400);
  await shot(page, 'live-contact');

  // a light-theme hero is still worth capturing for the README
  await smoothScrollTo(page, null, 700);
  await wait(page, 500);
  if ((await forceTheme(page, 'light')) === 'light') {
    await wait(page, 1200);
    await shot(page, 'live-hero-light');
  }

  await ctx.close();
  log('stills complete');
}

/** Real screen recording of the product being used. */
async function captureJourney(browser) {
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    reducedMotion: 'no-preference',
    recordVideo: { dir: BUILD, size: { width: 1920, height: 1080 } },
  });
  const page = await ctx.newPage();
  const video = page.video();

  log('recording journey on', LIVE_URL);
  await page.goto(LIVE_URL, { waitUntil: 'networkidle', timeout: 90_000 });
  await wait(page, 2000);
  await forceTheme(page, 'dark');
  await wait(page, 1600);

  await smoothScrollTo(page, '#how-it-works', 2000);
  await wait(page, 1000);

  await smoothScrollTo(page, '#authorize', 1800);
  await wait(page, 1200);

  const connect = page.getByRole('button', { name: /connect wallet/i }).first();
  if (await connect.count()) {
    await connect.click();
    await wait(page, 2100); // wallet chooser
    await page.mouse.click(60, 540);
    await wait(page, 500);
  }

  const amount = page.locator('#privateops-action-amount');
  if (await amount.count()) {
    await amount.fill('300');
    await wait(page, 800);
  }

  const prove = page.getByRole('button', { name: /prove authorization/i }).first();
  if (await prove.count()) {
    await prove.click();
    await wait(page, 1500);
  }

  await smoothScrollTo(page, '#privacy', 1800);
  await wait(page, 1600);

  await smoothScrollTo(page, '#contact', 1600);
  await wait(page, 1300);

  await page.close();
  await ctx.close();

  const src = await video.path();
  const dest = path.join(ASSETS, 'live-journey.webm');
  fs.copyFileSync(src, dest);
  log('recorded journey →', path.relative(ROOT, dest));
}

/* ------------------------------------------------------------------ */
/* static renders + scene videos                                       */
/* ------------------------------------------------------------------ */

async function renderHtmlToPng(browser, html, name, width, height, { transparent = false } = {}) {
  const file = path.join(BUILD, `${name}.html`);
  const out = path.join(ASSETS, `${name}.png`);
  fs.writeFileSync(file, html);

  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  await page.goto(`file://${file}`, { waitUntil: 'load' });
  await waitForImages(page);
  await wait(page, 150);
  await page.screenshot({ path: out, omitBackground: transparent });
  await page.close();
  log('render', name, transparent ? '(alpha)' : '');
  return out;
}

/**
 * Stream deterministic animation frames straight into ffmpeg.
 *
 * Each CSS animation is paused and scrubbed to an exact timestamp, so the
 * motion is reproducible frame-for-frame (JPEG frames keep the pipe fast; the
 * final encode is still H.264 at CRF 18).
 */
async function renderSceneVideo(browser, scene, durationSec) {
  const htmlFile = path.join(ASSETS, `scene-${scene.id}.html`);
  const outFile = path.join(BUILD, `${scene.id}.mp4`);
  fs.writeFileSync(htmlFile, scene.html());

  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  await page.goto(`file://${htmlFile}`, { waitUntil: 'load' });
  await waitForImages(page);
  await wait(page, 120);

  // Freeze every CSS animation so we can scrub time deterministically.
  await page.evaluate(() => {
    for (const a of document.getAnimations()) {
      a.pause();
      a.currentTime = 0;
    }
  });

  const total = Math.max(FPS, Math.round(durationSec * FPS));
  const args = [
    '-y',
    '-f', 'image2pipe',
    '-vcodec', 'mjpeg',
    '-framerate', String(FPS),
    '-i', 'pipe:0',
    '-vf', 'scale=1920:1080:flags=lanczos,format=yuv420p',
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '18',
    '-r', String(FPS),
    outFile,
  ];
  const ff = spawn(ffmpegPath, args, { stdio: ['pipe', 'ignore', 'pipe'] });
  let ffErr = '';
  ff.stderr.on('data', (d) => (ffErr += d.toString()));

  const started = Date.now();
  for (let i = 0; i < total; i += 1) {
    const t = (i / FPS) * 1000;
    await page.evaluate((ms) => {
      for (const a of document.getAnimations()) {
        a.pause();
        a.currentTime = ms;
      }
    }, t);

    const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) {
      await new Promise((r) => ff.stdin.once('drain', r));
    }

    if (i > 0 && i % (FPS * 5) === 0) {
      const rate = (Date.now() - started) / 1000 / i;
      log(
        `    ${scene.id} ${i}/${total} frames · ${rate.toFixed(3)}s/frame · ` +
          `eta ${(((total - i) * rate) / 60).toFixed(1)}min`,
      );
    }
  }

  ff.stdin.end();
  const code = await new Promise((r) => ff.on('close', r));
  if (code !== 0) throw new Error(`ffmpeg failed for ${scene.id}: ${ffErr.slice(-800)}`);

  await page.close();
  log(
    `scene ${scene.id} → ${durationSec.toFixed(2)}s (${total} frames in ` +
      `${((Date.now() - started) / 1000).toFixed(0)}s)`,
  );
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  const browser = await chromium.launch();
  const durations = sceneDurations();

  const only = process.argv.slice(2).filter((a) => !a.startsWith('-') && !a.startsWith('scene-'));
  const sceneFilter = process.argv
    .filter((a) => a.startsWith('scene-'))
    .map((a) => a.replace('scene-', ''));
  log(
    usingRealAudio()
      ? 'timings: real Gemini voice-over durations'
      : 'timings: estimated from narration word counts (run the tts stage for exact sync)',
  );
  if (only.length && !only.includes('scenes')) log('scenes skipped — stages:', only.join(', '));

  try {
    if (!only.length || only.includes('stills')) await captureStills(browser);
    if (!only.length || only.includes('journey')) await captureJourney(browser);

    if (!only.length || only.includes('renders')) {
      await renderHtmlToPng(
        browser,
        codeHtml(read('contracts/privateops.compact'), 'rust', 'contracts/privateops.compact', 'Compact'),
        'code-contract',
        2360,
        1040,
      );
      await renderHtmlToPng(
        browser,
        codeHtml(read('src/witnesses.ts'), 'typescript', 'src/witnesses.ts', 'Private witness'),
        'code-witnesses',
        2360,
        1040,
      );
      await renderHtmlToPng(
        browser,
        codeHtml(read('src/midnight/client.ts'), 'typescript', 'src/midnight/client.ts', 'Midnight.js'),
        'code-client',
        2360,
        1040,
      );
      await renderHtmlToPng(browser, architectureHtml(), 'architecture', 1920, 1400);
      await renderHtmlToPng(browser, readmeHtml(), 'readme-section', 2360, 1250);
      await renderHtmlToPng(browser, thumbnailHtml(), 'thumbnail-large', 2560, 1440);

      await sharp(path.join(ASSETS, 'thumbnail-large.png'))
        .resize(1280, 720, { fit: 'cover' })
        .png({ quality: 90, compressionLevel: 9 })
        .toFile(path.join(ASSETS, 'thumbnail.png'));
      log('thumbnail → 1280x720');

    }

    if (!only.length || only.includes('overlay')) {
      await renderHtmlToPng(browser, demoOverlayHtml(), 'overlay-demo', 1920, 1080, {
        transparent: true,
      });
    }

    // The scene backdrop must exist before any scene is rendered.
    if (
      (!only.length || only.includes('scenes') || only.includes('bg')) &&
      !fs.existsSync(path.join(ASSETS, 'bg.png'))
    ) {
      await renderHtmlToPng(browser, backgroundHtml(), 'bg', 1920, 1080);
    }

    if (!only.length || only.includes('scenes')) {
      for (const scene of SCENES) {
        if (scene.kind === 'clip') continue;
        if (sceneFilter.length && !sceneFilter.includes(scene.id)) continue;
        await renderSceneVideo(browser, scene, sourceLength(durations[scene.id] ?? 5));
      }
    }
  } finally {
    await browser.close();
  }

  log('capture stage done');
}

main().catch((err) => {
  console.error('[capture] FAILED', err);
  process.exit(1);
});
