/* ---------------------------------------------------------------------------
   Brand Center — an item's rules (plan steps C19–C39: each section built).
   What a designer, a printer or a supplier needs to make the item right:
   the specification lines, where the logo goes, do and don't, what to send
   the vendor, the templates that fill it and the book's chapters. Stored in
   brand_items.rules (jsonb); the owner edits them in the item's page.
   Shared by the server (checks a save) and the screens.
   --------------------------------------------------------------------------- */

export interface ItemRules {
  /** Specification lines, e.g. { k: "Size", v: "A4 210 × 297 mm" }. */
  specs?: Array<{ k: string; v: string }>;
  /** Where the logo goes, how big, in what colour. */
  logo?: string;
  do?: string[];
  dont?: string[];
  /** What to send the printer or supplier, and what to check on delivery. */
  vendor?: string;
  /** Built-in templates that fill this item (their ids). */
  templates?: string[];
  /** The brand book's chapters on it. */
  book?: number[];
  /** Choices of the item the rules forbid (a workshop option the standing
   *  rules overrode), by "<type key>.<option key>", each with the reason. */
  notAllowed?: Array<{ option: string; why: string }>;
}

/** How a choice is named in `notAllowed`. */
export const optionRef = (typeKey: string, optionKey: string) => `${typeKey}.${optionKey}`;

/** The forbidden choices of these rules: reference → reason. */
export const notAllowedOf = (r: ItemRules | null | undefined) => new Map((r?.notAllowed ?? []).map((x) => [x.option, x.why] as const));

/** The templates an item can link to, and their names' words keys. */
export const RULE_TEMPLATES: Record<string, string> = {
  "business-card": "tpl.businessCard",
  "id-badge": "tpl.staffCard",
  "email-signature": "tpl.signature",
  "event-badge": "tpl.badge",
  certificate: "tpl.certificate",
  "product-post": "tpl.productPost",
  "event-post": "tpl.eventPost",
  "occasion-post": "tpl.occasionPost",
  "hiring-post": "tpl.hiringPost",
  "print-proof": "tpl.printProof",
};

const LIMITS = { line: 600, block: 3000, lines: 40 };
const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const lines = (v: unknown) => (Array.isArray(v) ? v.map((x) => s(x, LIMITS.line)).filter(Boolean).slice(0, LIMITS.lines) : []);

/** A save's rules, kept to their shape and sizes; null when not rules. */
export function cleanRules(x: unknown): ItemRules | null {
  if (!x || typeof x !== "object" || Array.isArray(x)) return null;
  const r = x as Record<string, unknown>;
  const out: ItemRules = {};
  const specs = Array.isArray(r.specs)
    ? r.specs.map((p) => ({ k: s((p as { k?: unknown })?.k, 80), v: s((p as { v?: unknown })?.v, LIMITS.line) })).filter((p) => p.k && p.v).slice(0, LIMITS.lines)
    : [];
  if (specs.length) out.specs = specs;
  const logo = s(r.logo, LIMITS.block), vendor = s(r.vendor, LIMITS.block);
  if (logo) out.logo = logo;
  if (vendor) out.vendor = vendor;
  const d = lines(r.do), dn = lines(r.dont);
  if (d.length) out.do = d;
  if (dn.length) out.dont = dn;
  const tpl = Array.isArray(r.templates) ? r.templates.filter((t): t is string => typeof t === "string" && t in RULE_TEMPLATES).slice(0, 10) : [];
  if (tpl.length) out.templates = tpl;
  const book = Array.isArray(r.book) ? r.book.filter((n): n is number => Number.isInteger(n) && n > 0 && n < 1000).slice(0, 12) : [];
  if (book.length) out.book = book;
  const no = Array.isArray(r.notAllowed)
    ? r.notAllowed.map((x) => ({ option: s((x as { option?: unknown })?.option, 120), why: s((x as { why?: unknown })?.why, LIMITS.line) })).filter((x) => x.option && x.why).slice(0, 60)
    : [];
  if (no.length) out.notAllowed = no;
  return out;
}

/** The rules proper (a list of forbidden choices alone is not yet rules). */
export const hasRules = (r: ItemRules | null | undefined) =>
  !!r && !!(r.specs?.length || r.logo || r.do?.length || r.dont?.length || r.vendor || r.templates?.length || r.book?.length);
