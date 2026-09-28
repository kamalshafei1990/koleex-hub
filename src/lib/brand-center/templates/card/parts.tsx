/* ---------------------------------------------------------------------------
   Business card — the shared drawing parts (brand book ch. 91, 43, 44, 57).

   Everything in mm. Type: Inter for Latin (owner 28/09: contacts too, no
   monospace), Noto Sans Arabic, and the book's Chinese stack (PingFang SC /
   Noto Sans SC) — one stack, so a Chinese name with a Latin email picks the
   right face per letter. Contacts carry labels (owner 28/09: "Add:", "Mob:"
   like his card), in the card's language.
   --------------------------------------------------------------------------- */

import { KoleexLogoPaths } from "@/components/layout/KoleexLogo";
import { PT, type TemplateValues } from "../types";

export const INK = "#000000";
export const WHITE = "#FFFFFF";
/** Secondary text on black / on white (the book's greys). */
export const GREY_ON_INK = "#98989D";
export const GREY_ON_WHITE = "#6E6E73";
export const LIGHT_ON_INK = "#D1D1D6";

const LOGO_W = 719.83;
const LOGO_H = 107.57;
export const logoHeight = (width: number) => (width * LOGO_H) / LOGO_W;

export const FONT =
  "var(--font-inter), Inter, var(--font-bc-ar), 'Noto Sans Arabic', 'PingFang SC', 'Noto Sans SC', 'Hiragino Sans GB', 'Microsoft YaHei', Arial, sans-serif";

export type Lang = "en" | "zh" | "ar";
export const langOf = (v: TemplateValues): Lang => (v.lang === "zh" || v.lang === "ar" ? v.lang : "en");
export const str = (v: TemplateValues, k: string): string => (typeof v[k] === "string" ? (v[k] as string).trim() : "");

/* ── marks ─────────────────────────────────────────────────────────────── */

export function Logo({ x, y, width, fill }: { x: number; y: number; width: number; fill: string }) {
  return <g transform={`translate(${x} ${y}) scale(${width / LOGO_W})`} fill={fill}><KoleexLogoPaths /></g>;
}

/** The horizontal group lockup (ch. 43): logo, hairline, and
 *  KOLEEX / INTERNATIONAL / GROUP in Inter Light — the book's own drawing
 *  (a 1190 × 160 box), scaled to `width`. */
export function GroupLockup({ x, y, width, fill }: { x: number; y: number; width: number; fill: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${width / 1190})`} fill={fill}>
      <g transform={`translate(0 26) scale(${720 / LOGO_W})`}><KoleexLogoPaths /></g>
      <rect x={786} y={0} width={3} height={160} />
      <text style={{ fontFamily: FONT, fontWeight: 300, fontSize: 40, letterSpacing: 1 }}>
        <tspan x={846} y={42}>KOLEEX</tspan>
        <tspan x={846} y={99}>INTERNATIONAL</tspan>
        <tspan x={846} y={156}>GROUP</tspan>
      </text>
    </g>
  );
}
export const lockupHeight = (width: number) => (width * 160) / 1190;

/** The QR on a white square (quiet zone included), dark modules. */
export function Qr({ modules, x, y, size }: { modules: boolean[][]; x: number; y: number; size: number }) {
  const pad = size * 0.08;
  const cell = (size - pad * 2) / modules.length;
  let d = "";
  modules.forEach((row, r) => row.forEach((on, c) => {
    if (on) d += `M${(x + pad + c * cell).toFixed(3)} ${(y + pad + r * cell).toFixed(3)}h${cell.toFixed(3)}v${cell.toFixed(3)}h-${cell.toFixed(3)}z`;
  }));
  return (
    <g>
      <rect x={x} y={y} width={size} height={size} rx={0.6} fill={WHITE} />
      <path d={d} fill={INK} shapeRendering="crispEdges" />
    </g>
  );
}

/* ── text ──────────────────────────────────────────────────────────────── */

const CJK = /[\u2E80-\u9FFF\uAC00-\uD7AF\uFF00-\uFFEF]/;
/** Estimated width of a line in mm (Inter / CJK / Arabic averages). Used
 *  only to wrap and to condense a line that would cross its box. */
export function textWidth(text: string, size: number, weight = 400): number {
  let em = 0;
  for (const ch of text) em += CJK.test(ch) ? 1 : /[\u0600-\u06FF]/.test(ch) ? 0.5 : /[A-Z0-9@%&]/.test(ch) ? 0.64 : ch === " " ? 0.28 : 0.52;
  return em * size * (weight >= 600 ? 1.05 : weight <= 300 ? 0.97 : 1);
}

/** Condense a line to `max` mm when it would run past it. */
export function fit(text: string, size: number, max: number, weight = 400) {
  return textWidth(text, size, weight) > max ? { textLength: max, lengthAdjust: "spacingAndGlyphs" as const } : {};
}

/** Word-wrap to lines of at most `max` mm (CJK wraps between characters). */
export function wrap(text: string, size: number, max: number, maxLines = 2, weight = 400): string[] {
  const units = CJK.test(text) && !/\s/.test(text) ? Array.from(text) : text.split(/\s+/).filter(Boolean);
  const join = CJK.test(text) && !/\s/.test(text) ? "" : " ";
  const lines: string[] = [];
  let cur = "";
  for (const u of units) {
    const next = cur ? cur + join + u : u;
    if (cur && textWidth(next, size, weight) > max) { lines.push(cur); cur = u; } else cur = next;
  }
  if (cur) lines.push(cur);
  if (lines.length <= maxLines) return lines;
  return [...lines.slice(0, maxLines - 1), lines.slice(maxLines - 1).join(join)];
}

/** A line of text placed from its logical start: the left edge in English
 *  and Chinese, the right edge in Arabic (direction does the mirroring). */
export function Line({ x, y, rtl, children, size, weight = 400, fill, max, anchor = "start", spacing }: {
  x: number; y: number; rtl: boolean; children: string; size: number; weight?: number; fill: string; max?: number;
  anchor?: "start" | "middle" | "end"; spacing?: number;
}) {
  return (
    <text x={x} y={y} direction={rtl ? "rtl" : "ltr"} textAnchor={anchor} fill={fill} {...(max ? fit(children, size, max, weight) : {})}
      style={{ fontFamily: FONT, fontSize: size, fontWeight: weight, letterSpacing: spacing }}>{children}</text>
  );
}

/* ── contacts ──────────────────────────────────────────────────────────── */

const LABELS: Record<Lang, Record<string, string>> = {
  en: { add: "Add:", mob: "Mob:", tel: "Tel:", email: "Email:", web: "Web:", wechat: "WeChat:" },
  zh: { add: "地址：", mob: "手机：", tel: "电话：", email: "邮箱：", web: "网址：", wechat: "微信：" },
  ar: { add: "العنوان:", mob: "الجوال:", tel: "الهاتف:", email: "البريد:", web: "الموقع:", wechat: "ويتشات:" },
};
export const label = (lang: Lang, key: string) => LABELS[lang][key] ?? key;

export interface Row { label: string; value: string; ltrValue: boolean }

/** The contact lines of a fill, in the order of the owner's card:
 *  address, mobile (+ WhatsApp), WeChat, email, website. */
export function contactRows(v: TemplateValues, opts: { address?: boolean } = {}): Row[] {
  const lang = langOf(v);
  const rows: Row[] = [];
  const address = str(v, "address");
  if (opts.address !== false && address) rows.push({ label: label(lang, "add"), value: address, ltrValue: !/[\u0600-\u06FF]/.test(address) });
  const mobile = str(v, "mobile");
  if (mobile) rows.push({ label: label(lang, "mob"), value: `${mobile}${v.whatsapp ? " · WhatsApp" : ""}`, ltrValue: true });
  const wechat = str(v, "wechat");
  if (wechat) rows.push({ label: label(lang, "wechat"), value: wechat, ltrValue: true });
  const email = str(v, "email");
  if (email) rows.push({ label: label(lang, "email"), value: email, ltrValue: true });
  const web = str(v, "web");
  if (web) rows.push({ label: label(lang, "web"), value: web, ltrValue: true });
  return rows;
}

const isAddress = (r: Row) => Object.values(LABELS).some((l) => l.add === r.label);

/** Labels in one column, values in the next (so the values line up); the
 *  address may wrap, every other line is condensed to the width if needed. */
function layoutContacts(rows: Row[], size: number, width: number, maxAddressLines: number) {
  const labelW = Math.max(0, ...rows.map((r) => textWidth(r.label + " ", size, 600)));
  const room = width - labelW;
  const lines = rows.flatMap((r) =>
    (isAddress(r) ? wrap(r.value, size, room, maxAddressLines) : [r.value]).map((text, i) => ({ label: i ? "" : r.label, text, ltr: r.ltrValue })),
  );
  return { labelW, room, lines };
}

/** Contact rows from `x` (the logical start: left, or right in Arabic),
 *  the first baseline at `y` (align "top") or the last one (align "bottom"). */
export function Contacts({ rows, x, y, align, width, rtl, size, fill, labelFill, gap = 1.42, maxAddressLines = 2 }: {
  rows: Row[]; x: number; y: number; align: "top" | "bottom"; width: number; rtl: boolean; size: number;
  fill: string; labelFill?: string; gap?: number; maxAddressLines?: number;
}) {
  const lead = size * gap;
  const { labelW, room, lines } = layoutContacts(rows, size, width, maxAddressLines);
  const top = align === "top" ? y : y - (lines.length - 1) * lead;
  const vx = rtl ? x - labelW : x + labelW;
  return (
    <g>
      {lines.map((l, i) => {
        const yy = top + i * lead;
        return (
          <g key={i}>
            {l.label ? (
              <text x={x} y={yy} direction={rtl ? "rtl" : "ltr"} textAnchor="start" fill={labelFill ?? fill}
                style={{ fontFamily: FONT, fontSize: size, fontWeight: 600 }}>{l.label}</text>
            ) : null}
            <text x={vx} y={yy} direction={l.ltr ? "ltr" : "rtl"} textAnchor={rtl && l.ltr ? "end" : "start"} fill={fill}
              {...fit(l.text, size, room)} style={{ fontFamily: FONT, fontSize: size, fontWeight: 400 }}>{l.text}</text>
          </g>
        );
      })}
    </g>
  );
}

/** Distance from the first baseline to the last of a Contacts block. */
export function contactsSpan(rows: Row[], size: number, width: number, gap = 1.42, maxAddressLines = 2): number {
  return Math.max(0, layoutContacts(rows, size, width, maxAddressLines).lines.length - 1) * size * gap;
}

export const SIZE = { name: 9 * PT, title: 7 * PT, contact: 6.5 * PT, small: 5.5 * PT };
