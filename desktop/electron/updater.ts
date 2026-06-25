/* ---------------------------------------------------------------------------
   Auto-update scaffold (electron-updater) — DISABLED by default.

   IMPORTANT: This only updates the DESKTOP SHELL (the .exe/.dmg). The Koleex
   Hub *content* always updates instantly via Vercel because the shell loads
   the live production URL — that path needs no app update.

   Shell auto-update is intentionally OFF this round because:
     · It is unsafe without code signing (Windows SmartScreen / macOS Gatekeeper
       will reject unsigned auto-updates), and we have no certificates yet.
     · A publish provider (GitHub Releases recommended) must be configured in
       electron-builder.yml (`publish:` is currently null).

   To ENABLE later (after signing + publish are set up):
     1. Set `publish:` in electron-builder.yml (GitHub or a generic server).
     2. Provide signing certs (CSC_LINK / CSC_KEY_PASSWORD; Apple notarization).
     3. Launch the app with KOLEEX_ENABLE_UPDATER=1 (or hardcode ENABLE_UPDATER).
   The wiring below is ready; it no-ops safely until those are in place.
   --------------------------------------------------------------------------- */

import { app, type BrowserWindow } from "electron";
import { ENABLE_UPDATER } from "./config";
import { IpcChannels, type UpdateStatus } from "./ipc";

export function initAutoUpdates(getWindow: () => BrowserWindow | null): void {
  const send = (status: UpdateStatus) => {
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send(IpcChannels.updateStatus, status);
  };

  // Never run in dev or when explicitly disabled (the default this round).
  if (!app.isPackaged || !ENABLE_UPDATER) {
    send({ state: "disabled" });
    return;
  }

  // Lazy-require so the dependency is never loaded unless updates are enabled.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  let autoUpdater: import("electron-updater").AppUpdater;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    autoUpdater = (require("electron-updater") as typeof import("electron-updater")).autoUpdater;
  } catch {
    send({ state: "disabled" });
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => send({ state: "checking" }));
  autoUpdater.on("update-available", (info) => send({ state: "available", version: info?.version }));
  autoUpdater.on("update-not-available", () => send({ state: "not-available" }));
  autoUpdater.on("download-progress", (p) => send({ state: "downloading", percent: p?.percent }));
  autoUpdater.on("update-downloaded", (info) => send({ state: "downloaded", version: info?.version }));
  autoUpdater.on("error", (err) => send({ state: "error", message: err?.message }));

  void autoUpdater.checkForUpdatesAndNotify().catch(() => send({ state: "error" }));
}
