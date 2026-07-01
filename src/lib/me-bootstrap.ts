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
    /* Present even when no view-as is active (false / null) so the
       client can branch on it without optional-chaining surprises. */
    viewing_as?: boolean;
    real_account_id?: string | null;
    view_as_kind?: "account" | "role" | null;
    view_as_role_id?: string | null;
  }) | null;
  header: Record<string, unknown> | null;
  permittedModules: string[];
  isSuperAdmin: boolean;
  /* When a super admin is "viewing as", the server fills this with
     either the target USER's identity (kind="account") or the target
     ROLE's identity (kind="role"). The banner renders on this; the
     picker hides itself when it's set (the banner's Exit is the only
     way out). */
  viewingAs?:
    | {
        kind: "account";
        targetAccountId: string;
        targetUsername: string | null;
        targetDisplayName: string | null;
        realAccountId: string | null;
      }
    | {
        kind: "role";
        targetRoleId: string | null;
        targetRoleName: string | null;
        realAccountId: string | null;
      }
    | null;
}

/* Client-side bootstrap cache.
 *
 * Was 10s; bumped to 60s. Rationale:
 *  - The payload is derived from the account row, the role, the
 *    module permissions, and the tenant — all of which change
 *    infrequently (role edits, dept changes, etc., are admin actions
 *    that happen once a week at most).
 *  - A 10s TTL means any user clicking through 4 apps in a minute
 *    re-fetches 6 times. At ~200ms RTT to the Tokyo DB, that's
 *    ~1.2s of waste per minute of active use.
 *  - invalidateMeBootstrap() is still called after writes that DO
 *    change the payload (role changes, preferences saves, etc.), so
 *    stale data after real changes is handled explicitly — bumping
 *    the idle TTL doesn't hurt freshness in practice.
 *
 * HTTP Cache-Control on /api/me/bootstrap was bumped to match so the
 * browser fetch layer ALSO avoids the round trip. */
const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  payload: MeBootstrapPayload;
  expiresAt: number;
}

let cache: CacheEntry | null = null;
let inflight: Promise<MeBootstrapPayload | null> | null = null;
const listeners = new Set<(p: MeBootstrapPayload | null) => void>();

/* ---------------------------------------------------------------------------
   Persistence warm-start (stale-while-revalidate across full page reloads).

   The in-memory `cache` above dies on a hard reload / new tab, so after a
   browser refresh the very first paint used to block on the network again.
   We mirror the last successful payload into localStorage so a fresh load can
   paint the shell instantly from the last-known identity + permitted modules,
   then revalidate in the background.

   This is a PAINT HINT only — it never changes enforcement. Every API call is
   still authorized server-side, and the persisted TTL matches the in-memory
   one so anything older than 60s is shown-then-immediately-revalidated. On any
   permission change (invalidateMeBootstrap) or 401 the mirror is cleared, so
   stale rights can't linger. Persisted data is only ever this user's own
   already-client-visible module list — no secrets.
   --------------------------------------------------------------------------- */
const PERSIST_KEY = "koleex.me-bootstrap.v1";
/* Never warm-start from a mirror older than this (defensive against a very
   stale tab restored days later); background revalidation still runs. */
const PERSIST_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function persistCache(payload: MeBootstrapPayload): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({ payload, savedAt: Date.now() }),
    );
  } catch {
    /* private mode / quota — persistence is best-effort */
  }
}

function clearPersisted(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PERSIST_KEY);
  } catch {
    /* ignore */
  }
}

function readPersisted(): CacheEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PERSIST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { payload: MeBootstrapPayload; savedAt: number };
    if (!parsed || typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > PERSIST_MAX_AGE_MS) return null;
    /* Honest expiry: if the mirror is younger than the in-memory TTL treat it
       as fresh (instant, no refetch); otherwise it paints then revalidates. */
    return { payload: parsed.payload, expiresAt: parsed.savedAt + CACHE_TTL_MS };
  } catch {
    return null;
  }
}

/* Warm the in-memory cache from the persisted mirror on first client load. */
if (typeof window !== "undefined" && !cache) {
  const warm = readPersisted();
  if (warm) cache = warm;
}

/**
 * Force the next caller to re-fetch. Call this after actions that change
 * the user's permissions or profile (e.g. saving a role override).
 */
export function invalidateMeBootstrap(): void {
  cache = null;
  inflight = null;
  clearPersisted();
}

/**
 * Manually seed the cache. Used by the sign-in flow — saves one round
 * trip by reusing the signin response.
 */
export function seedMeBootstrap(payload: MeBootstrapPayload): void {
  cache = { payload, expiresAt: Date.now() + CACHE_TTL_MS };
  persistCache(payload);
  for (const cb of listeners) cb(payload);
}

/* Mobile-resilience tuning. Empty-launcher reports traced back to
   /api/me/bootstrap hanging on flaky cellular networks AND to Vercel
   serverless + Supabase (Tokyo region) cold starts that can hit
   6-10 s on a fresh container. The previous 8 s budget aborted right
   in the middle of those cold starts, so the user got a "couldn't
   load" banner even though the server was just slow on its first
   wake. Allow a longer first attempt; shorter retries. */
const TIMEOUTS_MS  = [15_000, 8_000, 8_000];
const MAX_RETRIES  = TIMEOUTS_MS.length;

/** Last error captured by getMeBootstrap so the UI can show a Retry CTA.
 *  Structured so the UI can surface a useful hint instead of a raw
 *  error message. */
export interface BootstrapFailure {
  /** "timeout" | "http_<status>" | "network" — a stable short code. */
  kind: string;
  /** Friendly sentence for the operator. */
  message: string;
  /** Raw error string for debugging. */
  raw: string;
  /** Last HTTP status seen, if any. */
  status?: number;
}
let _lastError: BootstrapFailure | null = null;
export function getMeBootstrapLastError(): BootstrapFailure | null { return _lastError; }

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  noStore = false,
): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      credentials: "include",
      signal: controller.signal,
      /* When the caller knows we just did something that changes the
         server-side identity (entering / exiting view-as), force the
         browser to skip its HTTP cache for THIS request. Default path
         keeps the normal caching so most page loads stay cheap. */
      cache: noStore ? "no-store" : "default",
    });
  } finally {
    clearTimeout(t);
  }
}

/**
 * Fetch (or return cached) bootstrap. Safe to call many times —
 * concurrent calls dedupe onto the same in-flight promise.
 *
 * Now resilient on mobile: bounded timeout per request + exponential
 * backoff retries. On total failure resolves to null but records
 * _lastError so the UI can show "Retry".
 */
export async function getMeBootstrap(opts?: {
  noStore?: boolean;
}): Promise<MeBootstrapPayload | null> {
  const noStore = !!opts?.noStore;
  /* Skip the in-memory cache when noStore is set — the caller just
     changed identity (entered or exited view-as) and needs the freshest
     possible payload. */
  if (!noStore && cache && cache.expiresAt > Date.now()) return cache.payload;
  if (!noStore && inflight) return inflight;
  inflight = (async () => {
    try {
      for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
        const timeoutMs = TIMEOUTS_MS[attempt];
        try {
          const res = await fetchWithTimeout("/api/me/bootstrap", timeoutMs, noStore);
          if (!res.ok) {
            /* Capture status so the UI can hint specifically — 401 →
               "please sign in again", 5xx → "server is having a
               moment". */
            _lastError = {
              kind: `http_${res.status}`,
              status: res.status,
              raw: `bootstrap returned ${res.status}`,
              message:
                res.status === 401
                  ? "Session expired — please sign in again."
                  : res.status >= 500
                    ? "Server is having a moment. Tap Retry."
                    : `Server responded ${res.status}. Tap Retry.`,
            };
            if (res.status === 401) {
              cache = null;
              clearPersisted();
              for (const cb of listeners) cb(null);
              return null;   // No point retrying 401
            }
            throw new Error(_lastError.raw);
          }
          const payload = (await res.json()) as MeBootstrapPayload;
          cache = { payload, expiresAt: Date.now() + CACHE_TTL_MS };
          persistCache(payload);
          _lastError = null;
          for (const cb of listeners) cb(payload);
          return payload;
        } catch (e) {
          const raw = e instanceof Error ? e.message : String(e);
          const timedOut = raw.includes("aborted") || raw.toLowerCase().includes("timeout") || (e as Error)?.name === "AbortError";
          if (!_lastError || _lastError.kind.startsWith("http_") === false) {
            _lastError = {
              kind: timedOut ? "timeout" : "network",
              raw,
              message: timedOut
                ? `Server didn't respond in ${(timeoutMs / 1000).toFixed(0)} s. Tap Retry — likely a slow connection or a cold server.`
                : "Connection problem. Tap Retry.",
            };
          }
          if (attempt < MAX_RETRIES - 1) {
            /* Exponential backoff: 800ms, 2400ms between retries. */
            await new Promise((r) => setTimeout(r, 800 * (attempt + 1) * (attempt + 1)));
            continue;
          }
          cache = null;
          /* Notify listeners that loading is over (with no payload) so
             the UI swaps from skeleton to "Retry" instead of hanging. */
          for (const cb of listeners) cb(null);
          return null;
        }
      }
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Force a re-fetch from a UI Retry button. Bypasses the dedupe path
 *  AND the browser HTTP cache (necessary after a view-as toggle, where
 *  the server response shape changes but the URL is unchanged). */
export async function retryMeBootstrap(): Promise<MeBootstrapPayload | null> {
  invalidateMeBootstrap();
  return getMeBootstrap({ noStore: true });
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
