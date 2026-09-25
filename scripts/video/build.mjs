/**
 * Assembly stage: cuts the scenes to the voice-over and exports the pitch video.
 *
 *   node build.mjs
 *
 * Reads  : build/<scene>.mp4, assets/live-journey.webm, assets/overlay-demo.png,
 *          audio/<scene>.wav, audio/durations.json
 * Writes : out/privateops-pitch-1080p.mp4, out/privateops-pitch-720p.mp4,
 *          out/poster.png
 *          and publishes them (plus the thumbnail) into public/video/, which is
 *          what the README embeds and the live deployment serves.
 *
 * Audio sync note: every scene slot is `speech + TAIL` long and each cross-fade
 * eats FADE seconds, so delaying each line by (slot − FADE) lands the next line
 * exactly when the previous one stops — speech stays in step with the picture
 * without ever cross-fading two voices together.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ffmpegPath from 'ffmpeg-static';

import {
  FADE,
  SEGMENT_EXTRA,
  sceneDurations,
  slotLength,
  usingRealAudio,
} from './durations.mjs';
import { SCENES } from './scenes.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const BUILD = path.join(__dirname, 'build');
const ASSETS = path.join(__dirname, 'assets');
const AUDIO = path.join(__dirname, 'audio');
const OUT = path.join(__dirname, 'out');
const PUBLISH = path.join(ROOT, 'public', 'video');

const TAIL_BUDGET = 0.55; // silence kept after each spoken line
/** x264 effort for the two exports; override with VIDEO_PRESET=slow for a slower, smaller master. */
const MASTER_PRESET = process.env.VIDEO_PRESET || 'medium';
const FPS = 30;
const W = 1920;
const H = 1080;

/** Tasteful transition per cut; index 0 is the 1st → 2nd scene transition. */
const TRANSITIONS = [
  'fade',
  'smoothleft',
  'fade',
  'circleopen',
  'fade',
  'smoothleft',
  'fade',
  'circleopen',
  'fade',
];

fs.mkdirSync(OUT, { recursive: true });

function ff(args) {
  const res = spawnSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  if (res.status !== 0) throw new Error(`ffmpeg exited ${res.status}`);
}

function probe(file) {
  const res = spawnSync(ffmpegPath, ['-hide_banner', '-i', file], { encoding: 'utf8' });
  const text = `${res.stderr || ''}${res.stdout || ''}`;
  const dur = /Duration: (\d+):(\d+):([\d.]+)/.exec(text);
  const video = /Stream .*Video: [^,]+, [^,]+, (\d+)x(\d+)/.exec(text);
  const fps = /(\d+(?:\.\d+)?) fps/.exec(text);
  const audio = /Stream .*Audio: (\w+)/.exec(text);
  return {
    seconds: dur ? Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]) : null,
    size: video ? `${video[1]}x${video[2]}` : null,
    fps: fps ? Number(fps[1]) : null,
    audio: audio ? audio[1] : null,
  };
}

/** Fail loudly if a source scene is shorter than the slot it must fill. */
function assertLongEnough(source, needed, sceneId) {
  const have = probe(source).seconds ?? 0;
  if (have + 0.05 < needed) {
    throw new Error(
      `scene "${sceneId}" is only ${have.toFixed(2)}s but ${needed.toFixed(2)}s is needed ` +
        `(truncated render?). Re-render it:  node capture.mjs scenes scene-${sceneId}`,
    );
  }
}

/** Normalise one scene into a 1080p30 segment with a small safety tail. */
function normaliseScene(scene, duration) {
  const out = path.join(BUILD, `seg-${scene.id}.mp4`);
  const label = scene.label.replace(/[:|'\\]/g, ' ');
  const source = path.join(BUILD, `${scene.id}.mp4`);
  assertLongEnough(source, duration + SEGMENT_EXTRA, scene.id);

  ff([
    '-i', source,
    '-vf', `scale=${W}:${H}:flags=lanczos,fps=${FPS},format=yuv420p`,
    '-t', (duration + SEGMENT_EXTRA).toFixed(3),
    '-an',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
    '-r', String(FPS),
    out,
  ]);
  console.log(`  seg ${scene.id.padEnd(18)} ${duration.toFixed(2)}s  (${label})`);
  return out;
}

/** Trim the real screen recording and lay the product chrome over it. */
function normaliseClip(scene, duration) {
  const out = path.join(BUILD, `seg-${scene.id}.mp4`);
  const source = path.join(ASSETS, 'live-journey.webm');
  const need = duration + SEGMENT_EXTRA;
  // A long narration can outlast the recording; loop it rather than fail.
  const loop = (probe(source).seconds ?? 0) < need ? ['-stream_loop', '-1'] : [];

  ff([
    ...loop,
    '-i', source,
    '-loop', '1', '-framerate', String(FPS), '-i', path.join(ASSETS, 'overlay-demo.png'),
    '-filter_complex',
    `[0:v]trim=start=0:duration=${need.toFixed(3)},setpts=PTS-STARTPTS,` +
      `scale=${W}:${H}:flags=lanczos,fps=${FPS},format=yuva420p[base];` +
      `[base][1:v]overlay=0:0:format=auto[vout]`,
    '-map', '[vout]',
    '-t', need.toFixed(3),
    '-an',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
    '-r', String(FPS),
    out,
  ]);
  console.log(`  seg ${scene.id.padEnd(18)} ${duration.toFixed(2)}s  (live recording + chrome)`);
  return out;
}

/**
 * Make sure every scene has an audio file. When the Gemini voice-over has not
 * been generated yet we substitute exact-length silence, so the cut is still
 * produced with a valid audio track and the graph stays identical afterwards.
 */
function ensureAudio(segments, durations) {
  const silent = [];
  for (const s of segments) {
    const file = path.join(AUDIO, `${s.scene.id}.wav`);
    const speech = Math.max(0.4, durations[s.scene.id] - TAIL_BUDGET);
    let stat = null;
    try {
      stat = fs.statSync(file);
    } catch {
      stat = null;
    }
    if (stat && stat.size > 4096) continue;

    spawnSync(ffmpegPath, [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono',
      '-t', speech.toFixed(3),
      '-c:a', 'pcm_s16le',
      file,
    ]);
    silent.push(s.scene.id);
  }
  if (silent.length) {
    console.warn(
      `[build] NOTE: ${silent.length}/${segments.length} scenes have no voice-over yet — ` +
        'using silence so the cut still renders.\n' +
        '        Run `GEMINI_API_KEY=... node tts.mjs` then rebuild to add the narration.',
    );
  }
}

function main() {
  const durations = sceneDurations();
  if (!usingRealAudio()) {
    console.warn(
      '[build] WARNING: audio/durations.json not found — using estimated timings.\n' +
        '        Run the Gemini TTS stage first for a correctly synced voice-over.',
    );
  }

  const segments = SCENES.map((scene) => ({
    scene,
    input:
      scene.kind === 'clip'
        ? normaliseClip(scene, slotLength(durations[scene.id]))
        : normaliseScene(scene, slotLength(durations[scene.id])),
    slot: slotLength(durations[scene.id]),
  }));

  ensureAudio(segments, durations);

  const vInputs = segments.flatMap((s) => ['-i', s.input]);
  const aInputs = segments.flatMap((s) => ['-i', path.join(AUDIO, `${s.scene.id}.wav`)]);

  // --- video: chain of cross-fades ------------------------------------
  const vChain = [];
  let acc = segments[0].slot;
  for (let i = 1; i < segments.length; i += 1) {
    const offset = acc - FADE;
    const transition = TRANSITIONS[(i - 1) % TRANSITIONS.length];
    const prev = i === 1 ? '[0:v]' : `[v${i - 1}]`;
    vChain.push(
      `${prev}[${i}:v]xfade=transition=${transition}:duration=${FADE.toFixed(2)}:offset=${offset.toFixed(3)}[v${i}]`,
    );
    acc = offset + segments[i].slot;
  }
  const totalVideo = acc;

  // --- audio: one delayed line per scene ------------------------------
  const aChain = [];
  let cursor = 0;
  segments.forEach((s, i) => {
    // adelay requires a positive delay, so the first line sits 1ms in.
    const ms = Math.max(1, Math.round(cursor * 1000));
    aChain.push(
      `[${segments.length + i}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,` +
        `adelay=${ms}|${ms}[a${i}]`,
    );
    cursor += s.slot - FADE;
  });
  aChain.push(
    `${segments.map((_, i) => `[a${i}]`).join('')}amix=inputs=${segments.length}:normalize=0[mixed]`,
  );
  aChain.push('[mixed]loudnorm=I=-16:TP=-1.5:LRA=11[aout]');

  const filter = [...vChain, ...aChain].join(';');
  const lastV = `[v${segments.length - 1}]`;

  const final1080 = path.join(OUT, 'privateops-pitch-1080p.mp4');
  console.log('[build] encoding 1080p master…');
  ff([
    ...vInputs,
    ...aInputs,
    '-filter_complex', filter,
    '-map', lastV,
    '-map', '[aout]',
    '-t', totalVideo.toFixed(3),
    // `medium` at CRF 20 is visually indistinguishable from `slow` here and keeps
    // a full rebuild inside a few minutes, so the cut can be re-cut quickly.
    '-c:v', 'libx264', '-preset', MASTER_PRESET, '-crf', '20', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
    '-movflags', '+faststart',
    final1080,
  ]);

  const final720 = path.join(OUT, 'privateops-pitch-720p.mp4');
  console.log('[build] encoding 720p web version…');
  ff([
    '-i', final1080,
    '-vf', 'scale=1280:720:flags=lanczos',
    '-c:v', 'libx264', '-preset', MASTER_PRESET, '-crf', '24',
    '-c:a', 'copy',
    '-movflags', '+faststart',
    final720,
  ]);

  console.log('[build] poster…');
  ff(['-i', final1080, '-ss', '3.2', '-frames:v', '1', path.join(OUT, 'poster.png')]);

  // Publish to public/video/ so the README embeds and the deployed site serves
  // exactly the cut that was just produced.
  fs.mkdirSync(PUBLISH, { recursive: true });
  for (const name of ['privateops-pitch-1080p.mp4', 'privateops-pitch-720p.mp4', 'poster.png']) {
    fs.copyFileSync(path.join(OUT, name), path.join(PUBLISH, name));
  }
  const thumb = path.join(ASSETS, 'thumbnail.png');
  if (fs.existsSync(thumb)) fs.copyFileSync(thumb, path.join(PUBLISH, 'pitch-thumbnail.png'));
  console.log('[build] published → public/video/ (README thumbnail, poster, 1080p + 720p cuts)');

  for (const f of [final1080, final720]) {
    const info = probe(f);
    const mb = (fs.statSync(f).size / 1024 / 1024).toFixed(1);
    console.log(
      `  ${path.basename(f).padEnd(30)} ${info.seconds?.toFixed(2)}s  ${info.size}  ${info.fps}fps  audio=${info.audio}  ${mb}MB`,
    );
  }
}

main();
