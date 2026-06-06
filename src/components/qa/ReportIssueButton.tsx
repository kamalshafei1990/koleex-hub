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
import TargetIcon from "@/components/icons/ui/TargetIcon";
import MonitorIcon from "@/components/icons/ui/MonitorIcon";
import { humanizeError } from "@/lib/ui/humanize-error";
import {
  ISSUE_TYPES,
  SEVERITIES,
  moduleForRoute,
  type IssueType,
  type Severity,
} from "@/lib/qa/types";
import { useInspector, type PickedComponent } from "@/lib/qa/inspector";
import { useTranslation } from "@/lib/i18n";
import { qaT } from "@/lib/translations/qa";

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
  const { t } = useTranslation(qaT);
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={t("qa.report.fabTitle", "Report an issue or suggestion")}
        aria-label={t("qa.report.title", "Report an issue")}
        className="fixed end-6 bottom-[5.25rem] z-[80] flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--bg-secondary)]/95 text-[var(--text-secondary)] shadow-lg backdrop-blur-md transition-colors hover:text-[var(--text-primary)] hover:border-[var(--border-focus)]"
      >
        <MessageSquarePlusIcon size={17} />
      </button>
    );
  }
  return <ReportModal pathname={pathname} onClose={() => setOpen(false)} />;
}

function ReportModal({ pathname, onClose }: { pathname: string; onClose: () => void }) {
  const { t } = useTranslation(qaT);
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
  const [selected, setSelected] = useState<PickedComponent | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const envRef = useRef<Env | null>(null);

  // Live screen capture is supported in modern desktop browsers via the Screen
  // Capture API. On most mobile browsers it's unavailable — there the user still
  // has upload / paste / drag (and the OS camera).
  const captureSupported =
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getDisplayMedia === "function";
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inspector = useInspector();

  // Enter inspect mode: hide the modal panel (state is preserved — the
  // component stays mounted), let the global inspector overlay take over, and
  // capture the picked component when the user clicks one (or Esc cancels).
  const pickComponent = useCallback(() => {
    setInspecting(true);
    inspector.start((c) => {
      setInspecting(false);
      if (c) setSelected(c);
    });
  }, [inspector]);

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
    if (!OK_TYPES.includes(f.type)) { setError(t("qa.report.errType", "Only PNG, JPG or WEBP images are allowed.")); return; }
    if (f.size > MAX_BYTES) { setError(t("qa.report.errSize", "Screenshot is too large (max 5 MB).")); return; }
    setFile(f);
    setPreviewUrl((u) => { if (u) URL.revokeObjectURL(u); return URL.createObjectURL(f); });
  }, []);

  // Take a live screenshot of the screen / window / tab — the browser shows its
  // own native picker (same idea as the macOS screenshot tool or WeChat capture).
  // We hide the report panel during the grab so it isn't in the shot, then attach
  // the captured frame exactly like an uploaded image.
  const captureScreenshot = useCallback(async () => {
    if (busy || capturing) return;
    setError(null);
    const md = navigator.mediaDevices;
    if (!md || typeof md.getDisplayMedia !== "function") {
      setError(t("qa.report.captureUnsupported", "Your browser can't capture the screen here — please upload an image instead."));
      return;
    }

    let stream: MediaStream;
    try {
      // Must run synchronously inside the click gesture — call it immediately,
      // with the simplest possible constraints for the widest browser support.
      stream = await md.getDisplayMedia({ video: true, audio: false });
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      // A genuine user-cancel of the picker (AbortError) → stay silent.
      // Anything else (incl. NotAllowedError from a blocked context, or the
      // OS withholding Screen-Recording permission) → tell them, with a code.
      if (name !== "AbortError") {
        const hint = name === "NotAllowedError"
          ? t("qa.report.captureBlocked", "Screen capture was blocked or cancelled. If you meant to allow it, check your browser / system screen-recording permission — or just upload an image.")
          : t("qa.report.captureFail", "Couldn't capture the screen. Try uploading instead.");
        setError(name ? `${hint} (${name})` : hint);
      }
      return;
    }

    // Hide the modal so the screenshot shows the page underneath, not this panel.
    setCapturing(true);
    const video = document.createElement("video");
    try {
      video.srcObject = stream;
      video.muted = true;
      (video as HTMLVideoElement).playsInline = true;
      // Some browsers only paint frames for a video that's actually in the DOM,
      // so attach it off-screen (1px, invisible) for the duration of the grab.
      video.style.cssText = "position:fixed;left:-99999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none;";
      document.body.appendChild(video);
      await video.play().catch(() => {});

      // Wait for a REAL painted frame before drawing (avoids black/blank shots),
      // and give the panel a beat to disappear. requestVideoFrameCallback is the
      // reliable signal where available; otherwise fall back to loadeddata + delay.
      await new Promise<void>((res) => {
        let settled = false;
        const finish = () => { if (!settled) { settled = true; res(); } };
        const v = video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number };
        if (typeof v.requestVideoFrameCallback === "function") {
          v.requestVideoFrameCallback(() => setTimeout(finish, 200));
        } else if (video.readyState >= 2) {
          setTimeout(finish, 320);
        } else {
          video.onloadeddata = () => setTimeout(finish, 320);
        }
        setTimeout(finish, 1500); // hard cap so we never hang
      });

      const w = video.videoWidth || 1280;
      const h = video.videoHeight || 720;
      // Cap the longest side so the file stays well under the 5 MB limit.
      const maxSide = 1920;
      const scale = Math.max(w, h) > maxSide ? maxSide / Math.max(w, h) : 1;
      const tw = Math.max(1, Math.round(w * scale));
      const th = Math.max(1, Math.round(h * scale));

      const canvas = document.createElement("canvas");
      canvas.width = tw; canvas.height = th;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no-2d-context");
      ctx.drawImage(video, 0, 0, tw, th);

      const toBlob = (type: string, q?: number) =>
        new Promise<Blob | null>((res) => canvas.toBlob(res, type, q));
      let blob = await toBlob("image/png");
      if (blob && blob.size > MAX_BYTES) blob = await toBlob("image/jpeg", 0.9);

      if (blob && blob.size > 0) {
        const ext = blob.type === "image/jpeg" ? "jpg" : "png";
        setImage(new File([blob], `screenshot-${Date.now()}.${ext}`, { type: blob.type }));
      } else {
        setError(t("qa.report.captureFail", "Couldn't capture the screen. Try uploading instead."));
      }
    } catch {
      setError(t("qa.report.captureFail", "Couldn't capture the screen. Try uploading instead."));
    } finally {
      try { stream.getTracks().forEach((tr) => tr.stop()); } catch { /* no-op */ }
      try { video.srcObject = null; video.remove(); } catch { /* no-op */ }
      setCapturing(false);
    }
  }, [busy, capturing, setImage, t]);

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
    if (!title.trim()) { setError(t("qa.report.errTitle", "Please add a short title.")); return; }
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
          // Phase-2 component inspection metadata (null when not selected).
          component_name: selected?.component ?? null,
          component_module: selected?.module ?? null,
          component_section: selected?.section ?? null,
          component_record_id: selected?.recordId ?? null,
          component_rect: selected?.rect ?? null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(humanizeError(j.error ?? `HTTP ${res.status}`));
      setDone(true);
      // Tell any open issue list (admin console) to refresh — it lives in a
      // separate component tree, so without this a freshly-filed report won't
      // appear until a manual reload/filter change.
      try { window.dispatchEvent(new CustomEvent("qa:issue-created", { detail: { id: j.id ?? null } })); } catch { /* no-op */ }
      setTimeout(onClose, 1400);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("qa.report.errSubmit", "Couldn't submit the report."));
    } finally {
      setBusy(false);
    }
  }

  const field = "w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--border-focus)] placeholder:text-[var(--text-ghost)]";
  const label = "block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)] mb-1";

  // While inspecting (or grabbing a live screenshot), hide the panel entirely
  // (state preserved) so it doesn't obstruct the overlay / appear in the shot.
  // The panel returns on pick / Esc / once the capture frame is taken.
  if (inspecting || capturing) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={t("qa.report.title", "Report an issue")} onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-2xl sm:max-w-[560px] sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <MessageSquarePlusIcon size={16} className="text-[var(--text-secondary)]" />
            <h2 className="text-[14px] font-bold">{t("qa.report.title", "Report an issue")}</h2>
          </div>
          <button type="button" onClick={() => !busy && onClose()} aria-label={t("qa.report.close", "Close")} className="text-[var(--text-dim)] hover:text-[var(--text-primary)]">✕</button>
        </div>

        {done ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#00CC66]/12 text-[#00CC66] text-xl">✓</div>
            <p className="text-[14px] font-semibold">{t("qa.report.thanks", "Thank you — report submitted.")}</p>
            <p className="text-[12px] text-[var(--text-dim)]">{t("qa.report.thanksSub", "The team can see it in Issue Reports.")}</p>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-3.5 overflow-y-auto px-5 py-4">
              {/* Context line */}
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-dim)]">
                <span className="rounded-md bg-[var(--bg-surface)] px-1.5 py-0.5 font-medium text-[var(--text-secondary)]">{env.appModule}</span>
                <span className="truncate rounded-md bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono">{env.route}</span>
              </div>

              {/* Component inspector — pick a specific UI component for this report. */}
              {selected ? (
                <div className="flex items-start gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-subtle)] px-3 py-2">
                  <span className="mt-0.5 text-[var(--text-secondary)]"><TargetIcon size={14} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-semibold text-[var(--text-primary)]">
                      {selected.component}
                      {selected.fallback ? <span className="ml-1 text-[10px] font-normal text-[var(--text-ghost)]">{t("qa.report.untagged", "(untagged)")}</span> : null}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10.5px] text-[var(--text-dim)]">
                      {selected.module ? <span>{selected.module}</span> : null}
                      {selected.section ? <span>· {selected.section}</span> : null}
                      {selected.recordId ? <span>· #{selected.recordId}</span> : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={pickComponent} className="rounded-md px-2 py-1 text-[11px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)]">{t("qa.report.reselect", "Re-select")}</button>
                    <button type="button" onClick={() => setSelected(null)} className="rounded-md px-2 py-1 text-[11px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)]">{t("qa.report.clear", "Clear")}</button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={pickComponent}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border-color)] py-2 text-[12px] font-medium text-[var(--text-dim)] transition-colors hover:border-[var(--border-focus)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]"
                >
                  <TargetIcon size={14} /> {t("qa.report.selectComponent", "Select specific item / component")}
                </button>
              )}

              {/* Type + Severity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>{t("qa.report.issueType", "Issue type")}</label>
                  <select value={issueType} onChange={(e) => setIssueType(e.target.value as IssueType)} className={field}>
                    {ISSUE_TYPES.map((o) => <option key={o.value} value={o.value}>{t("qa.issueType." + o.value, o.label)}</option>)}
                  </select>
                </div>
                <div>
                  <label className={label}>{t("qa.report.severity", "Severity")}</label>
                  <select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)} className={field}>
                    {SEVERITIES.map((o) => <option key={o.value} value={o.value}>{t("qa.severity." + o.value, o.label)}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className={label}>{t("qa.report.titleLabel", "Title")}<span className="text-[var(--text-secondary)]"> *</span></label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("qa.report.titlePlaceholder", "Short summary of the issue")} className={field} maxLength={200} autoFocus />
              </div>
              <div>
                <label className={label}>{t("qa.report.whatHappened", "What happened?")}</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder={t("qa.report.whatHappenedPlaceholder", "Describe what you saw…")} className={field} />
              </div>
              <div>
                <label className={label}>{t("qa.report.expected", "Expected result")}</label>
                <textarea value={expected} onChange={(e) => setExpected(e.target.value)} rows={2} placeholder={t("qa.report.expectedPlaceholder", "What should happen instead?")} className={field} />
              </div>
              <div>
                <label className={label}>{t("qa.report.solution", "Suggested solution")} <span className="font-normal normal-case text-[var(--text-ghost)]">{t("qa.common.optional", "(optional)")}</span></label>
                <textarea value={solution} onChange={(e) => setSolution(e.target.value)} rows={2} placeholder={t("qa.report.solutionPlaceholder", "Any idea how to fix it?")} className={field} />
              </div>

              {/* Screenshot */}
              <div>
                <label className={label}>{t("qa.report.screenshot", "Screenshot")} <span className="font-normal normal-case text-[var(--text-ghost)]">{t("qa.report.screenshotHint", "(capture live, upload, paste or drag — PNG/JPG/WEBP)")}</span></label>
                {previewUrl ? (
                  <div className="relative overflow-hidden rounded-lg border border-[var(--border-color)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrl} alt="screenshot preview" className="max-h-48 w-full object-contain bg-[var(--bg-surface-subtle)]" />
                    <button type="button" onClick={() => setImage(null)} className="absolute right-2 top-2 rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium text-[var(--text-inverted)] hover:bg-black/80">{t("qa.common.remove", "Remove")}</button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Live capture — grab the screen right now (the browser shows
                        its own screen/window/tab picker). Desktop browsers only. */}
                    {captureSupported && (
                      <button
                        type="button"
                        onClick={captureScreenshot}
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] py-2.5 text-[12.5px] font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--border-focus)] hover:bg-[var(--bg-surface-subtle)]"
                      >
                        <MonitorIcon size={15} className="text-[var(--text-secondary)]" />
                        {t("qa.report.takeScreenshot", "Take a screenshot now")}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) setImage(f); }}
                      className={`flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed py-6 text-[12px] transition-colors ${dragOver ? "border-[var(--border-focus)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)]" : "border-[var(--border-color)] text-[var(--text-dim)] hover:border-[var(--border-focus)] hover:bg-[var(--bg-surface-subtle)]"}`}
                    >
                      <span className="text-[var(--text-secondary)]">{t("qa.report.clickUpload", "Click to upload")}</span>
                      <span className="text-[var(--text-ghost)]">{t("qa.report.dragHint", "or paste / drag an image here")}</span>
                    </button>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
              </div>

              {error && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-500 dark:text-rose-300">{error}</div>}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] px-5 py-3">
              <button type="button" onClick={() => !busy && onClose()} className="rounded-lg px-3.5 py-2 text-[13px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)]">{t("qa.common.cancel", "Cancel")}</button>
              <button type="button" onClick={submit} disabled={busy || !title.trim()} className="rounded-lg bg-[var(--bg-inverted)] px-4 py-2 text-[13px] font-semibold text-[var(--text-inverted)] shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50">
                {busy ? t("qa.report.submitting", "Submitting…") : t("qa.report.submit", "Submit report")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
