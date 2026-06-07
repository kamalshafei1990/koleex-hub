"use client";

/* Preorder document — editable customer price-request (RFQ). Monochrome white
   "paper" + black, rounded panels, per-buyer colour coding, uploadable machine
   photos, and everything editable inline. Print / export-to-PDF ready. Data is
   seeded from the customer's sheet; edits live in local state (DB persistence,
   product photos and convert-to-quotation come next). */

import { useMemo, useRef, useState } from "react";
import KoleexLogo from "@/components/layout/KoleexLogo";
import { PREORDER_SECTIONS, PREORDER_BUYERS, PREORDER_META } from "./data";

// Each customer/buyer gets a distinct colour so their quantities read at a glance.
const BUYER_COLORS = ["#0066FF", "#089a5b", "#E8710A", "#7C3AED"];

interface Item { model: string; desc: string; q: number[]; price: number; photo: string | null; }
interface Section { ar: string; en: string; items: Item[]; }
interface Doc { customerAr: string; reference: string; currency: string; date: string; buyers: string[]; sections: Section[]; }

function money(n: number): string {
  if (!n) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export default function PreorderPage() {
  const [doc, setDoc] = useState<Doc>(() => ({
    customerAr: PREORDER_META.customerAr,
    reference: PREORDER_META.reference,
    currency: PREORDER_META.currency,
    date: "",
    buyers: [...PREORDER_BUYERS],
    sections: PREORDER_SECTIONS.map((s) => ({
      ar: s.ar,
      en: s.en,
      items: s.items.map((it) => ({ model: it.model, desc: it.desc, q: [...it.q], price: 0, photo: null as string | null })),
    })),
  }));

  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const patchItem = (si: number, ii: number, patch: Partial<Item>) =>
    setDoc((d) => ({
      ...d,
      sections: d.sections.map((s, i) => (i !== si ? s : { ...s, items: s.items.map((it, j) => (j !== ii ? it : { ...it, ...patch })) })),
    }));
  const setQty = (si: number, ii: number, qi: number, val: number) =>
    setDoc((d) => ({
      ...d,
      sections: d.sections.map((s, i) => (i !== si ? s : { ...s, items: s.items.map((it, j) => (j !== ii ? it : { ...it, q: it.q.map((x, k) => (k === qi ? val : x)) })) })),
    }));
  const onPhoto = (si: number, ii: number, file?: File | null) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => patchItem(si, ii, { photo: String(r.result) });
    r.readAsDataURL(file);
  };

  const totals = useMemo(() => {
    let units = 0, value = 0, lines = 0;
    doc.sections.forEach((s) => s.items.forEach((it) => {
      const q = it.q.reduce((a, b) => a + b, 0);
      units += q; value += q * it.price; lines += 1;
    }));
    return { units, value, lines };
  }, [doc]);

  // Shared input styling — looks like text until focused, prints clean.
  const cell = "w-full bg-transparent outline-none rounded-md px-1.5 py-1 transition-colors focus:bg-neutral-100 print:focus:bg-transparent";

  return (
    <div dir="rtl" className="min-h-screen bg-neutral-300/60 px-3 py-6 sm:px-6" style={{ colorScheme: "light" }}>
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          html, body { background:#fff !important; }
          body * { visibility:hidden !important; }
          #pre, #pre * { visibility:visible !important; }
          #pre { position:absolute; inset:0; margin:0 !important; width:100% !important; box-shadow:none !important; }
          .no-print { display:none !important; }
          .pre-row, tr, td, th, section { break-inside:avoid; }
          thead { display:table-header-group; }
          .pre-band { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
          input { border:0 !important; }
        }
        #pre input::placeholder { color:#cbd5e1; }
        /* Remove number spinners so centered numbers are truly centered. */
        #pre input[type=number] { -moz-appearance:textfield; appearance:textfield; }
        #pre input[type=number]::-webkit-outer-spin-button,
        #pre input[type=number]::-webkit-inner-spin-button { -webkit-appearance:none; margin:0; }
      `}</style>

      {/* Toolbar (screen only) */}
      <div className="no-print mx-auto mb-4 flex max-w-[1160px] items-center justify-between gap-3">
        <a href="/quotations" className="text-[13px] text-neutral-500 transition-colors hover:text-black" dir="ltr">← Quotations</a>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-neutral-500">كل الحقول قابلة للتعديل</span>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-85"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            طباعة / تصدير PDF
          </button>
        </div>
      </div>

      {/* Paper */}
      <div id="pre" className="mx-auto max-w-[1160px] overflow-hidden rounded-2xl bg-white text-black shadow-[0_4px_40px_rgba(0,0,0,0.12)]">
        <div className="px-7 py-8 sm:px-11 sm:py-10">

          {/* ── Header: logo LEFT · PREORDER RIGHT ── */}
          <header dir="ltr" className="flex flex-wrap items-center justify-between gap-6 rounded-2xl border border-neutral-200 bg-neutral-50 px-6 py-5">
            <div>
              <KoleexLogo className="h-7 w-auto text-black" />
              <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-400">Koleex International Group</div>
            </div>
            <div className="text-right">
              <div className="text-[30px] font-black leading-none tracking-tight">PREORDER</div>
              <div className="mt-2 text-[12.5px] font-medium tracking-wide text-neutral-500" dir="rtl">طلب مُسبق — قائمة تسعير</div>
            </div>
          </header>

          {/* ── Meta (editable) ── */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {([
              { k: "customerAr", l: "العميل", dir: "rtl" },
              { k: "reference", l: "المرجع", dir: "ltr" },
              { k: "currency", l: "العملة", dir: "ltr" },
              { k: "date", l: "التاريخ", dir: "ltr", ph: "—" },
            ] as const).map((m) => (
              <div key={m.k} className="rounded-xl border border-neutral-200 px-3 py-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">{m.l}</span>
                <input
                  dir={m.dir}
                  value={doc[m.k] as string}
                  placeholder={"ph" in m ? (m as { ph?: string }).ph : ""}
                  onChange={(e) => setDoc((d) => ({ ...d, [m.k]: e.target.value }))}
                  className="mt-0.5 w-full bg-transparent text-[15px] font-bold outline-none focus:bg-neutral-100 rounded"
                />
              </div>
            ))}
          </div>

          {/* ── Buyer colour legend ── */}
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">العملاء</span>
            {doc.buyers.map((b, bi) => (
              <span key={bi} className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[12px] font-semibold shadow-sm" style={{ border: `1px solid ${BUYER_COLORS[bi]}33` }}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: BUYER_COLORS[bi] }} />
                <input value={b} onChange={(e) => setDoc((d) => ({ ...d, buyers: d.buyers.map((x, i) => (i === bi ? e.target.value : x)) }))} className="w-20 bg-transparent text-center outline-none focus:bg-neutral-100 rounded" style={{ color: BUYER_COLORS[bi] }} />
              </span>
            ))}
          </div>

          {/* ── Sections ── */}
          {doc.sections.map((sec, si) => (
            <section key={si} className="mt-6 overflow-hidden rounded-2xl border border-neutral-200">
              <div className="pre-band flex items-center justify-between gap-3 bg-black px-4 py-2.5">
                <input value={sec.ar} onChange={(e) => setDoc((d) => ({ ...d, sections: d.sections.map((s, i) => (i === si ? { ...s, ar: e.target.value } : s)) }))} className="flex-1 bg-transparent text-[14px] font-bold tracking-wide text-white outline-none placeholder-white/40 focus:bg-white/10 rounded px-1" />
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/55" dir="ltr">{sec.en} · {sec.items.length}</span>
              </div>

              <table className="w-full border-collapse text-[12.5px] [&_td]:align-middle [&_th]:align-middle [&_th]:border-s [&_th]:border-neutral-200 [&_td]:border-s [&_td]:border-neutral-200 [&_tr>:first-child]:!border-s-0">
                <thead>
                  <tr className="border-b-2 border-black bg-white text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    <th className="w-[92px] px-2 py-2.5 text-center">صورة</th>
                    <th className="px-3 py-2.5 text-right">الصنف</th>
                    {doc.buyers.map((b, bi) => (
                      <th key={bi} className="w-[58px] px-1 py-2.5 text-center font-bold normal-case" style={{ color: BUYER_COLORS[bi] }}>{b}</th>
                    ))}
                    <th className="w-[112px] border-s-2 border-neutral-300 bg-neutral-100 px-2 py-2.5 text-center text-black">السعر</th>
                    <th className="w-[62px] border-x-2 border-neutral-300 bg-neutral-100 px-1 py-2.5 text-center text-black">الكمية</th>
                    <th className="w-[116px] border-e-2 border-neutral-300 bg-neutral-100 px-2 py-2.5 text-center text-black">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {sec.items.map((it, ii) => {
                    const qty = it.q.reduce((a, b) => a + b, 0);
                    const line = qty * it.price;
                    const fkey = `${si}-${ii}`;
                    return (
                      <tr key={ii} className="pre-row align-middle">
                        {/* Photo upload */}
                        <td className="px-2 py-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => fileRefs.current[fkey]?.click()}
                            className="group relative mx-auto block h-[70px] w-[70px] overflow-hidden rounded-lg border border-neutral-300 bg-neutral-50"
                            title="رفع صورة"
                          >
                            {it.photo ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={it.photo} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-neutral-300">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="m21 15-5-5L5 21"/></svg>
                              </span>
                            )}
                            <span className="no-print absolute inset-0 hidden items-center justify-center bg-black/55 text-[10px] font-semibold text-white group-hover:flex">رفع صورة</span>
                          </button>
                          <input
                            ref={(el) => { fileRefs.current[fkey] = el; }}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => onPhoto(si, ii, e.target.files?.[0])}
                          />
                        </td>
                        {/* Item: model + description (editable) */}
                        <td className="px-2 py-2.5 text-right">
                          <input dir="ltr" value={it.model} placeholder="موديل" onChange={(e) => patchItem(si, ii, { model: e.target.value })} className={`${cell} text-right font-mono text-[12.5px] font-bold`} />
                          <input value={it.desc} placeholder="الوصف" onChange={(e) => patchItem(si, ii, { desc: e.target.value })} className={`${cell} text-[12.5px] text-neutral-600`} />
                        </td>
                        {/* Buyer quantities (coloured) */}
                        {it.q.map((v, qi) => (
                          <td key={qi} className="px-0.5 py-2.5 text-center">
                            <input
                              type="number" min={0} inputMode="numeric" dir="ltr"
                              value={v || ""}
                              onChange={(e) => setQty(si, ii, qi, Number(e.target.value) || 0)}
                              placeholder="·"
                              className={`${cell} text-center text-[12.5px] font-semibold tabular-nums`}
                              style={{ color: v ? BUYER_COLORS[qi] : undefined }}
                            />
                          </td>
                        ))}
                        {/* Price (special column) — first in the totals zone */}
                        <td className="border-s-2 border-neutral-200 bg-neutral-50 px-1.5 py-2.5 text-center">
                          <input
                            type="number" min={0} inputMode="decimal" dir="ltr"
                            value={it.price || ""}
                            onChange={(e) => patchItem(si, ii, { price: Number(e.target.value) || 0 })}
                            placeholder="—"
                            className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-center text-[13px] font-bold tabular-nums text-black outline-none focus:border-black print:border-0 print:bg-transparent"
                          />
                        </td>
                        {/* Total qty (special) */}
                        <td className="border-x-2 border-neutral-200 bg-neutral-50 px-1 py-2.5 text-center text-[14px] font-extrabold tabular-nums">{qty || "—"}</td>
                        {/* Line total (special) */}
                        <td className="border-e-2 border-neutral-200 bg-neutral-50 px-2 py-2.5 text-center text-[13px] font-bold tabular-nums">{money(line)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          ))}

          {/* ── Totals band ── */}
          <div className="pre-band mt-7 flex flex-wrap items-center justify-between gap-6 rounded-2xl bg-black px-7 py-5 text-white">
            <div className="flex items-baseline gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">إجمالي الكميات</span>
              <span className="text-[26px] font-black tabular-nums leading-none">{totals.units.toLocaleString("en-US")}</span>
            </div>
            <div className="flex items-baseline gap-3" dir="ltr">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">Total · {doc.currency}</span>
              <span className="text-[26px] font-black tabular-nums leading-none">{money(totals.value)}</span>
            </div>
          </div>

          {/* ── Footer ── */}
          <footer className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 pt-4 text-[10.5px] text-neutral-400" dir="ltr">
            <span>KOLEEX — Preorder / price request. Indicative prices, subject to the official quotation.</span>
            <span className="font-medium text-neutral-500">www.koleexgroup.com</span>
          </footer>
        </div>
      </div>
    </div>
  );
}
