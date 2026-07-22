"use client";

/* ---------------------------------------------------------------------------
   QA comment attachments — shared composer + viewer (Phase 4.2).

   One small module reused by BOTH the admin console (CommentsPanel) and the
   reporter view (ReporterIssueView), so attachment behaviour stays identical:

     • useCommentAttachments() — stages image uploads (click / paste / drop),
       uploads each via the existing /api/qa/upload endpoint, validates
       type+size client-side, manages object-URL previews, and returns the
       stored-metadata payload for the comment POST. Revokes object URLs on
       remove / clear / unmount (no memory leak).
     • <AttachmentStrip> — the composer chrome: attach button + staged
       previews (with remove) + upload spinner + error line.
     • <AttachmentThumbs> — read-only thumbnails in the comment thread, lazy
       loaded, opening a lightweight lightbox on click.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { qaT } from "@/lib/translations/qa";
import type { QaAttachment } from "@/lib/qa/types";

const ALLOWED = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_COUNT = 4;

interface Staged {
  path: string;
  name: string;
  type: string;
  size: number;
  previewUrl: string; // object URL for instant local preview
}

export interface AttachmentUploader {
  staged: Staged[];
  uploading: boolean;
  error: string | null;
  count: number;
  addFiles: (files: FileList | File[]) => Promise<void>;
  removeAt: (i: number) => void;
  clear: () => void;
  onPaste: (e: React.ClipboardEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  /** Stored metadata for the comment POST body (no preview URLs). */
  payload: () => Array<{ path: string; name: string; type: string; size: number }>;
}

export function useCommentAttachments(): AttachmentUploader {
  const { t } = useTranslation(qaT);
  const [staged, setStaged] = useState<Staged[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep a ref so the unmount cleanup sees the latest list.
  const stagedRef = useRef<Staged[]>([]);
  useEffect(() => { stagedRef.current = staged; }, [staged]);
  useEffect(() => () => { stagedRef.current.forEach((s) => URL.revokeObjectURL(s.previewUrl)); }, []);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    setError(null);
    // Track the count synchronously — stagedRef only updates after render, so a
    // multi-file batch would otherwise blow past MAX_COUNT (all iterations read
    // the same stale length) and then get rejected by the server on post.
    let projected = stagedRef.current.length;
    for (const f of list) {
      if (projected >= MAX_COUNT) { setError(t("qa.attach.max", `Up to ${MAX_COUNT} images per comment.`)); break; }
      if (!ALLOWED.includes(f.type)) { setError(t("qa.attach.type", "Only PNG, JPG or WEBP images are allowed.")); continue; }
      if (f.size > MAX_BYTES) { setError(t("qa.attach.size", "Image is too large (max 5 MB).")); continue; }
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("file", f);
        const res = await fetch("/api/qa/upload", { method: "POST", credentials: "include", body: fd });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || !j.path) throw new Error(j.error || t("qa.attach.uploadErr", "Upload failed."));
        const item: Staged = { path: j.path, name: f.name, type: f.type, size: f.size, previewUrl: URL.createObjectURL(f) };
        setStaged((prev) => [...prev, item]);
        projected++;
      } catch (e) {
        setError(e instanceof Error ? e.message : t("qa.attach.uploadErr", "Upload failed."));
      } finally {
        setUploading(false);
      }
    }
  }, [t]);

  const removeAt = useCallback((i: number) => {
    setStaged((prev) => {
      const next = [...prev];
      const [removed] = next.splice(i, 1);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setStaged((prev) => { prev.forEach((s) => URL.revokeObjectURL(s.previewUrl)); return []; });
    setError(null);
  }, []);

  const onPaste = useCallback((e: React.ClipboardEvent) => {
    const imgs = Array.from(e.clipboardData?.items ?? [])
      .filter((it) => it.type.startsWith("image/"))
      .map((it) => it.getAsFile())
      .filter((f): f is File => !!f);
    if (imgs.length) { e.preventDefault(); void addFiles(imgs); }
  }, [addFiles]);

  const onDrop = useCallback((e: React.DragEvent) => {
    const files = e.dataTransfer?.files;
    if (files && files.length) { e.preventDefault(); void addFiles(files); }
  }, [addFiles]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer?.types?.includes("Files")) e.preventDefault();
  }, []);

  const payload = useCallback(
    () => stagedRef.current.map((s) => ({ path: s.path, name: s.name, type: s.type, size: s.size })),
    [],
  );

  return { staged, uploading, error, count: staged.length, addFiles, removeAt, clear, onPaste, onDrop, onDragOver, payload };
}

/* ── Composer strip ──────────────────────────────────────────────────────── */
export function AttachmentStrip({ att, disabled }: { att: AttachmentUploader; disabled?: boolean }) {
  const { t } = useTranslation(qaT);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={disabled || att.uploading || att.count >= MAX_COUNT}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-2 py-1 text-[11.5px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] disabled:opacity-40"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
          {t("qa.attach.attach", "Attach")}
        </button>
        {att.uploading && <span className="text-[11px] text-[var(--text-dim)]">{t("qa.attach.uploading", "Uploading…")}</span>}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files) void att.addFiles(e.target.files); e.target.value = ""; }}
        />
      </div>

      {att.staged.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {att.staged.map((s, i) => (
            <div key={s.path} className="relative h-14 w-14 overflow-hidden rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.previewUrl} alt={s.name} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => att.removeAt(i)}
                aria-label={t("qa.attach.remove", "Remove attachment")}
                className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-[10px] font-bold text-white hover:bg-black/80"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {att.error && (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] text-rose-500 dark:text-rose-300">{att.error}</div>
      )}
    </div>
  );
}

/* ── Thumbnails + lightbox (read-only thread view) ───────────────────────── */
export function AttachmentThumbs({ attachments, internal = false }: { attachments: QaAttachment[]; internal?: boolean }) {
  const { t } = useTranslation(qaT);
  const [active, setActive] = useState<string | null>(null);
  const images = (attachments ?? []).filter((a) => a && a.url);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setActive(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active]);

  if (images.length === 0) return null;

  return (
    <>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {images.map((a) => (
          <button
            key={a.path}
            type="button"
            onClick={() => setActive(a.url ?? null)}
            className={`group relative h-16 w-16 overflow-hidden rounded-md border ${internal ? "border-amber-500/30" : "border-[var(--border-subtle)]"} bg-[var(--bg-surface-subtle)]`}
            title={a.name}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={a.url!} alt={a.name} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
          </button>
        ))}
      </div>

      {active && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6"
          onClick={() => setActive(null)}
          role="dialog"
          aria-modal="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={active} alt="attachment" className="max-h-[90vh] max-w-[92vw] rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
          <button
            type="button"
            onClick={() => setActive(null)}
            aria-label={t("qa.report.close", "Close")}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[18px] text-white hover:bg-white/20"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}
