"use client";

import { useEffect, useState } from "react";
import CrossIcon from "@/components/icons/ui/CrossIcon";

/* ── Full-screen photo viewer ─────────────────────────────────────────────
   Replaces "open the image in a new tab". In the desktop shell a new tab has
   no chrome and therefore NO WAY BACK — the user is stranded on the picture.
   This is an in-app overlay instead:
     · click ANYWHERE outside the picture → close (the backdrop owns the click;
       the image stops propagation so clicking the photo itself never closes);
     · Escape → close;
     · right-click the photo → Save image (the native menu is unavailable in
       the packaged app, so the action is provided explicitly);
     · the picture is shown at its natural size, capped to the viewport. */
export default function PhotoLightbox({
  src,
  downloadHref,
  name,
  onClose,
  t,
}: {
  src: string;
  downloadHref: string | null;
  name: string;
  onClose: () => void;
  t: (key: string, fallback?: string) => string;
}) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const save = () => {
    setMenu(null);
    const a = document.createElement("a");
    a.href = downloadHref ?? src;
    a.download = name || "photo";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
      onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={name}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t("common.close", "Close")}
        className="absolute top-4 end-4 h-9 w-9 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-colors"
      >
        <CrossIcon className="h-4 w-4" />
      </button>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={name}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setMenu({ x: e.clientX, y: e.clientY });
        }}
        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl select-none"
        draggable={false}
      />

      {menu && (
        <div
          className="fixed z-[101] min-w-[160px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-2xl py-1"
          style={{ left: Math.min(menu.x, window.innerWidth - 180), top: Math.min(menu.y, window.innerHeight - 60) }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={save}
            className="w-full text-start px-3 py-2 text-[12.5px] text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
          >
            {t("photo.save", "Save image")}
          </button>
        </div>
      )}
    </div>
  );
}

