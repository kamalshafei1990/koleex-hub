import "server-only";

import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { aiTranslate, aiProviderConfigured } from "@/lib/server/ai-provider";

/* POST /api/ai/translate
     body: { text: string, target_lang: 'en' | 'zh' | 'ar', source_lang?: string }
   response: { translated: string, cached: boolean } | { error: string, fallback: string }

   Tenant-scoped cache: the same text asked twice across the team is
   translated once and then served from Postgres forever. */

const MAX_LEN = 8_000; // don't spend tokens on huge blobs

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json()) as {
    text?: string;
    target_lang?: "en" | "zh" | "ar";
    source_lang?: string;
  };

  const text = (body.text ?? "").trim();
  const target = body.target_lang;
  if (!text) return NextResponse.json({ translated: "", cached: false });
  if (!target || !["en", "zh", "ar"].includes(target)) {
    return NextResponse.json({ error: "target_lang must be en/zh/ar" }, { status: 400 });
  }
  if (text.length > MAX_LEN) {
    return NextResponse.json(
      { error: "text_too_long", fallback: text },
      { status: 413 },
    );
  }

  const source = body.source_lang ?? "auto";
  const hash = crypto.createHash("sha256").update(text).digest("hex");

  /* Check cache first */
  const { data: hit } = await supabaseServer
    .from("translation_cache")
    .select("translated_text, provider")
    .eq("tenant_id", auth.tenant_id)
    .eq("source_hash", hash)
    .eq("source_lang", source)
    .eq("target_lang", target)
    .maybeSingle();

  if (hit) {
    // Track usage so we can see what's hot + prune cold entries later.
    void supabaseServer
      .from("translation_cache")
      .update({
        hit_count: undefined,         // increment-style handled below
        last_used_at: new Date().toISOString(),
      })
      .eq("tenant_id", auth.tenant_id)
      .eq("source_hash", hash)
      .eq("source_lang", source)
      .eq("target_lang", target);
    // Best-effort increment — ignore if RPC not available.
    void supabaseServer.rpc("increment_translation_hit", {
      p_tenant_id: auth.tenant_id,
      p_hash: hash,
      p_source: source,
      p_target: target,
    });
    return NextResponse.json(
      { translated: hit.translated_text, cached: true, provider: hit.provider },
      { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" } },
    );
  }

  /* Miss — call the configured AI provider */
  if (!aiProviderConfigured()) {
    // No API key set yet. Return the original so the UI stays sensible.
    return NextResponse.json(
      { translated: text, cached: false, fallback: true, reason: "no_provider" },
      { status: 200 },
    );
  }

  const result = await aiTranslate({
    text,
    targetLang: target,
    sourceLang: source === "auto" ? undefined : source,
  });
  if (!result) {
    return NextResponse.json(
      { translated: text, cached: false, fallback: true, reason: "provider_error" },
      { status: 200 },
    );
  }

  /* Store for next time */
  void supabaseServer.from("translation_cache").insert({
    tenant_id: auth.tenant_id,
    source_hash: hash,
    source_lang: source,
    target_lang: target,
    source_text: text.slice(0, 500), // truncated for debugging only
    translated_text: result.translated,
    provider: result.provider,
  });

  return NextResponse.json(
    { translated: result.translated, cached: false, provider: result.provider },
    { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" } },
  );
}
