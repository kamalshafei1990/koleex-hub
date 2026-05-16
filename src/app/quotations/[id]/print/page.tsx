"use client";

/* ---------------------------------------------------------------------------
   /quotations/[id]/print — Print-only render of a single quotation.

   Two callers:
     1. /api/quotations/[id]/pdf (server-side Puppeteer) — navigates here
        and snapshots the page to PDF. Used for the email-attach flow
        when that ships.
     2. The editor's "Export PDF" button — opens this page in a new
        window with `?auto=1`. The page auto-fires window.print() once
        every image has decoded, so the operator gets the browser's
        native "Save as PDF" dialog instantly with the same A4 layout
        the server would produce — no cold-start, no function timeout,
        works on every device.

   Renders the same QuotationA4Preview the editor uses, but with stub
   callbacks (everything read-only) and absolutely no chrome. The
   per-route stylesheet (further down) clamps every doc to exactly
   210×297 mm so the print dialog's preview matches A4 exactly.
   --------------------------------------------------------------------------- */

import { use, useEffect, useMemo, useRef, useState } from "react";
import QuotationA4Preview from "@/components/quotations/QuotationA4Preview";
import { fromRow, numberToWords, PRINT_AND_DOC_STYLES, type Quotation } from "@/components/quotations/Quotations";
import type { RemoteDocRow } from "@/lib/docs-sync";

export default function QuotationPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [quote, setQuote] = useState<Quotation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/quotations/${encodeURIComponent(id)}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) {
          if (!cancelled) setError(`Could not load quotation (${res.status})`);
          return;
        }
        const json = (await res.json()) as { quotation: RemoteDocRow };
        if (!cancelled) setQuote(fromRow(json.quotation));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  /* Flag the page as ready once the data is loaded and all <img> tags
     under the doc have finished decoding. The PDF endpoint polls for
     `window.__quotation_pdf_ready__ === true` before snapshotting,
     and the "Export PDF" button (when this page is opened with
     ?auto=1) waits on the same flag before firing window.print(). */
  useEffect(() => {
    if (!quote) return;
    let cancelled = false;
    const tick = async () => {
      const imgs = Array.from(document.images);
      await Promise.all(
        imgs.map((img) =>
          img.complete && img.naturalWidth > 0
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.addEventListener("load", () => resolve(), { once: true });
                img.addEventListener("error", () => resolve(), { once: true });
              }),
        ),
      );
      /* Also wait for web fonts to finish loading so the printed PDF
         renders in the doc's intended typeface (Inter / Geist) instead
         of the system fallback. */
      if (typeof document !== "undefined" && "fonts" in document) {
        try { await document.fonts.ready; } catch { /* ignore */ }
      }
      if (cancelled) return;
      (window as unknown as { __quotation_pdf_ready__?: boolean }).__quotation_pdf_ready__ = true;
      /* Auto-trigger the browser print dialog when the caller asked
         for it via `?auto=1`. Defer one animation frame so the
         layout flush from setting the flag commits first — Safari
         occasionally captures a half-painted frame otherwise. */
      const params = new URLSearchParams(window.location.search);
      if (params.get("auto") === "1") {
        requestAnimationFrame(() => {
          /* Give the browser a beat to settle multi-page reflow, then
             open the print dialog. The operator picks "Save as PDF"
             — same output as the server route would produce, but
             instant and with no cold-start cost. */
          setTimeout(() => window.print(), 100);
        });
      }
    };
    /* Small defer to let React commit the layout before we measure. */
    const t = setTimeout(tick, 50);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [quote]);

  /* Stub callbacks. The component requires them in its prop shape but
     nothing here mutates state. Cast to satisfy the typed signatures. */
  const stubSetCurrent = useMemo(
    () => () => {
      /* no-op for print mode */
    },
    [],
  );
  const stubUpdate = useMemo(
    () => () => {
      /* no-op */
    },
    [],
  );

  /* Recompute the same subtotal/grandTotal/fmt/numberToWords helpers the
     editor uses. The editor wraps these in useMemo over `current` — we
     mirror that here so the printed totals always match the saved doc. */
  const { subTotal, grandTotal } = useMemo(() => {
    if (!quote) return { subTotal: 0, grandTotal: 0 };
    const sub = quote.items.reduce(
      (s, it) => s + (Number(it.unitPrice) || 0) * (Number(it.qty) || 0),
      0,
    );
    const base =
      sub +
      (Number(quote.tax) || 0) +
      (Number(quote.shipping) || 0) +
      (Number(quote.others) || 0);
    const pct = Math.max(
      0,
      Math.min(100, Number((quote as { discountPct?: number }).discountPct) || 0),
    );
    const gt = base * (1 - pct / 100);
    return { subTotal: +sub.toFixed(2), grandTotal: +gt.toFixed(2) };
  }, [quote]);

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  /* Use the canonical word-form helper exported from Quotations.tsx
     so the printed "Total in Letters" line matches the editor
     exactly (the old inline stub here used digits, not words). */

  if (error) {
    return (
      <div style={{ padding: 32, color: "#dc2626", fontFamily: "system-ui" }}>
        {error}
      </div>
    );
  }
  if (!quote) {
    return (
      <div style={{ padding: 32, color: "#6b7280", fontFamily: "system-ui" }}>
        Loading quotation…
      </div>
    );
  }

  return (
    <>
      {/* Editor's full stylesheet — gives the print page ALL the
          black header strips, table grid lines, input styling,
          rounded corners, etc. that the editor uses. Without this
          the print route was rendering QuotationA4Preview against
          browser-default styles, so the PDF looked completely
          unstyled compared to the editor. */}
      <style>{PRINT_AND_DOC_STYLES}</style>
      {/* PDF-optimised overrides — only applies on this route.
          WYSIWYG goal: the printed PDF must look EXACTLY like the
          on-screen editor. Both surfaces lock to A4 210×297 mm and
          use the same 32 px / 24 px padding so per-page content
          boundaries match 1:1. @page size: A4 forces the browser to
          use A4 paper (not US Letter) regardless of the operator's
          local printer default — critical for Egyptian/Chinese
          customers where A4 is the regional standard and the doc
          was designed against. */}
      <style>{`
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: #fff !important;
          overflow: visible !important;
        }
        .quot-a4-stack {
          margin: 0 !important;
          padding: 0 !important;
          width: 210mm !important;
          background: #fff !important;
        }
        .quot-a4-doc {
          box-sizing: border-box !important;
          width: 210mm !important;
          height: 297mm !important;
          min-height: 297mm !important;
          max-height: 297mm !important;
          margin: 0 !important;
          padding: 32px 32px 24px !important;
          box-shadow: none !important;
          border: none !important;
          background: #fff !important;
          overflow: hidden !important;
          page-break-after: always !important;
          break-after: page !important;
          page-break-inside: avoid !important;
        }
        .quot-a4-doc:last-child {
          page-break-after: auto !important;
          break-after: auto !important;
        }
        /* No editor chrome on this route, but kill any stray
           .no-print elements (toolbars, file inputs etc.) just in
           case a future change adds one. */
        .no-print { display: none !important; }
        /* Force A4 paper — the doc was designed at exactly 210×297
           mm. Auto-sizing to US Letter would scale + add white space. */
        @page { size: A4; margin: 0; }
      `}</style>
      <div className="quot-a4-stack">
        <QuotationA4Preview
          current={quote}
          setCurrent={stubSetCurrent as never}
          updateItem={stubUpdate as never}
          addItem={stubUpdate as never}
          removeItem={stubUpdate as never}
          moveItem={stubUpdate as never}
          handleImageUpload={stubUpdate as never}
          fileInputRefs={fileInputRefs}
          subTotal={subTotal}
          grandTotal={grandTotal}
          fmt={fmt}
          numberToWords={numberToWords}
          /* Print render — everyone sees the stamp/signature images
             that were stamped on the quote, nobody sees the editor
             affordances. isSuperAdmin stays false so the action
             buttons (which are .no-print anyway) don't even mount. */
          isSuperAdmin={false}
        />
      </div>
    </>
  );
}
