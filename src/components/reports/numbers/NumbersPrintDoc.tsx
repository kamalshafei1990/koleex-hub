"use client";

/* ---------------------------------------------------------------------------
   A number report on the HOUSE sheet (210 × 270 mm), in the quotation's
   language (feedback_house_document_style): the wordmark and the title, the
   brand strips, a meta grid with black label cells, then each table as a
   card with a black head, its column heads, its rows and its black total
   bar; a lone figure (gross profit, closing cash) as a bar of its own.

   Every height here is PINNED — the rows are one line per currency and
   never wrap (a long name ends in an ellipsis) — because the pagination in
   lib/reports/numbers-print.ts deals the rows by those heights, and
   `.quot-a4-doc` clips whatever does not fit in silence. Change a height
   here and change its constant there.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo } from "react";
import KoleexWordmark from "@/components/brand/KoleexWordmark";
import DocumentBrandStrips from "@/components/brand/DocumentBrandStrips";
import {
  BAR_GAP_PX, BAR_PAD_PX, COL_HEAD_PX, ROW_LINE_PX, ROW_PAD_PX, TABLE_HEAD_PX, barPx, emptyRow, paginateNumbers, rowPx,
  type PrintBlock, type PrintColumn, type PrintRow, type PrintTable,
} from "@/lib/reports/numbers-print";

const C = { black: "#0A0A0A", ink: "#1A1A1A", soft: "#4B5563", ghost: "#9CA3AF", border: "#E5E7EB", surface: "#F5F5F5" } as const;

export type PaperMeta = { label: string; value: string };
export type Paper = {
  /** The big title, top right ("SALES", "PROFIT & LOSS"). */
  title: string;
  /** The small line under it (the family: "Financial statements"). */
  caption: string;
  /** Up to four cells: period / as of, currency, rows, printed. */
  meta: PaperMeta[];
  /** The continuation strip's line ("Sales · 01/01/2026 – 26/09/2026"). */
  strip: string;
  blocks: PrintBlock[];
  /** The PDF's file name, via document.title. */
  fileName: string;
};

const LINE: React.CSSProperties = { height: ROW_LINE_PX, lineHeight: `${ROW_LINE_PX}px`, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

function Cell({ label, children, first }: { label: string; children: React.ReactNode; first?: boolean }) {
  return (
    <div style={{ borderInlineStart: first ? "none" : `1px solid ${C.border}`, minWidth: 0 }}>
      <div style={{ background: C.black, color: "#fff", fontSize: 8, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", height: 22, lineHeight: "22px", padding: "0 12px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
      <div style={{ padding: "8px 12px", fontSize: 10.5, lineHeight: "14px", color: C.ink, height: 44, boxSizing: "border-box", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", fontVariantNumeric: "tabular-nums" }}>{children}</div>
    </div>
  );
}

/** One cell's lines; a figure keeps its own left-to-right order in Arabic. */
function Lines({ lines, col, strong }: { lines: string[]; col: PrintColumn; strong?: boolean }) {
  const num = col.align === "end";
  return (
    <div style={{ minWidth: 0, textAlign: col.align === "end" ? "end" : "start", fontWeight: strong ? 700 : 400 }}>
      {lines.map((l, i) => (
        <div key={i} style={{ ...LINE, fontFamily: num ? '"SF Mono", ui-monospace, Menlo, Consolas, monospace' : undefined, fontSize: num ? 9.5 : 10 }}>
          {num ? <span dir="ltr" style={{ unicodeBidi: "isolate" }}>{l}</span> : <span dir="auto">{l}</span>}
        </div>
      ))}
    </div>
  );
}

function TableCard({ table, rows, foot, cont, contWord }: { table: PrintTable; rows: PrintRow[]; foot: PrintRow[]; cont: boolean; contWord: string }) {
  const grid = table.cols.map((c) => c.width).join(" ");
  const shown = !rows.length && !foot.length ? [emptyRow(table)] : rows;
  const row = (r: PrintRow, i: number, isFoot: boolean) => {
    const bg = isFoot ? C.black : r.tone === "sub" ? C.surface : "#fff";
    return (
      <div key={`${isFoot ? "f" : "r"}${i}`} style={{
        display: "grid", gridTemplateColumns: grid, columnGap: 10, padding: `${ROW_PAD_PX / 2}px 12px`, height: rowPx(r), boxSizing: "border-box",
        background: bg, color: isFoot ? "#fff" : r.tone === "muted" ? C.soft : C.ink, boxShadow: i === 0 && !isFoot ? "none" : `inset 0 1px 0 ${isFoot ? C.black : C.border}`,
      }}>
        {table.cols.map((c, ci) => <Lines key={ci} lines={r.cells[ci] ?? []} col={c} strong={isFoot || r.tone === "sub"} />)}
      </div>
    );
  };
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 10 }}>
      <div style={{ background: C.black, color: "#fff", fontSize: 8, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", height: TABLE_HEAD_PX, lineHeight: `${TABLE_HEAD_PX}px`, padding: "0 12px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {table.head}{cont ? ` · ${contWord}` : ""}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: grid, columnGap: 10, height: COL_HEAD_PX, lineHeight: `${COL_HEAD_PX}px`, padding: "0 12px", background: C.surface, color: C.soft, fontSize: 7.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", boxSizing: "border-box" }}>
        {table.cols.map((c, i) => <div key={i} style={{ textAlign: c.align === "end" ? "end" : "start", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.label}</div>)}
      </div>
      {shown.map((r, i) => row(r, i, false))}
      {foot.map((r, i) => row(r, i, true))}
    </div>
  );
}


export default function NumbersPrintDoc({ paper, lang, contWord, pageOfWord, onReady }: {
  paper: Paper; lang: string; contWord: string; pageOfWord: string; onReady?: () => void;
}) {
  const sheets = useMemo(() => paginateNumbers(paper.blocks), [paper.blocks]);
  const dir = lang === "ar" ? "rtl" : "ltr";
  const font = lang === "zh" ? '"PingFang SC", "Noto Sans SC", "Microsoft YaHei", Inter, system-ui, sans-serif' : lang === "ar" ? '"Noto Naskh Arabic", "Geeza Pro", Inter, system-ui, sans-serif' : "Inter, system-ui, sans-serif";

  /* Ready once the fonts have settled — nothing here is measured (every
     height is pinned), but a late font would print in the fallback face. */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try { await document.fonts?.ready; } catch { /* print with what is there */ }
      if (!cancelled) onReady?.();
    })();
    return () => { cancelled = true; };
  }, [sheets, onReady]);

  return (
    <>
      {sheets.map((sheet, si) => (
        <div key={si} className="quot-a4-doc" dir={dir} style={{ fontFamily: font, color: C.ink, position: "relative" }}>
          {sheet.first ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "30px 0 26px", height: 100, boxSizing: "border-box" }}>
                <KoleexWordmark />
                <div style={{ textAlign: "end", minWidth: 0 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: C.black, letterSpacing: lang === "en" ? "0.08em" : "0.04em", textTransform: "uppercase", lineHeight: "26px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{paper.title}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.soft, lineHeight: "16px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{paper.caption}</div>
                </div>
              </div>
              <DocumentBrandStrips />
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, paper.meta.length)}, minmax(0, 1fr))`, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
                {paper.meta.map((m, i) => <Cell key={i} label={m.label} first={i === 0}>{m.value}</Cell>)}
              </div>
            </>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "18px 0 14px", height: 64, boxSizing: "border-box", borderBottom: `1px solid ${C.border}`, marginBottom: 12 }}>
              <KoleexWordmark height={18} />
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: C.soft, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{paper.strip}</div>
            </div>
          )}

          {sheet.parts.map((part, pi) => {
            const block = paper.blocks[part.block];
            if (part.kind === "bar" && block.kind === "bar") {
              const h = barPx(block) - BAR_GAP_PX;
              return (
                <div key={pi} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, height: h, boxSizing: "border-box", marginBottom: BAR_GAP_PX,
                  padding: `${BAR_PAD_PX / 2 - 1}px 12px`, borderRadius: 12, border: `1px solid ${block.strong ? C.black : C.border}`,
                  background: block.strong ? C.black : C.surface, color: block.strong ? "#fff" : C.ink,
                }}>
                  <div style={{ ...LINE, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", minWidth: 0 }}><span dir="auto">{block.label}</span></div>
                  <div style={{ textAlign: "end", flexShrink: 0 }}>
                    {block.lines.map((l, i) => <div key={i} style={{ ...LINE, fontSize: 10.5, fontWeight: 700, fontFamily: '"SF Mono", ui-monospace, Menlo, Consolas, monospace' }}><span dir="ltr" style={{ unicodeBidi: "isolate" }}>{l}</span></div>)}
                  </div>
                </div>
              );
            }
            if (part.kind === "table" && block.kind === "table") {
              return <TableCard key={pi} table={block} rows={part.rows} foot={part.foot} cont={part.cont} contWord={contWord} />;
            }
            return null;
          })}

          <div style={{ position: "absolute", bottom: 8, insetInlineStart: 0, insetInlineEnd: 0, textAlign: "center", fontSize: 8.5, color: C.ghost }}>
            {pageOfWord.replace("{n}", String(si + 1)).replace("{m}", String(sheets.length))}
          </div>
        </div>
      ))}
    </>
  );
}
