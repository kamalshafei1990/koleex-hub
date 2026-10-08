"use client";

/* ---------------------------------------------------------------------------
   app-launcher — per-user App Launcher favorites + recent-apps tracking.

   These hit RLS-locked tables (koleex_app_favorites / koleex_app_recent), so
   all access goes through /api/app-launcher, which uses the authenticated
   session + service-role client server-side. (Previously these used the
   browser anon client directly and were rejected by RLS — that was the
   recurring "trackAppOpen … row violates row-level security policy" error.)

   The `accountId` parameter is kept for call-site compatibility but is no
   longer trusted on the client — the server derives the account from the
   session.
   --------------------------------------------------------------------------- */

import { cachedGet, invalidateCachedGet } from "@/lib/client-cache";

/* Session-cached through the Hub's ONE reference-data layer
   (lib/client-cache, measured 2026-10-08): the launcher state used to be
   re-fetched on EVERY home mount — fetchFavorites and fetchRecent each
   called getState, and StrictMode doubled it again: 2-4 China→Tokyo
   round-trips (~700-900 ms each) for two small arrays that change only
   when the user (un)favorites or opens an app. Now one fetch per 60 s
   window, and every successful write below invalidates so the next read
   is fresh where it matters. */
async function getState(): Promise<{ favorites: string[]; recent: string[] }> {
  try {
    const json = await cachedGet<{ favorites?: string[]; recent?: string[] }>("/api/app-launcher", 60_000);
    return { favorites: Array.isArray(json.favorites) ? json.favorites : [], recent: Array.isArray(json.recent) ? json.recent : [] };
  } catch { return { favorites: [], recent: [] }; }
}

async function post(action: string, appId: string): Promise<boolean> {
  try {
    const res = await fetch("/api/app-launcher", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, app_id: appId }),
    });
    /* The state just changed server-side — the cache must not serve the
       pre-write arrays to the next reader (e.g. home after opening an app). */
    if (res.ok) invalidateCachedGet("/api/app-launcher");
    return res.ok;
  } catch { return false; }
}

/* ── Favorites ── */
export async function fetchFavorites(_accountId: string): Promise<string[]> {
  return (await getState()).favorites;
}
export async function addFavorite(_accountId: string, appId: string): Promise<boolean> {
  return post("favorite", appId);
}
export async function removeFavorite(_accountId: string, appId: string): Promise<boolean> {
  return post("unfavorite", appId);
}

/* ── Recent apps ── */
export async function fetchRecent(_accountId: string, limit = 8): Promise<string[]> {
  return (await getState()).recent.slice(0, limit);
}
export async function trackAppOpen(_accountId: string, appId: string): Promise<void> {
  await post("track", appId);
}
