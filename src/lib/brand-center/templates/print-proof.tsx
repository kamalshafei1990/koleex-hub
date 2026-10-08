/* ---------------------------------------------------------------------------
   Print proof sheet (plan step C8) — one A4 page for the printer: printed on
   the job's paper with the job's settings, it shows how our files come out
   on their press before any job runs.

   Our files leave the browser as RGB (sRGB). The book's CMYK values are a
   mathematical starting point (ch. 48); this sheet is how the printer
   matches them: the brand colours with their targets, the two blacks
   (text K100, large areas rich black C60 M40 Y40 K100), white text on black
   down to 4 pt, hairlines, the logo's sizes, QR codes to scan, a grey ramp,
   and a sign-off. In English, Chinese or Arabic.
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import { KoleexLogoPaths } from "@/components/layout/KoleexLogo";
import { KOLEEX_COMPANY } from "@/components/brand/DocumentBrandStrips";
import { EVERYDAY_NAME_EN } from "@/lib/legal-name";
import { BRAND_COLORS, cmykText, SILVER } from "@/lib/brand-book/tokens";
import { PT, type DrawContext, type TemplateDef, type TemplateValues } from "./types";
import { FONTS, asLang, str, type Lang } from "./card/model";
import { Qr, fit } from "./card/parts";

const INK = "#000000";
const GREY = "#6E6E73";
const RULE = "#D2D2D7";
const FONT = FONTS.inter;
const M = 12;
const W = 210;
const H = 297;

const L: Record<Lang, Record<string, string>> = {
  en: {
    title: "Print proof", sub: "Brand Center — print this page before the job runs", job: "Job", printer: "Printer", paper: "Paper", date: "Date",
    i1: "Print this page at 100 % (actual size) on the job's paper, with the job's press settings — no scaling, no colour correction.",
    i2: "Check every box and write what you see. Send us a photo of the printed sheet, or this sheet itself.",
    i3: "The file is RGB (sRGB). Separate text and the logo to K100 only; large black areas to rich black C60 M40 Y40 K100; silver is foil, never ink.",
    colours: "1 · Brand colours — target CMYK", ok: "OK", foil: "foil, not ink",
    black: "2 · The two blacks", textBlack: "Text and the logo: K100 only (C0 M0 Y0 K100)", areaBlack: "Large areas: rich black C60 M40 Y40 K100",
    sample: "The quick brown fox — 0123456789 — info@koleexgroup.com",
    reversed: "3 · White text on black — which is the smallest you can read?", smallest: "Smallest readable:",
    lines: "4 · Hairlines — which still print as an unbroken line?", onWhite: "on white", onBlack: "on black",
    logo: "5 · The logo's sizes (book: 25 mm and up in print)", greys: "6 · Greys — K only, no colour cast",
    qr: "7 · QR codes — each must scan from 20 cm", scans: "scans",
    sign: "Printer's sign-off", press: "Press / profile", result: "Result", adjust: "Adjust", signature: "Signature",
  },
  zh: {
    title: "印刷打样", sub: "品牌中心 — 正式开印前请先印此页", job: "印件", printer: "印刷厂", paper: "纸张", date: "日期",
    i1: "请按 100%（实际尺寸）在本印件所用纸张上、用本印件的印刷设置印出此页 — 不缩放，不做颜色校正。",
    i2: "逐项勾选并写下实际效果。请把印好的样张拍照发给我们，或寄回此页。",
    i3: "文件为 RGB（sRGB）。文字和标志请分色为单黑 K100；大面积黑色为四色黑 C60 M40 Y40 K100；银色为烫印，不用银墨。",
    colours: "1 · 品牌色 — 目标 CMYK", ok: "合格", foil: "烫印，非油墨",
    black: "2 · 两种黑色", textBlack: "文字与标志：仅 K100（C0 M0 Y0 K100）", areaBlack: "大面积：四色黑 C60 M40 Y40 K100",
    sample: "文字样本 — 0123456789 — info@koleexgroup.com",
    reversed: "3 · 黑底白字 — 能看清的最小字号是？", smallest: "最小可读：",
    lines: "4 · 细线 — 哪些仍能印成连续的线？", onWhite: "白底", onBlack: "黑底",
    logo: "5 · 标志尺寸（手册：印刷不小于 25 毫米）", greys: "6 · 灰阶 — 仅用 K，不偏色",
    qr: "7 · 二维码 — 每个都须在 20 厘米处可扫", scans: "可扫",
    sign: "印刷厂确认", press: "印刷机 / 色彩配置", result: "结果", adjust: "需调整", signature: "签名",
  },
  ar: {
    title: "بروفة الطباعة", sub: "مركز البراند — اطبع الصفحة دي قبل ما الشغل يبدأ", job: "الشغلانة", printer: "المطبعة", paper: "الورق", date: "التاريخ",
    i1: "اطبع الصفحة دي على 100% (المقاس الحقيقي) على ورق الشغلانة وبإعدادات ماكينتها — من غير تصغير ولا تصحيح ألوان.",
    i2: "علّم على كل خانة واكتب اللي شايفه. ابعتلنا صورة للصفحة المطبوعة أو الصفحة نفسها.",
    i3: "الملف RGB (sRGB). الكلام واللوجو يتفصلوا أسود K100 بس، والمساحات السودا الكبيرة أسود غني C60 M40 Y40 K100، والفضي فويل مش حبر.",
    colours: "1 · ألوان البراند — قيم CMYK المطلوبة", ok: "تمام", foil: "فويل مش حبر",
    black: "2 · نوعين الأسود", textBlack: "الكلام واللوجو: K100 بس (C0 M0 Y0 K100)", areaBlack: "المساحات الكبيرة: أسود غني C60 M40 Y40 K100",
    sample: "عينة كلام — 0123456789 — info@koleexgroup.com",
    reversed: "3 · كلام أبيض على أسود — أصغر مقاس بيتقري كام؟", smallest: "أصغر مقاس مقروء:",
    lines: "4 · الخطوط الرفيعة — أنهي خط لسه بيطلع متصل؟", onWhite: "على أبيض", onBlack: "على أسود",
    logo: "5 · مقاسات اللوجو (الكتاب: 25 مم وأكتر في الطباعة)", greys: "6 · درجات الرمادي — K بس من غير لون",
    qr: "7 · أكواد QR — كل واحد لازم يتقري من 20 سم", scans: "بيتقري",
    sign: "توقيع المطبعة", press: "الماكينة / البروفايل", result: "النتيجة", adjust: "محتاج تعديل", signature: "التوقيع",
  },
};

function Logo({ x, y, width, fill }: { x: number; y: number; width: number; fill: string }) {
  return <g transform={`translate(${x} ${y}) scale(${width / 719.83})`} fill={fill}><KoleexLogoPaths /></g>;
}

function T({ x, y, children, size = 7, weight = 400, fill = INK, anchor = "start", rtl = false, max }: {
  x: number; y: number; children: string; size?: number; weight?: number; fill?: string; anchor?: "start" | "middle" | "end"; rtl?: boolean;
  /** Condense the line to this width (mm) when it would run past it. */
  max?: number;
}) {
  return (
    <text x={x} y={y} direction={rtl ? "rtl" : "ltr"} textAnchor={anchor} fill={fill} {...(max ? fit(children, size * PT, max, weight, FONT) : {})}
      style={{ fontFamily: FONT, fontSize: size * PT, fontWeight: weight }}>{children}</text>
  );
}

const Box = ({ x, y, s = 2.6 }: { x: number; y: number; s?: number }) => <rect x={x} y={y} width={s} height={s} fill="none" stroke={INK} strokeWidth={0.2} />;

function Section({ y, title, rtl }: { y: number; title: string; rtl: boolean }) {
  return (
    <g>
      <T x={rtl ? W - M : M} y={y} size={8} weight={600} rtl={rtl}>{title}</T>
      <rect x={M} y={y + 1.4} width={W - M * 2} height={0.15} fill={RULE} />
    </g>
  );
}

const today = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

function sheet(v: TemplateValues, ctx: DrawContext) {
  const lang = asLang(v.lang);
  const l = L[lang];
  const rtl = lang === "ar";
  const sx = (x: number) => (rtl ? W - x : x); // mirror a start position
  const code = ctx.qrs.company;
  const colours = BRAND_COLORS.filter((c) => c.group === "core" || c.group === "neutral" || c.group === "silver");
  const inner = W - M * 2;

  /* 1 · colours: five to a row */
  const sw = (inner - 4 * 4) / 5;
  const colourY = 70;

  return (
    <g>
      <rect x={0} y={0} width={W} height={H} fill="#FFFFFF" />
      {/* header */}
      <Logo x={rtl ? W - M - 32 : M} y={M} width={32} fill={INK} />
      <T x={rtl ? M : W - M} y={M + 3.2} size={13} weight={600} anchor="end" rtl={rtl}>{l.title}</T>
      <T x={rtl ? M : W - M} y={M + 7.4} size={7} fill={GREY} anchor="end" rtl={rtl}>{l.sub}</T>
      <rect x={M} y={M + 10.5} width={inner} height={0.2} fill={INK} />

      {/* the job */}
      {[[l.job, str(v, "job")], [l.printer, str(v, "printer")], [l.paper, str(v, "paper")], [l.date, str(v, "date") || today()]].map(([k, val], i) => {
        const cw = inner / 4;
        const x = rtl ? W - M - i * cw : M + i * cw;
        return (
          <g key={k}>
            <T x={x} y={M + 16} size={6} fill={GREY} rtl={rtl}>{k}</T>
            <T x={x} y={M + 20.5} size={8} weight={600} rtl={rtl} max={cw - 3}>{val || "—"}</T>
          </g>
        );
      })}

      {/* instructions */}
      {[l.i1, l.i2, l.i3].map((line, i) => <T key={i} x={sx(M)} y={M + 29 + i * 4.3} size={7} rtl={rtl}>{`${i + 1}. ${line}`}</T>)}

      {/* 1 · colours */}
      <Section y={colourY - 6} title={l.colours} rtl={rtl} />
      {colours.map((c, i) => {
        const col = i % 5;
        const row = Math.floor(i / 5);
        const x = rtl ? W - M - (col + 1) * sw - col * 4 : M + col * (sw + 4);
        const y = colourY + row * 25;
        const silver = c.group === "silver";
        return (
          <g key={c.id}>
            {silver ? (
              <>
                <defs><linearGradient id={`${ctx.uid}-silver`} x1="0" y1="0" x2="1" y2="1">{SILVER.stops.map((s, j) => <stop key={s} offset={[0, 0.38, 0.6, 1][j]} stopColor={s} />)}</linearGradient></defs>
                <rect x={x} y={y} width={sw} height={13} fill={`url(#${ctx.uid}-silver)`} />
              </>
            ) : <rect x={x} y={y} width={sw} height={13} fill={c.hex} stroke={c.hex === "#FFFFFF" ? RULE : "none"} strokeWidth={0.2} />}
            <T x={x} y={y + 16.4} size={6.5} weight={600}>{c.name}</T>
            <T x={x} y={y + 19.4} size={5.5} fill={GREY}>{silver ? `${SILVER.pantone} — ${l.foil}` : `${c.hex} · ${cmykText(c.hex)}`}</T>
            <Box x={x + sw - 2.6} y={y + 14.4} />
          </g>
        );
      })}

      {/* 2 · blacks */}
      <Section y={122} title={l.black} rtl={rtl} />
      <Logo x={sx(M) - (rtl ? 26 : 0)} y={128} width={26} fill={INK} />
      <T x={sx(M)} y={138} size={8} rtl={rtl}>{l.sample}</T>
      <T x={sx(M)} y={142} size={6} fill={GREY} rtl={rtl}>{l.textBlack}</T>
      <Box x={rtl ? M : M + inner / 2 - 6} y={139.6} />
      <rect x={rtl ? M : M + inner / 2 + 2} y={127} width={inner / 2 - 2} height={11} fill={INK} />
      <T x={rtl ? M + inner / 2 - 2 : M + inner / 2 + 2} y={142} size={6} fill={GREY} rtl={rtl} anchor={rtl ? "end" : "start"}>{l.areaBlack}</T>
      <Box x={rtl ? M + inner / 2 - 2.6 : W - M - 2.6} y={139.6} />

      {/* 3 · white on black */}
      <Section y={150} title={l.reversed} rtl={rtl} />
      <rect x={M} y={154} width={inner} height={30} fill={INK} />
      <Logo x={rtl ? M + 4 : W - M - 22} y={157} width={18} fill="#FFFFFF" />
      {[4, 5, 6, 7, 8].map((pt, i) => (
        <text key={pt} x={sx(M + 4)} y={159.5 + i * 5.2} direction={rtl ? "rtl" : "ltr"} fill="#FFFFFF" style={{ fontFamily: FONT, fontSize: pt * PT }}>
          <tspan fontWeight={600}>{`${pt} pt  `}</tspan>
          <tspan direction="ltr" unicodeBidi="embed">{`Mob: ${KOLEEX_COMPANY.mobile} · ${KOLEEX_COMPANY.email} · ${KOLEEX_COMPANY.web}`}</tspan>
        </text>
      ))}
      <T x={sx(M)} y={188} size={6.5} rtl={rtl}>{`${l.smallest} ______ pt`}</T>

      {/* 4 · hairlines */}
      <Section y={196} title={l.lines} rtl={rtl} />
      {[0, 1].map((dark) => {
        const x0 = M + dark * (inner / 2 + 2);
        const w = inner / 2 - 2;
        return (
          <g key={dark}>
            <rect x={x0} y={200} width={w} height={20} fill={dark ? INK : "#FFFFFF"} stroke={dark ? "none" : RULE} strokeWidth={0.15} />
            {[0.05, 0.1, 0.15, 0.2, 0.3].map((t, i) => (
              <g key={t}>
                <rect x={x0 + 16} y={203 + i * 3.6} width={w - 20} height={t} fill={dark ? "#FFFFFF" : INK} />
                <text x={x0 + 2} y={203.8 + i * 3.6} fill={dark ? "#FFFFFF" : INK} style={{ fontFamily: FONT, fontSize: 5.5 * PT }}>{`${t} mm`}</text>
              </g>
            ))}
            <T x={x0} y={223.4} size={6} fill={GREY}>{dark ? l.onBlack : l.onWhite}</T>
          </g>
        );
      })}

      {/* 5 · logo sizes · 6 · greys */}
      <Section y={230} title={l.logo} rtl={rtl} />
      {[10, 15, 20, 25, 30].reduce<{ x: number; nodes: ReactNode[] }>((acc, mm) => {
        acc.nodes.push(
          <g key={mm}>
            <Logo x={acc.x} y={236} width={mm} fill={INK} />
            <T x={acc.x} y={243.6} size={5.5} fill={GREY}>{`${mm} mm`}</T>
          </g>,
        );
        acc.x += mm + 4;
        return acc;
      }, { x: M, nodes: [] }).nodes}
      <T x={W - M - 66} y={236.4} size={6.5} weight={600}>{l.greys}</T>
      {Array.from({ length: 11 }, (_, i) => {
        const g = Math.round(255 - (i / 10) * 255);
        const hex = `#${g.toString(16).padStart(2, "0").repeat(3)}`;
        return (
          <g key={i}>
            <rect x={W - M - 66 + i * 6} y={238} width={6} height={5} fill={hex} stroke={i === 0 ? RULE : "none"} strokeWidth={0.15} />
            <text x={W - M - 66 + i * 6 + 3} y={245.4} textAnchor="middle" fill={GREY} style={{ fontFamily: FONT, fontSize: 4.5 * PT }}>{`${i * 10}`}</text>
          </g>
        );
      })}

      {/* 7 · QR codes */}
      <Section y={251} title={l.qr} rtl={rtl} />
      {code ? [10, 12, 15, 20].reduce<{ x: number; nodes: ReactNode[] }>((acc, mm) => {
        acc.nodes.push(
          <g key={mm}>
            <Qr modules={code} x={acc.x} y={277 - mm} size={mm} />
            <T x={acc.x} y={280.4} size={5.5} fill={GREY}>{`${mm} mm`}</T>
            <Box x={acc.x + mm - 2.6} y={278.2} />
          </g>,
        );
        acc.x += mm + 8;
        return acc;
      }, { x: M, nodes: [] }).nodes : null}

      {/* sign-off */}
      <rect x={W - M - 80} y={255} width={80} height={27} fill="none" stroke={INK} strokeWidth={0.2} />
      <T x={W - M - 77} y={259.5} size={7} weight={600}>{l.sign}</T>
      {[l.printer, l.press, l.date, l.signature].map((k, i) => (
        <g key={k}>
          <T x={W - M - 77} y={264.5 + i * 4.4} size={6} fill={GREY}>{k}</T>
          <rect x={W - M - 52} y={265 + i * 4.4} width={48} height={0.15} fill={RULE} />
        </g>
      ))}
      <T x={M} y={H - 8} size={5.5} fill={GREY}>{`${EVERYDAY_NAME_EN} · ${KOLEEX_COMPANY.web} · Brand Center`}</T>
      <g>
        <T x={W - M - 40} y={H - 8} size={6} weight={600}>{l.result}</T>
        <Box x={W - M - 30} y={H - 10.2} /><T x={W - M - 26.5} y={H - 8} size={6}>{l.ok}</T>
        <Box x={W - M - 18} y={H - 10.2} /><T x={W - M - 14.5} y={H - 8} size={6}>{l.adjust}</T>
      </g>
    </g>
  );
}

/** The company's own contact card — what the test codes carry. */
const COMPANY_VCARD = ["BEGIN:VCARD", "VERSION:3.0", `N:${EVERYDAY_NAME_EN};;;;`, `FN:${EVERYDAY_NAME_EN}`, `ORG:${EVERYDAY_NAME_EN}`,
  `TEL;TYPE=WORK:${KOLEEX_COMPANY.tel.replace(/[^\d+]/g, "")}`, `EMAIL;TYPE=WORK:${KOLEEX_COMPANY.email}`, `URL:https://${KOLEEX_COMPANY.web}`, "END:VCARD"].join("\n");

export const printProof: TemplateDef = {
  id: "print-proof",
  itemKey: "print-proof",
  nameKey: "tpl.printProof",
  size: () => ({ w: W, h: H }),
  bleed: 0,
  safe: M,
  marks: false,
  usesPeople: false,
  fields: [
    { key: "lang", kind: "choice", labelKey: "tpl.f.lang", group: "look", options: [
      { value: "en", labelKey: "tpl.lang.en" }, { value: "zh", labelKey: "tpl.lang.zh" }, { value: "ar", labelKey: "tpl.lang.ar" },
    ] },
    { key: "job", kind: "text", labelKey: "tpl.f.job", group: "job", max: 60 },
    { key: "printer", kind: "text", labelKey: "tpl.f.printer", group: "job", max: 60 },
    { key: "paper", kind: "text", labelKey: "tpl.f.paper", group: "job", max: 80 },
    { key: "date", kind: "text", labelKey: "tpl.f.date", group: "job", max: 20, placeholder: "DD/MM/YYYY" },
  ],
  defaults: { lang: "zh", job: "Business cards", printer: "", paper: "Black board 600–700 g/m², soft-touch matte", date: "" },
  pages: [{ id: "sheet", draw: sheet }],
  qrRequests: () => [{ id: "company", text: COMPANY_VCARD, level: "M" }],
  specKeys: () => ["spec.proof1", "spec.proof2", "spec.proof3"],
  fillName: (v, t) => t(`tpl.lang.${asLang(v.lang)}`),
};
