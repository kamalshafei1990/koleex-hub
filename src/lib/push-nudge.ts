"use client";

/* ---------------------------------------------------------------------------
   push-nudge — should the bell offer "Get notifications on this device"?

   26/09/2026: one device in the whole company received push — the owner's
   iPhone. Everyone else saw notifications only inside the bell, because the
   one switch that turns push on sits deep in Settings → Notifications. The
   bell now offers it on any device that can receive push and doesn't yet
   (owner: "اعمل 1").

   The answer is worked out BEFORE the panel opens and kept here, so the card
   is either there when the panel paints or not at all — never pushed in
   above the rows a moment later. The Gate prepares it while warming the
   bell; the bell reads it synchronously each time it opens.

   Offered only when it can work, for the person it would reach:
     · never during view-as (the device would be saved for someone else),
     · never in the desktop app (Electron has no push service to subscribe to),
     · never once push is on here, or blocked by the browser,
     · never again for this person on this device after they close it (✕).
   On an iPhone or iPad outside the Home Screen app, push cannot work yet, so
   the card says how to add it instead.
   --------------------------------------------------------------------------- */

import { currentScopeKey } from "@/lib/me-bootstrap";
import { isIosNeedsInstall, isPushConfigured, isPushSupported, permissionState } from "@/lib/push-client";

/** "offer": a Turn on button · "install": iPhone/iPad, add to Home Screen first. */
export type PushNudge = "offer" | "install" | null;

/* Per person, per device. Deliberately outside the sign-out sweep's
   prefixes (kx_ / kx:): a closed offer stays closed after signing back in. */
const KEY = "kx-push-nudge:";

let known: { account: string; nudge: PushNudge } | null = null;

/** What the bell shows when it opens now — null while not yet worked out. */
export function peekPushNudge(accountId: string | null): PushNudge {
  return accountId && known?.account === accountId ? known.nudge : null;
}

/** Work the answer out (again) and keep it for the next open. */
export async function preparePushNudge(accountId: string | null): Promise<void> {
  if (!accountId || typeof window === "undefined") return;
  const nudge = await decide(accountId);
  if (nudge !== undefined) known = { account: accountId, nudge };
}

/** Stop offering it. ✕ remembers (this person, this device, for good);
 *  turning push on doesn't need to — the subscription itself answers, and
 *  after a sign-out releases it the offer comes back, as it should. */
export function closePushNudge(accountId: string, remember: boolean): void {
  known = { account: accountId, nudge: null };
  if (remember) try { localStorage.setItem(KEY + accountId, "1"); } catch { /* no storage: closed for this session */ }
}

/** undefined = can't tell yet (the session isn't loaded) — ask again later. */
async function decide(accountId: string): Promise<PushNudge | undefined> {
  const scope = currentScopeKey();
  if (scope === "anon") return undefined;
  if (!scope.endsWith(":self")) return null;
  if ((window as { koleex?: { isDesktop?: boolean } }).koleex?.isDesktop) return null;
  try { if (localStorage.getItem(KEY + accountId)) return null; } catch { /* no storage: offer */ }
  if (!isPushConfigured()) return null;
  if (isIosNeedsInstall()) return "install";
  if (!isPushSupported()) return null;
  const permission = permissionState();
  if (permission === "denied" || permission === "unsupported") return null;
  if (permission === "granted") {
    /* Allowed before — on only if this device still holds a subscription
       (sign-out releases it, so after a new sign-in it is offered again). */
    try {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((r) => setTimeout(() => r(null), 4000)),
      ]);
      if (!reg) return undefined;
      if (await reg.pushManager.getSubscription()) return null;
    } catch { return null; }
  }
  return "offer";
}
