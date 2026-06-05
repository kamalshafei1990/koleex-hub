"use client";

/* ---------------------------------------------------------------------------
   ReportIssueButton — global QA feedback reporter (Phase 1).

   A subtle floating button (bottom-end, stacked above the AI FAB). Clicking it
   opens a clean modal where any logged-in user files a bug / UI / UX / data /
   suggestion report. Route, page title, app/module, browser, OS, screen size,
   language and timezone are auto-captured; the server attaches the reporter's
   identity. A screenshot can be uploaded, pasted (⌘/Ctrl+V) or dragged in.

   Mounted once in RootShell, so it appears across the whole Hub (never on the
   chrome-less /login, /auth or /print routes, which RootShell already skips).
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import MessageSquarePlusIcon from "@/components/icons/ui/MessageSquarePlusIcon";
import { humanizeError } from "@/lib/ui/humanize-error";
import {
  ISSUE_TYPES,
  SEVERITIES,
  moduleForRoute,
  type IssueType,
  type Severity,
} from "@/lib/qa/types";

interface Env {
  route: string;
  pageTitle: string;
  appModule: string;
  browserInfo: string;
  deviceInfo: string;
  screenSize: string;
  language: string;
  timezone: string;
}

function detectBrowser(ua: string): string {
  if (/edg\//i.test(ua)) return "Edge";
  if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) return "Chrome";
  if (/firefox\//i.test(ua)) return "Firefox";
  if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) return "Safari";
  return "Browser";
}
function detectOS(ua: string): string {
  if (/windows/i.test(ua)) return "Windows";
  if (/mac os x|macintosh/i.test(ua)) return "macOS";
  if (/android/i.test(ua)) return "Android";
  if (/iphone|ipad|ipod/i.test(ua)) return "iOS";
  if (/linux/i.test(ua)) return "Linux";
  return "Unknown OS";
}

const MAX_BYTES = 5 * 1024 * 1024;
const OK_TYPES = ["image/png", "image/jpeg", "image/webp"];

export default function ReportIssueButton() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Report an issue or suggestion"
        aria-label="Report an issue"
        className="fixed end-6 bottom-[5.25rem] z-[80] flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--bg-secondary)]/95 text-[var(--text-secondary)] shadow-lg backdrop-blur-md transition-colors hover:text-[var(--text-primary)] hover:border-[var(--accent)]"
      >
        <MessageSquarePlusIcon size={17} />
      </button>
    );
  }
  return <ReportModal pathname={pathname} onClose={() => setOpen(false)} />;
}

function ReportModal({ pathname, onClose }: { pathname: string; onClose: () => void }) {
  const [issueType, setIssueType] = useState<IssueType>("bug");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [expected, setExpected] = useState("");
  const [solution, setSolution] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const envRef = useRef<Env | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Capture environment once on open.
  if (!envRef.current && typeof window !== "undefined") {
    const ua = navigator.userAgent;
    envRef.current = {
      route: pathname,
      pageTitle: document.title || "",
      appModule: moduleForRoute(pathname),
      browserInfo: `${detectBrowser(ua)} · ${ua.slice(0, 300)}`,
      deviceInfo: detectOS(ua),
      screenSize: `${window.innerWidth}×${window.innerHeight}`,
      language: navigator.language || "",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    };
  }
  const env = envRef.current!;

  const setImage = useCallback((f: File | null) => {
    setError(null);
    if (!f) { setFile(null); setPreviewUrl((u) => { if (u) URL.revokeObjectURL(u); return null; }); return; }
    if (!OK_TYPES.includes(f.type)) { setError("Only PNG, JPG or WEBP images are allowed."); return; }
    if (f.size > MAX_BYTES) { setError("Screenshot is too large (max 5 MB)."); return; }
    setFile(f);
    setPreviewUrl((u) => { if (u) URL.revokeObjectURL(u); return URL.createObjectURL(f); });
  }, []);

  // Esc to close, paste-to-attach while the modal is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of Array.from(items)) {
        if (it.type.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) { setImage(f); e.preventDefault(); break; }
        }
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("paste", onPaste);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("paste", onPaste); };
  }, [busy, onClose, setImage]);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  async function submit() {
    if (busy) return;
    if (!title.trim()) { setError("Please add a short title."); return; }
    setBusy(true); setError(null);
    try {
      let screenshotPath: string | null = null;
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        const up = await fetch("/api/qa/upload", { method: "POST", body: fd, credentials: "include" });
        const uj = await up.json().catch(() => ({}));
        if (!up.ok) throw new Error(humanizeError(uj.error ?? `Upload failed (${up.status})`));
        screenshotPath = uj.path ?? null;
      }
      const res = await fetch("/api/qa/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          issue_type: issueType,
          severity,
          title: title.trim(),
          description: description.trim() || null,
          expected_result: expected.trim() || null,
          suggested_solution: solution.trim() || null,
          screenshot_path: screenshotPath,
          route: env.route,
          page_title: env.pageTitle,
          app_module: env.appModule,
          browser_info: env.browserInfo,
          device_info: env.deviceInfo,
          screen_size: env.screenSize,
          language: env.language,
          timezone: env.timezone,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(humanizeError(j.error ?? `HTTP ${res.status}`));
      setDone(true);
      setTimeout(onClose, 1400);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't submit the report.");
    } finally {
      setBusy(false);
    }
  }

  const field = "w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] placeholder:text-[var(--text-ghost)]";
  const label = "block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)] mb-1";

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-2xl sm:max-w-[560px] sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <MessageSquarePlusIcon size={16} className="text-[var(--accent)]" />
            <h2 className="text-[14px] font-bold">Report an issue</h2>
          </div>
          <button type="button" onClick={() => !busy && onClose()} aria-label="Close" className="text-[var(--text-dim)] hover:text-[var(--text-primary)]">✕</button>
        </div>

        {done ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent)]/15 text-[var(--accent)] text-xl">✓</div>
            <p className="text-[14px] font-semibold">Thank you — report submitted.</p>
            <p className="text-[12px] text-[var(--text-dim)]">The team can see it in Issue Reports.</p>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-3.5 overflow-y-auto px-5 py-4">
              {/* Context line */}
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-dim)]">
                <span className="rounded-md bg-[var(--bg-surface)] px-1.5 py-0.5 font-medium text-[var(--text-secondary)]">{env.appModule}</span>
                <span className="truncate rounded-md bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono">{env.route}</span>
              </div>

              {/* Type + Severity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Issue type</label>
                  <select value={issueType} onChange={(e) => setIssueType(e.target.value as IssueType)} className={field}>
                    {ISSUE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={label}>Severity</label>
                  <select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)} className={field}>
                    {SEVERITIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className={label}>Title<span className="text-[var(--accent)]"> *</span></label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short summary of the issue" className={field} maxLength={200} autoFocus />
              </div>
              <div>
                <label className={label}>What happened?</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Describe what you saw…" className={field} />
              </div>
              <div>
                <label className={label}>Expected result</label>
                <textarea value={expected} onChange={(e) => setExpected(e.target.value)} rows={2} placeholder="What should happen instead?" className={field} />
              </div>
              <div>
                <label className={label}>Suggested solution <span className="font-normal normal-case text-[var(--text-ghost)]">(optional)</span></label>
                <textarea value={solution} onChange={(e) => setSolution(e.target.value)} rows={2} placeholder="Any idea how to fix it?" className={field} />
              </div>

              {/* Screenshot */}
              <div>
                <label className={label}>Screenshot <span className="font-normal normal-case text-[var(--text-ghost)]">(upload, paste or drag — PNG/JPG/WEBP)</span></label>
                {previewUrl ? (
                  <div className="relative overflow-hidden rounded-lg border border-[var(--border-color)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrl} alt="screenshot preview" className="max-h-48 w-full object-contain bg-[var(--bg-surface-subtle)]" />
                    <button type="button" onClick={() => setImage(null)} className="absolute right-2 top-2 rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium text-white hover:bg-black/80">Remove</button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) setImage(f); }}
                    className={`flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed py-6 text-[12px] transition-colors ${dragOver ? "border-[var(--accent)] bg-[var(--accent)]/5 text-[var(--text-primary)]" : "border-[var(--border-color)] text-[var(--text-dim)] hover:border-[var(--accent)]"}`}
                  >
                    <span className="text-[var(--text-secondary)]">Click to upload</span>
                    <span className="text-[var(--text-ghost)]">or paste / drag an image here</span>
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
              </div>

              {error && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-500 dark:text-rose-300">{error}</div>}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] px-5 py-3">
              <button type="button" onClick={() => !busy && onClose()} className="rounded-lg px-3.5 py-2 text-[13px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)]">Cancel</button>
              <button type="button" onClick={submit} disabled={busy || !title.trim()} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50">
                {busy ? "Submitting…" : "Submit report"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
