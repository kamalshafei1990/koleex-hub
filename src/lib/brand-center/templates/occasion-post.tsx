/* ---------------------------------------------------------------------------
   Occasion post (plan step C15) — a greeting for the seasons and holidays of
   our markets, and the notices that go with them (offices closed, the last
   day to order before a holiday), in pixels, saved as a picture.

   The owner's occasions (workshop → occasions: global and company days,
   China, Egypt / Middle East / North Africa, South Asia, other markets) and
   kits (Ramadan & Eid: a white occasion symbol on black, black and silver
   only; Spring Festival: Chinese red allowed as the one accent). The book:
   ch. 57 (one white object, up to half the layout, never behind the logo;
   no coloured symbols, flags, clip art or landmarks), ch. 80 (the Occasion
   post "Eid Mubarak / from all of us."), ch. 124 (the season's colours
   belong to the gift; the KOLEEX card stays black and white — the logo is
   never gold or red). KOLEEX is 2D: flat objects, a soft glow at most.
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import type { DrawContext, FieldDef, TemplateDef, TemplateValues } from "./types";
import { GREY_ON_INK, GREY_ON_WHITE, INK, Logo, WHITE, logoHeight, textWidth } from "./card/parts";
import { num, str, type Lang } from "./card/model";
import { Pattern } from "./patterns";
import { OBJECTS, OccasionObject, type OccasionObject as Obj } from "./occasion-objects";
import {
  Edge, Label, POST_LOOK, POST_PX, TopLogo, Txt, caps, choice, endAlign, headline, headlineAbove,
  POST_EVERY_SIZE, oneOf, place, postSafe, postSizeOf, readPost, startAlign, sx, NO_SHEET, captionOf, hashtags,
} from "./post-kit";

export const OCC_STYLES = ["object", "object-light", "aura", "type", "notice"] as const;
type Style = (typeof OCC_STYLES)[number];
const styleOf = (v: TemplateValues): Style => oneOf(OCC_STYLES, v.style, "object");

type L3 = Record<Lang, string>;
/** The occasions the owner chose — the object each one starts with, its
 *  name (the label) and its greeting. */
const OCC: Record<string, { obj: Obj; name: L3; greet: L3; red?: boolean }> = {
  "new-year": { obj: "burst", name: { en: "New Year", zh: "新年", ar: "رأس السنة" }, greet: { en: "Happy New Year", zh: "新年快乐", ar: "سنة جديدة سعيدة" } },
  anniversary: { obj: "none", name: { en: "Anniversary", zh: "周年纪念", ar: "الذكرى السنوية" }, greet: { en: "Thank you for the journey", zh: "感谢一路同行", ar: "شكرًا على المشوار" } },
  "womens-day": { obj: "flower", name: { en: "International Women's Day", zh: "国际妇女节", ar: "يوم المرأة العالمي" }, greet: { en: "Happy Women's Day", zh: "妇女节快乐", ar: "يوم المرأة العالمي" } },
  "labour-day": { obj: "gear", name: { en: "Labour Day", zh: "劳动节", ar: "عيد العمال" }, greet: { en: "Happy Labour Day", zh: "劳动节快乐", ar: "عيد عمال سعيد" } },
  christmas: { obj: "tree", name: { en: "Christmas", zh: "圣诞节", ar: "عيد الميلاد" }, greet: { en: "Merry Christmas", zh: "圣诞快乐", ar: "عيد ميلاد مجيد" } },
  "environment-day": { obj: "leaf", name: { en: "World Environment Day", zh: "世界环境日", ar: "اليوم العالمي للبيئة" }, greet: { en: "One planet, one future", zh: "同一个地球，同一个未来", ar: "كوكب واحد، مستقبل واحد" } },
  "spring-festival": { obj: "lantern", red: true, name: { en: "Spring Festival", zh: "春节", ar: "عيد الربيع الصيني" }, greet: { en: "Happy Spring Festival", zh: "新春快乐", ar: "عام صيني جديد سعيد" } },
  "lantern-festival": { obj: "lantern", red: true, name: { en: "Lantern Festival", zh: "元宵节", ar: "مهرجان الفوانيس" }, greet: { en: "Happy Lantern Festival", zh: "元宵节快乐", ar: "مهرجان فوانيس سعيد" } },
  "dragon-boat": { obj: "wave", name: { en: "Dragon Boat Festival", zh: "端午节", ar: "مهرجان قوارب التنين" }, greet: { en: "Happy Dragon Boat Festival", zh: "端午安康", ar: "مهرجان قوارب التنين سعيد" } },
  "mid-autumn": { obj: "moon", name: { en: "Mid-Autumn Festival", zh: "中秋节", ar: "عيد منتصف الخريف" }, greet: { en: "Happy Mid-Autumn Festival", zh: "中秋快乐", ar: "عيد منتصف الخريف سعيد" } },
  "national-day-cn": { obj: "burst", name: { en: "National Day · Golden Week", zh: "国庆节", ar: "العيد الوطني الصيني" }, greet: { en: "Happy National Day", zh: "国庆快乐", ar: "عيد وطني سعيد" } },
  ramadan: { obj: "fanous", name: { en: "Ramadan", zh: "斋月", ar: "رمضان" }, greet: { en: "Ramadan Kareem", zh: "斋月吉祥", ar: "رمضان كريم" } },
  "eid-fitr": { obj: "crescent", name: { en: "Eid al-Fitr", zh: "开斋节", ar: "عيد الفطر" }, greet: { en: "Eid Mubarak", zh: "开斋节快乐", ar: "عيد فطر مبارك" } },
  "eid-adha": { obj: "crescent", name: { en: "Eid al-Adha", zh: "古尔邦节", ar: "عيد الأضحى" }, greet: { en: "Eid al-Adha Mubarak", zh: "古尔邦节快乐", ar: "عيد أضحى مبارك" } },
  "islamic-new-year": { obj: "crescent", name: { en: "Islamic New Year", zh: "伊斯兰新年", ar: "رأس السنة الهجرية" }, greet: { en: "Happy Islamic New Year", zh: "伊斯兰新年快乐", ar: "عام هجري سعيد" } },
  "coptic-christmas": { obj: "tree", name: { en: "Coptic Christmas", zh: "科普特圣诞节", ar: "عيد الميلاد المجيد" }, greet: { en: "Merry Christmas", zh: "圣诞快乐", ar: "عيد ميلاد مجيد" } },
  "sham-el-nessim": { obj: "flower", name: { en: "Sham El-Nessim", zh: "闻风节", ar: "شم النسيم" }, greet: { en: "Happy Sham El-Nessim", zh: "闻风节快乐", ar: "شم نسيم سعيد" } },
  "national-day": { obj: "burst", name: { en: "National Day", zh: "国庆日", ar: "العيد الوطني" }, greet: { en: "Happy National Day", zh: "国庆日快乐", ar: "عيد وطني سعيد" } },
  diwali: { obj: "flame", name: { en: "Diwali", zh: "排灯节", ar: "ديوالي" }, greet: { en: "Happy Diwali", zh: "排灯节快乐", ar: "ديوالي سعيد" } },
  "pohela-boishakh": { obj: "flower", name: { en: "Pohela Boishakh", zh: "孟加拉新年", ar: "رأس السنة البنغالية" }, greet: { en: "Shubho Noboborsho", zh: "孟加拉新年快乐", ar: "سنة بنغالية سعيدة" } },
  nowruz: { obj: "flower", name: { en: "Nowruz", zh: "诺鲁孜节", ar: "النوروز" }, greet: { en: "Happy Nowruz", zh: "诺鲁孜节快乐", ar: "نوروز سعيد" } },
};
export const OCCASIONS = Object.keys(OCC);
const occOf = (v: TemplateValues) => (OCC[String(v.occasion)] ? String(v.occasion) : "eid-fitr");
const PURPOSES = ["greet", "closed", "cutoff"] as const;
type Purpose = (typeof PURPOSES)[number];
const purposeOf = (v: TemplateValues): Purpose => oneOf(PURPOSES, v.purpose, "greet");
const FROM_US: L3 = { en: "From all of us.", zh: "全体同仁敬贺。", ar: "مع أطيب التمنيات." };
const CHINESE_RED = "#C0272D";

function autoWords(p: Purpose, occ: string, lang: Lang, d: { from: string; to: string; back: string; cutoff: string; years: number }) {
  const o = OCC[occ];
  if (p === "closed") return {
    label: { en: "Holiday notice", zh: "放假通知", ar: "إشعار إجازة" }[lang],
    one: { en: "Our offices are closed.", zh: "办公室放假。", ar: "مكاتبنا في إجازة." }[lang],
    two: [d.from && d.to ? `${d.from} – ${d.to}` : d.from || d.to, d.back && { en: `back on ${d.back}`, zh: `${d.back} 恢复办公`, ar: `نعود يوم ${d.back}` }[lang]].filter(Boolean).join(" · "),
  };
  if (p === "cutoff") return {
    label: { en: "Shipping notice", zh: "发货通知", ar: "إشعار شحن" }[lang],
    one: d.cutoff ? { en: `Order before ${d.cutoff}.`, zh: `请于 ${d.cutoff} 前下单。`, ar: `اطلب قبل ${d.cutoff}.` }[lang] : { en: "Order early.", zh: "请提前下单。", ar: "اطلب مبكرًا." }[lang],
    two: { en: "to ship before the holiday.", zh: "以便节前发货。", ar: "ليُشحن طلبك قبل الإجازة." }[lang],
  };
  if (occ === "anniversary") return {
    label: o.name[lang],
    one: d.years ? { en: `Thank you for ${d.years} years.`, zh: `感谢 ${d.years} 年同行。`, ar: `شكرًا على ${d.years} سنة.` }[lang] : o.greet[lang],
    two: FROM_US[lang],
  };
  return { label: o.name[lang], one: o.greet[lang], two: FROM_US[lang] };
}

function read(v: TemplateValues, ctx: DrawContext) {
  const base = readPost(v, ctx);
  const occ = occOf(v);
  const purpose = purposeOf(v);
  const d = { from: str(v, "from"), to: str(v, "to"), back: str(v, "back"), cutoff: str(v, "cutoff"), years: Math.round(num(v, "years", 0)) };
  const auto = autoWords(purpose, occ, base.lang, d);
  const obj = oneOf(OBJECTS, v.object, OCC[occ].obj);
  return {
    ...base, ...d, occ, purpose, obj,
    red: v.red === true && OCC[occ].red === true,
    label: base.label || auto.label, headline: base.headline || auto.one, headline2: base.headline2 || auto.two, typed2: base.headline2,
    big: occ === "anniversary" && d.years ? String(d.years) : str(v, "year"),
  };
}
type R = ReturnType<typeof read>;

/** The object — or, for a year or an anniversary, its number in Light. */
function Mark({ r, cx, cy, size, dark }: { r: R; cx: number; cy: number; size: number; dark: boolean }) {
  const fill = r.red ? CHINESE_RED : dark ? WHITE : INK;
  if (r.big && (r.obj === "none" || r.occ === "anniversary" || r.occ === "new-year")) {
    const room = Math.min(size * 1.5, r.W - 2 * r.M);
    const s = Math.min(size * 0.9, (room * size * 0.9) / Math.max(1, textWidth(r.big, size * 0.9, 200, r.font)));
    return <Txt r={r} x={cx} y={cy + s * 0.36} size={s} fill={fill} weight={200} align="center" spacing={-s * 0.03} tabular>{r.big}</Txt>;
  }
  return <OccasionObject kind={r.obj} cx={cx} cy={cy} size={size} fill={fill} ground={dark ? INK : WHITE} dim={dark ? "#636366" : "#AEAEB2"} uid={`${r.uid}-o`} glow={dark} />;
}

/** Dates in a hairline grid (the notices). */
function Dates({ r, x, y, width, dark }: { r: R; x: number; y: number; width: number; dark: boolean }) {
  const lang = r.lang;
  const cells = r.purpose === "cutoff"
    ? [{ k: { en: "Last order", zh: "最后下单", ar: "آخر طلب" }[lang], v: r.cutoff }]
    : [
      { k: { en: "Closed", zh: "放假", ar: "الإجازة" }[lang], v: r.from && r.to ? `${r.from} – ${r.to}` : r.from || r.to },
      { k: { en: "Back on", zh: "恢复办公", ar: "نعود يوم" }[lang], v: r.back },
    ];
  const shown = cells.filter((c) => c.v);
  if (!shown.length) return null;
  const u = r.u, cw = width / shown.length, line = dark ? "#3A3A3C" : "#D2D2D7";
  return (
    <g>
      <rect x={x} y={y} width={width} height={Math.max(1, 1.5 * u)} fill={line} />
      {shown.map((c, i) => {
        const x0 = r.rtl ? x + width - (i + 1) * cw : x + i * cw;
        const pad = i > 0 ? 24 * u : 0;
        const tx = r.rtl ? x0 + cw - pad : x0 + pad;
        const vs = Math.min(44 * u, ((cw - pad - 16 * u) * 44 * u) / Math.max(1, textWidth(c.v, 44 * u, 600, r.font)));
        return (
          <g key={i}>
            {i > 0 ? <rect x={r.rtl ? x0 + cw : x0} y={y + 22 * u} width={Math.max(1, 1.5 * u)} height={90 * u} fill={line} /> : null}
            <Txt r={r} x={tx} y={y + 50 * u} size={20 * u} fill={dark ? GREY_ON_INK : GREY_ON_WHITE} weight={600} align={startAlign(r)} spacing={20 * u * 0.14}>{caps(c.k)}</Txt>
            <Txt r={r} x={tx} y={y + 66 * u + vs} size={vs} fill={dark ? WHITE : INK} weight={600} align={startAlign(r)}>{c.v}</Txt>
          </g>
        );
      })}
    </g>
  );
}

/* ── the styles ────────────────────────────────────────────────────────── */

function drawPost(v: TemplateValues, ctx: DrawContext): ReactNode {
  const r = read(v, ctx);
  const { W, H, u, M } = r;
  const style = styleOf(v);
  const lw = 220 * u;
  const hs = (r.story ? 92 : r.wide ? 64 : r.size === "square" ? 76 : 84) * u;
  const web = r.web;

  switch (style) {
    case "object":
    case "object-light": {
      /* the book's greeting: one object, the greeting under it, the logo below */
      const dark = style === "object";
      const fg = dark ? WHITE : INK, dim = dark ? GREY_ON_INK : GREY_ON_WHITE;
      if (r.wide) {
        const objS = Math.min(H * 0.62, W * 0.34);
        const colX = W * 0.46;
        const h = headline(r, { x: sx(r, colX), y: H * 0.36, width: W - colX - M, size: hs, fill: fg, fill2: dim, align: startAlign(r) });
        return (
          <>
            <rect width={W} height={H} fill={dark ? INK : WHITE} />
            <Edge r={r} fill={fg} />
            <Mark r={r} cx={r.rtl ? W - W * 0.24 : W * 0.24} cy={H * 0.5} size={objS} dark={dark} />
            <Label r={r} x={sx(r, colX)} y={H * 0.36 - 24 * u} fill={dim} align={startAlign(r)} max={W - colX - M} />
            {h.node}
            <Logo x={r.rtl ? M : W - M - lw * 0.8} y={r.bottom - logoHeight(lw * 0.8)} width={lw * 0.8} fill={fg} />
          </>
        );
      }
      const cx = W / 2;
      const logoY = r.bottom - logoHeight(lw * 0.85);
      const h = headlineAbove(r, { x: cx, bottom: logoY - (web ? 110 : 70) * u, width: W - 2 * M, size: hs, fill: fg, fill2: dim, align: "center" });
      const labY = h.top - 34 * u;
      const objTop = r.top + 70 * u;
      const room = Math.max(160 * u, Math.min(H * 0.44, labY - 90 * u - objTop));
      return (
        <>
          <rect width={W} height={H} fill={dark ? INK : WHITE} />
          <Edge r={r} fill={fg} />
          <Mark r={r} cx={cx} cy={objTop + room / 2} size={room} dark={dark} />
          <Label r={r} x={cx} y={labY} fill={dim} align="center" />
          {h.node}
          {web ? <Txt r={r} x={cx} y={logoY - 40 * u} size={24 * u} fill={dim} align="center">{web}</Txt> : null}
          <Logo x={cx - lw * 0.425} y={logoY} width={lw * 0.85} fill={fg} />
        </>
      );
    }

    case "aura": {
      /* the KOLEEX aura as a halo, the object inside it */
      const cx = r.wide ? (r.rtl ? W * 0.72 : W * 0.28) : W / 2;
      const ring = r.wide ? Math.min(H * 0.86, W * 0.5) : Math.min(W * 0.92, (r.bottom - r.top) * 0.62);
      const cy = r.wide ? H / 2 : r.top + logoHeight(lw) + 40 * u + ring / 2;
      /* the aura's ring is drawn a little right of its box's centre */
      const area = { x0: cx - ring * 0.55, y0: cy - ring / 2, w: ring, h: ring };
      const h = r.wide
        ? headline(r, { x: sx(r, W * 0.56), y: H * 0.38, width: W * 0.44 - M, size: hs, fill: WHITE, fill2: GREY_ON_INK, align: startAlign(r) })
        : headline(r, { x: W / 2, y: cy + ring / 2 + 20 * u, width: W - 2 * M, size: hs * 0.92, fill: WHITE, fill2: GREY_ON_INK, align: "center" });
      return (
        <>
          <rect width={W} height={H} fill={INK} />
          <Pattern id="aura-circle" area={area} dark uid={`${r.uid}-au`} />
          <Mark r={r} cx={cx} cy={cy} size={ring * 0.42} dark />
          <TopLogo r={r} fill={WHITE} />
          <Label r={r} x={r.wide ? sx(r, W * 0.56) : W / 2} y={r.wide ? H * 0.38 - 24 * u : h.bottom + 50 * u} fill={GREY_ON_INK} align={r.wide ? startAlign(r) : "center"} max={r.wide ? W * 0.44 - M : undefined} />
          {h.node}
          {web ? <Txt r={r} x={r.wide ? sx(r, W - M) : W / 2} y={r.bottom} size={24 * u} fill={GREY_ON_INK} align={r.wide ? endAlign(r) : "center"}>{web}</Txt> : null}
        </>
      );
    }

    case "type": {
      /* the greeting as the picture: Light and large, the object small */
      const colW = r.wide ? W * 0.62 : W - 2 * M;
      const big = headline(r, { x: sx(r, M), y: r.wide ? H * 0.3 : r.top + logoHeight(lw) + 160 * u, width: colW, size: (r.wide ? 110 : 150) * u, fill: WHITE, fill2: GREY_ON_INK, align: startAlign(r), maxLines: 5 });
      const objS = r.wide ? H * 0.34 : 260 * u;
      return (
        <>
          <rect width={W} height={H} fill={INK} />
          <Edge r={r} fill={WHITE} />
          <TopLogo r={r} fill={WHITE} />
          <Mark r={r} cx={r.rtl ? M + objS / 2 : W - M - objS / 2} cy={r.wide ? H * 0.62 : r.bottom - objS / 2} size={objS} dark />
          {big.node}
          <Label r={r} x={sx(r, M)} y={r.bottom} fill={GREY_ON_INK} align={startAlign(r)} max={colW - objS} />
        </>
      );
    }

    default: {
      /* notice — white: what is closed or the last day to order, the dates in a grid */
      const lab = r.top + logoHeight(lw) + (r.story ? 140 : 110) * u;
      const colW = r.wide ? W * 0.56 : W - 2 * M;
      const h = headline(r, { x: sx(r, M), y: lab + 30 * u, width: colW, size: hs, fill: INK, fill2: "#3A3A3C", align: startAlign(r), two: r.purpose === "greet" ? r.headline2 : r.purpose === "cutoff" ? r.headline2 : r.typed2 });
      const objS = r.wide ? H * 0.5 : Math.min(360 * u, r.bottom - h.bottom - 300 * u);
      return (
        <>
          <rect width={W} height={H} fill={WHITE} />
          <Edge r={r} fill={INK} />
          <TopLogo r={r} fill={INK} />
          <Label r={r} x={sx(r, M)} y={lab} fill={GREY_ON_WHITE} align={startAlign(r)} max={colW} />
          {h.node}
          {r.purpose === "cutoff" ? null : <Dates r={r} x={place(r, { x: M, y: 0, w: colW, h: 1 }).x} y={h.bottom + 50 * u} width={colW} dark={false} />}
          {objS > 120 * u ? <Mark r={r} cx={r.rtl ? M + objS / 2 : W - M - objS / 2} cy={r.wide ? H * 0.52 : r.bottom - objS / 2 - 40 * u} size={objS} dark={false} /> : null}
          {web ? <Txt r={r} x={sx(r, M)} y={r.bottom} size={24 * u} fill={GREY_ON_WHITE} align={startAlign(r)}>{web}</Txt> : null}
        </>
      );
    }
  }
}

/* ── the template ──────────────────────────────────────────────────────── */

const isStyle = (...s: Style[]) => (v: TemplateValues) => s.includes(styleOf(v));

export const occasionPost: TemplateDef = {
  id: "occasion-post",
  itemKey: "occasion-greetings",
  nameKey: "occ.name",
  digital: true,
  usesPeople: false,
  size: (v) => POST_PX[postSizeOf(v)],
  bleed: 0,
  safe: 72,
  safeFor: postSafe,
  everySize: POST_EVERY_SIZE,
  marks: false,
  fields: [
    choice("style", "tpl.f.style", "look", OCC_STYLES, "occ.style"),
    { key: "occasion", kind: "choice", labelKey: "occ.f.occasion", group: "look", options: OCCASIONS.map((o) => ({ value: o, labelKey: `occ.o.${o}` })) },
    choice("purpose", "occ.f.purpose", "look", PURPOSES, "occ.purpose"),
    ...POST_LOOK,
    { key: "object", kind: "choice", labelKey: "occ.f.object", group: "look", options: OBJECTS.map((o) => ({ value: o, labelKey: `occ.obj.${o}` })) },
    { key: "red", kind: "switch", labelKey: "occ.f.red", group: "look", hintKey: "occ.f.redHint", when: (v) => OCC[occOf(v)].red === true },
    { key: "edge", kind: "switch", labelKey: "post.f.edge", group: "look", when: isStyle("object", "object-light", "type", "notice") },
    { key: "year", kind: "text", labelKey: "occ.f.year", group: "details", max: 8, placeholder: "2027", when: (v) => occOf(v) === "new-year" },
    { key: "years", kind: "range", labelKey: "occ.f.years", group: "details", min: 1, max: 50, step: 1, when: (v) => occOf(v) === "anniversary" },
    { key: "from", kind: "text", labelKey: "occ.f.from", group: "details", max: 16, placeholder: "01/10/2026", when: (v) => purposeOf(v) === "closed" },
    { key: "to", kind: "text", labelKey: "occ.f.to", group: "details", max: 16, placeholder: "07/10/2026", when: (v) => purposeOf(v) === "closed" },
    { key: "back", kind: "text", labelKey: "occ.f.back", group: "details", max: 16, placeholder: "08/10/2026", when: (v) => purposeOf(v) === "closed" },
    { key: "cutoff", kind: "text", labelKey: "occ.f.cutoff", group: "details", max: 16, placeholder: "20/12/2026", when: (v) => purposeOf(v) === "cutoff" },
    { key: "label", kind: "text", labelKey: "post.f.label", group: "words", max: 48, hintKey: "occ.f.autoHint" },
    { key: "headline", kind: "text", labelKey: "occ.f.greeting", group: "words", max: 60, hintKey: "occ.f.autoHint" },
    { key: "headline2", kind: "text", labelKey: "post.f.headline2", group: "words", max: 60 },
    { key: "web", kind: "switch", labelKey: "post.f.web", group: "words" },
  ] as FieldDef[],
  defaults: {
    style: "object", occasion: "eid-fitr", purpose: "greet", size: "feed", lang: "en", object: "", red: false, edge: true, logoAt: "start",
    year: "", years: 10, from: "", to: "", back: "", cutoff: "",
    label: "", headline: "", headline2: "", cta: "", web: true,
  },
  fillName: (v) => OCC[occOf(v)].name.en,
  caption: (v) => {
    const r = read(v, NO_SHEET);
    return captionOf(r.headline, r.headline2, hashtags(OCC[r.occ].name.en));
  },
  rekey: {
    /* a new occasion brings its own object (and a notice keeps its dates) */
    occasion: (v, value) => ({ ...v, occasion: value, object: "", red: false }),
    purpose: (v, value) => ({ ...v, purpose: value, style: value === "greet" ? (styleOf(v) === "notice" ? "object" : v.style) : "notice" }),
  },
  specKeys: (v) => [
    `post.spec.size.${postSizeOf(v)}`,
    "occ.spec.object",
    "occ.spec.colour",
    "occ.spec.dates",
    "occ.spec.plan",
  ],
  check: (v) => {
    if (purposeOf(v) === "closed" && !(str(v, "from") || str(v, "to"))) return "occ.needDates";
    if (purposeOf(v) === "cutoff" && !str(v, "cutoff")) return "occ.needCutoff";
    return null;
  },
  pages: [{ id: "post", draw: drawPost }],
};
