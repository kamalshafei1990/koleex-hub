/* ---------------------------------------------------------------------------
   catalog-extract — analyze a supplier PDF catalog and pull the supplier's
   identity + contact info, ready to pre-fill a new supplier.

   Pipeline: PDF → text (unpdf, serverless-friendly) → AI structuring (DeepSeek
   via ai-provider) → validated SupplierDraft. No DB writes here; the caller
   reviews/confirms before anything is created.
   --------------------------------------------------------------------------- */

import { extractText, getDocumentProxy } from "unpdf";
import { aiChat } from "./ai-provider";

export interface SupplierContactDraft {
  full_name?: string | null;
  role?: string | null;
  email?: string | null;
  mobile?: string | null;
}

export interface SupplierDraft {
  company_name_en: string | null;
  company_name_cn: string | null;
  brand: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  contact_persons: SupplierContactDraft[];
  confidence: "high" | "medium" | "low";
  notes: string | null;
}

/** Extract per-page plain text from a PDF (server-side). */
export async function pdfToText(
  data: Uint8Array,
): Promise<{ pages: string[]; totalPages: number }> {
  const pdf = await getDocumentProxy(data);
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(text) ? text.map((t) => t ?? "") : [String(text ?? "")];
  return { pages, totalPages };
}

/** Company identity usually lives on the cover + first few pages and the back
   cover. Take those, label them, and cap the size so the AI prompt stays lean. */
function pickRelevantText(pages: string[]): string {
  const idx = new Set<number>();
  for (let i = 0; i < Math.min(4, pages.length); i++) idx.add(i);
  for (let i = Math.max(0, pages.length - 2); i < pages.length; i++) idx.add(i);
  const ordered = [...idx].sort((a, b) => a - b);
  const joined = ordered
    .map((i) => `[page ${i + 1}]\n${(pages[i] || "").trim()}`)
    .join("\n\n");
  return joined.slice(0, 9000);
}

function parseDraft(reply: string): SupplierDraft | null {
  // Strip code fences / surrounding prose and grab the JSON object.
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
  const str = (v: unknown): string | null => {
    if (typeof v !== "string") return null;
    const s = v.trim();
    return s && s.toLowerCase() !== "null" && s !== "n/a" ? s : null;
  };
  const contacts = Array.isArray(obj.contact_persons)
    ? (obj.contact_persons as Record<string, unknown>[]).slice(0, 8).map((c) => ({
        full_name: str(c?.full_name),
        role: str(c?.role),
        email: str(c?.email),
        mobile: str(c?.mobile),
      })).filter((c) => c.full_name || c.email || c.mobile)
    : [];
  const conf = String(obj.confidence ?? "").toLowerCase();
  return {
    company_name_en: str(obj.company_name_en),
    company_name_cn: str(obj.company_name_cn),
    brand: str(obj.brand),
    website: str(obj.website)?.replace(/\/+$/, "") ?? null,
    email: str(obj.email),
    phone: str(obj.phone),
    address: str(obj.address),
    contact_persons: contacts,
    confidence: conf === "high" || conf === "low" ? (conf as "high" | "low") : "medium",
    notes: str(obj.notes),
  };
}

/** Analyze a catalog PDF buffer → a reviewable SupplierDraft (or null if the
   PDF has no extractable text / the AI is unavailable). */
export async function extractSupplierFromCatalog(
  data: Uint8Array,
  filename: string,
): Promise<{ draft: SupplierDraft | null; textFound: boolean; error?: string }> {
  let pages: string[] = [];
  try {
    ({ pages } = await pdfToText(data));
  } catch (e) {
    return { draft: null, textFound: false, error: `Could not read PDF: ${(e as Error).message}` };
  }
  const text = pickRelevantText(pages);
  if (text.replace(/\[page \d+\]/g, "").trim().length < 40) {
    // Almost no selectable text → likely a scanned/image-only catalog.
    return { draft: null, textFound: false, error: "scanned-or-empty" };
  }

  const system =
    "You are a precise data-extraction engine for industrial supplier catalogs, " +
    "which are frequently bilingual (English + Chinese). You extract the identity " +
    "and contact details of the COMPANY THAT PUBLISHED the catalog (the supplier / " +
    "manufacturer) — never their customers or partners. Respond with ONLY a JSON " +
    "object, no commentary.";

  const user = [
    "Extract these fields from the catalog text below and return JSON exactly in this shape:",
    `{`,
    `  "company_name_en": string|null,   // English company name`,
    `  "company_name_cn": string|null,   // Chinese company name (中文) if present`,
    `  "brand": string|null,             // brand / trademark if different from company`,
    `  "website": string|null,           // no trailing slash`,
    `  "email": string|null,             // primary email`,
    `  "phone": string|null,             // primary phone, as printed`,
    `  "address": string|null,           // full address`,
    `  "contact_persons": [{ "full_name": string|null, "role": string|null, "email": string|null, "mobile": string|null }],`,
    `  "confidence": "high"|"medium"|"low",`,
    `  "notes": string|null              // anything notable / ambiguous`,
    `}`,
    "Rules: use null for anything not clearly present. Do not invent values. Keep emails/phones/URLs exactly as written.",
    `Filename hint: "${filename}".`,
    "",
    "CATALOG TEXT:",
    text,
  ].join("\n");

  const res = await aiChat([
    { role: "system", content: system },
    { role: "user", content: user },
  ]);
  if (!res) return { draft: null, textFound: true, error: "AI unavailable" };

  const draft = parseDraft(res.reply);
  if (!draft) return { draft: null, textFound: true, error: "Could not parse extraction" };
  return { draft, textFound: true };
}
