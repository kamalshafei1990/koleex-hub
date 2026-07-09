"use client";

/* ---------------------------------------------------------------------------
   Packing List — a blank, fillable Koleex document template.

   Reuses the SAME document chrome as the Quotation/Invoice (KOLEEX wordmark,
   black company strip + "SHAPING THE FUTURE" tagline, A4 paper, print CSS) but
   with the packing-list table columns from Koleex's official sheet:

     Description · Model · Volume(cbm) · Weight[N.W / G.W] ·
     Quantity[pcs / ctn] · Total[Volume / N.W / G.W]

   The three Total columns auto-compute (unit × ctn) and a totals row sums the
   quantities + totals — mirroring the formulas in the source spreadsheet.
   Local state only; nothing is saved as a record.
   --------------------------------------------------------------------------- */

import { useMemo, useRef, useState } from "react";
import { PRINT_AND_DOC_STYLES } from "@/components/quotations/Quotations";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import PrinterIcon from "@/components/icons/ui/PrinterIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import MinusIcon from "@/components/icons/ui/MinusIcon";

/* Token strip — mirrors QuotationA4Preview's palette so the two documents look
   like siblings. */
const T = {
  black: "#0A0A0A",
  ink: "#1A1A1A",
  inkSoft: "#4B5563",
  inkGhost: "#9CA3AF",
  border: "#E5E7EB",
  surface: "#F5F5F5",
} as const;

const COMPANY = {
  name: "KOLEEX INTERNATIONAL CORPORATION TAIZHOU CO., LTD.",
  nameZh: "科莱恪斯国际商业管理（台州）有限公司",
  address:
    "ROOM 206, BUILDING 88, WEST FEIYUE TECHNOLOGICAL INNOVATIVE PARK, JINGSHUI AN COMMUNITY, XIACHEN STREET, JIAOJIANG DISTRICT, TAIZHOU CITY, ZHEJIANG PROVINCE, CHINA",
  tel: "+86 0576 8892 7796",
  web: "www.koleexgroup.com",
};

type PackingRow = { description: string; model: string; cbm: string; nw: string; gw: string; pcs: string; ctn: string };
const blankRow = (): PackingRow => ({ description: "", model: "", cbm: "", nw: "", gw: "", pcs: "", ctn: "" });
const num = (s: string) => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};
/* Trim to at most 3 decimals, drop trailing zeros; blank for 0. */
const fmt = (n: number) => (n ? String(Math.round(n * 1000) / 1000) : "");

/* KOLEEX wordmark — same path data as the quotation header. */
function KoleexLogo() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="180" height="28" viewBox="-4 -4 727.83 115.57" preserveAspectRatio="xMinYMid meet" style={{ display: "block", overflow: "visible" }}>
      <path fill={T.black} d="M116.59,96.3v11.05h-10.6L14.66,62.47v44.88H0V1.58h14.66v43.53L105.99,1.58h10.6v11.05L28.42,53.9l88.18,42.4Z" />
      <path fill={T.black} d="M242.65,71.04c0,20.07-14.21,36.54-34.28,36.54h-50.74c-20.52,0-35.18-16.01-35.18-36.54v-35.18C122.45,15.11,136.88.45,157.63.45h49.84c20.52,0,35.18,14.88,35.18,35.41v35.18ZM227.77,38.11c0-12.4-8.34-23.23-20.3-23.23h-49.84c-11.95,0-20.3,10.83-20.3,23.23v31.8c0,11.95,8.34,23,20.3,23h49.84c11.95,0,20.3-11.05,20.3-23v-31.8Z" />
      <path fill={T.black} d="M363.07,107.57h-68.56c-20.52,0-35.18-16.01-35.18-36.54l.23-71.04h14.66v69.91c0,11.95,8.34,23,20.3,23h68.56v14.66h-.01Z" />
      <path fill={T.black} d="M473.8,107.57h-68.56c-20.52,0-35.18-16.01-35.18-36.54v-34.51c0-20.52,14.66-34.96,35.18-34.96h68.56v14.88h-68.56c-11.73,0-20.3,9.7-20.3,21.2v10.6l88.18.23v14.66l-88.18-.23v6.99c0,11.95,8.57,23,20.3,23h68.56v14.68Z" />
      <path fill={T.black} d="M585.42,107.57h-68.56c-20.52,0-35.18-16.01-35.18-36.54v-34.51c0-20.52,14.66-34.96,35.18-34.96h68.56v14.88h-68.56c-11.73,0-20.3,9.7-20.3,21.2v10.6l88.18.23v14.66l-88.18-.23v6.99c0,11.95,8.57,23,20.3,23h68.56v14.68Z" />
      <path fill={T.black} d="M719.83,96.3v11.05h-10.6l-48.04-42.62-48.04,42.62h-10.37v-11.05l46.91-41.72-46.91-41.95V1.58h10.37l48.04,42.62L709.23,1.58h10.6v11.05l-47.13,41.95,47.13,41.72ZM661.19,71.04l40.59,36.31h-81.19l40.59-36.31Z" />
    </svg>
  );
}

const inputReset: React.CSSProperties = { border: "none", outline: "none", background: "transparent", font: "inherit", color: "inherit", width: "100%", padding: 0, margin: 0 };

/* Column widths (10 columns) — description/model wide, numbers narrow. */
const COLS = ["16%", "16%", "8%", "7%", "7%", "6%", "6%", "10%", "9%", "9%"];

function headBlack(extra?: React.CSSProperties): React.CSSProperties {
  return { border: `1px solid ${T.border}`, background: T.black, color: "#fff", padding: "5px 6px", fontSize: 9, fontWeight: 700, textAlign: "center", textTransform: "uppercase", letterSpacing: "0.04em", ...extra };
}
const subCell: React.CSSProperties = { border: `1px solid ${T.border}`, padding: "3px 6px", fontSize: 8.5, textAlign: "center", color: T.inkSoft, fontWeight: 600, textTransform: "uppercase" };
const zhCell: React.CSSProperties = { border: `1px solid ${T.border}`, padding: "3px 6px", fontSize: 9, textAlign: "center", color: T.inkGhost, fontWeight: 500 };
const bodyTd: React.CSSProperties = { border: `1px solid ${T.border}`, padding: 0, verticalAlign: "middle" };
const compTd: React.CSSProperties = { border: `1px solid ${T.border}`, padding: "4px 6px", fontSize: 10, textAlign: "center", color: T.ink, background: T.surface, minHeight: 24 };

export default function PackingListDoc({ onBack }: { onBack: () => void }) {
  const [rows, setRows] = useState<PackingRow[]>(() => Array.from({ length: 8 }, blankRow));
  const [meta, setMeta] = useState({ to: "", add: "", piNo: "", invoiceNo: "", date: "" });
  const printedRef = useRef<HTMLDivElement | null>(null);

  const set = (i: number, key: keyof PackingRow, v: string) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: v } : r)));

  const totals = useMemo(() => {
    let pcs = 0, ctn = 0, vol = 0, nw = 0, gw = 0;
    for (const r of rows) {
      const c = num(r.ctn);
      pcs += num(r.pcs);
      ctn += c;
      vol += num(r.cbm) * c;
      nw += num(r.nw) * c;
      gw += num(r.gw) * c;
    }
    return { pcs, ctn, vol, nw, gw };
  }, [rows]);

  const numInput = (i: number, key: keyof PackingRow, align: "left" | "center" = "center") => (
    <input
      value={rows[i][key]}
      onChange={(e) => set(i, key, e.target.value)}
      inputMode={key === "description" || key === "model" ? "text" : "decimal"}
      style={{ ...inputReset, textAlign: align, fontSize: 10, padding: "5px 5px" }}
    />
  );

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <style>{PRINT_AND_DOC_STYLES}</style>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          html, body { background: #fff !important; }
          @page { size: auto; margin: 0; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print sticky top-0 z-20 flex items-center justify-between gap-3 px-4 md:px-6 py-3 border-b border-[var(--border-color)] bg-[var(--bg-primary)]/95 backdrop-blur">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-2 h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
          <ArrowLeftIcon size={14} /> Templates
        </button>
        <div className="text-sm font-semibold text-[var(--text-primary)]">Packing List — blank template</div>
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-sm font-medium hover:opacity-90 transition-opacity">
          <PrinterIcon size={14} /> Print
        </button>
      </div>

      <div className="flex justify-center py-6 px-4 overflow-x-auto">
        <div className="quot-a4-stack">
          <div className="quot-a4-doc" ref={printedRef} style={{ fontFamily: "Inter, system-ui, sans-serif", color: T.ink }}>
            {/* Header: logo + PACKING LIST title */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "36px 0 24px" }}>
              <KoleexLogo />
              <div style={{ fontSize: 22, fontWeight: 800, color: T.black, letterSpacing: "0.08em" }}>PACKING LIST</div>
            </div>

            {/* Brand strips */}
            <div style={{ borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
              <div style={{ background: T.black, color: "#fff", padding: "7px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 9, fontWeight: 600, letterSpacing: "0.04em" }}>
                <span>{COMPANY.name}</span>
                <span>{COMPANY.nameZh}</span>
              </div>
              <div style={{ background: T.surface, color: "#333", padding: "5px 16px", textAlign: "center", fontSize: 9, fontWeight: 600, letterSpacing: "0.18em" }}>
                SHAPING THE FUTURE.
              </div>
            </div>

            {/* Company address line */}
            <div style={{ textAlign: "center", fontSize: 8.5, color: T.inkSoft, lineHeight: 1.5, marginBottom: 14 }}>
              <div>{COMPANY.address}</div>
              <div style={{ marginTop: 2 }}>TEL: {COMPANY.tel}&nbsp;&nbsp;·&nbsp;&nbsp;{COMPANY.web}</div>
            </div>

            {/* Meta: To / ADD (left) · PI No / Invoice No / Date (right) */}
            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <div style={{ flex: "1 1 58%", border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
                {([["To:", "to"], ["ADD:", "add"]] as const).map(([label, key]) => (
                  <div key={key} style={{ display: "flex", alignItems: "center", borderBottom: key === "to" ? `1px solid ${T.border}` : "none" }}>
                    <div style={{ width: 56, background: T.black, color: "#fff", fontSize: 10, fontWeight: 700, padding: "6px 10px", flexShrink: 0 }}>{label}</div>
                    <input value={meta[key]} onChange={(e) => setMeta((m) => ({ ...m, [key]: e.target.value }))} style={{ ...inputReset, fontSize: 11, padding: "6px 10px" }} />
                  </div>
                ))}
              </div>
              <div style={{ flex: "1 1 42%", border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
                {([["PI NO.:", "piNo"], ["INVOICE NO.:", "invoiceNo"], ["DATE:", "date"]] as const).map(([label, key], i) => (
                  <div key={key} style={{ display: "flex", alignItems: "center", borderBottom: i < 2 ? `1px solid ${T.border}` : "none" }}>
                    <div style={{ width: 96, background: T.black, color: "#fff", fontSize: 10, fontWeight: 700, padding: "6px 10px", flexShrink: 0 }}>{label}</div>
                    <input value={meta[key]} onChange={(e) => setMeta((m) => ({ ...m, [key]: e.target.value }))} style={{ ...inputReset, fontSize: 11, padding: "6px 10px" }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Packing table */}
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              <colgroup>{COLS.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
              <thead>
                <tr>
                  <th rowSpan={2} style={headBlack()}>Description</th>
                  <th rowSpan={2} style={headBlack()}>Model</th>
                  <th rowSpan={2} style={headBlack()}>Volume</th>
                  <th colSpan={2} style={headBlack()}>Weight</th>
                  <th colSpan={2} style={headBlack()}>Quantity</th>
                  <th colSpan={3} style={headBlack()}>Total</th>
                </tr>
                <tr>
                  <th style={headBlack()}>N.W</th>
                  <th style={headBlack()}>G.W</th>
                  <th style={headBlack()}>pcs</th>
                  <th style={headBlack()}>ctn</th>
                  <th style={headBlack()}>Volume</th>
                  <th style={headBlack()}>N.W</th>
                  <th style={headBlack()}>G.W</th>
                </tr>
                <tr>
                  <td style={subCell}>N/M</td>
                  <td style={subCell} />
                  <td style={subCell}>cbm</td>
                  <td style={subCell}>kgs</td>
                  <td style={subCell}>kgs</td>
                  <td style={subCell}>pcs</td>
                  <td style={subCell}>ctn</td>
                  <td style={subCell}>ctn/wooden</td>
                  <td style={subCell}>kgs</td>
                  <td style={subCell}>kgs</td>
                </tr>
                <tr>
                  <td style={zhCell}>描述无标记</td>
                  <td style={zhCell}>型号</td>
                  <td style={zhCell}>体积立方米</td>
                  <td style={zhCell}>净重</td>
                  <td style={zhCell}>毛重</td>
                  <td style={zhCell}>件</td>
                  <td style={zhCell}>数量</td>
                  <td style={zhCell}>体积</td>
                  <td style={zhCell}>净重</td>
                  <td style={zhCell}>毛重</td>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const c = num(r.ctn);
                  return (
                    <tr key={i}>
                      <td style={bodyTd}>{numInput(i, "description", "left")}</td>
                      <td style={bodyTd}>{numInput(i, "model", "left")}</td>
                      <td style={bodyTd}>{numInput(i, "cbm")}</td>
                      <td style={bodyTd}>{numInput(i, "nw")}</td>
                      <td style={bodyTd}>{numInput(i, "gw")}</td>
                      <td style={bodyTd}>{numInput(i, "pcs")}</td>
                      <td style={bodyTd}>{numInput(i, "ctn")}</td>
                      <td style={compTd}>{fmt(num(r.cbm) * c)}</td>
                      <td style={compTd}>{fmt(num(r.nw) * c)}</td>
                      <td style={compTd}>{fmt(num(r.gw) * c)}</td>
                    </tr>
                  );
                })}
                {/* Totals */}
                <tr>
                  <td colSpan={5} style={{ ...headBlack({ textAlign: "right", fontSize: 10 }) }}>TOTAL</td>
                  <td style={{ ...compTd, fontWeight: 700, background: "#EDEDED" }}>{totals.pcs || ""}</td>
                  <td style={{ ...compTd, fontWeight: 700, background: "#EDEDED" }}>{totals.ctn || ""}</td>
                  <td style={{ ...compTd, fontWeight: 700, background: "#EDEDED" }}>{fmt(totals.vol)}</td>
                  <td style={{ ...compTd, fontWeight: 700, background: "#EDEDED" }}>{fmt(totals.nw)}</td>
                  <td style={{ ...compTd, fontWeight: 700, background: "#EDEDED" }}>{fmt(totals.gw)}</td>
                </tr>
              </tbody>
            </table>

            {/* Row controls (screen only) */}
            <div className="no-print" style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button type="button" onClick={() => setRows((p) => [...p, blankRow()])} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: T.inkSoft, border: `1px dashed ${T.border}`, borderRadius: 8, padding: "5px 10px", background: "#fff" }}>
                <PlusIcon size={12} /> Add row
              </button>
              <button type="button" onClick={() => setRows((p) => (p.length > 1 ? p.slice(0, -1) : p))} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: T.inkSoft, border: `1px dashed ${T.border}`, borderRadius: 8, padding: "5px 10px", background: "#fff" }}>
                <MinusIcon size={12} /> Remove row
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
