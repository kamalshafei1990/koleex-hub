/* ---------------------------------------------------------------------------
   The ONLY IPC contract between the renderer (loaded Koleex Hub web app) and
   the main process. Keeping the channel names + payload shapes in one tiny,
   reviewed file is the core of safe IPC: the preload exposes nothing beyond
   these, and main only registers handlers for these.

   Extension points (Phase 5) are declared here as reserved channels but are
   NOT implemented yet — they exist so future native features (print, scanner,
   USB, serial, camera, backup) have a single, audited place to live.
   --------------------------------------------------------------------------- */

export const IpcChannels = {
  /* invoke (renderer → main → reply) */
  appVersion: "koleex:app-version",
  appInfo: "koleex:app-info",

  /* send (renderer → main, fire-and-forget) */
  notify: "koleex:notify",

  /* event (main → renderer) */
  updateStatus: "koleex:update-status",

  /* ── Reserved for Phase 5 (declared, not implemented) ───────────────── */
  reserved: {
    printSilent: "koleex:print-silent",
    scanBarcode: "koleex:scan-barcode",
    readFile: "koleex:read-file",
    writeFile: "koleex:write-file",
    listSerialPorts: "koleex:list-serial-ports",
    listUsbDevices: "koleex:list-usb-devices",
    captureCamera: "koleex:capture-camera",
    backupExport: "koleex:backup-export",
    backupRestore: "koleex:backup-restore",
  },
} as const;

export interface AppInfo {
  name: string;
  version: string;
  platform: NodeJS.Platform;
  arch: string;
  electron: string;
  chrome: string;
}

export interface NotifyPayload {
  title: string;
  body?: string;
  silent?: boolean;
}

export type UpdateStatus =
  | { state: "checking" }
  | { state: "available"; version?: string }
  | { state: "not-available" }
  | { state: "downloading"; percent?: number }
  | { state: "downloaded"; version?: string }
  | { state: "error"; message?: string }
  | { state: "disabled" };
