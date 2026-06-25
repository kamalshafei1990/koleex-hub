/* ---------------------------------------------------------------------------
   Native application menu + About dialog.

   App menu (macOS), File, Edit, View, Window, Tools, Help. Developer tools are
   dev-only. Tools/Help expose production actions: Check for Updates, Restart,
   Open Logs Folder, Open Downloads Folder. The About item shows app + runtime
   versions in a native dialog.
   --------------------------------------------------------------------------- */

import {
  app,
  Menu,
  dialog,
  shell,
  type BrowserWindow,
  type MenuItemConstructorOptions,
} from "electron";
import { APP_NAME, APP_URL, IS_DEV } from "./config";

/** Callbacks wired by main.ts so the menu stays decoupled from app internals. */
export interface MenuActions {
  checkForUpdates: () => void;
  restart: () => void;
  openLogsFolder: () => void;
  openDownloadsFolder: () => void;
}

export function showAboutDialog(win?: BrowserWindow): void {
  const v = process.versions;
  void dialog.showMessageBox(win ?? (undefined as unknown as BrowserWindow), {
    type: "info",
    title: `About ${APP_NAME}`,
    message: APP_NAME,
    detail:
      `Version ${app.getVersion()}\n` +
      `Electron ${v.electron}  ·  Chromium ${v.chrome}  ·  Node ${v.node}\n\n` +
      `© ${new Date().getFullYear()} Koleex International Group\n` +
      `Connected to ${APP_URL}`,
    buttons: ["OK"],
    noLink: true,
  });
}

export function buildMenu(getWindow: () => BrowserWindow | null, actions: MenuActions): Menu {
  const isMac = process.platform === "darwin";

  const appMenu: MenuItemConstructorOptions[] = isMac
    ? [
        {
          label: APP_NAME,
          submenu: [
            { label: `About ${APP_NAME}`, click: () => showAboutDialog(getWindow() ?? undefined) },
            { label: "Check for Updates…", click: actions.checkForUpdates },
            { type: "separator" },
            { role: "services" },
            { type: "separator" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            { role: "quit" },
          ],
        },
      ]
    : [];

  const viewSubmenu: MenuItemConstructorOptions[] = [
    { role: "reload" },
    { role: "forceReload" },
    { type: "separator" },
    { role: "resetZoom" },
    { role: "zoomIn" },
    { role: "zoomOut" },
    { type: "separator" },
    { role: "togglefullscreen" },
    ...(IS_DEV ? ([{ type: "separator" }, { role: "toggleDevTools" }] as MenuItemConstructorOptions[]) : []),
  ];

  const template: MenuItemConstructorOptions[] = [
    ...appMenu,
    {
      label: "File",
      submenu: isMac ? [{ role: "close" }] : [{ role: "quit" }],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    { label: "View", submenu: viewSubmenu },
    {
      label: "Tools",
      submenu: [
        { label: "Check for Updates…", click: actions.checkForUpdates },
        { type: "separator" },
        { label: "Open Logs Folder", click: actions.openLogsFolder },
        { label: "Open Downloads Folder", click: actions.openDownloadsFolder },
        { type: "separator" },
        { label: `Restart ${APP_NAME}`, click: actions.restart },
      ],
    },
    {
      label: "Window",
      submenu: isMac
        ? [{ role: "minimize" }, { role: "zoom" }, { type: "separator" }, { role: "front" }]
        : [{ role: "minimize" }, { role: "close" }],
    },
    {
      role: "help",
      submenu: [
        { label: "Open Koleex Hub in browser", click: () => void shell.openExternal(APP_URL) },
        { type: "separator" },
        ...(!isMac
          ? ([{ label: `About ${APP_NAME}`, click: () => showAboutDialog(getWindow() ?? undefined) }] as MenuItemConstructorOptions[])
          : []),
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}
