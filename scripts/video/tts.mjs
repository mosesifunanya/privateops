/**
 * Gemini voice-over stage.
 *
 * Synthesises one audio clip per scene with the Gemini TTS model, then records
 * the exact duration of each clip so the video can be cut to the narration.
 *
 *   GEMINI_API_KEY=... node tts.mjs
 *   GEMINI_API_KEY=... node tts.mjs --voice Kore --only 03-solution
 *
 * The key is read from the environment only — it is never written to disk
 * inside the repository.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SCENES } from './scenes.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUDIO = path.join(__dirname, 'audio');
fs.mkdirSync(AUDIO, { recursive: true });

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const ix = argv.indexOf(`--${name}`);
  return ix === -1 ? fallback : argv[ix + 1];
};

const API_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
  arg('key', '');

const VOICE = arg('voice', process.env.GEMINI_TTS_VOICE || 'Charon');
const MODEL = arg('model', 'gemini-2.5-flash-preview-tts');
const ONLY = arg('only', '');
const TAIL = Number(arg('tail', '0.55')); // silence kept after each line

const API = 'https://generativelanguage.googleapis.com/v1beta';

if (!API_KEY) {
  console.error(
    [
      'Missing Gemini API key.',
      '',
      '  GEMINI_API_KEY=your_key node tts.mjs',
      '',
      'Get one at https://aistudio.google.com/apikey',
    ].join('\n'),
  );
  process.exit(1);
}

/** Wrap raw 16-bit PCM in a RIFF/WAVE container so ffmpeg can read it. */
function wavFromPcm(pcm, sampleRate = 24000, channels = 1) {
  const header = Buffer.alloc(44);
  const dataLen = pcm.length;
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLen, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE((sampleRate * channels * 16) / 8, 28);
  header.writeUInt16LE((channels * 16) / 8, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataLen, 40);
  return Buffer.concat([header, pcm]);
}

function parseRate(mimeType, fallback = 24000) {
  const m = /rate=(\d+)/.exec(mimeType || '');
  return m ? Number(m[1]) : fallback;
}

async function synthesise(text) {
  const body = {
    contents: [{ parts: [{ text }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } },
      },
    },
    model: MODEL,
  };

  const res = await fetch(`${API}/models/${MODEL}:generateContent?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Gemini TTS ${res.status}: ${detail.slice(0, 400)}`);
  }

  const json = await res.json();
  const part = json?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part) {
    throw new Error(`No audio in response: ${JSON.stringify(json).slice(0, 400)}`);
  }

  const rate = parseRate(part.inlineData.mimeType);
  const pcm = Buffer.from(part.inlineData.data, 'base64');
  return { wav: wavFromPcm(pcm, rate), rate, bytes: pcm.length };
}

/** List the TTS models this key can actually use (used for error hints). */
async function listTtsModels() {
  try {
    const res = await fetch(`${API}/models?key=${API_KEY}`);
    if (!res.ok) return [];
    const json = await res.json();
    return (json.models || [])
      .map((m) => m.name.replace('models/', ''))
      .filter((n) => /tts/i.test(n));
  } catch {
    return [];
  }
}

async function main() {
  const targets = SCENES.filter((s) => !ONLY || s.id === ONLY);
  console.log(`[tts] model=${MODEL} voice=${VOICE} scenes=${targets.length}`);

  const durationsFile = path.join(AUDIO, 'durations.json');
  const durations = fs.existsSync(durationsFile)
    ? JSON.parse(fs.readFileSync(durationsFile, 'utf8'))
    : {};

  for (const scene of targets) {
    const out = path.join(AUDIO, `${scene.id}.wav`);
    let attempt = 0;

    for (;;) {
      try {
        const { wav, rate } = await synthesise(scene.narration);
        fs.writeFileSync(out, wav);
        const seconds = wav.length / (rate * 2);
        durations[scene.id] = Number((seconds + TAIL).toFixed(3));
        console.log(
          `  ✓ ${scene.id.padEnd(18)} ${seconds.toFixed(2)}s speech → ${durations[scene.id].toFixed(2)}s slot`,
        );
        break;
      } catch (err) {
        attempt += 1;
        if (attempt >= 3) {
          const models = await listTtsModels();
          console.error(`\n[tts] failed on ${scene.id}: ${err.message}`);
          if (models.length) console.error(`[tts] available TTS models: ${models.join(', ')}`);
          throw err;
        }
        const backoff = 1200 * attempt;
        console.warn(`  … retry ${attempt} for ${scene.id} in ${backoff}ms (${err.message.slice(0, 120)})`);
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
  }

  fs.writeFileSync(durationsFile, JSON.stringify(durations, null, 2));
  const total = Object.values(durations).reduce((a, b) => a + b, 0);
  console.log(`[tts] wrote audio/durations.json · ${Object.keys(durations).length} scenes · ${total.toFixed(1)}s`);
}

main().catch((err) => {
  console.error('[tts] FAILED', err.message);
  process.exit(1);
});
