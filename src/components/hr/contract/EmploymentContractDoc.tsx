"use client";

/* ---------------------------------------------------------------------------
   EmploymentContractDoc — the employment contract on the HOUSE sheet
   (210 × 270 mm), in ONE language per print, dealt onto real sheets.

   Built from the sales contract's language (feedback_house_document_style):
   wordmark + title, the brand strips, a meta strip, two party cards with
   black heads, then the articles, and the signatures WITH the last article
   (a signature sheet carrying no terms is how a signed page gets attached to
   a document nobody agreed to). Every sheet after the first carries a compact
   identity strip and every sheet "Page N of M".

   Pagination is costed, not assumed — an article that does not fit moves
   whole to the next sheet; `.quot-a4-doc` clips overflow in silence.
   --------------------------------------------------------------------------- */

import KoleexWordmark from "@/components/brand/KoleexWordmark";
import DocumentBrandStrips, { KOLEEX_COMPANY } from "@/components/brand/DocumentBrandStrips";
import { EMPLOYMENT_CONTRACT } from "@/lib/translations/employment-contract";
import type { Lang } from "@/lib/i18n";
import type { EmploymentContractData } from "@/app/api/hr/contract/[employeeId]/route";

const T = { black: "#0A0A0A", ink: "#1A1A1A", soft: "#4B5563", ghost: "#9CA3AF", border: "#E5E7EB", surface: "#F5F5F5", mono: "ui-monospace, SFMono-Regular, Menlo, monospace" } as const;

/* Sheet budget (px at 96 dpi): 270 mm ≈ 1020 px minus the sheet padding. */
const SHEET_INNER_PX = 978;
const COVER_FIXED_PX = 118 + 51 + 56 + 200 + 40 + 13 * 5; // head, strips, meta, parties, preamble, gaps
const CONT_HEAD_PX = 58;
const FOOT_PX = 26;
const SIGN_BLOCK_PX = 210;
const LINE_PX = 15;
const ART_TITLE_PX = 18;
const ART_GAP_PX = 10;
/* Characters per line differ by script: CJK glyphs are double-width, Arabic
   runs slightly wider than Latin at the same size. */
const CHARS_PER_LINE: Record<Lang, number> = { en: 140, zh: 62, ar: 110 };

const fmtDate = (iso: string | null | undefined, lang: Lang) =>
  iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString(lang === "zh" ? "zh-CN" : lang === "ar" ? "ar-EG" : "en-GB", { day: "2-digit", month: "long", year: "numeric" }) : "—";
const money = (n: number, ccy: string) => `${ccy} ${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;

export function buildArticles(data: EmploymentContractData, lang: Lang): Array<{ title: string; body: string }> {
  const c = EMPLOYMENT_CONTRACT[lang];
  const e = data.employee;
  const weekend = data.policy.weekend.map((d) => c.weekdays[d]).join(lang === "zh" ? "、" : lang === "ar" ? " و" : " and ");
  const allowances = data.salary && Object.keys(data.salary.allowances).length
    ? (lang === "zh" ? `，另加津贴 ${Object.entries(data.salary.allowances).map(([k, v]) => `${k} ${money(Number(v), data.salary!.currency)}`).join("、")}`
      : lang === "ar" ? `، إضافةً إلى بدلات: ${Object.entries(data.salary.allowances).map(([k, v]) => `${k} ${money(Number(v), data.salary!.currency)}`).join("، ")}`
      : `, plus allowances of ${Object.entries(data.salary.allowances).map(([k, v]) => `${k} ${money(Number(v), data.salary!.currency)}`).join(", ")}`)
    : "";
  const contractEnd = e.contractEndDate
    ? (lang === "zh" ? `，至 ${fmtDate(e.contractEndDate, lang)} 止（固定期限）` : lang === "ar" ? ` وينتهي في ${fmtDate(e.contractEndDate, lang)} (عقد محدد المدة)` : ` and ends on ${fmtDate(e.contractEndDate, lang)} (fixed term)`)
    : (lang === "zh" ? "，为无固定期限" : lang === "ar" ? " لمدة غير محددة" : " for an indefinite term");
  const frequency = { monthly: { en: "monthly", zh: "月", ar: "شهرياً" }, weekly: { en: "weekly", zh: "周", ar: "أسبوعياً" }, annual: { en: "annual", zh: "年", ar: "سنوياً" } } as Record<string, Record<Lang, string>>;
  const vars: Record<string, string> = {
    position: e.position ?? c.na, department: e.department ?? c.na,
    workLocation: e.workLocation === "remote" ? (lang === "zh" ? "远程办公" : lang === "ar" ? "العمل عن بُعد" : "remote workplace") : e.workLocation === "hybrid" ? (lang === "zh" ? "混合办公" : lang === "ar" ? "مقر العمل الهجين" : "hybrid workplace") : (lang === "zh" ? "办公室" : lang === "ar" ? "مكتب" : "office"),
    workCountry: e.workCountry ?? c.na, hireDate: fmtDate(e.hireDate, lang), probationEnd: fmtDate(e.probationEndDate, lang), contractEndClause: contractEnd,
    workStart: data.policy.workStart, workEnd: data.policy.workEnd, minHours: String(data.policy.minHours), timezone: data.policy.timezone, weekend,
    frequency: (frequency[data.salary?.frequency ?? "monthly"] ?? frequency.monthly)[lang],
    salary: data.salary ? money(data.salary.amount, data.salary.currency) : c.na, allowancesClause: allowances,
    annualLeave: data.annualLeaveDays !== null ? String(data.annualLeaveDays) : c.na,
  };
  const fill = (s: string) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
  return c.articles.map((a) => ({ title: a.title, body: fill(a.body) }));
}

const articleHeight = (body: string, lang: Lang) => ART_TITLE_PX + Math.max(1, Math.ceil(body.length / CHARS_PER_LINE[lang])) * LINE_PX + ART_GAP_PX;

function paginate(articles: Array<{ title: string; body: string }>, lang: Lang): Array<{ first: boolean; articles: number[]; signatures: boolean }> {
  const sheets: Array<{ first: boolean; articles: number[]; signatures: boolean }> = [];
  let cur = { first: true, articles: [] as number[], signatures: false };
  let used = COVER_FIXED_PX + FOOT_PX;
  const cap = SHEET_INNER_PX;
  articles.forEach((a, i) => {
    const h = articleHeight(a.body, lang);
    const isLast = i === articles.length - 1;
    const need = h + (isLast ? SIGN_BLOCK_PX : 0);
    if (used + need > cap && cur.articles.length > 0) {
      sheets.push(cur);
      cur = { first: false, articles: [], signatures: false };
      used = CONT_HEAD_PX + FOOT_PX;
    }
    cur.articles.push(i);
    used += h;
    if (isLast) cur.signatures = true;
  });
  sheets.push(cur);
  return sheets;
}

function Head({ label, value, first, last }: { label: string; value: string; first?: boolean; last?: boolean }) {
  return (
    <div style={{ borderLeft: first ? "none" : `1px solid ${T.border}`, borderRadius: first ? "12px 0 0 12px" : last ? "0 12px 12px 0" : 0 }}>
      <div style={{ background: T.black, color: "#fff", fontSize: 8, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", padding: "5px 12px" }}>{label}</div>
      <div style={{ padding: "8px 12px", fontSize: 11, color: T.ink }}>{value}</div>
    </div>
  );
}

export default function EmploymentContractDoc({ data, lang }: { data: EmploymentContractData; lang: Lang }) {
  const c = EMPLOYMENT_CONTRACT[lang];
  const e = data.employee;
  const articles = buildArticles(data, lang);
  const sheets = paginate(articles, lang);
  const today = new Date().toISOString().slice(0, 10);
  const dir = lang === "ar" ? "rtl" : "ltr";
  const font = lang === "zh" ? '"PingFang SC", "Noto Sans SC", "Microsoft YaHei", Inter, system-ui, sans-serif' : lang === "ar" ? '"Noto Naskh Arabic", "Geeza Pro", Inter, system-ui, sans-serif' : "Inter, system-ui, sans-serif";
  const address = [e.addressLine1, e.addressLine2, e.city, e.country].filter(Boolean).join(", ");

  return (
    <>
      {sheets.map((sheet, si) => (
        <div key={si} className="quot-a4-doc" dir={dir} style={{ fontFamily: font, color: T.ink, position: "relative" }}>
          {sheet.first ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "36px 0 32px" }}>
                <KoleexWordmark />
                <div style={{ fontSize: 22, fontWeight: 800, color: T.black, letterSpacing: lang === "en" ? "0.08em" : "0.04em" }}>{c.title}</div>
              </div>
              <DocumentBrandStrips />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
                <Head label={c.meta.date} value={fmtDate(today, lang)} first />
                <Head label={c.meta.number} value={e.employeeNumber ?? c.na} />
                <Head label={c.meta.position} value={e.position ?? c.na} />
                <Head label={c.meta.start} value={fmtDate(e.hireDate, lang)} last />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ background: T.black, color: "#fff", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", padding: "7px 14px" }}>{c.employer}</div>
                  <div style={{ padding: "10px 14px", fontSize: 10.5, lineHeight: 1.5, color: T.soft }}>
                    <div style={{ fontWeight: 700, color: T.black }}>{KOLEEX_COMPANY.en}</div>
                    <div>{KOLEEX_COMPANY.zh}</div>
                    <div>{KOLEEX_COMPANY.address}</div>
                    <div>{KOLEEX_COMPANY.tel} · {KOLEEX_COMPANY.email}</div>
                  </div>
                </div>
                <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ background: T.black, color: "#fff", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", padding: "7px 14px" }}>{c.employee}</div>
                  <div style={{ padding: "10px 14px", fontSize: 10.5, lineHeight: 1.5, color: T.soft }}>
                    <div style={{ fontWeight: 700, color: T.black, fontSize: 12 }}>{e.fullName}{e.nameAlt ? <span style={{ fontWeight: 400, marginInlineStart: 8, color: T.soft }}>{e.nameAlt}</span> : null}</div>
                    <div>{[e.nationality, e.identificationId ?? e.passportNumber].filter(Boolean).join(" · ") || c.na}</div>
                    <div>{address || c.na}</div>
                    <div>{[e.email, e.phone].filter(Boolean).join(" · ")}</div>
                  </div>
                </div>
              </div>
              <p style={{ fontSize: 10.5, color: T.ink, margin: "0 0 12px", lineHeight: 1.5 }}>{c.preamble.replace("{date}", fmtDate(today, lang))}</p>
            </>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 0 14px", borderBottom: `1px solid ${T.border}`, marginBottom: 12 }}>
              <KoleexWordmark height={18} />
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: T.soft }}>{c.title} · {e.fullName}</div>
            </div>
          )}

          {sheet.articles.map((i) => (
            <div key={i} style={{ marginBottom: ART_GAP_PX }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: T.black, marginBottom: 3 }}>{articles[i].title}</div>
              <div style={{ fontSize: 10, lineHeight: `${LINE_PX}px`, color: T.ink, textAlign: "justify" }}>{articles[i].body}</div>
            </div>
          ))}

          {sheet.signatures && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 18 }}>
              {[c.signatures.employer, c.signatures.employee].map((who, k) => (
                <div key={k} style={{ border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ background: T.black, color: "#fff", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", padding: "7px 14px" }}>{who}</div>
                  <div style={{ padding: "12px 14px", fontSize: 10, color: T.soft, display: "grid", gap: 26 }}>
                    <div style={{ borderBottom: `1px solid ${T.border}`, paddingBottom: 4 }}>{c.signatures.name}</div>
                    <div style={{ borderBottom: `1px solid ${T.border}`, paddingBottom: 4 }}>{c.signatures.sign}</div>
                    <div style={{ borderBottom: `1px solid ${T.border}`, paddingBottom: 4 }}>{c.signatures.date}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ position: "absolute", bottom: 10, insetInlineStart: 0, insetInlineEnd: 0, textAlign: "center", fontSize: 8.5, color: T.ghost }}>
            {c.pageOf.replace("{n}", String(si + 1)).replace("{m}", String(sheets.length))}
          </div>
        </div>
      ))}
    </>
  );
}
