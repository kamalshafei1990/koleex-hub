"use client";

/* ---------------------------------------------------------------------------
   desktop-toast — a Windows / Mac notification from the desktop app.

   The desktop app (Electron) has no push service, so nothing reaches it
   while it is closed. Until 26/09 nothing popped up while it was open
   either: a new approval or task only chimed and moved the number, and
   someone working in another program never saw it (owner: "اعمل 1"). Now,
   while the app is open but its window is not in front — minimized, or
   behind another program — each new notification also shows as a system
   notification. Clicking it brings the Hub forward and opens it.

   Only in the desktop app: a browser has push for this, and a second pop-up
   there would double every notification. The caller decides WHETHER, with
   the chime's own rules (the per-activity switches, quiet hours, a muted
   conversation); this only adds "the reader would otherwise miss it". Silent,
   because the Hub's chime already sounds. A burst folds into one.
   --------------------------------------------------------------------------- */

import { isDesktopApp } from "@/lib/desktop-app";
import { partsText, renderNotification } from "@/lib/notification-templates";
import { cleanInboxBody, cleanInboxSubject } from "@/lib/inbox-display";
import type { Lang } from "@/lib/i18n";

export interface Toast {
  /** Same key → the system replaces the earlier one instead of stacking. */
  key: string;
  title: string;
  body?: string;
  open: () => void;
}

/** The window isn't what the reader is looking at. */
export function outOfView(): boolean {
  return document.visibilityState !== "visible" || !document.hasFocus();
}

let pending: Toast[] = [];
let timer: number | null = null;

/** Queue a toast. More than two within 0.4 s show as one ("5 new
 *  notifications") — a batch job must not bury the screen. */
export function desktopToast(toast: Toast, many: (n: number) => Toast): void {
  if (!isDesktopApp() || typeof Notification === "undefined" || Notification.permission !== "granted") return;
  if (!outOfView()) return;
  pending.push(toast);
  if (timer === null) timer = window.setTimeout(() => flush(many), 400);
}

function flush(many: (n: number) => Toast): void {
  const batch = pending;
  pending = [];
  timer = null;
  /* Back in front meanwhile: the bell and the chime already told them. */
  if (!outOfView()) return;
  for (const t of batch.length > 2 ? [many(batch.length)] : batch) show(t);
}

function show(t: Toast): void {
  try {
    const n = new Notification(t.title, { body: t.body?.slice(0, 300), tag: t.key, silent: true });
    n.onclick = (ev) => {
      ev.preventDefault();
      /* Electron brings the window forward (and restores it when minimized). */
      try { window.focus(); } catch { /* refused — the notification still opens */ }
      t.open();
      n.close();
    };
  } catch { /* the system refused it — the chime and the bell still carry it */ }
}

/** A notification's words in the reader's language — the bell's own render
 *  (templates), or the stored text for a row written before them. */
export function inboxToastText(
  row: { subject?: string | null; body?: string | null; metadata?: unknown },
  lang: Lang,
): { title: string; body?: string } {
  const r = renderNotification(row.metadata, lang);
  if (r) return { title: partsText(r.subject), body: r.body ? partsText(r.body) : cleanInboxBody(row.body) || undefined };
  return { title: cleanInboxSubject(row.subject), body: cleanInboxBody(row.body) || undefined };
}
