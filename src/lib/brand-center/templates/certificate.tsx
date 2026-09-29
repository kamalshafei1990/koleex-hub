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
   with silver print, and a silver seal. So: eight styles; each kind brings
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
import { Dots, GREY_ON_INK, GREY_ON_WHITE, INK, Logo, QrZone, WHITE, fit, logoHeight, textWidth, wrap, wrapBalanced } from "./card/parts";
import { nameIn } from "./person";

export const CERT_STYLES = ["book", "frame", "black", "band", "side", "dots", "minimal", "award"] as const;
type Style = (typeof CERT_STYLES)[number];
const styleOf = (v: TemplateValues): Style => ((CERT_STYLES as readonly string[]).includes(String(v.style)) ? (v.style as Style) : "book");

export const CERT_KINDS = ["training", "dealer", "agency", "installation", "warranty", "appreciation", "employee"] as const;
type Kind = (typeof CERT_KINDS)[number];
const kindOf = (v: TemplateValues): Kind => ((CERT_KINDS as readonly string[]).includes(String(v.kind)) ? (v.kind as Kind) : "training");

const SIZES: Record<string, { w: number; h: number }> = { "a4-land": { w: 297, h: 210 }, "a4-port": { w: 210, h: 297 }, "a3-land": { w: 420, h: 297 } };
const SILVER = ["#E5E5EA", "#FFFFFF", "#C7C7CC", "#8E8E93"];

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
const LABELS: Record<Lang, { date: string; number: string }> = {
  en: { date: "Date", number: "Certificate no." },
  zh: { date: "日期", number: "证书编号" },
  ar: { date: "التاريخ", number: "رقم الشهادة" },
};
const PLACEHOLDER: Record<Lang, string> = { en: "Full Name", zh: "姓名", ar: "الاسم" };

const today = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};
/** The issue date (D/M/Y) as a date — the legal name is the one of that day. */
function issued(v: TemplateValues): Date | null {
  const m = str(v, "date").match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12) : null;
}
const factRows = (kind: Kind, lang: Lang): TemplateItem[] =>
  WORDS[kind][lang].facts.map((label, i) => ({ id: `f${i}`, kind: "custom", label, value: "", on: true }));
const numberFor = (kind: Kind) => `${PREFIX[kind]}-${new Date().getFullYear()}-0001`;

/* ── reading the fill ──────────────────────────────────────────────────── */

function read(v: TemplateValues, ctx: DrawContext) {
  const lang = asLang(v.lang);
  const w = ctx.w, h = ctx.h;
  const foot = v.foot === "none" ? "none" : v.foot === "everyday" ? "everyday" : "legal";
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
    seal: v.seal === "silver" ? "silver" : v.seal === "emboss" ? "emboss" : "none",
    foot, footName: foot === "legal" ? legalNameEn(issued(v)) : EVERYDAY_NAME_EN,
    qrs: qrsOf(v),
  };
}
type R = ReturnType<typeof read>;

/* ── type ──────────────────────────────────────────────────────────────── */

function Txt({ r, x, y, size, children, fill, weight = 400, anchor = "middle", max, spacing, ltr }: {
  r: R; x: number; y: number; size: number; children: string; fill: string; weight?: number;
  anchor?: "start" | "middle" | "end"; max?: number; spacing?: number; ltr?: boolean;
}) {
  /* letter-spacing would break the joins of Arabic letters */
  const spaced = spacing && !ARABIC.test(children) ? spacing : undefined;
  return (
    <text x={x} y={y} textAnchor={anchor} direction={ltr ? "ltr" : r.rtl ? "rtl" : "ltr"} fill={fill}
      {...(max ? fit(children, size, max, weight, r.font) : {})}
      style={{ fontFamily: r.font, fontSize: size, fontWeight: weight, letterSpacing: spaced, unicodeBidi: "plaintext", fontVariantNumeric: "tabular-nums" }}>{children}</text>
  );
}
/** Capitals with air — the heading and every small label. Chinese and
 *  Arabic keep their own shapes. */
const ARABIC = /[\u0600-\u06FF]/;
const NOT_LATIN = /[\u0600-\u06FF\u2E80-\u9FFF]/;
const caps = (s: string) => (NOT_LATIN.test(s) ? s : s.toUpperCase());

interface Look { ink: string; sub: string; faint: string; nameFill?: string; accent: string; silverDefs?: boolean }

/** The body: the heading, the words before the name, the name (as large as
 *  it fits), the name in its own script, the organisation, the statement,
 *  the facts. Measured first, then placed between `top` and `bottom`. */
function Body({ r, x, top, bottom, width, align, look }: { r: R; x: number; top: number; bottom: number; width: number; align: "middle" | "start"; look: Look }) {
  const u = r.u;
  const lay = (y0: number) => {
    const nodes: ReactNode[] = [];
    let y = y0;
    const anchor = align;
    if (r.heading) {
      const s = (NOT_LATIN.test(r.heading) ? 6.2 : 4.2) * u;
      y += s;
      nodes.push(<Txt key="h" r={r} x={x} y={y} size={s} fill={look.sub} weight={600} anchor={anchor} max={width} spacing={s * 0.32}>{caps(r.heading)}</Txt>);
      y += 9 * u;
    }
    if (r.pre) { const s = 4.4 * u; y += s; nodes.push(<Txt key="p" r={r} x={x} y={y} size={s} fill={look.sub} anchor={anchor} max={width}>{r.pre}</Txt>); y += 5 * u; }
    /* the name: one line up to 16 mm, two balanced lines below 10 mm */
    const max = 16 * u * r.k, min = 10 * u * r.k;
    const w1 = textWidth(r.name, max, 700, r.font);
    let size = max, lines = [r.name];
    if (w1 > width) {
      size = (max * width) / w1;
      if (size < min && /\s/.test(r.name)) { size = max * 0.8; lines = wrapBalanced(r.name, size, width, 700, r.font); const wd = Math.max(...lines.map((l) => textWidth(l, size, 700, r.font))); if (wd > width) size = (size * width) / wd; }
    }
    lines.forEach((l, i) => { y += i === 0 ? size * 0.9 : size * 1.1; nodes.push(<Txt key={`n${i}`} r={r} x={x} y={y} size={size} fill={look.nameFill ?? look.ink} weight={700} anchor={anchor} max={width}>{l}</Txt>); });
    if (r.name2 && r.name2 !== r.name) { const s = 6.5 * u; y += s * 1.5; nodes.push(<Txt key="n2" r={r} x={x} y={y} size={s} fill={look.ink} anchor={anchor} max={width}>{r.name2}</Txt>); }
    if (r.org) { const s = 5 * u; y += s * 1.6; nodes.push(<Txt key="o" r={r} x={x} y={y} size={s} fill={look.ink} weight={500} anchor={anchor} max={width}>{r.org}</Txt>); }
    if (r.statement) {
      const s = 4.6 * u;
      const sw = Math.min(width, (r.tall ? 0.86 : 0.64) * r.w);
      y += 7 * u;
      wrap(r.statement, s, sw, 3, 400, r.font).forEach((l, i) => { y += i === 0 ? s : s * 1.45; nodes.push(<Txt key={`s${i}`} r={r} x={x} y={y} size={s} fill={look.sub} anchor={anchor} max={sw}>{l}</Txt>); });
    }
    if (r.facts.length) {
      y += 11 * u;
      const f = Facts({ r, x, y, width, align, look });
      nodes.push(<g key="facts">{f.node}</g>);
      y = f.bottom;
    }
    return { nodes, bottom: y };
  };
  const probe = lay(0).bottom;
  const y0 = top + Math.max(0, (bottom - top - probe) * 0.5);
  const done = lay(y0);
  return { node: <g>{done.nodes}</g>, bottom: done.bottom };
}

/** The facts: small capitals over the values, in columns; two rows when
 *  they do not fit across. */
function Facts({ r, x, y, width, align, look }: { r: R; x: number; y: number; width: number; align: "middle" | "start"; look: Look }) {
  const u = r.u;
  const ls = 2.7 * u, vs = 4.2 * u, gap = 12 * u;
  const cells = r.facts.map((f) => ({ label: caps(f.label.trim()), value: f.value.trim(), w: 0 }));
  for (const c of cells) c.w = Math.max(textWidth(c.label, ls, 600, r.font) + c.label.length * ls * 0.18, textWidth(c.value, vs, 500, r.font), 18 * u);
  const rows: (typeof cells)[] = [];
  let cur: typeof cells = [], used = 0;
  for (const c of cells) {
    if (cur.length && used + gap + c.w > width) { rows.push(cur); cur = []; used = 0; }
    used += (cur.length ? gap : 0) + c.w; cur.push(c);
  }
  if (cur.length) rows.push(cur);
  const nodes: ReactNode[] = [];
  let yy = y;
  rows.forEach((row, ri) => {
    const total = row.reduce((a, c) => a + c.w, 0) + gap * (row.length - 1);
    let cx = align === "middle" ? x - total / 2 : r.rtl ? x - total : x;
    const ordered = r.rtl ? [...row].reverse() : row;
    for (const c of ordered) {
      const mid = cx + c.w / 2;
      const anchor = align === "middle" ? "middle" : r.rtl ? "end" : "start";
      const tx = align === "middle" ? mid : r.rtl ? cx + c.w : cx;
      nodes.push(
        <g key={`${ri}-${c.label}`}>
          <Txt r={r} x={tx} y={yy + ls} size={ls} fill={look.faint} weight={600} anchor={anchor} max={c.w} spacing={ls * 0.18}>{c.label}</Txt>
          <Txt r={r} x={tx} y={yy + ls + 2.2 * u + vs} size={vs} fill={look.ink} weight={500} anchor={anchor} max={c.w}>{c.value}</Txt>
        </g>,
      );
      cx += c.w + gap;
    }
    yy += ls + 2.2 * u + vs + (ri < rows.length - 1 ? 7 * u : 0);
  });
  return { node: <g>{nodes}</g>, bottom: yy };
}

/** The signatures, the date and the number on one line: the value (or a
 *  scanned signature) over a rule, the label under it. */
function SignRow({ r, x0, x1, y, look, align = "middle" }: { r: R; x0: number; x1: number; y: number; look: Look; align?: "middle" | "start" }) {
  const u = r.u;
  const L = LABELS[r.lang];
  type Block = { key: string; value?: string; image?: string; label: string; name?: string; strong?: boolean };
  const blocks: Block[] = [
    ...r.sigs.map((s, i) => ({ key: `sig${i}`, image: s.image, name: s.name, label: s.role, strong: true })),
    { key: "date", value: r.date, label: L.date },
    { key: "no", value: r.number, label: L.number },
  ];
  const n = blocks.length;
  const bw = Math.min(60 * u, ((x1 - x0) - (n - 1) * 10 * u) / n);
  const span = align === "middle" ? x1 - x0 : n * bw + (n - 1) * 12 * u;
  const step = n > 1 ? (span - bw) / (n - 1) : 0;
  const ordered = r.rtl ? [...blocks].reverse() : blocks;
  const start = align === "middle" ? x0 : r.rtl ? x1 - span : x0;
  return (
    <g>
      {ordered.map((bk, i) => {
        const bx = start + i * step;
        const cx = bx + bw / 2;
        return (
          <g key={bk.key}>
            {bk.image ? <image href={bk.image} x={bx + 4 * u} y={y - 17 * u} width={bw - 8 * u} height={15.5 * u} preserveAspectRatio="xMidYMax meet" /> : null}
            {bk.value ? <Txt r={r} x={cx} y={y - 2 * u} size={4 * u} fill={look.ink} weight={500} max={bw} ltr>{bk.value}</Txt> : null}
            <rect x={bx} y={y} width={bw} height={bk.strong ? 0.3 : 0.2} fill={bk.strong ? look.ink : look.faint} />
            {bk.name ? <Txt r={r} x={cx} y={y + 5.2 * u} size={3.6 * u} fill={look.ink} weight={600} max={bw}>{bk.name}</Txt> : null}
            {bk.label ? <Txt r={r} x={cx} y={y + (bk.name ? 9.8 * u : 5.2 * u)} size={3 * u} fill={look.sub} max={bw}>{bk.label}</Txt> : null}
          </g>
        );
      })}
    </g>
  );
}

/** A silver foil seal: the group's name around the rim, the logo inside. */
function Seal({ r, cx, cy, rad, dark }: { r: R; cx: number; cy: number; rad: number; dark: boolean }) {
  if (r.seal !== "silver") return null;
  const id = `${r.uid}-seal`;
  const rt = rad * 0.76;
  const ring = `M ${cx - rt} ${cy} a ${rt} ${rt} 0 1 1 ${rt * 2} 0 a ${rt} ${rt} 0 1 1 ${-rt * 2} 0`;
  const lw = rad * 0.92;
  const words = `${KOLEEX_COMPANY.tagline.replace(/\.$/, "")}  ·  KOLEEX INTERNATIONAL GROUP  ·  `;
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">{SILVER.map((c, i) => <stop key={c} offset={[0, 0.35, 0.62, 1][i]} stopColor={c} />)}</linearGradient>
        <path id={`${id}-p`} d={ring} />
      </defs>
      <circle cx={cx} cy={cy} r={rad} fill={`url(#${id}-g)`} />
      <circle cx={cx} cy={cy} r={rad * 0.95} fill="none" stroke="#8E8E93" strokeWidth={0.2} />
      <circle cx={cx} cy={cy} r={rad * 0.58} fill={dark ? INK : WHITE} stroke="#8E8E93" strokeWidth={0.2} />
      <text fill="#3A3A3C" style={{ fontFamily: r.font, fontSize: rad * 0.13, fontWeight: 600, letterSpacing: rad * 0.02 }}>
        <textPath href={`#${id}-p`} textLength={2 * Math.PI * rt * 0.98} lengthAdjust="spacing">{words}</textPath>
      </text>
      <Logo x={cx - lw / 2} y={cy - logoHeight(lw) / 2} width={lw} fill={dark ? WHITE : INK} />
    </g>
  );
}

/** The foot: the black strip with the legal name (English and Chinese) and
 *  the grey tagline — the house strips of every Koleex document — or the
 *  everyday name. Returns its top. */
function Foot({ r, dark }: { r: R; dark: boolean }) {
  const u = r.u;
  if (r.foot === "none") return { node: null as ReactNode, top: r.b + r.h };
  const s = 2.9 * u;
  if (dark) {
    /* inside the black card's silver frame (10 mm in) */
    const top = r.b + r.h - 26 * u;
    return {
      top,
      node: (
        <g>
          <rect x={r.b + 30 * u} y={top} width={r.w - 60 * u} height={0.2} fill="#48484A" />
          <Txt r={r} x={r.b + r.w / 2} y={top + 6 * u} size={s} fill={GREY_ON_INK} weight={600} spacing={s * 0.06} ltr max={r.w - 40 * u}>
            {r.foot === "legal" ? `${r.footName}   ${KOLEEX_COMPANY.zh}` : r.footName}
          </Txt>
          <Txt r={r} x={r.b + r.w / 2} y={top + 10.5 * u} size={s * 0.9} fill="#636366" weight={600} spacing={s * 0.3} ltr>{KOLEEX_COMPANY.tagline}</Txt>
        </g>
      ),
    };
  }
  const bh = 8 * u, gh = 6 * u;
  const top = r.b + r.h - bh - gh;
  const pad = 14 * u;
  return {
    top,
    node: (
      <g>
        <rect x={0} y={top} width={r.W} height={bh} fill={INK} />
        {r.foot === "legal" ? (
          <>
            <Txt r={r} x={r.b + pad} y={top + bh / 2 + s * 0.36} size={s} fill={WHITE} weight={600} anchor="start" spacing={s * 0.05} ltr max={r.w * 0.55}>{r.footName}</Txt>
            <Txt r={r} x={r.b + r.w - pad} y={top + bh / 2 + s * 0.36} size={s} fill={WHITE} weight={600} anchor="end" ltr max={r.w * 0.38}>{KOLEEX_COMPANY.zh}</Txt>
          </>
        ) : (
          <>
            <Txt r={r} x={r.b + pad} y={top + bh / 2 + s * 0.36} size={s} fill={WHITE} weight={600} anchor="start" spacing={s * 0.05} ltr>{r.footName}</Txt>
            <Txt r={r} x={r.b + r.w - pad} y={top + bh / 2 + s * 0.36} size={s} fill={WHITE} anchor="end" ltr>{KOLEEX_COMPANY.web}</Txt>
          </>
        )}
        <rect x={0} y={top + bh} width={r.W} height={r.H - top - bh} fill="#F5F5F7" />
        <Txt r={r} x={r.b + r.w / 2} y={top + bh + gh / 2 + s * 0.34} size={s * 0.9} fill={GREY_ON_WHITE} weight={600} spacing={s * 0.32} ltr>{KOLEEX_COMPANY.tagline}</Txt>
      </g>
    ),
  };
}

/** QR codes (a link to check the certificate, the website …) in a corner. */
function Codes({ r, x, y, size, look }: { r: R; x: number; y: number; size: number; look: Look }) {
  if (!r.qrs.length) return null;
  const n = r.qrs.length;
  return <QrZone items={r.qrs} codes={r.codes} font={r.font} captionFill={look.sub} max={size} zone={{ x, y, w: n * size + (n - 1) * 3 * r.u, h: size + 3 * r.u, dir: "row", align: "start" }} />;
}

/* ── the eight styles ──────────────────────────────────────────────────── */

const LIGHT: Look = { ink: INK, sub: GREY_ON_WHITE, faint: "#8E8E93", accent: INK };

function page(v: TemplateValues, ctx: DrawContext): ReactNode {
  const r = read(v, ctx);
  const { b, w, h, W, H, u, tall } = r;
  const cx = b + w / 2;
  const style = styleOf(v);
  const sealR = 17 * u;
  const qrSize = 18 * u;

  if (style === "black") {
    /* Black card, silver print: the white logo, silver heading and name. */
    const look: Look = { ink: WHITE, sub: "#AEAEB2", faint: "#8E8E93", nameFill: `url(#${r.uid}-silver)`, accent: WHITE };
    const foot = Foot({ r, dark: true });
    const lw = (tall ? 0.34 : 0.2) * w;
    const logoY = b + 22 * u;
    const signY = foot.top - 18 * u;
    const reserve = tall && r.seal === "silver" ? 2 * sealR + 22 * u : 26 * u;
    const body = Body({ r, x: cx, top: logoY + logoHeight(lw) + 12 * u, bottom: signY - reserve, width: w * 0.78, align: "middle", look });
    return (
      <>
        <rect x={0} y={0} width={W} height={H} fill={INK} />
        <defs><linearGradient id={`${r.uid}-silver`} x1="0" y1="0" x2="1" y2="1">{SILVER.map((c, i) => <stop key={c} offset={[0, 0.35, 0.62, 1][i]} stopColor={c} />)}</linearGradient></defs>
        <rect x={b + 10 * u} y={b + 10 * u} width={w - 20 * u} height={h - 20 * u} fill="none" stroke={`url(#${r.uid}-silver)`} strokeWidth={0.35} />
        <Logo x={cx - lw / 2} y={logoY} width={lw} fill={WHITE} />
        {body.node}
        <SignRow r={r} x0={b + (tall ? 20 : 48) * u} x1={b + w - (tall ? 20 : 48) * u} y={signY} look={look} />
        <Seal r={r} cx={tall ? cx : b + w - 34 * u} cy={tall ? signY - 36 * u : b + 34 * u} rad={sealR} dark />
        <Codes r={r} x={b + 16 * u} y={b + 16 * u} size={qrSize} look={look} />
        {foot.node}
      </>
    );
  }

  if (style === "side" && !tall) {
    /* A black panel on the start side with the logo and the kind; the
       certificate left-aligned on white. */
    const pw = 0.3 * w;
    const panelX = r.rtl ? b + w - pw : 0;
    const panelW = r.rtl ? W - panelX : b + pw;
    const colX = r.rtl ? b + 16 * u : b + pw + 18 * u;
    const colW = w - pw - 34 * u;
    const start = r.rtl ? colX + colW : colX;
    const foot = Foot({ r, dark: false });
    const signY = foot.top - 24 * u;
    const lw = pw - 30 * u;
    const pcx = panelX + panelW / 2;
    const body = Body({ r, x: start, top: b + 18 * u, bottom: signY - 24 * u, width: colW, align: "start", look: LIGHT });
    return (
      <>
        <rect x={0} y={0} width={W} height={H} fill={WHITE} />
        <rect x={panelX} y={0} width={panelW} height={foot.top} fill={INK} />
        <Logo x={pcx - lw / 2} y={b + 24 * u} width={lw} fill={WHITE} />
        <Seal r={r} cx={pcx} cy={foot.top - 40 * u} rad={sealR} dark />
        {body.node}
        <SignRow r={r} x0={colX} x1={colX + colW} y={signY} look={LIGHT} align="start" />
        <Codes r={r} x={pcx - qrSize / 2} y={b + 24 * u + logoHeight(lw) + 16 * u} size={qrSize} look={{ ...LIGHT, sub: GREY_ON_INK }} />
        {foot.node}
      </>
    );
  }

  if (style === "minimal") {
    /* Swiss: the logo and the heading on the top line, the name large from
       the start edge, a hairline, the facts; signatures at the foot. */
    const m = 20 * u;
    const start = r.rtl ? b + w - m : b + m;
    const foot = Foot({ r, dark: false });
    const signY = foot.top - 22 * u;
    const lw = (tall ? 0.3 : 0.17) * w;
    const bodyR = { ...r, heading: "" };
    const body = Body({ r: bodyR, x: start, top: b + m + logoHeight(lw) + 16 * u, bottom: signY - 26 * u, width: w - 2 * m, align: "start", look: LIGHT });
    return (
      <>
        <rect x={0} y={0} width={W} height={H} fill={WHITE} />
        <Logo x={r.rtl ? b + w - m - lw : b + m} y={b + m} width={lw} fill={INK} />
        {r.heading ? <Txt r={r} x={r.rtl ? b + m : b + w - m} y={b + m + logoHeight(lw) * 0.85} size={3.6 * u} fill={INK} weight={600} anchor={r.rtl ? "start" : "end"} spacing={3.6 * u * 0.3} max={w * 0.45}>{caps(r.heading)}</Txt> : null}
        <rect x={b + m} y={b + m + logoHeight(lw) + 7 * u} width={w - 2 * m} height={0.25} fill={INK} />
        {body.node}
        <SignRow r={r} x0={b + m} x1={b + w - m} y={signY} look={LIGHT} align="start" />
        <Seal r={r} cx={r.rtl ? b + m + sealR : b + w - m - sealR} cy={signY - sealR - 12 * u} rad={sealR} dark={false} />
        <Codes r={r} x={r.rtl ? b + m : b + w - m - qrSize * r.qrs.length} y={signY - qrSize - 14 * u} size={qrSize} look={LIGHT} />
        {foot.node}
      </>
    );
  }

  /* The centred family: book, frame, band, dots, award (and side on a
     portrait page, which becomes a band). */
  const foot = Foot({ r, dark: false });
  const signY = foot.top - (style === "frame" ? 30 : tall ? 26 : 22) * u;
  const nodes: ReactNode[] = [<rect key="bg" x={0} y={0} width={W} height={H} fill={WHITE} />];
  let top: number;
  let look = LIGHT;
  let bodyR = r;
  const lwBook = (tall ? 0.32 : 0.2) * w;

  if (style === "band" || (style === "side" && tall)) {
    const bandH = (tall ? 0.16 : 0.22) * h;
    const lw = (tall ? 0.3 : 0.18) * w;
    nodes.push(<rect key="band" x={0} y={0} width={W} height={b + bandH} fill={INK} />);
    nodes.push(<Logo key="logo" x={r.rtl ? b + w - 18 * u - lw : b + 18 * u} y={b + bandH / 2 - logoHeight(lw) / 2} width={lw} fill={WHITE} />);
    if (r.heading) nodes.push(<Txt key="head" r={r} x={r.rtl ? b + 18 * u : b + w - 18 * u} y={b + bandH / 2 + 1.5 * u} size={4.2 * u} fill={WHITE} weight={600} anchor={r.rtl ? "start" : "end"} spacing={4.2 * u * 0.3} max={w * 0.5}>{caps(r.heading)}</Txt>);
    bodyR = { ...r, heading: "" };
    top = b + bandH + 14 * u;
  } else if (style === "dots") {
    const bandH = (tall ? 0.2 : 0.26) * h;
    const lw = (tall ? 0.3 : 0.2) * w;
    const lh = logoHeight(lw);
    const ly = b + bandH / 2 - lh / 2 + 2 * u;
    const px = lw / 2 + lh * 1.2, py = lh * 1.2;
    nodes.push(<rect key="band" x={0} y={0} width={W} height={b + bandH} fill={INK} />);
    nodes.push(<Dots key="dots" area={{ x: 0, y: 0, w: W, h: b + bandH }} pitch={3.2 * u} r={0.55 * u} fill="#4D4D50" origin={{ x: cx, y: ly + lh / 2 }} uid={`${r.uid}-d`} />);
    nodes.push(<rect key="panel" x={cx - px} y={ly + lh / 2 - py - lh / 2} width={px * 2} height={py * 2 + lh} fill={INK} />);
    nodes.push(<Logo key="logo" x={cx - lw / 2} y={ly} width={lw} fill={WHITE} />);
    top = b + bandH + 12 * u;
  } else if (style === "award") {
    /* An honour: the heading large and spaced, the name huge in silver-grey
       over a silver rule, the seal in the middle of the foot. */
    look = { ...LIGHT, nameFill: INK };
    nodes.push(<defs key="defs"><linearGradient id={`${r.uid}-silver`} x1="0" y1="0" x2="1" y2="0">{SILVER.map((c, i) => <stop key={c} offset={[0, 0.35, 0.62, 1][i]} stopColor={c} />)}</linearGradient></defs>);
    const lw = (tall ? 0.24 : 0.13) * w;
    nodes.push(<Logo key="logo" x={cx - lw / 2} y={b + 20 * u} width={lw} fill={INK} />);
    if (r.heading) {
      const s = 9 * u;
      nodes.push(<Txt key="head" r={r} x={cx} y={b + 20 * u + logoHeight(lw) + 22 * u} size={s} fill={INK} weight={300} spacing={s * 0.22} max={w * 0.86}>{caps(r.heading)}</Txt>);
      nodes.push(<rect key="rule" x={cx - 30 * u} y={b + 20 * u + logoHeight(lw) + 29 * u} width={60 * u} height={0.8 * u} fill={`url(#${r.uid}-silver)`} />);
    }
    bodyR = { ...r, heading: "" };
    top = b + 20 * u + logoHeight(lw) + 34 * u;
  } else {
    /* book and frame: the logo centred at the top (ch. 99) */
    if (style === "frame") {
      nodes.push(<rect key="f1" x={b + 9 * u} y={b + 9 * u} width={w - 18 * u} height={foot.top - b - 18 * u + (r.foot === "none" ? 9 * u : 0)} fill="none" stroke={INK} strokeWidth={0.5} />);
      nodes.push(<rect key="f2" x={b + 11.5 * u} y={b + 11.5 * u} width={w - 23 * u} height={foot.top - b - 23 * u + (r.foot === "none" ? 9 * u : 0)} fill="none" stroke={INK} strokeWidth={0.2} />);
    }
    nodes.push(<Logo key="logo" x={cx - lwBook / 2} y={b + (style === "frame" ? 26 : 22) * u} width={lwBook} fill={INK} />);
    top = b + (style === "frame" ? 26 : 22) * u + logoHeight(lwBook) + 14 * u;
  }

  const bodyW = w * (tall ? 0.8 : 0.72);
  const sealCentred = style === "award" || tall;
  const reserve = sealCentred && r.seal === "silver" ? 2 * sealR + 22 * u : 24 * u;
  const body = Body({ r: bodyR, x: cx, top, bottom: signY - reserve, width: bodyW, align: "middle", look });
  nodes.push(<g key="body">{body.node}</g>);
  const sx = tall ? 20 : style === "award" ? 40 : 48;
  nodes.push(<SignRow key="sign" r={r} x0={b + sx * u} x1={b + w - sx * u} y={signY} look={look} />);
  if (sealCentred) nodes.push(<Seal key="seal" r={r} cx={cx} cy={signY - sealR - 12 * u} rad={sealR} dark={false} />);
  else nodes.push(<Seal key="seal" r={r} cx={b + w - 38 * u} cy={b + (style === "band" || style === "dots" ? h * 0.26 + 26 * u : 36 * u)} rad={sealR} dark={false} />);
  nodes.push(<Codes key="qr" r={r} x={b + (style === "frame" ? 20 : 16) * u} y={foot.top - qrSize - (style === "frame" ? 18 : 12) * u} size={qrSize} look={look} />);
  nodes.push(<g key="foot">{foot.node}</g>);
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
    style: kind === "appreciation" || kind === "employee" ? (styleOf(v) === "book" ? "award" : styleOf(v)) : styleOf(v),
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
      { value: "none", labelKey: "cert.seal.none" }, { value: "silver", labelKey: "cert.seal.silver" }, { value: "emboss", labelKey: "cert.seal.emboss" },
    ] },
    { key: "foot", kind: "choice", labelKey: "cert.f.foot", group: "issue", options: [
      { value: "legal", labelKey: "cert.foot.legal" }, { value: "everyday", labelKey: "cert.foot.everyday" }, { value: "none", labelKey: "cert.foot.none" },
    ] },
    { key: "qrs", kind: "qrs", labelKey: "tpl.f.qrs", group: "qr", langKey: "lang" },
  ],
  defaults: {
    kind: "training", style: "book", size: "a4-land", lang: "en", font: "inter", scale: 100,
    heading: START.heading, pre: START.pre, name: "", name2: "", org: "", statement: START.statement, facts: factRows("training", "en"),
    date: today(), number: numberFor("training"),
    sig1Name: "", sig1Role: START.sig1, sig1Image: "", sig2On: true, sig2Name: "", sig2Role: START.sig2, sig2Image: "",
    seal: "silver", foot: "legal",
    qrs: [] as TemplateItem[],
  },
  pages: [{ id: "front", draw: page }],
  qrRequests,
  fromPerson: (p: BcPerson, v: TemplateValues) => ({ name: nameIn(p, asLang(v.lang)) }),
  rekey: { kind: rekind },
  relang: (v, lang) => relang(v, lang),
  specKeys: (v) => [
    "cert.spec.paper",
    ...(isStyle("black")(v) ? ["cert.spec.black"] : []),
    ...(v.seal === "silver" ? ["cert.spec.seal"] : v.seal === "emboss" ? ["cert.spec.emboss"] : []),
    "cert.spec.number",
    ...(kindOf(v) === "warranty" ? ["cert.spec.warranty"] : []),
    ...(v.foot === "legal" ? ["cert.spec.legal"] : []),
  ],
  fillName: (v, t) => `${t(`cert.kind.${kindOf(v)}`)} · ${t(`cert.style.${styleOf(v)}`)}`,
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
