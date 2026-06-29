/* ---------------------------------------------------------------------------
   catalog-extract (server) — turn catalog TEXT into a reviewable SupplierDraft.

   The heavy lifting (PDF text + OCR of scanned pages + cover-image extraction)
   happens in the browser (see src/lib/catalog-client.ts) so we don't ship
   native canvas / OCR into the serverless runtime. The server only does the AI
   structuring + validation on the extracted text, via DeepSeek (ai-provider).
   --------------------------------------------------------------------------- */

import { aiChat } from "./ai-provider";

export interface SupplierContactDraft {
  full_name?: string | null;
  role?: string | null;
  email?: string | null;
  mobile?: string | null;
  wechat?: string | null;
}

export interface SupplierDraft {
  company_name_en: string | null;
  company_name_cn: string | null;
  /* Cover / marketing brand — captured in both scripts when present. */
  brand_en: string | null;
  brand_cn: string | null;
  website: string | null;
  email: string | null;
  /* Mobile vs landline are separate columns in the supplier record. */
  mobile: string | null;
  tel: string | null;
  fax: string | null;
  wechat: string | null;
  qq: string | null;
  address: string | null;
  postal_code: string | null;
  year_established: string | null;
  business_type: string | null;
  main_products: string[];
  contact_persons: SupplierContactDraft[];
  confidence: "high" | "medium" | "low";
  notes: string | null;
}

const clean = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  // Strip U+FFFD replacement chars (unmappable subsetted-font glyphs) and
  // collapse the whitespace they leave behind.
  const s = v.replace(/�/g, "").replace(/[ \t]{2,}/g, " ").trim();
  return s && s.toLowerCase() !== "null" && s.toLowerCase() !== "n/a" ? s : null;
};

const url = (v: unknown): string | null => {
  const s = clean(v);
  if (!s) return null;
  return s.replace(/^(https?:\/\/)\s+/i, "$1").replace(/\s+/g, "").replace(/\/+$/, "") || null;
};

const strList = (v: unknown): string[] => {
  if (!Array.isArray(v)) return [];
  return v.map((x) => clean(x)).filter((x): x is string => !!x).slice(0, 12);
};

function parseDraft(reply: string): SupplierDraft | null {
  const cleaned = reply.replace(/```json|```/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
  const contacts = Array.isArray(obj.contact_persons)
    ? (obj.contact_persons as Record<string, unknown>[])
        .slice(0, 8)
        .map((c) => ({
          full_name: clean(c?.full_name),
          role: clean(c?.role),
          email: clean(c?.email),
          mobile: clean(c?.mobile),
          wechat: clean(c?.wechat),
        }))
        .filter((c) => c.full_name || c.email || c.mobile)
    : [];
  const conf = String(obj.confidence ?? "").toLowerCase();
  return {
    company_name_en: clean(obj.company_name_en),
    company_name_cn: clean(obj.company_name_cn),
    brand_en: clean(obj.brand_en),
    brand_cn: clean(obj.brand_cn),
    website: url(obj.website),
    email: clean(obj.email),
    mobile: clean(obj.mobile),
    tel: clean(obj.tel),
    fax: clean(obj.fax),
    wechat: clean(obj.wechat),
    qq: clean(obj.qq),
    address: clean(obj.address),
    postal_code: clean(obj.postal_code),
    year_established: clean(obj.year_established),
    business_type: clean(obj.business_type),
    main_products: strList(obj.main_products),
    contact_persons: contacts,
    confidence: conf === "high" || conf === "low" ? (conf as "high" | "low") : "medium",
    notes: clean(obj.notes),
  };
}

/** Structure already-extracted catalog text into a SupplierDraft via the AI. */
export async function structureSupplierFromText(
  text: string,
  filename: string,
): Promise<{ draft: SupplierDraft | null; error?: string }> {
  const body = (text || "").trim();
  if (body.length < 30) {
    return { draft: null, error: "Not enough text was extracted from the catalog." };
  }

  const system =
    "You are a precise data-extraction engine for industrial supplier catalogs, " +
    "which are frequently bilingual (English + Chinese). You extract the identity " +
    "and contact details of the COMPANY THAT PUBLISHED the catalog (the supplier / " +
    "manufacturer) — never their customers or partners. The text may be noisy OCR " +
    "output; infer carefully but never invent. Respond with ONLY a JSON object.";

  const user = [
    "Extract these fields from the catalog text below and return JSON exactly in this shape:",
    "{",
    '  "company_name_en": string|null,   // full legal/registered company name in English',
    '  "company_name_cn": string|null,   // full company name in Chinese',
    '  "brand_en": string|null,          // the MARKETING/PRODUCT brand shown on the cover (Latin script), e.g. "LORDI" — NOT the company short name',
    '  "brand_cn": string|null,          // the marketing/product brand in Chinese, e.g. "机针宝" — the brand featured on the cover, which can differ from the company name',
    '  "website": string|null,',
    '  "email": string|null,',
    '  "mobile": string|null,            // mobile / cell number',
    '  "tel": string|null,               // landline / office telephone',
    '  "fax": string|null,',
    '  "wechat": string|null,            // WeChat ID',
    '  "qq": string|null,                // QQ number',
    '  "address": string|null,           // full address (prefer the most complete one)',
    '  "postal_code": string|null,',
    '  "year_established": string|null,  // founding year if stated',
    '  "business_type": string|null,     // e.g. "Manufacturer", "Trading company", "Manufacturer & Exporter"',
    '  "main_products": string[],        // key product lines / categories the company makes',
    '  "contact_persons": [{ "full_name": string|null, "role": string|null, "email": string|null, "mobile": string|null, "wechat": string|null }],',
    '  "confidence": "high"|"medium"|"low",',
    '  "notes": string|null              // anything notable not captured above',
    "}",
    "Rules:",
    "- BRAND vs COMPANY: the brand is the product/marketing name featured prominently on the cover (logo wordmark, product series). It is OFTEN different from the company's short name. Capture both Chinese and Latin brand if both appear.",
    "- Use null for anything not clearly present; do not invent. Keep emails/phones/URLs exactly as written.",
    `- Filename hint: "${filename}".`,
    "",
    "CATALOG TEXT:",
    body.slice(0, 12000),
  ].join("\n");

  const res = await aiChat([
    { role: "system", content: system },
    { role: "user", content: user },
  ]);
  if (!res) return { draft: null, error: "AI is currently unavailable." };

  const draft = parseDraft(res.reply);
  if (!draft) return { draft: null, error: "Could not parse the extraction result." };
  return { draft };
}
