import "server-only";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { aiChat, aiProviderConfigured } from "@/lib/server/ai-provider";

/* POST /api/ai/product-copy — AI-drafted marketing copy for the product form.
   { field: "tagline" | "excerpt" | "highlights" | "tags", context: {...} }
     → tagline/excerpt: { value: string }
     → highlights/tags: { values: string[] }
   Suggestions only — the operator reviews and saves; nothing is written
   server-side. Returns { fallback: true, reason } when no provider is
   configured or the model reply can't be parsed, mirroring /api/ai/translate. */

type Field = "tagline" | "excerpt" | "highlights" | "tags";

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
  "no vague superlatives. Ground every claim in the provided facts; never invent specs.";

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
function parseJson(reply: string): { value?: string; values?: string[] } | null {
  const m = reply.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const obj = JSON.parse(m[0]) as { value?: unknown; values?: unknown };
    const out: { value?: string; values?: string[] } = {};
    if (typeof obj.value === "string") out.value = obj.value.trim();
    if (Array.isArray(obj.values)) {
      out.values = obj.values
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim())
        .filter(Boolean);
    }
    return out.value || out.values?.length ? out : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  let body: { field?: Field; context?: Ctx };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  const field = body.field;
  if (!field || !["tagline", "excerpt", "highlights", "tags"].includes(field)) {
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

  return NextResponse.json(parsed);
}
