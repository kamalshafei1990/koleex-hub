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

async function getState(): Promise<{ favorites: string[]; recent: string[] }> {
  try {
    const res = await fetch("/api/app-launcher", { credentials: "include", cache: "no-store" });
    if (!res.ok) return { favorites: [], recent: [] };
    const json = (await res.json()) as { favorites?: string[]; recent?: string[] };
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
