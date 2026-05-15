"use client";

/* ---------------------------------------------------------------------------
   /quotations/[id]/print — Print-only render of a single quotation.

   Used by the server-side PDF endpoint (/api/quotations/[id]/pdf): the
   Puppeteer browser navigates here, waits for `window.__quotation_pdf_ready__`
   to flip true, then snapshots the page to PDF. The route is also viewable
   by humans for previewing what the PDF will look like.

   Renders the same QuotationA4Preview the editor uses, but with stub
   callbacks (everything read-only) and absolutely no chrome — no header,
   no sidebar, no toolbars, no on-screen page-break gaps. The component's
   own @media print styles already handle final layout.
   --------------------------------------------------------------------------- */

import { use, useEffect, useMemo, useRef, useState } from "react";
import QuotationA4Preview from "@/components/quotations/QuotationA4Preview";
import { fromRow, type Quotation } from "@/components/quotations/Quotations";
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
     `window.__quotation_pdf_ready__ === true` before snapshotting, so
     pages where photos are still streaming in don't capture half-loaded
     thumbnails. */
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
      if (cancelled) return;
      (window as unknown as { __quotation_pdf_ready__?: boolean }).__quotation_pdf_ready__ = true;
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
    const gt =
      sub +
      (Number(quote.tax) || 0) +
      (Number(quote.shipping) || 0) +
      (Number(quote.others) || 0);
    return { subTotal: +sub.toFixed(2), grandTotal: +gt.toFixed(2) };
  }, [quote]);

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const numberToWords = (n: number) => {
    /* Lightweight USD-amount-in-words. Mirrors Quotations.tsx's helper
       in spirit; full enterprise i18n lives there but we only need the
       printed string here. */
    return `${Math.floor(n).toLocaleString("en-US")} USD AND ${Math.round((n % 1) * 100)
      .toString()
      .padStart(2, "0")} CENTS ONLY`;
  };

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
    <div className="quot-a4-stack" style={{ background: "#fff" }}>
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
      />
    </div>
  );
}
