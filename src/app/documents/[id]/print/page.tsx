"use client";

/* ---------------------------------------------------------------------------
   /documents/[id]/print — the clean sheet a packing list is printed from.

   Same reason the contract and the invoice have one. PackingListDoc called
   window.print() on the EDITOR, which drags the Hub layout, the Aurora scope
   and the ground canvas into the print pass; the surviving wrappers then
   impose their own heights on the page box. Measured on a real list: the
   sheet came out 297 × 356.5 mm against A4 landscape's 297 × 210 — 1.7 pages
   tall, so the second sheet carried a stub and 70% white.

   Nothing here but the document: no shell, no scope, no ground. The segment
   layout skips this route for exactly that reason.
   --------------------------------------------------------------------------- */

import { use, useEffect, useState } from "react";
import PackingListDoc from "@/components/documents/PackingListDoc";
import { getDocument, type DocumentRow } from "@/lib/documents-store";

export default function PackingListPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [row, setRow] = useState<DocumentRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const full = await getDocument(id);
      if (cancelled) return;
      if (!full) setError("Document not found.");
      else setRow(full);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  /* Names the saved PDF — the browser uses document.title as the filename. */
  useEffect(() => {
    if (!row) return;
    const prev = document.title;
    const meta = (row.doc as { meta?: { companyName?: string; invoiceNo?: string } } | null)?.meta;
    document.title = [meta?.companyName, row.doc_no || meta?.invoiceNo].filter(Boolean).join(" - ") || "Packing List";
    return () => {
      document.title = prev;
    };
  }, [row]);

  /* The ready handshake the export button polls through the iframe. Images and
     webfonts must settle first or the PDF prints in a fallback face. */
  useEffect(() => {
    if (!row) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      await Promise.all(
        Array.from(document.images).map((img) =>
          img.complete && img.naturalWidth > 0
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.addEventListener("load", () => resolve(), { once: true });
                img.addEventListener("error", () => resolve(), { once: true });
              }),
        ),
      );
      if ("fonts" in document) {
        try {
          await document.fonts.ready;
        } catch {
          /* ignore */
        }
      }
      if (cancelled) return;
      (window as unknown as { __quotation_pdf_ready__?: boolean }).__quotation_pdf_ready__ = true;
      if (new URLSearchParams(window.location.search).get("auto") === "1") {
        requestAnimationFrame(() => setTimeout(() => window.print(), 100));
      }
    }, 60);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [row]);

  if (error) return <div style={{ padding: 32, color: "#dc2626", fontFamily: "system-ui" }}>{error}</div>;
  if (!row) return <div style={{ padding: 32, color: "#6b7280", fontFamily: "system-ui" }}>Loading document…</div>;

  return (
    <>
      <style>{`
        html, body { margin:0 !important; padding:0 !important; background:#fff !important; overflow:visible !important; }
        /* The toolbar, the row-add buttons and every editor affordance. */
        .no-print { display:none !important; }
        /* The list GROWS — it is not a fixed stack of sheets. The table head
           repeats and rows never split, so the browser breaks it cleanly
           across landscape pages. */
        @page { size: A4 landscape; margin: 10mm; }
      `}</style>
      <PackingListDoc initial={row} onBack={() => {}} onChanged={() => {}} />
    </>
  );
}
