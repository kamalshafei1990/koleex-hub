"use client";

/* Preorder document — a customer price-request (RFQ) we price up before the
   official quotation. Fully monochrome (white paper, black ink) Koleex
   document, Arabic / RTL, print / export-to-PDF ready. Larger product photos,
   real KOLEEX wordmark, redesigned header → footer. Data is unchanged. */

import { useMemo, useState } from "react";
import KoleexLogo from "@/components/layout/KoleexLogo";
import { PREORDER_SECTIONS, PREORDER_BUYERS, PREORDER_META } from "./data";

function money(n: number): string {
  if (!n) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export default function PreorderPage() {
  const [prices, setPrices] = useState<Record<string, number>>({});

  const totals = useMemo(() => {
    let units = 0, value = 0, lines = 0;
    PREORDER_SECTIONS.forEach((s, si) =>
      s.items.forEach((it, ii) => {
        const q = it.q.reduce((a, b) => a + b, 0);
        units += q;
        value += q * (prices[`${si}-${ii}`] ?? 0);
        lines += 1;
      }),
    );
    return { units, value, lines };
  }, [prices]);

  return (
    <div dir="rtl" className="min-h-screen bg-neutral-300/60 px-3 py-6 sm:px-6" style={{ colorScheme: "light" }}>
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          html, body { background:#fff !important; }
          body * { visibility:hidden !important; }
          #pre, #pre * { visibility:visible !important; }
          #pre { position:absolute; inset:0; margin:0 !important; width:100% !important; box-shadow:none !important; border:0 !important; border-radius:0 !important; padding:0 !important; }
          .no-print { display:none !important; }
          .pre-row, tr, td, th, section { break-inside:avoid; }
          thead { display:table-header-group; }
          .pre-band { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
        }
      `}</style>

      {/* Toolbar (screen only) */}
      <div className="no-print mx-auto mb-4 flex max-w-[1160px] items-center justify-between gap-3">
        <a href="/quotations" className="text-[13px] text-neutral-500 transition-colors hover:text-black" dir="ltr">← Quotations</a>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-85"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          طباعة / تصدير PDF
        </button>
      </div>

      {/* Paper */}
      <div id="pre" className="mx-auto max-w-[1160px] bg-white text-black shadow-[0_4px_40px_rgba(0,0,0,0.12)]">
        <div className="px-7 py-8 sm:px-12 sm:py-10">

          {/* ── Header ── */}
          <header className="flex flex-wrap items-start justify-between gap-6 border-b-[3px] border-black pb-6">
            <div>
              <KoleexLogo className="h-7 w-auto text-black" />
              <div className="mt-2.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-400" dir="ltr">
                Smart Sewing Equipment
              </div>
            </div>
            <div className="text-left" dir="ltr">
              <div className="text-[30px] font-black leading-none tracking-tight">PREORDER</div>
              <div className="mt-2 text-[12.5px] font-medium tracking-wide text-neutral-500">طلب مُسبق — قائمة تسعير</div>
            </div>
          </header>

          {/* ── Meta ── */}
          <div className="mt-6 grid grid-cols-2 gap-x-10 gap-y-4 sm:grid-cols-4">
            {[
              { l: "العميل", v: PREORDER_META.customerAr },
              { l: "المرجع", v: PREORDER_META.reference, ltr: true },
              { l: "العملة", v: PREORDER_META.currency, ltr: true },
              { l: "عدد البنود", v: String(totals.lines), ltr: true },
            ].map((m) => (
              <div key={m.l} className="flex flex-col gap-1 border-r-2 border-black pr-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">{m.l}</span>
                <span className="text-[15px] font-bold leading-none" dir={m.ltr ? "ltr" : "rtl"}>{m.v}</span>
              </div>
            ))}
          </div>

          {/* ── Sections ── */}
          {PREORDER_SECTIONS.map((sec, si) => (
            <section key={sec.en} className="mt-8">
              {/* Section header band (black) */}
              <div className="pre-band flex items-baseline justify-between bg-black px-4 py-2.5 text-white">
                <h2 className="text-[14px] font-bold tracking-wide">{sec.ar}</h2>
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/55" dir="ltr">
                  {sec.en} · {sec.items.length}
                </span>
              </div>

              <table className="w-full border-collapse text-[12.5px]">
                <thead>
                  <tr className="border-b-2 border-black text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    <th className="w-[88px] px-2 py-2.5 text-center">صورة</th>
                    <th className="px-3 py-2.5 text-right">الصنف</th>
                    {PREORDER_BUYERS.map((b) => (
                      <th key={b} className="w-[56px] px-1 py-2.5 text-center font-bold normal-case text-neutral-700">{b}</th>
                    ))}
                    <th className="w-[62px] px-1 py-2.5 text-center">الكمية</th>
                    <th className="w-[104px] px-2 py-2.5 text-center">السعر</th>
                    <th className="w-[112px] px-2 py-2.5 text-center">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {sec.items.map((it, ii) => {
                    const qty = it.q.reduce((a, b) => a + b, 0);
                    const key = `${si}-${ii}`;
                    const line = qty * (prices[key] ?? 0);
                    return (
                      <tr key={key} className="pre-row border-b border-neutral-200 align-middle">
                        {/* Photo (big) */}
                        <td className="px-2 py-3 text-center">
                          {it.photo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={it.photo} alt="" className="mx-auto h-[68px] w-[68px] rounded-md border border-neutral-300 object-cover" />
                          ) : (
                            <span className="mx-auto flex h-[68px] w-[68px] items-center justify-center rounded-md border border-dashed border-neutral-300 bg-neutral-50 text-neutral-300">
                              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="m21 15-5-5L5 21"/></svg>
                            </span>
                          )}
                        </td>
                        {/* Item: model + description */}
                        <td className="px-3 py-3 text-right">
                          <div dir="ltr" className="font-mono text-[12.5px] font-bold tracking-tight text-black">{it.model || "—"}</div>
                          {it.desc && <div className="mt-0.5 text-[12.5px] leading-snug text-neutral-600">{it.desc}</div>}
                        </td>
                        {/* Buyer quantities */}
                        {it.q.map((v, qi) => (
                          <td key={qi} className={`px-1 py-3 text-center tabular-nums ${v ? "font-medium text-black" : "text-neutral-300"}`}>{v || "·"}</td>
                        ))}
                        {/* Total qty */}
                        <td className="px-1 py-3 text-center text-[14px] font-extrabold tabular-nums text-black">{qty}</td>
                        {/* Price (fill) */}
                        <td className="px-1.5 py-3 text-center">
                          <input
                            type="number"
                            min={0}
                            inputMode="decimal"
                            dir="ltr"
                            value={prices[key] ?? ""}
                            onChange={(e) => setPrices((p) => ({ ...p, [key]: Number(e.target.value) || 0 }))}
                            placeholder="—"
                            className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-center text-[12.5px] tabular-nums text-black outline-none transition-colors focus:border-black print:border-0 print:bg-transparent"
                          />
                        </td>
                        {/* Line total */}
                        <td className="px-2 py-3 text-center text-[13px] font-bold tabular-nums text-black">{money(line)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          ))}

          {/* ── Totals band ── */}
          <div className="pre-band mt-9 flex flex-wrap items-center justify-between gap-6 bg-black px-7 py-5 text-white">
            <div className="flex items-baseline gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">إجمالي الكميات</span>
              <span className="text-[26px] font-black tabular-nums leading-none">{totals.units.toLocaleString("en-US")}</span>
            </div>
            <div className="flex items-baseline gap-3" dir="ltr">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">Total · {PREORDER_META.currency}</span>
              <span className="text-[26px] font-black tabular-nums leading-none">{money(totals.value)}</span>
            </div>
          </div>

          {/* ── Footer ── */}
          <footer className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-300 pt-4 text-[10.5px] text-neutral-400" dir="ltr">
            <span>KOLEEX — Preorder / price request. Indicative prices, subject to the official quotation.</span>
            <span className="font-medium text-neutral-500">www.koleexgroup.com</span>
          </footer>
        </div>
      </div>
    </div>
  );
}
