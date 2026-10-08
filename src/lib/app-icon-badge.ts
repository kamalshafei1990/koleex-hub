/* ---------------------------------------------------------------------------
   app-icon-badge — the number on the installed app's icon (owner, 26/09).

   The icon says what the header's bell says: unread notifications plus
   unread Discuss messages. It is set with the standard Badging API
   (navigator.setAppBadge), which reaches:
     · the Hub installed from the browser — iPhone / iPad Home Screen
       (iOS 16.4+, once notifications are allowed), Chrome / Edge on Mac and
       Windows
     · the Mac desktop app — Electron maps the same call to the dock's count
       (shell/browser/badging), so the shell needs no change
   Elsewhere (a plain tab, Android, the Windows desktop app) the call is
   missing or ignored, and nothing else changes.

   While the Hub is closed the service worker keeps the number moving: each
   push carries the recipient's own unread count (lib/server/web-push), and
   the worker adds the Discuss part it was last told from here.

   Never another person's number: during view-as nothing is set. Sign-out
   clears it (session-caches).
   --------------------------------------------------------------------------- */
import { currentScopeKey } from "@/lib/me-bootstrap";

type BadgeNavigator = Navigator & {
  setAppBadge?: (n?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

/* The page's own last reading. The service worker can paint the icon behind
   the page's back (a push that arrives while the Hub is open — a Discuss
   message in the chat already on screen adds one there, and the page's count
   never moves), so the page does NOT skip a paint because it "already showed
   that number": it re-asserts what it knows after every push the worker
   paints, and whenever the window comes back into view. Owner, 29/09/2026:
   the dock said 3 while the bell said nothing. */
let last: { inbox: number; discuss: number } | null = null;
let listening = false;
let reassertTimer: ReturnType<typeof setTimeout> | undefined;

/** The bell's two halves; the icon shows their sum. */
export function setIconBadge(inbox: number, discuss: number): void {
  if (typeof navigator === "undefined") return;
  if (!currentScopeKey().endsWith(":self")) return;
  const i = Math.max(0, Math.floor(inbox) || 0);
  const d = Math.max(0, Math.floor(discuss) || 0);
  last = { inbox: i, discuss: d };
  listen();
  tell(i, d);
  paint(i + d);
}

/** Sign-out: no number stays on the icon for the next person. */
export function clearIconBadge(): void {
  if (typeof navigator === "undefined") return;
  last = null;
  tell(0, 0);
  paint(0);
}

/* Put the page's reading back on the icon — a little after a push, so the
   bell's realtime has had its moment to count a genuinely new item first. */
function reassert(delayMs: number): void {
  clearTimeout(reassertTimer);
  reassertTimer = setTimeout(() => {
    if (!last || !currentScopeKey().endsWith(":self")) return;
    tell(last.inbox, last.discuss);
    paint(last.inbox + last.discuss);
  }, delayMs);
}

function listen(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  try {
    navigator.serviceWorker?.addEventListener("message", (e: MessageEvent) => {
      if ((e.data as { type?: string } | null)?.type === "kx-icon-badge-painted") reassert(4000);
    });
  } catch { /* no service workers here */ }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") reassert(0);
  });
  window.addEventListener("focus", () => reassert(0));
}

/* The worker keeps the halves, so a push while the Hub is closed adds to the
   right base. Sent every time: the worker's copy can drift the same way. */
function tell(inbox: number, discuss: number): void {
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: "kx-icon-badge", inbox, discuss });
  } catch { /* no worker in control — the open page still sets the icon */ }
}

function paint(total: number): void {
  const nav = navigator as BadgeNavigator;
  try {
    const done = total > 0 ? nav.setAppBadge?.(total) : nav.clearAppBadge?.();
    void done?.catch(() => { /* not installed, or not allowed: nothing to show */ });
  } catch { /* unsupported */ }
}
