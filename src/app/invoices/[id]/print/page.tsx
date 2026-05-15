"use client";

/* ---------------------------------------------------------------------------
   /invoices/[id]/print -- Print-only render of a single invoice.

   Mirrors /quotations/[id]/print but:
     - fetches from /api/invoices/doc/[id] (invoice rows live in a
       different table from quotations)
     - passes docKind="invoice" to QuotationA4Preview so the header,
       meta-strip labels, and footer copy switch to invoice wording
       ("COMMERCIAL INVOICE", "Invoice No", "Due Date", etc.) instead
       of quotation wording.

   The shared print stylesheet, the __quotation_pdf_ready__ poll, and
   the ?auto=1 print-trigger are all kept identical so the Export
   PDF button in InvoicesDoc gets the same instant Save-as-PDF flow
   as Quotations.
   --------------------------------------------------------------------------- */

import { use, useEffect, useMemo, useRef, useState } from "react";
import QuotationA4Preview from "@/components/quotations/QuotationA4Preview";
import { fromRow, type Invoice } from "@/components/invoices-doc/InvoicesDoc";
import type { RemoteDocRow } from "@/lib/docs-sync";

export default function InvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/invoices/doc/${encodeURIComponent(id)}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) {
          if (!cancelled) setError(`Could not load invoice (${res.status})`);
          return;
        }
        const json = (await res.json()) as { invoice: RemoteDocRow };
        if (!cancelled) setInvoice(fromRow(json.invoice));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  /* PDF-ready flag + auto-print trigger -- identical to the
     quotation print page so the Export PDF flow is consistent. */
  useEffect(() => {
    if (!invoice) return;
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
      const params = new URLSearchParams(window.location.search);
      if (params.get("auto") === "1") {
        requestAnimationFrame(() => {
          setTimeout(() => window.print(), 100);
        });
      }
    };
    const t = setTimeout(tick, 50);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [invoice]);

  /* Stub callbacks. The component requires them in its prop shape
     but nothing here mutates state. Cast to satisfy the typed
     signatures. */
  const stubSetCurrent = useMemo(() => () => { /* no-op */ }, []);
  const stubUpdate = useMemo(() => () => { /* no-op */ }, []);

  /* Recompute subTotal + grandTotal the same way the editor does. */
  const { subTotal, grandTotal } = useMemo(() => {
    if (!invoice) return { subTotal: 0, grandTotal: 0 };
    const sub = invoice.items.reduce(
      (s, it) => s + (Number(it.unitPrice) || 0) * (Number(it.qty) || 0),
      0,
    );
    const base =
      sub +
      (Number(invoice.tax) || 0) +
      (Number(invoice.shipping) || 0) +
      (Number(invoice.others) || 0);
    const pct = Math.max(
      0,
      Math.min(100, Number((invoice as { discountPct?: number }).discountPct) || 0),
    );
    const gt = base * (1 - pct / 100);
    return { subTotal: +sub.toFixed(2), grandTotal: +gt.toFixed(2) };
  }, [invoice]);

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const numberToWords = (n: number) => {
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
  if (!invoice) {
    return (
      <div style={{ padding: 32, color: "#6b7280", fontFamily: "system-ui" }}>
        Loading invoice…
      </div>
    );
  }

  return (
    <>
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
          padding: 24px 28px 18px !important;
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
        .no-print { display: none !important; }
        @page { size: A4 portrait; margin: 0; }
      `}</style>
      <div className="quot-a4-stack">
        {/* The renderer's prop signature was declared for the
            Quotation type before the doc-builder grew its second
            persona. Invoice has the same shape with extra fields
            (paid amount, payment history, invoice-status). For
            print-only purposes the renderer reads the same fields
            either way; cast through `never` to silence the variance
            mismatch on the `status` union ("paid" vs the four
            quotation states). */}
        <QuotationA4Preview
          current={invoice as unknown as never}
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
          isSuperAdmin={false}
          docKind="invoice"
        />
      </div>
    </>
  );
}
