/* ---------------------------------------------------------------------------
   sounds/player — which Koleex AI cue plays, and whether it may.

   ONE ENGINE. Every sound the Hub makes goes through lib/notificationSound
   (its own rule, and the reason "sound off" there silences everything). This
   module adds no context and no fetch of its own: it reads the catalog, asks
   the user's preferences, and hands the engine a file path. When the engine
   is not there — no window, no AudioContext, no gesture yet — the cue's
   synthesised notes play on the engine's context if one exists, and nothing
   plays otherwise. Never a second sound; never an exception.

   WHAT DECIDES SILENCE, in order: the master switch (Settings → Sounds),
   the Koleex AI switch, the moment's own switch, the catalog's default for
   a moment the user never touched. Do-not-disturb does not apply: every
   cue here answers something the user is doing in the app right now.

   ONCE PER MOMENT. A cue that would fire again while its own file is still
   sounding is dropped (a burst of `thinking`, two `error`s from one failed
   turn) — a cue is one signal, not a rhythm.
   --------------------------------------------------------------------------- */

import { getSoundPrefs, playSoundFile, primeSoundFiles, soundContext, soundEngineHeld } from "@/lib/notificationSound";
import { scheduleTone, TONE_GAIN } from "@/lib/voice/tones";
import { SOUND_CATALOG, soundByKey, soundLength, type SoundKey } from "./catalog";

/** Where a cue's recording lives. Pure. */
export function soundSrc(key: SoundKey): string {
  return `/sounds/ai/${soundByKey(key).file}.mp3`;
}

/** Whether a cue is on for this user. Pure over the prefs it is given, so
 *  the settings screen and the suite can ask the same question. */
export function soundEnabled(key: SoundKey, prefs = getSoundPrefs()): boolean {
  if (!prefs.master || !prefs.ai.enabled) return false;
  const muted = new Set(prefs.ai.muted);
  const def = soundByKey(key);
  /* A moment the user silenced is off; a moment they never touched follows
     the catalog's default. Turning a default-off moment ON is recorded as
     its absence from `muted` plus the key in `unmuted` — see setSoundMoment. */
  if (muted.has(key)) return false;
  if (muted.has(`+${key}`)) return true;
  return def.defaultOn;
}

/** Turn one moment on or off, in the shared prefs. */
export function setSoundMoment(key: SoundKey, on: boolean, set: (patch: { ai: { muted: string[] } }) => unknown, prefs = getSoundPrefs()): void {
  const rest = prefs.ai.muted.filter((k) => k !== key && k !== `+${key}`);
  const def = soundByKey(key);
  /* Only a departure from the default is stored: silencing a default-on
     moment, or waking a default-off one (`+key`). */
  if (on && !def.defaultOn) rest.push(`+${key}`);
  if (!on && def.defaultOn) rest.push(key);
  set({ ai: { muted: rest } });
}

/** Warm the cues a screen is about to need, INSIDE the tap that opens it. */
export function primeSounds(keys: readonly SoundKey[]): void {
  try {
    primeSoundFiles(keys.filter((k) => soundEnabled(k)).map(soundSrc));
  } catch {
    /* No engine: the fallback needs no warming. */
  }
}

/** The whole catalog, for the settings screen's preview. */
export function primeAllSounds(): void {
  try {
    primeSoundFiles(SOUND_CATALOG.map((s) => soundSrc(s.key)));
  } catch { /* as above */ }
}

const lastPlayed = new Map<SoundKey, number>();

/* THE CALL'S CUES PLAY IN THE CALL'S OWN CONTEXT (2026-09-13). Every cue
   used to go through the Hub engine's AudioContext — a SECOND context (a
   third on the socket lane, beside the call's tones and its voice) running
   under a live microphone on a phone, and the codebase already knew what
   that does (ws-audio.ts playSample, 2026-09-07: "a second context started
   mid-call re-negotiates the audio hardware… the far side transcribed
   [noise]"). The crackle the owner heard through every playback redesign
   began the day the cues shipped. While a call is up, the button installs a
   SINK: the cue's bytes are handed to the call's own context (the socket
   lane's WsAudio, or the tones' context on the mainland lane) and the Hub
   engine is held (notificationSound.holdSoundEngine). A sink that cannot
   play — no call context yet, at the very tap — falls back to the engine,
   which is not held before the call is live. */
export type CueSink = (bytes: ArrayBuffer, volume: number) => Promise<boolean> | boolean;
let cueSink: CueSink | null = null;
export function setCueSink(sink: CueSink | null): void {
  cueSink = sink;
}
export function cueSinkSet(): boolean {
  return cueSink !== null;
}
/* The bytes of a cue file, fetched once per page (no decode: the context
   that plays them decodes them). */
const cueBytes = new Map<string, Promise<ArrayBuffer | null>>();
export function fetchCue(src: string): Promise<ArrayBuffer | null> {
  let p = cueBytes.get(src);
  if (!p) {
    p = (async () => {
      try {
        const res = await fetch(src, { credentials: "same-origin" });
        if (!res.ok) return null;
        return await res.arrayBuffer();
      } catch {
        return null;
      }
    })();
    cueBytes.set(src, p);
    void p.then((b) => { if (!b) cueBytes.delete(src); });
  }
  return p;
}
/** Warm the bytes the sink will need, inside the tap that starts a call. */
export function prefetchCues(keys: readonly SoundKey[]): void {
  if (typeof window === "undefined") return;
  for (const k of keys) if (soundEnabled(k)) void fetchCue(soundSrc(k));
}

/** Play a cue if the user allows it. Returns what happened, for a caller
 *  that keeps its own fallback (the call's tones). */
export function playSound(key: SoundKey, opts?: { force?: boolean }): "played" | "silenced" | "unavailable" {
  if (typeof window === "undefined") return "unavailable";
  if (!opts?.force && !soundEnabled(key)) return "silenced";
  const def = soundByKey(key);
  const now = Date.now();
  const busyUntil = lastPlayed.get(key) ?? 0;
  if (!opts?.force && now < busyUntil) return "silenced";
  lastPlayed.set(key, now + Math.max(120, Math.round(soundLength(def.notes) * 1000)));
  if (cueSink) {
    const sink = cueSink;
    const src = soundSrc(key);
    const volume = getSoundPrefs().volume;
    void fetchCue(src)
      .then((bytes) => (bytes ? sink(bytes, volume) : false))
      .then((ok) => {
        /* No call context could take it (the tap itself, before the call
           has one): the engine plays it, unless the call holds the engine. */
        if (!ok && !soundEngineHeld()) playSoundFile(src, volume);
      })
      .catch(() => {});
    return "played";
  }
  try {
    const outcome = playSoundFile(soundSrc(key), getSoundPrefs().volume);
    if (outcome === "played") return "played";
  } catch {
    /* fall through to the notes */
  }
  const ctx = soundContext();
  if (!ctx || ctx.state === "closed") return "unavailable";
  try {
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    scheduleTone(ctx, def.notes, TONE_GAIN * getSoundPrefs().volume);
    return "played";
  } catch {
    return "unavailable";
  }
}

/** Preview for the settings screen: plays whether or not the moment is on. */
export function previewSoundMoment(key: SoundKey): void {
  playSound(key, { force: true });
}
