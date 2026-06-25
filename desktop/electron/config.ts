/* ---------------------------------------------------------------------------
   Central config for the Koleex Hub desktop shell.

   The shell is a thin native window that ALWAYS loads the live production
   deployment (Vercel), so deploying to the web instantly updates every desktop
   user — no reinstall. The target URL is overridable at build time via
   KOLEEX_APP_URL so a staging build can point elsewhere without code changes.
   --------------------------------------------------------------------------- */

export const APP_NAME = "Koleex Hub";

/* The always-live production target. */
export const APP_URL = (process.env.KOLEEX_APP_URL || "https://hub.koleexgroup.com").trim();

export const APP_ORIGIN = (() => {
  try {
    return new URL(APP_URL).origin;
  } catch {
    return "https://hub.koleexgroup.com";
  }
})();

/* Origins the shell may navigate to IN-WINDOW. Anything else is opened in the
   user's default browser. Supabase is included for the rare case a storage /
   auth redirect navigates the top frame; ordinary API/XHR calls are unaffected
   by this list. Keep this tight. */
export const ALLOWED_NAVIGATION_ORIGINS: string[] = [
  APP_ORIGIN,
  "https://yxyizbnfjrwrnmwhkvme.supabase.co",
];

/* Schemes we will hand to the OS browser via shell.openExternal. */
export const EXTERNAL_SCHEMES = new Set(["https:", "http:", "mailto:", "tel:"]);

/* electron-builder appId — also used as the Windows AppUserModelID so native
   toast notifications are attributed to Koleex Hub (not electron.exe). */
export const APP_ID = "com.koleex.hub";

/* True only when running locally for development (npm run dev). */
export const IS_DEV = process.env.KOLEEX_DEV === "1";

/* Optional features — off by default, opt-in via env so the default build
   stays lean and predictable. */
export const ENABLE_TRAY = process.env.KOLEEX_TRAY === "1";
/* Auto-update is intentionally DISABLED this round (no code-signing yet).
   Flip to "1" only once signing + a publish provider are configured. */
export const ENABLE_UPDATER = process.env.KOLEEX_ENABLE_UPDATER === "1";
