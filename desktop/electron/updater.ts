/* ---------------------------------------------------------------------------
   Auto-update (electron-updater) — DISABLED by default; manual check wired.

   IMPORTANT: This only updates the DESKTOP SHELL (the .exe/.dmg). Koleex Hub
   *content* always updates instantly via Vercel because the shell loads the
   live production URL — that path needs no app update.

   Shell auto-update stays OFF until:
     1. `publish:` is configured in electron-builder.yml (GitHub Releases
        recommended — see RELEASE.md).
     2. Code signing is in place (unsigned auto-update is rejected by Windows
        SmartScreen / macOS Gatekeeper).
     3. The app is launched with KOLEEX_ENABLE_UPDATER=1.
   Until then `initAutoUpdates` no-ops and the "Check for Updates" menu item
   tells the user updates aren't configured yet (instead of failing silently).
   --------------------------------------------------------------------------- */

import { app, dialog, type BrowserWindow } from "electron";
import { ENABLE_UPDATER } from "./config";
import { IpcChannels, type UpdateStatus } from "./ipc";
import { log } from "./logger";

type AutoUpdater = import("electron-updater").AppUpdater;

let cached: AutoUpdater | null = null;

/** Lazily load electron-updater only when updates are actually enabled. */
function loadUpdater(getWindow: () => BrowserWindow | null): AutoUpdater | null {
  if (cached) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("electron-updater") as typeof import("electron-updater");
    const au = mod.autoUpdater;
    au.autoDownload = true;
    au.autoInstallOnAppQuit = true;
    au.logger = { info: (m: unknown) => log("info", `updater ${String(m)}`), warn: (m: unknown) => log("warn", `updater ${String(m)}`), error: (m: unknown) => log("error", `updater ${String(m)}`), debug: () => {} } as unknown as AutoUpdater["logger"];

    const send = (status: UpdateStatus) => {
      const win = getWindow();
      if (win && !win.isDestroyed()) win.webContents.send(IpcChannels.updateStatus, status);
    };
    au.on("checking-for-update", () => send({ state: "checking" }));
    au.on("update-available", (i) => { log("info", `update available ${i?.version}`); send({ state: "available", version: i?.version }); });
    au.on("update-not-available", () => send({ state: "not-available" }));
    au.on("download-progress", (p) => send({ state: "downloading", percent: p?.percent }));
    au.on("update-downloaded", (i) => { log("info", `update downloaded ${i?.version}`); send({ state: "downloaded", version: i?.version }); });
    au.on("error", (err) => { log("error", "updater error", err); send({ state: "error", message: err?.message }); });

    cached = au;
    return au;
  } catch (e) {
    log("warn", "electron-updater unavailable", e);
    return null;
  }
}

/** Background check on launch (only when fully enabled). */
export function initAutoUpdates(getWindow: () => BrowserWindow | null): void {
  if (!app.isPackaged || !ENABLE_UPDATER) {
    log("info", `auto-update disabled (packaged=${app.isPackaged}, enabled=${ENABLE_UPDATER})`);
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send(IpcChannels.updateStatus, { state: "disabled" } satisfies UpdateStatus);
    return;
  }
  const au = loadUpdater(getWindow);
  if (au) void au.checkForUpdatesAndNotify().catch((e) => log("error", "checkForUpdatesAndNotify failed", e));
}

/** Manual "Check for Updates" from the native menu — always gives feedback. */
export function checkForUpdatesManual(getWindow: () => BrowserWindow | null): void {
  const win = getWindow() ?? undefined;

  if (!app.isPackaged || !ENABLE_UPDATER) {
    void dialog.showMessageBox(win as BrowserWindow, {
      type: "info",
      title: "Check for Updates",
      message: "You're on the latest version.",
      detail:
        "Koleex Hub itself updates automatically — the desktop app always loads " +
        "the latest deployed version, so there's nothing to install.\n\n" +
        "Automatic desktop-app updates will be enabled in a future release once " +
        "code signing is configured.",
      buttons: ["OK"],
      noLink: true,
    });
    return;
  }

  const au = loadUpdater(getWindow);
  if (!au) {
    void dialog.showMessageBox(win as BrowserWindow, {
      type: "warning",
      title: "Check for Updates",
      message: "Update service unavailable.",
      detail: "Could not start the updater. Please try again later.",
      buttons: ["OK"],
      noLink: true,
    });
    return;
  }
  log("info", "manual update check requested");
  void au.checkForUpdates().catch((e) => log("error", "manual checkForUpdates failed", e));
}
