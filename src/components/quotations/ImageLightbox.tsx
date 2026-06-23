"use client";

/* ---------------------------------------------------------------------------
   ImageLightbox — click a table photo to view it at full/real size, with
   Download and a Frame toggle.

   - Full-screen dark overlay; the image centred at its natural resolution
     (capped to the viewport). Backdrop click / Esc / × closes it.
   - Frame: wraps the photo in a clean gallery frame (dark moulding + white
     matte). When on, the Download exports the FRAMED composite.
   - Download: saves the photo (framed via a canvas composite when the frame
     is on, otherwise the original file). Falls back gracefully if a remote
     image can't be drawn to a canvas (CORS) — downloads the original instead.

   Portaled to <body> so it's never clipped, and it stops click propagation so
   it can't bubble back into the photo cell's own onClick.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

const ACCENT = "#0066FF";

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

/* Draw the image inside a dark-moulding + white-matte frame on a canvas and
   return a PNG blob. Resolves null if the image taints the canvas (CORS). */
function buildFramedBlob(src: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      const unit = Math.min(w, h);
      const border = Math.max(10, Math.round(unit * 0.025));
      const matte = Math.max(12, Math.round(unit * 0.04));
      const pad = border + matte;
      const canvas = document.createElement("canvas");
      canvas.width = w + pad * 2;
      canvas.height = h + pad * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(null);
      ctx.fillStyle = "#0D0D0D"; // moulding
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#ffffff"; // matte
      ctx.fillRect(border, border, canvas.width - border * 2, canvas.height - border * 2);
      try {
        ctx.drawImage(img, pad, pad, w, h);
        canvas.toBlob((b) => resolve(b), "image/png");
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
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
  const [framed, setFramed] = useState(false);
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
      if (framed) {
        const framedBlob = await buildFramedBlob(src);
        if (framedBlob) {
          triggerDownload(framedBlob, `photo-framed-${Date.now()}.png`);
          return;
        }
        // CORS-tainted remote image — fall through to the original file.
      }
      const res = await fetch(src);
      const blob = await res.blob();
      const ext = (blob.type.split("/")[1] || "png").split("+")[0];
      triggerDownload(blob, `photo-${Date.now()}.${ext}`);
    } catch {
      window.open(src, "_blank");
    } finally {
      setBusy(false);
    }
  }, [busy, framed, src]);

  if (!mounted || !open || !src) return null;

  const toolBtn: React.CSSProperties = {
    height: 34,
    padding: "0 14px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.25)",
    background: "rgba(0,0,0,0.55)",
    color: "#fff",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
  };

  return createPortal(
    <div
      onClick={(e) => { e.stopPropagation(); onClose(); }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483000,
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        cursor: "zoom-out",
      }}
    >
      {/* Toolbar — Download + Frame toggle. */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: "fixed", top: 16, left: 18, display: "flex", gap: 8, cursor: "default" }}
      >
        <button type="button" onClick={download} disabled={busy} style={{ ...toolBtn, opacity: busy ? 0.6 : 1 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
          {busy ? "…" : "Download"}
        </button>
        <button
          type="button"
          onClick={() => setFramed((f) => !f)}
          style={{
            ...toolBtn,
            border: `1px solid ${framed ? ACCENT : "rgba(255,255,255,0.25)"}`,
            color: framed ? "#fff" : "#fff",
            background: framed ? ACCENT : "rgba(0,0,0,0.55)",
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="1" /><rect x="7" y="7" width="10" height="10" rx="1" /></svg>
          {framed ? "Framed" : "Frame"}
        </button>
      </div>

      {/* The photo, optionally inside a gallery frame. */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          cursor: "default",
          background: framed ? "#fff" : "transparent",
          border: framed ? "clamp(8px, 2vmin, 18px) solid #0D0D0D" : "none",
          padding: framed ? "clamp(8px, 2.4vmin, 24px)" : 0,
          borderRadius: framed ? 3 : 8,
          boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
          maxWidth: "95vw",
          maxHeight: "92vh",
          boxSizing: "border-box",
          display: "flex",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          onLoad={(e) => setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          style={{
            maxWidth: framed ? "calc(95vw - 90px)" : "95vw",
            maxHeight: framed ? "calc(92vh - 90px)" : "92vh",
            width: "auto",
            height: "auto",
            objectFit: "contain",
            display: "block",
            background: "#fff",
          }}
        />
      </div>

      {dims && (
        <div
          style={{
            position: "fixed",
            bottom: 18,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "5px 12px",
            borderRadius: 999,
            background: "rgba(0,0,0,0.6)",
            color: "rgba(255,255,255,0.85)",
            fontSize: 12,
            fontWeight: 600,
            pointerEvents: "none",
          }}
        >
          {dims.w} × {dims.h} px
        </div>
      )}

      <button
        type="button"
        aria-label="Close"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        style={{
          position: "fixed",
          top: 16,
          right: 18,
          width: 34,
          height: 34,
          borderRadius: 17,
          border: "1px solid rgba(255,255,255,0.25)",
          background: "rgba(0,0,0,0.55)",
          color: "#fff",
          fontSize: 18,
          lineHeight: 1,
          cursor: "pointer",
        }}
      >
        ×
      </button>
    </div>,
    document.body,
  );
}
