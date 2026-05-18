"use client";

/* ===========================================================================
   useBaseCurrency — single source of truth for the tenant's base
   currency on the client.

   Reads /api/create/defaults (cheap, cached at the browser tab via a
   module-level promise) and exposes the resolved base currency. Falls
   back to "CNY" — never "USD" — so a misconfigured tenant still gets a
   sane label.

   Usage:
     const base = useBaseCurrency();             // string (CNY by default)
     const { base, loading } = useBaseCurrencyDetail();
   ========================================================================== */

import { useEffect, useState } from "react";

const FALLBACK = "CNY";

let cached: Promise<string> | null = null;

function fetchBase(): Promise<string> {
  if (cached) return cached;
  cached = (async () => {
    try {
      const r = await fetch("/api/create/defaults", { cache: "no-store" });
      if (!r.ok) return FALLBACK;
      const j = (await r.json()) as { defaults?: { base_currency?: string } };
      return j.defaults?.base_currency || FALLBACK;
    } catch {
      cached = null;     // allow retry next render
      return FALLBACK;
    }
  })();
  return cached;
}

/** Returns the tenant base currency. While fetching the first time it
 *  returns the fallback so callers never have to handle null. */
export function useBaseCurrency(): string {
  const [base, setBase] = useState<string>(FALLBACK);
  useEffect(() => {
    let cancelled = false;
    void fetchBase().then((c) => { if (!cancelled) setBase(c); });
    return () => { cancelled = true; };
  }, []);
  return base;
}

export function useBaseCurrencyDetail(): { base: string; loading: boolean } {
  const [base, setBase] = useState<string>(FALLBACK);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    void fetchBase().then((c) => {
      if (cancelled) return;
      setBase(c); setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);
  return { base, loading };
}

/** Test-only: reset the cache. */
export function __resetBaseCurrencyCache() { cached = null; }
