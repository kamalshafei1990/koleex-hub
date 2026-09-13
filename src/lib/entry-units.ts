"use client";

/* ---------------------------------------------------------------------------
   entry-units — the unit the OPERATOR types in, which is never the unit the
   Hub stores.

   Supplier catalogues do not agree with each other: one prints a machine in
   mm, the next in cm, a third in metres; weights arrive in grams or kilos.
   Asking the person copying that page to convert in their head is where a
   1,200 becomes a 120, and nothing downstream can tell that it happened.

   So the form takes whatever the catalogue says and converts at the input
   boundary. Every schema field keeps its OWN canonical unit — the one its
   definition declares (`unit: "mm"` on machine dimensions, `"kg"` on weights)
   — and the stored number is always in that unit. Changing the switch
   re-displays the same physical machine; it never rewrites it.

   The choice follows the PERSON, not the product: it is how they read, not a
   fact about the goods, so it lives in localStorage and applies across the
   form. Nothing here is ever saved to the database.
   --------------------------------------------------------------------------- */

import { useCallback, useSyncExternalStore } from "react";

export type LengthUnit = "mm" | "cm" | "m";
export type MassUnit = "g" | "kg";

/** How many of this unit make one metre / one kilogram. */
const LENGTH_PER_M: Record<LengthUnit, number> = { mm: 1000, cm: 100, m: 1 };
const MASS_PER_KG: Record<MassUnit, number> = { g: 1000, kg: 1 };

export const LENGTH_UNITS: LengthUnit[] = ["mm", "cm", "m"];
export const MASS_UNITS: MassUnit[] = ["g", "kg"];

export const isLengthUnit = (u: string | undefined | null): u is LengthUnit =>
  !!u && (LENGTH_UNITS as string[]).includes(u);
export const isMassUnit = (u: string | undefined | null): u is MassUnit =>
  !!u && (MASS_UNITS as string[]).includes(u);

/* 4 decimals: 1200 mm → 120 cm → 1.2 m and back, with no float dust. */
const tidy = (n: number) => Math.round(n * 10000) / 10000;

/** Convert between two units of the same kind. Unknown pairs pass through. */
export function convertUnit(v: number, from: string, to: string): number {
  if (from === to) return v;
  if (isLengthUnit(from) && isLengthUnit(to)) return tidy((v / LENGTH_PER_M[from]) * LENGTH_PER_M[to]);
  if (isMassUnit(from) && isMassUnit(to)) return tidy((v / MASS_PER_KG[from]) * MASS_PER_KG[to]);
  return v;
}

/** Stored value (in `canonical`) → what to show in `entry`. "" stays "". */
export function displayIn(value: unknown, canonical: string, entry: string): string {
  const s = String(value ?? "").trim();
  if (s === "") return "";
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  return String(convertUnit(n, canonical, entry));
}

/** What was typed (in `entry`) → the number to store in `canonical`. */
export function storeFrom(typed: string, canonical: string, entry: string): number | "" {
  const s = typed.trim();
  if (s === "") return "";
  const n = Number(s);
  if (!Number.isFinite(n)) return "";
  return convertUnit(n, entry, canonical);
}

/* ── the preference, shared by every field on the form ─────────────────────
   useSyncExternalStore so that switching the unit in one place repaints every
   other field immediately — a form showing mm in one card and cm in the next
   is worse than no choice at all. */
const KEY_LENGTH = "koleex.entry-unit.length";
const KEY_MASS = "koleex.entry-unit.mass";
const EVENT = "koleex-entry-unit-change";

const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  if (typeof window !== "undefined") {
    window.addEventListener(EVENT, cb);
    window.addEventListener("storage", cb);
  }
  return () => {
    listeners.delete(cb);
    if (typeof window !== "undefined") {
      window.removeEventListener(EVENT, cb);
      window.removeEventListener("storage", cb);
    }
  };
}
function read(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  try {
    return window.localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, v: string) {
  try { window.localStorage.setItem(key, v); } catch { /* private mode */ }
  window.dispatchEvent(new Event(EVENT));
}

export function useEntryUnits(): {
  length: LengthUnit;
  mass: MassUnit;
  setLength: (u: LengthUnit) => void;
  setMass: (u: MassUnit) => void;
} {
  const length = useSyncExternalStore(
    subscribe,
    () => read(KEY_LENGTH, "mm"),
    () => "mm",
  ) as LengthUnit;
  const mass = useSyncExternalStore(
    subscribe,
    () => read(KEY_MASS, "kg"),
    () => "kg",
  ) as MassUnit;
  const setLength = useCallback((u: LengthUnit) => write(KEY_LENGTH, u), []);
  const setMass = useCallback((u: MassUnit) => write(KEY_MASS, u), []);
  return { length, mass, setLength, setMass };
}
