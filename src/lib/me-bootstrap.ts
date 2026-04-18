"use client";

/* ---------------------------------------------------------------------------
   me-bootstrap — single source of truth for the per-user data that every
   Hub page needs on mount: ServerAuthContext, header account row, and the
   set of modules the caller is permitted to see.

   Before this module, each of the three hooks (useScopeContext,
   useCurrentAccount, usePermittedModules) issued its own GET request, and
   each of those hooks was instantiated in multiple places (MainHeader,
   Sidebar, page components, PermissionGate). Result: 3–4 hits per nav.

   Now every hook subscribes to a shared promise. First caller triggers
   the fetch; every subsequent caller within that ~10s cache window sees
   the cached value without a round trip.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import type { ScopeContext } from "./scope";

export interface MeBootstrapPayload {
  auth: (ScopeContext & {
    username: string;
    login_email: string;
    status: string;
    user_type: string;
  }) | null;
  header: Record<string, unknown> | null;
  permittedModules: string[];
  isSuperAdmin: boolean;
}

const CACHE_TTL_MS = 10_000; // align with the HTTP Cache-Control max-age

interface CacheEntry {
  payload: MeBootstrapPayload;
  expiresAt: number;
}

let cache: CacheEntry | null = null;
let inflight: Promise<MeBootstrapPayload | null> | null = null;
const listeners = new Set<(p: MeBootstrapPayload | null) => void>();

/**
 * Force the next caller to re-fetch. Call this after actions that change
 * the user's permissions or profile (e.g. saving a role override).
 */
export function invalidateMeBootstrap(): void {
  cache = null;
  inflight = null;
}

/**
 * Manually seed the cache. Used by the sign-in flow — saves one round
 * trip by reusing the signin response.
 */
export function seedMeBootstrap(payload: MeBootstrapPayload): void {
  cache = { payload, expiresAt: Date.now() + CACHE_TTL_MS };
  for (const cb of listeners) cb(payload);
}

/**
 * Fetch (or return cached) bootstrap. Safe to call many times —
 * concurrent calls dedupe onto the same in-flight promise.
 */
export async function getMeBootstrap(): Promise<MeBootstrapPayload | null> {
  if (cache && cache.expiresAt > Date.now()) return cache.payload;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch("/api/me/bootstrap", { credentials: "include" });
      if (!res.ok) {
        cache = null;
        return null;
      }
      const payload = (await res.json()) as MeBootstrapPayload;
      cache = { payload, expiresAt: Date.now() + CACHE_TTL_MS };
      for (const cb of listeners) cb(payload);
      return payload;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/**
 * React hook — subscribes to the cached bootstrap. Re-renders only when
 * the cached value changes. Kicks off a fetch on first mount if nothing
 * is cached yet.
 */
export function useMeBootstrap(): {
  data: MeBootstrapPayload | null;
  loading: boolean;
} {
  const [data, setData] = useState<MeBootstrapPayload | null>(
    () => cache?.payload ?? null,
  );
  const [loading, setLoading] = useState(
    () => !(cache && cache.expiresAt > Date.now()),
  );

  useEffect(() => {
    let cancelled = false;
    const onChange = (p: MeBootstrapPayload | null) => {
      if (!cancelled) {
        setData(p);
        setLoading(false);
      }
    };
    listeners.add(onChange);

    if (cache && cache.expiresAt > Date.now()) {
      setData(cache.payload);
      setLoading(false);
    } else {
      void getMeBootstrap().then((p) => {
        if (!cancelled) {
          setData(p);
          setLoading(false);
        }
      });
    }
    return () => {
      cancelled = true;
      listeners.delete(onChange);
    };
  }, []);

  return { data, loading };
}
