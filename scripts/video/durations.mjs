/**
 * Single source of truth for how long each scene lasts.
 *
 * Prefers the durations written by the Gemini TTS stage; if that file is absent
 * it measures the voice-over WAVs directly, so a rebuild can never quietly cut
 * the video to estimates that disagree with the audio on disk. A word-count
 * estimate is only used before any narration exists at all.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SCENES } from './scenes.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const AUDIO_DIR = path.join(__dirname, 'audio');

/* ------------------------------------------------------------------ */
/* timeline constants — shared so capture/build/verify cannot disagree */
/* ------------------------------------------------------------------ */

/** Cross-fade length between scenes, in seconds. */
export const FADE = 0.45;

/** Held frames after the narration of a scene finishes. */
export const SLOT_TAIL = 0.35;

/**
 * Footage kept beyond a scene's slot in its rendered source file.
 *
 * The cross-fade between two scenes starts at `slot - FADE`, i.e. exactly at
 * the end of the previous chain. If the segment has no footage left past that
 * point the transition can be dropped and the rest of the video truncated, so
 * every segment carries this margin.
 */
export const SEGMENT_EXTRA = 0.30;

/** Nominal on-screen length of a scene: narration + held frames. */
export const slotLength = (seconds) => seconds + SLOT_TAIL;

/** Length the rendered scene file must have: its slot plus the safety margin. */
export const sourceLength = (seconds) => seconds + SLOT_TAIL + SEGMENT_EXTRA;

/** Words per second used by the pre-TTS estimate. */
const WPS = 2.5;

/** Silence kept after each spoken line; must match tts.mjs --tail. */
export const TAIL = 0.55;

const wavFile = (id) => path.join(AUDIO_DIR, `${id}.wav`);

/** Exact playing time of a RIFF/WAVE file, read straight from its chunks. */
function wavSeconds(file) {
  const buf = fs.readFileSync(file);
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF') return null;

  let rate = 0;
  let channels = 0;
  let bits = 0;
  let dataLen = 0;

  for (let offset = 12; offset + 8 <= buf.length; ) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      channels = buf.readUInt16LE(body + 2);
      rate = buf.readUInt32LE(body + 4);
      bits = buf.readUInt16LE(body + 14);
    } else if (id === 'data') {
      dataLen = Math.min(size, buf.length - body);
    }
    offset = body + size + (size % 2);
  }

  if (!rate || !channels || !bits || !dataLen) return null;
  return dataLen / ((rate * channels * bits) / 8);
}

/**
 * Real narration timings when any exist: the TTS manifest first, then the WAVs
 * themselves. Returns null before the voice-over stage has ever been run.
 */
function measuredDurations() {
  const file = path.join(AUDIO_DIR, 'durations.json');
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));

  const measured = {};
  for (const scene of SCENES) {
    const wav = wavFile(scene.id);
    if (!fs.existsSync(wav)) return null;
    const seconds = wavSeconds(wav);
    if (!seconds) return null;
    measured[scene.id] = Number((seconds + TAIL).toFixed(3));
  }
  return measured;
}

export function sceneDurations() {
  const real = measuredDurations();
  if (real) {
    // Fill any gaps (e.g. a single scene re-rendered with --only) with estimates.
    for (const scene of SCENES) {
      if (typeof real[scene.id] !== 'number') {
        real[scene.id] = Number(
          (0.7 + scene.narration.split(/\s+/).length / WPS).toFixed(2),
        );
      }
    }
    return real;
  }

  const estimated = {};
  for (const scene of SCENES) {
    estimated[scene.id] = Number(
      (0.7 + scene.narration.split(/\s+/).length / WPS).toFixed(2),
    );
  }
  return estimated;
}

export function usingRealAudio() {
  return measuredDurations() !== null;
}
