import "server-only";

/* ---------------------------------------------------------------------------
   marketing/captions — Koleex AI writes a post's caption, one per platform,
   from a short idea and/or a product of the catalogue.

   The house style is the one on Koleex's own pages (the 62 posts seen in
   Odoo): a short hook line, then the product and what it does for the
   buyer, then hashtags — e.g. "Quality starts before the first cut. The
   Koleex XF-A03-6 …". Calm, precise, confident; no hype, no prices.
   Public text, so the HARD confidentiality rule applies (as in
   /api/ai/product-copy): KOLEEX is the only company name, KOLEEX codes only.
   Products: ACTIVE ones only (owner rule), and only their public fields —
   name, short description, highlights, tags, classification.
   Suggestions only: the person edits and saves; nothing is published here.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { aiChat, aiProviderConfigured } from "@/lib/server/ai-provider";
import { IG_CAPTION_MAX, IG_HASHTAGS_MAX, hashtagCount } from "@/lib/marketing/post-rules";

export type CaptionPlatform = "facebook" | "instagram";
export type CaptionLang = "en" | "ar" | "zh";

export interface ProductFacts {
  id: string;
  name: string;
  excerpt: string | null;
  highlights: string[];
  tags: string[];
  classification: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VOICE =
  "You write social media posts for KOLEEX, a global industrial garment-machinery brand. " +
  "House style, taken from Koleex's own pages: a short hook line first; then the product and what it does for the buyer, in plain words; then hashtags on the last line. " +
  "Example opening: \"Quality starts before the first cut. The Koleex XF-A03-6 …\". " +
  "Voice: professional, precise, confident — calm authority. No hype, no exclamation marks, no emojis, no vague superlatives, no prices or discounts. " +
  "Ground every claim in the facts given; never invent specifications, numbers or certifications. " +
  "ABSOLUTE RULE: this text is public — KOLEEX is the ONLY company name allowed; never mention suppliers, manufacturers or factory reference codes even if they appear in the facts; use KOLEEX product codes only.";

const LANG_NAME: Record<CaptionLang, string> = { en: "English", ar: "Arabic (Modern Standard, clear for Egypt and the Gulf)", zh: "Simplified Chinese" };

const PLATFORM_GUIDE: Record<CaptionPlatform, string> = {
  facebook: "facebook: 2–4 short sentences after the hook, then 1–3 hashtags (always #Koleex).",
  instagram: `instagram: the hook as its own first line, 2–3 short lines, then one line of 5–10 hashtags (always #Koleex); at most ${IG_CAPTION_MAX} characters and ${IG_HASHTAGS_MAX} hashtags.`,
};

/** The public facts of an ACTIVE product; null when it is not one. */
export async function productFacts(productId: string): Promise<ProductFacts | null> {
  if (!UUID_RE.test(productId)) return null;
  const { data, error } = await supabaseServer
    .from("products")
    .select("id, product_name, excerpt, highlights, tags, division_slug, category_slug, subcategory_slug")
    .eq("id", productId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error(`products: ${error.message}`);
  if (!data) return null;
  const p = data as { id: string; product_name: string; excerpt: string | null; highlights: string[] | null; tags: string[] | null; division_slug: string | null; category_slug: string | null; subcategory_slug: string | null };
  return {
    id: p.id,
    name: p.product_name,
    excerpt: p.excerpt,
    highlights: (p.highlights ?? []).slice(0, 6),
    tags: (p.tags ?? []).slice(0, 12),
    classification: [p.division_slug, p.category_slug, p.subcategory_slug].filter(Boolean).join(" > ").replace(/-/g, " "),
  };
}

/** ACTIVE products whose name matches — the composer's product search. */
export async function searchActiveProducts(q: string): Promise<Array<{ id: string; name: string }>> {
  const term = q.trim().slice(0, 80);
  if (!term) return [];
  const safe = term.replace(/[%_\\]/g, (c) => `\\${c}`);
  const { data, error } = await supabaseServer
    .from("products")
    .select("id, product_name")
    .eq("status", "active")
    .ilike("product_name", `%${safe}%`)
    .order("product_name", { ascending: true })
    .limit(12);
  if (error) throw new Error(`products: ${error.message}`);
  return ((data ?? []) as Array<{ id: string; product_name: string }>).map((p) => ({ id: p.id, name: p.product_name }));
}

function factsBlock(p: ProductFacts): string {
  const lines = [`Product: ${p.name}`];
  if (p.classification) lines.push(`Classification: ${p.classification}`);
  if (p.excerpt) lines.push(`Description: ${p.excerpt.slice(0, 600)}`);
  if (p.highlights.length) lines.push(`Highlights: ${p.highlights.join("; ")}`);
  if (p.tags.length) lines.push(`Keywords: ${p.tags.join(", ")}`);
  return lines.join("\n");
}

/** The captions out of a model reply that may carry prose or fences around
 *  its JSON; only the platforms asked for, only within Instagram's limits. */
export function parseCaptions(reply: string, platforms: CaptionPlatform[]): Record<string, string> | null {
  const m = reply.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const obj = JSON.parse(m[0]) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const p of platforms) {
      const v = obj[p];
      if (typeof v !== "string" || !v.trim()) continue;
      let caption = v.trim();
      if (p === "instagram") {
        if (Array.from(caption).length > IG_CAPTION_MAX) caption = Array.from(caption).slice(0, IG_CAPTION_MAX).join("").trimEnd();
        if (hashtagCount(caption) > IG_HASHTAGS_MAX) continue;
      }
      out[p] = caption;
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

export async function writeCaptions(input: {
  brief: string;
  product: ProductFacts | null;
  platforms: CaptionPlatform[];
  lang: CaptionLang;
}): Promise<{ captions: Record<string, string> } | { fallback: true; reason: "no_provider" | "provider_error" | "parse_error" }> {
  if (!aiProviderConfigured()) return { fallback: true, reason: "no_provider" };
  const parts: string[] = [];
  if (input.product) parts.push(factsBlock(input.product));
  if (input.brief.trim()) parts.push(`What the post is about (from the marketing team): ${input.brief.trim().slice(0, 1000)}`);
  parts.push(
    `Write one caption per platform, in ${LANG_NAME[input.lang]} (hashtags may stay in English):\n` +
    input.platforms.map((p) => `· ${PLATFORM_GUIDE[p]}`).join("\n") +
    `\nReply with JSON only: {${input.platforms.map((p) => `"${p}":"..."`).join(",")}}`,
  );
  const result = await aiChat([
    { role: "system", content: VOICE },
    { role: "user", content: parts.join("\n\n") },
  ]);
  if (!result) return { fallback: true, reason: "provider_error" };
  const captions = parseCaptions(result.reply, input.platforms);
  return captions ? { captions } : { fallback: true, reason: "parse_error" };
}
