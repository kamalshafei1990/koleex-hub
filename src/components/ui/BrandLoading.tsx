"use client";

/* ---------------------------------------------------------------------------
   BrandLoading — THE one loading moment for every full-content surface.
   (Loading language v2, owner pick 2026-08-08: motion sample "B — logo breath")

   The KOLEEX hub lockup breathing over a clean surface with a light-sweep
   underline (globals: .kx-brand-load). Use this for every APP-LEVEL gate:
   route loading.tsx (via AppShellSkeletons), dynamic-import fallbacks,
   in-component "data still loading" full states. Do NOT use it for small
   in-place placeholders (table rows, dialog sections) — those stay as quiet
   text/spinners; a logo inside a table cell is noise, not brand.

   CSS-only animation, theme-aware webp pair (17KB each, cached after first
   load), reduced-motion-safe via the app-wide neutralizer. */

export default function BrandLoading({
  label = "Loading…",
  className = "min-h-[60vh]",
}: {
  label?: string;
  /** Sizing/positioning of the surface the loader centers in. */
  className?: string;
}) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={`relative w-full ${className}`}>
      <span className="sr-only">{label}</span>
      <div className="kx-brand-load" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element -- 17KB webp, no optimization needed */}
        <img src="/brand/hub-logo/koleex-hub-logo-for-dark.webp" alt="" className="kx-brand-logo-dark" />
        {/* eslint-disable-next-line @next/next/no-img-element -- theme twin of the above */}
        <img src="/brand/hub-logo/koleex-hub-logo-for-light.webp" alt="" className="kx-brand-logo-light" />
        <div className="kx-brand-underline" />
      </div>
    </div>
  );
}
