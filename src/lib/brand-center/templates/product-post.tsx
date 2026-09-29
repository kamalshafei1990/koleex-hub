/* ---------------------------------------------------------------------------
   Product post (plan step C14) — a social post for one machine, drawn in
   PIXELS and saved as a picture (PNG / JPEG).

   The book's grammar (ch. 80): the KOLEEX edge down the start side, the
   logo top-left, a small grey label in capitals, a two-line headline (Bold,
   then Light) and one image — our own photo of the machine. 72 px margins;
   feed 1080 × 1350, square 1080 × 1080, story 1080 × 1920 (top 250 px and
   bottom 340 px kept clear), LinkedIn 1200 × 627. Text stays small: the
   caption carries the detail. Never a price (ch. 89, governance).

   Two book styles, then the designer's (owner: professional first, small
   breaks from the book allowed): studio stage, split, the KOLEEX pattern
   (white / black), key figures, one feature, editorial, launch.

   The photo: shot on white, on black, or a cut-out. On a ground of its own
   colour it melts in (multiply / screen); on the other ground it sits on a
   panel of its own colour — never a white box floating on black.
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import type { BcProduct } from "@/lib/brand-center/client";
import type { DrawContext, TemplateDef, TemplateValues } from "./types";
import { GREY_ON_INK, GREY_ON_WHITE, INK, Logo, WHITE, logoHeight, textWidth } from "./card/parts";
import { asLang, str, type Lang } from "./card/model";
import { Pattern, patternOptions } from "./patterns";
import {
  Edge, Floor, Foot, HUB_BLUE, Label, POST_LOOK, POST_PX, Photo, STAGE, TopLogo, Txt, caps, choice, endAlign, hasFoot, headline,
  POST_EVERY_SIZE, oneOf, photoFields, place, postSafe, postSizeOf, readPost, startAlign, sx, type Box, captionOf, hashtags,
} from "./post-kit";

export const POST_STYLES = ["book-dark", "book-light", "stage", "split", "pattern", "pattern-dark", "figures", "feature", "editorial", "launch", "factory"] as const;
type Style = (typeof POST_STYLES)[number];
const styleOf = (v: TemplateValues): Style => oneOf(POST_STYLES, v.style, "book-dark");

/** The words a fill starts with, by language (the call to action names what happens — ch. 89). */
const CTA: Record<Lang, string> = { en: "Request a quotation", zh: "索取报价", ar: "اطلب عرض سعر" };
/** The launch's tag (the owner's kinds: launch teaser, new arrival, in stock). */
const TAGS = ["new", "soon", "stock"] as const;
const TAG: Record<(typeof TAGS)[number], Record<Lang, string>> = {
  new: { en: "New", zh: "新品", ar: "جديد" },
  soon: { en: "Coming soon", zh: "即将推出", ar: "قريباً" },
  stock: { en: "In stock", zh: "现货", ar: "متوفر" },
};

function read(v: TemplateValues, ctx: DrawContext) {
  return {
    ...readPost(v, ctx),
    model: str(v, "model"),
    facts: str(v, "facts").split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 4).map((l) => {
      const [a, ...b] = l.split(/\s*[|｜]\s*|\s+[—–]\s+/);
      return { value: a.trim(), label: b.join(" ").trim() };
    }),
    tag: oneOf(TAGS, v.tag, "new"),
  };
}
type R = ReturnType<typeof read>;

/* ── the styles ────────────────────────────────────────────────────────── */

function drawPost(v: TemplateValues, ctx: DrawContext): ReactNode {
  const r = read(v, ctx);
  const { W, H, u, M } = r;
  const style = styleOf(v);
  const lw = 220 * u;
  const footY = r.bottom - 6 * u;
  const footRoom = hasFoot(r) ? 70 * u : 0;
  const hs = (r.story ? 92 : r.wide ? 60 : r.size === "square" ? 74 : 84) * u; // headline size

  switch (style) {
    case "book-dark":
    case "book-light": {
      const dark = style === "book-dark";
      const fg = dark ? WHITE : INK, dim = dark ? GREY_ON_INK : GREY_ON_WHITE;
      const ground = dark ? "dark" : "light";
      if (r.wide) {
        const colW = W * 0.44;
        const lab = r.top + logoHeight(lw) + 84 * u;
        const h = headline(r, { x: sx(r, M), y: lab + 28 * u, width: colW - M - 24 * u, size: hs, fill: fg, align: startAlign(r) });
        return (
          <>
            <rect width={W} height={H} fill={dark ? INK : WHITE} />
            <Photo r={r} box={place(r, { x: colW, y: M * 0.7, w: W - colW - M * 0.7, h: H - M * 1.4 })} ground={ground} />
            <Edge r={r} fill={fg} />
            <Logo x={r.rtl ? W - M - lw : M} y={r.top} width={lw} fill={fg} />
            <Label r={r} x={sx(r, M)} y={lab} fill={dim} align={startAlign(r)} max={colW - M - 24 * u} />
            {h.node}
            {hasFoot(r) ? <Foot r={r} y={footY} fill={fg} dim={dim} x1={colW - 24 * u} /> : null}
          </>
        );
      }
      const lab = r.top + logoHeight(lw) + (r.story ? 120 : 96) * u;
      const h = headline(r, { x: sx(r, M), y: lab + 30 * u, width: W - 2 * M, size: hs, fill: fg, align: startAlign(r) });
      const py = h.bottom + 40 * u;
      return (
        <>
          <rect width={W} height={H} fill={dark ? INK : WHITE} />
          <Photo r={r} box={{ x: M * 0.6, y: py, w: W - M * 1.2, h: r.bottom - footRoom - py }} ground={ground} />
          <Edge r={r} fill={fg} />
          <TopLogo r={r} fill={fg} />
          <Label r={r} x={sx(r, M)} y={lab} fill={dim} align={startAlign(r)} />
          {h.node}
          {hasFoot(r) ? <Foot r={r} y={footY} fill={fg} dim={dim} /> : null}
        </>
      );
    }

    case "stage": {
      /* Apple-grey studio: the machine large in the middle on a soft floor
         shadow, the words centred above, the logo centred below */
      const cx = W / 2;
      if (r.wide) {
        const colW = W * 0.46;
        const h = headline(r, { x: sx(r, M), y: H * 0.36, width: colW - M, size: hs, fill: INK, align: startAlign(r) });
        const box = place(r, { x: colW, y: M * 0.6, w: W - colW - M * 0.5, h: H - M * 1.2 });
        return (
          <>
            <rect width={W} height={H} fill={STAGE} />
            <Floor r={r} cx={box.x + box.w / 2} y={box.y + box.h * 0.9} w={box.w * 0.7} />
            <Photo r={r} box={box} ground="light" />
            <Label r={r} x={sx(r, M)} y={H * 0.36 - 24 * u} fill={GREY_ON_WHITE} align={startAlign(r)} max={colW - M} />
            {h.node}
            <Logo x={r.rtl ? W - M - lw * 0.8 : M} y={r.bottom - logoHeight(lw * 0.8)} width={lw * 0.8} fill={INK} />
          </>
        );
      }
      const lab = r.top + 30 * u;
      const h = headline(r, { x: cx, y: lab + 34 * u, width: W - 2 * M, size: hs * 0.92, fill: INK, fill2: "#3A3A3C", align: "center" });
      const logoY = r.bottom - logoHeight(lw * 0.85);
      const webY = logoY - 34 * u;
      const py = h.bottom + 30 * u;
      const ph = webY - (r.web || r.cta ? 50 : 20) * u - py;
      return (
        <>
          <rect width={W} height={H} fill={STAGE} />
          <Floor r={r} cx={cx} y={py + ph * 0.92} w={W * 0.62} />
          <Photo r={r} box={{ x: M * 0.5, y: py, w: W - M, h: ph }} ground="light" />
          <Label r={r} x={cx} y={lab} fill={GREY_ON_WHITE} align="center" />
          {h.node}
          {r.cta || r.web ? <Txt r={r} x={cx} y={webY} size={26 * u} fill={GREY_ON_WHITE} align="center" weight={500}>{[r.cta, r.web].filter(Boolean).join("   ·   ")}</Txt> : null}
          <Logo x={cx - lw * 0.425} y={logoY} width={lw * 0.85} fill={INK} />
        </>
      );
    }

    case "split": {
      /* The photo on a panel of its own colour, the words on the other colour */
      const photoWhite = r.photoOn !== "black";
      const pg = photoWhite ? WHITE : INK, wg = photoWhite ? INK : WHITE;
      const pfg = photoWhite ? INK : WHITE, wfg = photoWhite ? WHITE : INK, wdim = photoWhite ? GREY_ON_INK : GREY_ON_WHITE;
      if (r.wide) {
        const colW = W * 0.42;
        const words = place(r, { x: 0, y: 0, w: colW, h: H });
        const lab = r.top + logoHeight(lw) + 80 * u;
        const h = headline(r, { x: sx(r, M), y: lab + 28 * u, width: colW - 2 * M, size: hs, fill: wfg, align: startAlign(r) });
        return (
          <>
            <rect width={W} height={H} fill={pg} />
            <Photo r={r} box={place(r, { x: colW + M * 0.4, y: M * 0.5, w: W - colW - M * 0.8, h: H - M })} ground={photoWhite ? "light" : "dark"} />
            <rect x={words.x} y={0} width={colW} height={H} fill={wg} />
            <Logo x={r.rtl ? W - M - lw : M} y={r.top} width={lw} fill={wfg} />
            <Label r={r} x={sx(r, M)} y={lab} fill={wdim} align={startAlign(r)} max={colW - 2 * M} />
            {h.node}
            {hasFoot(r) ? <Foot r={r} y={footY} fill={wfg} dim={wdim} x1={colW - M} /> : null}
          </>
        );
      }
      const cut = H * (r.story ? 0.56 : r.size === "square" ? 0.6 : 0.58);
      const lab = cut + (r.story ? 110 : 84) * u;
      const h = headline(r, { x: sx(r, M), y: lab + 30 * u, width: W - 2 * M, size: hs * 0.92, fill: wfg, align: startAlign(r) });
      return (
        <>
          <rect width={W} height={H} fill={pg} />
          <Photo r={r} box={{ x: M * 0.5, y: r.top + logoHeight(lw) + 20 * u, w: W - M, h: cut - r.top - logoHeight(lw) - 40 * u }} ground={photoWhite ? "light" : "dark"} />
          <TopLogo r={r} fill={pfg} />
          <rect x={0} y={cut} width={W} height={H - cut} fill={wg} />
          <Label r={r} x={sx(r, M)} y={lab} fill={wdim} align={startAlign(r)} />
          {h.node}
          {hasFoot(r) ? <Foot r={r} y={footY} fill={wfg} dim={wdim} /> : null}
        </>
      );
    }

    case "pattern":
    case "pattern-dark": {
      /* The KOLEEX pattern down the end side, full height; the machine and the
         words on clean ground at the start */
      const dark = style === "pattern-dark";
      const fg = dark ? WHITE : INK, dim = dark ? GREY_ON_INK : GREY_ON_WHITE;
      const pw = W * (r.wide ? 0.24 : 0.36);
      const area = { x0: r.rtl ? 0 : W - pw, y0: 0, w: pw, h: H };
      const colW = r.wide ? W * 0.42 : W - pw;
      const lab = r.top + logoHeight(lw) + (r.story ? 120 : 90) * u;
      const h = headline(r, { x: sx(r, M), y: lab + 30 * u, width: colW - M - 36 * u, size: hs * (r.wide ? 1 : 0.9), fill: fg, align: startAlign(r) });
      const box = r.wide
        ? place(r, { x: colW - 30 * u, y: M * 0.5, w: W - colW - pw + 150 * u, h: H - M })
        : place(r, { x: M * 0.4, y: h.bottom + 36 * u, w: colW - M * 0.4 + 110 * u, h: r.bottom - footRoom - h.bottom - 36 * u });
      return (
        <>
          <rect width={W} height={H} fill={dark ? INK : WHITE} />
          <Pattern id={r.pattern} area={area} dark={dark} mirror={r.rtl} uid={`${r.uid}-pp`}
            clear={[{ x: box.x, y: box.y, w: box.w, h: box.h }]} />
          <Photo r={r} box={box} ground={dark ? "dark" : "light"} />
          <Logo x={r.rtl ? W - M - lw : M} y={r.top} width={lw} fill={fg} />
          <Label r={r} x={sx(r, M)} y={lab} fill={dim} align={startAlign(r)} max={colW - M - 36 * u} />
          {h.node}
          {hasFoot(r) ? <Foot r={r} y={footY} fill={fg} dim={dim} x1={r.rtl ? W - M : colW - 24 * u} x0={r.rtl ? pw + 24 * u : M} /> : null}
        </>
      );
    }

    case "figures": {
      /* Key figures: the machine, then up to four numbers in a hairline grid */
      const lab = r.top + logoHeight(lw) + 84 * u;
      const facts = r.facts.length ? r.facts : [{ value: "—", label: "" }, { value: "—", label: "" }, { value: "—", label: "" }];
      const cols = r.story && facts.length > 2 ? 2 : facts.length;
      const rows = Math.ceil(facts.length / cols);
      const cellH = (r.wide ? 150 : 170) * u;
      if (r.wide) {
        const colW = W * 0.5;
        const h = headline(r, { x: sx(r, M), y: lab + 28 * u, width: colW - M - 24 * u, size: hs * 0.9, fill: INK, align: startAlign(r) });
        const gy = r.bottom - cellH;
        return (
          <>
            <rect width={W} height={H} fill={WHITE} />
            <Photo r={r} box={place(r, { x: colW, y: M * 0.5, w: W - colW - M * 0.5, h: H - M })} ground="light" />
            <Logo x={r.rtl ? W - M - lw : M} y={r.top} width={lw} fill={INK} />
            <Label r={r} x={sx(r, M)} y={lab} fill={GREY_ON_WHITE} align={startAlign(r)} max={colW - M - 24 * u} />
            {h.node}
            <Figures r={r} facts={facts} box={place(r, { x: M, y: gy, w: colW - M - 24 * u, h: cellH })} cols={facts.length} />
          </>
        );
      }
      const gridH = rows * cellH;
      const gy = r.bottom - gridH;
      const h = headline(r, { x: sx(r, M), y: lab + 30 * u, width: W - 2 * M, size: hs * 0.9, fill: INK, align: startAlign(r) });
      const py = h.bottom + 30 * u;
      return (
        <>
          <rect width={W} height={H} fill={WHITE} />
          <Photo r={r} box={{ x: M * 0.6, y: py, w: W - M * 1.2, h: gy - 36 * u - py }} ground="light" />
          <TopLogo r={r} fill={INK} />
          {r.model ? <Txt r={r} x={sx(r, W - M)} y={r.top + logoHeight(lw) * 0.8} size={24 * u} fill={GREY_ON_WHITE} weight={600} align={endAlign(r)} spacing={24 * u * 0.14}>{r.model}</Txt> : null}
          <Label r={r} x={sx(r, M)} y={lab} fill={GREY_ON_WHITE} align={startAlign(r)} />
          {h.node}
          <Figures r={r} facts={facts} box={{ x: M, y: gy, w: W - 2 * M, h: gridH }} cols={cols} />
        </>
      );
    }

    case "feature": {
      /* One feature, close up: the detail's photo on its panel, the feature as
         the headline, the product as the label */
      const lab = r.top + logoHeight(lw) + (r.story ? 110 : 84) * u;
      if (r.wide) {
        const colW = W * 0.46;
        const h = headline(r, { x: sx(r, M), y: lab + 28 * u, width: colW - M - 24 * u, size: hs, fill: WHITE, fill2: GREY_ON_INK, align: startAlign(r) });
        return (
          <>
            <rect width={W} height={H} fill={INK} />
            <Photo r={r} box={place(r, { x: colW, y: M * 0.6, w: W - colW - M * 0.6, h: H - M * 1.2 })} ground="dark" panelRadius={24} />
            <Edge r={r} fill={WHITE} />
            <Logo x={r.rtl ? W - M - lw : M} y={r.top} width={lw} fill={WHITE} />
            <Label r={r} x={sx(r, M)} y={lab} fill={GREY_ON_INK} align={startAlign(r)} max={colW - M - 24 * u} />
            {h.node}
          </>
        );
      }
      const panelY = lab + 40 * u;
      const panelH = (r.bottom - footRoom - panelY) * 0.62;
      const h = headline(r, { x: sx(r, M), y: panelY + panelH + 56 * u, width: W - 2 * M, size: hs * 0.86, fill: WHITE, fill2: GREY_ON_INK, align: startAlign(r) });
      return (
        <>
          <rect width={W} height={H} fill={INK} />
          <Photo r={r} box={{ x: M, y: panelY, w: W - 2 * M, h: panelH }} ground="dark" panelRadius={28} />
          <Edge r={r} fill={WHITE} />
          <TopLogo r={r} fill={WHITE} />
          <Label r={r} x={sx(r, M)} y={lab} fill={GREY_ON_INK} align={startAlign(r)} />
          {h.node}
          {hasFoot(r) ? <Foot r={r} y={footY} fill={WHITE} dim={GREY_ON_INK} /> : null}
        </>
      );
    }

    case "editorial": {
      /* The model as a huge Light word, the machine standing in front of it,
         the headline small at the foot */
      const dark = r.photoOn === "black";
      const fg = dark ? WHITE : INK, dim = dark ? GREY_ON_INK : GREY_ON_WHITE;
      const big = r.model || r.headline;
      /* on LinkedIn the word stands at the start, behind the headline's side */
      const bigW = r.wide ? W * 0.62 : W - M;
      const bigMax = (r.wide ? 230 : r.story ? 360 : 320) * u;
      const bigS = Math.min(bigMax, (bigMax * bigW) / Math.max(1, textWidth(big, bigMax, 300, r.font)));
      const hsE = hs * (r.wide ? 0.8 : 0.72);
      const hw = r.wide ? W * 0.46 : W - 2 * M;
      const probe = headline(r, { x: 0, y: 0, width: hw, size: hsE, fill: fg, align: startAlign(r) });
      const headTop = r.bottom - footRoom - probe.bottom - 8 * u;
      const h = headline(r, { x: sx(r, M), y: headTop, width: hw, size: hsE, fill: fg, align: startAlign(r) });
      const bigTop = r.wide ? r.top + logoHeight(lw) + 64 * u : r.top + logoHeight(lw) + (r.story ? 120 : 64) * u;
      const bigY = bigTop + bigS * 0.8;
      const box = r.wide
        ? place(r, { x: W * 0.44, y: M * 0.5, w: W * 0.56 - M * 0.5, h: H - M })
        : { x: M * 0.5, y: bigTop + bigS * 0.3, w: W - M, h: headTop - 36 * u - (bigTop + bigS * 0.3) };
      return (
        <>
          <rect width={W} height={H} fill={dark ? INK : WHITE} />
          {big ? <Txt r={r} x={r.wide ? sx(r, M * 0.6) : W / 2} y={bigY} size={bigS} fill={dark ? "#2C2C2E" : "#E8E8ED"} weight={300} align={r.wide ? startAlign(r) : "center"} spacing={-bigS * 0.03}>{big}</Txt> : null}
          <Photo r={r} box={box} ground={dark ? "dark" : "light"} align="bottom" />
          <TopLogo r={r} fill={fg} />
          <Label r={r} x={sx(r, W - M)} y={r.top + logoHeight(lw) * 0.85} fill={dim} align={endAlign(r)} max={W - 2 * M - lw - 40 * u} />
          {h.node}
          {hasFoot(r) ? <Foot r={r} y={footY} fill={fg} dim={dim} /> : null}
        </>
      );
    }

    case "factory": {
      /* The machine at work in a customer's factory: the photo to every
         edge, dark bands at the top and the foot so the words always read
         (ch. 80's photo posts: black at 45 %, no edge) */
      const id = `${r.uid}-fx`;
      const k = Math.max(1, r.photoScale);
      const hw = r.wide ? W * 0.55 : W - 2 * M;
      const probe = headline(r, { x: 0, y: 0, width: hw, size: hs * 0.9, fill: WHITE, align: startAlign(r) });
      const headTop = r.bottom - footRoom - probe.bottom - 12 * u;
      const lab = headTop - 30 * u;
      const h = headline(r, { x: sx(r, M), y: headTop, width: hw, size: hs * 0.9, fill: WHITE, fill2: "#E5E5EA", align: startAlign(r) });
      return (
        <>
          <rect width={W} height={H} fill={INK} />
          {r.photo ? (
            <image href={r.photo} x={(W - W * k) / 2} y={(H - H * k) / 2} width={W * k} height={H * k} preserveAspectRatio="xMidYMid slice" />
          ) : <Photo r={r} box={{ x: M, y: M * 2.4, w: W - 2 * M, h: H - M * 4.8 }} ground="dark" />}
          <defs>
            <linearGradient id={`${id}-t`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#000000" stopOpacity={0.62} />
              <stop offset="100%" stopColor="#000000" stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`${id}-b`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#000000" stopOpacity={0} />
              <stop offset="55%" stopColor="#000000" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#000000" stopOpacity={0.78} />
            </linearGradient>
          </defs>
          <rect x={0} y={0} width={W} height={r.top + logoHeight(lw) + 120 * u} fill={`url(#${id}-t)`} />
          <rect x={0} y={lab - (r.wide ? 180 : 260) * u} width={W} height={H - lab + (r.wide ? 180 : 260) * u} fill={`url(#${id}-b)`} />
          <TopLogo r={r} fill={WHITE} />
          <Label r={r} x={sx(r, M)} y={lab} fill="#D1D1D6" align={startAlign(r)} />
          {h.node}
          {hasFoot(r) ? <Foot r={r} y={footY} fill={WHITE} dim="#D1D1D6" /> : null}
        </>
      );
    }

    default: {
      /* launch — black, the tag (New / Coming soon / In stock) in Hub Blue,
         the headline large */
      const tag = TAG[r.tag][r.lang];
      const lab = r.top + logoHeight(lw) + (r.story ? 120 : 90) * u;
      const tagW = textWidth(caps(tag), 24 * u, 600, r.font) + 24 * u * 0.2 * tag.length + 36 * u;
      const tagBox = place(r, { x: M, y: lab - 30 * u, w: tagW, h: 44 * u });
      const labelX = M + tagW + 20 * u;
      if (r.wide) {
        const colW = W * 0.46;
        const h = headline(r, { x: sx(r, M), y: lab + 40 * u, width: colW - M - 24 * u, size: hs * 1.05, fill: WHITE, fill2: WHITE, align: startAlign(r) });
        return (
          <>
            <rect width={W} height={H} fill={INK} />
            <Photo r={r} box={place(r, { x: colW, y: M * 0.6, w: W - colW - M * 0.6, h: H - M * 1.2 })} ground="dark" />
            <Logo x={r.rtl ? W - M - lw : M} y={r.top} width={lw} fill={WHITE} />
            <rect x={tagBox.x} y={tagBox.y} width={tagBox.w} height={tagBox.h} rx={tagBox.h / 2} fill={HUB_BLUE} />
            <Txt r={r} x={tagBox.x + tagBox.w / 2} y={lab} size={24 * u} fill={WHITE} weight={600} align="center" spacing={24 * u * 0.2}>{caps(tag)}</Txt>
            <Label r={r} x={sx(r, labelX)} y={lab} fill={GREY_ON_INK} align={startAlign(r)} max={colW - labelX - 24 * u} />
            {h.node}
            {hasFoot(r) ? <Foot r={r} y={footY} fill={WHITE} dim={GREY_ON_INK} x1={colW - 24 * u} /> : null}
          </>
        );
      }
      const h = headline(r, { x: sx(r, M), y: lab + 44 * u, width: W - 2 * M, size: hs * 1.1, fill: WHITE, fill2: WHITE, align: startAlign(r) });
      const py = h.bottom + 44 * u;
      return (
        <>
          <rect width={W} height={H} fill={INK} />
          <Photo r={r} box={{ x: M, y: py, w: W - 2 * M, h: r.bottom - footRoom - py }} ground="dark" panelRadius={32} />
          <TopLogo r={r} fill={WHITE} />
          <rect x={tagBox.x} y={tagBox.y} width={tagBox.w} height={tagBox.h} rx={tagBox.h / 2} fill={HUB_BLUE} />
          <Txt r={r} x={tagBox.x + tagBox.w / 2} y={lab} size={24 * u} fill={WHITE} weight={600} align="center" spacing={24 * u * 0.2}>{caps(tag)}</Txt>
          <Label r={r} x={sx(r, labelX)} y={lab} fill={GREY_ON_INK} align={startAlign(r)} max={W - M - labelX} />
          {h.node}
          {hasFoot(r) ? <Foot r={r} y={footY} fill={WHITE} dim={GREY_ON_INK} /> : null}
        </>
      );
    }
  }
}

/** The figures: a hairline over the grid, a hairline between the cells,
 *  the number Light and large, its label in grey capitals. */
function Figures({ r, facts, box, cols }: { r: R; facts: Array<{ value: string; label: string }>; box: Box; cols: number }) {
  const u = r.u;
  const cw = box.w / cols;
  const rows = Math.ceil(facts.length / cols);
  const ch = box.h / rows;
  const nodes: ReactNode[] = [];
  facts.forEach((f, i) => {
    const c = i % cols, row = Math.floor(i / cols);
    const cx0 = r.rtl ? box.x + box.w - (c + 1) * cw : box.x + c * cw;
    const y = box.y + row * ch;
    nodes.push(<rect key={`h${i}`} x={cx0} y={y} width={cw} height={Math.max(1, 1.5 * u)} fill="#D2D2D7" />);
    if (c > 0) nodes.push(<rect key={`v${i}`} x={r.rtl ? cx0 + cw : cx0} y={y + 24 * u} width={Math.max(1, 1.5 * u)} height={ch - 36 * u} fill="#E5E5EA" />);
    const pad = c > 0 ? 28 * u : 0;
    const tx = r.rtl ? cx0 + cw - pad : cx0 + pad;
    const vs = Math.min(72 * u, ((cw - pad - 12 * u) * 72 * u) / Math.max(1, textWidth(f.value, 72 * u, 300, r.font)));
    nodes.push(<Txt key={`v${i}t`} r={r} x={tx} y={y + 30 * u + vs * 0.82} size={vs} fill={f.value === "—" ? "#C7C7CC" : INK} weight={300} align={startAlign(r)} spacing={-vs * 0.02} tabular>{f.value}</Txt>);
    if (f.label) nodes.push(<Txt key={`l${i}`} r={r} x={tx} y={y + 30 * u + vs + 30 * u} size={20 * u} fill={GREY_ON_WHITE} weight={600} align={startAlign(r)} spacing={20 * u * 0.14}>{caps(f.label)}</Txt>);
  });
  return <g>{nodes}</g>;
}

/* ── the template ──────────────────────────────────────────────────────── */

const isStyle = (...s: Style[]) => (v: TemplateValues) => s.includes(styleOf(v));

/** The product's words in a language (English when not translated). */
const byLang = (v: TemplateValues, base: string, lang: Lang) => str(v, `${base}_${lang}`) || str(v, `${base}_en`);

function fromProduct(p: BcProduct, v: TemplateValues): TemplateValues {
  const lang = asLang(v.lang);
  const feat = p.features[0];
  const out: TemplateValues = {
    ...v,
    p_name_en: p.name, p_name_zh: p.nameZh ?? "", p_name_ar: p.nameAr ?? "",
    p_cat_en: p.category ?? "", p_cat_zh: p.categoryZh ?? "", p_cat_ar: p.categoryAr ?? "",
    p_feat_en: feat?.title ?? "", p_feat_zh: feat?.titleZh ?? "", p_feat_ar: feat?.titleAr ?? "",
    p_point: p.highlights[0] ?? "",
    p_featImage: feat?.image ?? "",
    p_photo: p.photo ?? "",
    model: p.model ?? "",
    photo: p.photo ?? "",
    photoOn: "white",
  };
  return withProductWords(out, lang);
}

/** The slots the product fills, in this language and for this style: the
 *  feature style leads with the feature, the others with the name. */
function withProductWords(v: TemplateValues, lang: Lang): TemplateValues {
  if (!str(v, "p_name_en")) return v;
  const feature = styleOf(v) === "feature" && str(v, "p_feat_en");
  return {
    ...v,
    label: feature ? byLang(v, "p_name", lang) : byLang(v, "p_cat", lang),
    headline: feature ? byLang(v, "p_feat", lang) : byLang(v, "p_name", lang),
    /* the Light line: the first selling point, else the KOLEEX model (the
       styles that print the model on their own keep it off the headline) */
    headline2: feature ? "" : (lang === "en" && str(v, "p_point")) || (isStyle("figures", "editorial")(v) ? "" : str(v, "model")),
    photo: feature && str(v, "p_featImage") ? str(v, "p_featImage") : str(v, "p_photo"),
  };
}

/** A new language or style moves the product's words along — but only the
 *  slots still showing them; what someone typed stays. */
function keepEdits(v: TemplateValues, next: TemplateValues, prev: Lang, lang: Lang): TemplateValues {
  const before = withProductWords(v, prev), after = withProductWords(next, lang);
  const out: TemplateValues = { ...next };
  for (const k of ["label", "headline", "headline2", "photo"]) if (v[k] === before[k]) out[k] = after[k];
  return out;
}

export const productPost: TemplateDef = {
  id: "product-post",
  itemKey: "product-posts",
  nameKey: "post.name",
  digital: true,
  usesPeople: false,
  usesProducts: true,
  size: (v) => POST_PX[postSizeOf(v)],
  bleed: 0,
  safe: 72,
  safeFor: postSafe,
  everySize: POST_EVERY_SIZE,
  marks: false,
  fields: [
    choice("style", "tpl.f.style", "look", POST_STYLES, "post.style"),
    ...POST_LOOK,
    { key: "pattern", kind: "choice", labelKey: "pat.field", group: "look", options: patternOptions(false), when: isStyle("pattern", "pattern-dark") },
    { key: "edge", kind: "switch", labelKey: "post.f.edge", group: "look", when: isStyle("book-dark", "book-light", "feature") },
    choice("logoAt", "post.f.logoAt", "look", ["start", "end"] as const, "post.logoAt", isStyle("book-dark", "book-light", "split", "figures", "feature", "editorial", "launch", "factory")),
    choice("tag", "post.f.tag", "look", TAGS, "post.tag", isStyle("launch")),
    { key: "label", kind: "text", labelKey: "post.f.label", group: "words", max: 40, placeholder: "Overlock · Series" },
    { key: "headline", kind: "text", labelKey: "post.f.headline", group: "words", max: 48, placeholder: "Four threads.", hintKey: "post.f.headlineHint" },
    { key: "headline2", kind: "text", labelKey: "post.f.headline2", group: "words", max: 60, placeholder: "One pass." },
    { key: "model", kind: "text", labelKey: "post.f.model", group: "words", max: 24, when: isStyle("figures", "editorial") },
    { key: "facts", kind: "text", labelKey: "post.f.facts", group: "words", max: 160, lines: 4, placeholder: "5,000 | stitches per minute", hintKey: "post.f.factsHint", when: isStyle("figures") },
    { key: "cta", kind: "text", labelKey: "post.f.cta", group: "words", max: 40, hintKey: "post.f.ctaHint" },
    { key: "web", kind: "switch", labelKey: "post.f.web", group: "words" },
    ...photoFields(),
  ],
  defaults: {
    style: "book-dark", size: "feed", lang: "en", pattern: "scan-edge", edge: true, logoAt: "start", tag: "new",
    label: "", headline: "", headline2: "", model: "", facts: "", cta: CTA.en, web: true,
    photo: "", photoOn: "white", photoScale: 100,
  },
  fromProduct,
  fillName: (v) => str(v, "headline") || str(v, "model"),
  /* the hook, then the machine by its name and KOLEEX model, its first point */
  caption: (v) => {
    const lang = asLang(v.lang);
    const name = str(v, `p_name_${lang}`) || str(v, "p_name_en");
    const machine = [name, str(v, "model")].filter(Boolean).join(" — ");
    return captionOf([str(v, "headline"), str(v, "headline2")].filter(Boolean).join(" "), machine, lang === "en" ? str(v, "p_point") : "", hashtags("Garment machinery", str(v, "p_cat_en")));
  },
  relang: (v, lang) => {
    const next = asLang(lang), prev = asLang(v.lang);
    const out = keepEdits(v, { ...v, lang: next }, prev, next);
    if (str(v, "cta") === CTA[prev] || !str(v, "cta")) out.cta = CTA[next];
    return out;
  },
  restyle: (v, style) => keepEdits(v, { ...v, style }, asLang(v.lang), asLang(v.lang)),
  specKeys: (v) => [
    `post.spec.size.${postSizeOf(v)}`,
    "post.spec.text",
    "post.spec.photo",
    "post.spec.price",
    ...(styleOf(v) === "factory" ? ["post.spec.factory"] : []),
    "post.spec.caption",
  ],
  check: (v) => {
    if (!str(v, "headline")) return "post.needHeadline";
    if (!str(v, "photo")) return "post.needPhoto";
    if (styleOf(v) === "figures" && !str(v, "facts")) return "post.needFacts";
    return null;
  },
  forSaving: (v) => {
    /* the look is kept; the product and the picture are chosen again */
    const out: TemplateValues = { ...v, photo: "" };
    for (const k of Object.keys(out)) if (k.startsWith("p_")) delete out[k];
    return out;
  },
  pages: [{ id: "post", draw: drawPost }],
};
