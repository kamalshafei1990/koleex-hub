/* ---------------------------------------------------------------------------
   Certificates (plan step C13; brand book ch. 99; the owner's library
   choices of 28/09/2026).

   The book's certificate is the standard style: A4 landscape, the logo
   centred at the top, a clear title, the name, the facts, a real
   signature, a number so it can be verified, and the legal lockup at the
   foot. Owner, 29/09/2026: professional first, everything editable, small
   breaks of the book are fine — and in the library he chose the kinds
   (training, authorized dealer, exclusive agency, installation, warranty,
   appreciation, employee of the month), A4 either way or A3, black card
   with silver print, and a silver seal (withdrawn 01/10/2026: no seal around
   the logo, book ch. 40). So: eight styles; each kind brings
   its own wording in English, Chinese or Arabic, all of it editable; the
   facts are lines he adds and names; one or two signatures (a scanned
   signature may sit on the line); a seal; the foot with the legal name of
   the day it was issued, or the everyday name.
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import type { BcPerson } from "@/lib/brand-center/client";
import { EVERYDAY_NAME_EN, legalNameEn } from "@/lib/legal-name";
import { KOLEEX_COMPANY } from "@/components/brand/DocumentBrandStrips";
import type { DrawContext, QrRequest, TemplateDef, TemplateItem, TemplateValue, TemplateValues } from "./types";
import { LANGS, asLang, fontOf, isPictureQr, list, num, qrsOf, rowsOf, str, type Lang } from "./card/model";
import { Dots, INK, Logo, QrZone, WHITE, fit, logoHeight, textWidth, wrap, wrapBalanced } from "./card/parts";
import { nameIn } from "./person";
import { LABELS, PLACEHOLDER, SILVER, issued } from "./certificate-common";
import { V1_STYLES, pageV1 } from "./certificate-v1";
import { FoilSeal, Guilloche, MicroLine } from "./ornaments";
import { Pattern, patternOf, patternOptions } from "./patterns";

/** The redesign (owner 30/09/2026: "made by a professional designer"). */
const NEW_STYLES = ["classic", "guilloche", "black", "monolith", "editorial", "swiss", "dots", "award", "corners"] as const;
type Style = (typeof NEW_STYLES)[number];
/** Both sets in the picker — the redesign first, then the first set,
 *  kept at the owner's word ("keep the old designs also"). */
export const CERT_STYLES = [...NEW_STYLES, ...V1_STYLES] as const;
const isV1 = (v: TemplateValues) => (V1_STYLES as readonly string[]).includes(String(v.style));
const styleOf = (v: TemplateValues): Style => ((NEW_STYLES as readonly string[]).includes(String(v.style)) ? (v.style as Style) : "classic");
/** What each style's designer set: the name's weight. */
const STYLE_LOOK: Record<Style, { nameWeight: "light" | "regular" | "medium" | "bold" }> = {
  classic: { nameWeight: "light" }, guilloche: { nameWeight: "light" }, black: { nameWeight: "light" }, monolith: { nameWeight: "light" },
  editorial: { nameWeight: "bold" }, swiss: { nameWeight: "medium" }, dots: { nameWeight: "light" }, award: { nameWeight: "bold" }, corners: { nameWeight: "light" },
};

export const CERT_KINDS = ["training", "dealer", "agency", "installation", "warranty", "appreciation", "employee"] as const;
type Kind = (typeof CERT_KINDS)[number];
const kindOf = (v: TemplateValues): Kind => ((CERT_KINDS as readonly string[]).includes(String(v.kind)) ? (v.kind as Kind) : "training");

const SIZES: Record<string, { w: number; h: number }> = { "a4-land": { w: 297, h: 210 }, "a4-port": { w: 210, h: 297 }, "a3-land": { w: 420, h: 297 } };

/* ── the words each kind brings ────────────────────────────────────────── */

interface KindWords { heading: string; pre: string; statement: string; facts: string[]; sig1: string; sig2: string }
const GROUP = EVERYDAY_NAME_EN;
const WORDS: Record<Kind, Record<Lang, KindWords>> = {
  training: {
    en: { heading: "Certificate of Training", pre: "This is to certify that", statement: "has successfully completed the operation and maintenance training on our machines.", facts: ["Course", "Place", "Duration"], sig1: "Trainer", sig2: "Founder & CEO" },
    zh: { heading: "培训证书", pre: "兹证明", statement: "已顺利完成设备操作与维护培训。", facts: ["课程", "地点", "时长"], sig1: "培训师", sig2: "创始人兼首席执行官" },
    ar: { heading: "شهادة تدريب", pre: "نشهد بأن", statement: "قد أتمّ بنجاح التدريب على تشغيل الماكينات وصيانتها.", facts: ["الدورة", "المكان", "المدة"], sig1: "المدرّب", sig2: "المؤسس والرئيس التنفيذي" },
  },
  dealer: {
    en: { heading: "Certificate of Authorization", pre: "This is to certify that", statement: `is an Authorized Dealer of ${GROUP}, for sales and after-sales service in the territory below.`, facts: ["Territory", "Valid from", "Valid until"], sig1: "Sales Director", sig2: "Founder & CEO" },
    zh: { heading: "授权证书", pre: "兹证明", statement: `为 ${GROUP} 授权经销商，负责下列区域的销售与售后服务。`, facts: ["区域", "生效日期", "有效期至"], sig1: "销售总监", sig2: "创始人兼首席执行官" },
    ar: { heading: "شهادة اعتماد", pre: "نشهد بأن", statement: `موزّع معتمد لدى ${GROUP} للبيع وخدمة ما بعد البيع في المنطقة المذكورة أدناه.`, facts: ["المنطقة", "من تاريخ", "حتى تاريخ"], sig1: "مدير المبيعات", sig2: "المؤسس والرئيس التنفيذي" },
  },
  agency: {
    en: { heading: "Certificate of Exclusive Agency", pre: "This is to certify that", statement: `is appointed Exclusive Agent of ${GROUP} in the territory below.`, facts: ["Territory", "Products", "Valid until"], sig1: "Founder & CEO", sig2: "" },
    zh: { heading: "独家代理证书", pre: "兹证明", statement: `被委任为 ${GROUP} 在下列区域的独家代理。`, facts: ["区域", "产品", "有效期至"], sig1: "创始人兼首席执行官", sig2: "" },
    ar: { heading: "شهادة وكالة حصرية", pre: "نشهد بأن", statement: `وكيل حصري لـ ${GROUP} في المنطقة المذكورة أدناه.`, facts: ["المنطقة", "المنتجات", "حتى تاريخ"], sig1: "المؤسس والرئيس التنفيذي", sig2: "" },
  },
  installation: {
    en: { heading: "Certificate of Installation", pre: "The machines below, delivered to", statement: "were installed, tested and handed over in full working order.", facts: ["Model", "Serial no.", "Engineer"], sig1: "Service Engineer", sig2: "Customer" },
    zh: { heading: "安装证书", pre: "交付给", statement: "的下列设备已完成安装、调试，并以完好状态移交。", facts: ["型号", "序列号", "工程师"], sig1: "服务工程师", sig2: "客户" },
    ar: { heading: "شهادة تركيب", pre: "الماكينات المذكورة أدناه، المسلّمة إلى", statement: "تم تركيبها واختبارها وتسليمها بحالة تشغيل كاملة.", facts: ["الموديل", "الرقم التسلسلي", "المهندس"], sig1: "مهندس الخدمة", sig2: "العميل" },
  },
  warranty: {
    en: { heading: "Warranty Certificate", pre: "This machine, supplied to", statement: "is covered against defects in materials and workmanship under the terms below — and nothing beyond them.", facts: ["Model", "Serial no.", "Start date", "Warranty period"], sig1: "After-sales Manager", sig2: "" },
    zh: { heading: "保修证书", pre: "本设备交付给", statement: "按下列条款对材料和工艺缺陷提供保修 — 条款以外不在保修范围内。", facts: ["型号", "序列号", "起始日期", "保修期"], sig1: "售后经理", sig2: "" },
    ar: { heading: "شهادة ضمان", pre: "هذه الماكينة، المورّدة إلى", statement: "مضمونة ضد عيوب المواد والتصنيع وفق الشروط المذكورة أدناه فقط.", facts: ["الموديل", "الرقم التسلسلي", "تاريخ البدء", "مدة الضمان"], sig1: "مدير خدمة ما بعد البيع", sig2: "" },
  },
  appreciation: {
    en: { heading: "Certificate of Appreciation", pre: "Presented to", statement: "in recognition of outstanding dedication and contribution.", facts: [], sig1: "Founder & CEO", sig2: "" },
    zh: { heading: "感谢证书", pre: "授予", statement: "以表彰其卓越的奉献与贡献。", facts: [], sig1: "创始人兼首席执行官", sig2: "" },
    ar: { heading: "شهادة تقدير", pre: "مقدّمة إلى", statement: "تقديرًا لتفانيه وإسهامه المتميّز.", facts: [], sig1: "المؤسس والرئيس التنفيذي", sig2: "" },
  },
  employee: {
    en: { heading: "Employee of the Month", pre: "Presented to", statement: "for outstanding performance, commitment and teamwork.", facts: ["Month"], sig1: "HR Manager", sig2: "Founder & CEO" },
    zh: { heading: "月度优秀员工", pre: "授予", statement: "以表彰其出色的表现、敬业精神与团队合作。", facts: ["月份"], sig1: "人力资源经理", sig2: "创始人兼首席执行官" },
    ar: { heading: "موظف الشهر", pre: "مقدّمة إلى", statement: "تقديرًا لأدائه المتميّز والتزامه وروح الفريق.", facts: ["الشهر"], sig1: "مدير الموارد البشرية", sig2: "المؤسس والرئيس التنفيذي" },
  },
};
const PREFIX: Record<Kind, string> = { training: "KL-TC", dealer: "KL-AD", agency: "KL-EA", installation: "KL-IN", warranty: "KL-WC", appreciation: "KL-AP", employee: "KL-EM" };
/** Formal papers carry the legal name of their day (owner, 28/09/2026). */
const FORMAL: Kind[] = ["training", "dealer", "agency", "installation", "warranty"];

const today = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};
const factRows = (kind: Kind, lang: Lang): TemplateItem[] =>
  WORDS[kind][lang].facts.map((label, i) => ({ id: `f${i}`, kind: "custom", label, value: "", on: true }));
const numberFor = (kind: Kind) => `${PREFIX[kind]}-${new Date().getFullYear()}-0001`;

/* ── reading the fill ──────────────────────────────────────────────────── */

const WEIGHTS: Record<string, number> = { light: 300, regular: 400, medium: 500, bold: 700 };

function read(v: TemplateValues, ctx: DrawContext) {
  const lang = asLang(v.lang);
  const w = ctx.w, h = ctx.h;
  const foot = v.foot === "none" ? "none" : v.foot === "everyday" ? "everyday" : "legal";
  const style = styleOf(v);
  return {
    b: ctx.bleed, w, h, W: w + ctx.bleed * 2, H: h + ctx.bleed * 2, tall: h > w,
    /** mm per mm of an A4's short side: everything grows with the paper */
    u: Math.min(w, h) / 210,
    lang, rtl: lang === "ar", font: fontOf(v), k: num(v, "scale", 100) / 100, uid: ctx.uid, codes: ctx.qrs,
    heading: str(v, "heading"), pre: str(v, "pre"), name: str(v, "name") || PLACEHOLDER[lang], name2: str(v, "name2"), org: str(v, "org"),
    statement: str(v, "statement"),
    facts: rowsOf(v, "facts").filter((f) => f.on && f.value.trim()),
    date: str(v, "date"), number: str(v, "number"),
    sigs: [
      { name: str(v, "sig1Name"), role: str(v, "sig1Role"), image: str(v, "sig1Image") },
      ...(v.sig2On === false ? [] : [{ name: str(v, "sig2Name"), role: str(v, "sig2Role"), image: str(v, "sig2Image") }]),
    ],
    /* No seal around the logo (owner, 01/10/2026 — book ch. 40): a fill
       saved with the silver seal reads without it; the printer's dry-seal
       note stays. */
    seal: v.seal === "emboss" ? "emboss" : "none",
    foot, footName: foot === "legal" ? legalNameEn(issued(v)) : EVERYDAY_NAME_EN,
    nameWeight: WEIGHTS[String(v.nameWeight)] ?? WEIGHTS[STYLE_LOOK[style].nameWeight],
    pattern: patternOf(v.pattern, "scan-edge"),
    silverName: v.silverName === true,
    qrs: qrsOf(v),
  };
}
type R = ReturnType<typeof read>;

/* ── type ──────────────────────────────────────────────────────────────── */

const ARABIC = /[\u0600-\u06FF]/;
const NOT_LATIN = /[\u0600-\u06FF\u2E80-\u9FFF]/;
/** Capitals with air — the headings and every small label. Chinese and
 *  Arabic keep their own shapes. */
const caps = (s: string) => (NOT_LATIN.test(s) ? s : s.toUpperCase());

function Txt({ r, x, y, size, children, fill, weight = 400, anchor = "middle", align, max, spacing, ltr }: {
  r: R; x: number; y: number; size: number; children: string; fill: string; weight?: number;
  anchor?: "start" | "middle" | "end";
  /** The side of x the text sits on, whatever its direction (an Arabic
   *  line's "start" is its right edge). Wins over `anchor`. */
  align?: "left" | "right" | "center";
  max?: number; spacing?: number; ltr?: boolean;
}) {
  /* letter-spacing would break the joins of Arabic letters */
  const spaced = spacing && !ARABIC.test(children) ? spacing : undefined;
  const dir = ltr ? "ltr" : r.rtl ? "rtl" : "ltr";
  const a = align === "center" ? "middle" : align === "left" ? (dir === "ltr" ? "start" : "end") : align === "right" ? (dir === "ltr" ? "end" : "start") : anchor;
  return (
    <text x={x} y={y} textAnchor={a} direction={dir} fill={fill}
      {...(max ? fit(children, size, max, weight, r.font) : {})}
      style={{ fontFamily: r.font, fontSize: size, fontWeight: weight, letterSpacing: spaced, unicodeBidi: "plaintext", fontVariantNumeric: "tabular-nums" }}>{children}</text>
  );
}
/** Width of a line with its letter-spacing. */
const tracked = (r: R, text: string, size: number, weight: number, spacing: number) =>
  textWidth(text, size, weight, r.font) + (ARABIC.test(text) ? 0 : text.length * spacing);

interface Look { ink: string; sub: string; faint: string; line: string; nameFill?: string; paper: string }
const LIGHT: Look = { ink: INK, sub: "#3A3A3C", faint: "#8E8E93", line: "#C7C7CC", paper: WHITE };
const DARK: Look = { ink: WHITE, sub: "#C7C7CC", faint: "#8E8E93", line: "#48484A", paper: INK };

/** A small label in spaced capitals. */
function Label({ r, x, y, text, anchor, align, look, size, fill, ltr }: { r: R; x: number; y: number; text: string; anchor?: "start" | "middle" | "end"; align?: "left" | "right" | "center"; look: Look; size?: number; fill?: string; ltr?: boolean }) {
  const s = size ?? 2.4 * r.u;
  return <Txt r={r} x={x} y={y} size={s} fill={fill ?? look.faint} weight={600} anchor={anchor} align={align} spacing={s * 0.24} ltr={ltr}>{caps(text)}</Txt>;
}

/** The title as a designer sets it: spaced capitals between two hairlines
 *  (centred), or after one (from the start edge). */
function HeadingMark({ r, x, y, align, look, size }: { r: R; x: number; y: number; align: "middle" | "start"; look: Look; size?: number }) {
  if (!r.heading) return null;
  const s = size ?? (NOT_LATIN.test(r.heading) ? 5.2 : 3.2) * r.u;
  const sp = s * 0.3;
  const tw = tracked(r, caps(r.heading), s, 600, sp);
  const rule = 12 * r.u, gap = 5 * r.u;
  const lineY = y - s * 0.34;
  if (align === "middle") {
    return (
      <g>
        <rect x={x - tw / 2 - gap - rule} y={lineY} width={rule} height={0.2} fill={look.ink} />
        <rect x={x + tw / 2 + gap} y={lineY} width={rule} height={0.2} fill={look.ink} />
        <Txt r={r} x={x} y={y} size={s} fill={look.ink} weight={600} spacing={sp}>{caps(r.heading)}</Txt>
      </g>
    );
  }
  const ruleX = r.rtl ? x - rule : x;
  const tx = r.rtl ? x - rule - gap : x + rule + gap;
  return (
    <g>
      <rect x={ruleX} y={lineY} width={rule} height={0.2} fill={look.ink} />
      <Txt r={r} x={tx} y={y} size={s} fill={look.ink} weight={600} anchor="start" spacing={sp}>{caps(r.heading)}</Txt>
    </g>
  );
}

/** The name: one line up to `max`, two balanced lines below `min`. */
function heroFit(r: R, max: number, min: number, width: number) {
  const wt = r.nameWeight;
  const w1 = textWidth(r.name, max, wt, r.font);
  if (w1 <= width) return { lines: [r.name], size: max };
  let size = (max * width) / w1;
  let lines = [r.name];
  if (size < min && /\s/.test(r.name)) {
    size = max * 0.78;
    lines = wrapBalanced(r.name, size, width, wt, r.font);
    const wd = Math.max(...lines.map((l) => textWidth(l, size, wt, r.font)));
    if (wd > width) size = (size * width) / wd;
  }
  return { lines, size };
}

/** The hairline grid (facts, signatures): a rule over the row, hairlines
 *  between the cells, a spaced label and a value in each; a scanned
 *  signature stands on the rule. Returns its foot. */
interface Cell { label: string; value: string; image?: string; strong?: boolean; ltr?: boolean }
function Grid({ r, x, y, width, cells, look, align }: { r: R; x: number; y: number; width: number; cells: Cell[]; look: Look; align: "middle" | "start" }) {
  const u = r.u;
  if (!cells.length) return { node: null as ReactNode, bottom: y };
  const n = cells.length;
  const cw = width / n;
  const hgt = 13 * u;
  const ordered = r.rtl ? [...cells].reverse() : cells;
  const pad = 4 * u;
  return {
    bottom: y + hgt,
    node: (
      <g>
        <MicroRule r={r} id="grid" x={x} y={y} width={width} fill={look.faint} />
        {ordered.map((c, i) => {
          const cx0 = x + i * cw;
          const first = r.rtl ? i === n - 1 : i === 0;
          const tx = align === "middle" ? cx0 + cw / 2 : r.rtl ? cx0 + cw - (first ? 0 : pad) : cx0 + (first ? 0 : pad);
          const al = align === "middle" ? "center" : r.rtl ? "right" : "left";
          return (
            <g key={`${i}-${c.label}`}>
              {i > 0 ? <rect x={cx0} y={y + 2.2 * u} width={0.15} height={hgt - 2.2 * u} fill={look.line} /> : null}
              {c.image ? <image href={c.image} x={cx0 + pad} y={y - 16 * u} width={cw - pad * 2} height={15 * u} preserveAspectRatio={align === "middle" ? "xMidYMax meet" : r.rtl ? "xMaxYMax meet" : "xMinYMax meet"} /> : null}
              <Label r={r} x={tx} y={y + 5.6 * u} text={c.label} align={al} look={look} size={2.2 * u} />
              <Txt r={r} x={tx} y={y + 11.4 * u} size={3.7 * u} fill={look.ink} weight={c.strong ? 600 : 500} align={al} max={cw - pad * 1.5} ltr={c.ltr}>{c.value || " "}</Txt>
            </g>
          );
        })}
      </g>
    ),
  };
}
const signCells = (r: R): Cell[] => [
  ...r.sigs.map((s) => ({ label: s.role || " ", value: s.name, image: s.image, strong: true })),
  { label: LABELS[r.lang].date, value: r.date, ltr: true },
  { label: LABELS[r.lang].number, value: r.number, ltr: true },
];

/** The body in reading order — pre, name, name in its own script, the
 *  organisation, the statement, the facts — measured, then placed. */
interface BodyOpts { x: number; width: number; align: "middle" | "start"; look: Look; max: number; min: number; preAsLabel?: boolean; statementW?: number; factsW?: number }
function Body({ r, top, bottom, o }: { r: R; top: number; bottom: number; o: BodyOpts }) {
  const u = r.u;
  const anchor = o.align;
  const lay = (y0: number) => {
    const nodes: ReactNode[] = [];
    let y = y0;
    if (r.pre) {
      if (o.preAsLabel) { y += 2.6 * u; nodes.push(<Label key="pre" r={r} x={o.x} y={y} text={r.pre} anchor={anchor} look={o.look} size={2.6 * u} />); y += 6 * u; }
      else { y += 4.2 * u; nodes.push(<Txt key="pre" r={r} x={o.x} y={y} size={4.2 * u} fill={o.look.sub} anchor={anchor} max={o.width}>{r.pre}</Txt>); y += 4 * u; }
    }
    const hero = heroFit(r, o.max * r.k, o.min * r.k, o.width);
    hero.lines.forEach((l, i) => {
      y += i === 0 ? hero.size * 0.92 : hero.size * 1.08;
      nodes.push(<Txt key={`n${i}`} r={r} x={o.x} y={y} size={hero.size} fill={o.look.nameFill ?? (r.silverName ? `url(#${r.uid}-silverink)` : o.look.ink)} weight={r.nameWeight} anchor={anchor} max={o.width} spacing={hero.size >= 14 * u && r.nameWeight <= 400 ? -hero.size * 0.012 : undefined}>{l}</Txt>);
    });
    y += hero.size * 0.12;
    if (r.name2 && r.name2 !== r.name) { const s = 6 * u; y += s * 1.5; nodes.push(<Txt key="n2" r={r} x={o.x} y={y} size={s} fill={o.look.ink} weight={300} anchor={anchor} max={o.width}>{r.name2}</Txt>); }
    if (r.org) { const s = 4.4 * u; y += s * 1.9; nodes.push(<Txt key="org" r={r} x={o.x} y={y} size={s} fill={o.look.ink} weight={500} anchor={anchor} max={o.width}>{r.org}</Txt>); }
    if (r.statement) {
      const s = 4.1 * u;
      const sw = o.statementW ?? o.width;
      y += 6.5 * u;
      wrap(r.statement, s, sw, 3, 400, r.font).forEach((l, i) => { y += i === 0 ? s : s * 1.55; nodes.push(<Txt key={`s${i}`} r={r} x={o.x} y={y} size={s} fill={o.look.sub} anchor={anchor} max={sw}>{l}</Txt>); });
    }
    if (r.facts.length) {
      y += 10 * u;
      const fw = Math.min(o.factsW ?? o.width, r.facts.length * 62 * u);
      const gx = o.align === "middle" ? o.x - fw / 2 : r.rtl ? o.x - fw : o.x;
      const grid = Grid({ r, x: gx, y, width: fw, cells: r.facts.map((f) => ({ label: f.label.trim(), value: f.value.trim() })), look: o.look, align: o.align });
      nodes.push(<g key="facts">{grid.node}</g>);
      y = grid.bottom;
    }
    return { nodes, bottom: y };
  };
  const height = lay(0).bottom;
  return { node: <g>{lay(top + Math.max(0, (bottom - top - height) * 0.5)).nodes}</g>, fits: height <= bottom - top };
}

/** The foot: a hairline and, in small capitals, the legal name in force on
 *  the day of issue with its Chinese name — the house lockup set as fine
 *  print — or the everyday name. Returns the line's y. */
function Foot({ r, x0, x1, look }: { r: R; x0: number; x1: number; look: Look }) {
  const u = r.u;
  const y = r.b + r.h - 13 * u;
  if (r.foot === "none") return { node: null as ReactNode, top: r.b + r.h - 8 * u };
  const s = 2.2 * u;
  const tagline = KOLEEX_COMPANY.tagline.replace(/\.$/, "");
  const room = x1 - x0;
  return {
    top: y,
    node: (
      <g>
        <MicroRule r={r} id="foot" x={x0} y={y} width={room} fill={look.line} />
        <Txt r={r} x={x0} y={y + 5 * u} size={s} fill={look.faint} weight={600} anchor="start" spacing={s * 0.12} ltr max={room * (room > 200 * u ? 0.4 : 0.56)}>{r.footName}</Txt>
        {room > 200 * u ? <Txt r={r} x={(x0 + x1) / 2} y={y + 5 * u} size={s} fill={look.faint} weight={600} spacing={s * 0.3} ltr>{tagline}</Txt> : null}
        <Txt r={r} x={x1} y={y + 5 * u} size={s} fill={look.faint} weight={500} anchor="end" ltr max={room * (room > 200 * u ? 0.3 : 0.4)}>{r.foot === "legal" ? KOLEEX_COMPANY.zh : KOLEEX_COMPANY.web}</Txt>
      </g>
    ),
  };
}

/* ── ornaments (shared: ./ornaments) ──────────────────────────────────── */

function MicroRule({ r, id, x, y, width, fill }: { r: R; id: string; x: number; y: number; width: number; fill: string }) {
  return <MicroLine uid={r.uid} font={r.font} size={0.5 * r.u} id={id} x={x} y={y} width={width} fill={fill} />;
}
function Seal({ r, cx, cy, rad, dark }: { r: R; cx: number; cy: number; rad: number; dark: boolean }) {
  return r.seal === "silver" ? <FoilSeal uid={r.uid} font={r.font} cx={cx} cy={cy} rad={rad} dark={dark} /> : null;
}

/** QR codes (a link to check the certificate, the website …). */
function Codes({ r, x, y, size, look }: { r: R; x: number; y: number; size: number; look: Look }) {
  if (!r.qrs.length) return null;
  const n = r.qrs.length;
  return <QrZone items={r.qrs} codes={r.codes} font={r.font} captionFill={look.faint} max={size} zone={{ x, y, w: n * size + (n - 1) * 3 * r.u, h: size + 3 * r.u, dir: "row", align: "start" }} />;
}

/* ── the nine styles ───────────────────────────────────────────────────── */

/** Every page: the silvers first, then its style (the first set draws
 *  itself). */
function page(v: TemplateValues, ctx: DrawContext): ReactNode {
  if (isV1(v)) return pageV1(v, ctx);
  const uid = ctx.uid;
  return (
    <>
      <defs>
        <linearGradient id={`${uid}-silverink`} x1="0" y1="0" x2="1" y2="0.35">
          {["#48484A", "#8E8E93", "#3A3A3C", "#6E6E73"].map((c, i) => <stop key={i} offset={[0, 0.4, 0.7, 1][i]} stopColor={c} />)}
        </linearGradient>
      </defs>
      {styled(v, ctx)}
    </>
  );
}

function styled(v: TemplateValues, ctx: DrawContext): ReactNode {
  const r = read(v, ctx);
  const { b, w, h, W, H, u, tall } = r;
  const style = styleOf(v);
  const M = (tall ? 18 : 20) * u;
  const cx = b + w / 2;
  const x0 = b + M, x1 = b + w - M;
  const sealR = 15 * u;
  const qr = 16 * u;

  /* ── the centred family: classic, guilloche, black, corners, award ── */
  if (style === "classic" || style === "guilloche" || style === "black" || style === "corners" || style === "award") {
    const dark = style === "black";
    const look: Look = dark ? { ...DARK, nameFill: `url(#${r.uid}-silver)` } : LIGHT;
    const framed = style === "guilloche" || style === "black";
    const inset = 7 * u, T = 8 * u;
    const fx0 = framed ? b + inset + T + 12 * u : x0, fx1 = framed ? b + w - inset - T - 12 * u : x1;
    /* inside a frame (or the corners) the foot moves up with it */
    const lift = framed ? inset + T + 2 * u : style === "corners" ? 6 * u : 0;
    const foot = Foot({ r: { ...r, h: r.h - lift }, x0: fx0, x1: fx1, look });
    const footTop = foot.top;
    const footNode = foot.node;
    const gridW = Math.min(fx1 - fx0, (tall ? 0.86 : 0.7) * w);
    const gridY = footTop - 22 * u;
    const award = style === "award";
    const lw = award ? (tall ? 0.22 : 0.12) * w : (tall ? 0.3 : 0.17) * w;
    const logoY = b + (framed ? inset + T + 12 : 20) * u;
    const nodes: ReactNode[] = [<rect key="bg" x={0} y={0} width={W} height={H} fill={look.paper} />];
    nodes.push(<defs key="defs"><linearGradient id={`${r.uid}-silver`} x1="0" y1="0" x2="1" y2="1">{SILVER.map((c, i) => <stop key={c} offset={[0, 0.35, 0.62, 1][i]} stopColor={c} />)}</linearGradient></defs>);
    if (framed) nodes.push(<Guilloche key="g" x0={b + inset} y0={b + inset} x1={b + w - inset} y1={b + h - inset} T={T} color={dark ? "#636366" : "#AEAEB2"} />);
    if (style === "corners") {
      const ci = 8 * u, arm = 16 * u, t = 0.5;
      for (const [px, py, sx, sy] of [[b + ci, b + ci, 1, 1], [b + w - ci, b + ci, -1, 1], [b + ci, b + h - ci, 1, -1], [b + w - ci, b + h - ci, -1, -1]] as Array<[number, number, number, number]>) {
        nodes.push(<rect key={`ch${px}${py}`} x={sx > 0 ? px : px - arm} y={sy > 0 ? py : py - t} width={arm} height={t} fill={INK} />);
        nodes.push(<rect key={`cv${px}${py}`} x={sx > 0 ? px : px - t} y={sy > 0 ? py : py - arm} width={t} height={arm} fill={INK} />);
      }
    }
    nodes.push(<Logo key="logo" x={cx - lw / 2} y={logoY} width={lw} fill={dark ? WHITE : INK} />);
    let top = logoY + logoHeight(lw) + 14 * u;
    if (award && r.heading) {
      const s = (NOT_LATIN.test(r.heading) ? 12 : 10) * u;
      const lines = wrapBalanced(caps(r.heading), s, w * 0.8, 200, r.font);
      lines.forEach((l, i) => nodes.push(<Txt key={`ah${i}`} r={r} x={cx} y={top + s + i * s * 1.2} size={s} fill={INK} weight={200} spacing={s * 0.14} max={w * 0.86}>{l}</Txt>));
      top += s + (lines.length - 1) * s * 1.2 + 6 * u;
      nodes.push(<rect key="arule" x={cx - 24 * u} y={top} width={48 * u} height={0.7 * u} fill={`url(#${r.uid}-silver)`} />);
      top += 10 * u;
    } else if (r.heading) {
      nodes.push(<HeadingMark key="hm" r={r} x={cx} y={top} align="middle" look={look} />);
      top += 10 * u;
    }
    const bodyOpts: BodyOpts = { x: cx, width: w * (tall ? 0.8 : 0.7), align: "middle", look, max: (award ? 17 : 20) * u, min: 11 * u, preAsLabel: award, statementW: w * (tall ? 0.78 : 0.56), factsW: gridW };
    let sealBelow = award || tall;
    let body = Body({ r, top, bottom: gridY - (sealBelow && r.seal === "silver" ? (award ? 2.85 * sealR + 18 * u : 2 * sealR + 26 * u) : 18 * u), o: bodyOpts });
    if (sealBelow && r.seal === "silver" && !body.fits) {
      /* the words need the room: the seal goes to the top corner */
      sealBelow = false;
      body = Body({ r, top, bottom: gridY - 18 * u, o: bodyOpts });
    }
    nodes.push(<g key="body">{body.node}</g>);
    const grid = Grid({ r, x: cx - gridW / 2, y: gridY, width: gridW, cells: signCells(r), look, align: "middle" });
    nodes.push(<g key="grid">{grid.node}</g>);
    if (sealBelow) nodes.push(<Seal key="seal" r={r} cx={cx} cy={gridY - sealR - 12 * u} rad={sealR} dark={dark} />);
    else nodes.push(<Seal key="seal" r={r} cx={fx1 - sealR} cy={logoY + logoHeight(lw) / 2 + (framed ? 4 * u : 0)} rad={sealR} dark={dark} />);
    nodes.push(<Codes key="qr" r={r} x={fx0} y={logoY} size={qr} look={look} />);
    nodes.push(<g key="foot">{footNode}</g>);
    return <>{nodes}</>;
  }

  /* ── monolith: a black column carrying the KOLEEX pattern, the certificate on white ── */
  if (style === "monolith") {
    const dark = DARK;
    const nodes: ReactNode[] = [<rect key="bg" x={0} y={0} width={W} height={H} fill={WHITE} />];
    if (!tall) {
      const pw = 0.36 * w;
      const px = r.rtl ? b + w - pw : 0;
      const pW = r.rtl ? W - px : b + pw;
      const pin = r.rtl ? b + w - 16 * u : b + 16 * u;
      const pAlign = r.rtl ? "right" : "left";
      nodes.push(<rect key="panel" x={px} y={0} width={pW} height={H} fill={INK} />);
      const lw = pw * 0.5;
      nodes.push(<Pattern key="pat" id={r.pattern} area={{ x0: px, y0: 0, w: pW, h: H }} dark mirror={!r.rtl} uid={`${r.uid}-cmp`}
        clear={[{ x: (r.rtl ? pin - lw : pin) - 4 * u, y: b + 16 * u, w: lw + 8 * u, h: logoHeight(lw) + 8 * u },
          { x: r.rtl ? pin - pw * 0.8 : pin - 4 * u, y: b + h - 58 * u, w: pw * 0.8 + 4 * u, h: 42 * u }]} />);
      nodes.push(<Logo key="logo" x={r.rtl ? pin - lw : pin} y={b + 20 * u} width={lw} fill={WHITE} />);
      if (r.heading) {
        const s = (NOT_LATIN.test(r.heading) ? 5 : 3) * u;
        const lines = wrap(caps(r.heading), s, pw - 32 * u, 3, 600, r.font);
        const y0 = b + h - 34 * u - (lines.length - 1) * s * 1.6;
        nodes.push(<rect key="hr" x={r.rtl ? pin - 10 * u : pin} y={y0 - s - 5 * u} width={10 * u} height={0.25} fill={WHITE} />);
        lines.forEach((l, i) => nodes.push(<Txt key={`h${i}`} r={r} x={pin} y={y0 + i * s * 1.6} size={s} fill={WHITE} weight={600} align={pAlign} spacing={s * 0.28}>{l}</Txt>));
      }
      nodes.push(<Label key="no" r={r} x={pin} y={b + h - 22 * u} text={r.number} align={pAlign} look={dark} size={2.4 * u} ltr />);
      const cx0 = r.rtl ? b + M : b + pw + 22 * u;
      const cx1 = r.rtl ? b + w - pw - 22 * u : b + w - M;
      const start = r.rtl ? cx1 : cx0;
      const foot = Foot({ r, x0: cx0, x1: cx1, look: LIGHT });
      const gridY = foot.top - 22 * u;
      const body = Body({ r, top: b + 20 * u, bottom: gridY - 16 * u, o: { x: start, width: cx1 - cx0, align: "start", look: LIGHT, max: 19 * u, min: 11 * u, preAsLabel: true, statementW: (cx1 - cx0) * 0.92 } });
      nodes.push(<g key="body">{body.node}</g>);
      nodes.push(<g key="grid">{Grid({ r, x: cx0, y: gridY, width: cx1 - cx0, cells: signCells(r).filter((c) => c.label !== LABELS[r.lang].number), look: LIGHT, align: "start" }).node}</g>);
      nodes.push(<Seal key="seal" r={r} cx={r.rtl ? px : b + pw} cy={b + h * 0.5} rad={sealR} dark />);
      nodes.push(<Codes key="qr" r={r} x={r.rtl ? cx0 : cx1 - qr * r.qrs.length} y={b + 20 * u} size={qr} look={LIGHT} />);
      nodes.push(<g key="foot">{foot.node}</g>);
      return <>{nodes}</>;
    }
    /* portrait: the black block across the top */
    const ph = 0.3 * h;
    nodes.push(<rect key="panel" x={0} y={0} width={W} height={b + ph} fill={INK} />);
    const lw = 0.34 * w;
    nodes.push(<Pattern key="pat" id={r.pattern} area={{ x0: 0, y0: 0, w: W, h: b + ph }} dark mirror={r.rtl} uid={`${r.uid}-cmpp`}
      clear={[{ x: (r.rtl ? x1 - lw : x0) - 4 * u, y: b + 16 * u, w: lw + 8 * u, h: logoHeight(lw) + 8 * u },
        { x: r.rtl ? b + w * 0.4 : 0, y: b + ph - 22 * u, w: b + w * 0.6, h: 14 * u }]} />);
    const start = r.rtl ? x1 : x0;
    nodes.push(<Logo key="logo" x={r.rtl ? x1 - lw : x0} y={b + 20 * u} width={lw} fill={WHITE} />);
    if (r.heading) nodes.push(<HeadingMark key="hm" r={r} x={start} y={b + ph - 14 * u} align="start" look={dark} />);
    const foot = Foot({ r, x0, x1, look: LIGHT });
    const gridY = foot.top - 22 * u;
    const body = Body({ r, top: b + ph + 14 * u, bottom: gridY - (r.seal === "silver" ? 2 * sealR + 22 * u : 16 * u), o: { x: start, width: x1 - x0, align: "start", look: LIGHT, max: 18 * u, min: 11 * u, preAsLabel: true } });
    nodes.push(<g key="body">{body.node}</g>);
    nodes.push(<g key="grid">{Grid({ r, x: x0, y: gridY, width: x1 - x0, cells: signCells(r), look: LIGHT, align: "start" }).node}</g>);
    nodes.push(<Seal key="seal" r={r} cx={r.rtl ? x0 + sealR : x1 - sealR} cy={b + ph} rad={sealR} dark />);
    nodes.push(<g key="foot">{foot.node}</g>);
    return <>{nodes}</>;
  }

  /* ── editorial: the title as the headline, the pattern down the edge, a strict grid ── */
  if (style === "editorial") {
    const nodes: ReactNode[] = [<rect key="bg" x={0} y={0} width={W} height={H} fill={WHITE} />];
    {
      /* the band from the page's edge: the number and the logo keep clean ground */
      const bandW = 0.26 * w + b;
      const lwE = (tall ? 0.26 : 0.14) * w;
      nodes.push(<Pattern key="pat" id={r.pattern} area={{ x0: r.rtl ? 0 : W - bandW, y0: 0, w: bandW, h: H }} dark={false} mirror={r.rtl} uid={`${r.uid}-cep`}
        clear={[{ x: r.rtl ? x0 - 2 * u : x1 - 52 * u, y: b + M - 4 * u, w: 54 * u, h: 8 * u },
          { x: r.rtl ? x0 - 3 * u : x1 - lwE - 3 * u, y: b + h - 58 * u, w: lwE + 6 * u, h: 30 * u }]} />);
    }
    const start = r.rtl ? x1 : x0;
    nodes.push(<rect key="bar" x={r.rtl ? x1 - 26 * u : x0} y={b + M} width={26 * u} height={1.6 * u} fill={INK} />);
    nodes.push(<Label key="no" r={r} x={r.rtl ? x0 : x1} y={b + M + 1.8 * u} text={`№ ${r.number}`} align={r.rtl ? "left" : "right"} look={LIGHT} size={2.4 * u} ltr />);
    let top = b + M + 14 * u;
    if (r.heading) {
      const s = (NOT_LATIN.test(r.heading) ? 13 : 12) * u;
      const lines = wrap(r.heading, s, (tall ? 0.8 : 0.62) * w, 2, 250, r.font);
      lines.forEach((l, i) => nodes.push(<Txt key={`h${i}`} r={r} x={start} y={top + s * 0.9 + i * s * 1.08} size={s} fill={INK} weight={250} anchor="start" spacing={-s * 0.015}>{l}</Txt>));
      top += s * 0.9 + (lines.length - 1) * s * 1.08 + 12 * u;
    }
    const foot = Foot({ r, x0, x1, look: LIGHT });
    const gridY = foot.top - 22 * u;
    const lw = (tall ? 0.26 : 0.14) * w;
    const gridW = x1 - x0 - lw - 14 * u;
    const body = Body({ r, top, bottom: gridY - 16 * u, o: { x: start, width: (tall ? 0.86 : 0.58) * w, align: "start", look: LIGHT, max: 14 * u, min: 9 * u, preAsLabel: true, statementW: (tall ? 0.84 : 0.52) * w, factsW: (tall ? 0.86 : 0.58) * w } });
    nodes.push(<g key="body">{body.node}</g>);
    nodes.push(<g key="grid">{Grid({ r, x: r.rtl ? x1 - gridW : x0, y: gridY, width: gridW, cells: signCells(r).filter((c) => c.label !== LABELS[r.lang].number), look: LIGHT, align: "start" }).node}</g>);
    nodes.push(<Logo key="logo" x={r.rtl ? x0 : x1 - lw} y={gridY + 13 * u - logoHeight(lw)} width={lw} fill={INK} />);
    nodes.push(<Seal key="seal" r={r} cx={r.rtl ? x0 + sealR + 4 * u : x1 - sealR - 4 * u} cy={gridY - sealR - 14 * u} rad={sealR} dark={false} />);
    nodes.push(<Codes key="qr" r={r} x={r.rtl ? x0 : x1 - qr * r.qrs.length} y={b + M + 8 * u} size={qr} look={LIGHT} />);
    nodes.push(<g key="foot">{foot.node}</g>);
    return <>{nodes}</>;
  }

  /* ── swiss: a black band, two columns on a grid, the facts as a list ── */
  if (style === "swiss") {
    const nodes: ReactNode[] = [<rect key="bg" x={0} y={0} width={W} height={H} fill={WHITE} />];
    const bandH = (tall ? 26 : 30) * u;
    nodes.push(<rect key="band" x={0} y={0} width={W} height={b + bandH} fill={INK} />);
    const lw = (tall ? 0.28 : 0.15) * w;
    nodes.push(<Logo key="logo" x={r.rtl ? x1 - lw : x0} y={b + bandH / 2 - logoHeight(lw) / 2} width={lw} fill={WHITE} />);
    if (r.heading) {
      const s = (NOT_LATIN.test(r.heading) ? 4.6 : 3) * u;
      nodes.push(<Txt key="head" r={r} x={r.rtl ? x0 : x1} y={b + bandH / 2 + s * 0.36} size={s} fill={WHITE} weight={600} anchor={r.rtl ? "start" : "end"} spacing={s * 0.3} max={w * 0.5}>{caps(r.heading)}</Txt>);
    }
    const foot = Foot({ r, x0, x1, look: LIGHT });
    const gridY = foot.top - 22 * u;
    const colGap = 12 * u;
    const leftW = tall ? x1 - x0 : (x1 - x0) * 0.62;
    const rightW = tall ? 0 : x1 - x0 - leftW - colGap;
    const start = r.rtl ? x1 : x0;
    const bodyR = r.facts.length && !tall ? { ...r, facts: [] } : r;
    const body = Body({ r: bodyR, top: b + bandH + 16 * u, bottom: gridY - 16 * u, o: { x: start, width: leftW, align: "start", look: LIGHT, max: 17 * u, min: 10 * u, preAsLabel: true, statementW: leftW * 0.95 } });
    nodes.push(<g key="body">{body.node}</g>);
    if (!tall && r.facts.length) {
      /* the facts down the right column, a hairline over each */
      const fx = r.rtl ? x0 : x0 + leftW + colGap;
      const fAlign = r.rtl ? "right" : "left";
      const fX = r.rtl ? fx + rightW : fx;
      const fTop = b + bandH + 16 * u;
      r.facts.forEach((f, i) => {
        const y = fTop + i * 17 * u;
        nodes.push(<rect key={`fl${i}`} x={fx} y={y} width={rightW} height={0.2} fill={LIGHT.line} />);
        nodes.push(<Label key={`fk${i}`} r={r} x={fX} y={y + 5.6 * u} text={f.label.trim()} align={fAlign} look={LIGHT} size={2.2 * u} />);
        nodes.push(<Txt key={`fv${i}`} r={r} x={fX} y={y + 11.6 * u} size={3.9 * u} fill={INK} weight={500} align={fAlign} max={rightW}>{f.value.trim()}</Txt>);
      });
    }
    nodes.push(<g key="grid">{Grid({ r, x: x0, y: gridY, width: x1 - x0, cells: signCells(r), look: LIGHT, align: "start" }).node}</g>);
    nodes.push(<Seal key="seal" r={r} cx={r.rtl ? x0 + sealR : x1 - sealR} cy={gridY - sealR - 12 * u} rad={sealR} dark={false} />);
    nodes.push(<Codes key="qr" r={r} x={r.rtl ? x1 - qr * r.qrs.length : x0} y={gridY - qr - 14 * u} size={qr} look={LIGHT} />);
    nodes.push(<g key="foot">{foot.node}</g>);
    return <>{nodes}</>;
  }

  /* ── dots: the dots field (ch. 57) beside the words ── */
  const nodes: ReactNode[] = [<rect key="bg" x={0} y={0} width={W} height={H} fill={WHITE} />];
  const fw = tall ? W : 0.4 * w + b;
  const fh = tall ? 0.28 * h + b : H;
  const fx = tall ? 0 : r.rtl ? 0 : W - fw;
  const fy = tall ? H - fh : 0;
  nodes.push(<Dots key="dots" area={{ x: fx, y: fy, w: fw, h: fh }} pitch={3 * u} r={0.55 * u} fill="#C7C7CC" origin={{ x: fx + fw / 2, y: fy + fh / 2 }} uid={`${r.uid}-dd`} />);
  const cx0 = tall ? x0 : r.rtl ? b + fw - b + 18 * u : x0;
  const cx1 = tall ? x1 : r.rtl ? x1 : b + w - (fw - b) - 18 * u;
  const start = r.rtl ? cx1 : cx0;
  const lw = (tall ? 0.3 : 0.16) * w;
  nodes.push(<Logo key="logo" x={r.rtl ? cx1 - lw : cx0} y={b + M} width={lw} fill={INK} />);
  const foot = Foot({ r, x0: cx0, x1: cx1, look: LIGHT });
  const footTop = tall ? fy - 6 * u : foot.top;
  const gridY = footTop - 22 * u;
  let top = b + M + logoHeight(lw) + 16 * u;
  if (r.heading) { nodes.push(<HeadingMark key="hm" r={r} x={start} y={top} align="start" look={LIGHT} />); top += 10 * u; }
  const body = Body({ r, top, bottom: gridY - 16 * u, o: { x: start, width: cx1 - cx0, align: "start", look: LIGHT, max: 18 * u, min: 10 * u, preAsLabel: true, statementW: (cx1 - cx0) * 0.95 } });
  nodes.push(<g key="body">{body.node}</g>);
  nodes.push(<g key="grid">{Grid({ r, x: cx0, y: gridY, width: cx1 - cx0, cells: signCells(r), look: LIGHT, align: "start" }).node}</g>);
  nodes.push(<Seal key="seal" r={r} cx={tall ? x1 - sealR : fx + fw / 2 + (r.rtl ? b / 2 : -b / 2)} cy={tall ? fy + fh / 2 : b + h - 34 * u} rad={sealR} dark={false} />);
  nodes.push(<Codes key="qr" r={r} x={r.rtl ? cx0 : cx1 - qr * r.qrs.length} y={b + M} size={qr} look={LIGHT} />);
  if (!tall) nodes.push(<g key="foot">{foot.node}</g>);
  else nodes.push(<g key="foot">{Foot({ r: { ...r, h: r.h - (fh - b) + 2 * u }, x0, x1, look: LIGHT }).node}</g>);
  return <>{nodes}</>;
}

/* ── the template ──────────────────────────────────────────────────────── */

/** A new kind brings its wording, facts, signatures, number and foot in the
 *  certificate's language; the name, the date and the look stay. */
function rekind(v: TemplateValues, value: TemplateValue): TemplateValues {
  const kind = (CERT_KINDS as readonly string[]).includes(String(value)) ? (value as Kind) : "training";
  const lang = asLang(v.lang);
  const W = WORDS[kind][lang];
  const oldNumber = str(v, "number");
  const keepNumber = oldNumber && !CERT_KINDS.some((k) => oldNumber.startsWith(PREFIX[k]));
  return {
    ...v, kind,
    heading: W.heading, pre: W.pre, statement: W.statement, facts: factRows(kind, lang),
    sig1Role: W.sig1, sig2Role: W.sig2, sig2On: !!W.sig2,
    number: keepNumber ? oldNumber : numberFor(kind),
    foot: FORMAL.includes(kind) ? "legal" : "everyday",
    style: kind === "appreciation" || kind === "employee" ? (v.style === "classic" ? "award" : v.style === "book" ? "award-1" : String(v.style)) : String(v.style),
  };
}
/** Another language: every text still at a default moves with it. */
function relang(v: TemplateValues, langRaw: string): TemplateValues {
  const lang = asLang(langRaw);
  const kind = kindOf(v);
  const moved = (key: keyof KindWords) => {
    const cur = str(v, key);
    return LANGS.some((l) => WORDS[kind][l][key] === cur) ? { [key]: WORDS[kind][lang][key] as string } : {};
  };
  const facts = list(v, "facts").map((f, i) => {
    const isDefault = LANGS.some((l) => WORDS[kind][l].facts[i] === f.label);
    return isDefault ? { ...f, label: WORDS[kind][lang].facts[i] } : f;
  });
  return { ...v, lang, ...moved("heading"), ...moved("pre"), ...moved("statement"), facts,
    ...(LANGS.some((l) => WORDS[kind][l].sig1 === str(v, "sig1Role")) ? { sig1Role: WORDS[kind][lang].sig1 } : {}),
    ...(LANGS.some((l) => WORDS[kind][l].sig2 === str(v, "sig2Role")) ? { sig2Role: WORDS[kind][lang].sig2 } : {}),
  };
}

function qrRequests(v: TemplateValues): QrRequest[] {
  const out: QrRequest[] = [];
  for (const q of qrsOf(v)) {
    if (isPictureQr(q)) continue;
    const text = q.kind === "web" ? `https://${KOLEEX_COMPANY.web}` : q.kind === "link" ? q.link.trim() || null : null;
    if (text) out.push({ id: q.id, text, level: q.logo ? "H" : "M" });
  }
  return out;
}

const isStyle = (...s: Style[]) => (v: TemplateValues) => s.includes(styleOf(v));
const START = WORDS.training.en;

export const certificate: TemplateDef = {
  id: "certificate",
  itemKey: "certificates",
  nameKey: "cert.name",
  size: (v) => SIZES[typeof v.size === "string" ? v.size : ""] ?? SIZES["a4-land"],
  bleed: 3,
  safe: 10,
  fields: [
    { key: "kind", kind: "choice", labelKey: "cert.f.kind", group: "look", options: CERT_KINDS.map((k) => ({ value: k, labelKey: `cert.kind.${k}` })) },
    { key: "style", kind: "choice", labelKey: "tpl.f.style", group: "look", options: CERT_STYLES.map((s) => ({ value: s, labelKey: `cert.style.${s}` })) },
    { key: "size", kind: "choice", labelKey: "tpl.f.size", group: "look", options: [
      { value: "a4-land", labelKey: "cert.size.a4-land" }, { value: "a4-port", labelKey: "cert.size.a4-port" }, { value: "a3-land", labelKey: "cert.size.a3-land" },
    ] },
    { key: "lang", kind: "choice", labelKey: "cert.f.lang", group: "look", options: [
      { value: "en", labelKey: "tpl.lang.en" }, { value: "zh", labelKey: "tpl.lang.zh" }, { value: "ar", labelKey: "tpl.lang.ar" },
    ] },
    { key: "font", kind: "choice", labelKey: "tpl.f.font", group: "look", options: [
      { value: "inter", labelKey: "tpl.font.inter" }, { value: "helvetica", labelKey: "tpl.font.helvetica" },
    ] },
    { key: "scale", kind: "range", labelKey: "evb.f.scale", group: "look", min: 70, max: 130, step: 5, unit: "%" },
    { key: "nameWeight", kind: "choice", labelKey: "sig.f.nameWeight", group: "look", when: (v) => !isV1(v), options: [
      { value: "light", labelKey: "sig.weight.light" }, { value: "regular", labelKey: "sig.weight.regular" }, { value: "medium", labelKey: "cert.weight.medium" }, { value: "bold", labelKey: "sig.weight.bold" },
    ] },
    { key: "pattern", kind: "choice", labelKey: "pat.field", group: "look", options: patternOptions(), when: (v) => !isV1(v) && isStyle("monolith", "editorial")(v) },
    { key: "silverName", kind: "switch", labelKey: "cert.f.silverName", group: "look", when: (v) => !isV1(v) && !isStyle("black")(v) },

    { key: "heading", kind: "text", labelKey: "cert.f.heading", group: "words", max: 60 },
    { key: "pre", kind: "text", labelKey: "cert.f.pre", group: "words", max: 80 },
    { key: "name", kind: "text", labelKey: "cert.f.name", group: "words", max: 60 },
    { key: "name2", kind: "text", labelKey: "evb.f.name2", group: "words", max: 60 },
    { key: "org", kind: "text", labelKey: "cert.f.org", group: "words", max: 80, hintKey: "cert.f.orgHint" },
    { key: "statement", kind: "text", labelKey: "cert.f.statement", group: "words", max: 260, lines: 3 },
    { key: "facts", kind: "rows", labelKey: "cert.f.facts", group: "words", langKey: "lang", kinds: ["custom"] },

    { key: "date", kind: "text", labelKey: "cert.f.date", group: "issue", max: 10, placeholder: "DD/MM/YYYY" },
    { key: "number", kind: "text", labelKey: "cert.f.number", group: "issue", max: 30, hintKey: "cert.f.numberHint" },
    { key: "sig1Name", kind: "text", labelKey: "cert.f.sig1Name", group: "issue", max: 50 },
    { key: "sig1Role", kind: "text", labelKey: "cert.f.sig1Role", group: "issue", max: 50 },
    { key: "sig1Image", kind: "image", labelKey: "cert.f.sigImage", group: "issue", hintKey: "cert.f.sigImageHint" },
    { key: "sig2On", kind: "switch", labelKey: "cert.f.sig2On", group: "issue" },
    { key: "sig2Name", kind: "text", labelKey: "cert.f.sig2Name", group: "issue", max: 50, when: (v) => v.sig2On !== false },
    { key: "sig2Role", kind: "text", labelKey: "cert.f.sig2Role", group: "issue", max: 50, when: (v) => v.sig2On !== false },
    { key: "sig2Image", kind: "image", labelKey: "cert.f.sigImage", group: "issue", when: (v) => v.sig2On !== false },
    { key: "seal", kind: "choice", labelKey: "cert.f.seal", group: "issue", options: [
      { value: "none", labelKey: "cert.seal.none" }, { value: "emboss", labelKey: "cert.seal.emboss" },
    ] },
    { key: "foot", kind: "choice", labelKey: "cert.f.foot", group: "issue", options: [
      { value: "legal", labelKey: "cert.foot.legal" }, { value: "everyday", labelKey: "cert.foot.everyday" }, { value: "none", labelKey: "cert.foot.none" },
    ] },
    { key: "qrs", kind: "qrs", labelKey: "tpl.f.qrs", group: "qr", langKey: "lang" },
  ],
  defaults: {
    kind: "training", style: "classic", size: "a4-land", lang: "en", font: "inter", scale: 100, nameWeight: "light", pattern: "scan-edge", silverName: false,
    heading: START.heading, pre: START.pre, name: "", name2: "", org: "", statement: START.statement, facts: factRows("training", "en"),
    date: today(), number: numberFor("training"),
    sig1Name: "", sig1Role: START.sig1, sig1Image: "", sig2On: true, sig2Name: "", sig2Role: START.sig2, sig2Image: "",
    seal: "none", foot: "legal",
    qrs: [] as TemplateItem[],
  },
  pages: [{ id: "front", draw: page }],
  qrRequests,
  fromPerson: (p: BcPerson, v: TemplateValues) => ({ name: nameIn(p, asLang(v.lang)) }),
  rekey: { kind: rekind },
  /* a style brings its designer's weight for the name */
  restyle: (v, style) => ((NEW_STYLES as readonly string[]).includes(style) ? { ...v, style, nameWeight: STYLE_LOOK[style as Style].nameWeight } : { ...v, style }),
  relang: (v, lang) => relang(v, lang),
  specKeys: (v) => [
    "cert.spec.paper",
    ...(v.style === "black" || v.style === "black-1" ? ["cert.spec.black"] : []),
    ...(!isV1(v) && isStyle("guilloche", "black")(v) ? ["cert.spec.guilloche"] : []),
    ...(v.silverName === true ? ["cert.spec.silverName"] : []),
    ...(isV1(v) ? [] : ["cert.spec.micro"]),
    ...(v.seal === "emboss" ? ["cert.spec.emboss"] : []),
    "cert.spec.number",
    ...(kindOf(v) === "warranty" ? ["cert.spec.warranty"] : []),
    ...(v.foot === "legal" ? ["cert.spec.legal"] : []),
  ],
  fillName: (v, t) => `${t(`cert.kind.${kindOf(v)}`)} · ${t(`cert.style.${isV1(v) ? String(v.style) : styleOf(v)}`)}`,
  forSaving: (v, keepPerson) => ({
    ...v, sig1Image: "", sig2Image: "", qrs: list(v, "qrs").map((q) => ({ ...q, image: "" })),
    ...(keepPerson ? {} : { name: "", name2: "", org: "" }),
  }),
  check: (v) => {
    if (!str(v, "name")) return "studio.needName";
    if (!str(v, "number")) return "cert.needNumber";
    for (const q of qrsOf(v)) {
      if (q.kind === "link" && !q.link.trim()) return "studio.needQrLink";
      if (isPictureQr(q) && !q.image) return "studio.needQrImage";
    }
    return null;
  },
};
