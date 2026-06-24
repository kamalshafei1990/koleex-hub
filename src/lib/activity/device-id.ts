"use client";

/* ---------------------------------------------------------------------------
   Stable browser device id.

   A random, non-identifying id minted once per browser and kept in
   localStorage (mirrored to a cookie so it survives storage clears that keep
   cookies, and vice-versa). It is NOT a fingerprint — just a stable handle so
   Super Admin can group a user's sessions/devices. No PII.
   --------------------------------------------------------------------------- */

const KEY = "koleex-device-id";
const COOKIE = "koleex_device_id";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}

function writeCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  // 1-year, lax, path=/. Not HttpOnly — it's a non-secret correlation id.
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
}

function mint(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `dev-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

let cached: string | null = null;

/** Get (or lazily create) the stable device id for this browser. */
export function getDeviceId(): string {
  if (cached) return cached;
  if (typeof window === "undefined") return "ssr";
  let id: string | null = null;
  try {
    id = window.localStorage.getItem(KEY);
  } catch {
    /* storage blocked */
  }
  if (!id) id = readCookie(COOKIE);
  if (!id) id = mint();
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
  writeCookie(COOKIE, id);
  cached = id;
  return id;
}
