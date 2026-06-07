"use client";

/* Preorder document — a customer-supplied price-request list (RFQ) that we
   price up before the official quotation. Designed as a clean, print-ready
   "paper" in Koleex light-mode grammar (white / black / grey + one blue),
   Arabic / RTL to match the customer's format. Adds Photo + Price columns.
   This screen is the document design + live pricing; saving to the DB, Excel
   import, and "convert to Quotation" are the next phases. */

import { useMemo, useState } from "react";
import { PREORDER_SECTIONS, PREORDER_BUYERS, PREORDER_META } from "./data";

const BLUE = "#0066FF";

function money(n: number): string {
  if (!n) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export default function PreorderPage() {
  // Price per line, keyed by "sectionIndex-itemIndex". Filled by us.
  const [prices, setPrices] = useState<Record<string, number>>({});

  const rows = useMemo(() => {
    let totalUnits = 0;
    let totalValue = 0;
    let lineCount = 0;
    for (let si = 0; si < PREORDER_SECTIONS.length; si++) {
      for (let ii = 0; ii < PREORDER_SECTIONS[si].items.length; ii++) {
        const it = PREORDER_SECTIONS[si].items[ii];
        const qty = it.q.reduce((a, b) => a + b, 0);
        const price = prices[`${si}-${ii}`] ?? 0;
        totalUnits += qty;
        totalValue += qty * price;
        lineCount += 1;
      }
    }
    return { totalUnits, totalValue, lineCount };
  }, [prices]);

  const colCount = 4 + PREORDER_BUYERS.length + 3; // photo,model,desc,...buyers, qty, price, line

  return (
    <div dir="rtl" className="min-h-screen bg-neutral-200/70 px-3 py-6 sm:px-6" style={{ colorScheme: "light" }}>
      {/* Print isolation + A4 landscape. */}
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 9mm; }
          html, body { background: #fff !important; }
          body * { visibility: hidden !important; }
          #preorder-doc, #preorder-doc * { visibility: visible !important; }
          #preorder-doc { position: absolute; inset: 0; margin: 0 !important; width: 100% !important; box-shadow: none !important; border: 0 !important; border-radius: 0 !important; }
          .no-print { display: none !important; }
          .pre-row { break-inside: avoid; }
          thead { display: table-header-group; }
          tr, td, th { break-inside: avoid; }
        }
      `}</style>

      {/* Toolbar (not printed) */}
      <div className="no-print mx-auto mb-4 flex max-w-[1180px] items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[13px] text-neutral-600" dir="ltr">
          <span className="rounded-md bg-neutral-900 px-2 py-1 text-[11px] font-bold tracking-wide text-white">KOLEEX</span>
          <span className="font-medium text-neutral-800">Preorder</span>
          <span className="text-neutral-400">/ price request</span>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          طباعة / تصدير PDF
        </button>
      </div>

      {/* The document "paper" */}
      <div id="preorder-doc" className="mx-auto max-w-[1180px] rounded-2xl border border-neutral-200 bg-white p-6 text-neutral-900 shadow-[0_2px_24px_rgba(0,0,0,0.08)] sm:p-9">
        {/* Letterhead */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-neutral-900 pb-4">
          <div dir="ltr">
            <div className="text-[22px] font-black leading-none tracking-tight">KOLEEX</div>
            <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-400">Smart Sewing Equipment</div>
          </div>
          <div className="text-left" dir="ltr">
            <div className="text-[20px] font-bold leading-none" style={{ color: BLUE }}>PREORDER</div>
            <div className="mt-1 text-[12px] text-neutral-500">طلب مُسبق — قائمة تسعير</div>
          </div>
        </div>

        {/* Meta strip */}
        <div className="mt-4 grid grid-cols-2 gap-3 text-[12.5px] sm:grid-cols-4">
          {[
            { l: "العميل", v: `${PREORDER_META.customerAr}` },
            { l: "المرجع", v: PREORDER_META.reference },
            { l: "العملة", v: PREORDER_META.currency },
            { l: "عدد البنود", v: String(rows.lineCount) },
          ].map((m) => (
            <div key={m.l} className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">{m.l}</div>
              <div className="mt-0.5 font-semibold text-neutral-800">{m.v}</div>
            </div>
          ))}
        </div>

        {/* Sections */}
        <div className="mt-5 space-y-5">
          {PREORDER_SECTIONS.map((sec, si) => (
            <section key={sec.en} className="overflow-hidden rounded-xl border border-neutral-200">
              {/* Section header */}
              <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-3 py-2">
                <span className="h-3.5 w-1 rounded" style={{ background: BLUE }} />
                <span className="text-[13px] font-bold text-neutral-900">{sec.ar}</span>
                <span className="text-[11px] text-neutral-400" dir="ltr">{sec.en}</span>
                <span className="ms-auto text-[11px] text-neutral-400">{sec.items.length} بند</span>
              </div>

              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr className="bg-white text-[10.5px] font-semibold uppercase tracking-wide text-neutral-500">
                    <th className="w-[44px] border-b border-neutral-200 px-2 py-2 text-center">صورة</th>
                    <th className="w-[120px] border-b border-neutral-200 px-2 py-2 text-center">الموديل</th>
                    <th className="border-b border-neutral-200 px-2 py-2 text-right">الوصف</th>
                    {PREORDER_BUYERS.map((b) => (
                      <th key={b} className="w-[58px] border-b border-neutral-200 px-1 py-2 text-center font-medium normal-case text-neutral-600">{b}</th>
                    ))}
                    <th className="w-[60px] border-b border-neutral-200 px-1 py-2 text-center">الكمية</th>
                    <th className="w-[96px] border-b border-neutral-200 px-2 py-2 text-center" style={{ color: BLUE }}>السعر</th>
                    <th className="w-[104px] border-b border-neutral-200 px-2 py-2 text-center">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {sec.items.map((it, ii) => {
                    const qty = it.q.reduce((a, b) => a + b, 0);
                    const key = `${si}-${ii}`;
                    const price = prices[key] ?? 0;
                    const line = qty * price;
                    return (
                      <tr key={key} className="pre-row align-middle odd:bg-white even:bg-neutral-50/60">
                        {/* Photo */}
                        <td className="border-b border-neutral-100 px-2 py-1.5 text-center">
                          {it.photo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={it.photo} alt="" className="mx-auto h-9 w-9 rounded-md border border-neutral-200 object-cover" />
                          ) : (
                            <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-md border border-dashed border-neutral-300 bg-neutral-50 text-neutral-300">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                            </span>
                          )}
                        </td>
                        {/* Model */}
                        <td className="border-b border-neutral-100 px-2 py-1.5 text-center">
                          <span dir="ltr" className="font-mono text-[11.5px] font-semibold text-neutral-800">{it.model || "—"}</span>
                        </td>
                        {/* Description */}
                        <td className="border-b border-neutral-100 px-2 py-1.5 text-right text-neutral-700">{it.desc || "—"}</td>
                        {/* Buyer qty */}
                        {it.q.map((v, qi) => (
                          <td key={qi} className={`border-b border-neutral-100 px-1 py-1.5 text-center tabular-nums ${v ? "text-neutral-800" : "text-neutral-300"}`}>{v || "·"}</td>
                        ))}
                        {/* Total qty */}
                        <td className="border-b border-neutral-100 px-1 py-1.5 text-center font-bold tabular-nums text-neutral-900">{qty}</td>
                        {/* Price (fill) */}
                        <td className="border-b border-neutral-100 px-1.5 py-1.5 text-center">
                          <input
                            type="number"
                            min={0}
                            inputMode="decimal"
                            value={prices[key] ?? ""}
                            onChange={(e) => setPrices((p) => ({ ...p, [key]: Number(e.target.value) || 0 }))}
                            placeholder="0"
                            dir="ltr"
                            className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-center text-[12px] tabular-nums text-neutral-900 outline-none focus:border-[color:var(--kx)] print:border-0 print:bg-transparent"
                            style={{ ["--kx" as string]: BLUE }}
                          />
                        </td>
                        {/* Line total */}
                        <td className="border-b border-neutral-100 px-2 py-1.5 text-center font-semibold tabular-nums text-neutral-900">{money(line)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          ))}
        </div>

        {/* Grand totals */}
        <div className="mt-6 flex flex-wrap items-stretch justify-end gap-3">
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-5 py-3 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">إجمالي الكميات</div>
            <div className="mt-0.5 text-[20px] font-black tabular-nums text-neutral-900">{rows.totalUnits.toLocaleString("en-US")}</div>
          </div>
          <div className="rounded-xl border-2 px-5 py-3 text-center" style={{ borderColor: BLUE }}>
            <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: BLUE }}>الإجمالي ({PREORDER_META.currency})</div>
            <div className="mt-0.5 text-[20px] font-black tabular-nums text-neutral-900">{money(rows.totalValue)}</div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 border-t border-neutral-200 pt-3 text-center text-[10.5px] text-neutral-400" dir="ltr">
          KOLEEX — Preorder / price request. Prices are indicative and subject to the official quotation. · www.koleexgroup.com
        </div>
      </div>
    </div>
  );
}
