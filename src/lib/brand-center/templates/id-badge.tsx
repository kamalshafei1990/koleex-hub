/* ---------------------------------------------------------------------------
   Staff ID badge (plan step C10; owner 29/09: "more styles, everything
   editable, professional").

   The book's badge (HR documents, "The ID badge") is the standard style:
   54 × 86 mm portrait, a black band with the white logo, the team portrait
   (ch. 66: 4 : 5, on black, cool and muted colour — or black and white for a
   whole series), the name, the job title and the staff number — no personal
   data beyond that. Five more styles keep those rules: black, full-width
   photo, dots (ch. 57), landscape and minimal. Optional: a status band
   (STAFF / VISITOR …), department, validity, QR codes (the staff number for
   scanners, a contact card, a link) and a back with the return address.
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import type { BcPerson } from "@/lib/brand-center/client";
import { KOLEEX_COMPANY } from "@/components/brand/DocumentBrandStrips";
import { EVERYDAY_NAME_EN } from "@/lib/legal-name";
import { PT, type DrawContext, type QrRequest, type TemplateDef, type TemplateItem, type TemplateValues } from "./types";
import { CARD_ADDRESS, LANGS, asLang, fontOf, isPictureQr, list, num, qrsOf, str, type Lang } from "./card/model";
import { Dots, GREY_ON_INK, GREY_ON_WHITE, GroupLockup, INK, Logo, Photo, PhotoPlaceholder, QrZone, WHITE, fit, lockupHeight, lockupLines, logoHeight, textWidth, wrapBalanced, type Zone } from "./card/parts";
import { nameIn, titleOf } from "./person";
import { ID_PREMIUM, drawIdPremium, idPremiumDark, isIdPremium } from "./id-badge-premium";
import { BIG_LINE, ID_REFS, ID_REF_LOGO_SWITCH, drawIdRefBack, drawIdRefFront, idRefDie, idRefNeedsPhoto, idRefSpecKeys, isIdRef } from "./id-badge-reference";
import { patternOptions } from "./patterns";

/** The first six, then the premium set (owner 30/09/2026) beside them, then
 *  his seven references rebuilt (drafts until he approves them). */
export const ID_STYLES = ["standard", "black", "photo-full", "dots", "landscape", "minimal", ...ID_PREMIUM, ...ID_REFS] as const;
type IdStyle = (typeof ID_STYLES)[number];
const styleOf = (v: TemplateValues): IdStyle => ((ID_STYLES as readonly string[]).includes(String(v.style)) ? (v.style as IdStyle) : "standard");
const landscape = (v: TemplateValues) => styleOf(v) === "landscape";

const RETURN_TITLE: Record<Lang, string> = {
  en: "If found, please return to",
  zh: "如拾获，请交还至",
  ar: "لو لقيت الكارت ده، رجّعه لـ",
};
/* International format drops the trunk 0 ("+86 576 …", not "+86 0576 …"). */
const DEFAULT_CONTACT = `${KOLEEX_COMPANY.tel.replace(/^\+86 0/, "+86 ")} · ${KOLEEX_COMPANY.web}`;

/** Book measures (the badge drawing is 127 × 200 at 0.425 mm a point). */
const B = { band: 20.4, logo: 27.2, photo: { top: 25.5, w: 24, h: 30, r: 1.7 }, name: 3.8, title: 3.0, id: 2.55 };

function read(v: TemplateValues, ctx: DrawContext) {
  const lang = asLang(v.lang);
  const k = num(v, "scale", 100) / 100;
  const all = qrsOf(v);
  return {
    b: ctx.bleed, w: ctx.w, h: ctx.h, W: ctx.w + ctx.bleed * 2, H: ctx.h + ctx.bleed * 2,
    lang, rtl: lang === "ar", font: fontOf(v), k, uid: ctx.uid, codes: ctx.qrs,
    name: str(v, "name"), title: str(v, "title"), dept: str(v, "dept"),
    staff: str(v, "staffNo"), label: str(v, "idLabel") || "ID", valid: str(v, "valid"), role: str(v, "role").toUpperCase(),
    photo: str(v, "photo"), front: all.filter((q) => q.side === "front"), back: all.filter((q) => q.side === "back"),
  };
}
type R = ReturnType<typeof read>;

function PhotoBox({ v, r, box, radius = 0 }: { v: TemplateValues; r: R; box: { x: number; y: number; w: number; h: number }; radius?: number }) {
  return (
    <>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={radius} fill={INK} />
      {r.photo
        ? <Photo href={r.photo} box={box} radius={radius} tone={v.bw === true ? "bw" : "muted"} zoom={num(v, "photoZoom", 100) / 100}
            px={num(v, "photoX", 0)} py={num(v, "photoY", 0)} soft={false} uid={`${r.uid}-p`} />
        : <PhotoPlaceholder box={box} label="Photo" font={r.font} />}
    </>
  );
}

/** Name (bold), title, department — centred or from the start edge — and
 *  the y below them. */
function NameBlock({ r, x, y, width, align, ink, sub, scale = 1 }: { r: R; x: number; y: number; width: number; align: "middle" | "start"; ink: string; sub: string; scale?: number }) {
  const ns = B.name * r.k * scale;
  const lines = r.name ? (textWidth(r.name, ns, 700, r.font) > width ? wrapBalanced(r.name, ns * 0.88, width, 700, r.font) : [r.name]) : [];
  const size = lines.length > 1 ? ns * 0.88 : ns;
  /* "start" is the right edge in Arabic: the text runs rtl from x. */
  const anchor = align === "middle" ? "middle" : "start";
  let yy = y + size * 0.8;
  const nodes: ReactNode[] = lines.map((l, i) => (
    <text key={`n${i}`} x={x} y={yy + i * size * 1.15} textAnchor={anchor} direction={r.rtl ? "rtl" : "ltr"} fill={ink}
      {...fit(l, size, width, 700, r.font)} style={{ fontFamily: r.font, fontSize: size, fontWeight: 700 }}>{l}</text>
  ));
  yy += (lines.length - 1) * size * 1.15;
  for (const [text, s] of [[r.title, B.title * r.k * scale], [r.dept, B.title * 0.82 * r.k * scale]] as Array<[string, number]>) {
    if (!text) continue;
    yy += s * 1.45;
    nodes.push(
      <text key={text} x={x} y={yy} textAnchor={anchor} direction={r.rtl ? "rtl" : "ltr"} fill={sub}
        {...fit(text, s, width, 400, r.font)} style={{ fontFamily: r.font, fontSize: s }}>{text}</text>,
    );
  }
  return { node: <g>{nodes}</g>, bottom: yy };
}

/** The staff number line ("ID 0001 · Valid until 12/2027"). */
function IdLine({ r, x, y, anchor, fill }: { r: R; x: number; y: number; anchor: "middle" | "start" | "end"; fill: string }) {
  const parts = [r.staff ? `${r.label} ${r.staff}` : "", r.valid].filter(Boolean);
  if (!parts.length) return null;
  const s = B.id * r.k;
  return (
    <text x={x} y={y} textAnchor={anchor} direction="ltr" fill={fill}
      style={{ fontFamily: r.font, fontSize: s, fontVariantNumeric: "tabular-nums", letterSpacing: 0.1 }}>{parts.join("  ·  ")}</text>
  );
}

/** The status band at the foot (STAFF, VISITOR …): black with white
 *  capitals, or white on a black card. Returns its top. */
function RoleBand({ r, x, w, dark }: { r: R; x: number; w: number; dark: boolean }) {
  if (!r.role) return { node: null, top: r.b + r.h };
  const hgt = 7.5;
  const top = r.b + r.h - hgt;
  const s = 7.5 * PT;
  return {
    top,
    node: (
      <g>
        <rect x={x} y={top} width={w} height={r.H - top} fill={dark ? WHITE : INK} />
        <text x={x + w / 2} y={top + hgt / 2 + s * 0.36} textAnchor="middle" fill={dark ? INK : WHITE}
          {...fit(r.role, s, w - 6, 600, r.font)} style={{ fontFamily: r.font, fontSize: s, fontWeight: 600, letterSpacing: s * 0.22 }}>{r.role}</text>
      </g>
    ),
  };
}

/* ── the fronts ────────────────────────────────────────────────────────── */

/** Standard (the book) and black: a logo head, the photo, the name, the number. */
function portraitFront(v: TemplateValues, r: R, look: "standard" | "black" | "dots"): ReactNode {
  const { b, w, W } = r;
  const dark = look === "black";
  const cx = b + w / 2;
  const band = look === "black" ? 0 : B.band;
  const logoY = look === "black" ? b + 7 : b + (B.band - logoHeight(B.logo)) / 2;
  const photoTop = look === "black" ? b + 19 : b + B.photo.top;
  const box = { x: cx - B.photo.w / 2, y: photoTop, w: B.photo.w, h: B.photo.h };
  const ink = dark ? WHITE : "#1D1D1F", sub = dark ? GREY_ON_INK : GREY_ON_WHITE;
  const role = RoleBand({ r, x: 0, w: W, dark });
  const idY = role.top - (r.role ? 3.2 : 3.4);
  const nb = NameBlock({ r, x: cx, y: box.y + box.h + 3.4, width: w - 8, align: "middle", ink, sub });
  const zoneTop = nb.bottom + 2.5;
  const zone: Zone = { x: b + 4, y: zoneTop, w: w - 8, h: Math.max(6, idY - 3.5 - zoneTop), dir: "row", align: "center" };
  const hw = B.logo / 2 + logoHeight(B.logo) * 0.8;
  return (
    <>
      <rect x={0} y={0} width={W} height={r.H} fill={dark ? INK : WHITE} />
      {band ? <rect x={0} y={0} width={W} height={b + band} fill={INK} /> : null}
      {look === "dots" ? (
        <>
          <Dots area={{ x: 0, y: 0, w: W, h: b + band }} fill="#48484A" origin={{ x: cx, y: b + band / 2 }} uid={`${r.uid}-d`} />
          <rect x={cx - hw} y={logoY - logoHeight(B.logo) * 0.8} width={hw * 2} height={logoHeight(B.logo) * 2.6} fill={INK} />
        </>
      ) : null}
      <Logo x={cx - B.logo / 2} y={logoY} width={B.logo} fill={WHITE} />
      <PhotoBox v={v} r={r} box={box} radius={B.photo.r} />
      {nb.node}
      <QrZone items={r.front} codes={r.codes} font={r.font} captionFill={sub} max={12} zone={zone} />
      <IdLine r={r} x={cx} y={idY} anchor="middle" fill={sub} />
      {role.node}
    </>
  );
}

/** Full-width photo: the portrait across the top, the logo on a soft shade,
 *  the name on white below. */
function photoFullFront(v: TemplateValues, r: R): ReactNode {
  const { b, w, W } = r;
  const box = { x: 0, y: 0, w: W, h: b + 52 };
  const start = r.rtl ? b + w - 4.5 : b + 4.5;
  const role = RoleBand({ r, x: 0, w: W, dark: false });
  const nb = NameBlock({ r, x: start, y: box.h + 3.4, width: w - 9, align: "start", ink: "#1D1D1F", sub: GREY_ON_WHITE, scale: 1.05 });
  const idY = role.top - 3.2;
  const n = r.front.length;
  const zone: Zone = { x: r.rtl ? b + 4 : b + w - 4 - Math.min(24, n * 11 + (n - 1) * 2), y: idY - 11 - 2.4, w: Math.min(24, n * 11 + (n - 1) * 2), h: 11 + 2.4, dir: "row", align: r.rtl ? "start" : "end" };
  return (
    <>
      <rect x={0} y={0} width={W} height={r.H} fill={WHITE} />
      <PhotoBox v={v} r={r} box={box} />
      <defs><linearGradient id={`${r.uid}-scrim`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={INK} stopOpacity="0.72" /><stop offset="1" stopColor={INK} stopOpacity="0" /></linearGradient></defs>
      <rect x={0} y={0} width={W} height={b + 16} fill={`url(#${r.uid}-scrim)`} />
      <Logo x={r.rtl ? b + w - 4.5 - 20 : b + 4.5} y={b + 5} width={20} fill={WHITE} />
      {nb.node}
      <QrZone items={r.front} codes={r.codes} font={r.font} captionFill={GREY_ON_WHITE} max={11} zone={zone} />
      <IdLine r={r} x={start} y={idY} anchor="start" fill={GREY_ON_WHITE} />
      {role.node}
    </>
  );
}

/** Landscape (86 × 54): the photo on a black panel, the person on white. */
function landscapeFront(v: TemplateValues, r: R): ReactNode {
  const { b, w, h, W, H } = r;
  const panel = b + 31;
  const box = { x: (panel + b) / 2 - 11, y: b + (h - 27.5) / 2, w: 22, h: 27.5 };
  const colX = panel + 5;
  const colW = b + w - 5 - colX;
  const role = RoleBand({ r, x: panel, w: W - panel, dark: false });
  const nb = NameBlock({ r, x: colX, y: b + 17, width: colW, align: "start", ink: "#1D1D1F", sub: GREY_ON_WHITE, scale: 0.95 });
  const idY = role.top - 3.2;
  const n = r.front.length;
  const zone: Zone = { x: b + w - 5 - Math.min(22, n * 10 + (n - 1) * 2), y: nb.bottom + 2, w: Math.min(22, n * 10 + (n - 1) * 2), h: Math.max(6, idY - 4 - nb.bottom - 2), dir: "row", align: "end" };
  return (
    <>
      <rect x={0} y={0} width={W} height={H} fill={WHITE} />
      <rect x={0} y={0} width={panel} height={H} fill={INK} />
      <PhotoBox v={v} r={r} box={box} radius={1.4} />
      <Logo x={b + w - 5 - 22} y={b + 5} width={22} fill={INK} />
      {nb.node}
      <QrZone items={r.front} codes={r.codes} font={r.font} captionFill={GREY_ON_WHITE} max={10} zone={zone} />
      <IdLine r={r} x={colX} y={idY} anchor="start" fill={GREY_ON_WHITE} />
      {role.node}
    </>
  );
}

/** Minimal: white, Swiss — the logo and a small photo on the top line, the
 *  name large, a hairline, the number. */
function minimalFront(v: TemplateValues, r: R): ReactNode {
  const { b, w, W } = r;
  const start = r.rtl ? b + w - 5 : b + 5;
  const box = { x: r.rtl ? b + 5 : b + w - 5 - 20, y: b + 5, w: 20, h: 25 };
  const role = RoleBand({ r, x: 0, w: W, dark: false });
  const nb = NameBlock({ r, x: start, y: b + 46, width: w - 10, align: "start", ink: INK, sub: GREY_ON_WHITE, scale: 1.12 });
  const idY = role.top - 3.4;
  const n = r.front.length;
  const zone: Zone = { x: r.rtl ? b + 5 : b + w - 5 - 12, y: idY - 12 - 2.4, w: 12, h: 12 + 2.4, dir: "row", align: "end" };
  return (
    <>
      <rect x={0} y={0} width={W} height={r.H} fill={WHITE} />
      <Logo x={r.rtl ? b + w - 5 - 20 : b + 5} y={b + 6} width={20} fill={INK} />
      <PhotoBox v={v} r={r} box={box} radius={1.2} />
      {nb.node}
      <rect x={r.rtl ? b + w - 5 - 8 : b + 5} y={nb.bottom + 3} width={8} height={0.25} fill={INK} />
      {n ? <QrZone items={r.front} codes={r.codes} font={r.font} captionFill={GREY_ON_WHITE} max={12} zone={zone} /> : null}
      <IdLine r={r} x={start} y={idY} anchor={r.rtl ? "end" : "start"} fill={GREY_ON_WHITE} />
      {role.node}
    </>
  );
}

function front(v: TemplateValues, ctx: DrawContext): ReactNode {
  if (isIdPremium(v)) return drawIdPremium(v, ctx);
  if (isIdRef(v)) return drawIdRefFront(v, ctx);
  const r = read(v, ctx);
  switch (styleOf(v)) {
    case "black": return portraitFront(v, r, "black");
    case "dots": return portraitFront(v, r, "dots");
    case "photo-full": return photoFullFront(v, r);
    case "landscape": return landscapeFront(v, r);
    case "minimal": return minimalFront(v, r);
    default: return portraitFront(v, r, "standard");
  }
}

/* ── the back ──────────────────────────────────────────────────────────── */

/** The back: the logo (or the book's horizontal lockup), "If found, please
 *  return to" with the company and its address, the back's QR codes, and
 *  the number. */
function back(v: TemplateValues, ctx: DrawContext): ReactNode {
  if (isIdRef(v)) return drawIdRefBack(v, ctx);
  const r = read(v, ctx);
  const { b, w, h, W, H } = r;
  const dark = styleOf(v) === "black" || idPremiumDark(v);
  const ink = dark ? WHITE : INK, sub = dark ? GREY_ON_INK : GREY_ON_WHITE;
  const wide = landscape(v);
  const cx = b + w / 2;
  const lockup = v.companyBack !== false;
  const markW = lockup ? Math.min(w - 10, 25 * 1190 / 720) : 25;
  const markH = lockup ? lockupHeight(markW) : logoHeight(markW);
  const markX = wide ? b + 5 : cx - markW / 2;
  const lines = [str(v, "returnLine1"), str(v, "returnLine2"), str(v, "returnLine3")].filter(Boolean);
  const titleS = 2.1 * r.k, lineS = 2.4 * r.k;
  const textX = wide ? b + 5 : cx;
  const anchor = wide ? (r.rtl ? "end" : "start") : "middle";
  const textW = wide ? w * 0.58 : w - 8;
  let y = b + 5 + markH + (wide ? 7 : 9);
  const text: ReactNode[] = [];
  if (str(v, "returnTitle")) {
    text.push(<text key="t" x={textX} y={y} textAnchor={anchor} direction={r.rtl ? "rtl" : "ltr"} fill={sub} {...fit(str(v, "returnTitle"), titleS, textW, 400, r.font)} style={{ fontFamily: r.font, fontSize: titleS }}>{str(v, "returnTitle")}</text>);
    y += lineS * 1.7;
  }
  lines.forEach((l, i) => {
    for (const part of wrapBalanced(l, lineS, textW, i === 0 ? 600 : 400, r.font)) {
      text.push(<text key={`${i}-${part}`} x={textX} y={y} textAnchor={anchor} direction="ltr" fill={ink} {...fit(part, lineS, textW, i === 0 ? 600 : 400, r.font)}
        style={{ fontFamily: r.font, fontSize: lineS, fontWeight: i === 0 ? 600 : 400, unicodeBidi: "plaintext" }}>{part}</text>);
      y += lineS * 1.45;
    }
  });
  const idY = b + h - 4;
  const n = r.back.length;
  const zone: Zone = wide
    ? { x: b + w - 5 - Math.min(30, n * 14 + (n - 1) * 2.5), y: b + 5, w: Math.min(30, n * 14 + (n - 1) * 2.5), h: h - 10, dir: "row", align: "end" }
    : { x: b + 4, y: y + 2, w: w - 8, h: Math.max(6, idY - 4 - (y + 2)), dir: "row", align: "center" };
  return (
    <>
      <rect x={0} y={0} width={W} height={H} fill={dark ? INK : WHITE} />
      {lockup
        ? <GroupLockup x={markX} y={b + 5} width={markW} fill={ink} font={r.font} lines={lockupLines(str(v, "company"))} />
        : <Logo x={markX} y={b + 5} width={markW} fill={ink} />}
      {text}
      <QrZone items={r.back} codes={r.codes} font={r.font} captionFill={sub} max={wide ? 14 : 16} zone={zone} />
      <IdLine r={r} x={wide ? b + 5 : cx} y={idY} anchor={wide ? "start" : "middle"} fill={sub} />
    </>
  );
}

/* ── the template ──────────────────────────────────────────────────────── */

function fromPerson(p: BcPerson, v: TemplateValues): TemplateValues {
  const lang = asLang(v.lang);
  return {
    name: nameIn(p, lang), title: titleOf(p, lang), titleKey: p.title ?? "", staffNo: p.staffNo ?? "", dept: p.department ?? "",
    ...(typeof v.photo === "string" && v.photo.startsWith("data:") ? {} : { photo: p.photo ?? "" }),
  };
}

function qrRequests(v: TemplateValues): QrRequest[] {
  const out: QrRequest[] = [];
  for (const q of qrsOf(v)) {
    if (isPictureQr(q)) continue;
    let text: string | null = null;
    if (q.kind === "staff") text = str(v, "staffNo") || null;
    else if (q.kind === "web") text = `https://${KOLEEX_COMPANY.web}`;
    else if (q.kind === "link") text = q.link.trim() || null;
    else if (q.kind === "contact" && str(v, "name")) {
      /* Name, title and company only — the badge carries no other personal data. */
      text = ["BEGIN:VCARD", "VERSION:3.0", `FN:${str(v, "name")}`, `ORG:${EVERYDAY_NAME_EN}`, str(v, "title") ? `TITLE:${str(v, "title")}` : "", `URL:https://${KOLEEX_COMPANY.web}`, "END:VCARD"].filter(Boolean).join("\n");
    }
    if (text) out.push({ id: q.id, text, level: q.logo ? "H" : "M" });
  }
  return out;
}

const hasPhotoFields = (v: TemplateValues) => idRefNeedsPhoto(v) && !!str(v, "photo");
const onBack = (v: TemplateValues) => v.back !== false;

export const idBadge: TemplateDef = {
  id: "id-badge",
  itemKey: "id-badge",
  nameKey: "tpl.idBadge",
  size: (v) => (landscape(v) ? { w: 86, h: 54 } : { w: 54, h: 86 }),
  bleed: 3,
  safe: 3,
  fields: [
    { key: "style", kind: "choice", labelKey: "tpl.f.style", group: "look", options: ID_STYLES.map((s) => ({ value: s, labelKey: `tpl.idStyle.${s}` })) },
    { key: "lang", kind: "choice", labelKey: "tpl.f.lang", group: "look", options: [
      { value: "en", labelKey: "tpl.lang.en" }, { value: "zh", labelKey: "tpl.lang.zh" }, { value: "ar", labelKey: "tpl.lang.ar" },
    ] },
    { key: "font", kind: "choice", labelKey: "tpl.f.font", group: "look", options: [
      { value: "inter", labelKey: "tpl.font.inter" }, { value: "helvetica", labelKey: "tpl.font.helvetica" },
    ] },
    { key: "scale", kind: "range", labelKey: "tpl.f.scale", group: "look", min: 80, max: 130, step: 5, unit: "%" },
    { key: "pattern", kind: "choice", labelKey: "pat.field", group: "look", options: patternOptions(), when: (v) => ["p-monolith", "p-underprint"].includes(String(v.style)) },

    { key: "name", kind: "text", labelKey: "tpl.f.name", group: "person", max: 40 },
    { key: "title", kind: "title", labelKey: "tpl.f.title", group: "person", langKey: "lang" },
    { key: "dept", kind: "text", labelKey: "tpl.f.dept", group: "person", max: 50, when: (v) => !isIdRef(v) },
    { key: "staffNo", kind: "text", labelKey: "tpl.f.staffNo", group: "person", max: 20 },
    { key: "idLabel", kind: "text", labelKey: "tpl.f.idLabel", group: "person", max: 12, placeholder: "ID" },
    { key: "valid", kind: "text", labelKey: "tpl.f.valid", group: "person", max: 30, placeholder: "Valid until 12/2027" },
    { key: "role", kind: "text", labelKey: "tpl.f.role", group: "person", max: 20, hintKey: "tpl.f.roleHint", when: (v) => !isIdRef(v) || v.style === "r-staff" },
    { key: "logoFront", kind: "switch", labelKey: "tpl.f.logoFront", group: "person", when: (v) => ID_REF_LOGO_SWITCH.includes(String(v.style)) },

    { key: "photo", kind: "image", labelKey: "tpl.f.photo", group: "photo", hintKey: "tpl.f.badgePhotoHint", fromPerson: "photo", when: idRefNeedsPhoto },
    { key: "photoZoom", kind: "range", labelKey: "tpl.f.photoZoom", group: "photo", min: 100, max: 300, step: 5, unit: "%", when: hasPhotoFields },
    { key: "photoX", kind: "range", labelKey: "tpl.f.photoX", group: "photo", min: -100, max: 100, step: 2, when: hasPhotoFields },
    { key: "photoY", kind: "range", labelKey: "tpl.f.photoY", group: "photo", min: -100, max: 100, step: 2, when: hasPhotoFields },
    { key: "bw", kind: "switch", labelKey: "tpl.f.bw", group: "photo", when: idRefNeedsPhoto },

    { key: "back", kind: "switch", labelKey: "tpl.f.back", group: "back" },
    { key: "companyBack", kind: "switch", labelKey: "tpl.f.lockupBack", group: "back", when: (v) => onBack(v) && !isIdRef(v) },
    { key: "bigText", kind: "text", labelKey: "tpl.f.bigText", group: "back", max: 30, hintKey: "tpl.f.bigTextHint", when: (v) => onBack(v) && v.style === "r-wave" },
    { key: "returnTitle", kind: "text", labelKey: "tpl.f.returnTitle", group: "back", max: 60, when: onBack },
    { key: "returnLine1", kind: "text", labelKey: "tpl.f.returnLine1", group: "back", max: 80, when: onBack },
    { key: "returnLine2", kind: "text", labelKey: "tpl.f.returnLine2", group: "back", max: 120, when: onBack },
    { key: "returnLine3", kind: "text", labelKey: "tpl.f.returnLine3", group: "back", max: 80, when: onBack },

    { key: "qrs", kind: "qrs", labelKey: "tpl.f.qrs", group: "qr", langKey: "lang" },
  ],
  defaults: {
    style: "standard", lang: "en", font: "inter", scale: 100, pattern: "scan-edge",
    name: "", title: "", dept: "", staffNo: "", idLabel: "ID", valid: "", role: "",
    photo: "", photoZoom: 100, photoX: 0, photoY: 0, bw: false,
    back: true, companyBack: true, company: "KOLEEX INTERNATIONAL GROUP",
    returnTitle: RETURN_TITLE.en, returnLine1: EVERYDAY_NAME_EN, returnLine2: CARD_ADDRESS.en, returnLine3: DEFAULT_CONTACT,
    logoFront: true, bigText: BIG_LINE.en,
    qrs: [] as TemplateItem[],
  },
  pages: [{ id: "front", draw: front }, { id: "back", draw: back }],
  pagesFor: (v) => (onBack(v) ? ["front", "back"] : ["front"]),
  die: idRefDie,
  draftStyles: ID_REFS,
  /* The STAFF reference is its word: it comes with the status line filled. */
  restyle: (v, style) => (style === "r-staff" && !str(v, "role") ? { ...v, style, role: "STAFF" } : { ...v, style }),
  qrRequests,
  fromPerson,
  relang: (v, lang) => {
    const l = asLang(lang);
    const title = str(v, "returnTitle");
    const addr = str(v, "returnLine2");
    return {
      ...v, lang,
      ...(LANGS.some((x) => RETURN_TITLE[x] === title) ? { returnTitle: RETURN_TITLE[l] } : {}),
      ...(LANGS.some((x) => CARD_ADDRESS[x] === addr) ? { returnLine2: CARD_ADDRESS[l] } : {}),
      ...(LANGS.some((x) => BIG_LINE[x] === v.bigText) ? { bigText: BIG_LINE[l] } : {}),
    };
  },
  specKeys: (v) => [...(isIdRef(v) ? idRefSpecKeys(v) : ["spec.badge1", "spec.badge2", "spec.badge3"]), ...(onBack(v) ? ["spec.badgeBack"] : [])],
  forSaving: (v, keepPerson) => ({
    ...v, photo: "", qrs: list(v, "qrs").map((q) => ({ ...q, image: "" })),
    ...(keepPerson ? {} : { name: "", title: "", titleKey: "", staffNo: "", dept: "", valid: "" }),
  }),
  check: (v) => {
    if (!str(v, "name")) return "studio.needName";
    if (idRefNeedsPhoto(v) && !str(v, "photo")) return "studio.needPhoto";
    for (const q of qrsOf(v)) {
      if (q.kind === "link" && !q.link.trim()) return "studio.needQrLink";
      if (isPictureQr(q) && !q.image) return "studio.needQrImage";
    }
    return null;
  },
  fillName: (v, t) => t(`tpl.idStyle.${styleOf(v)}`),
};
