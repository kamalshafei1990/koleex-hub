"use client";

/* ---------------------------------------------------------------------------
   SquareLogoCropper — pick/crop a logo (or a screenshot) to a SQUARE.
   The selection is locked 1:1: move it, drag the corner to resize, it always
   stays square. Outputs a downscaled PNG data URL (<=512px).
   Used by the supplier form's Add/Change Logo.
   --------------------------------------------------------------------------- */

import { useRef, useState } from "react";

const ACCENT = "#0066FF";

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(v, max)); }

export default function SquareLogoCropper({ src, onCancel, onCrop }: { src: string; onCancel: () => void; onCrop: (dataUrl: string) => void }) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [disp, setDisp] = useState<{ w: number; h: number } | null>(null);
  const [sel, setSel] = useState<{ x: number; y: number; size: number } | null>(null);
  const mode = useRef<null | { type: "move" | "resize"; px: number; py: number; ox: number; oy: number; os: number }>(null);

  const onImgLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    const w = img.clientWidth, h = img.clientHeight;
    const size = Math.round(Math.min(w, h) * 0.8);
    setDisp({ w, h });
    setSel({ x: Math.round((w - size) / 2), y: Math.round((h - size) / 2), size });
  };

  const startMove = (e: React.PointerEvent) => {
    if (!sel) return;
    e.stopPropagation();
    mode.current = { type: "move", px: e.clientX, py: e.clientY, ox: sel.x, oy: sel.y, os: sel.size };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const startResize = (e: React.PointerEvent) => {
    if (!sel) return;
    e.stopPropagation();
    mode.current = { type: "resize", px: e.clientX, py: e.clientY, ox: sel.x, oy: sel.y, os: sel.size };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const m = mode.current;
    if (!m || !sel || !disp) return;
    const dx = e.clientX - m.px, dy = e.clientY - m.py;
    if (m.type === "move") {
      setSel({ size: m.os, x: clamp(m.ox + dx, 0, disp.w - m.os), y: clamp(m.oy + dy, 0, disp.h - m.os) });
    } else {
      const maxS = Math.min(disp.w - m.ox, disp.h - m.oy);
      setSel({ x: m.ox, y: m.oy, size: clamp(m.os + Math.max(dx, dy), 40, maxS) });
    }
  };
  const onUp = () => { mode.current = null; };

  const doCrop = () => {
    const img = imgRef.current;
    if (!img || !sel) return;
    const s = img.naturalWidth / img.clientWidth;
    const srcSide = Math.round(sel.size * s);
    const out = Math.min(512, srcSide);
    const canvas = document.createElement("canvas");
    canvas.width = out; canvas.height = out;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, sel.x * s, sel.y * s, srcSide, srcSide, 0, 0, out, out);
    /* PNG output of a photo crop was 5–10× the size of JPEG and rode inside
       the save payload as base64 — the single biggest reason "save with a
       photo" took forever on slow uplinks. Keep PNG only when the crop
       actually contains transparency (logos); photos become JPEG q0.85. */
    let hasAlpha = false;
    try {
      const px = ctx.getImageData(0, 0, out, out).data;
      for (let i = 3; i < px.length; i += 64) {
        if (px[i] < 250) { hasAlpha = true; break; }
      }
    } catch { /* tainted canvas can't be sampled — JPEG is the safe default */ }
    onCrop(hasAlpha ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.85));
  };

  return (
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.8)" }}>
      <div className="mb-3 text-[13px] text-white/90">Move the square over the logo · drag the corner to resize · it stays square.</div>
      <div className="relative inline-block touch-none select-none" style={{ maxHeight: "70vh" }} onPointerMove={onMove} onPointerUp={onUp}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={imgRef} src={src} alt="logo source" draggable={false} onLoad={onImgLoad} style={{ maxHeight: "70vh", maxWidth: "86vw", display: "block" }} />
        {sel && (
          <div className="absolute" onPointerDown={startMove}
            style={{ left: sel.x, top: sel.y, width: sel.size, height: sel.size, border: `2px solid ${ACCENT}`, boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)", cursor: "move" }}>
            <div onPointerDown={startResize} className="absolute -right-2 -bottom-2 h-5 w-5 rounded-full"
              style={{ background: ACCENT, border: "2px solid #fff", cursor: "nwse-resize" }} />
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 text-[13px] rounded-lg text-white/80 hover:text-white">Cancel</button>
        <button onClick={doCrop} className="px-4 py-1.5 text-[13px] font-semibold rounded-lg" style={{ background: "#fff", color: "#111" }}>Use square</button>
      </div>
    </div>
  );
}
