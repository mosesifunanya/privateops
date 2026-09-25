/**
 * Fallback voice-over stage — used when no Gemini API key is available.
 *
 *   node tts-fallback.mjs
 *   node tts-fallback.mjs --only 03-solution --gap 0.1 --speed 1
 *
 * Writes exactly what the Gemini stage writes (audio/<scene>.wav plus
 * audio/durations.json), so capture.mjs and build.mjs do not care which voice
 * was used. Speaking rate is slowed slightly with ffmpeg's atempo when --speed
 * is below 1, which keeps long scripted lines inside their scene.
 *
 * The voice is Google's public translate_tts endpoint, chunked per sentence and
 * reassembled with a short gap between sentences. The Gemini path in tts.mjs is
 * the preferred one — this exists so the pipeline never ships a silent cut.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ffmpegPath from 'ffmpeg-static';

import { SCENES } from './scenes.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUDIO = path.join(__dirname, 'audio');
const TMP = path.join(__dirname, 'build', 'tts');
fs.mkdirSync(AUDIO, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const ix = argv.indexOf(`--${name}`);
  return ix === -1 ? fallback : argv[ix + 1];
};

const ONLY = arg('only', '');
const GAP = Number(arg('gap', '0.12')); // silence between sentences
const SPEED = Number(arg('speed', '1')); // 1 = as spoken, <1 = slower
const TAIL = Number(arg('tail', '0.55')); // kept identical to tts.mjs
const CHUNK = 190; // endpoint limit is ~200 characters per request

const ff = (args) => {
  const res = spawnSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  if (res.status !== 0) throw new Error(`ffmpeg exited ${res.status}`);
};

/** Split a narration line into requests the endpoint will accept. */
function chunks(text) {
  const parts = text.match(/[^.!?]+[.!?]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];
  const out = [];
  for (const part of parts) {
    if (part.length <= CHUNK) {
      out.push(part);
      continue;
    }
    let current = '';
    for (const piece of part.split(/(?<=,)\s+/)) {
      if ((current + ' ' + piece).trim().length > CHUNK) {
        if (current) out.push(current.trim());
        current = piece;
      } else {
        current = `${current} ${piece}`;
      }
    }
    if (current.trim()) out.push(current.trim());
  }
  return out;
}

async function speak(text, file) {
  const url =
    'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=' +
    encodeURIComponent(text);

  for (let attempt = 1; ; attempt += 1) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
      if (!res.ok) throw new Error(`http ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 2048) throw new Error(`suspiciously small clip (${buf.length}b)`);
      fs.writeFileSync(file, buf);
      return buf.length;
    } catch (err) {
      if (attempt >= 4) throw new Error(`${err.message} for "${text.slice(0, 60)}…"`);
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
}

async function main() {
  const targets = SCENES.filter((s) => !ONLY || s.id === ONLY);
  console.log(`[tts-fallback] scenes=${targets.length} gap=${GAP}s speed=${SPEED}`);

  const durationsFile = path.join(AUDIO, 'durations.json');
  const durations = fs.existsSync(durationsFile)
    ? JSON.parse(fs.readFileSync(durationsFile, 'utf8'))
    : {};

  // A shared silence clip, concatenated between sentences.
  const silence = path.join(TMP, 'silence.wav');
  ff(['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', GAP.toFixed(3), '-c:a', 'pcm_s16le', silence]);

  for (const scene of targets) {
    const pieces = chunks(scene.narration);
    const list = [];

    for (const [i, piece] of pieces.entries()) {
      const mp3 = path.join(TMP, `${scene.id}-${i}.mp3`);
      const wav = path.join(TMP, `${scene.id}-${i}.wav`);
      await speak(piece, mp3);
      ff([
        '-i', mp3,
        '-af', SPEED === 1 ? 'anull' : `atempo=${SPEED}`,
        '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le',
        wav,
      ]);
      if (i) list.push(`file '${silence.replace(/'/g, "'\\''")}'`);
      list.push(`file '${wav.replace(/'/g, "'\\''")}'`);
      await new Promise((r) => setTimeout(r, 200)); // be gentle with the endpoint
    }

    const listFile = path.join(TMP, `${scene.id}.txt`);
    fs.writeFileSync(listFile, `${list.join('\n')}\n`);

    const out = path.join(AUDIO, `${scene.id}.wav`);
    ff(['-f', 'concat', '-safe', '0', '-i', listFile, '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', out]);

    const seconds = fs.statSync(out).size / (48000 * 2);
    durations[scene.id] = Number((seconds + TAIL).toFixed(3));
    console.log(
      `  ✓ ${scene.id.padEnd(18)} ${seconds.toFixed(2)}s speech · ${pieces.length} chunks → ${durations[scene.id].toFixed(2)}s slot`,
    );
  }

  fs.writeFileSync(durationsFile, JSON.stringify(durations, null, 2));
  const total = Object.values(durations).reduce((a, b) => a + b, 0);
  console.log(`[tts-fallback] wrote audio/durations.json · ${Object.keys(durations).length} scenes · ${total.toFixed(1)}s`);
}

main().catch((err) => {
  console.error('[tts-fallback] FAILED', err.message);
  process.exit(1);
});
