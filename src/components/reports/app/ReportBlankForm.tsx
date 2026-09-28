"use client";

/* ---------------------------------------------------------------------------
   ReportBlankForm — the paper a technician fills by hand on site (owner, 28
   Sep 2026: the service report "in the Hub plus a paper form"). The same
   house sheet as the printed report: wordmark and title, the brand strips,
   the meta grid — here empty cells to write in — then the report's sections
   as ruled boxes, laid out and sized by lib/reports/blank-form so the whole
   form is proved (validate:reports) to fit ONE sheet.
   --------------------------------------------------------------------------- */

import { useEffect } from "react";
import KoleexWordmark from "@/components/brand/KoleexWordmark";
import DocumentBrandStrips from "@/components/brand/DocumentBrandStrips";
import { C, Cell } from "./ReportPrintDoc";
import {
  BLANK_CARD_PX, BLANK_LINE_PX, BLANK_SIGN_BOX_PX, BLANK_TABLE_HEAD_PX, blankBodyPx, blankRows, blankTableRows,
} from "@/lib/reports/blank-form";
import type { ReportSectionDef, ReportTemplateDef } from "@/lib/reports/templates";
import type { Lang, Translations } from "@/lib/i18n";

const RULE = `1px solid ${C.border}`;
/* Written left to right in every language (SR-, D/M/Y, hh:mm), as the Hub writes them. */
const hint: React.CSSProperties = { color: C.ghost, fontVariantNumeric: "tabular-nums", letterSpacing: "0.04em", direction: "ltr", unicodeBidi: "isolate" };
const Box = () => <span aria-hidden style={{ display: "inline-block", width: 10, height: 10, border: `1px solid ${C.soft}`, borderRadius: 2, flexShrink: 0 }} />;
/** What a column asks for, written faintly where the hand goes: dates D/M/Y. */
const cellHint = (type: string, id: string) => type === "date" ? "__ / __ / ____" : id === "arrived" || id === "left" ? "__ : __" : "";

export default function ReportBlankForm({ tpl, words, lang, onReady }: { tpl: ReportTemplateDef; words: Translations; lang: Lang; onReady?: () => void }) {
  const t = (key: string) => words[key]?.[lang] ?? words[key]?.en ?? key;
  const w = (s: ReportSectionDef, rest = "") => t(`tpl.${tpl.key}.s.${s.id}${rest}`);
  const dir = lang === "ar" ? "rtl" : "ltr";
  const font = lang === "zh" ? '"PingFang SC", "Noto Sans SC", "Microsoft YaHei", Inter, system-ui, sans-serif' : lang === "ar" ? '"Noto Naskh Arabic", "Geeza Pro", Inter, system-ui, sans-serif' : "Inter, system-ui, sans-serif";
  const rows = blankRows(tpl);

  /* Nothing to measure or load: ready once the fonts have settled. */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try { await document.fonts?.ready; } catch { /* print with what is there */ }
      if (!cancelled) onReady?.();
    })();
    return () => { cancelled = true; };
  }, [onReady]);

  const lines = (n: number) => Array.from({ length: n }, (_, i) => <div key={i} style={{ height: BLANK_LINE_PX, borderBottom: RULE, boxSizing: "border-box" }} />);

  const body = (s: ReportSectionDef) => {
    switch (s.kind) {
      case "table": {
        const cols = s.columns ?? [];
        const grid = { display: "grid", gridTemplateColumns: cols.map((c) => (c.type === "number" ? "0.45fr" : "1fr")).join(" ") } as const;
        return (
          <>
            <div style={{ ...grid, height: BLANK_TABLE_HEAD_PX }}>
              {cols.map((c) => <div key={c.id} style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.soft, lineHeight: `${BLANK_TABLE_HEAD_PX}px`, paddingInlineStart: 6, whiteSpace: "nowrap", overflow: "hidden" }}>{w(s, `.c.${c.id}`)}</div>)}
            </div>
            {Array.from({ length: blankTableRows(tpl.key, s) }, (_, r) => (
              <div key={r} style={{ ...grid, height: BLANK_LINE_PX, borderBottom: RULE, boxSizing: "border-box" }}>
                {cols.map((c, ci) => (
                  <div key={c.id} style={{ borderInlineStart: ci ? RULE : "none", paddingInlineStart: 6, fontSize: 9, lineHeight: `${BLANK_LINE_PX}px`, ...hint }}>{cellHint(c.type, c.id)}</div>
                ))}
              </div>
            ))}
          </>
        );
      }
      case "choice":
        return (s.options ?? []).map((o) => (
          <div key={o} style={{ height: BLANK_LINE_PX, display: "flex", alignItems: "center", gap: 8, fontSize: 10.5, color: C.ink }}><Box />{w(s, `.o.${o}`)}</div>
        ));
      case "checklist":
        return (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 16 }}>
            {(s.points ?? []).map((pt) => (
              <div key={pt.id} style={{ height: BLANK_LINE_PX, display: "flex", alignItems: "center", gap: 6, fontSize: 9.5, color: C.ink, borderBottom: RULE, boxSizing: "border-box", minWidth: 0 }}>
                <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{w(s, `.i.${pt.id}`)}</span>
                {(["ok", "issue", "na"] as const).map((k) => <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 8.5, color: C.soft, whiteSpace: "nowrap" }}><Box />{t(`blk.${k}`)}</span>)}
              </div>
            ))}
          </div>
        );
      case "signature":
        return (
          <>
            <div style={{ height: BLANK_SIGN_BOX_PX, border: RULE, borderRadius: 8, boxSizing: "border-box" }} />
            <div style={{ height: BLANK_LINE_PX, display: "flex", alignItems: "flex-end", gap: 12, fontSize: 9, color: C.soft }}>
              <span style={{ flex: 1.4, borderBottom: RULE, paddingBottom: 2 }}>{t("print.blank.name")}</span>
              <span style={{ flex: 1, borderBottom: RULE, paddingBottom: 2 }}>{t("print.copy.date")} <span style={hint}>__ / __ / ____</span></span>
            </div>
          </>
        );
      default:
        return lines(blankBodyPx(tpl.key, s) / BLANK_LINE_PX);
    }
  };

  return (
    <div className="quot-a4-doc" dir={dir} style={{ fontFamily: font, color: C.ink, position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "30px 0 26px", height: 100, boxSizing: "border-box" }}>
        <KoleexWordmark />
        <div style={{ fontSize: 20, fontWeight: 800, color: C.black, letterSpacing: lang === "en" ? "0.08em" : "0.04em", textTransform: "uppercase", lineHeight: "26px" }}>{t(`print.copy.${tpl.customerCopy}`)}</div>
      </div>
      <DocumentBrandStrips />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.4fr 1.4fr", border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
        <Cell label={t("print.copy.no")} first><span style={hint}>{tpl.customerCopy}-</span></Cell>
        <Cell label={t("print.copy.date")}><span style={hint}>__ / __ / ____</span></Cell>
        <Cell label={t("print.copy.customer")}>{""}</Cell>
        <Cell label={t("print.copy.tech")}>{""}</Cell>
      </div>
      {rows.map((row, ri) => {
        const bodyPx = Math.max(0, ...row.map((s) => blankBodyPx(tpl.key, s)));
        return (
          <div key={ri} style={{ display: "grid", gridTemplateColumns: row.length > 1 ? "1fr 1fr" : "1fr", gap: 8, marginBottom: 8 }}>
            {row.map((s) => (
              <div key={s.id} style={{ height: BLANK_CARD_PX - 8 + bodyPx, boxSizing: "border-box", border: RULE, borderRadius: 12, overflow: "hidden" }}>
                <div style={{ background: C.black, color: "#fff", fontSize: 8, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", height: 22, lineHeight: "22px", padding: "0 12px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{w(s)}</div>
                <div style={{ padding: "6px 12px" }}>{body(s)}</div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
