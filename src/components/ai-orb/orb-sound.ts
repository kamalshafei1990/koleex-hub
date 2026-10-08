"use client";

/* ---------------------------------------------------------------------------
   Mochi sound — whether the character's 28 sounds play (wave whoosh, slap,
   hearts pop, the roll…).

   Off by default. Lives on the account (`preferences.orb_sound`) so every
   device agrees, mirrored in localStorage so the first frame already knows.
   Same store contract as orb-style.ts — one event, every listener updates.

   The engine's player (mochi/sound.ts) is a plain module, not a React
   component, so this store writes straight into it; nothing downstream has
   to subscribe for the sound itself to start or stop.
   --------------------------------------------------------------------------- */

import { useSyncExternalStore } from "react";
import { setMochiSoundEnabled } from "./mochi/sound";

const KEY = "koleex-orb-sound";
const EVENT = "kx-orb-sound";

export function getMochiSound(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** Push the stored choice into the engine's player. Called on MochiOrb mount
    so sounds are right even before the account resolves. */
export function applyMochiSoundFromStorage(): void {
  setMochiSoundEnabled(getMochiSound());
}

function writeLocal(on: boolean): void {
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* storage blocked */ }
  setMochiSoundEnabled(on);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: on }));
}

let localWriteUntil = 0;

/** The USER chose. Applies at once; the caller persists it to the account
 *  (Settings does, through updateAccountPreferences). */
export function setMochiSound(on: boolean): void {
  if (typeof window === "undefined") return;
  localWriteUntil = Date.now() + 8000;
  writeLocal(on);
}

/** The ACCOUNT says. Yields to a choice made in the last few seconds here. */
export function syncMochiSoundFromAccount(stored: unknown): void {
  if (typeof window === "undefined") return;
  if (Date.now() < localWriteUntil) return;
  const next = stored === true;
  if (next !== getMochiSound()) writeLocal(next);
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) onChange(); };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** The current choice, re-rendering when it changes. */
export function useMochiSound(): boolean {
  return useSyncExternalStore(subscribe, getMochiSound, () => false);
}
