"use client";

/* ---------------------------------------------------------------------------
   Orb style — which drawing of the Koleex AI orb this user sees.

   Owner, 2026-09-23: "the user can choose the orb shape … and if he choose
   one so every thing in Koleex Hub related to the AI orb will change."

   Two styles:
     · "aura" — AIOrb, the energy sphere with the two fixed indicators. The
                default, and the only orb before this choice existed.
     · "dots" — the dotted thought-orb (the thinking-orbs engine), drawn by
                DottedOrb.

   ONE CHOICE, EVERY ORB. Every place the assistant's orb is drawn goes
   through <ChosenOrb>, which reads this store — so there is no call site that
   can be forgotten when a third style arrives.

   WHERE IT LIVES. On the account (`preferences.orb`), so the phone, the iPad
   and the Mac show the same orb; mirrored in localStorage so the right orb is
   drawn on the first frame instead of arriving after the account does. The
   mirror is also what makes the switch instant: Settings writes it, fires one
   event, and every mounted orb re-renders in place.

   A just-made local choice outranks an account snapshot for a few seconds —
   the refetch after a save can still carry the old value, and letting it win
   would put the orb straight back (the same race display-prefs closes).
   --------------------------------------------------------------------------- */

import { useSyncExternalStore } from "react";

export type OrbStyle = "aura" | "dots";

export const ORB_STYLES: readonly OrbStyle[] = ["aura", "dots"] as const;
export const DEFAULT_ORB_STYLE: OrbStyle = "aura";

const KEY = "koleex-orb";
const EVENT = "kx-orb-style";

/** Anything that is not a known style reads as the default. Pure. */
export function normalizeOrbStyle(v: unknown): OrbStyle {
  return v === "dots" ? "dots" : DEFAULT_ORB_STYLE;
}

export function getOrbStyle(): OrbStyle {
  if (typeof window === "undefined") return DEFAULT_ORB_STYLE;
  try {
    return normalizeOrbStyle(localStorage.getItem(KEY));
  } catch {
    return DEFAULT_ORB_STYLE;
  }
}

function writeLocal(style: OrbStyle): void {
  try { localStorage.setItem(KEY, style); } catch { /* storage blocked */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: style }));
}

let localWriteUntil = 0;

/** The USER chose. Applies everywhere at once; the caller persists it to the
 *  account (Settings does, through updateAccountPreferences). */
export function setOrbStyle(style: OrbStyle): void {
  if (typeof window === "undefined") return;
  localWriteUntil = Date.now() + 8000;
  writeLocal(normalizeOrbStyle(style));
}

/** The ACCOUNT says. Called when the signed-in account resolves or changes;
 *  yields to a choice made in the last few seconds on this device. */
export function syncOrbStyleFromAccount(stored: unknown): void {
  if (typeof window === "undefined") return;
  if (Date.now() < localWriteUntil) return;
  const next = normalizeOrbStyle(stored);
  if (next !== getOrbStyle()) writeLocal(next);
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) onChange(); };
  window.addEventListener(EVENT, onChange);
  /* Another tab of the Hub chose — follow it. */
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** The current style, re-rendering when it changes. The server snapshot is
 *  the default, so hydration matches; an orb mounted after hydration (most of
 *  them — the AI app is client-only) reads the real choice on its first
 *  render and never shows the other one. */
export function useOrbStyle(): OrbStyle {
  return useSyncExternalStore(subscribe, getOrbStyle, () => DEFAULT_ORB_STYLE);
}
