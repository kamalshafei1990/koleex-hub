/* ---------------------------------------------------------------------------
   Electron security hardening (applied to every window + session).

   Follows the Electron security checklist:
     · contextIsolation ON, nodeIntegration OFF, sandbox ON (set on the window).
     · No in-window popups — window.open / target=_blank go to the OS browser.
     · Navigation is pinned to the Koleex origin; anything else opens externally.
     · webview tags are denied.
     · Permission requests default-deny, with a tight allow-list (notifications,
       clipboard) needed by the web app.
   None of this weakens Koleex Hub's own (server-side) security model.
   --------------------------------------------------------------------------- */

import { shell, type WebContents, type Session } from "electron";
import { ALLOWED_NAVIGATION_ORIGINS, EXTERNAL_SCHEMES } from "./config";

function originAllowed(targetUrl: string): boolean {
  try {
    return ALLOWED_NAVIGATION_ORIGINS.includes(new URL(targetUrl).origin);
  } catch {
    return false;
  }
}

/** Open a vetted http(s)/mailto/tel URL in the user's default browser. */
function openExternal(targetUrl: string): void {
  try {
    const scheme = new URL(targetUrl).protocol;
    if (EXTERNAL_SCHEMES.has(scheme)) void shell.openExternal(targetUrl);
  } catch {
    /* ignore malformed URLs */
  }
}

/** Harden a single window's webContents. Call once per BrowserWindow. */
export function applyContentsSecurity(contents: WebContents): void {
  // window.open / target="_blank" → never open an Electron popup; hand to OS.
  contents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: "deny" };
  });

  // Block top-frame navigation away from the Koleex origin (e.g. an external
  // link that isn't target=_blank). Same-origin navigation is allowed.
  contents.on("will-navigate", (event, url) => {
    if (!originAllowed(url)) {
      event.preventDefault();
      openExternal(url);
    }
  });

  // Never allow <webview> embedding.
  contents.on("will-attach-webview", (event) => event.preventDefault());

  // Block in-page redirects to disallowed origins too.
  contents.on("will-redirect", (event, url) => {
    if (!originAllowed(url)) event.preventDefault();
  });
}

/** Session-wide permission gate. Default-deny; allow only what the web app needs. */
export function applySessionSecurity(session: Session): void {
  const ALLOWED_PERMISSIONS = new Set<string>([
    "notifications",
    "clipboard-read",
    "clipboard-sanitized-write",
  ]);

  session.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(ALLOWED_PERMISSIONS.has(permission));
  });

  // Synchronous checks (e.g. some clipboard paths) — mirror the same policy.
  session.setPermissionCheckHandler((_wc, permission) =>
    ALLOWED_PERMISSIONS.has(permission),
  );
}
