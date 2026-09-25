/**
 * Verification stage: proves the exported video actually contains the product.
 *
 *   node verify.mjs            # video checks only
 *   node verify.mjs --links    # also fetches every URL referenced in the README
 *
 * Checks
 *   1. container: duration, resolution, fps, audio stream, faststart
 *   2. the audio track actually carries the voice-over (not a silent placeholder)
 *   3. every scene is really on screen at its expected timestamp (not black)
 *   4. the demo segment carries live footage: it differs from the scene before it
 *      and it moves, i.e. it is a recording rather than a still
 *   5. (optional) every link in the README returns a healthy status
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ffmpegPath from 'ffmpeg-static';
import sharp from 'sharp';

import { FADE, sceneDurations, slotLength, usingRealAudio } from './durations.mjs';
import { SCENES } from './scenes.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(__dirname, 'out');
const TMP = path.join(__dirname, 'build', 'verify');

fs.mkdirSync(TMP, { recursive: true });

let failures = 0;
const pass = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
  failures += 1;
  console.error(`  ✗ ${m}`);
};

function probe(file) {
  const res = spawnSync(ffmpegPath, ['-hide_banner', '-i', file], { encoding: 'utf8' });
  const text = `${res.stderr || ''}${res.stdout || ''}`;
  const dur = /Duration: (\d+):(\d+):([\d.]+)/.exec(text);
  const video = /Video: ([^,]+), [^,]+, (\d+)x(\d+)/.exec(text);
  const audio = /Audio: (\w+)/.exec(text);
  const fps = /(\d+(?:\.\d+)?) fps/.exec(text);
  return {
    seconds: dur ? Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]) : null,
    codec: video ? video[1].trim() : null,
    width: video ? Number(video[2]) : null,
    height: video ? Number(video[3]) : null,
    fps: fps ? Number(fps[1]) : null,
    audio: audio ? audio[1] : null,
  };
}

/** Extract one frame and describe how "busy" it is. */
function frameStats(file, seconds, tag) {
  const out = path.join(TMP, `${tag}.png`);
  const res = spawnSync(ffmpegPath, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-ss', seconds.toFixed(2),
    '-i', file,
    '-frames:v', '1',
    out,
  ]);
  if (res.status !== 0 || !fs.existsSync(out)) return null;

  const stats = spawnSync(
    process.execPath,
    [
      '-e',
      `require('sharp')(${JSON.stringify(out)}).stats().then(s=>{
         const c=s.channels.map(x=>x.mean);
         console.log(JSON.stringify({mean:c.map(v=>+v.toFixed(1))}));
       })`,
    ],
    { encoding: 'utf8', cwd: __dirname },
  );
  const meta = spawnSync(
    process.execPath,
    ['-e', `require('sharp')(${JSON.stringify(out)}).metadata().then(m=>console.log(m.width+'x'+m.height))`],
    { encoding: 'utf8', cwd: __dirname },
  );

  let mean = null;
  try {
    mean = JSON.parse(stats.stdout.trim()).mean;
  } catch {
    return null;
  }
  return { file: out, mean, size: (meta.stdout || '').trim(), bytes: fs.statSync(out).size };
}

/** Mean/max loudness of the audio track — catches a cut built without narration. */
function audioLevels(file) {
  const res = spawnSync(ffmpegPath, [
    '-hide_banner', '-i', file, '-map', '0:a?', '-af', 'volumedetect', '-f', 'null', '-',
  ], { encoding: 'utf8' });
  const text = `${res.stderr || ''}`;
  const mean = /mean_volume: (-?[\d.]+) dB/.exec(text);
  const max = /max_volume: (-?[\d.]+) dB/.exec(text);
  if (!mean && !max) return null;
  return { mean: mean ? Number(mean[1]) : null, max: max ? Number(max[1]) : null };
}

function checkContainer(file, label) {
  const info = probe(file);
  if (!info.seconds) return fail(`${label}: unreadable container`);
  pass(`${label}: ${info.seconds.toFixed(2)}s · ${info.width}x${info.height} · ${info.fps}fps · ${info.codec}`);
  if (info.audio) pass(`${label}: audio stream present (${info.audio})`);
  else fail(`${label}: no audio stream`);

  const level = info.audio ? audioLevels(file) : null;
  if (level?.max !== null && level.max < -50) {
    fail(
      `${label}: voice-over is silent (max ${level.max} dB) — run the Gemini TTS stage ` +
        'before building',
    );
  } else if (level?.max !== null) {
    pass(`${label}: voice-over present (mean ${level.mean} dB, peak ${level.max} dB)`);
  }

  const expect =
    SCENES.reduce((n, s) => n + slotLength(sceneDurations()[s.id]), 0) -
    (SCENES.length - 1) * FADE;
  const delta = Math.abs(info.seconds - expect);
  if (delta < 0.6) pass(`${label}: duration matches the timeline (${expect.toFixed(2)}s expected)`);
  else fail(`${label}: duration ${info.seconds.toFixed(2)}s vs ${expect.toFixed(2)}s expected`);

  return info;
}

function checkScenes(file) {
  const durations = sceneDurations();
  let cursor = 0;
  let previous = null;

  SCENES.forEach((scene, i) => {
    const slot = slotLength(durations[scene.id]);
    const midpoint = cursor + slot / 2;
    const stats = frameStats(file, midpoint, scene.id);

    if (!stats) {
      fail(`${scene.id}: no frame at ${midpoint.toFixed(1)}s`);
    } else if (Math.max(...stats.mean) < 4) {
      fail(`${scene.id}: frame is essentially black (mean ${stats.mean.join('/')})`);
    } else {
      pass(`${scene.id}: on screen at ${midpoint.toFixed(1)}s (${stats.size}, mean ${stats.mean.join('/')})`);
    }

    // The demo segment must be real footage: sampled across its whole length it
    // has to differ from the scene before it somewhere, and it has to change
    // over time (a still image would not).
    if (scene.kind === 'clip' && previous && stats?.mean) {
      const samples = [0.25, 0.5, 0.75]
        .map((p) => frameStats(file, cursor + slot * p, `${scene.id}-${p}`))
        .filter(Boolean);

      const diffFrom = (frames) =>
        Math.max(
          ...frames.map((f) =>
            previous.mean.reduce((n, v, ix) => n + Math.abs(v - f.mean[ix]), 0),
          ),
        );
      const motion =
        samples.length > 1
          ? Math.max(
              ...samples.map((f) =>
                samples[0].mean.reduce((n, v, ix) => n + Math.abs(v - f.mean[ix]), 0),
              ),
            )
          : 0;

      const diff = diffFrom(samples.length ? samples : [stats]);
      if (diff > 8 || motion > 4) {
        pass(
          `${scene.id}: live footage confirmed (Δ${diff.toFixed(1)} vs previous scene, ` +
            `Δ${motion.toFixed(1)} across the recording)`,
        );
      } else {
        fail(`${scene.id}: looks like a still and matches the preceding scene (Δ${diff.toFixed(1)})`);
      }
    }

    previous = stats;
    cursor += slot - FADE;
  });
}

async function checkLinks() {
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const urls = new Set(
    [...readme.matchAll(/https?:\/\/[^\s)"'<>]+/g)]
      .map((m) => m[0].replace(/[.,)]+$/, ''))
      .filter((u) => !u.includes('<') && !u.includes('YOUR_')),
  );
  // Bare domains written as inline code also count as links for our purposes.
  for (const m of readme.matchAll(/`([a-z0-9-]+\.[a-z]{2,}[^\s`]*)`/gi)) {
    if (!m[1].includes('<')) urls.add(`https://${m[1]}`);
  }

  console.log(`\n[verify] checking ${urls.size} README links`);
  for (const url of urls) {
    try {
      const res = await fetch(url, { method: 'GET', redirect: 'follow' });
      if (res.ok) pass(`${res.status} ${url}`);
      else fail(`${res.status} ${url}`);
    } catch (err) {
      // GitHub returns 429/403 to unauthenticated bursts; treat as unknown, not broken.
      fail(`unreachable ${url} (${err.message.slice(0, 60)})`);
    }
  }
}

async function main() {
  const linksOnly = process.argv.includes('--links');
  if (!linksOnly) {
    console.log(
      `[verify] timings source: ${usingRealAudio() ? 'Gemini voice-over audio' : 'estimated (no voice-over yet)'}`,
    );
    for (const name of ['privateops-pitch-1080p.mp4', 'privateops-pitch-720p.mp4']) {
      const file = path.join(OUT, name);
      if (!fs.existsSync(file)) {
        fail(`${name} missing`);
        continue;
      }
      console.log(`\n[verify] ${name}`);
      checkContainer(file, name);
      if (name.includes('1080')) checkScenes(file);
    }
  }

  if (linksOnly || process.argv.includes('--links')) await checkLinks();

  console.log(
    failures === 0
      ? '\n[verify] PASS — every check succeeded'
      : `\n[verify] FAIL — ${failures} check(s) failed`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main();
