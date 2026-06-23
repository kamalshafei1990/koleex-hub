"use client";

/* ---------------------------------------------------------------------------
   ImageLightbox — click a table photo to preview it inside a Koleex-Hub card.

   The image is shown at full/real size on a clean card that matches the Hub's
   design language (uses the same CSS-var tokens as the rest of the app, so it
   tracks light/dark). The card header carries the title, pixel dimensions, a
   Download button, and a close ×. Backdrop click / Esc also closes.

   Portaled to <body> so it's never clipped, and it stops click propagation so
   it can't bubble back into the photo cell's own onClick.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ImageLightbox({
  src,
  open,
  onClose,
}: {
  src: string;
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const download = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const ext = (blob.type.split("/")[1] || "png").split("+")[0];
      triggerDownload(blob, `photo-${Date.now()}.${ext}`);
    } catch {
      window.open(src, "_blank"); // CORS / network fallback
    } finally {
      setBusy(false);
    }
  }, [busy, src]);

  if (!mounted || !open || !src) return null;

  return createPortal(
    <div
      onClick={(e) => { e.stopPropagation(); onClose(); }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483000,
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      {/* Koleex-Hub card */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: "flex",
          flexDirection: "column",
          maxWidth: "94vw",
          maxHeight: "92vh",
          background: "var(--bg-secondary, #111111)",
          border: "1px solid var(--border-subtle, #2E2E2E)",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
        }}
      >
        {/* Header: title + dims · download + close */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "12px 14px",
            borderBottom: "1px solid var(--border-subtle, #2E2E2E)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary, #fff)" }}>
              Photo
            </span>
            {dims && (
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim, #888)" }}>
                {dims.w} × {dims.h} px
              </span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              onClick={download}
              disabled={busy}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                height: 32,
                padding: "0 14px",
                borderRadius: 8,
                border: "1px solid var(--border-subtle, #2E2E2E)",
                background: "var(--bg-surface, #1A1A1A)",
                color: "var(--text-primary, #fff)",
                fontSize: 12.5,
                fontWeight: 700,
                cursor: busy ? "default" : "pointer",
                opacity: busy ? 0.6 : 1,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
              {busy ? "Downloading…" : "Download"}
            </button>
            <button
              type="button"
              aria-label="Close"
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: "1px solid var(--border-subtle, #2E2E2E)",
                background: "var(--bg-surface, #1A1A1A)",
                color: "var(--text-secondary, #aaa)",
                fontSize: 17,
                lineHeight: 1,
                cursor: "pointer",
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Body: the image on a neutral stage */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            background: "var(--bg-base, #0D0D0D)",
            overflow: "auto",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            onLoad={(e) => setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            style={{
              maxWidth: "calc(94vw - 32px)",
              maxHeight: "calc(92vh - 96px)",
              width: "auto",
              height: "auto",
              objectFit: "contain",
              display: "block",
              borderRadius: 8,
              background: "#fff",
            }}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
