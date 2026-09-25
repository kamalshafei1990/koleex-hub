"use client";

/* ---------------------------------------------------------------------------
   ReportPrintDoc — a work report on the HOUSE sheet (210 × 270 mm), built
   from the quotation's language (feedback_house_document_style): wordmark +
   title, the brand strips, a meta grid with black label cells, then every
   section as a card with a black head, the photos and files (two photos a
   row, fixed boxes), and the review last.

   Labels print in the chosen language; what the author wrote prints as it
   was written (a printed report is the record, not a translation of it).

   Pagination is COSTED, not assumed (src/lib/reports/print-layout.ts, proved
   by validate:reports): `.quot-a4-doc` clips overflow in silence, so the
   heights the costs assume — head rows, label cells, the strips — are pinned
   in the markup below. Change one here and change its cost there. The
   paper is "ready" only once the text is dealt AND every photo has loaded
   (or failed) — a print taken earlier would carry empty boxes.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useRef, useState } from "react";
import KoleexWordmark from "@/components/brand/KoleexWordmark";
import DocumentBrandStrips from "@/components/brand/DocumentBrandStrips";
import { blockFileIds, reportTemplate } from "@/lib/reports/templates";
import { withBlockData } from "@/lib/reports/report-data";
import {
  ATTACH_SID, LINE_PX, PARA_GAP_PX, PARA_WIDTH_CSS, PHOTO_BOX_PX, PHOTO_CAPTION_PX, PHOTO_ROW_GAP_PX, PHOTO_ROW_PX, SIGN_BOX_PX, SIGN_PX, cutByHeight, paginateReport,
  type Measurer, type PrintAttachments, type PrintPara, type PrintSheet,
} from "@/lib/reports/print-layout";
import { reportFileUrl, sizeLabel } from "@/lib/reports/attachments";
import { dmyTime, periodLabel, type ReportDetail } from "@/lib/work-reports";
import type { Lang, Translations } from "@/lib/i18n";

const C = { black: "#0A0A0A", ink: "#1A1A1A", soft: "#4B5563", ghost: "#9CA3AF", border: "#E5E7EB", surface: "#F5F5F5" } as const;

function Cell({ label, children, first }: { label: string; children: React.ReactNode; first?: boolean }) {
  return (
    <div style={{ borderInlineStart: first ? "none" : `1px solid ${C.border}`, minWidth: 0 }}>
      <div style={{ background: C.black, color: "#fff", fontSize: 8, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", height: 22, lineHeight: "22px", padding: "0 12px" }}>{label}</div>
      <div style={{ padding: "8px 12px", fontSize: 10.5, lineHeight: "14px", color: C.ink, height: 44, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{children}</div>
    </div>
  );
}

function CardView({ head, children }: { head: string; children: React.ReactNode }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 10 }}>
      <div style={{ background: C.black, color: "#fff", fontSize: 8, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", height: 22, lineHeight: "22px", padding: "0 12px" }}>{head}</div>
      <div style={{ padding: "8px 12px" }}>{children}</div>
    </div>
  );
}

/* One paragraph exactly as a card prints it. The measuring probes below and
   the sheets use the SAME style, so what was measured is what prints. */
const paraStyle = (bullet: boolean, first: boolean): React.CSSProperties => ({
  fontSize: 10.5, lineHeight: `${LINE_PX}px`, color: C.ink, marginTop: first ? 0 : PARA_GAP_PX, overflowWrap: "anywhere", unicodeBidi: "plaintext",
  minHeight: LINE_PX, ...(bullet ? { display: "flex", gap: 8 } : {}),
});

/** Heights read from the browser at the sheet's real width and font. */
function domMeasurer(plain: HTMLElement, bullet: HTMLElement, bulletText: HTMLElement): Measurer {
  const seen = new Map<string, number>();
  const height = (p: PrintPara) => {
    const key = `${p.bullet ? "b" : "p"}|${p.text}`;
    const hit = seen.get(key);
    if (hit !== undefined) return hit;
    const probe = p.bullet ? bullet : plain;
    (p.bullet ? bulletText : plain).textContent = p.text || " ";
    const h = Math.ceil(probe.getBoundingClientRect().height);
    seen.set(key, h);
    return h;
  };
  return { height, cut: (p, maxPx) => cutByHeight(p, maxPx, height) };
}

/** `words`: the Reports dictionary with this report's own section words
 *  (Phase 4C — the print page loads them with the report). */
export default function ReportPrintDoc({ detail, words, lang, onReady }: { detail: ReportDetail; words: Translations; lang: Lang; onReady?: () => void }) {
  const t = (key: string) => words[key]?.[lang] ?? words[key]?.en ?? key;
  const { recipients, comments, attachments } = detail;
  /* A draft's numbers blocks (4B) as the server computed them just now; a
     sent report carries them frozen in its sections. */
  const report = useMemo(() => ({ ...detail.report, sections: withBlockData(detail.report.sections, detail.blockData) }), [detail.report, detail.blockData]);
  const tpl = reportTemplate(report.templateKey);
  const decision = report.decidedBy ? [...comments].reverse().find((c) => c.kind === "approved" || c.kind === "returned") ?? null : null;
  const note = decision?.body.trim() ?? "";
  const dir = lang === "ar" ? "rtl" : "ltr";
  const font = lang === "zh" ? '"PingFang SC", "Noto Sans SC", "Microsoft YaHei", Inter, system-ui, sans-serif' : lang === "ar" ? '"Noto Naskh Arabic", "Geeza Pro", Inter, system-ui, sans-serif' : "Inter, system-ui, sans-serif";

  /* Measure first (after the fonts have settled — a late font changes every
     height), then deal the text onto sheets, then say the paper is ready. */
  const plainRef = useRef<HTMLDivElement>(null);
  const bulletRef = useRef<HTMLDivElement>(null);
  const bulletTextRef = useRef<HTMLSpanElement>(null);
  const [sheets, setSheets] = useState<PrintSheet[] | null>(null);
  /* A checklist photo (Phase 4A) prints with the photos, its point as the
     caption; the signature prints in its own box, never as a photo. */
  const att = useMemo<PrintAttachments>(() => {
    const inBlocks = blockFileIds(report.sections);
    const checkPhotos = (tpl?.sections ?? []).filter((s) => s.kind === "checklist").flatMap((s) => {
      const v = report.sections.find((x) => x.id === s.id);
      return (s.points ?? []).flatMap((pt) => {
        const c = v?.checks?.[pt.id];
        const label = words[`tpl.${report.templateKey}.s.${s.id}.i.${pt.id}`]?.[lang] ?? words[`tpl.${report.templateKey}.s.${s.id}.i.${pt.id}`]?.en ?? pt.id;
        return c?.photo ? [{ id: c.photo, caption: c.note ? `${label} — ${c.note}` : label }] : [];
      });
    });
    return {
      photos: [...checkPhotos, ...(attachments ?? []).filter((a) => a.image && !inBlocks.has(a.id)).map((a) => ({ id: a.id, caption: a.caption }))],
      files: (attachments ?? []).filter((a) => !a.image && !inBlocks.has(a.id)).map((a) => ({ text: `${a.name} · ${sizeLabel(a.size)}`, bullet: true })),
    };
  }, [attachments, report.sections, report.templateKey, tpl, lang, words]);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try { await document.fonts?.ready; } catch { /* measure with what is there */ }
      const plain = plainRef.current, bullet = bulletRef.current, bulletText = bulletTextRef.current;
      if (cancelled || !plain || !bullet || !bulletText) return;
      const m = domMeasurer(plain, bullet, bulletText);
      const reviewPx = report.decidedBy ? LINE_PX + (note ? m.height({ text: note, bullet: false }) : 0) : 0;
      setSheets(paginateReport(report, reviewPx, m, att, t));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` follows `lang`, already a dependency through `font`
  }, [report, note, font, att]);
  /* Ready once every photo has loaded or failed — capped, so one photo that
     never answers cannot hold the print forever. */
  useEffect(() => {
    if (!sheets) return;
    let cancelled = false;
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>("img[data-kx-report-photo]"));
    const loaded = imgs.map((img) => (img.complete ? Promise.resolve() : new Promise<void>((resolve) => {
      img.addEventListener("load", () => resolve(), { once: true });
      img.addEventListener("error", () => resolve(), { once: true });
    })));
    const cap = new Promise<void>((resolve) => setTimeout(resolve, 25_000));
    void Promise.race([Promise.all(loaded), cap]).then(() => { if (!cancelled) onReady?.(); });
    return () => { cancelled = true; };
  }, [sheets, onReady]);
  const name = t(`tpl.${report.templateKey}.name`);
  const to = recipients.filter((r) => r.role === "to").map((r) => r.name).join(", ");
  const cc = recipients.filter((r) => r.role === "cc").map((r) => r.name).join(", ");
  const customTitle = !!(tpl?.customTitle && report.title.trim());

  const probes = (
    <div aria-hidden style={{ position: "absolute", left: -10000, top: 0, visibility: "hidden", pointerEvents: "none", fontFamily: font }}>
      <div ref={plainRef} dir="auto" style={{ ...paraStyle(false, true), width: PARA_WIDTH_CSS }} />
      <div ref={bulletRef} dir="auto" style={{ ...paraStyle(true, true), width: PARA_WIDTH_CSS }}><span>•</span><span ref={bulletTextRef} style={{ minWidth: 0 }} /></div>
    </div>
  );
  if (!sheets) return probes;

  return (
    <>
      {probes}
      {sheets.map((sheet, si) => (
        <div key={si} className="quot-a4-doc" dir={dir} style={{ fontFamily: font, color: C.ink, position: "relative" }}>
          {sheet.first ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "30px 0 26px", height: 100, boxSizing: "border-box" }}>
                <KoleexWordmark />
                <div style={{ textAlign: "end" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: C.black, letterSpacing: lang === "en" ? "0.08em" : "0.04em", textTransform: "uppercase", lineHeight: "26px" }}>{name}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.soft, lineHeight: "16px" }}>
                    {[report.confidential ? t("print.confidential") : "", report.version > 1 ? `${t("print.version")} ${report.version}` : ""].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </div>
              <DocumentBrandStrips />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.4fr 1fr", border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
                <Cell label={t("print.period")} first><span style={{ fontVariantNumeric: "tabular-nums" }}>{periodLabel(report.periodStart, report.periodEnd)}</span></Cell>
                <Cell label={t("print.from")}>{report.author.name}</Cell>
                <Cell label={t("print.to")}>{to || "—"}{cc ? <><br /><span style={{ color: C.soft }}>{t("print.cc")}: {cc}</span></> : null}</Cell>
                <Cell label={t("print.status")}>
                  {t(`print.status.${report.status}`)}
                  {report.submittedAt ? <><br /><span style={{ color: C.soft, fontVariantNumeric: "tabular-nums" }}>{t("print.sent")} {dmyTime(report.submittedAt)}</span></> : null}
                </Cell>
              </div>
              {customTitle && (
                <div dir="auto" style={{ fontSize: 15, fontWeight: 700, color: C.black, lineHeight: "20px", height: 40, marginBottom: 12, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{report.title}</div>
              )}
            </>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "18px 0 14px", height: 64, boxSizing: "border-box", borderBottom: `1px solid ${C.border}`, marginBottom: 12 }}>
              <KoleexWordmark height={18} />
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: C.soft, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {name} · {report.author.name} · {periodLabel(report.periodStart, report.periodEnd)}
              </div>
            </div>
          )}

          {sheet.cards.map((card, ci) => card.sid === ATTACH_SID ? (
            <CardView key={ci} head={`${t("print.attachments")}${card.cont ? ` · ${t("print.cont")}` : ""}`}>
              {(card.photos ?? []).map((row, ri) => (
                <div key={ri} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, height: PHOTO_ROW_PX, paddingBottom: PHOTO_ROW_GAP_PX, boxSizing: "border-box" }}>
                  {row.map((ph) => (
                    <div key={ph.id} style={{ minWidth: 0 }}>
                      <div style={{ height: PHOTO_BOX_PX, background: C.surface, borderRadius: 8, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- a private, per-request-authorised file on paper */}
                        <img data-kx-report-photo src={reportFileUrl(ph.id)} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }} />
                      </div>
                      <div dir="auto" style={{ height: PHOTO_CAPTION_PX, paddingTop: 4, boxSizing: "border-box", fontSize: 9.5, lineHeight: "13px", color: C.soft, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{ph.caption}</div>
                    </div>
                  ))}
                </div>
              ))}
              {card.paras.map((p, pi) => (
                <div key={pi} dir="auto" style={paraStyle(true, pi === 0 && !(card.photos?.length))}>
                  <span style={{ color: C.soft }}>•</span><span style={{ minWidth: 0 }}>{p.text}</span>
                </div>
              ))}
            </CardView>
          ) : (
            <CardView key={ci} head={`${t(`tpl.${report.templateKey}.s.${card.sid}`)}${card.cont ? ` · ${t("print.cont")}` : ""}`}>
              {card.signature ? (
                <div style={{ height: SIGN_PX, boxSizing: "border-box" }}>
                  <div style={{ height: SIGN_BOX_PX, width: 240, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- a private, per-request-authorised file on paper */}
                    <img data-kx-report-photo src={reportFileUrl(card.signature.file)} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }} />
                  </div>
                  <div dir="auto" style={{ marginTop: 8, fontSize: 10.5, lineHeight: `${LINE_PX}px`, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {t("blk.signedBy").replace("{name}", card.signature.name || "—")}
                  </div>
                  <div style={{ fontSize: 10.5, lineHeight: `${LINE_PX}px`, color: C.soft, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                    {dmyTime(card.signature.at)}{card.signature.version !== report.version ? ` · ${t("blk.signedOn").replace("{v}", String(card.signature.version))}` : ""}
                  </div>
                </div>
              ) : card.empty ? (
                <div style={{ fontSize: 10.5, lineHeight: `${LINE_PX}px`, color: C.ghost }}>—</div>
              ) : card.paras.map((p, pi) => (
                <div key={pi} dir="auto" style={paraStyle(p.bullet, pi === 0)}>
                  {p.bullet ? <><span style={{ color: C.soft }}>•</span><span style={{ minWidth: 0 }}>{p.text}</span></> : p.text}
                </div>
              ))}
            </CardView>
          ))}

          {sheet.review && report.decidedBy && (
            <CardView head={t("print.review")}>
              <div style={{ fontSize: 10.5, lineHeight: `${LINE_PX}px`, color: C.ink }}>
                <b>{report.status === "approved" ? t("print.approvedBy") : t("print.returnedBy")}</b> {report.decidedBy.name}
                <span style={{ color: C.soft, fontVariantNumeric: "tabular-nums" }}> · {dmyTime(report.decidedAt)}</span>
              </div>
              {note ? <div dir="auto" style={{ ...paraStyle(false, true), color: C.soft }}>{note}</div> : null}
            </CardView>
          )}

          <div style={{ position: "absolute", bottom: 8, insetInlineStart: 0, insetInlineEnd: 0, textAlign: "center", fontSize: 8.5, color: C.ghost }}>
            {t("print.pageOf").replace("{n}", String(si + 1)).replace("{m}", String(sheets.length))}
          </div>
        </div>
      ))}
    </>
  );
}
