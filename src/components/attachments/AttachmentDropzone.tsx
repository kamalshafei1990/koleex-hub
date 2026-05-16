"use client";

/* ===========================================================================
   AttachmentDropzone  —  Phase 2.1

   Drag-and-drop · paste · tap-to-attach upload control. Designed to
   feel like Linear's attach affordance, not an SAP form. One row.

     · Drag a file over the surface              → highlight + upload
     · Paste a screenshot from the clipboard     → upload
     · Tap "Attach" / "Camera"                   → file picker (capture)
     · Multi-file selection                      → uploads in series

   Mobile uses the `capture="environment"` attribute so the OS opens
   the back camera directly, matching the "phone receipt" workflow.

   Calm-state only: no progress bars, no toasts, no modals. A small
   inline spinner during upload; the parent re-fetches on completion.
   ========================================================================== */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ATTACHMENT_ALLOWED_MIME,
  ATTACHMENT_MAX_BYTES,
  uploadAttachment,
  validateFile,
} from "@/lib/attachments/client";
import type {
  AttachmentCategory,
  AttachmentEntityType,
  FinanceAttachment,
} from "@/lib/finance/types";

const ACCEPT = Array.from(ATTACHMENT_ALLOWED_MIME).join(",");

interface Props {
  entityType: AttachmentEntityType;
  entityId: string;
  category?: AttachmentCategory;
  /** Render compact (single row) vs. larger drop surface. */
  compact?: boolean;
  /** Called after each successful upload. */
  onUploaded?: (attachment: FinanceAttachment, duplicate: { id: string; file_name: string } | null) => void;
  /** Disable the surface (e.g. when entity isn't saved yet). */
  disabled?: boolean;
  /** Extra placeholder text. */
  placeholder?: string;
}

export default function AttachmentDropzone({
  entityType,
  entityId,
  category = "receipt",
  compact = false,
  onUploaded,
  disabled,
  placeholder,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Paste-screenshot listener (only while dropzone is mounted). */
  useEffect(() => {
    if (disabled) return;
    const onPaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const files: File[] = [];
      for (const item of Array.from(e.clipboardData.items)) {
        if (item.kind === "file") {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        void uploadAll(files);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, entityType, entityId, category]);

  const uploadAll = useCallback(async (files: File[]) => {
    if (disabled || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      for (const f of files) {
        const v = validateFile(f);
        if (v) { setError(v.message); continue; }
        const result = await uploadAttachment({
          file: f, entity_type: entityType, entity_id: entityId, category,
        });
        onUploaded?.(result.attachment, result.duplicate);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }, [disabled, entityType, entityId, category, onUploaded]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setHover(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) void uploadAll(files);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) void uploadAll(files);
    /* Reset so the same file can be re-selected without page reload. */
    e.target.value = "";
  };

  const surfaceCls =
    "relative flex items-center gap-2.5 rounded-xl border border-dashed transition-all duration-200 " +
    (hover && !disabled
      ? "border-white/[0.18] bg-white/[0.04]"
      : "border-white/[0.08] bg-white/[0.012] hover:border-white/[0.12]") +
    (disabled ? " pointer-events-none opacity-50" : "");

  const inner = (
    <>
      <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-[12px] text-gray-300">
        {busy ? <Spinner /> : <PaperclipIcon />}
      </span>
      <div className="min-w-0 flex-1 text-left">
        <div className="truncate text-[12px] font-medium text-gray-200">
          {placeholder ?? "Drop · paste · or attach receipt"}
        </div>
        {error ? (
          <div className="mt-0.5 truncate text-[10px] text-rose-300/90">{error}</div>
        ) : (
          <div className="mt-0.5 truncate text-[10px] text-gray-500">
            PDF / JPG / PNG · up to {Math.round(ATTACHMENT_MAX_BYTES / (1024 * 1024))} MB
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[10px] font-medium text-gray-300 hover:bg-white/[0.05] hover:text-white"
        >
          Attach
        </button>
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[10px] font-medium text-gray-300 hover:bg-white/[0.05] hover:text-white"
          title="Take photo"
        >
          Camera
        </button>
      </div>
    </>
  );

  return (
    <div
      className={surfaceCls + (compact ? " px-3 py-2" : " px-4 py-3")}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setHover(true); }}
      onDragLeave={() => setHover(false)}
      onDrop={onDrop}
    >
      {inner}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={onFileChange}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFileChange}
      />
    </div>
  );
}

/* ─── icons (inline so the file is self-contained) ─────────────────── */

function PaperclipIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" className="animate-spin">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
