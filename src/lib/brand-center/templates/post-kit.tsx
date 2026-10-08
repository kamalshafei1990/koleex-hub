/* ---------------------------------------------------------------------------
   The post kit — what every social post template shares (plan steps C14,
   C15): the sizes in pixels, the book's grammar (ch. 80: the KOLEEX edge,
   the logo top-left, a grey label in capitals, the two-line headline Bold
   then Light, 72 px margins), text that places itself for Arabic, and the
   photo that melts into its own ground or sits on a panel of its colour.
   --------------------------------------------------------------------------- */

import type { DrawContext, FieldDef, TemplateValues } from "./types";
import { INK, Logo, WHITE, textWidth, wrapBalanced } from "./card/parts";
import { FONTS, asLang, num, str, type Lang } from "./card/model";
import { patternOf } from "./patterns";

/* ── sizes ─────────────────────────────────────────────────────────────── */

export const POST_SIZES = ["feed", "square", "story", "wide", "landscape"] as const;
export type PostSize = (typeof POST_SIZES)[number];
export const POST_PX: Record<PostSize, { w: number; h: number }> = {
  feed: { w: 1080, h: 1350 }, square: { w: 1080, h: 1080 }, story: { w: 1080, h: 1920 }, wide: { w: 1200, h: 627 }, landscape: { w: 1920, h: 1080 },
};
export const oneOf = <T extends string>(all: readonly T[], x: unknown, d: T): T => ((all as readonly string[]).includes(String(x)) ? (x as T) : d);
export const postSizeOf = (v: TemplateValues): PostSize => oneOf(POST_SIZES, v.size, "feed");
/** One fill → every size (plan step C16). */
export const POST_EVERY_SIZE = { key: "size", values: POST_SIZES };
/** A story keeps its top 250 px and bottom 340 px clear for the app's buttons (ch. 82). */
export const postSafe = (v: TemplateValues) => (postSizeOf(v) === "story" ? { top: 250, right: 72, bottom: 340, left: 72 } : { top: 72, right: 72, bottom: 72, left: 72 });

export const PHOTO_ON = ["white", "black", "cutout", "scene"] as const;
export type PhotoOn = (typeof PHOTO_ON)[number];

export const ARABIC = /[؀-ۿ]/;
export const NOT_LATIN = /[؀-ۿ⺀-鿿]/;
export const caps = (s: string) => (NOT_LATIN.test(s) ? s : s.toUpperCase());
export const STAGE = "#F5F5F7";
export const HUB_BLUE = "#567FB2";

/* ── the fill, read once ───────────────────────────────────────────────── */

/** A caption's hashtags (ch. 80): #KOLEEX, then up to four made from the
 *  given words ("Spreading machines" → #SpreadingMachines); Latin only. */
export function hashtags(...words: string[]): string {
  const tags = ["#KOLEEX"];
  for (const w of words) {
    if (!w || /[^\x00-\x7F]/.test(w)) continue;
    const tag = `#${w.split(/[^A-Za-z0-9]+/).filter(Boolean).map((x) => x[0].toUpperCase() + x.slice(1)).join("")}`;
    if (tag.length > 1 && !tags.includes(tag)) tags.push(tag);
  }
  return tags.slice(0, 5).join(" ");
}
/** A caption from its parts: blank lines between them, empty parts left out. */
export const captionOf = (...parts: string[]) => parts.map((p) => p.trim()).filter(Boolean).join("\n\n");

/** Any page's reading without a sheet (a caption reads the same words). */
export const NO_SHEET: DrawContext = { w: 1080, h: 1350, bleed: 0, qrs: {}, uid: "caption" };

export function readPost(v: TemplateValues, ctx: DrawContext) {
  const W = ctx.w, H = ctx.h;
  const size = postSizeOf(v);
  const lang = asLang(v.lang);
  const u = Math.min(W, H * 1.25) / 1080;
  const story = size === "story", wide = size === "wide" || size === "landscape";
  const M = 72 * u;
  return {
    W, H, u, M, size, story, wide, lang, rtl: lang === "ar", font: FONTS.inter, uid: ctx.uid,
    top: story ? 250 : M, bottom: H - (story ? 340 : M),
    label: str(v, "label"), headline: str(v, "headline"), headline2: str(v, "headline2"),
    cta: str(v, "cta"), web: v.web === false ? "" : str(v, "webText") || "koleexgroup.com",
    photo: str(v, "photo"), photoOn: oneOf(PHOTO_ON, v.photoOn, "white"), photoScale: num(v, "photoScale", 100) / 100,
    edge: v.edge !== false, logoEnd: v.logoAt === "end", pattern: patternOf(v.pattern, "scan-edge"),
  };
}
export type PostR = ReturnType<typeof readPost>;
export type Box = { x: number; y: number; w: number; h: number };

/** A box given from the start side, placed for the page's direction. */
export const place = (r: PostR, b: Box): Box => (r.rtl ? { ...b, x: r.W - b.x - b.w } : b);
/** x of a start-side position. */
export const sx = (r: PostR, x: number) => (r.rtl ? r.W - x : x);
export const startAlign = (r: PostR) => (r.rtl ? "right" : "left") as "left" | "right";
export const endAlign = (r: PostR) => (r.rtl ? "left" : "right") as "left" | "right";
/** Arabic has no Bold in the brand's face (Noto Sans Arabic 300/400/600). */
export const wt = (text: string, w: number) => (ARABIC.test(text) && w > 600 ? 600 : w);

/* ── type ──────────────────────────────────────────────────────────────── */

export function Txt({ r, x, y, size, children, fill, weight = 400, align = "left", spacing, tabular, opacity }: {
  r: PostR; x: number; y: number; size: number; children: string; fill: string; weight?: number; align?: "left" | "right" | "center"; spacing?: number;
  /** figures in columns (Inter's tabular forms also widen the hyphen, so never for a model) */
  tabular?: boolean; opacity?: number;
}) {
  const dir = r.rtl ? "rtl" : "ltr";
  const anchor = align === "center" ? "middle" : align === "left" ? (dir === "ltr" ? "start" : "end") : (dir === "ltr" ? "end" : "start");
  const spaced = spacing && !NOT_LATIN.test(children) ? spacing : undefined;
  return (
    <text x={x} y={y} textAnchor={anchor} direction={dir} fill={fill} opacity={opacity}
      style={{ fontFamily: r.font, fontSize: size, fontWeight: wt(children, weight), letterSpacing: spaced, unicodeBidi: "plaintext", fontVariantNumeric: tabular ? "tabular-nums" : undefined }}>{children}</text>
  );
}

/** The small label: capitals, grey, spaced; smaller when `max` is short. */
export function Label({ r, x, y, fill, align, text, size, max }: { r: PostR; x: number; y: number; fill: string; align: "left" | "right" | "center"; text?: string; size?: number; max?: number }) {
  const t = text ?? r.label;
  if (!t) return null;
  /* Arabic and Chinese have no capitals to carry a small label: a size up */
  let s = (size ?? 24 * r.u) * (ARABIC.test(t) ? 1.25 : NOT_LATIN.test(t) ? 1.12 : 1);
  const shown = caps(t);
  const spaced = NOT_LATIN.test(shown) ? 0 : 0.2;
  const width = (z: number) => textWidth(shown, z, 600, r.font) + z * spaced * shown.length;
  const room = max ?? r.W - 2 * r.M;
  if (width(s) > room) s = Math.max(s * 0.7, (s * room) / width(s));
  return <Txt r={r} x={x} y={y} size={s} fill={fill} weight={600} align={align} spacing={s * 0.2}>{shown}</Txt>;
}

/** The two-line headline — Bold, then Light — as large as `size` allows in
 *  `width` (each part wraps to two lines at most). */
export function headline(r: PostR, o: { x: number; y: number; width: number; size: number; fill: string; fill2?: string; align: "left" | "right" | "center"; one?: string; two?: string; maxLines?: number }) {
  const one = o.one ?? r.headline, two = o.two ?? r.headline2;
  const parts = [{ text: one, w: 700 }, { text: two, w: 300 }].filter((p) => p.text);
  let size = o.size;
  const linesOf = (s: number) => parts.flatMap((p) => wrapBalanced(p.text, s, o.width, wt(p.text, p.w), r.font).map((l) => ({ l, w: p.w, first: p === parts[0] })));
  let lines = linesOf(size);
  const widest = () => Math.max(0, ...lines.map((x) => textWidth(x.l, size, wt(x.l, x.w), r.font)));
  const most = o.maxLines ?? 4;
  for (let i = 0; i < 6 && (widest() > o.width || lines.length > most); i++) { size *= 0.9; lines = linesOf(size); }
  const lh = size * 1.08;
  const nodes = lines.map((x, i) => (
    <Txt key={i} r={r} x={o.x} y={o.y + size * 0.8 + i * lh} size={size} weight={x.w} fill={x.first || !o.fill2 ? o.fill : o.fill2} align={o.align} spacing={-size * 0.015}>{x.l}</Txt>
  ));
  return { node: <g>{nodes}</g>, bottom: o.y + (lines.length ? size * 0.8 + (lines.length - 1) * lh + size * 0.25 : 0), size };
}
/** A headline set from the bottom up: its top so that it ends at `bottom`. */
export function headlineAbove(r: PostR, o: Omit<Parameters<typeof headline>[1], "y"> & { bottom: number }) {
  const probe = headline(r, { ...o, y: 0 });
  const top = o.bottom - probe.bottom;
  return { ...headline(r, { ...o, y: top }), top };
}

/* ── the photo ─────────────────────────────────────────────────────────── */

const PLACEHOLDER: Record<Lang, string> = { en: "Photo", zh: "照片", ar: "الصورة" };

/** The photo in its box. On a ground of its own colour it melts in; on the
 *  other ground it sits on a rounded panel of its own colour; a cut-out
 *  stands on any ground; a scene (its own background) fills a rounded frame. */
export function Photo({ r, box, ground, panelRadius = 28, align = "center", src, placeholder }: {
  r: PostR; box: Box; ground: "light" | "dark"; panelRadius?: number; align?: "center" | "bottom"; src?: string; placeholder?: string;
}) {
  const href = src ?? r.photo;
  const id = `${r.uid}-ph${Math.round(box.x)}${Math.round(box.y)}`;
  if (!href) {
    const c = ground === "dark" ? "#48484A" : "#C7C7CC";
    return (
      <g>
        <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={panelRadius * r.u} fill="none" stroke={c} strokeWidth={2 * r.u} strokeDasharray={`${10 * r.u} ${8 * r.u}`} />
        <Txt r={r} x={box.x + box.w / 2} y={box.y + box.h / 2} size={26 * r.u} fill={c} align="center" weight={500}>{placeholder ?? PLACEHOLDER[r.lang]}</Txt>
      </g>
    );
  }
  const on: PhotoOn = r.photoOn;
  const scene = on === "scene";
  const needsPanel = scene || (on === "white" && ground === "dark") || (on === "black" && ground === "light");
  const blend = on === "cutout" || needsPanel ? undefined : on === "white" ? "multiply" : "screen";
  const pad = needsPanel && !scene ? Math.min(box.w, box.h) * 0.06 : 0;
  const k = scene ? Math.max(1, r.photoScale) : r.photoScale;
  const iw = (box.w - pad * 2) * k, ih = (box.h - pad * 2) * k;
  const ix = box.x + (box.w - iw) / 2;
  const iy = align === "bottom" ? box.y + box.h - pad - ih : box.y + (box.h - ih) / 2;
  return (
    <g>
      {needsPanel ? (
        <>
          <defs><clipPath id={id}><rect x={box.x} y={box.y} width={box.w} height={box.h} rx={panelRadius * r.u} /></clipPath></defs>
          <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={panelRadius * r.u} fill={on === "white" ? WHITE : on === "black" ? INK : "#1C1C1E"} />
        </>
      ) : null}
      <g clipPath={needsPanel ? `url(#${id})` : undefined}>
        <image href={href} x={ix} y={iy} width={iw} height={ih} preserveAspectRatio={scene ? "xMidYMid slice" : align === "bottom" ? "xMidYMax meet" : "xMidYMid meet"}
          style={blend ? { mixBlendMode: blend } : undefined} />
      </g>
    </g>
  );
}

/** A photo to every edge of the post (a scene), zoomed by the photo size. */
export function FullPhoto({ r }: { r: PostR }) {
  if (!r.photo) return null;
  const k = Math.max(1, r.photoScale);
  return <image href={r.photo} x={(r.W - r.W * k) / 2} y={(r.H - r.H * k) / 2} width={r.W * k} height={r.H * k} preserveAspectRatio="xMidYMid slice" />;
}

/** Dark bands at the top and the foot so words over a photo always read
 *  (ch. 80's photo posts: black at 45 % and more). */
export function Bands({ r, top, bottomFrom }: { r: PostR; top: number; bottomFrom: number }) {
  const id = `${r.uid}-bands`;
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-t`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000000" stopOpacity={0.62} />
          <stop offset="100%" stopColor="#000000" stopOpacity={0} />
        </linearGradient>
        <linearGradient id={`${id}-b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000000" stopOpacity={0} />
          <stop offset="55%" stopColor="#000000" stopOpacity={0.55} />
          <stop offset="100%" stopColor="#000000" stopOpacity={0.8} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={r.W} height={top} fill={`url(#${id}-t)`} />
      <rect x={0} y={bottomFrom} width={r.W} height={r.H - bottomFrom} fill={`url(#${id}-b)`} />
    </g>
  );
}

/* ── marks ─────────────────────────────────────────────────────────────── */

/** The KOLEEX edge (ch. 57/80): 1 % of the width, full height, the start side. */
export function Edge({ r, fill }: { r: PostR; fill: string }) {
  if (!r.edge) return null;
  const w = Math.max(2, Math.round(r.W * 0.01));
  return <rect x={r.rtl ? r.W - w : 0} y={0} width={w} height={r.H} fill={fill} />;
}

/** The logo at the top (start, or end when the picture needs the start). */
export function TopLogo({ r, fill, y, width }: { r: PostR; fill: string; y?: number; width?: number }) {
  const lw = width ?? 220 * r.u;
  const atEnd = r.logoEnd !== r.rtl; // the physical right side
  return <Logo x={atEnd ? r.W - r.M - lw : r.M} y={y ?? r.top} width={lw} fill={fill} />;
}

/** The foot: the call to action at the start, the website at the end. */
export function Foot({ r, y, fill, dim, x0, x1 }: { r: PostR; y: number; fill: string; dim: string; x0?: number; x1?: number }) {
  const s = 26 * r.u;
  const a = x0 ?? r.M, b = x1 ?? r.W - r.M;
  const cta = r.cta ? `${r.cta}${r.rtl ? " ←" : " →"}` : "";
  /* too narrow for both on one line: the website goes above the call */
  const stacked = Boolean(cta && r.web) && textWidth(cta, s, 600, r.font) + textWidth(r.web, s, 400, r.font) + 40 * r.u > b - a;
  return (
    <g>
      {cta ? <Txt r={r} x={r.rtl ? b : a} y={y} size={s} fill={fill} weight={600} align={startAlign(r)}>{cta}</Txt> : null}
      {r.web ? (stacked
        ? <Txt r={r} x={r.rtl ? b : a} y={y - s * 1.5} size={s} fill={dim} align={startAlign(r)}>{r.web}</Txt>
        : <Txt r={r} x={r.rtl ? a : b} y={y} size={s} fill={dim} align={endAlign(r)}>{r.web}</Txt>) : null}
    </g>
  );
}
export const hasFoot = (r: PostR) => Boolean(r.cta || r.web);

/** A soft floor shadow under an object (the studio stage). */
export function Floor({ r, cx, y, w }: { r: PostR; cx: number; y: number; w: number }) {
  const id = `${r.uid}-floor`;
  return (
    <g>
      <defs>
        <radialGradient id={id}>
          <stop offset="0%" stopColor="#000000" stopOpacity={0.16} />
          <stop offset="100%" stopColor="#000000" stopOpacity={0} />
        </radialGradient>
      </defs>
      <ellipse cx={cx} cy={y} rx={w / 2} ry={w * 0.06} fill={`url(#${id})`} />
    </g>
  );
}

/** A pill tag (New, Save the date, Live …) in Hub Blue, white capitals. */
export function Tag({ r, x, y, text, fill = HUB_BLUE, color = WHITE }: { r: PostR; x: number; y: number; text: string; fill?: string; color?: string }) {
  const s = 24 * r.u;
  const shown = caps(text);
  const w = textWidth(shown, s, 600, r.font) + (NOT_LATIN.test(shown) ? 0 : s * 0.2 * shown.length) + 36 * r.u;
  const box = place(r, { x, y: y - 30 * r.u, w, h: 44 * r.u });
  return {
    width: w,
    node: (
      <g>
        <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={box.h / 2} fill={fill} />
        <Txt r={r} x={box.x + box.w / 2} y={y} size={s} fill={color} weight={600} align="center" spacing={s * 0.2}>{shown}</Txt>
      </g>
    ),
  };
}

/* ── fields ────────────────────────────────────────────────────────────── */

export const choice = <T extends string>(key: string, labelKey: string, group: string, values: readonly T[], words: string, when?: (v: TemplateValues) => boolean): FieldDef =>
  ({ key, kind: "choice", labelKey, group, options: values.map((value) => ({ value, labelKey: `${words}.${value}` })), ...(when ? { when } : {}) });

/** Size and language: the first slots of every post. */
export const POST_LOOK: FieldDef[] = [
  choice("size", "post.f.size", "look", POST_SIZES, "post.size"),
  { key: "lang", kind: "choice", labelKey: "post.f.lang", group: "look", options: [
    { value: "en", labelKey: "tpl.lang.en" }, { value: "zh", labelKey: "tpl.lang.zh" }, { value: "ar", labelKey: "tpl.lang.ar" },
  ] },
];
/** The photo's slots (the studio reads what it was shot on by itself). */
export const photoFields = (when?: (v: TemplateValues) => boolean, labelKey = "post.f.photo", hintKey = "post.f.photoHint"): FieldDef[] => [
  { key: "photo", kind: "image", labelKey, group: "picture", hintKey, ...(when ? { when } : {}) },
  { ...choice("photoOn", "post.f.photoOn", "picture", PHOTO_ON, "post.photoOn"), ...(when ? { when } : {}) },
  { key: "photoScale", kind: "range", labelKey: "post.f.photoScale", group: "picture", min: 60, max: 130, step: 5, unit: "%", ...(when ? { when } : {}) },
];
