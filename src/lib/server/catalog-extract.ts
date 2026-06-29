/* ---------------------------------------------------------------------------
   catalog-extract (server) — turn catalog TEXT into a reviewable SupplierDraft.

   The heavy lifting (PDF text + OCR of scanned pages) happens in the browser
   (see src/lib/catalog-client.ts) so we don't ship native canvas / OCR into
   the serverless runtime. The server only does the AI structuring + validation
   on the extracted text, via the existing DeepSeek-backed ai-provider.
   --------------------------------------------------------------------------- */

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
  const str = (v: unknown): string | null => {
    if (typeof v !== "string") return null;
    const s = v.trim();
    return s && s.toLowerCase() !== "null" && s.toLowerCase() !== "n/a" ? s : null;
  };
  const contacts = Array.isArray(obj.contact_persons)
    ? (obj.contact_persons as Record<string, unknown>[])
        .slice(0, 8)
        .map((c) => ({
          full_name: str(c?.full_name),
          role: str(c?.role),
          email: str(c?.email),
          mobile: str(c?.mobile),
        }))
        .filter((c) => c.full_name || c.email || c.mobile)
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

/** Structure already-extracted catalog text into a SupplierDraft via the AI. */
export async function structureSupplierFromText(
  text: string,
  filename: string,
): Promise<{ draft: SupplierDraft | null; error?: string }> {
  const clean = (text || "").trim();
  if (clean.length < 30) {
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
    '  "company_name_en": string|null,',
    '  "company_name_cn": string|null,',
    '  "brand": string|null,',
    '  "website": string|null,',
    '  "email": string|null,',
    '  "phone": string|null,',
    '  "address": string|null,',
    '  "contact_persons": [{ "full_name": string|null, "role": string|null, "email": string|null, "mobile": string|null }],',
    '  "confidence": "high"|"medium"|"low",',
    '  "notes": string|null',
    "}",
    "Rules: null for anything not clearly present; do not invent; keep emails/phones/URLs exactly as written.",
    `Filename hint: "${filename}".`,
    "",
    "CATALOG TEXT:",
    clean.slice(0, 12000),
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
