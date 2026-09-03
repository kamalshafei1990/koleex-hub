"use client";

/* ---------------------------------------------------------------------------
   PhotoLightbox — a picture, full screen, inside the app.

   THE OWNER: "when I press a product photo it does not expand but takes me
   somewhere else". It did: the thumbnail was a link to the raw file in a new
   tab, which in the installed app means leaving the app for a browser page
   showing a bare JPEG. ChatGPT expands the picture in place; so does this.

   One picture, dark ground, the image fitted whole (never cropped), its
   name under it, closed by the ✕, by tapping the ground, or by Escape. Above
   the call screen (z-200) and below ConfirmDialog (z-300). No zoom gestures,
   no carousel: a call is not the place to study a picture, and the saved
   message still carries it full size.
   --------------------------------------------------------------------------- */

import { useEffect } from "react";

export type LightboxPhoto = { url: string; label?: string | null };

export default function PhotoLightbox({
  photo,
  onClose,
  closeLabel = "Close",
}: {
  photo: LightboxPhoto | null;
  onClose: () => void;
  closeLabel?: string;
}) {
  /* Escape closes the picture — and ONLY the picture. Listeners further up
     (the call screen ends the call on Escape) must not see this press, so
     it is stopped here, in the capture phase, before it reaches them. */
  useEffect(() => {
    if (!photo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      e.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [photo, onClose]);

  if (!photo) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={photo.label || closeLabel}
      className="fixed inset-0 z-[260] flex flex-col items-center justify-center bg-[#0D0D0D]/95 p-4"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="absolute top-4 right-4 h-12 w-12 rounded-full inline-flex items-center justify-center text-white border border-white/20 bg-white/[0.06] hover:bg-white/[0.12] transition-[background-color,transform] duration-150 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF]"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 16px)" }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.url}
        alt={photo.label || ""}
        decoding="async"
        className="max-h-[80dvh] max-w-full rounded-2xl object-contain select-none"
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />
      {photo.label && (
        <p className="mt-4 max-w-[820px] text-center text-sm text-[#AAAAAA]" onClick={(e) => e.stopPropagation()}>
          {photo.label}
        </p>
      )}
    </div>
  );
}
