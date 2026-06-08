"use client";

/* Preorder document — editable customer price-request (RFQ). Monochrome white
   "paper" + black, rounded panels, per-buyer colour coding, uploadable machine
   photos, and everything editable inline. Print / export-to-PDF ready. Data is
   seeded from the customer's sheet; edits live in local state (DB persistence,
   product photos and convert-to-quotation come next). */

import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import KoleexLogo from "@/components/layout/KoleexLogo";
import { PREORDER_SECTIONS, PREORDER_BUYERS, PREORDER_META } from "./data";

// Each customer/buyer gets a distinct colour so their quantities read at a glance.
const BUYER_COLORS = ["#0066FF", "#0F766E", "#B45309", "#6D28D9"];

interface Item { model: string; desc: string; q: number[]; price: number; photo: string | null; }
interface Section { ar: string; en: string; items: Item[]; }
interface Doc { customerAr: string; reference: string; currency: string; date: string; buyers: string[]; sections: Section[]; }

function money(n: number): string {
  if (!n) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** Textarea that grows with its content so the description wraps to as many
 *  lines as needed (no fixed single line). */
function AutoText({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  });
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    />
  );
}

/** A fresh seeded preorder (used for "New" and the initial state). */
function freshDoc(): Doc {
  return {
    customerAr: PREORDER_META.customerAr,
    reference: PREORDER_META.reference,
    currency: PREORDER_META.currency,
    date: new Date().toISOString().slice(0, 10),
    buyers: [...PREORDER_BUYERS],
    sections: PREORDER_SECTIONS.map((s) => ({
      ar: s.ar,
      en: s.en,
      items: s.items.map((it) => ({ model: it.model, desc: it.desc, q: [...it.q], price: 0, photo: null as string | null })),
    })),
  };
}

interface PreorderListItem { id: string; title: string | null; customer_ar: string | null; updated_at: string }

export default function PreorderPage() {
  const [doc, setDoc] = useState<Doc>(freshDoc);

  // Persistence
  const [docId, setDocId] = useState<string | null>(null);
  const [list, setList] = useState<PreorderListItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const refreshList = () => {
    fetch("/api/quotations/preorders", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { preorders: [] }))
      .then((j) => setList(Array.isArray(j.preorders) ? j.preorders : []))
      .catch(() => { /* ignore */ });
  };

  const loadDoc = (id: string) => {
    if (!id) return;
    fetch(`/api/quotations/preorders/${id}`, { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.preorder?.doc && typeof j.preorder.doc === "object") {
          setDoc((d) => ({ ...freshDoc(), ...d, ...j.preorder.doc }));
          setDocId(id);
          try { window.history.replaceState(null, "", `/quotations/preorder?id=${id}`); } catch { /* ignore */ }
        }
      })
      .catch(() => { /* ignore */ });
  };

  const newDoc = () => {
    setDoc(freshDoc());
    setDocId(null);
    setSavedMsg("");
    try { window.history.replaceState(null, "", "/quotations/preorder"); } catch { /* ignore */ }
  };

  const save = async () => {
    setSaving(true);
    setSavedMsg("");
    try {
      const payload = {
        doc,
        title: doc.customerAr || doc.reference || "Preorder",
        customer_ar: doc.customerAr,
        reference: doc.reference,
        currency: doc.currency,
      };
      if (docId) {
        const r = await fetch(`/api/quotations/preorders/${docId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) });
        if (!r.ok) throw new Error();
      } else {
        const r = await fetch("/api/quotations/preorders", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) });
        const j = await r.json();
        if (!r.ok) throw new Error();
        setDocId(j.id as string);
        try { window.history.replaceState(null, "", `/quotations/preorder?id=${j.id}`); } catch { /* ignore */ }
      }
      setSavedMsg("تم الحفظ ✓");
      refreshList();
    } catch {
      setSavedMsg("فشل الحفظ");
    } finally {
      setSaving(false);
      setTimeout(() => setSavedMsg(""), 2500);
    }
  };

  // Load the list + any ?id= on mount.
  useEffect(() => {
    refreshList();
    try {
      const id = new URLSearchParams(window.location.search).get("id");
      if (id) loadDoc(id);
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Excel import — parse the customer's sheet into sections/buyers/items.
  const importRef = useRef<HTMLInputElement | null>(null);
  const onImportExcel = async (file?: File | null) => {
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, defval: "" });
      const norm = (c: unknown) => (c == null ? "" : String(c).trim());

      let modelCol = 1, descCol = 2, firstBuyerCol = 3, totalCol = -1;
      let buyers: string[] = [];
      let headerSeen = false;
      const sections: Section[] = [];
      let cur: Section | null = null;

      for (const r of rows) {
        const cells = (r as unknown[]).map(norm);
        if (!cells.some((x) => x)) continue;
        const low = cells.map((c) => c.toLowerCase());

        if (!headerSeen) {
          const mi = low.findIndex((c) => c.includes("model"));
          const di = low.findIndex((c) => c.includes("descrip") || c.includes("وصف") || c.includes("الصنف"));
          if (mi >= 0 || di >= 0) {
            headerSeen = true;
            modelCol = mi >= 0 ? mi : 1;
            descCol = di >= 0 ? di : modelCol + 1;
            totalCol = cells.length - 1;
            while (totalCol > 0 && !cells[totalCol]) totalCol--;
            firstBuyerCol = descCol + 1;
            buyers = cells.slice(firstBuyerCol, totalCol).filter((x) => x);
            continue;
          }
        }

        const model = cells[modelCol] || "";
        const desc = cells[descCol] || "";
        const qtyCells = totalCol > firstBuyerCol ? cells.slice(firstBuyerCol, totalCol) : [];
        const hasQty = qtyCells.some((x) => x !== "" && Number.isFinite(Number(x)));

        // Section header row (only a label in the first column).
        if (cells[0] && !model && !desc && !hasQty && cells.filter((x) => x).length <= 1) {
          if (low[0].includes("koleex order")) continue; // skip the title
          cur = { ar: cells[0], en: cells[0], items: [] };
          sections.push(cur);
          continue;
        }

        if (model || desc || hasQty) {
          if (!cur) { cur = { ar: "بنود", en: "Items", items: [] }; sections.push(cur); }
          const bs = buyers.length ? buyers : [...PREORDER_BUYERS];
          const q = bs.map((_, i) => { const v = Number(cells[firstBuyerCol + i]); return Number.isFinite(v) ? v : 0; });
          cur.items.push({ model, desc, q, price: 0, photo: null });
        }
      }

      if (sections.length === 0) { setSavedMsg("لم يتم العثور على بنود في الملف"); setTimeout(() => setSavedMsg(""), 3000); return; }
      setDoc((d) => ({ ...d, buyers: buyers.length ? buyers : d.buyers, sections }));
      setDocId(null);
      try { window.history.replaceState(null, "", "/quotations/preorder"); } catch { /* ignore */ }
      setSavedMsg("تم الاستيراد ✓ — راجع ثم احفظ");
    } catch {
      setSavedMsg("فشل استيراد الملف");
    } finally {
      setTimeout(() => setSavedMsg(""), 3500);
    }
  };

  // Pull machine photos from the Products app by model code (sku/model_name).
  const [linking, setLinking] = useState(false);
  const linkProductPhotos = async () => {
    const models = Array.from(new Set(doc.sections.flatMap((s) => s.items.map((i) => i.model).filter(Boolean))));
    if (models.length === 0) { setSavedMsg("لا توجد أكواد موديل"); setTimeout(() => setSavedMsg(""), 2500); return; }
    setLinking(true);
    setSavedMsg("جارٍ جلب صور المنتجات…");
    try {
      const r = await fetch("/api/quotations/preorders/match-products", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ models }) });
      const j = await r.json();
      if (!r.ok) throw new Error();
      const map: Record<string, string> = j.matches || {};
      let n = 0;
      setDoc((d) => ({
        ...d,
        sections: d.sections.map((s) => ({
          ...s,
          items: s.items.map((it) => {
            const url = it.model ? map[it.model.trim().toUpperCase()] : undefined;
            if (url && !it.photo) { n++; return { ...it, photo: url }; }
            return it;
          }),
        })),
      }));
      setSavedMsg(n > 0 ? `تم ربط ${n} صورة من المنتجات` : "لا توجد صور مطابقة");
    } catch {
      setSavedMsg("فشل جلب الصور");
    } finally {
      setLinking(false);
      setTimeout(() => setSavedMsg(""), 3000);
    }
  };

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
    let units = 0, value = 0, lines = 0, priced = 0;
    const bq = doc.buyers.map(() => 0);
    const bv = doc.buyers.map(() => 0);
    doc.sections.forEach((s) => s.items.forEach((it) => {
      const q = it.q.reduce((a, b) => a + b, 0);
      units += q; value += q * it.price; lines += 1;
      if (it.price > 0) priced += 1;
      it.q.forEach((v, i) => { bq[i] += v; bv[i] += v * it.price; });
    }));
    return { units, value, lines, priced, bq, bv };
  }, [doc]);

  // Shared input styling — looks like text until focused, prints clean.
  const cell = "w-full bg-transparent outline-none rounded-md px-1.5 py-1 transition-colors focus:bg-neutral-100 print:focus:bg-transparent";

  return (
    <div dir="rtl" className="min-h-screen bg-black px-3 py-6 text-neutral-300 sm:px-6" style={{ colorScheme: "light" }}>
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          html, body { background:#fff !important; height:auto !important; }
          body * { visibility:hidden !important; }
          #pre, #pre * { visibility:visible !important; }
          /* Pull to the top-left and let it FLOW (auto height) so the whole
             document paginates across pages instead of clipping to one. */
          #pre { position:absolute !important; left:0 !important; top:0 !important; width:100% !important; margin:0 !important; box-shadow:none !important; border-radius:0 !important; }
          #pre .pre-paper { padding:0 !important; }
          .no-print { display:none !important; }
          .pre-row, tr, td, th, section { break-inside:avoid; }
          thead { display:table-header-group; }
          .pre-band { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
          input, textarea { border:0 !important; }
          /* Slightly smaller photos in print so more rows fit per page. */
          #pre .pre-photo { height:74px !important; width:74px !important; }
        }
        #pre input::placeholder { color:#cbd5e1; }
        /* Remove number spinners so centered numbers are truly centered. */
        #pre input[type=number] { -moz-appearance:textfield; appearance:textfield; }
        #pre input[type=number]::-webkit-outer-spin-button,
        #pre input[type=number]::-webkit-inner-spin-button { -webkit-appearance:none; margin:0; }
      `}</style>

      {/* Toolbar (screen only) */}
      <div className="no-print mx-auto mb-4 flex max-w-[1160px] items-center justify-between gap-3">
        <a href="/quotations" className="text-[13px] text-neutral-300 transition-colors hover:text-white" dir="ltr">← Quotations</a>
        <div className="flex flex-wrap items-center gap-2">
          {savedMsg && <span className="text-[12px] font-medium text-emerald-400">{savedMsg}</span>}
          {/* Open a saved preorder */}
          <select
            value={docId ?? ""}
            onChange={(e) => (e.target.value ? loadDoc(e.target.value) : newDoc())}
            className="h-9 rounded-lg border border-white/20 bg-neutral-900 px-2 text-[12.5px] text-white outline-none"
            title="فتح طلب محفوظ"
          >
            <option value="">— طلبات محفوظة —</option>
            {list.map((p) => (
              <option key={p.id} value={p.id}>{p.title || p.customer_ar || p.id.slice(0, 8)}</option>
            ))}
          </select>
          <button type="button" onClick={newDoc} className="h-9 rounded-lg border border-white/20 px-3 text-[12.5px] font-medium text-white transition-colors hover:bg-white/10">جديد</button>
          <button type="button" onClick={() => importRef.current?.click()} className="h-9 rounded-lg border border-white/20 px-3 text-[12.5px] font-medium text-white transition-colors hover:bg-white/10">استيراد Excel</button>
          <input ref={importRef} type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(e) => { onImportExcel(e.target.files?.[0]); e.target.value = ""; }} />
          <button type="button" onClick={linkProductPhotos} disabled={linking} className="h-9 rounded-lg border border-white/20 px-3 text-[12.5px] font-medium text-white transition-colors hover:bg-white/10 disabled:opacity-50">{linking ? "جارٍ…" : "جلب صور المنتجات"}</button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="h-9 rounded-lg bg-white px-4 text-[12.5px] font-semibold text-black transition-opacity hover:opacity-85 disabled:opacity-50"
          >
            {saving ? "جارٍ الحفظ…" : docId ? "حفظ" : "حفظ جديد"}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-black transition-opacity hover:opacity-85"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            طباعة / تصدير PDF
          </button>
        </div>
      </div>

      {/* Paper */}
      <div id="pre" className="mx-auto max-w-[1160px] overflow-hidden rounded-2xl bg-white text-black shadow-[0_4px_40px_rgba(0,0,0,0.12)]">
        <div className="pre-paper px-7 py-8 sm:px-11 sm:py-10">

          {/* ── Header: logo LEFT · PREORDER RIGHT ── */}
          <header dir="ltr" className="flex flex-wrap items-center justify-between gap-6 rounded-2xl border border-neutral-200 bg-white px-6 py-5">
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
              <div className="pre-band flex items-center justify-between gap-3 bg-black px-5 py-3.5">
                <input value={sec.ar} onChange={(e) => setDoc((d) => ({ ...d, sections: d.sections.map((s, i) => (i === si ? { ...s, ar: e.target.value } : s)) }))} className="flex-1 rounded bg-transparent px-1 text-[19px] font-black tracking-wide text-white outline-none placeholder:text-white/40 focus:bg-white/10" />
                <span className="text-[15px] font-bold uppercase tracking-[0.12em] text-white" dir="ltr">{sec.en} · {sec.items.length}</span>
              </div>

              <table className="w-full border-collapse text-[12.5px] [&_td]:align-middle [&_th]:align-middle [&_th]:border-s [&_th]:border-neutral-200 [&_td]:border-s [&_td]:border-neutral-200 [&_tr>:first-child]:!border-s-0">
                <thead>
                  <tr className="sticky top-0 z-10 border-b-2 border-black bg-neutral-200 text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                    <th className="w-[44px] px-1 py-2.5 text-center">بند</th>
                    <th className="w-[96px] px-2 py-2.5 text-center">صورة</th>
                    <th className="min-w-[340px] px-3 py-2.5 text-right">الصنف</th>
                    {doc.buyers.map((b, bi) => (
                      <th key={bi} className="w-[50px] px-1 py-2.5 text-center font-bold normal-case" style={{ color: BUYER_COLORS[bi] }}>{b}</th>
                    ))}
                    <th className="w-[112px] border-s-2 border-neutral-400 bg-neutral-300 px-2 py-2.5 text-center text-black">السعر</th>
                    <th className="w-[62px] border-x-2 border-neutral-400 bg-neutral-300 px-1 py-2.5 text-center text-black">الكمية</th>
                    <th className="w-[116px] border-e-2 border-neutral-400 bg-neutral-300 px-2 py-2.5 text-center text-black">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {sec.items.map((it, ii) => {
                    const qty = it.q.reduce((a, b) => a + b, 0);
                    const line = qty * it.price;
                    const fkey = `${si}-${ii}`;
                    return (
                      <tr key={ii} className="pre-row align-middle border-b border-neutral-200 last:border-b-0">
                        {/* No. (running, 1,2,3…) */}
                        <td className="px-1 py-2.5 text-center text-[12.5px] font-bold tabular-nums text-neutral-500">
                          {doc.sections.slice(0, si).reduce((a, s) => a + s.items.length, 0) + ii + 1}
                        </td>
                        {/* Photo — fits without crop, replace / remove */}
                        <td className="px-2 py-2.5 text-center">
                          <div className="pre-photo relative mx-auto h-[84px] w-[84px]">
                            <button
                              type="button"
                              onClick={() => fileRefs.current[fkey]?.click()}
                              className="group block h-full w-full overflow-hidden rounded-lg border border-neutral-300 bg-white"
                              title={it.photo ? "استبدال الصورة" : "رفع صورة"}
                            >
                              {it.photo ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={it.photo} alt="" className="h-full w-full object-contain p-1" />
                              ) : (
                                <span className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-neutral-300">
                                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="m21 15-5-5L5 21"/></svg>
                                  <span className="text-[9px] font-semibold">رفع صورة</span>
                                </span>
                              )}
                              <span className="no-print absolute inset-0 hidden items-center justify-center bg-black/55 text-[10px] font-semibold text-white group-hover:flex">{it.photo ? "استبدال" : "رفع صورة"}</span>
                            </button>
                            {it.photo && (
                              <button
                                type="button"
                                onClick={() => patchItem(si, ii, { photo: null })}
                                className="no-print absolute -end-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border border-neutral-300 bg-white text-[11px] text-neutral-600 shadow-sm hover:bg-red-50 hover:text-red-600"
                                title="حذف الصورة"
                              >✕</button>
                            )}
                          </div>
                          <input
                            ref={(el) => { fileRefs.current[fkey] = el; }}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => { onPhoto(si, ii, e.target.files?.[0]); e.target.value = ""; }}
                          />
                        </td>
                        {/* Item: model + description (editable) */}
                        <td className="min-w-[340px] px-2 py-2.5 text-right">
                          <input dir="ltr" value={it.model} placeholder="موديل" onChange={(e) => patchItem(si, ii, { model: e.target.value })} className={`${cell} text-right font-mono text-[12.5px] font-bold`} />
                          <AutoText value={it.desc} placeholder="الوصف" onChange={(v) => patchItem(si, ii, { desc: v })} className={`${cell} block resize-none overflow-hidden text-right text-[12.5px] leading-snug text-neutral-600`} />
                        </td>
                        {/* Buyer quantities (coloured) */}
                        {it.q.map((v, qi) => (
                          <td key={qi} className="pre-row px-1 py-2.5 text-center" style={{ backgroundColor: `${BUYER_COLORS[qi]}12` }}>
                            <input
                              type="number" min={0} inputMode="numeric" dir="ltr"
                              value={v ? String(v) : ""}
                              onChange={(e) => setQty(si, ii, qi, e.target.value === "" ? 0 : Math.max(0, Math.floor(Number(e.target.value)) || 0))}
                              placeholder="0"
                              className="w-full rounded-md border border-neutral-200 bg-white/70 px-1 py-1.5 text-center text-[12.5px] font-bold tabular-nums outline-none transition-colors focus:border-black print:border-0 print:bg-transparent"
                              style={{ color: v ? BUYER_COLORS[qi] : "#cbd5e1" }}
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
                            className={`w-full rounded-md border px-2 py-1.5 text-center text-[13px] font-bold tabular-nums text-black outline-none focus:border-black print:border-0 print:bg-transparent ${qty > 0 && !it.price ? "border-amber-400 bg-amber-50" : "border-neutral-300 bg-white"}`}
                          />
                        </td>
                        {/* Total qty (special) */}
                        <td className="border-x-2 border-neutral-200 bg-neutral-50 px-1 py-2.5 text-center text-[14px] font-extrabold tabular-nums">{qty || "—"}</td>
                        {/* Line total (special) */}
                        <td className="border-e-2 border-neutral-200 bg-neutral-50 px-2 py-2.5 text-center text-[13px] font-bold tabular-nums">{money(line)}</td>
                      </tr>
                    );
                  })}
                  {/* Section subtotal */}
                  {(() => {
                    const sq = sec.items.reduce((a, it) => a + it.q.reduce((x, y) => x + y, 0), 0);
                    const sv = sec.items.reduce((a, it) => a + it.q.reduce((x, y) => x + y, 0) * it.price, 0);
                    return (
                      <tr className="pre-band bg-neutral-100 font-bold">
                        <td colSpan={3 + doc.buyers.length} className="px-3 py-2 text-right text-[11.5px] text-neutral-600">إجمالي {sec.ar}</td>
                        <td className="border-s-2 border-neutral-300 px-1 py-2 text-center text-[11px] text-neutral-400">—</td>
                        <td className="border-x-2 border-neutral-300 px-1 py-2 text-center text-[13px] tabular-nums">{sq.toLocaleString("en-US")}</td>
                        <td className="border-e-2 border-neutral-300 px-2 py-2 text-center text-[13px] tabular-nums">{money(sv)}</td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </section>
          ))}

          {/* ── Per-customer totals ── */}
          <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {doc.buyers.map((b, bi) => (
              <div key={bi} className="rounded-xl border p-3" style={{ borderColor: `${BUYER_COLORS[bi]}55` }}>
                <div className="flex items-center gap-1.5 text-[12.5px] font-bold" style={{ color: BUYER_COLORS[bi] }}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: BUYER_COLORS[bi] }} />
                  <span className="truncate">{b}</span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">الكمية</span>
                  <span className="text-[17px] font-black tabular-nums text-black">{totals.bq[bi].toLocaleString("en-US")}</span>
                </div>
                <div className="mt-0.5 flex items-baseline justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">القيمة</span>
                  <span className="text-[14px] font-bold tabular-nums text-black">{money(totals.bv[bi])}</span>
                </div>
              </div>
            ))}
          </div>

          {/* ── Totals band ── */}
          <div className="pre-band mt-4 flex flex-wrap items-center justify-between gap-6 rounded-2xl bg-black px-7 py-5 text-white">
            <div className="flex items-baseline gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">إجمالي الكميات</span>
              <span className="text-[26px] font-black tabular-nums leading-none">{totals.units.toLocaleString("en-US")}</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">تم التسعير</span>
              <span className="text-[20px] font-black tabular-nums leading-none">{totals.priced} / {totals.lines}</span>
            </div>
            <div className="flex items-baseline gap-3" dir="ltr">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">Total · {doc.currency}</span>
              <span className="text-[26px] font-black tabular-nums leading-none">{money(totals.value)}</span>
            </div>
          </div>

          {/* ── Signatures ── */}
          <div className="mt-9 grid grid-cols-2 gap-12">
            {["أعدّه", "اعتمده"].map((l) => (
              <div key={l}>
                <div className="h-9 border-b border-neutral-400" />
                <div className="mt-1.5 text-[11px] font-semibold tracking-wide text-neutral-500">{l}</div>
              </div>
            ))}
          </div>

          {/* ── Footer ── */}
          <footer className="mt-7 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 pt-4 text-[10px] text-neutral-400" dir="ltr">
            <span>KOLEEX International Group — Preorder / price request · indicative prices, subject to the official quotation.</span>
            <span className="font-medium text-neutral-500">koleexgroup.com</span>
          </footer>
        </div>
      </div>
    </div>
  );
}
