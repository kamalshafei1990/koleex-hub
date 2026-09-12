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

import { getSoundPrefs, playSoundFile, primeSoundFiles, soundContext } from "@/lib/notificationSound";
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
