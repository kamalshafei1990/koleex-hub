"use client";

/* ---------------------------------------------------------------------------
   ImageLightbox — click a table photo to view it at full/real size.

   Full-screen dark overlay, the image centred at its natural resolution
   (capped to the viewport so it never overflows, but as large as the screen
   allows). Click the backdrop, press Esc, or hit × to close. Portaled to
   <body> so it's never clipped by a transformed ancestor, and it stops click
   propagation so it can't bubble back into the photo cell's own onClick.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

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

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted || !open || !src) return null;

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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        onClick={(e) => e.stopPropagation()}
        onLoad={(e) => setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
        style={{
          maxWidth: "95vw",
          maxHeight: "92vh",
          width: "auto",
          height: "auto",
          objectFit: "contain",
          borderRadius: 8,
          boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
          background: "#fff",
          cursor: "default",
        }}
      />

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
