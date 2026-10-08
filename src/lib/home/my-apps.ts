/* ---------------------------------------------------------------------------
   My apps — the row of a person's own apps at the top of Home (owner pick F,
   23 Sep 2026: "My apps" on top, every app by group below).

   Stored in accounts.preferences.home_apps (no migration), mirrored in
   localStorage so the row paints on the first frame from the device's copy —
   Home makes no request of its own for it. The account's value, which comes
   with the account Home already loads, wins when it arrives.

   `source` is what makes seeding a one-time event:
     "none"  — never set: Home seeds it ONCE from the person's own page views
               of the last 30 days (GET /api/home/app-usage), padded with
               their apps in launcher order so the row is always full;
     "usage" — seeded, not yet touched;
     "user"  — edited by the person. Never re-seeded, even when empty.
   --------------------------------------------------------------------------- */

export type HomeAppsSource = "none" | "usage" | "user";
export interface HomeAppsPref {
  pins: string[];
  source: HomeAppsSource;
}

/** How many apps the row is seeded with (one full row on a 1440 px screen). */
export const MY_APPS_SEED = 10;
/** Most apps a person can pin. */
export const MY_APPS_MAX = 20;
export const HOME_APPS_NONE: HomeAppsPref = { pins: [], source: "none" };

const CACHE_KEY = "koleex-home-apps";

/** Validate an untrusted value (jsonb, localStorage) into the pref shape. */
export function readHomeAppsPref(raw: unknown): HomeAppsPref | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { pins?: unknown; source?: unknown };
  if (!Array.isArray(r.pins)) return null;
  const source: HomeAppsSource = r.source === "usage" || r.source === "user" || r.source === "none" ? r.source : "none";
  const seen = new Set<string>();
  const pins: string[] = [];
  for (const p of r.pins) {
    if (typeof p !== "string" || !p || p.length > 64 || seen.has(p)) continue;
    seen.add(p);
    pins.push(p);
    if (pins.length >= MY_APPS_MAX) break;
  }
  return { pins, source };
}

/** The device's copy, only when it belongs to this account. */
export function readCachedHomeApps(accountId: string | null): HomeAppsPref | null {
  if (!accountId || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { accountId?: unknown; pref?: unknown };
    if (v.accountId !== accountId) return null;
    return readHomeAppsPref(v.pref);
  } catch {
    return null;
  }
}

export function cacheHomeApps(accountId: string | null, pref: HomeAppsPref): void {
  if (!accountId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ accountId, pref }));
  } catch {
    /* quota / private mode: the row still works for this visit */
  }
}

interface RoutedApp { id: string; route: string }

/** The app a visited path belongs to: the longest app route it starts with. */
export function appForPath(path: string, apps: readonly RoutedApp[]): string | null {
  let best: RoutedApp | null = null;
  for (const a of apps) {
    if (!a.route || a.route === "/") continue;
    if (path === a.route || path.startsWith(a.route + "/")) {
      if (!best || a.route.length > best.route.length) best = a;
    }
  }
  return best ? best.id : null;
}

/**
 * The seed: the apps this person opened most, then their other apps in
 * launcher order until the row holds `count` (or every app they have).
 * `views` maps app route → page views.
 */
export function seedPins(views: Readonly<Record<string, number>>, visible: readonly RoutedApp[], count = MY_APPS_SEED): string[] {
  const byApp = new Map<string, number>();
  for (const [route, n] of Object.entries(views)) {
    if (!Number.isFinite(n) || n <= 0) continue;
    const id = appForPath(route, visible);
    if (id) byApp.set(id, (byApp.get(id) ?? 0) + n);
  }
  const order = new Map(visible.map((a, i) => [a.id, i]));
  const used = [...byApp.entries()]
    .sort((a, b) => b[1] - a[1] || (order.get(a[0]) ?? 0) - (order.get(b[0]) ?? 0))
    .map(([id]) => id);
  const pins = used.slice(0, count);
  for (const a of visible) {
    if (pins.length >= Math.min(count, visible.length)) break;
    if (!pins.includes(a.id)) pins.push(a.id);
  }
  return pins;
}

/* Saves go through the existing self-edit route, which merges ONE top-level
   key atomically on the server, so this never touches another preference.
   Chained per session so two quick edits cannot land out of order. */
let saveChain: Promise<unknown> = Promise.resolve();
export function saveHomeApps(accountId: string | null, pref: HomeAppsPref): Promise<boolean> {
  if (!accountId) return Promise.resolve(false);
  const run = saveChain.then(async () => {
    try {
      const res = await fetch(`/api/accounts/${encodeURIComponent(accountId)}/preferences`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: { home_apps: pref } }),
      });
      return res.ok;
    } catch {
      return false;
    }
  });
  saveChain = run.catch(() => undefined);
  return run;
}
