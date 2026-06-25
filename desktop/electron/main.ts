/* ---------------------------------------------------------------------------
   Koleex Hub — Electron main process.

   A lightweight native shell that loads the LIVE production Koleex Hub
   (Vercel) in a hardened window. No web assets are bundled; the desktop app
   inherits every web deploy automatically.

   Responsibilities: single-instance lock · branded splash · hardened main
   window · restore/persist window geometry · native menu + About · native
   notifications · route external links to the OS browser · native download
   save dialogs · optional system tray · auto-update bootstrap (disabled).
   --------------------------------------------------------------------------- */

import {
  app,
  BrowserWindow,
  Notification,
  Tray,
  Menu,
  nativeImage,
  ipcMain,
  session,
  shell,
  type IpcMainEvent,
} from "electron";
import path from "node:path";
import {
  APP_ID,
  APP_NAME,
  APP_URL,
  ENABLE_TRAY,
  IS_DEV,
} from "./config";
import { applyContentsSecurity, applySessionSecurity } from "./security";
import { getInitialBounds, track } from "./window-state";
import { buildMenu, showAboutDialog, type MenuActions } from "./menu";
import { initAutoUpdates, checkForUpdatesManual } from "./updater";
import { installCrashHandlers, logStartup, log, getLogsDir } from "./logger";
import { IpcChannels, type AppInfo, type NotifyPayload } from "./ipc";

const RES = path.join(__dirname, "..", "resources");
const ICON = path.join(RES, "icon.png");
const PRELOAD = path.join(__dirname, "preload.js");
const SPLASH = path.join(RES, "splash.html");

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

/* Offline auto-reconnect state. */
let reconnectTimer: NodeJS.Timeout | null = null;
let reconnectAttempts = 0;
/* Guard against renderer-crash reload loops. */
let crashReloads = 0;

const getMainWindow = () => mainWindow;

/* ── Native menu actions (wired into the menu) ──────────────────────────── */
function restartApp(): void {
  log("info", "user requested app restart");
  isQuitting = true;
  app.relaunch();
  app.exit(0);
}

function openLogsFolder(): void {
  const dir = getLogsDir();
  if (dir) void shell.openPath(dir);
}

function openDownloadsFolder(): void {
  try {
    void shell.openPath(app.getPath("downloads"));
  } catch {
    /* no downloads dir on this platform — ignore */
  }
}

const menuActions: MenuActions = {
  checkForUpdates: () => checkForUpdatesManual(getMainWindow),
  restart: restartApp,
  openLogsFolder,
  openDownloadsFolder,
};

/* ── Splash ──────────────────────────────────────────────────────────── */
function createSplash(): void {
  splashWindow = new BrowserWindow({
    width: 420,
    height: 300,
    frame: false,
    resizable: false,
    movable: true,
    center: true,
    show: true,
    backgroundColor: "#0A0A0A",
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  void splashWindow.loadFile(SPLASH);
  splashWindow.on("closed", () => (splashWindow = null));
}

function destroySplash(): void {
  if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
  splashWindow = null;
}

/* ── Main window ─────────────────────────────────────────────────────── */
async function createMainWindow(): Promise<void> {
  const bounds = await getInitialBounds();

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    ...(bounds.x !== undefined && bounds.y !== undefined ? { x: bounds.x, y: bounds.y } : {}),
    minWidth: 800,
    minHeight: 600,
    show: false, // revealed on first paint for a smooth, flash-free startup
    backgroundColor: "#0A0A0A",
    title: APP_NAME,
    icon: ICON,
    autoHideMenuBar: process.platform !== "darwin",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      spellcheck: true,
      // Loads only https production content; no insecure content allowed.
    },
  });

  if (bounds.isMaximized) mainWindow.maximize();
  track(mainWindow);
  applyContentsSecurity(mainWindow.webContents);

  // Smooth reveal: show the real window only once content has painted, then
  // tear down the splash. Falls back to did-finish-load if needed.
  const reveal = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (!mainWindow.isVisible()) mainWindow.show();
    destroySplash();
  };
  mainWindow.once("ready-to-show", reveal);
  mainWindow.webContents.once("did-finish-load", reveal);

  // A successful load clears any pending reconnect/backoff + crash counters.
  mainWindow.webContents.on("did-finish-load", () => {
    reconnectAttempts = 0;
    crashReloads = 0;
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  });

  // Offline / unreachable production → show a friendly screen and auto-retry
  // with capped backoff (also reachable via the manual Retry link).
  mainWindow.webContents.on("did-fail-load", (_e, code, desc, validatedURL, isMainFrame) => {
    if (!isMainFrame || code === -3 /* ERR_ABORTED (benign) */) return;
    log("warn", `did-fail-load ${code} ${desc} ${validatedURL}`);

    reconnectAttempts += 1;
    const delayMs = Math.min(30_000, 2_000 * reconnectAttempts);
    const nextInSec = Math.round(delayMs / 1000);

    void mainWindow?.loadURL(
      "data:text/html;charset=utf-8," +
        encodeURIComponent(
          `<body style="margin:0;background:#0A0A0A;color:#e5e5e5;font:14px -apple-system,Segoe UI,Roboto,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center"><div><div style="font-size:18px;font-weight:600;margin-bottom:8px">Can't reach Koleex Hub</div><div style="color:#888">${desc || "Network error"} (${code})</div><div style="margin-top:10px;color:#666;font-size:12px">Reconnecting in ${nextInSec}s…</div><div style="margin-top:18px"><a href="#" onclick="location.replace('${APP_URL}')" style="color:#3385FF;text-decoration:none">Retry now</a></div></div></body>`,
        ),
    );
    reveal();

    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) void mainWindow.loadURL(APP_URL);
    }, delayMs);
  });

  // Crash-safe: if the renderer dies, log it and reload once (bounded) instead
  // of leaving a blank window. A repeated crash falls back to the error screen.
  mainWindow.webContents.on("render-process-gone", (_e, details) => {
    log("error", "renderer gone — recovering", details);
    if (crashReloads < 3 && mainWindow && !mainWindow.isDestroyed()) {
      crashReloads += 1;
      void mainWindow.loadURL(APP_URL);
    }
  });

  // Minimize-to-tray (only when tray is enabled).
  mainWindow.on("close", (e) => {
    if (ENABLE_TRAY && !isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });
  mainWindow.on("closed", () => (mainWindow = null));

  await mainWindow.loadURL(APP_URL);
}

/* ── Tray (optional, opt-in via KOLEEX_TRAY=1) ───────────────────────── */
function createTray(): void {
  try {
    const img = nativeImage.createFromPath(ICON);
    tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img.resize({ width: 18, height: 18 }));
    tray.setToolTip(APP_NAME);
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: `Open ${APP_NAME}`, click: () => showOrCreate() },
        { label: "About", click: () => showAboutDialog(mainWindow ?? undefined) },
        { type: "separator" },
        { label: "Quit", click: () => { isQuitting = true; app.quit(); } },
      ]),
    );
    tray.on("click", () => showOrCreate());
  } catch {
    /* tray unavailable on this platform/session — ignore */
  }
}

function showOrCreate(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
  } else {
    void createMainWindow();
  }
}

/* ── IPC (only the audited channels from ipc.ts) ─────────────────────── */
function registerIpc(): void {
  ipcMain.handle(IpcChannels.appVersion, () => app.getVersion());

  ipcMain.handle(IpcChannels.appInfo, (): AppInfo => ({
    name: APP_NAME,
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  }));

  ipcMain.on(IpcChannels.notify, (_e: IpcMainEvent, payload: NotifyPayload) => {
    if (!Notification.isSupported() || !payload?.title) return;
    new Notification({
      title: String(payload.title).slice(0, 200),
      body: payload.body ? String(payload.body).slice(0, 1000) : undefined,
      silent: !!payload.silent,
      icon: ICON,
    }).show();
  });
}

/* ── App lifecycle ───────────────────────────────────────────────────── */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => showOrCreate());

  app.whenReady().then(async () => {
    app.setName(APP_NAME);
    if (process.platform === "win32") app.setAppUserModelId(APP_ID);

    installCrashHandlers();
    logStartup(APP_URL);

    applySessionSecurity(session.defaultSession);
    registerIpc();
    Menu.setApplicationMenu(buildMenu(getMainWindow, menuActions));

    createSplash();
    await createMainWindow();

    if (ENABLE_TRAY) createTray();
    initAutoUpdates(getMainWindow);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) void createMainWindow();
      else showOrCreate();
    });
  });

  app.on("before-quit", () => (isQuitting = true));

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}

void IS_DEV; // referenced for clarity; dev-only branches live in menu.ts
