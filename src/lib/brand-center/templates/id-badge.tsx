/* ---------------------------------------------------------------------------
   Staff ID badge (plan step C10) — the brand book's badge (HR documents,
   "The ID badge"): 54 × 86 mm portrait; a black band with the white logo;
   the team portrait (ch. 66: shoulders up, 4 : 5, on black, cool and muted
   colour — a series may be black and white); the name, the job title and the
   staff number — no personal data beyond that. Filled from Employees.
   Measures are the book's drawing (127 × 200) at 0.425 mm a point.
   --------------------------------------------------------------------------- */

import type { BcPerson } from "@/lib/brand-center/client";
import type { DrawContext, TemplateDef, TemplateValues } from "./types";
import { FONTS, asLang, num, str } from "./card/model";
import { INK, WHITE, GREY_ON_WHITE, Logo, Photo, PhotoPlaceholder, fit, logoHeight, textWidth, wrap } from "./card/parts";
import { nameIn, titleOf } from "./person";

const W = 54;
const H = 86;
const B = {
  band: 20.4, logo: 27.2,
  photo: { top: 25.5, w: 24, h: 30, r: 1.7 },
  name: { gap: 3.4, size: 3.8 }, title: { size: 3.0 }, id: { base: 82.6, size: 2.55 },
};

function front(v: TemplateValues, ctx: DrawContext) {
  const b = ctx.bleed;
  const font = FONTS.inter;
  const rtl = asLang(v.lang) === "ar";
  const cx = b + W / 2;
  const inner = W - 8;
  const photo = str(v, "photo");
  const box = { x: cx - B.photo.w / 2, y: b + B.photo.top, w: B.photo.w, h: B.photo.h };
  const name = str(v, "name");
  const nameLines = name ? (textWidth(name, B.name.size, 700, font) > inner ? wrap(name, B.name.size * 0.86, inner, 2, 700, font) : [name]) : [];
  const nameSize = nameLines.length > 1 ? B.name.size * 0.86 : B.name.size;
  const nameBase = box.y + box.h + B.name.gap + nameSize * 0.8;
  const titleBase = nameBase + (nameLines.length - 1) * nameSize * 1.15 + B.title.size * 1.45;
  const staff = str(v, "staffNo");
  const label = str(v, "idLabel") || "ID";
  return (
    <>
      <rect x={0} y={0} width={W + b * 2} height={H + b * 2} fill={WHITE} />
      <rect x={0} y={0} width={W + b * 2} height={b + B.band} fill={INK} />
      <Logo x={cx - B.logo / 2} y={b + (B.band - logoHeight(B.logo)) / 2} width={B.logo} fill={WHITE} />
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={B.photo.r} fill={INK} />
      {photo
        ? <Photo href={photo} box={box} radius={B.photo.r} tone={v.bw === true ? "bw" : "muted"} zoom={num(v, "photoZoom", 100) / 100}
            px={num(v, "photoX", 0)} py={num(v, "photoY", 0)} soft={false} uid={`${ctx.uid}-p`} />
        : <PhotoPlaceholder box={box} label="Photo" font={font} />}
      {nameLines.map((line, i) => (
        <text key={i} x={cx} y={nameBase + i * nameSize * 1.15} textAnchor="middle" direction={rtl ? "rtl" : "ltr"} fill="#1D1D1F"
          {...fit(line, nameSize, inner, 700, font)} style={{ fontFamily: font, fontSize: nameSize, fontWeight: 700 }}>{line}</text>
      ))}
      {str(v, "title") ? (
        <text x={cx} y={titleBase} textAnchor="middle" direction={rtl ? "rtl" : "ltr"} fill={GREY_ON_WHITE}
          {...fit(str(v, "title"), B.title.size, inner, 400, font)} style={{ fontFamily: font, fontSize: B.title.size }}>{str(v, "title")}</text>
      ) : null}
      {staff ? (
        <text x={cx} y={b + B.id.base} textAnchor="middle" direction="ltr" fill={GREY_ON_WHITE}
          style={{ fontFamily: font, fontSize: B.id.size, fontVariantNumeric: "tabular-nums", letterSpacing: 0.1 }}>{`${label} ${staff}`}</text>
      ) : null}
    </>
  );
}

function fromPerson(p: BcPerson, v: TemplateValues): TemplateValues {
  const lang = asLang(v.lang);
  return {
    name: nameIn(p, lang), title: titleOf(p, lang), titleKey: p.title ?? "", staffNo: p.staffNo ?? "",
    ...(typeof v.photo === "string" && v.photo.startsWith("data:") ? {} : { photo: p.photo ?? "" }),
  };
}

export const idBadge: TemplateDef = {
  id: "id-badge",
  itemKey: "id-badge",
  nameKey: "tpl.idBadge",
  size: () => ({ w: W, h: H }),
  bleed: 3,
  safe: 3,
  fields: [
    { key: "lang", kind: "choice", labelKey: "tpl.f.lang", group: "look", options: [
      { value: "en", labelKey: "tpl.lang.en" }, { value: "zh", labelKey: "tpl.lang.zh" }, { value: "ar", labelKey: "tpl.lang.ar" },
    ] },
    { key: "name", kind: "text", labelKey: "tpl.f.name", group: "person", max: 40 },
    { key: "title", kind: "title", labelKey: "tpl.f.title", group: "person", langKey: "lang" },
    { key: "staffNo", kind: "text", labelKey: "tpl.f.staffNo", group: "person", max: 20 },
    { key: "idLabel", kind: "text", labelKey: "tpl.f.idLabel", group: "person", max: 12, placeholder: "ID" },
    { key: "photo", kind: "image", labelKey: "tpl.f.photo", group: "photo", hintKey: "tpl.f.badgePhotoHint", fromPerson: "photo" },
    { key: "photoZoom", kind: "range", labelKey: "tpl.f.photoZoom", group: "photo", min: 100, max: 300, step: 5, unit: "%", when: (v) => !!str(v, "photo") },
    { key: "photoX", kind: "range", labelKey: "tpl.f.photoX", group: "photo", min: -100, max: 100, step: 2, when: (v) => !!str(v, "photo") },
    { key: "photoY", kind: "range", labelKey: "tpl.f.photoY", group: "photo", min: -100, max: 100, step: 2, when: (v) => !!str(v, "photo") },
    { key: "bw", kind: "switch", labelKey: "tpl.f.bw", group: "photo" },
  ],
  defaults: { lang: "en", name: "", title: "", staffNo: "", idLabel: "ID", photo: "", photoZoom: 100, photoX: 0, photoY: 0, bw: false },
  pages: [{ id: "front", draw: front }],
  fromPerson,
  specKeys: () => ["spec.badge1", "spec.badge2", "spec.badge3"],
  forSaving: (v, keepPerson) => ({ ...v, photo: "", ...(keepPerson ? {} : { name: "", title: "", titleKey: "", staffNo: "" }) }),
  check: (v) => (!str(v, "name") ? "studio.needName" : !str(v, "photo") ? "studio.needPhoto" : null),
  fillName: () => "",
};
