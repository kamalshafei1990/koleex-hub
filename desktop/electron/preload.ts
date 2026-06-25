/* ---------------------------------------------------------------------------
   Preload — the single, audited bridge between the Koleex Hub web app
   (renderer) and the Electron main process.

   Security: runs with contextIsolation ON + sandbox ON. It exposes a tiny,
   FROZEN `window.koleex` object via contextBridge and NEVER leaks `ipcRenderer`
   or Node primitives into the page. Only the channels declared in ipc.ts are
   reachable, and only with the shapes defined there.
   --------------------------------------------------------------------------- */

import { contextBridge, ipcRenderer } from "electron";
import { IpcChannels, type AppInfo, type NotifyPayload, type UpdateStatus } from "./ipc";

const api = {
  /** Desktop shell marker — lets the web app feature-detect the desktop build. */
  isDesktop: true as const,

  /** App version string (semver of the desktop shell). */
  getVersion: (): Promise<string> => ipcRenderer.invoke(IpcChannels.appVersion),

  /** Full app/runtime info for the About dialog / diagnostics. */
  getInfo: (): Promise<AppInfo> => ipcRenderer.invoke(IpcChannels.appInfo),

  /** Show a native OS notification (the web app may also use the standard
   *  Notification API directly — this is a convenience bridge). */
  notify: (payload: NotifyPayload): void => {
    if (payload && typeof payload.title === "string") {
      ipcRenderer.send(IpcChannels.notify, {
        title: payload.title,
        body: typeof payload.body === "string" ? payload.body : undefined,
        silent: !!payload.silent,
      } satisfies NotifyPayload);
    }
  },

  /** Subscribe to auto-update status events. Returns an unsubscribe fn. */
  onUpdateStatus: (cb: (status: UpdateStatus) => void): (() => void) => {
    const listener = (_e: unknown, status: UpdateStatus) => cb(status);
    ipcRenderer.on(IpcChannels.updateStatus, listener);
    return () => ipcRenderer.removeListener(IpcChannels.updateStatus, listener);
  },
};

export type KoleexDesktopApi = typeof api;

contextBridge.exposeInMainWorld("koleex", Object.freeze(api));
