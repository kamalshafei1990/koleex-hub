/* ---------------------------------------------------------------------------
   Hiring post (plan step C15) — one opening, in pixels, saved as a picture.

   The book (ch. 125): "We're hiring · the city", the real title and the
   place, three to five lines on the work, the skills, experience and
   languages, one way to apply with a closing date, the logo. Never age,
   gender, religion, nationality or appearance; no exaggerated promises
   about pay, growth or perks; team photos only with consent; every
   applicant gets an answer. The owner's picks: job ad posts and stories
   (employees → recruitment), hiring among the company posts.
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import type { DrawContext, FieldDef, QrRequest, TemplateDef, TemplateValues } from "./types";
import { GREY_ON_INK, GREY_ON_WHITE, INK, Logo, Qr, WHITE, logoHeight, textWidth, wrap } from "./card/parts";
import { str, type Lang } from "./card/model";
import { Pattern, patternOptions } from "./patterns";
import {
  Bands, Edge, FullPhoto, Label, POST_LOOK, POST_PX, TopLogo, Txt, caps, choice, headline, headlineAbove,
  POST_EVERY_SIZE, oneOf, photoFields, postSafe, postSizeOf, readPost, startAlign, sx, NO_SHEET, captionOf, hashtags,
} from "./post-kit";

export const HIRE_STYLES = ["book", "light", "pattern", "photo", "big"] as const;
type Style = (typeof HIRE_STYLES)[number];
const styleOf = (v: TemplateValues): Style => oneOf(HIRE_STYLES, v.style, "book");
const TYPES = ["full", "part", "intern", "contract"] as const;
type JobType = (typeof TYPES)[number];

type L3 = Record<Lang, string>;
const HIRING: L3 = { en: "We're hiring", zh: "我们正在招聘", ar: "نحن نوظّف" };
const TYPE: Record<JobType, L3> = {
  full: { en: "Full time", zh: "全职", ar: "دوام كامل" },
  part: { en: "Part time", zh: "兼职", ar: "دوام جزئي" },
  intern: { en: "Internship", zh: "实习", ar: "تدريب" },
  contract: { en: "Contract", zh: "合同制", ar: "بعقد" },
};
const APPLY: L3 = { en: "Apply on", zh: "申请方式：", ar: "قدّم عبر" };
const BY: L3 = { en: "Closing", zh: "截止", ar: "آخر موعد" };
const WHERE: L3 = { en: "Place", zh: "地点", ar: "المكان" };
const KIND: L3 = { en: "Type", zh: "类型", ar: "النوع" };

/** The address a QR code opens: a link as it is, a site with https, an email as mailto. */
function applyUrl(apply: string): string {
  const a = apply.trim();
  if (!a) return "";
  if (/^https?:\/\//i.test(a) || /^mailto:/i.test(a)) return a;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a)) return `mailto:${a}`;
  return `https://${a}`;
}

function read(v: TemplateValues, ctx: DrawContext) {
  const base = readPost(v, ctx);
  const lang = base.lang;
  const city = str(v, "city");
  const apply = str(v, "apply") || "koleexgroup.com";
  return {
    ...base,
    city, region: str(v, "region"), apply, closing: str(v, "closing"), jobType: oneOf(TYPES, v.jobType, "full"),
    lines: str(v, "details").split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 5),
    label: base.label || [HIRING[lang], city].filter(Boolean).join(" · "),
    headline: str(v, "title") || { en: "Job title", zh: "职位名称", ar: "المسمى الوظيفي" }[lang],
    headline2: str(v, "region"),
    qr: v.qr !== false ? ctx.qrs.apply : undefined,
  };
}
type R = ReturnType<typeof read>;

/** The lines on the work: short, one per line, a small square before each. */
function Details({ r, x, y, width, fill, dot, size }: { r: R; x: number; y: number; width: number; fill: string; dot: string; size: number }) {
  const lh = size * 1.55;
  let yy = y;
  const nodes: ReactNode[] = [];
  r.lines.forEach((l, i) => {
    const parts = wrap(l, size, width - size * 1.2, 2, 400, r.font);
    parts.forEach((p, j) => {
      yy += j === 0 && i > 0 ? lh * 1.1 : j === 0 ? size : lh * 0.95;
      if (j === 0) nodes.push(<rect key={`d${i}`} x={r.rtl ? x - size * 0.42 : x} y={yy - size * 0.42} width={size * 0.42} height={size * 0.42} fill={dot} />);
      nodes.push(<Txt key={`${i}-${j}`} r={r} x={r.rtl ? x - size * 1.1 : x + size * 1.1} y={yy} size={size} fill={fill} align={startAlign(r)}>{p}</Txt>);
    });
  });
  return { node: <g>{nodes}</g>, bottom: yy + size * 0.4 };
}

/** One way to apply, the closing date — and the QR code at the end side. */
function Apply({ r, y, fill, dim, qrSize, x0, x1 }: { r: R; y: number; fill: string; dim: string; qrSize: number; x0?: number; x1?: number }) {
  const u = r.u, lang = r.lang;
  const a = x0 ?? r.M, b = x1 ?? r.W - r.M;
  const room = b - a - (r.qr ? qrSize + 30 * u : 0);
  const line = `${APPLY[lang]} ${r.apply}`;
  const s = Math.min(34 * u, (room * 34 * u) / Math.max(1, textWidth(line, 34 * u, 600, r.font)));
  return (
    <g>
      <Txt r={r} x={r.rtl ? b : a} y={y - (r.closing ? 44 * u : 0)} size={s} fill={fill} weight={600} align={startAlign(r)}>{line}</Txt>
      {r.closing ? <Txt r={r} x={r.rtl ? b : a} y={y} size={26 * u} fill={dim} align={startAlign(r)}>{`${BY[lang]} ${r.closing}`}</Txt> : null}
      {r.qr ? <Qr modules={r.qr} x={r.rtl ? a : b - qrSize} y={y - qrSize + 8 * u} size={qrSize} /> : null}
    </g>
  );
}

/* ── the styles ────────────────────────────────────────────────────────── */

function drawPost(v: TemplateValues, ctx: DrawContext): ReactNode {
  const r = read(v, ctx);
  const { W, H, u, M } = r;
  const style = styleOf(v);
  const lw = 220 * u;
  const hs = (r.story ? 96 : r.wide ? 64 : r.size === "square" ? 80 : 92) * u;
  const qrS = (r.wide ? 150 : 170) * u;
  const applyY = r.bottom - logoHeight(lw * 0.8) - 60 * u;

  switch (style) {
    case "book":
    case "light": {
      /* the book's job post: dark (or white), the facts, the lines, one way to apply */
      const dark = style === "book";
      const fg = dark ? WHITE : INK, dim = dark ? GREY_ON_INK : GREY_ON_WHITE, soft = dark ? "#D1D1D6" : "#3A3A3C";
      const colW = r.wide ? W * 0.58 : W - 2 * M;
      const lab = r.top + (r.story ? 60 : 30) * u;
      const h = headline(r, { x: sx(r, M), y: lab + 40 * u, width: colW, size: hs * 1.15, fill: fg, fill2: dim, align: startAlign(r) });
      const facts = [r.city && `${WHERE[r.lang]}: ${r.city}`, `${KIND[r.lang]}: ${TYPE[r.jobType][r.lang]}`].filter(Boolean).join("   ·   ");
      const d = Details({ r, x: sx(r, M), y: h.bottom + 110 * u, width: colW, fill: soft, dot: dark ? "#636366" : "#AEAEB2", size: (r.wide ? 30 : 38) * u });
      const ruleY = applyY - (r.closing ? 44 : 0) * u - 90 * u;
      return (
        <>
          <rect width={W} height={H} fill={dark ? INK : WHITE} />
          <Edge r={r} fill={fg} />
          <Label r={r} x={sx(r, M)} y={lab} fill={dim} align={startAlign(r)} max={colW} />
          {h.node}
          <Txt r={r} x={sx(r, M)} y={h.bottom + 36 * u} size={24 * u} fill={dim} weight={600} align={startAlign(r)} spacing={24 * u * 0.12}>{caps(facts)}</Txt>
          {d.node}
          {ruleY > d.bottom + 40 * u ? <rect x={M} y={ruleY} width={W - 2 * M} height={Math.max(1, 1.5 * u)} fill={dark ? "#3A3A3C" : "#D2D2D7"} /> : null}
          <Apply r={r} y={applyY} fill={fg} dim={dim} qrSize={qrS} />
          <Logo x={r.rtl ? W - M - lw * 0.8 : M} y={r.bottom - logoHeight(lw * 0.8)} width={lw * 0.8} fill={fg} />
        </>
      );
    }

    case "pattern": {
      const pw = W * (r.wide ? 0.26 : 0.3);
      const colW = W - pw - M * 1.4;
      const lab = r.top + logoHeight(lw) + (r.story ? 120 : 90) * u;
      const h = headline(r, { x: sx(r, M), y: lab + 34 * u, width: colW, size: hs * 0.92, fill: WHITE, fill2: GREY_ON_INK, align: startAlign(r) });
      const d = Details({ r, x: sx(r, M), y: h.bottom + 60 * u, width: colW, fill: "#D1D1D6", dot: "#636366", size: 30 * u });
      return (
        <>
          <rect width={W} height={H} fill={INK} />
          <Pattern id={r.pattern} area={{ x0: r.rtl ? 0 : W - pw, y0: 0, w: pw, h: H }} dark mirror={r.rtl} uid={`${r.uid}-hp`} />
          <Logo x={r.rtl ? W - M - lw : M} y={r.top} width={lw} fill={WHITE} />
          <Label r={r} x={sx(r, M)} y={lab} fill={GREY_ON_INK} align={startAlign(r)} max={colW} />
          {h.node}
          {d.node}
          <Apply r={r} y={r.bottom} fill={WHITE} dim={GREY_ON_INK} qrSize={qrS} x0={r.rtl ? pw + M * 0.4 : M} x1={r.rtl ? W - M : W - pw - M * 0.4} />
        </>
      );
    }

    case "photo": {
      /* the team at work (with their consent), the opening on the dark band */
      const colW = r.wide ? W * 0.6 : W - 2 * M;
      const h = headlineAbove(r, { x: sx(r, M), bottom: r.bottom - 130 * u, width: colW, size: hs * 0.9, fill: WHITE, fill2: "#E5E5EA", align: startAlign(r) });
      return (
        <>
          <rect width={W} height={H} fill="#1C1C1E" />
          <FullPhoto r={r} />
          <Bands r={r} top={r.top + 150 * u} bottomFrom={h.top - 220 * u} />
          <TopLogo r={r} fill={WHITE} />
          <Label r={r} x={sx(r, M)} y={h.top - 34 * u} fill="#D1D1D6" align={startAlign(r)} max={colW} />
          {h.node}
          <Apply r={r} y={r.bottom} fill={WHITE} dim="#D1D1D6" qrSize={qrS * 0.9} />
        </>
      );
    }

    default: {
      /* big — "We're hiring" as the picture, the opening under it */
      const colW = r.wide ? W * 0.56 : W - 2 * M;
      const bigS = Math.min((r.wide ? 150 : 190) * u, (colW * 190 * u) / Math.max(1, textWidth(HIRING[r.lang], 190 * u, 200, r.font)));
      const bigY = r.top + logoHeight(lw) + 120 * u + bigS * 0.8;
      const h = headline(r, { x: sx(r, M), y: bigY + 60 * u, width: colW, size: hs * 0.8, fill: WHITE, fill2: GREY_ON_INK, align: startAlign(r) });
      const d = r.wide ? null : Details({ r, x: sx(r, M), y: h.bottom + 50 * u, width: colW, fill: "#D1D1D6", dot: "#636366", size: 30 * u });
      return (
        <>
          <rect width={W} height={H} fill={INK} />
          <Edge r={r} fill={WHITE} />
          <TopLogo r={r} fill={WHITE} />
          <Txt r={r} x={sx(r, M)} y={bigY} size={bigS} fill={WHITE} weight={200} align={startAlign(r)} spacing={-bigS * 0.03}>{HIRING[r.lang]}</Txt>
          {h.node}
          {d?.node}
          {r.wide && r.lines.length ? Details({ r, x: sx(r, W * 0.6), y: bigY - bigS * 0.4, width: W * 0.4 - M, fill: "#D1D1D6", dot: "#636366", size: 26 * u }).node : null}
          <Apply r={r} y={r.bottom} fill={WHITE} dim={GREY_ON_INK} qrSize={qrS} />
          <Label r={r} x={sx(r, M)} y={r.top + logoHeight(lw) + 70 * u} fill={GREY_ON_INK} align={startAlign(r)} max={colW} text={r.city} />
        </>
      );
    }
  }
}

/* ── the template ──────────────────────────────────────────────────────── */

const isStyle = (...s: Style[]) => (v: TemplateValues) => s.includes(styleOf(v));

export const hiringPost: TemplateDef = {
  id: "hiring-post",
  itemKey: "recruitment",
  nameKey: "hire.name",
  digital: true,
  usesPeople: false,
  size: (v) => POST_PX[postSizeOf(v)],
  bleed: 0,
  safe: 72,
  safeFor: postSafe,
  everySize: POST_EVERY_SIZE,
  marks: false,
  fields: [
    choice("style", "tpl.f.style", "look", HIRE_STYLES, "hire.style"),
    ...POST_LOOK,
    { key: "pattern", kind: "choice", labelKey: "pat.field", group: "look", options: patternOptions(false), when: isStyle("pattern") },
    { key: "edge", kind: "switch", labelKey: "post.f.edge", group: "look", when: isStyle("book", "light", "big") },
    { key: "title", kind: "title", labelKey: "hire.f.title", group: "job", langKey: "lang" },
    { key: "region", kind: "text", labelKey: "hire.f.region", group: "job", max: 40, placeholder: "Middle East", hintKey: "hire.f.regionHint" },
    { key: "city", kind: "text", labelKey: "hire.f.city", group: "job", max: 40, placeholder: "Taizhou" },
    choice("jobType", "hire.f.type", "job", TYPES, "hire.type"),
    { key: "details", kind: "text", labelKey: "hire.f.details", group: "job", max: 400, lines: 5, hintKey: "hire.f.detailsHint", placeholder: "Advise garment factories on the right machines" },
    { key: "apply", kind: "text", labelKey: "hire.f.apply", group: "job", max: 80, placeholder: "koleexgroup.com/careers", hintKey: "hire.f.applyHint" },
    { key: "closing", kind: "text", labelKey: "hire.f.closing", group: "job", max: 16, placeholder: "31/10/2026" },
    { key: "qr", kind: "switch", labelKey: "hire.f.qr", group: "job" },
    { key: "label", kind: "text", labelKey: "post.f.label", group: "words", max: 48, hintKey: "hire.f.labelHint" },
    ...photoFields(isStyle("photo"), "hire.f.photo", "hire.f.photoHint"),
  ] as FieldDef[],
  defaults: {
    style: "book", size: "feed", lang: "en", pattern: "scan-edge", edge: true, logoAt: "start",
    title: "", titleKey: "", region: "", city: "Taizhou", jobType: "full", details: "", apply: "", closing: "", qr: true,
    label: "", web: false, photo: "", photoOn: "scene", photoScale: 100,
  },
  qrRequests: (v): QrRequest[] => {
    const url = applyUrl(str(v, "apply") || "koleexgroup.com");
    return v.qr !== false && url ? [{ id: "apply", text: url, level: "M" }] : [];
  },
  fillName: (v) => str(v, "title"),
  /* the job, where, the work in a few lines, how to apply (ch. 125) */
  caption: (v) => {
    const r = read(v, NO_SHEET);
    return captionOf(r.label, [r.headline, r.headline2].filter(Boolean).join(" — "), r.lines.map((l) => `· ${l}`).join("\n"), r.apply, hashtags("Hiring", "Careers"));
  },
  specKeys: (v) => [
    `post.spec.size.${postSizeOf(v)}`,
    "hire.spec.words",
    "hire.spec.never",
    "hire.spec.answer",
    ...(styleOf(v) === "photo" ? ["hire.spec.photo"] : []),
  ],
  check: (v) => {
    if (!str(v, "title")) return "hire.needTitle";
    if (!str(v, "details")) return "hire.needDetails";
    if (styleOf(v) === "photo" && !str(v, "photo")) return "post.needPhoto";
    return null;
  },
  forSaving: (v) => ({ ...v, photo: "" }),
  pages: [{ id: "post", draw: drawPost }],
};
