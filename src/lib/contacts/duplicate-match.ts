/* ---------------------------------------------------------------------------
   duplicate-match — find likely-duplicate suppliers BEFORE a new one is saved.

   The problem: a supplier profile has many fields, so a freshly-added record
   (manual OR from a catalog) might carry only a name/brand while the existing
   record is much fuller — they look different but are the SAME company.

   So we match tolerantly on a mix of signals:
     • STRONG (almost certainly the same): email, website domain, phone digits,
       WeChat id, tax / business-registration number — an exact hit on any of
       these is decisive.
     • SOFT (possibly the same): company name (EN + 中文) and brand, after
       normalizing away legal suffixes / punctuation / case, then fuzzy-compared.

   Pure + framework-free so it can run in the form (pre-save) or on the server.
   --------------------------------------------------------------------------- */

export interface DupCandidate {
  names: string[];
  brands: string[];
  websites: string[];
  emails: string[];
  phones: string[];
  wechats: string[];
  taxIds: string[];
}

export interface DupMatch {
  id: string;
  name: string;
  score: number;
  level: "high" | "medium";
  reasons: string[];
}

/* Only TRUE legal-entity suffixes are stripped — descriptive words like
   "trading" / "technology" / "machinery" are kept so distinct companies that
   share a descriptor don't collapse into one. */
const LEGAL = [
  "co ltd", "co. ltd", "co.,ltd", "co., ltd", "company limited", "company",
  "limited", "ltd", "inc", "incorporated", "corp", "corporation", "llc",
  "gmbh", "plc", "pvt", "pte", "sa", "ag", "co",
];
const LEGAL_CN = ["有限责任公司", "股份有限公司", "有限公司", "公司"];

function norm(v: unknown): string {
  if (typeof v !== "string") return "";
  let s = v.toLowerCase().trim();
  for (const c of LEGAL_CN) s = s.split(c).join(" ");
  // strip punctuation → spaces, collapse
  s = s.replace(/[.,/\\&()\-_'"’，。、（）]+/g, " ").replace(/\s+/g, " ").trim();
  // strip trailing legal suffixes (token-aware)
  let changed = true;
  while (changed) {
    changed = false;
    for (const suf of LEGAL) {
      if (s === suf) { s = ""; break; }
      if (s.endsWith(" " + suf)) { s = s.slice(0, -(suf.length + 1)).trim(); changed = true; }
    }
  }
  return s.replace(/\s+/g, "").trim(); // final compact form for exact compare
}

function tokens(v: unknown): string[] {
  if (typeof v !== "string") return [];
  let s = v.toLowerCase();
  for (const c of LEGAL_CN) s = s.split(c).join(" ");
  s = s.replace(/[.,/\\&()\-_'"’，。、（）]+/g, " ");
  const out = s.split(/\s+/).filter((t) => t && !LEGAL.includes(t) && t.length > 1);
  return out;
}

const digits = (v: unknown): string => (typeof v === "string" ? v.replace(/\D/g, "") : "");

function domain(v: unknown): string {
  if (typeof v !== "string" || !v.trim()) return "";
  let s = v.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "");
  s = s.split("/")[0].split("?")[0].split("@").pop() || s;
  return s.replace(/\s+/g, "");
}

const lc = (v: unknown): string => (typeof v === "string" ? v.trim().toLowerCase() : "");
const uniq = (a: string[]): string[] => [...new Set(a.filter(Boolean))];

/** Jaccard token overlap, 0..1. */
function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const A = new Set(a), B = new Set(b);
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Build a comparison candidate from a loose record (ContactForm or ContactRow). */
export function toCandidate(src: Record<string, unknown>): DupCandidate {
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x ?? "")) : []);
  const names = uniq([
    String(src.company_name_en ?? ""), String(src.company_name_cn ?? ""),
    String(src.company ?? ""), String(src.display_name ?? ""),
    String(src.trading_name ?? ""), String(src.full_name ?? ""),
  ]);
  const brands = uniq(arr(src.brand_names));
  const emailEntries = Array.isArray(src.emails) ? (src.emails as { email?: string }[]).map((e) => e?.email || "") : [];
  const phoneEntries = Array.isArray(src.phones) ? (src.phones as { number?: string }[]).map((p) => p?.number || "") : [];
  const webEntries = Array.isArray(src.websites) ? (src.websites as { url?: string }[]).map((w) => w?.url || "") : [];
  return {
    names,
    brands,
    websites: uniq([String(src.supplier_website ?? ""), String(src.website ?? ""), ...webEntries].map(domain)),
    emails: uniq([String(src.email ?? ""), ...emailEntries].map(lc)),
    phones: uniq([String(src.supplier_mobile ?? ""), String(src.supplier_tel ?? ""), String(src.phone ?? ""), ...phoneEntries].map(digits)).filter((d) => d.length >= 7),
    wechats: uniq([String(src.wechat_id ?? ""), String(src.wechat_official_account ?? "")].map(lc)),
    taxIds: uniq([String(src.tax_id ?? ""), String(src.business_registration_number ?? "")].map((s) => s.replace(/\s+/g, "").toLowerCase())),
  };
}

function bestName(src: Record<string, unknown>): string {
  return (
    String(src.display_name || src.company_name_en || src.company_name_cn || src.company || src.full_name || "").trim() ||
    "Unnamed supplier"
  );
}

const overlap = (a: string[], b: string[]): boolean => a.some((x) => x && b.includes(x));

/**
 * Compare a new supplier against existing ones. Returns likely matches, best
 * first. `excludeId` skips the record being edited.
 */
export function findSupplierDuplicates(
  candidateSrc: Record<string, unknown>,
  existing: Record<string, unknown>[],
  excludeId?: string,
): DupMatch[] {
  const cand = toCandidate(candidateSrc);
  const candNamesNorm = uniq(cand.names.map(norm)).filter(Boolean);
  const candBrandsNorm = uniq(cand.brands.map(norm)).filter(Boolean);
  const candNameTokens = cand.names.flatMap(tokens);

  const out: DupMatch[] = [];
  for (const row of existing) {
    if (excludeId && row.id === excludeId) continue;
    if (row.contact_type && row.contact_type !== "supplier") continue;
    const ex = toCandidate(row);
    let score = 0;
    const reasons: string[] = [];
    let strong = false;

    if (overlap(cand.emails, ex.emails)) { score += 50; reasons.push("Same email"); strong = true; }
    if (overlap(cand.websites, ex.websites)) { score += 45; reasons.push("Same website"); strong = true; }
    if (overlap(cand.phones, ex.phones)) { score += 42; reasons.push("Same phone number"); strong = true; }
    if (overlap(cand.wechats, ex.wechats)) { score += 40; reasons.push("Same WeChat"); strong = true; }
    if (overlap(cand.taxIds, ex.taxIds)) { score += 50; reasons.push("Same tax / registration no."); strong = true; }

    const exNamesNorm = uniq(ex.names.map(norm)).filter(Boolean);
    const exBrandsNorm = uniq(ex.brands.map(norm)).filter(Boolean);
    if (overlap(candNamesNorm, exNamesNorm)) {
      score += 45; reasons.push("Same company name");
    } else {
      const sim = jaccard(candNameTokens, ex.names.flatMap(tokens));
      if (sim >= 0.6) { score += 30; reasons.push("Similar company name"); }
    }
    if (candBrandsNorm.length && overlap(candBrandsNorm, exBrandsNorm)) { score += 30; reasons.push("Same brand"); }
    // brand ↔ name cross-match (cover brand often differs from legal name)
    if (overlap(candBrandsNorm, exNamesNorm) || overlap(candNamesNorm, exBrandsNorm)) {
      score += 25; reasons.push("Brand matches company name");
    }

    if (!reasons.length) continue;
    const level: "high" | "medium" = strong || score >= 45 ? "high" : "medium";
    if (score < 25) continue;
    out.push({ id: String(row.id), name: bestName(row), score: Math.min(100, score), level, reasons: uniq(reasons) });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 6);
}
