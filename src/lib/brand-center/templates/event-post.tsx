/* ---------------------------------------------------------------------------
   Event post (plan step C15) — before, during and after a fair or a webinar,
   in pixels, saved as a picture.

   The owner's kinds (workshop, digital → event posts): save the date,
   countdown, live from the booth, recap / thank you, webinar. The book:
   ch. 80 (the Event post "Meet us at / booth 000.", the Bento board — black
   tiles on white, one fact per tile, the booth number the largest text in
   an outlined box, the event's logo on a white tab and never on black, no
   KOLEEX edge; event photo posts — "KOLEEX | event | DAY n", dark bands,
   the website at the foot, no edge) and ch. 116 (CISMA: "Meet us at" with
   hall and booth four weeks before; one photo a day; a thank-you after).

   The words follow the kind and the event's own slots unless typed: leave
   the label or the headline empty and the post writes them.
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import type { DrawContext, FieldDef, TemplateDef, TemplateValues } from "./types";
import { GREY_ON_INK, GREY_ON_WHITE, INK, Logo, WHITE, logoHeight, textWidth } from "./card/parts";
import { asLang, num, str, type Lang } from "./card/model";
import { Pattern, patternOptions } from "./patterns";
import {
  Bands, Edge, Foot, FullPhoto, Label, POST_LOOK, POST_PX, Photo, TopLogo, Txt, caps, choice, hasFoot, headline, headlineAbove,
  POST_EVERY_SIZE, oneOf, photoFields, place, postSafe, postSizeOf, readPost, startAlign, sx, type Box, type PostR, NO_SHEET, captionOf, hashtags,
} from "./post-kit";

export const EVENT_STYLES = ["bento", "book", "countdown", "photo", "pattern", "light"] as const;
type Style = (typeof EVENT_STYLES)[number];
const styleOf = (v: TemplateValues): Style => oneOf(EVENT_STYLES, v.style, "bento");
const KINDS = ["save", "countdown", "live", "recap", "webinar"] as const;
type Kind = (typeof KINDS)[number];
const kindOf = (v: TemplateValues): Kind => oneOf(KINDS, v.kind, "save");

/* ── the words each kind writes (EN / ZH / AR) ─────────────────────────── */

type Words = { label: string; one: string; two: string };
type Ev = { event: string; city: string; dates: string; hall: string; booth: string; days: number; day: number; time: string; tz: string };
const place2 = (e: Ev, lang: Lang) => [e.hall && `${W3.hall[lang]} ${e.hall}`, e.booth && `${W3.booth[lang]} ${e.booth}`].filter(Boolean).join(" · ");
const W3 = {
  hall: { en: "Hall", zh: "展馆", ar: "قاعة" },
  booth: { en: "Booth", zh: "展位", ar: "جناح" },
  boothBig: { en: "Booth", zh: "展位", ar: "الجناح" },
  day: { en: "Day", zh: "第", ar: "اليوم" },
  daysToGo: { en: "days to go", zh: "天后开幕", ar: "يومًا على الافتتاح" },
  dayToGo: { en: "day to go", zh: "天后开幕", ar: "يوم على الافتتاح" },
  online: { en: "Online", zh: "线上", ar: "أونلاين" },
  date: { en: "Date", zh: "日期", ar: "التاريخ" },
  time: { en: "Time", zh: "时间", ar: "الوقت" },
  where: { en: "Where", zh: "地点", ar: "المكان" },
} as const;
function autoWords(kind: Kind, e: Ev, lang: Lang): Words {
  const at = [e.dates, e.city].filter(Boolean).join(" · ");
  const pl = place2(e, lang);
  const dayWord = lang === "zh" ? `第${e.day}天` : `${W3.day[lang]} ${e.day}`;
  switch (kind) {
    case "save": return {
      label: { en: "Save the date", zh: "敬请预留日期", ar: "احجز الموعد" }[lang],
      one: e.event ? { en: `Meet us at ${e.event}.`, zh: `${e.event}，与您相见。`, ar: `قابلنا في ${e.event}.` }[lang] : { en: "Meet us there.", zh: "与您相见。", ar: "قابلنا هناك." }[lang],
      two: pl || at,
    };
    case "countdown": return {
      label: [e.event, e.city].filter(Boolean).join(" · "),
      one: e.days === 1 ? W3.dayToGo[lang] : W3.daysToGo[lang],
      two: pl,
    };
    case "live": return {
      label: [e.event, dayWord].filter(Boolean).join(" · "),
      one: { en: "Live from our booth.", zh: "展位现场直击。", ar: "مباشر من جناحنا." }[lang],
      two: pl,
    };
    case "recap": return {
      label: e.event,
      one: { en: "Thank you for visiting us.", zh: "感谢莅临。", ar: "شكرًا لزيارتكم." }[lang],
      two: { en: "See you next year.", zh: "明年再会。", ar: "نراكم العام القادم." }[lang],
    };
    default: return {
      label: { en: "Live webinar", zh: "线上研讨会", ar: "ندوة مباشرة" }[lang],
      one: e.event || { en: "Webinar", zh: "研讨会", ar: "ندوة" }[lang],
      two: [e.dates, [e.time, e.tz].filter(Boolean).join(" ")].filter(Boolean).join(" · "),
    };
  }
}
const CTA: Record<Kind, Record<Lang, string>> = {
  save: { en: "Book a meeting", zh: "预约会面", ar: "احجز موعدًا" },
  countdown: { en: "Book a meeting", zh: "预约会面", ar: "احجز موعدًا" },
  live: { en: "", zh: "", ar: "" },
  recap: { en: "", zh: "", ar: "" },
  webinar: { en: "Register now", zh: "立即报名", ar: "سجّل الآن" },
};
const LINE: Record<Lang, [string, string]> = { en: ["From Design", "to Intelligence"], zh: ["从设计", "到智能"], ar: ["من التصميم", "إلى الذكاء"] };

function read(v: TemplateValues, ctx: DrawContext) {
  const base = readPost(v, ctx);
  const ev: Ev = {
    event: str(v, "event"), city: str(v, "city"), dates: str(v, "dates"), hall: str(v, "hall"), booth: str(v, "booth"),
    days: Math.round(num(v, "days", 28)), day: Math.round(num(v, "day", 1)), time: str(v, "time"), tz: str(v, "tz"),
  };
  const kind = kindOf(v);
  const auto = autoWords(kind, ev, base.lang);
  return {
    ...base, ...ev, kind,
    label: base.label || auto.label, headline: base.headline || auto.one, headline2: base.headline2 || auto.two, typed2: base.headline2,
    line: [str(v, "line1") || LINE[base.lang][0], str(v, "line2") || LINE[base.lang][1]] as [string, string],
    eventLogo: str(v, "eventLogo"),
  };
}
type R = ReturnType<typeof read>;

/** The event's own logo keeps its colours on a white tab — never on black (ch. 44). */
function EventTab({ r, box }: { r: R; box: Box }) {
  if (!r.eventLogo) return null;
  const pad = Math.min(box.w, box.h) * 0.16;
  return (
    <g>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={14 * r.u} fill={WHITE} />
      <image href={r.eventLogo} x={box.x + pad} y={box.y + pad} width={box.w - pad * 2} height={box.h - pad * 2} preserveAspectRatio="xMidYMid meet" />
    </g>
  );
}

/** Facts in a hairline grid: a grey caption over each value. */
function FactRow({ r, box, cells, dark }: { r: PostR; box: Box; cells: Array<{ k: string; v: string }>; dark: boolean }) {
  const shown = cells.filter((c) => c.v);
  if (!shown.length) return null;
  const u = r.u;
  const cw = box.w / shown.length;
  const line = dark ? "#3A3A3C" : "#D2D2D7";
  return (
    <g>
      <rect x={box.x} y={box.y} width={box.w} height={Math.max(1, 1.5 * u)} fill={line} />
      {shown.map((c, i) => {
        const x0 = r.rtl ? box.x + box.w - (i + 1) * cw : box.x + i * cw;
        const pad = i > 0 ? 24 * u : 0;
        const tx = r.rtl ? x0 + cw - pad : x0 + pad;
        const vs = Math.min(40 * u, ((cw - pad - 16 * u) * 40 * u) / Math.max(1, textWidth(c.v, 40 * u, 600, r.font)));
        return (
          <g key={i}>
            {i > 0 ? <rect x={r.rtl ? x0 + cw : x0} y={box.y + 22 * u} width={Math.max(1, 1.5 * u)} height={box.h - 30 * u} fill={line} /> : null}
            <Txt r={r} x={tx} y={box.y + 50 * u} size={20 * u} fill={dark ? GREY_ON_INK : GREY_ON_WHITE} weight={600} align={startAlign(r)} spacing={20 * u * 0.14}>{caps(c.k)}</Txt>
            <Txt r={r} x={tx} y={box.y + 50 * u + 16 * u + vs} size={vs} fill={dark ? WHITE : INK} weight={600} align={startAlign(r)}>{c.v}</Txt>
          </g>
        );
      })}
    </g>
  );
}

/** The booth number in its outlined box — the largest text on the post. */
function BoothBox({ r, x, y, w, h, fill, stroke }: { r: R; x: number; y: number; w: number; h: number; fill: string; stroke: string }) {
  const text = r.booth || "—";
  const s = Math.min(h * 0.62, (w * 0.8 * h * 0.62) / Math.max(1, textWidth(text, h * 0.62, 700, r.font)));
  const bw = Math.min(w, textWidth(text, s, 700, r.font) + s * 0.7);
  const bx = r.rtl ? x + w - bw : x;
  return (
    <g>
      <rect x={bx} y={y} width={bw} height={h} rx={14 * r.u} fill="none" stroke={stroke} strokeWidth={4 * r.u} />
      <Txt r={r} x={bx + bw / 2} y={y + h / 2 + s * 0.36} size={s} fill={fill} weight={700} align="center">{text}</Txt>
    </g>
  );
}

/* ── the styles ────────────────────────────────────────────────────────── */

function drawPost(v: TemplateValues, ctx: DrawContext): ReactNode {
  const r = read(v, ctx);
  const { W, H, u, M } = r;
  const style = styleOf(v);
  const lw = 220 * u;
  const footY = r.bottom - 6 * u;
  const footRoom = hasFoot(r) ? 70 * u : 0;
  const hs = (r.story ? 92 : r.wide ? 60 : r.size === "square" ? 74 : 84) * u;
  const lang = r.lang;

  switch (style) {
    case "bento": {
      /* the book's board: black tiles on white, one fact each */
      const g = 12 * u, m = M * 0.5, rad = 24 * u;
      const tiles: Box[] = [];
      if (r.wide) {
        const cw = (W - 2 * m - 2 * g) / 4, rh = (H - 2 * m - g) / 2;
        const c = [m, m + cw + g, m + 3 * cw + 2 * g];
        tiles.push({ x: c[0], y: m, w: cw, h: rh * 2 + g }); // 1 the invitation
        tiles.push({ x: c[1], y: m, w: cw * 2, h: rh }); // 2 dates + city
        tiles.push({ x: c[2], y: m, w: cw, h: rh }); // 3 the machine
        tiles.push({ x: c[2], y: m + rh + g, w: cw, h: rh }); // 4 the booth
        tiles.push({ x: c[1], y: m + rh + g, w: cw * 2, h: rh }); // 5 the line
      } else {
        const top = r.story ? r.top - 40 * u : m, bot = r.story ? r.bottom + 40 * u : H - m;
        const cw = (W - 2 * m - g) / 2;
        const rows = [0.36, 0.34, 0.3].map((f) => f * (bot - top - 2 * g));
        const y1 = top, y2 = y1 + rows[0] + g, y3 = y2 + rows[1] + g;
        tiles.push({ x: m, y: y1, w: cw, h: rows[0] + g + rows[1] });
        tiles.push({ x: m + cw + g, y: y1, w: cw, h: rows[0] });
        tiles.push({ x: m + cw + g, y: y2, w: cw, h: rows[1] });
        tiles.push({ x: m, y: y3, w: cw, h: rows[2] });
        tiles.push({ x: m + cw + g, y: y3, w: cw, h: rows[2] });
      }
      const [t1, t2, t3, t4, t5] = tiles.map((t) => place(r, t));
      const p = 36 * u;
      const tlw = Math.min(t1.w - 2 * p, 200 * u);
      const inner = (t: Box, x: number) => (r.rtl ? t.x + t.w - x : t.x + x);
      const kindWord = r.label;
      const h1 = headline(r, { x: inner(t1, p), y: t1.y + p + logoHeight(tlw) + 60 * u, width: t1.w - 2 * p, size: 60 * u, fill: WHITE, fill2: GREY_ON_INK, align: startAlign(r), one: kindWord, two: r.headline });
      const h5 = headlineAbove(r, { x: inner(t5, p), bottom: t5.y + t5.h - p, width: t5.w - 2 * p, size: 44 * u, fill: WHITE, align: startAlign(r), one: r.line[0], two: r.line[1] });
      const dateS = Math.min(56 * u, ((t2.w - 2 * p) * 56 * u) / Math.max(1, textWidth(r.dates || "—", 56 * u, 700, r.font)));
      return (
        <>
          <rect width={W} height={H} fill={WHITE} />
          {tiles.map((t, i) => <rect key={i} x={place(r, t).x} y={t.y} width={t.w} height={t.h} rx={rad} fill={INK} />)}
          {/* 1 — the invitation */}
          <Logo x={r.rtl ? t1.x + t1.w - p - tlw : t1.x + p} y={t1.y + p} width={tlw} fill={WHITE} />
          {h1.node}
          <Txt r={r} x={inner(t1, p)} y={t1.y + t1.h - p} size={26 * u} fill={GREY_ON_INK} align={startAlign(r)}>{r.web}</Txt>
          {/* 2 — the dates and the city, the event's tab */}
          {r.eventLogo ? <EventTab r={r} box={{ x: r.rtl ? t2.x + p : t2.x + t2.w - p - 150 * u, y: t2.y + p, w: 150 * u, h: 64 * u }} /> : null}
          <Txt r={r} x={inner(t2, p)} y={t2.y + t2.h - p - 44 * u} size={dateS} fill={WHITE} weight={700} align={startAlign(r)}>{r.dates || "—"}</Txt>
          <Txt r={r} x={inner(t2, p)} y={t2.y + t2.h - p} size={36 * u} fill={GREY_ON_INK} weight={300} align={startAlign(r)}>{[r.event, r.city].filter(Boolean).join(" · ")}</Txt>
          {/* 3 — the machine */}
          <Photo r={r} box={{ x: t3.x + p * 0.5, y: t3.y + p * 0.5, w: t3.w - p, h: t3.h - p }} ground="dark" panelRadius={16} />
          {/* 4 — the booth */}
          <Txt r={r} x={inner(t4, p)} y={t4.y + p + 22 * u} size={24 * u} fill={GREY_ON_INK} weight={600} align={startAlign(r)} spacing={24 * u * 0.2}>{caps([r.hall && `${W3.hall[lang]} ${r.hall}`, W3.boothBig[lang]].filter(Boolean).join(" · "))}</Txt>
          <BoothBox r={r} x={t4.x + p} y={t4.y + p + 50 * u} w={t4.w - 2 * p} h={t4.h - 2 * p - 50 * u} fill={WHITE} stroke={WHITE} />
          {/* 5 — the line */}
          {h5.node}
        </>
      );
    }

    case "book": {
      /* the book's Event post: dark, "Meet us at / booth 000.", the facts in a grid */
      const lab = r.top + logoHeight(lw) + (r.story ? 120 : 96) * u;
      const colW = r.wide ? W * 0.5 : W - 2 * M;
      const h = headline(r, { x: sx(r, M), y: lab + 30 * u, width: colW, size: hs * 1.05, fill: WHITE, fill2: GREY_ON_INK, align: startAlign(r), two: r.typed2 });
      const cells = r.kind === "webinar"
        ? [{ k: W3.date[lang], v: r.dates }, { k: W3.time[lang], v: [r.time, r.tz].filter(Boolean).join(" ") }, { k: W3.where[lang], v: W3.online[lang] }]
        : [{ k: W3.date[lang], v: r.dates }, { k: W3.where[lang], v: r.city }, { k: W3.boothBig[lang], v: [r.hall, r.booth].filter(Boolean).join(" · ") }];
      const gridY = h.bottom + 44 * u;
      const photoBox = r.wide
        ? place(r, { x: W * 0.54, y: M * 0.6, w: W * 0.46 - M * 0.6, h: H - M * 1.2 })
        : { x: M, y: gridY + 150 * u, w: W - 2 * M, h: r.bottom - footRoom - 30 * u - (gridY + 150 * u) };
      return (
        <>
          <rect width={W} height={H} fill={INK} />
          {r.photo || !r.wide ? (photoBox.h > 120 * u ? <Photo r={r} box={photoBox} ground="dark" /> : null) : null}
          <Edge r={r} fill={WHITE} />
          <TopLogo r={r} fill={WHITE} />
          {r.eventLogo ? <EventTab r={r} box={place(r, { x: W - M - 170 * u, y: r.top - 10 * u, w: 170 * u, h: 72 * u })} /> : null}
          <Label r={r} x={sx(r, M)} y={lab} fill={GREY_ON_INK} align={startAlign(r)} max={colW} />
          {h.node}
          <FactRow r={r} box={place(r, { x: M, y: gridY, w: colW, h: 120 * u })} cells={cells} dark />
          {hasFoot(r) ? <Foot r={r} y={footY} fill={WHITE} dim={GREY_ON_INK} x1={r.wide ? W * 0.5 : undefined} /> : null}
        </>
      );
    }

    case "countdown": {
      /* the number of days as the picture */
      const n = String(Math.max(0, r.days));
      const cx = r.wide ? W * 0.3 : W / 2;
      const maxS = (r.wide ? 420 : r.story ? 620 : r.size === "square" ? 440 : 560) * u;
      const bigS = Math.min(maxS, ((r.wide ? W * 0.5 : W - 2 * M) * maxS) / Math.max(1, textWidth(n, maxS, 200, r.font)));
      const lab = r.top + logoHeight(lw) + 80 * u;
      const bigY = r.wide ? H * 0.5 + bigS * 0.36 : lab + 40 * u + bigS * 0.78;
      const area = r.wide ? { x0: W * 0.55, y0: 0, w: W * 0.45, h: H } : { x0: 0, y0: 0, w: W, h: H };
      const h = headline(r, { x: r.wide ? sx(r, M) : cx, y: bigY + 30 * u, width: r.wide ? W * 0.5 : W - 2 * M, size: hs * 0.8, fill: WHITE, fill2: GREY_ON_INK, align: r.wide ? startAlign(r) : "center" });
      return (
        <>
          <rect width={W} height={H} fill={INK} />
          <Pattern id={r.pattern} area={area} dark mirror={r.rtl} uid={`${r.uid}-cd`}
            clear={r.wide ? [{ x: W * 0.55, y: r.bottom - 60 * u, w: W * 0.45, h: 90 * u }] : [{ x: M * 0.5, y: r.top - 20 * u, w: W - M, h: h.bottom + 30 * u - r.top }, { x: 0, y: r.bottom - 60 * u, w: W, h: 90 * u }]} />
          <TopLogo r={r} fill={WHITE} />
          <Label r={r} x={r.wide ? sx(r, M) : cx} y={lab} fill={GREY_ON_INK} align={r.wide ? startAlign(r) : "center"} />
          <Txt r={r} x={r.wide ? sx(r, M) : cx} y={bigY} size={bigS} fill={WHITE} weight={200} align={r.wide ? startAlign(r) : "center"} spacing={-bigS * 0.04} tabular>{n}</Txt>
          {h.node}
          {hasFoot(r) ? <Foot r={r} y={footY} fill={WHITE} dim={GREY_ON_INK} /> : null}
        </>
      );
    }

    case "photo": {
      /* live / recap: our photo to every edge, the header and the foot on dark bands (no edge) */
      const head = r.top + logoHeight(lw * 0.8) * 0.8;
      const probe = headline(r, { x: 0, y: 0, width: r.wide ? W * 0.6 : W - 2 * M, size: hs * 0.9, fill: WHITE, align: startAlign(r) });
      const headTop = r.bottom - footRoom - probe.bottom - 8 * u;
      const bar = 3 * u, lx = r.rtl ? W - M - lw * 0.8 : M;
      const sepX = r.rtl ? lx - 24 * u : lx + lw * 0.8 + 24 * u;
      return (
        <>
          <rect width={W} height={H} fill="#1C1C1E" />
          {r.photo ? <FullPhoto r={r} /> : <Photo r={r} box={{ x: M, y: r.top + 120 * u, w: W - 2 * M, h: headTop - r.top - 180 * u }} ground="dark" />}
          <Bands r={r} top={r.top + 150 * u} bottomFrom={headTop - 200 * u} />
          <Logo x={lx} y={r.top} width={lw * 0.8} fill={WHITE} />
          <rect x={sepX - bar / 2} y={r.top - 4 * u} width={bar} height={logoHeight(lw * 0.8) + 8 * u} fill={WHITE} opacity={0.7} />
          <Txt r={r} x={r.rtl ? sepX - 24 * u : sepX + 24 * u} y={head} size={28 * u} fill={WHITE} weight={600} align={startAlign(r)} spacing={28 * u * 0.12}>{caps(r.label)}</Txt>
          {headline(r, { x: sx(r, M), y: headTop, width: r.wide ? W * 0.6 : W - 2 * M, size: hs * 0.9, fill: WHITE, fill2: "#E5E5EA", align: startAlign(r) }).node}
          {hasFoot(r) ? <Foot r={r} y={footY} fill={WHITE} dim="#D1D1D6" /> : null}
        </>
      );
    }

    case "pattern": {
      /* save the date: the KOLEEX pattern down the end side, the dates large */
      const pw = W * (r.wide ? 0.3 : 0.34);
      const colW = W - pw - M;
      const lab = r.top + logoHeight(lw) + (r.story ? 140 : 110) * u;
      const dS = Math.min(150 * u, ((colW - M) * 150 * u) / Math.max(1, textWidth(r.dates || "—", 150 * u, 200, r.font)));
      const h = headline(r, { x: sx(r, M), y: lab + 40 * u + dS * 1.1, width: colW - M, size: hs * 0.8, fill: WHITE, fill2: GREY_ON_INK, align: startAlign(r), two: r.typed2 || (r.booth ? r.city : r.headline2) });
      return (
        <>
          <rect width={W} height={H} fill={INK} />
          <Pattern id={r.pattern} area={{ x0: r.rtl ? 0 : W - pw, y0: 0, w: pw, h: H }} dark mirror={r.rtl} uid={`${r.uid}-sp`} />
          <Logo x={r.rtl ? W - M - lw : M} y={r.top} width={lw} fill={WHITE} />
          <Label r={r} x={sx(r, M)} y={lab} fill={GREY_ON_INK} align={startAlign(r)} max={colW - M} />
          <Txt r={r} x={sx(r, M)} y={lab + 40 * u + dS * 0.82} size={dS} fill={WHITE} weight={200} align={startAlign(r)} spacing={-dS * 0.03}>{r.dates || "—"}</Txt>
          {h.node}
          {r.booth ? <BoothBox r={r} x={r.rtl ? W - M - 300 * u : M} y={h.bottom + 40 * u} w={300 * u} h={110 * u} fill={WHITE} stroke={WHITE} /> : null}
          {r.eventLogo ? <EventTab r={r} box={place(r, { x: M, y: r.bottom - footRoom - 110 * u, w: 190 * u, h: 80 * u })} /> : null}
          {hasFoot(r) ? <Foot r={r} y={footY} fill={WHITE} dim={GREY_ON_INK} x1={r.rtl ? W - M : colW} x0={r.rtl ? pw : M} /> : null}
        </>
      );
    }

    default: {
      /* light — a white card: the facts in a grid, the photo below (a webinar's speaker, a machine) */
      const lab = r.top + logoHeight(lw) + (r.story ? 120 : 96) * u;
      const colW = r.wide ? W * 0.5 : W - 2 * M;
      const h = headline(r, { x: sx(r, M), y: lab + 30 * u, width: colW, size: hs, fill: INK, fill2: "#3A3A3C", align: startAlign(r), two: r.typed2 });
      const cells = r.kind === "webinar"
        ? [{ k: W3.date[lang], v: r.dates }, { k: W3.time[lang], v: [r.time, r.tz].filter(Boolean).join(" ") }, { k: W3.where[lang], v: W3.online[lang] }]
        : [{ k: W3.date[lang], v: r.dates }, { k: W3.where[lang], v: r.city }, { k: W3.boothBig[lang], v: [r.hall, r.booth].filter(Boolean).join(" · ") }];
      const gridY = h.bottom + 44 * u;
      const photoBox = r.wide
        ? place(r, { x: W * 0.54, y: M * 0.6, w: W * 0.46 - M * 0.6, h: H - M * 1.2 })
        : { x: M, y: gridY + 150 * u, w: W - 2 * M, h: r.bottom - footRoom - 30 * u - (gridY + 150 * u) };
      return (
        <>
          <rect width={W} height={H} fill={WHITE} />
          {photoBox.h > 120 * u ? <Photo r={r} box={photoBox} ground="light" /> : null}
          <Edge r={r} fill={INK} />
          <TopLogo r={r} fill={INK} />
          {r.eventLogo ? <EventTab r={r} box={place(r, { x: W - M - 170 * u, y: r.top - 10 * u, w: 170 * u, h: 72 * u })} /> : null}
          <Label r={r} x={sx(r, M)} y={lab} fill={GREY_ON_WHITE} align={startAlign(r)} max={colW} />
          {h.node}
          <FactRow r={r} box={place(r, { x: M, y: gridY, w: colW, h: 120 * u })} cells={cells} dark={false} />
          {hasFoot(r) ? <Foot r={r} y={footY} fill={INK} dim={GREY_ON_WHITE} x1={r.wide ? W * 0.5 : undefined} /> : null}
        </>
      );
    }
  }
}

/* ── the template ──────────────────────────────────────────────────────── */

const isStyle = (...s: Style[]) => (v: TemplateValues) => s.includes(styleOf(v));
const isKind = (...k: Kind[]) => (v: TemplateValues) => k.includes(kindOf(v));

/** A kind (or a language) brings its call to action — unless one was typed. */
const knownCta = (x: string) => KINDS.some((k) => Object.values(CTA[k]).includes(x));
function withCta(v: TemplateValues, kind: Kind, lang: Lang): TemplateValues {
  const cta = str(v, "cta");
  return !cta || knownCta(cta) ? { ...v, cta: CTA[kind][lang] } : v;
}

export const eventPost: TemplateDef = {
  id: "event-post",
  itemKey: "event-posts",
  nameKey: "evp.name",
  digital: true,
  usesPeople: false,
  size: (v) => POST_PX[postSizeOf(v)],
  bleed: 0,
  safe: 72,
  safeFor: postSafe,
  everySize: POST_EVERY_SIZE,
  marks: false,
  fields: [
    choice("style", "tpl.f.style", "look", EVENT_STYLES, "evp.style"),
    choice("kind", "evp.f.kind", "look", KINDS, "evp.kind"),
    ...POST_LOOK,
    { key: "pattern", kind: "choice", labelKey: "pat.field", group: "look", options: patternOptions(false), when: isStyle("countdown", "pattern") },
    { key: "edge", kind: "switch", labelKey: "post.f.edge", group: "look", when: isStyle("book", "light") },
    { key: "event", kind: "text", labelKey: "evp.f.event", group: "event", max: 48, placeholder: "CISMA 2026", hintKey: "evp.f.eventHint" },
    { key: "city", kind: "text", labelKey: "evp.f.city", group: "event", max: 40, placeholder: "Shanghai", when: (v) => kindOf(v) !== "webinar" },
    { key: "dates", kind: "text", labelKey: "evp.f.dates", group: "event", max: 32, placeholder: "24–27/09/2026", hintKey: "evp.f.datesHint" },
    { key: "hall", kind: "text", labelKey: "evp.f.hall", group: "event", max: 12, placeholder: "W5", when: (v) => kindOf(v) !== "webinar" },
    { key: "booth", kind: "text", labelKey: "evp.f.booth", group: "event", max: 12, placeholder: "C42", when: (v) => kindOf(v) !== "webinar" },
    { key: "days", kind: "range", labelKey: "evp.f.days", group: "event", min: 1, max: 60, step: 1, when: isKind("countdown") },
    { key: "day", kind: "range", labelKey: "evp.f.day", group: "event", min: 1, max: 7, step: 1, when: isKind("live") },
    { key: "time", kind: "text", labelKey: "evp.f.time", group: "event", max: 16, placeholder: "15:00", when: isKind("webinar") },
    { key: "tz", kind: "text", labelKey: "evp.f.tz", group: "event", max: 16, placeholder: "GMT+8", when: isKind("webinar") },
    { key: "eventLogo", kind: "image", labelKey: "evp.f.eventLogo", group: "event", hintKey: "evp.f.eventLogoHint" },
    { key: "label", kind: "text", labelKey: "post.f.label", group: "words", max: 48, hintKey: "evp.f.autoHint" },
    { key: "headline", kind: "text", labelKey: "post.f.headline", group: "words", max: 60, hintKey: "evp.f.autoHint" },
    { key: "headline2", kind: "text", labelKey: "post.f.headline2", group: "words", max: 60 },
    { key: "line1", kind: "text", labelKey: "evp.f.line1", group: "words", max: 32, placeholder: "From Design", when: isStyle("bento") },
    { key: "line2", kind: "text", labelKey: "evp.f.line2", group: "words", max: 32, placeholder: "to Intelligence", when: isStyle("bento") },
    { key: "cta", kind: "text", labelKey: "post.f.cta", group: "words", max: 40, hintKey: "post.f.ctaHint" },
    { key: "web", kind: "switch", labelKey: "post.f.web", group: "words" },
    ...photoFields(undefined, "evp.f.photo", "evp.f.photoHint"),
  ] as FieldDef[],
  defaults: {
    style: "bento", kind: "save", size: "feed", lang: "en", pattern: "scan-edge", edge: true, logoAt: "start",
    event: "", city: "", dates: "", hall: "", booth: "", days: 28, day: 1, time: "", tz: "", eventLogo: "",
    label: "", headline: "", headline2: "", line1: "", line2: "", cta: CTA.save.en, web: true,
    photo: "", photoOn: "white", photoScale: 100,
  },
  fillName: (v) => [str(v, "event"), kindOf(v)].filter(Boolean).join(" "),
  /* the same words as the post: its label, the two lines, the call */
  caption: (v) => {
    const r = read(v, NO_SHEET);
    return captionOf([r.label, r.headline].filter(Boolean).join(" — "), r.headline2, str(v, "cta"), hashtags(r.event, "Garment machinery"));
  },
  relang: (v, lang) => withCta({ ...v, lang }, kindOf(v), asLang(lang)),
  rekey: { kind: (v, value) => withCta({ ...v, kind: value }, oneOf(KINDS, value, "save"), asLang(v.lang)) },
  specKeys: (v) => [
    `post.spec.size.${postSizeOf(v)}`,
    ...(styleOf(v) === "bento" ? ["evp.spec.bento"] : []),
    ...(styleOf(v) === "photo" ? ["evp.spec.photo"] : []),
    "evp.spec.dates",
    "evp.spec.eventLogo",
    "evp.spec.rhythm",
  ],
  check: (v) => {
    if (!str(v, "event")) return "evp.needEvent";
    if (styleOf(v) === "photo" && !str(v, "photo")) return "post.needPhoto";
    return null;
  },
  forSaving: (v) => ({ ...v, photo: "", eventLogo: "" }),
  pages: [{ id: "post", draw: drawPost }],
};
