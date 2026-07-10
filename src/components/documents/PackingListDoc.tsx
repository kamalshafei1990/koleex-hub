"use client";

/* ---------------------------------------------------------------------------
   Packing List — a Koleex document format with save/list support.

   Same document chrome as the Quotation/Invoice (KOLEEX wordmark, black company
   strip + "SHAPING THE FUTURE" tagline, A4 paper, print CSS) with the packing-
   list columns from Koleex's official sheet:

     Description · Model · Volume(cbm) · Weight[N.W / G.W] ·
     Quantity[pcs / ctn] · Total[Volume / N.W / G.W]

   The three Total columns auto-compute (unit × ctn) and a totals row sums the
   quantities + totals. Saved to the Documents store (/api/documents, doc_kind
   'packing_list') via the shared DocToolbar.
   --------------------------------------------------------------------------- */

import { useCallback, useMemo, useRef, useState } from "react";
import { PRINT_AND_DOC_STYLES } from "@/components/quotations/Quotations";
import DocToolbar, { type SaveState } from "@/components/documents/DocToolbar";
import { saveDocument, removeDocument, type DocumentRow } from "@/lib/documents-store";
import { downloadDocXlsx } from "@/lib/excel-export";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import MinusIcon from "@/components/icons/ui/MinusIcon";

const T = {
  black: "#0A0A0A",
  ink: "#1A1A1A",
  inkSoft: "#4B5563",
  inkGhost: "#9CA3AF",
  border: "#E5E7EB",
  surface: "#F5F5F5",
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
} as const;

function MetaStripCell({ label, isFirst, isLast, children }: { label: string; isFirst?: boolean; isLast?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ borderLeft: isFirst ? "none" : `1px solid ${T.border}` }}>
      <div style={{ background: T.black, color: "#fff", padding: "5px 12px", fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", borderTopLeftRadius: isFirst ? 12 : 0, borderTopRightRadius: isLast ? 12 : 0 }}>
        {label}
      </div>
      <div style={{ padding: "7px 12px", minHeight: 28 }}>{children}</div>
    </div>
  );
}
const labelSpan: React.CSSProperties = { color: T.inkGhost, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" };

const COMPANY = {
  name: "KOLEEX INTERNATIONAL CORPORATION TAIZHOU CO., LTD.",
  nameZh: "科莱恪斯国际商业管理（台州）有限公司",
  address:
    "ROOM 206, BUILDING 88, WEST FEIYUE TECHNOLOGICAL INNOVATIVE PARK, JINGSHUI AN COMMUNITY, XIACHEN STREET, JIAOJIANG DISTRICT, TAIZHOU CITY, ZHEJIANG PROVINCE, CHINA",
  tel: "+86 0576 8892 7796",
  web: "www.koleexgroup.com",
};

/* l/w/h = carton dimensions in cm. cbm auto-computes as L×W×H/1,000,000 but the
   cbm cell stays editable (typing a dimension recomputes it; typing cbm directly
   overrides until a dimension changes again). */
type PackingRow = { description: string; model: string; l: string; w: string; h: string; cbm: string; nw: string; gw: string; pcs: string; ctn: string };
type PackingMeta = {
  date: string; invoiceNo: string; clientNo: string;
  companyName: string; toAddress: string; toAcid: string; contactPerson: string;
  toPhone: string; toMobile: string; toEmail: string; toWebsite: string;
};
const blankRow = (): PackingRow => ({ description: "", model: "", l: "", w: "", h: "", cbm: "", nw: "", gw: "", pcs: "", ctn: "" });
const blankMeta = (): PackingMeta => ({
  date: "", invoiceNo: "", clientNo: "",
  companyName: "", toAddress: "", toAcid: "", contactPerson: "",
  toPhone: "", toMobile: "", toEmail: "", toWebsite: "",
});
const num = (s: string) => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};
const fmt = (n: number) => (n ? String(Math.round(n * 1000) / 1000) : "");

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
/* 13 columns: Description, Model, Dimensions[L,W,H], Volume(cbm), Weight[N.W,G.W],
   Quantity[pcs,ctn], Total[Vol,N.W,G.W]. */
const COLS = ["21%", "11%", "5%", "5%", "5%", "7%", "6%", "6%", "5%", "5%", "8%", "8%", "8%"];

/* Grid lines via right+bottom borders only (single source per internal line);
   the wrapper's border + radius + overflow:hidden draws the outer rounded edge.
   The table MUST be border-collapse:separate for the wrapper to clip the corners
   — collapsed-border tables ignore a rounded parent's overflow:hidden.

   Two line colours, exactly like the quotation items table: the dark header
   region uses a subtle #333 line (light hairlines would read as harsh white
   lines on black), and the white body cells use the light T.border hairline. */
const darkLine = "1px solid #333";
const cell = `1px solid ${T.border}`;
function headBlack(extra?: React.CSSProperties): React.CSSProperties {
  return { borderRight: darkLine, borderBottom: darkLine, background: T.black, color: "#fff", padding: "5px 6px", fontSize: 9, fontWeight: 700, textAlign: "center", verticalAlign: "middle", textTransform: "uppercase", letterSpacing: "0.04em", ...extra };
}
/* Second header row (per-column sub-labels: L/W/H, N.W, pcs, ...): a lighter
   gray tier so the black group titles above read as the primary header. */
const HEAD_SUB_BG = "#2A2A2A";
const headSubLine = "1px solid #3A3A3A";
function headSub(extra?: React.CSSProperties): React.CSSProperties {
  return { ...headBlack({ background: HEAD_SUB_BG, color: "#F2F2F2", borderRight: headSubLine, borderBottom: headSubLine }), ...extra };
}
/* One combined sub-header row per column: English unit on top, Chinese under it.
   A clean light-gray band (between the black header block and the white body). */
const SUBHEAD_BG = "#F3F4F6";
const dualCell: React.CSSProperties = { borderRight: cell, borderBottom: cell, background: SUBHEAD_BG, padding: "7px 6px", textAlign: "center", verticalAlign: "middle" };
const dualEn: React.CSSProperties = { fontSize: 8.5, color: "#4B5563", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.01em", lineHeight: 1.2, whiteSpace: "nowrap" };
/* Column sub-labels: English unit + Chinese field name (was two rows). */
const SUBLABELS: { en: string; zh: string }[] = [
  { en: "N/M", zh: "描述无标记" },
  { en: "", zh: "型号" },
  { en: "cm", zh: "长" },
  { en: "cm", zh: "宽" },
  { en: "cm", zh: "高" },
  { en: "cbm", zh: "体积立方米" },
  { en: "kgs", zh: "净重" },
  { en: "kgs", zh: "毛重" },
  { en: "pcs", zh: "件" },
  { en: "ctn", zh: "数量" },
  { en: "ctn/wdn", zh: "体积" },
  { en: "kgs", zh: "净重" },
  { en: "kgs", zh: "毛重" },
];
const bodyTd: React.CSSProperties = { borderRight: cell, borderBottom: cell, padding: 0, verticalAlign: "middle" };
/* Auto-computed Total cells — read-only, BOLD, same row height as input cells. */
const compTd: React.CSSProperties = { borderRight: cell, borderBottom: cell, padding: "12px 8px", fontSize: 11, fontWeight: 700, textAlign: "center", color: T.ink, background: T.surface };

export default function PackingListDoc({
  initial,
  onBack,
  onChanged,
}: {
  initial: DocumentRow | null;
  onBack: () => void;
  onChanged: () => void;
}) {
  const seed = (initial?.doc ?? {}) as { rows?: PackingRow[]; meta?: PackingMeta };
  const [rows, setRowsState] = useState<PackingRow[]>(() =>
    seed.rows && seed.rows.length ? seed.rows.map((r) => ({ ...blankRow(), ...r })) : Array.from({ length: 8 }, blankRow),
  );
  const [meta, setMetaState] = useState<PackingMeta>(() => ({ ...blankMeta(), ...(seed.meta ?? {}) }));
  const [docId, setDocId] = useState<string | null>(initial?.id ?? null);
  const [version, setVersion] = useState<number>(initial?.version ?? 0);
  const [status, setStatus] = useState<string>(initial?.status ?? "draft");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const printedRef = useRef<HTMLDivElement | null>(null);

  const setRows = (updater: (p: PackingRow[]) => PackingRow[]) => { setRowsState(updater); setDirty(true); };
  const setMeta = (updater: (p: PackingMeta) => PackingMeta) => { setMetaState(updater); setDirty(true); };
  const setM = (k: keyof PackingMeta, v: string) => setMeta((m) => ({ ...m, [k]: v }));
  const set = (i: number, key: keyof PackingRow, v: string) => setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: v } : r)));

  /* Typing a dimension (L/W/H, cm) recomputes CBM = L×W×H / 1,000,000 (cm³→m³)
     and writes it into the editable cbm cell. */
  const setDim = (i: number, key: "l" | "w" | "h", v: string) =>
    setRows((prev) =>
      prev.map((r, idx) => {
        if (idx !== i) return r;
        const nr = { ...r, [key]: v };
        nr.cbm = fmt((num(nr.l) * num(nr.w) * num(nr.h)) / 1_000_000);
        return nr;
      }),
    );

  /* Per-row Total = auto (per-carton value × cartons). Read-only. */
  const rowTotal = (r: PackingRow, key: "vol" | "nw" | "gw"): number => {
    const c = num(r.ctn);
    if (key === "vol") return num(r.cbm) * c;
    if (key === "nw") return num(r.nw) * c;
    return num(r.gw) * c;
  };

  const totals = useMemo(() => {
    let pcs = 0, ctn = 0, vol = 0, nw = 0, gw = 0;
    for (const r of rows) {
      pcs += num(r.pcs);
      ctn += num(r.ctn);
      vol += rowTotal(r, "vol");
      nw += rowTotal(r, "nw");
      gw += rowTotal(r, "gw");
    }
    return { pcs, ctn, vol, nw, gw };
  }, [rows]);

  const doSave = useCallback(
    async (nextStatus: string) => {
      setSaveState("saving");
      setSaveError(null);
      try {
        const saved = await saveDocument({
          id: docId ?? undefined,
          doc_kind: "packing_list",
          title: meta.companyName || null,
          status: nextStatus,
          total: totals.ctn,
          doc: { rows, meta } as Record<string, unknown>,
          base_version: docId ? version : undefined,
        });
        if (!saved) throw new Error("Save failed");
        setDocId(saved.id);
        setVersion(saved.version ?? 1);
        setStatus(saved.status ?? nextStatus);
        setDirty(false);
        setSaveState("saved");
        setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1600);
        onChanged();
      } catch (e) {
        setSaveState("error");
        setSaveError(e instanceof Error ? e.message : String(e));
      }
    },
    [docId, version, rows, meta, totals.ctn, onChanged],
  );

  const handleDuplicate = () => {
    setDocId(null);
    setVersion(0);
    setStatus("draft");
    setDirty(true);
    setSaveState("idle");
  };
  const handlePrint = () => window.print();

  const handleExcel = useCallback(async () => {
    const dataRows: (string | number | null)[][] = rows
      .filter((r) => Object.values(r).some((v) => v.trim() !== ""))
      .map((r) => {
        const c = num(r.ctn);
        return [
          r.description || "", r.model || "", r.l || "", r.w || "", r.h || "", r.cbm || "", r.nw || "", r.gw || "",
          num(r.pcs) || "", c || "", fmt(rowTotal(r, "vol")), fmt(rowTotal(r, "nw")), fmt(rowTotal(r, "gw")),
        ];
      });
    dataRows.push(["TOTAL", "", "", "", "", "", "", "", totals.pcs || "", totals.ctn || "", fmt(totals.vol), fmt(totals.nw), fmt(totals.gw)]);

    const toLines = [
      meta.companyName || "",
      meta.toAddress || "",
      meta.contactPerson ? `Attn:  ${meta.contactPerson}` : "",
      meta.toAcid ? `ACID No.:  ${meta.toAcid}` : "",
      meta.toPhone ? `Phone:  ${meta.toPhone}` : "",
      meta.toEmail ? `Email:  ${meta.toEmail}` : "",
    ].filter((l) => l.trim() !== "");

    const fileBase = `packing-list-${(meta.invoiceNo || "draft").replace(/[^\w-]+/g, "_")}`;
    await downloadDocXlsx(fileBase, {
      docTitle: "PACKING LIST",
      number: meta.invoiceNo || "draft",
      metaStrip: [
        ["DATE", meta.date || ""],
        ["INVOICE NO", meta.invoiceNo || ""],
        ["CLIENT NO", meta.clientNo || ""],
      ],
      toLines,
      columns: [
        { header: "DESCRIPTION", width: 26 },
        { header: "MODEL", width: 16 },
        { header: "L (cm)", width: 7, align: "center" },
        { header: "W (cm)", width: 7, align: "center" },
        { header: "H (cm)", width: 7, align: "center" },
        { header: "VOLUME (cbm)", width: 12, align: "center" },
        { header: "N.W (kgs)", width: 10, align: "center" },
        { header: "G.W (kgs)", width: 10, align: "center" },
        { header: "pcs", width: 7, align: "center" },
        { header: "ctn", width: 7, align: "center" },
        { header: "TOT. VOL", width: 10, align: "center" },
        { header: "TOT. N.W", width: 10, align: "center" },
        { header: "TOT. G.W", width: 10, align: "center" },
      ],
      rows: dataRows,
      totals: [],
    });
  }, [rows, meta, totals]);

  const handleSend = useCallback(async () => {
    const to = (meta.toEmail || "").trim();
    await doSave(status === "draft" ? "sent" : status);
    const subject = `Packing List${meta.invoiceNo ? ` — Invoice ${meta.invoiceNo}` : ""}${meta.companyName ? ` — ${meta.companyName}` : ""}`;
    const body = [`Dear ${meta.contactPerson?.trim() || "there"},`, "", "Please find our packing list attached for your review.", "", "Best regards,", "Koleex Group"].join("\n");
    window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [meta, doSave, status]);

  const handleDelete = useCallback(async () => {
    if (!docId) { onBack(); return; }
    if (!window.confirm("Delete this saved packing list? This cannot be undone.")) return;
    await removeDocument(docId);
    onChanged();
    onBack();
  }, [docId, onBack, onChanged]);

  const numInput = (i: number, key: keyof PackingRow, align: "left" | "center" = "center") => (
    <input
      value={rows[i][key] ?? ""}
      onChange={(e) => set(i, key, e.target.value)}
      inputMode={key === "model" ? "text" : "decimal"}
      style={{ ...inputReset, textAlign: align, fontSize: 11, lineHeight: 1.55, color: T.ink, padding: "12px 8px" }}
    />
  );

  /* L/W/H dimension input — typing recomputes the CBM cell live (via setDim). */
  const dimInput = (i: number, key: "l" | "w" | "h") => (
    <input
      value={rows[i][key] ?? ""}
      onChange={(e) => setDim(i, key, e.target.value)}
      inputMode="decimal"
      style={{ ...inputReset, textAlign: "center", fontSize: 11, lineHeight: 1.55, color: T.ink, padding: "12px 6px" }}
    />
  );


  /* Description = an auto-growing textarea: long text wraps to a new line and
     the row grows, instead of being clipped inside a single-line input. */
  const autoGrow = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };
  const descInput = (i: number) => (
    <textarea
      ref={autoGrow}
      rows={1}
      value={rows[i].description}
      onChange={(e) => { set(i, "description", e.target.value); autoGrow(e.target); }}
      style={{ ...inputReset, textAlign: "left", fontSize: 11, lineHeight: 1.55, color: T.ink, padding: "12px 8px", resize: "none", overflow: "hidden", whiteSpace: "pre-wrap", wordBreak: "break-word", display: "block" }}
    />
  );

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <style>{PRINT_AND_DOC_STYLES}</style>
      <style>{`
        .quot-a4-stack { min-width: 0 !important; padding-inline: 0 !important; margin-inline: auto !important; }
        /* Let the sheet GROW with the table instead of clipping at a fixed
           270mm page — a long table then simply continues onto the next A4
           page when printed, exactly like the quotation/invoice. */
        .quot-a4-doc { height: auto !important; min-height: 270mm; max-height: none !important; }
        /* The table's own border draws the outer frame + rounded corners, so
           drop each cell's outermost (right) border to avoid a doubled line. */
        .pl-tbl { border-collapse: separate; border-spacing: 0; }
        .pl-tbl td:last-child, .pl-tbl th:last-child { border-right: none !important; }
        @media print {
          .no-print { display: none !important; }
          html, body { background: #fff !important; }
          @page { size: A4; margin: 10mm; }
          .quot-a4-doc { box-shadow: none !important; margin: 0 !important; padding: 0 !important; width: auto !important; }
          /* Repeat the table header on every printed page + never split a row
             across the page break. */
          .pl-tbl thead { display: table-header-group; }
          .pl-tbl tr { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <DocToolbar
        onBack={onBack}
        status={status}
        statuses={["draft", "final", "sent"]}
        onStatusChange={(next) => doSave(next)}
        saveState={saveState}
        saveError={saveError}
        dirty={dirty}
        onSaveDraft={() => doSave("draft")}
        onSaveFinal={() => doSave("final")}
        onDuplicate={handleDuplicate}
        onExportPdf={handlePrint}
        onExcel={handleExcel}
        onSend={handleSend}
        onPrint={handlePrint}
        onDelete={docId ? handleDelete : undefined}
      />

      <div className="py-6 px-4 overflow-x-auto">
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

            {/* Meta strip — Date · Invoice No · Client No */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
              <MetaStripCell label="Date" isFirst>
                <input value={meta.date} onChange={(e) => setM("date", e.target.value)} placeholder="DD/MM/YYYY" style={{ ...inputReset, fontSize: 11, fontVariantNumeric: "tabular-nums" }} />
              </MetaStripCell>
              <MetaStripCell label="Invoice No">
                <input value={meta.invoiceNo} onChange={(e) => setM("invoiceNo", e.target.value)} placeholder="—" style={{ ...inputReset, fontSize: 11, fontFamily: T.mono, letterSpacing: "0.02em" }} />
              </MetaStripCell>
              <MetaStripCell label="Client No" isLast>
                <input value={meta.clientNo} onChange={(e) => setM("clientNo", e.target.value)} placeholder="—" style={{ ...inputReset, fontSize: 11, fontVariantNumeric: "tabular-nums" }} />
              </MetaStripCell>
            </div>

            {/* FROM (Koleex) / INVOICE TO (customer) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
              <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                <div style={{ background: T.black, color: "#fff", padding: "6px 12px", fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>From</div>
                <div style={{ padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.ink, marginBottom: 4, letterSpacing: "0.01em" }}>{COMPANY.name}</div>
                  <div style={{ fontSize: 10, lineHeight: 1.5, color: T.inkSoft, marginBottom: 8 }}>{COMPANY.address}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "55px 1fr", rowGap: 3, columnGap: 8, fontSize: 10 }}>
                    <span style={labelSpan}>Phone</span><span style={{ fontFamily: T.mono, letterSpacing: "0.02em", color: T.ink }}>{COMPANY.tel}</span>
                    <span style={labelSpan}>Mobile</span><span style={{ fontFamily: T.mono, letterSpacing: "0.02em", color: T.ink }}>+86 130 7380 0720</span>
                    <span style={labelSpan}>Email</span><span style={{ color: T.ink }}>info@koleexgroup.com</span>
                    <span style={labelSpan}>Web</span><span style={{ color: T.ink }}>{COMPANY.web}</span>
                  </div>
                </div>
              </div>

              <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                <div style={{ background: T.black, color: "#fff", padding: "6px 12px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Invoice To</div>
                <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <input value={meta.companyName} onChange={(e) => setM("companyName", e.target.value)} placeholder="Company name" style={{ ...inputReset, fontSize: 12, fontWeight: 700, color: T.ink, letterSpacing: "0.01em" }} />
                  <textarea
                    ref={(el) => { if (!el) return; el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }}
                    rows={2}
                    value={meta.toAddress}
                    onChange={(e) => { setM("toAddress", e.target.value); e.target.style.height = "auto"; e.target.style.height = `${e.target.scrollHeight}px`; }}
                    placeholder="Address"
                    style={{ ...inputReset, fontSize: 10, lineHeight: 1.5, color: T.inkSoft, resize: "none", overflow: "hidden", minHeight: 28 }}
                  />
                  <div style={{ display: "grid", gridTemplateColumns: "105px 1fr", rowGap: 3, columnGap: 8, fontSize: 10 }}>
                    <span style={labelSpan}>ACID No.</span>
                    <input value={meta.toAcid} onChange={(e) => setM("toAcid", e.target.value)} placeholder="NAFEZA ACID number" style={{ ...inputReset, fontFamily: T.mono, letterSpacing: "0.02em", color: T.ink }} />
                    <span style={labelSpan}>Contact Person:</span>
                    <input value={meta.contactPerson} onChange={(e) => setM("contactPerson", e.target.value)} placeholder="Contact person" style={{ ...inputReset, fontWeight: 700, color: T.ink }} />
                    <span style={labelSpan}>Phone</span>
                    <input value={meta.toPhone} onChange={(e) => setM("toPhone", e.target.value)} placeholder="—" style={{ ...inputReset, fontFamily: T.mono, letterSpacing: "0.02em", color: T.ink }} />
                    <span style={labelSpan}>Mobile</span>
                    <input value={meta.toMobile} onChange={(e) => setM("toMobile", e.target.value)} placeholder="—" style={{ ...inputReset, fontFamily: T.mono, letterSpacing: "0.02em", color: T.ink }} />
                    <span style={labelSpan}>Email</span>
                    <input value={meta.toEmail} onChange={(e) => setM("toEmail", e.target.value)} placeholder="email@example.com" style={{ ...inputReset, color: T.ink }} />
                    <span style={labelSpan}>Web</span>
                    <input value={meta.toWebsite} onChange={(e) => setM("toWebsite", e.target.value)} placeholder="www.example.com" style={{ ...inputReset, color: T.ink }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Packing table */}
            {/* The table itself carries the border + rounded corners (no
                overflow:hidden wrapper) so it can fragment across A4 pages
                when printed — an overflow:hidden box would block that. */}
            <table className="pl-tbl" style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, tableLayout: "fixed", border: `1px solid ${T.border}`, borderRadius: 12 }}>
                <colgroup>{COLS.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
                <thead>
                  <tr>
                    <th rowSpan={2} style={headBlack({ borderTopLeftRadius: 11 })}>Description</th>
                    <th rowSpan={2} style={headBlack()}>Model</th>
                    <th colSpan={3} style={headBlack()}>Dimensions</th>
                    <th rowSpan={2} style={headBlack()}>Volume</th>
                    <th colSpan={2} style={headBlack()}>Weight</th>
                    <th colSpan={2} style={headBlack()}>Quantity</th>
                    <th colSpan={3} style={headBlack({ borderTopRightRadius: 11 })}>Total</th>
                  </tr>
                  <tr>
                    <th style={headSub()}>L</th>
                    <th style={headSub()}>W</th>
                    <th style={headSub()}>H</th>
                    <th style={headSub()}>N.W</th>
                    <th style={headSub()}>G.W</th>
                    <th style={headSub()}>pcs</th>
                    <th style={headSub()}>ctn</th>
                    <th style={headSub()}>Volume</th>
                    <th style={headSub()}>N.W</th>
                    <th style={headSub()}>G.W</th>
                  </tr>
                  <tr>
                    {SUBLABELS.map((c, i) => (
                      <td key={i} style={dualCell}>
                        {c.en && <div style={dualEn}>{c.en}</div>}
                      </td>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const c = num(r.ctn);
                    return (
                      <tr key={i}>
                        <td style={bodyTd}>{descInput(i)}</td>
                        <td style={bodyTd}>{numInput(i, "model", "left")}</td>
                        <td style={bodyTd}>{dimInput(i, "l")}</td>
                        <td style={bodyTd}>{dimInput(i, "w")}</td>
                        <td style={bodyTd}>{dimInput(i, "h")}</td>
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
                  <tr>
                    <td colSpan={8} style={{ ...headBlack({ textAlign: "right", fontSize: 10, borderBottom: "none", borderBottomLeftRadius: 11 }) }}>TOTAL</td>
                    <td style={{ ...compTd, borderBottom: "none", fontWeight: 700, background: "#EDEDED" }}>{totals.pcs || ""}</td>
                    <td style={{ ...compTd, borderBottom: "none", fontWeight: 700, background: "#EDEDED" }}>{totals.ctn || ""}</td>
                    <td style={{ ...compTd, borderBottom: "none", fontWeight: 700, background: "#EDEDED" }}>{fmt(totals.vol)}</td>
                    <td style={{ ...compTd, borderBottom: "none", fontWeight: 700, background: "#EDEDED" }}>{fmt(totals.nw)}</td>
                    <td style={{ ...compTd, borderRight: "none", borderBottom: "none", fontWeight: 700, background: "#EDEDED", borderBottomRightRadius: 11 }}>{fmt(totals.gw)}</td>
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
