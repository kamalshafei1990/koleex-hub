/* ---------------------------------------------------------------------------
   Local diagnostics logger — fully on-device, never sends anything externally.

   Writes timestamped lines to a rotating file under the OS-standard per-app
   logs directory (Electron's `logs` path). Captures startup, errors, crashes
   (uncaught exceptions / unhandled rejections / renderer + child crashes).
   Size-rotated (keeps a few generations) so it can't grow unbounded.

   Privacy: logs stay on the user's machine. No network calls here. Do not log
   secrets — keep entries to lifecycle + diagnostic facts.
   --------------------------------------------------------------------------- */

import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

type Level = "info" | "warn" | "error";

const MAX_BYTES = 2 * 1024 * 1024; // rotate at ~2 MB
const KEEP = 3; // main.log + main.1.log + main.2.log

let logsDir: string | null = null;
let logFile: string | null = null;

function resolveDir(): string | null {
  if (logsDir) return logsDir;
  try {
    // `logs` is OS-appropriate (e.g. ~/Library/Logs/Koleex Hub, %APPDATA%\…\logs).
    logsDir = app.getPath("logs");
  } catch {
    try {
      logsDir = path.join(app.getPath("userData"), "logs");
    } catch {
      return null;
    }
  }
  try {
    fs.mkdirSync(logsDir, { recursive: true });
    logFile = path.join(logsDir, "main.log");
  } catch {
    return null;
  }
  return logsDir;
}

function rotateIfNeeded(): void {
  if (!logFile) return;
  try {
    const { size } = fs.statSync(logFile);
    if (size < MAX_BYTES) return;
    for (let i = KEEP - 1; i >= 1; i--) {
      const from = i === 1 ? logFile : `${logFile}.${i - 1}`;
      const to = `${logFile}.${i}`;
      if (fs.existsSync(from)) fs.renameSync(from, to);
    }
  } catch {
    /* stat/rename best-effort */
  }
}

export function log(level: Level, message: string, meta?: unknown): void {
  const line =
    `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}` +
    (meta !== undefined ? ` ${safeStringify(meta)}` : "") +
    "\n";

  // Mirror to the console too (stripped in production main, but useful in dev).
  if (level === "error") console.error(line.trim());
  else if (level === "warn") console.warn(line.trim());
  else console.log(line.trim());

  if (!resolveDir() || !logFile) return;
  rotateIfNeeded();
  try {
    fs.appendFileSync(logFile, line);
  } catch {
    /* disk full / permissions — never throw from the logger */
  }
}

function safeStringify(v: unknown): string {
  if (v instanceof Error) return `${v.name}: ${v.message}${v.stack ? `\n${v.stack}` : ""}`;
  try {
    return typeof v === "string" ? v : JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/** Absolute path to the logs directory (for the "Open Logs Folder" action). */
export function getLogsDir(): string | null {
  return resolveDir();
}

/** Install process-level crash/error capture. Call once, early. */
export function installCrashHandlers(): void {
  process.on("uncaughtException", (err) => log("error", "uncaughtException", err));
  process.on("unhandledRejection", (reason) => log("error", "unhandledRejection", reason));

  app.on("render-process-gone", (_e, _wc, details) =>
    log("error", "render-process-gone", details),
  );
  app.on("child-process-gone", (_e, details) => log("error", "child-process-gone", details));

  app.on("before-quit", () => log("info", "app before-quit"));
}

/** One-line startup banner with version + runtime, written at launch. */
export function logStartup(appUrl: string): void {
  const v = process.versions;
  log(
    "info",
    `startup — Koleex Hub ${app.getVersion()} · Electron ${v.electron} · Chromium ${v.chrome} · ` +
      `Node ${v.node} · ${process.platform}/${process.arch} · packaged=${app.isPackaged} · url=${appUrl}`,
  );
}
