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

let shown: number | null = null;
let told = "";

/** The bell's two halves; the icon shows their sum. */
export function setIconBadge(inbox: number, discuss: number): void {
  if (typeof navigator === "undefined") return;
  if (!currentScopeKey().endsWith(":self")) return;
  const i = Math.max(0, Math.floor(inbox) || 0);
  const d = Math.max(0, Math.floor(discuss) || 0);
  tell(i, d);
  paint(i + d);
}

/** Sign-out: no number stays on the icon for the next person. */
export function clearIconBadge(): void {
  if (typeof navigator === "undefined") return;
  tell(0, 0);
  paint(0);
}

/* The worker keeps the halves, so a push while the Hub is closed adds to the
   right base. Told only when they change. */
function tell(inbox: number, discuss: number): void {
  const parts = `${inbox}|${discuss}`;
  if (parts === told) return;
  told = parts;
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: "kx-icon-badge", inbox, discuss });
  } catch { /* no worker in control — the open page still sets the icon */ }
}

function paint(total: number): void {
  if (total === shown) return;
  shown = total;
  const nav = navigator as BadgeNavigator;
  try {
    const done = total > 0 ? nav.setAppBadge?.(total) : nav.clearAppBadge?.();
    void done?.catch(() => { /* not installed, or not allowed: nothing to show */ });
  } catch { /* unsupported */ }
}
