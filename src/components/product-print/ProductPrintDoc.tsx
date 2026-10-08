/* ProductPrintDoc — the printed product sheet (rebuild phase 5, 19/09/2026).
 *
 * A SERVER component: it renders from the same loader the page and the AI
 * read (product-detail.ts, audience "print"), in the language ?lang= asked
 * for, and ships no JavaScript beyond PrintReady. Multi-page, in the house
 * document language the quotation, the invoice and the contract already
 * speak: the wordmark, the black company strip over the grey tagline, 12px
 * radii, uppercase hairline labels, a black table head. 210 × 270 mm sheets
 * (inside both A4 and Letter), one hard page break after each.
 *
 * NO PRICE, anywhere. The loader hands a print audience no `fob`, no
 * option deltas and no price sheet; the cover says "prices on request"
 * instead. A sheet outlives the day's rate.
 *
 * NO WORD "KOLEEX" — the wordmark and the company strip only (BrandMark
 * for a distributed brand's name).
 *
 * PAGINATION is deterministic, by line budget — the server cannot measure
 * a rendered box. Rows are ~6.5 mm at 11 px; a sheet gives ~34 lines to
 * content after the header and footer. Groups keep their heading with at
 * least two rows. What does not fit goes to the next sheet, which carries
 * the continuation strip (product · model) instead of the full header.
 */
import { IMG } from "@/lib/cdn";
import KoleexWordmark from "@/components/brand/KoleexWordmark";
import DocumentBrandStrips from "@/components/brand/DocumentBrandStrips";
import { isKoleexBrand } from "@/components/brand/KoleexMark";
import { localizedName } from "@/lib/i18n-name";
import type { Lang, Translations } from "@/lib/i18n";
import { PRODUCTS_PRINT_I18N } from "@/lib/products-print-i18n";
import { SPEC_I18N } from "@/lib/product-schema/spec-i18n";
import type { LoadedSchemaProduct } from "@/lib/server/product-detail";
import type { ProductKnowledgeBlock, SpecField } from "@/types/product-schema";
import PrintReady from "./PrintReady";

const T = {
  black: "#0A0A0A", ink: "#1A1A1A", inkSoft: "#4B5563", inkGhost: "#9CA3AF",
  border: "#E5E7EB", surface: "#F5F5F5",
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
} as const;

const LINES_PER_SHEET = 34;

type Row = { kind: "group"; title: string } | { kind: "row"; label: string; value: string } | { kind: "kbHead"; title: string } | { kind: "kbItem"; text: string; lines: number };

const tFor = (dict: Translations, lang: Lang) => (key: string, fallback?: string): string => {
  const hit = dict[key]?.[lang] ?? dict[key]?.en;
  return hit !== undefined ? hit : (fallback ?? key);
};

function displayValue(f: SpecField | undefined, raw: unknown, ts: (k: string, fb?: string) => string, yes: string, no: string): string {
  const optLabel = (v: string) => {
    const o = f?.options?.find((x) => x.value === v);
    if (!o) return v;
    return ts(`o:${f!.key}.${o.value}`, ts(`o:${o.value}`, o.label));
  };
  let d: string;
  if (Array.isArray(raw)) d = raw.map((v) => optLabel(String(v))).join(", ");
  else if (typeof raw === "string") d = optLabel(raw);
  else if (typeof raw === "boolean") d = raw ? yes : no;
  else if (raw === null || raw === undefined) d = "";
  else if (typeof raw === "number") d = raw.toLocaleString("en-US");
  else d = String(raw);
  return f?.unit && d ? `${d} ${f.unit}` : d;
}

const isEmpty = (v: unknown) => v === null || v === undefined || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);

function kbItems(b: ProductKnowledgeBlock, lang: Lang): string[] {
  const c = lang !== "en" ? (b.content_i18n?.[lang as "zh" | "ar"] ?? b.content) : b.content;
  if (Array.isArray(c)) return c.map(String).filter((s) => s.trim());
  if (typeof c === "string") return c.trim() ? [c] : [];
  if (c && typeof c === "object") return Object.values(c as Record<string, unknown>).flat().map(String).filter((s) => s.trim());
  return [];
}
const kbTitle = (b: ProductKnowledgeBlock, lang: Lang) => (lang !== "en" && b.title_i18n?.[lang as "zh" | "ar"]?.trim()) || b.title;

/* Knowledge types worth paper, in reading order. Buyer questions, AI
   summary, comparison and troubleshooting stay on the screen and with the AI. */
const KB_PRINT_ORDER = ["overview", "key_features", "selling_points", "technical_advantages", "applications", "suitable_materials", "recommended_use_cases", "operation_notes", "maintenance_notes", "limitations", "warnings", "package_contents", "warranty_notes"] as const;

/** Greedy line-budget pagination. */
function paginate(rows: Row[]): Row[][] {
  const sheets: Row[][] = [];
  let cur: Row[] = []; let used = 0;
  const cost = (r: Row) => (r.kind === "group" || r.kind === "kbHead" ? 2 : r.kind === "kbItem" ? r.lines : 1);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    let need = cost(r);
    /* keep a heading with its first two rows */
    if (r.kind === "group" || r.kind === "kbHead") need += cost(rows[i + 1] ?? { kind: "row", label: "", value: "" }) + (rows[i + 2] ? cost(rows[i + 2]) : 0);
    if (used + need > LINES_PER_SHEET && cur.length > 0) { sheets.push(cur); cur = []; used = 0; }
    cur.push(r); used += cost(r);
  }
  if (cur.length) sheets.push(cur);
  return sheets;
}

export default function ProductPrintDoc({ loaded, lang }: { loaded: LoadedSchemaProduct; lang: Lang }) {
  const t = tFor(PRODUCTS_PRINT_I18N, lang);
  const ts = lang === "en" ? (k: string, fb?: string) => fb ?? k : tFor(SPEC_I18N, lang);
  const { preview: p, sections: s } = loaded;
  const dir = lang === "ar" ? "rtl" : "ltr";
  const yes = t("print.yes", "Yes"), no = t("print.no", "No");

  const loc = (p.translations ?? []).find((x) => x.locale === lang) ?? null;
  const name = (loc?.product_name || "").trim() || p.productName;
  const tagline = (loc?.tagline || "").trim() || p.tagline;
  const excerpt = (loc?.excerpt || "").trim() || s.excerpt;
  const description = (loc?.description || "").trim() || s.description;
  const brandName = isKoleexBrand(p.brand) ? null : (p.brand ?? "").trim();
  const crumbs = [s.classification.division, s.classification.category, s.classification.subcategory].filter((x): x is NonNullable<typeof x> => !!x).map((x) => localizedName(x, lang));

  /* ── rows for the paginated sheets ── */
  const rows: Row[] = [];
  for (const g of p.schema?.groups ?? []) {
    const filled = g.fields.filter((f) => !isEmpty(p.values[f.key]));
    if (filled.length === 0) continue;
    rows.push({ kind: "group", title: ts(`g:${g.title}`, g.title) });
    for (const f of filled) rows.push({ kind: "row", label: ts(`f:${f.key}`, f.label ?? f.key), value: displayValue(f, p.values[f.key], ts, yes, no) });
  }
  const specSheets = paginate(rows);

  const kbRows: Row[] = [];
  const byType = new Map<string, ProductKnowledgeBlock[]>();
  for (const b of p.knowledge) { const a = byType.get(b.type) ?? []; a.push(b); byType.set(b.type, a); }
  for (const type of KB_PRINT_ORDER) {
    for (const b of byType.get(type) ?? []) {
      const items = kbItems(b, lang);
      if (items.length === 0) continue;
      kbRows.push({ kind: "kbHead", title: t(`print.kb.${type}`, kbTitle(b, lang)) });
      for (const it of items) kbRows.push({ kind: "kbItem", text: it, lines: Math.max(1, Math.ceil(it.length / 95)) });
    }
  }
  const kbSheets = paginate(kbRows);

  const packing = s.packing;
  const comp = s.compliance;
  const compFacts: Array<[string, string]> = [];
  if (comp.ce) compFacts.push(["CE", yes]);
  if (comp.rohs) compFacts.push(["RoHS", yes]);
  if (comp.ipRating) compFacts.push([t("print.ipRating", "IP rating"), comp.ipRating]);
  if (comp.hsCode) compFacts.push([t("print.hsCode", "HS code"), comp.hsCode]);
  if (comp.countryOfOrigin) compFacts.push([t("print.origin", "Country of origin"), comp.countryOfOrigin]);
  const warranty = comp.warranty || (s.warrantyMonths ? `${s.warrantyMonths} ${t("print.months", "months")}` : null);
  if (warranty) compFacts.push([t("print.warranty", "Warranty"), warranty]);
  const hasTail = s.models.length > 1 || !!packing || compFacts.length > 0 || s.options.length > 0;

  /* Sheet numbers are positions, computed up front — no counter mutated
     during render. */
  const total = 1 + specSheets.length + kbSheets.length + (hasTail ? 1 : 0);
  const specStart = 2;
  const kbStart = specStart + specSheets.length;
  const tailNo = kbStart + kbSheets.length;
  const today = new Date().toLocaleDateString("en-GB");

  /* Render helpers, not components: the React compiler refuses a component
     created inside another's render, and these only need the closure. */
  const label = (children: React.ReactNode) => (
    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: T.inkSoft, marginBottom: 6 }}>{children}</div>
  );
  const heading = (children: React.ReactNode) => (
    <div style={{ fontSize: 13, fontWeight: 800, color: T.black, letterSpacing: "0.02em", borderBottom: `1px solid ${T.black}`, padding: "10px 0 6px", marginTop: 8 }}>{children}</div>
  );
  const footer = (n: number) => (
    <div style={{ marginTop: "auto", paddingTop: 8, borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: T.mono, fontSize: 8, color: T.inkSoft, letterSpacing: "0.04em" }}>
      <KoleexWordmark width={64} height={10} fill={T.inkGhost} />
      <span>{p.primaryModel ?? ""}</span>
      <span>{t("print.page", "Page")} {n} {t("print.of", "of")} {total}{t("print.pageSuffix", "")}</span>
    </div>
  );
  const continuation = () => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: T.black, color: "#fff", borderRadius: 8, padding: "6px 14px", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
      <span>{name}</span>
      <span style={{ fontWeight: 600, letterSpacing: "0.04em" }}>{p.primaryModel ?? ""}</span>
    </div>
  );
  const sheet = (n: number, children: React.ReactNode, first = false) => (
    <div key={`sheet-${n}`} className="kx-print-sheet" dir={dir}>
      {first ? null : continuation()}
      {children}
      {footer(n)}
    </div>
  );
  const specRows = (rows: Row[]) => (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5 }}>
      <tbody>
        {rows.map((r, i) =>
          r.kind === "group" || r.kind === "kbHead" ? (
            <tr key={i}><td colSpan={2} style={{ padding: "12px 0 4px", fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: T.black, borderBottom: `1px solid ${T.black}` }}>{r.title}</td></tr>
          ) : r.kind === "row" ? (
            <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
              <td style={{ width: "42%", padding: "5px 8px 5px 0", color: T.inkSoft, verticalAlign: "top" }}>{r.label}</td>
              <td style={{ padding: "5px 0", color: T.ink, fontWeight: 600, verticalAlign: "top" }}>{r.value}</td>
            </tr>
          ) : (
            <tr key={i}><td colSpan={2} style={{ padding: "4px 0 4px 12px", color: T.ink, lineHeight: 1.45, position: "relative" }}><span style={{ position: "absolute", insetInlineStart: 0, top: 4, color: T.inkGhost }}>•</span>{r.text}</td></tr>
          ),
        )}
      </tbody>
    </table>
  );

  return (
    <>
      <style>{`
        html, body { margin: 0; padding: 0; background: #e9e9ea; }
        .kx-print-sheet {
          box-sizing: border-box; width: 210mm; height: 270mm; min-height: 270mm; max-height: 270mm;
          padding: 24px 28px 18px; margin: 0 auto 24px; background: #fff; color: #000; overflow: hidden;
          display: flex; flex-direction: column; box-shadow: 0 0 16px rgba(0,0,0,.10);
          font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, "PingFang SC", "Noto Sans SC", "Noto Naskh Arabic", sans-serif;
          font-size: 11px; line-height: 1.4; page-break-after: always; break-after: page;
        }
        .kx-print-sheet:last-of-type { page-break-after: auto; break-after: auto; }
        @media print {
          @page { size: auto; margin: 0; }
          html, body { background: #fff !important; }
          .kx-print-sheet { margin: 0 auto; box-shadow: none; }
        }
      `}</style>
      <PrintReady />

      {/* ═══ Sheet 1 — cover ═══ */}
      {sheet(1, <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0 20px" }}>
          <KoleexWordmark width={170} height={26} />
          <div style={{ textAlign: dir === "rtl" ? "left" : "right" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.black, letterSpacing: "0.08em", textTransform: "uppercase" }}>{t("print.productSheet", "Product Sheet")}</div>
            <div style={{ fontSize: 9, letterSpacing: "0.1em", color: T.inkSoft, marginTop: 3, fontFamily: T.mono }}>{p.primaryModel ?? ""}</div>
          </div>
        </div>
        {/* The company strip is Latin + Chinese on every house document; it
            keeps its own direction under an Arabic sheet (RTL flipped its
            trailing period to the front: ".SHAPING THE FUTURE"). */}
        <div dir="ltr"><DocumentBrandStrips black={T.black} surface={T.surface} /></div>

        {p.mainImageUrl ? (
          <div style={{ borderRadius: 12, border: `1px solid ${T.border}`, background: "linear-gradient(#fff,#f4f5f7)", height: "78mm", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", marginBottom: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={IMG.gallery(p.mainImageUrl)} alt={name} style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain", padding: 12 }} />
          </div>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18 }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: T.inkSoft, display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
              {brandName ? <span>{brandName}</span> : null}
              {crumbs.map((c, i) => <span key={i}>{i > 0 || brandName ? "› " : ""}{c}</span>)}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1, color: T.black, letterSpacing: "-0.01em" }}>{name}</div>
            {p.primaryModel ? <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: "0.12em", color: T.inkSoft, marginTop: 4 }}>{p.primaryModel}</div> : null}
            {tagline ? <div style={{ fontSize: 13, color: T.ink, marginTop: 8, lineHeight: 1.35 }}>{tagline}</div> : null}
            {excerpt ? <div style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 8, lineHeight: 1.5 }}>{excerpt}</div> : null}
            {description && description !== excerpt ? <div style={{ fontSize: 10, color: T.inkSoft, marginTop: 8, lineHeight: 1.5 }}>{description.slice(0, 700)}{description.length > 700 ? "…" : ""}</div> : null}
          </div>
          <div>
            {s.highlights.length > 0 ? (
              <>
                {label(t("print.highlights", "Highlights"))}
                <ul style={{ margin: 0, paddingInlineStart: 14, fontSize: 10.5, lineHeight: 1.5, color: T.ink }}>
                  {s.highlights.slice(0, 8).map((h, i) => <li key={i}>{h}</li>)}
                </ul>
              </>
            ) : null}
            {s.featureCards.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
                {s.featureCards.slice(0, 4).map((c, i) => (
                  <div key={i} style={{ border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
                    {c.image_url ? (
                      <div style={{ height: 44, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={IMG.thumb(c.image_url)} alt={c.title} style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain", padding: 4 }} />
                      </div>
                    ) : null}
                    <div style={{ padding: "5px 7px", fontSize: 9, lineHeight: 1.3 }}>
                      <div style={{ fontWeight: 700, color: T.black }}>{c.title}</div>
                      {c.description ? <div style={{ color: T.inkSoft }}>{c.description.slice(0, 90)}</div> : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div style={{ marginTop: "auto", paddingTop: 10, fontSize: 9, color: T.inkSoft, display: "flex", justifyContent: "space-between" }}>
          <span>{t("print.priceNote", "Prices on request — please contact us for a quotation.")}</span>
          <span style={{ fontFamily: T.mono }}>{t("print.printedOn", "Printed")} {today}</span>
        </div>
      </>, true)}

      {/* ═══ Specifications ═══ */}
      {specSheets.map((rows, i) => sheet(specStart + i, <>
        {i === 0 ? heading(t("print.specifications", "Technical Specifications")) : null}
        {specRows(rows)}
      </>))}

      {/* ═══ Knowledge ═══ */}
      {kbSheets.map((rows, i) => sheet(kbStart + i, <>
        {i === 0 ? heading(t("print.knowledge", "Product Knowledge")) : null}
        {specRows(rows)}
      </>))}

      {/* ═══ Family · Options · Packing · Compliance ═══ */}
      {hasTail ? sheet(tailNo, <>
          {s.models.length > 1 ? (
            <>
              {heading(t("print.family", "Models in this family"))}
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5, marginTop: 6 }}>
                <thead>
                  <tr style={{ background: T.black, color: "#fff", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    <th style={{ textAlign: "start", padding: "6px 8px" }}>{t("print.model", "Model")}</th>
                    <th style={{ textAlign: "start", padding: "6px 8px" }} />
                  </tr>
                </thead>
                <tbody>
                  {s.models.map((m) => (
                    <tr key={m.id || m.code} style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td style={{ padding: "5px 8px", fontWeight: 700, color: T.black, whiteSpace: "nowrap" }}>{m.code}{m.primary ? <span style={{ marginInlineStart: 6, fontSize: 8, fontWeight: 600, color: T.inkSoft, letterSpacing: "0.08em" }}>{t("print.primary", "Primary").toUpperCase()}</span> : null}</td>
                      <td style={{ padding: "5px 8px", color: T.inkSoft }}>{(() => {
                        const nm = (lang !== "en" && m.nameI18n?.[lang]?.trim()) || m.name;
                        const tg = (lang !== "en" && m.taglineI18n?.[lang]?.trim()) || m.tagline;
                        return nm && nm !== m.code ? nm : tg ?? "";
                      })()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}

          {s.options.length > 0 ? (
            <>
              {heading(t("print.options", "Options"))}
              {s.options.map((o) => (
                <div key={o.id} style={{ marginTop: 6, fontSize: 10.5 }}>
                  <span style={{ fontWeight: 700, color: T.black }}>{(lang !== "en" && o.title_i18n?.[lang]) || o.title}</span>
                  {o.required ? <span style={{ fontSize: 8, color: T.inkSoft, marginInlineStart: 6, letterSpacing: "0.08em" }}>{t("print.required", "Required").toUpperCase()}</span> : null}
                  <span style={{ color: T.inkSoft }}> — {o.values.map((v) => ((lang !== "en" && v.label_i18n?.[lang]) || v.label) + (v.isDefault ? ` (${t("print.standard", "Standard")})` : "")).join(" · ")}</span>
                </div>
              ))}
            </>
          ) : null}

          {packing ? (
            <>
              {heading(t("print.packing", "Packing & Logistics"))}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 24, fontSize: 10.5, marginTop: 4 }}>
                {packing.facts.map((f) => {
                  const label = { packing_type: "print.packingType", wood_treatment: "print.woodTreatment", net_weight: "print.netWeight", gross_weight: "print.grossWeight", cbm: "print.cbm", stackable: "print.stackable", port_of_loading: "print.portOfLoading" }[f.key];
                  const value = f.key === "stackable" ? f.value.replace(/^yes/, yes).replace(/^no/, no) : f.unit ? `${f.value} ${f.unit}` : f.value;
                  return (
                    <div key={f.key} style={{ display: "flex", justifyContent: "space-between", gap: 8, borderBottom: `1px solid ${T.border}`, padding: "4px 0" }}>
                      <span style={{ color: T.inkSoft }}>{t(label, f.key)}</span><span style={{ fontWeight: 600, textTransform: f.key === "packing_type" || f.key === "wood_treatment" ? "capitalize" : "none" }}>{value}</span>
                    </div>
                  );
                })}
                {packing.containers ? (
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, borderBottom: `1px solid ${T.border}`, padding: "4px 0" }}>
                    <span style={{ color: T.inkSoft }}>{t("print.container", "Units per container")}</span>
                    <span style={{ fontWeight: 600 }}>20ft {packing.containers.c20 ?? "—"} · 40ft {packing.containers.c40 ?? "—"} · 40HQ {packing.containers.c40hq ?? "—"}</span>
                  </div>
                ) : null}
              </div>
              {packing.packages.length > 0 ? (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, marginTop: 8 }}>
                  <thead>
                    <tr style={{ background: T.black, color: "#fff", fontSize: 8.5, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                      <th style={{ textAlign: "start", padding: "5px 8px" }}>{t("print.package", "Package")}</th>
                      <th style={{ textAlign: "end", padding: "5px 8px" }}>{t("print.qty", "Qty")}</th>
                      <th style={{ textAlign: "end", padding: "5px 8px" }}>{t("print.dimensions", "L × W × H (cm)")}</th>
                      <th style={{ textAlign: "end", padding: "5px 8px" }}>{t("print.grossWeight", "Gross weight")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {packing.packages.map((r, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                        <td style={{ padding: "4px 8px", fontWeight: 600 }}>{r.label || `${t("print.package", "Package")} ${i + 1}`}</td>
                        <td style={{ padding: "4px 8px", textAlign: "end" }}>{r.qty}</td>
                        <td style={{ padding: "4px 8px", textAlign: "end" }}>{[r.l, r.w, r.h].map((v) => (v != null ? v : "—")).join(" × ")}</td>
                        <td style={{ padding: "4px 8px", textAlign: "end" }}>{r.grossKg != null ? `${r.grossKg} kg` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
              {packing.dangerousGoods ? (
                <div style={{ marginTop: 8, border: "1px dashed #B45309", color: "#B45309", borderRadius: 8, padding: "5px 10px", fontSize: 9.5 }}>
                  <b>{t("print.dangerousGoods", "Dangerous goods")}</b> · {packing.dangerousGoods.kinds.join(", ")}{packing.dangerousGoods.unNumbers ? ` · UN ${packing.dangerousGoods.unNumbers}` : ""}{packing.dangerousGoods.notes ? ` · ${packing.dangerousGoods.notes}` : ""}
                </div>
              ) : null}
            </>
          ) : null}

          {compFacts.length > 0 ? (
            <>
              {heading(t("print.compliance", "Compliance"))}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 24, fontSize: 10.5, marginTop: 4 }}>
                {compFacts.map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 8, borderBottom: `1px solid ${T.border}`, padding: "4px 0" }}>
                    <span style={{ color: T.inkSoft }}>{k}</span><span style={{ fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>
            </>
          ) : null}
      </>) : null}
    </>
  );
}
