"use client";

/* ---------------------------------------------------------------------------
   HrFileField — drag-and-drop (or click, or paste) upload for an HR document.

   Replaces the "paste a URL" input that used to sit on the leave form: nobody
   has a URL for the medical certificate in their hand — they have a photo of
   it on their phone. This uploads straight into the PRIVATE hr-documents
   bucket via /api/hr/upload and hands back the storage PATH, which is what
   gets stored on the record.

   The value is a storage path, never a public URL. Viewing goes through
   /api/storage/signed-url so the file stays unreadable without a session, and
   the tenant-prefix guard rejects another tenant's path.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import UploadIcon from "@/components/icons/ui/UploadIcon";
import PaperclipIcon from "@/components/icons/ui/PaperclipIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "webp", "gif", "heic", "heif"]);

export function extOf(pathOrUrl: string): string {
  const clean = pathOrUrl.split("?")[0];
  const dot = clean.lastIndexOf(".");
  return dot === -1 ? "" : clean.slice(dot + 1).toLowerCase();
}

/** Legacy rows hold a plain https URL; new rows hold a private storage path. */
export function isStoragePath(value: string): boolean {
  return !!value && !/^https?:\/\//i.test(value);
}

/** Resolve a stored value to something an <a href> or <img src> can use. */
export async function resolveHrFileUrl(value: string): Promise<string | null> {
  if (!value) return null;
  if (!isStoragePath(value)) return value;
  try {
    const res = await fetch("/api/storage/signed-url", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bucket: "hr-documents", path: value, expiresIn: 1800 }),
    });
    if (!res.ok) return null;
    const { signedUrl } = (await res.json()) as { signedUrl?: string };
    return signedUrl ?? null;
  } catch {
    return null;
  }
}

export default function HrFileField({
  value,
  onChange,
  folder = "leave",
  label,
  hint,
  browseLabel,
  removeLabel,
  errorLabel,
  disabled,
}: {
  /** Storage path (or a legacy URL), "" when empty. */
  value: string;
  onChange: (path: string) => void;
  folder?: "leave" | "documents" | "payroll" | "training";
  /** Drop-zone headline, e.g. "Drag a file here or browse". */
  label: string;
  hint?: string;
  browseLabel: string;
  removeLabel: string;
  /** Fallback message when the upload fails for an unnamed reason. */
  errorLabel: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  /* Signed URLs expire, so resolve on demand rather than caching one in the
     form state — the modal can sit open for a long time. */
  useEffect(() => {
    let cancelled = false;
    if (!value || !IMAGE_EXT.has(extOf(value))) { setPreview(null); return; }
    resolveHrFileUrl(value).then((url) => { if (!cancelled) setPreview(url); });
    return () => { cancelled = true; };
  }, [value]);

  const upload = useCallback(
    async (file: File) => {
      setBusy(true);
      setError(null);
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("name", file.name);
        fd.append("folder", folder);
        const res = await fetch("/api/hr/upload", {
          method: "POST",
          credentials: "include",
          body: fd,
        });
        const json = (await res.json().catch(() => null)) as
          | { attachment?: { path: string }; error?: string }
          | null;
        if (!res.ok || !json?.attachment) {
          setError(json?.error || errorLabel);
          return;
        }
        onChange(json.attachment.path);
      } catch {
        setError(errorLabel);
      } finally {
        setBusy(false);
      }
    },
    [folder, onChange, errorLabel],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (disabled || busy) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void upload(file);
  };

  const open = async () => {
    const url = await resolveHrFileUrl(value);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  /* ── Uploaded state ── */
  if (value) {
    return (
      <div>
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL
            <img src={preview} alt="" className="h-11 w-11 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="h-11 w-11 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
              <span className="text-[10px] font-semibold uppercase text-[var(--text-dim)]">
                {extOf(value) || "file"}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={open}
            className="flex-1 min-w-0 text-start text-[13px] text-[var(--accent)] hover:underline truncate"
          >
            {label}
          </button>
          <button
            type="button"
            onClick={() => onChange("")}
            disabled={disabled}
            aria-label={removeLabel}
            title={removeLabel}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors shrink-0"
          >
            <CrossIcon size={14} />
          </button>
        </div>
        {hint && <div className="mt-1.5 text-[11px] text-[var(--text-dim)]">{hint}</div>}
      </div>
    );
  }

  /* ── Empty / drop state ── */
  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !disabled && !busy && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); }
        }}
        className={`w-full rounded-xl border border-dashed px-4 py-5 flex flex-col items-center justify-center gap-2 text-center transition-colors ${
          disabled
            ? "opacity-50 cursor-not-allowed border-[var(--border-subtle)]"
            : dragging
              ? "border-[var(--accent)] bg-[var(--accent)]/[0.06] cursor-copy"
              : "border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-focus)] cursor-pointer"
        }`}
      >
        {busy ? (
          <SpinnerIcon size={18} className="animate-spin text-[var(--text-dim)]" />
        ) : (
          <UploadIcon size={18} className="text-[var(--text-dim)]" />
        )}
        <div className="text-[12px] text-[var(--text-muted)]">
          {label}{" "}
          <span className="text-[var(--accent)] font-medium">{browseLabel}</span>
        </div>
        {hint && <div className="text-[11px] text-[var(--text-dim)]">{hint}</div>}
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          /* Reset so picking the same file twice still fires onChange. */
          e.target.value = "";
        }}
      />

      {error && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-red-400">
          <PaperclipIcon size={11} className="shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
