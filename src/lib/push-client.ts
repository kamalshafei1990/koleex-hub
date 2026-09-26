"use client";

/* ---------------------------------------------------------------------------
   Client Web Push helpers — subscribe / unsubscribe the current device.

   iOS note: push only works when the app was added to the Home Screen and is
   running in standalone mode (`navigator.standalone` / display-mode standalone)
   on iOS/iPadOS 16.4+. `isPushSupported()` reflects that.
   --------------------------------------------------------------------------- */

import { getDeviceId } from "@/lib/activity/device-id";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** False when the server's push key never reached this build. */
export function isPushConfigured(): boolean {
  return !!VAPID_PUBLIC;
}

/** True if this browser can do Web Push. On iOS this also requires the app to
 *  be installed to the Home Screen (standalone). */
export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  const hasApis =
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!hasApis) return false;
  // iOS: must be standalone (installed PWA). Other platforms: fine in-browser.
  const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isiOS) {
    const standalone =
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      window.matchMedia?.("(display-mode: standalone)").matches;
    return !!standalone;
  }
  return true;
}

/** Whether iOS but not yet installed to Home Screen (so we can guide the user). */
export function isIosNeedsInstall(): boolean {
  if (typeof navigator === "undefined") return false;
  const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (!isiOS) return false;
  const standalone =
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    window.matchMedia?.("(display-mode: standalone)").matches;
  return !standalone;
}

export function permissionState(): NotificationPermission | "unsupported" {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

/** Request permission, subscribe via the SW, and persist on the server. */
export async function subscribeToPush(deviceName?: string): Promise<{ ok: boolean; error?: string }> {
  if (!VAPID_PUBLIC) return { ok: false, error: "Push isn’t configured on the server (missing VAPID key)." };
  if (!isPushSupported()) {
    return {
      ok: false,
      error: isIosNeedsInstall()
        ? "On iPhone, first add Koleex Hub to your Home Screen and open it from there."
        : "This browser doesn’t support push notifications.",
    };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, error: "Notification permission was not granted." };

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) as BufferSource,
    });
  }

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON(), deviceId: getDeviceId(), deviceName }),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: j.error || "Failed to save subscription." };
  }
  return { ok: true };
}

/* ── Whose device is this? ─────────────────────────────────────────────────
   The server keeps one row per push endpoint and gives it to the account
   that last saved it. The endpoint belongs to the DEVICE, not the person —
   so after one person signs out and another signs in, the row still named
   the first: the second got nothing, and the first person's notifications
   kept landing on this phone (26/09/2026: the owner's iPhone, enabled while
   signed in as another user, stayed theirs after he signed back in as
   himself; the settings card said "on" because it only asked the phone).
   Two rules close it: sign-out releases the device (releasePushOnSignOut),
   and every signed-in open re-saves an EXISTING subscription for whoever is
   signed in now (resyncPushSubscription) — never a prompt, never a new
   subscription; turning push on stays the user's own tap. */
const SYNCED_KEY = "kx-push-synced";

/** Resolves to the promise's value, or null once `ms` pass — for calls that
 *  must never hold the UI (serviceWorker.ready never settles without a SW). */
function within<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);
}

/** Re-save this device's existing subscription for `accountId`. Only when the
 *  permission is already granted and a subscription already exists; one
 *  request per (account, endpoint) pair — remembered locally. */
export async function resyncPushSubscription(accountId: string | null): Promise<void> {
  try {
    if (!accountId || !VAPID_PUBLIC || !isPushSupported() || permissionState() !== "granted") return;
    const reg = await within(navigator.serviceWorker.ready, 4000);
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (!sub) return;
    const pair = `${accountId}|${sub.endpoint}`;
    try { if (localStorage.getItem(SYNCED_KEY) === pair) return; } catch { /* no storage: just re-save */ }
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON(), deviceId: getDeviceId() }),
    });
    if (res.ok) try { localStorage.setItem(SYNCED_KEY, pair); } catch { /* ignore */ }
  } catch { /* best effort — the next open tries again */ }
}

/** Sign-out: this device stops receiving this account's notifications. The
 *  server row first (the session is still valid), then the subscription
 *  itself — even if the server call fails, a dropped subscription cannot be
 *  delivered to (the push service answers 410 and web-push retires the row).
 *  Bounded, so it can never hold a sign-out up. */
export async function releasePushOnSignOut(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  await within(unsubscribeCurrent(), 2500);
  try { localStorage.removeItem(SYNCED_KEY); } catch { /* ignore */ }
}

/** Unsubscribe this device locally + mark inactive on the server. */
export async function unsubscribeCurrent(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
  } catch {
    /* ignore */
  }
}
