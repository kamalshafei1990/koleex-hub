import "server-only";

import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { aiTranslate, aiProviderConfigured, isTranslatableLang } from "@/lib/server/ai-provider";

/* POST /api/ai/translate
     Single:  { text: string, target_lang, source_lang? }
              → { translated: string, cached: boolean }
     Batch:   { texts: string[], target_lang, source_lang? }
              → { translations: string[] }   (aligned with `texts`)

   Batch mode is what makes Discuss translation feel instant: the client
   pre-warms every visible message in ONE request, so the per-message
   "Translate" click (and Auto-translate) resolve from cache with no wait.

   Tenant-scoped Postgres cache: the same text asked twice across the team is
   translated once, then served from cache forever. */

const MAX_LEN = 8_000; // don't spend tokens on huge blobs
const MAX_BATCH = 40; // cap fan-out per request

/** Translate one string with cache-check → AI → cache-store. Returns the
 *  original text on any failure so the conversation never breaks. */
async function translateOne(
  text: string,
  target: string,
  source: string,
  tenantId: string,
): Promise<{ translated: string; cached: boolean }> {
  const trimmed = text.trim();
  if (!trimmed) return { translated: text, cached: false };
  if (text.length > MAX_LEN) return { translated: text, cached: false };

  const hash = crypto.createHash("sha256").update(text).digest("hex");

  const { data: hit } = await supabaseServer
    .from("translation_cache")
    .select("translated_text")
    .eq("tenant_id", tenantId)
    .eq("source_hash", hash)
    .eq("source_lang", source)
    .eq("target_lang", target)
    .maybeSingle();

  if (hit) {
    // Best-effort usage bump — never block the response on it.
    supabaseServer
      .rpc("increment_translation_hit", {
        p_tenant_id: tenantId,
        p_hash: hash,
        p_source: source,
        p_target: target,
      })
      .then(undefined, () => {});
    return { translated: hit.translated_text, cached: true };
  }

  if (!aiProviderConfigured()) return { translated: text, cached: false };

  const result = await aiTranslate({
    text,
    targetLang: target,
    sourceLang: source === "auto" ? undefined : source,
  });
  if (!result) return { translated: text, cached: false };

  /* AWAIT the write. Fire-and-forget (`void`) meant Next.js tore the handler
     down after the Response before the insert flushed, so the cache stayed
     empty and every translation re-hit the provider (~5s each). Awaiting the
     ~20ms insert makes repeat/common phrases resolve from cache instantly. */
  const { error: insErr } = await supabaseServer.from("translation_cache").upsert(
    {
      tenant_id: tenantId,
      source_hash: hash,
      source_lang: source,
      target_lang: target,
      source_text: text.slice(0, 500),
      translated_text: result.translated,
      provider: result.provider,
    },
    { onConflict: "tenant_id,source_hash,source_lang,target_lang", ignoreDuplicates: true },
  );
  if (insErr && process.env.NODE_ENV !== "production") {
    console.warn("[ai.translate] cache insert failed:", insErr.message);
  }

  return { translated: result.translated, cached: false };
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json()) as {
    text?: string;
    texts?: string[];
    target_lang?: string;
    source_lang?: string;
  };

  const target = body.target_lang;
  if (!target || !isTranslatableLang(target)) {
    return NextResponse.json({ error: "unsupported target_lang" }, { status: 400 });
  }
  const source = body.source_lang ?? "auto";

  /* ── Batch: warm the cache for many messages in one request. Misses are
     translated concurrently so a channel of fresh messages resolves in ~one
     provider round-trip of wall-clock, not N sequential ones. ── */
  if (Array.isArray(body.texts)) {
    const texts = body.texts.slice(0, MAX_BATCH);
    const translations = await Promise.all(
      texts.map((t) =>
        translateOne(String(t ?? ""), target, source, auth.tenant_id)
          .then((r) => r.translated)
          .catch(() => String(t ?? "")),
      ),
    );
    return NextResponse.json(
      { translations },
      { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" } },
    );
  }

  /* ── Single ── */
  const text = (body.text ?? "").trim();
  if (!text) return NextResponse.json({ translated: "", cached: false });
  if (text.length > MAX_LEN) {
    return NextResponse.json({ error: "text_too_long", fallback: text }, { status: 413 });
  }

  const out = await translateOne(text, target, source, auth.tenant_id);
  return NextResponse.json(
    { translated: out.translated, cached: out.cached },
    { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" } },
  );
}
