/* ---------------------------------------------------------------------------
   Tiny window-state persistence (size + position + maximized), no extra deps.

   Stored as JSON under the app's userData dir. Restores on launch and saves
   (debounced) on resize/move and on maximize/unmaximize. Defends against
   off-screen restores (e.g. a monitor that was unplugged) by validating the
   saved bounds against the current displays.
   --------------------------------------------------------------------------- */

import { app, screen, type BrowserWindow, type Rectangle } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";

interface WindowState extends Rectangle {
  isMaximized: boolean;
}

const FILE = path.join(app.getPath("userData"), "window-state.json");
const DEFAULTS: WindowState = { x: 0, y: 0, width: 1440, height: 900, isMaximized: false };

let saveTimer: NodeJS.Timeout | null = null;

async function read(): Promise<WindowState | null> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<WindowState>;
    if (typeof parsed.width === "number" && typeof parsed.height === "number") {
      return { ...DEFAULTS, ...parsed } as WindowState;
    }
  } catch {
    /* first run / unreadable — fall through to defaults */
  }
  return null;
}

/** A saved rect is usable only if it meaningfully intersects a current display. */
function isVisibleOnSomeDisplay(rect: Rectangle): boolean {
  return screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    const ix = Math.max(a.x, rect.x);
    const iy = Math.max(a.y, rect.y);
    const iw = Math.min(a.x + a.width, rect.x + rect.width) - ix;
    const ih = Math.min(a.y + a.height, rect.y + rect.height) - iy;
    return iw > 80 && ih > 80; // at least a sliver is reachable
  });
}

/** Initial BrowserWindow options derived from the saved state (safe defaults). */
export async function getInitialBounds(): Promise<{
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized: boolean;
}> {
  const s = await read();
  if (!s) return { width: DEFAULTS.width, height: DEFAULTS.height, isMaximized: false };

  const hasPos = Number.isFinite(s.x) && Number.isFinite(s.y);
  const onScreen = hasPos && isVisibleOnSomeDisplay(s);
  return {
    width: Math.max(800, s.width),
    height: Math.max(600, s.height),
    ...(onScreen ? { x: s.x, y: s.y } : {}),
    isMaximized: s.isMaximized,
  };
}

/** Wire a window so its geometry is persisted as the user resizes/moves it. */
export function track(win: BrowserWindow): void {
  const persist = () => {
    if (win.isDestroyed()) return;
    const isMaximized = win.isMaximized();
    // When maximized, keep the previous "restored" bounds so unmaximize works.
    const bounds = isMaximized ? win.getNormalBounds() : win.getBounds();
    const state: WindowState = { ...bounds, isMaximized };
    void fs.mkdir(path.dirname(FILE), { recursive: true })
      .then(() => fs.writeFile(FILE, JSON.stringify(state), "utf8"))
      .catch(() => {});
  };

  const debounced = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 400);
  };

  win.on("resize", debounced);
  win.on("move", debounced);
  win.on("maximize", persist);
  win.on("unmaximize", persist);
  win.on("close", persist);
}
