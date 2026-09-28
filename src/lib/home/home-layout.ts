"use client";

/* ---------------------------------------------------------------------------
   Home layout — which launcher this person sees on Home.

   Owner, 28/09/2026, after trying Home sample 2 live: "put this style in
   setting and back to old layout as the default one".

     · "classic" — the launcher as it was: My apps, then every group as a
                   block of tiles. The default.
     · "today"   — sample 2: the Today strip (open tasks, unread messages and
                   notifications, the next event), My apps, then one card per
                   group with the apps as rows.

   Same shape as the orb choice (components/ai-orb/orb-style.ts): stored on
   the account (`preferences.home_layout`) so every device agrees, mirrored in
   localStorage so Home draws the right layout on its first frame, and a
   choice just made here outranks an account snapshot for a few seconds.
   --------------------------------------------------------------------------- */

import { useSyncExternalStore } from "react";

export type HomeLayout = "classic" | "today";

export const DEFAULT_HOME_LAYOUT: HomeLayout = "classic";

const KEY = "koleex-home-layout";
const EVENT = "kx-home-layout";

/** Anything that is not a known layout reads as the default. Pure. */
export function normalizeHomeLayout(v: unknown): HomeLayout {
  return v === "today" ? "today" : DEFAULT_HOME_LAYOUT;
}

export function getHomeLayout(): HomeLayout {
  if (typeof window === "undefined") return DEFAULT_HOME_LAYOUT;
  try {
    return normalizeHomeLayout(localStorage.getItem(KEY));
  } catch {
    return DEFAULT_HOME_LAYOUT;
  }
}

function writeLocal(layout: HomeLayout): void {
  try { localStorage.setItem(KEY, layout); } catch { /* storage blocked */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: layout }));
}

let localWriteUntil = 0;

/** The USER chose. The caller persists it to the account (Settings does). */
export function setHomeLayout(layout: HomeLayout): void {
  if (typeof window === "undefined") return;
  localWriteUntil = Date.now() + 8000;
  writeLocal(normalizeHomeLayout(layout));
}

/** The ACCOUNT says. Called when the signed-in account resolves or changes;
 *  yields to a choice made in the last few seconds on this device. */
export function syncHomeLayoutFromAccount(stored: unknown): void {
  if (typeof window === "undefined") return;
  if (Date.now() < localWriteUntil) return;
  const next = normalizeHomeLayout(stored);
  if (next !== getHomeLayout()) writeLocal(next);
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

/** The current layout, re-rendering when it changes. */
export function useHomeLayout(): HomeLayout {
  return useSyncExternalStore(subscribe, getHomeLayout, () => DEFAULT_HOME_LAYOUT);
}
