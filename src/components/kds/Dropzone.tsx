"use client";

import { useRef, useState } from "react";
import UploadIcon from "@/components/icons/ui/UploadIcon";

/* KDS Dropzone — ELECTED UP-1 by owner 2026-08-02 (ProductForm media
   style): dashed token panel, icon tile, drag state = focus border +
   subtle wash. Fixed-size tiles / attach rows / chip buttons reuse the
   same dashed-border language. */

export default function Dropzone({
  onFiles,
  accept,
  multiple,
  headline = "Drop files here or click to upload",
  hint,
  disabled,
  className = "",
}: {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  headline?: React.ReactNode;
  hint?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        if (!disabled) onFiles(Array.from(e.dataTransfer.files));
      }}
      onClick={() => { if (!disabled) inputRef.current?.click(); }}
      onKeyDown={(e) => { if (!disabled && (e.key === "Enter" || e.key === " ")) inputRef.current?.click(); }}
      className={`border border-dashed rounded-xl py-8 text-center transition-all ${
        disabled
          ? "opacity-50 cursor-not-allowed border-[var(--border-subtle)]"
          : drag
            ? "cursor-copy border-[var(--border-focus)] bg-[var(--bg-surface-subtle)]/60"
            : "cursor-pointer border-[var(--border-subtle)] hover:border-[var(--border-focus)]/60 hover:bg-[var(--bg-surface-subtle)]/30"
      } ${className}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          onFiles(Array.from(e.target.files || []));
          e.target.value = "";
        }}
      />
      <div className="h-10 w-10 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] mx-auto mb-2 flex items-center justify-center">
        <UploadIcon className="h-4 w-4 text-[var(--text-dim)]" />
      </div>
      <p className="text-[11px] font-medium text-[var(--text-dim)]">{headline}</p>
      {hint && <p className="text-[10px] text-[var(--text-ghost)] mt-0.5">{hint}</p>}
    </div>
  );
}
