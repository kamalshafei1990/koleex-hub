"use client";

/* ===========================================================================
   useBaseCurrency — single source of truth for the tenant base currency.

   Before this hook was hardened, every Finance/Expenses surface owned
   its own `useState("CNY")` baseline plus a useEffect that fetched
   /api/create/defaults. That had two real problems:

     1. **First-frame flash.** A USD or EUR tenant briefly saw "CNY 0.00"
        in every KPI before the fetch resolved.
     2. **N+1 fetches.** Every Finance page mount re-hit the same
        endpoint even though the value is stable for the session.

   This rewrite fixes both:
     · Module-level promise + in-memory string cache so simultaneous
       callers share one network round-trip.
     · sessionStorage warms the cache across same-tab navigations so the
       second mount renders the real currency on its first frame.
     · `useBaseCurrencyOptional()` returns `string | null` — display
       surfaces use this and render "—" until resolved instead of
       baking in a "CNY" lie.
     · `useBaseCurrency(fallback?)` keeps the old "always a string"
       contract for form defaults, but the fallback parameter is
       explicit so callers don't accidentally inherit "CNY".
   ========================================================================== */

import { useEffect, useState } from "react";

const SESSION_KEY = "koleex:base-currency";
const FALLBACK_KEY = "koleex:base-currency:fallback";

/* Module-level cache — shared across every component that calls the
   hook in the same browser tab. */
let cachedValue: string | null = null;
let inflight: Promise<string | null> | null = null;
const listeners = new Set<(v: string | null) => void>();

function readSession(): string | null {
  if (typeof window === "undefined") return null;
  try { return window.sessionStorage.getItem(SESSION_KEY); }
  catch { return null; }
}

function readFallback(): string | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(FALLBACK_KEY); }
  catch { return null; }
}

function persist(value: string): void {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.setItem(SESSION_KEY, value); } catch { /* quota / private mode */ }
  try { window.localStorage.setItem(FALLBACK_KEY, value); }   catch { /* same */ }
}

function notify(value: string | null): void {
  for (const fn of listeners) fn(value);
}

function fetchBase(): Promise<string | null> {
  if (cachedValue) return Promise.resolve(cachedValue);
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const r = await fetch("/api/create/defaults", { cache: "no-store" });
      if (!r.ok) return null;
      const j = (await r.json()) as { defaults?: { base_currency?: string } };
      const v = j.defaults?.base_currency ?? null;
      if (v) {
        cachedValue = v;
        persist(v);
        notify(v);
      }
      return v;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/* Bootstrap the in-memory cache from storage on module load so the very
   first useState() initializer sees a warm value. */
if (typeof window !== "undefined" && !cachedValue) {
  cachedValue = readSession() ?? readFallback();
}

/**
 * Returns the tenant base currency, or `null` while loading.
 *
 * Display surfaces should prefer this signature and render "—" or a
 * skeleton until the value resolves — never a baked-in default.
 */
export function useBaseCurrencyOptional(): string | null {
  const [value, setValue] = useState<string | null>(() => cachedValue);
  useEffect(() => {
    const onChange = (v: string | null) => setValue(v);
    listeners.add(onChange);
    if (!cachedValue) void fetchBase();
    return () => { listeners.delete(onChange); };
  }, []);
  return value;
}

/**
 * Returns the tenant base currency as a guaranteed string. Use this for
 * form pre-selects and other places that MUST have a concrete code.
 *
 * `fallback` defaults to "USD" — a deliberately generic choice. If your
 * surface should bias to a specific currency, pass it explicitly.
 */
export function useBaseCurrency(fallback: string = "USD"): string {
  return useBaseCurrencyOptional() ?? fallback;
}

/**
 * Returns the resolved base currency plus a loading flag. Use when you
 * need both the value and an explicit "still resolving" signal.
 */
export function useBaseCurrencyDetail(): { base: string | null; loading: boolean } {
  const value = useBaseCurrencyOptional();
  return { base: value, loading: value === null };
}

/** Test-only: reset both the in-memory cache and the in-flight promise. */
export function __resetBaseCurrencyCache(): void {
  cachedValue = null;
  inflight = null;
  if (typeof window !== "undefined") {
    try { window.sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  }
}
