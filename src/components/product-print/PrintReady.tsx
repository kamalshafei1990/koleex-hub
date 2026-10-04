"use client";

/* PrintReady — the one client piece of the printed product sheet. Waits
 * for every image and the fonts to settle (a PDF printed a beat too early
 * ships a blank photo box and a fallback face), marks the document ready
 * for a headless snapshot, and opens the print dialog when the URL asks
 * (?auto=1). The same handshake the quotation and packing-list sheets use.
 */
import { useEffect } from "react";

export default function PrintReady() {
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const imgs = Array.from(document.images);
      await Promise.all(
        imgs.map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.addEventListener("load", () => resolve(), { once: true });
                img.addEventListener("error", () => resolve(), { once: true });
              }),
        ),
      );
      if ("fonts" in document) {
        try { await document.fonts.ready; } catch { /* print with what we have */ }
      }
      if (cancelled) return;
      (window as unknown as { __product_pdf_ready__?: boolean }).__product_pdf_ready__ = true;
      if (new URLSearchParams(window.location.search).get("auto") === "1") {
        requestAnimationFrame(() => setTimeout(() => window.print(), 100));
      }
    }, 60);
    return () => { cancelled = true; clearTimeout(t); };
  }, []);
  return null;
}
