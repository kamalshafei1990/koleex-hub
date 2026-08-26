import "server-only";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { requireInternalUser } from "@/lib/server/ai/require-internal";
import { aiChat, aiProviderConfigured } from "@/lib/server/ai-provider";

/* POST /api/ai/product-copy — AI-drafted marketing copy for the product form.
   { field: "tagline" | "excerpt" | "highlights" | "tags", context: {...} }
     → tagline/excerpt: { value: string }
     → highlights/tags: { values: string[] }
   Suggestions only — the operator reviews and saves; nothing is written
   server-side. Returns { fallback: true, reason } when no provider is
   configured or the model reply can't be parsed, mirroring /api/ai/translate. */

type Field = "tagline" | "excerpt" | "highlights" | "tags" | "hs_code";

interface Ctx {
  name?: string;
  brand?: string;
  family?: string;
  division?: string;
  category?: string;
  subcategory?: string;
  models?: string[];
  specs?: Record<string, string>;
  description?: string;
  existing?: string | string[];
}

const VOICE =
  "You write product copy for KOLEEX, a global industrial garment-machinery brand. " +
  "Voice: professional, precise, confident — no hype, no exclamation marks, no emojis, " +
  "no vague superlatives. Ground every claim in the provided facts; never invent specs. " +
  "ABSOLUTE RULE: this copy is customer-facing — KOLEEX is the ONLY company name allowed; " +
  "never mention suppliers, manufacturers or their factory reference codes even if they " +
  "appear in the provided facts; use KOLEEX product codes only.";

function contextBlock(c: Ctx): string {
  const lines: string[] = [];
  if (c.name) lines.push(`Product: ${c.name}`);
  if (c.brand) lines.push(`Brand: ${c.brand}`);
  if (c.family) lines.push(`Family: ${c.family}`);
  const path = [c.division, c.category, c.subcategory].filter(Boolean).join(" > ");
  if (path) lines.push(`Classification: ${path}`);
  if (c.models?.length) lines.push(`Models: ${c.models.slice(0, 6).join(", ")}`);
  if (c.specs && Object.keys(c.specs).length) {
    const specs = Object.entries(c.specs)
      .slice(0, 40)
      .map(([k, v]) => `${k}: ${v}`)
      .join("; ");
    lines.push(`Specs: ${specs}`);
  }
  if (c.description) lines.push(`Description: ${c.description.slice(0, 1500)}`);
  return lines.join("\n");
}

/* ── HS classification reference ────────────────────────────────────────────
   A CLOSED list of the WCO 6-digit headings that cover Koleex's world
   (garment machinery). The model must pick from THIS table, not from its
   memory: an HS code is a customs declaration, and a hallucinated one is a
   held shipment or a fine. Six digits are the international part — importing
   countries append their own suffixes, which is the broker's job, not ours. */
const HS_REFERENCE = `
84.52 — SEWING MACHINES
  8452.21  industrial sewing machines, AUTOMATIC units (auto trimmer / servo / computer-controlled)
  8452.29  industrial sewing machines, other (manual clutch, basic)
  8452.10  household sewing machines
  8452.30  sewing machine needles
  8452.90  furniture, bases, covers and PARTS of sewing machines
84.51 — WASHING / DRYING / IRONING / FINISHING machinery for textiles
  8451.30  ironing machines and presses (incl. FUSING presses, HEAT presses, steam pressing stations)
  8451.40  washing, bleaching or dyeing machines
  8451.21  drying machines, capacity <= 10 kg dry linen
  8451.29  drying machines, other (incl. tunnel drying/ironing systems)
  8451.50  machines for reeling, unreeling, folding, CUTTING or pinking textile fabrics (incl. SPREADING machines, fabric relaxing/inspection with cutting, cutting tables)
  8451.80  other finishing machinery (fabric inspection without cutting, preshrinking, calendering for garments)
  8451.90  parts of 84.51 machines
84.47 — knitting machines, stitch-bonding, EMBROIDERY machines
  8447.90  embroidery machines and stitch-bonding
84.48 — AUXILIARY machinery and parts for 84.44–84.47 (needles, sinkers, dobbies)
84.02 — steam BOILERS
  8402.19  vapour-generating boilers, other (incl. small standalone steam generators for pressing lines)
  8402.90  parts of steam boilers
84.43 — PRINTING machinery
  8443.32  inkjet printers connectable to a computer (incl. DTF / transfer printers)
84.56 — LASER cutting machines
  8456.11  machine tools operated by laser
84.79 — machines with individual functions not elsewhere specified (only when nothing above fits)
`;

/* ── ZERO-TRUST on the model's answer ────────────────────────────────────────
   Owner (2026-08-25): "it is very sensitive information so I want zero
   mistake". The prompt already tells the model to pick from the table, but a
   prompt is a request, not a guarantee — so the ANSWER is validated against
   the same table it was told to use. A code that is not literally printed in
   HS_REFERENCE never reaches the form, whatever the model says. This is the
   difference between "the AI was told not to" and "the system cannot". */
const VALID_HS_CODES = new Set(
  [...HS_REFERENCE.matchAll(/^\s+(\d{4}\.\d{2})\s/gm)].map((m) => m[1]),
);

function prompt(field: Field, c: Ctx): string {
  const base = contextBlock(c);
  switch (field) {
    case "tagline":
      return (
        `${base}\n\nWrite ONE tagline for this product's public page (shown big under the name). ` +
        `Max 75 characters. No quotes, no trailing period needed, English. ` +
        `Reply with JSON only: {"value":"..."}`
      );
    case "excerpt":
      return (
        `${base}\n\nWrite a short description: 1–2 sentences (max 220 characters) summarising what the product is ` +
        `and its main benefit, for search results and the product card. English. ` +
        `Reply with JSON only: {"value":"..."}`
      );
    case "highlights":
      return (
        `${base}\n\nWrite 4–5 key highlight bullets for the public page. Each is a standalone fact, ` +
        `max 55 characters, no ending punctuation, English. Prefer concrete numbers from the specs. ` +
        `Reply with JSON only: {"values":["...", "..."]}`
      );
    case "hs_code":
      return (
        `${base}\n\nClassify this machine for customs. Pick the single best 6-digit HS code ` +
        `FROM THE REFERENCE TABLE below — never invent a code that is not in the table. ` +
        `If two headings could apply, pick the more specific one and say why in one short sentence. ` +
        `If genuinely nothing in the table fits, reply {"value":""} with the reason.\n` +
        `${HS_REFERENCE}\n` +
        `Reply with JSON only: {"value":"8452.21","reason":"one short sentence"}`
      );
    case "tags":
      return (
        `${base}\n\nList 8–12 search keywords/tags for this product: lowercase English single words or ` +
        `short phrases buyers would search (include process, fabric types, machine type synonyms). ` +
        `Reply with JSON only: {"values":["...", "..."]}`
      );
  }
}

/** Pull the first JSON object out of a model reply that may carry prose or
 *  markdown fences around it. */
function parseJson(reply: string): { value?: string; values?: string[]; reason?: string } | null {
  const m = reply.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const obj = JSON.parse(m[0]) as { value?: unknown; values?: unknown; reason?: unknown };
    const out: { value?: string; values?: string[]; reason?: string } = {};
    if (typeof obj.value === "string") out.value = obj.value.trim();
    if (typeof obj.reason === "string") out.reason = obj.reason.trim().slice(0, 200);
    if (Array.isArray(obj.values)) {
      out.values = obj.values
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim())
        .filter(Boolean);
    }
    return out.value || out.values?.length || out.reason ? out : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  {
    const notInternal = requireInternalUser(auth);
    if (notInternal) return notInternal;
  }

  let body: { field?: Field; context?: Ctx };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  const field = body.field;
  if (!field || !["tagline", "excerpt", "highlights", "tags", "hs_code"].includes(field)) {
    return NextResponse.json({ error: "Unknown field" }, { status: 400 });
  }
  const ctx = body.context ?? {};
  if (!ctx.name && !ctx.subcategory) {
    return NextResponse.json({ error: "Context too thin — need at least a name or subcategory" }, { status: 400 });
  }

  if (!aiProviderConfigured()) {
    return NextResponse.json({ fallback: true, reason: "no_provider" });
  }

  const result = await aiChat([
    { role: "system", content: VOICE },
    { role: "user", content: prompt(field, ctx) },
  ]);
  if (!result) return NextResponse.json({ fallback: true, reason: "provider_error" });

  const parsed = parseJson(result.reply);
  if (!parsed) return NextResponse.json({ fallback: true, reason: "parse_error" });

  /* hs_code: refuse anything outside the curated table. An empty value with a
     reason is an honest "nothing fits" and passes through as-is. */
  if (field === "hs_code" && parsed.value && !VALID_HS_CODES.has(parsed.value)) {
    return NextResponse.json({
      value: "",
      reason: `The model suggested ${parsed.value}, which is not in the vetted reference table — refused. Enter the code manually or consult the customs broker.`,
    });
  }

  return NextResponse.json(parsed);
}
