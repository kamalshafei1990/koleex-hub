"use client";

/* ---------------------------------------------------------------------------
   /contracts/[id]/print — the clean sheet the PDF is made from.

   ── Why this route exists ──────────────────────────────────────────────────
   The contract used to print by calling window.print() on the EDITOR. That
   drags the whole Hub layout into the print pass — shell wrappers, the Aurora
   ground, the toolbar, the field bands — and even with `.no-print` on the
   chrome the surviving wrappers still impose their own heights on the page
   box. The result is what the owner saw: pages that do not fit and a run of
   near-empty sheets.

   Invoices solved this long ago with a dedicated print route printed through
   a hidden iframe, and the comment there names the exact symptom: "printing
   the editor's window directly was tangling with the Hub layout's print CSS
   … producing every-other-sheet-blank in the saved PDF." The contract simply
   never got the same treatment.

   Nothing here but the sheets: no shell, no scope class, no ground.
   --------------------------------------------------------------------------- */

import { use, useEffect, useState } from "react";
import ContractA4 from "@/components/contracts/ContractA4";
import { PRINT_AND_DOC_STYLES } from "@/components/quotations/Quotations";
import type { ContractRef, ContractRow, InvoiceLite } from "@/components/contracts/types";

export default function ContractPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [row, setRow] = useState<ContractRow | null>(null);
  const [invoice, setInvoice] = useState<InvoiceLite | null>(null);
  const [amends, setAmends] = useState<ContractRef | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/sales-contracts/${encodeURIComponent(id)}`, { cache: "no-store" });
        const json = (await res.json()) as {
          contract?: ContractRow;
          invoice?: InvoiceLite;
          amends?: ContractRef | null;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !json.contract) throw new Error(json.error ?? "Contract not found.");
        setRow(json.contract);
        setInvoice(json.invoice ?? null);
        setAmends(json.amends ?? null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Contract not found.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  /* The browser's Save-as-PDF dialog uses document.title as the default
     filename, so the saved file is named for the deal rather than "print". */
  useEffect(() => {
    if (!row) return;
    const prev = document.title;
    const buyer =
      (row.terms?.buyer?.company || row.terms?.buyer?.name || "").trim();
    document.title = [buyer, row.contract_no].filter(Boolean).join(" - ");
    return () => {
      document.title = prev;
    };
  }, [row]);

  /* PDF-ready flag + auto-print — the same handshake the invoice print page
     uses, so the export button can poll for it through the iframe. Images and
     webfonts must have settled first or the PDF prints in a fallback face. */
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

  if (error) {
    return <div style={{ padding: 32, color: "#dc2626", fontFamily: "system-ui" }}>{error}</div>;
  }
  if (!row) {
    return <div style={{ padding: 32, color: "#6b7280", fontFamily: "system-ui" }}>Loading contract…</div>;
  }

  return (
    <>
      {/* The editor's stylesheet, or the sheets render against browser
          defaults and the PDF looks nothing like the screen. */}
      <style>{PRINT_AND_DOC_STYLES}</style>
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
          height: 270mm !important;
          min-height: 270mm !important;
          max-height: 270mm !important;
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
        /* size: auto so the page box follows the operator's paper pick. The
           sheet is 270 mm, which fits A4 (297) AND US Letter (279) without
           the every-other-blank-sheet overflow. */
        @page { size: auto; margin: 0; }
      `}</style>
      <div className="quot-a4-stack">
        <ContractA4
          contractNo={row.contract_no}
          status={row.status}
          dealNo={row.deal_no}
          contractDate={row.contract_date}
          placeOfSigning={row.place_of_signing}
          currency={row.currency}
          total={row.total}
          terms={row.terms ?? {}}
          invoice={invoice}
          snapshot={row.snapshot}
          amendsNo={amends?.contract_no ?? null}
        />
      </div>
    </>
  );
}
