import "server-only";

import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import {
  aiTranslate,
  aiProviderConfigured,
  isTranslatableLang,
  TRANSLATE_LANG_NAMES,
} from "@/lib/server/ai-provider";
import { deepseekChatStream } from "@/lib/server/ai/providers/deepseek";
import { buildGlossaryHint } from "@/lib/server/translator-glossary";

/* POST /api/translator — the Translator app's translation endpoint.

   Two response modes, same request body ({ text, target_lang, source_lang? }):

     · STREAMING (Accept: text/event-stream) — the default the app uses. The
       translation paints word-by-word like Google Translate, so the user sees
       progress in ~200ms instead of staring at a spinner for the full
       round-trip. Events: {type:"delta",text} … {type:"end",translated,cached}.
     · JSON — same contract as /api/ai/translate, used as the fallback when
       streaming isn't available.

   Reuses the SAME tenant-scoped `translation_cache` as the rest of the Hub
   (Discuss, task titles, icon names), so a phrase translated anywhere is
   instant here and vice-versa. Cache hits skip the provider entirely and are
   emitted as a single delta — those feel instantaneous.

   NOTE: /api/ai/translate stays the low-level primitive for background
   auto-translation (batch + single, no streaming). This route is the
   interactive one. They deliberately share the cache table. */

const MAX_LEN = 5_000; // interactive paste ceiling; longer text → JSON path

/** Cache lookup shared by both modes. Returns null on miss. */
async function readCache(
  hash: string,
  source: string,
  target: string,
  tenantId: string,
): Promise<string | null> {
  const { data } = await supabaseServer
    .from("translation_cache")
    .select("translated_text")
    .eq("tenant_id", tenantId)
    .eq("source_hash", hash)
    .eq("source_lang", source)
    .eq("target_lang", target)
    .maybeSingle();
  return data?.translated_text ?? null;
}

/** Store a fresh translation. Awaited — a fire-and-forget insert gets torn
    down with the serverless handler and the cache never fills. */
async function writeCache(
  hash: string,
  source: string,
  target: string,
  tenantId: string,
  text: string,
  translated: string,
  provider: string,
): Promise<void> {
  await supabaseServer.from("translation_cache").upsert(
    {
      tenant_id: tenantId,
      source_hash: hash,
      source_lang: source,
      target_lang: target,
      source_text: text.slice(0, 500),
      translated_text: translated,
      provider,
    },
    { onConflict: "tenant_id,source_hash,source_lang,target_lang", ignoreDuplicates: true },
  );
}

/** The translation instruction. Kept deliberately strict: the model must
    return ONLY the translation — no preamble, no quotes, no explanation —
    because the output is piped straight into the result pane. */
function buildMessages(text: string, source: string, target: string) {
  const targetName = TRANSLATE_LANG_NAMES[target] ?? target;
  const sourceName = source === "auto" ? null : (TRANSLATE_LANG_NAMES[source] ?? source);
  const system = [
    `You are a professional translator. Translate the user's text into ${targetName}.`,
    sourceName ? `The source language is ${sourceName}.` : "Detect the source language automatically.",
    "Rules:",
    "- Output ONLY the translation. No preamble, no notes, no quotes around it, no romanisation.",
    "- Preserve the original line breaks, list markers and punctuation style.",
    "- Keep names, brands, product codes, numbers and units exactly as written.",
    "- Match the register of the source (formal stays formal, casual stays casual).",
    `- If the ENTIRE text is already in ${targetName}, return it unchanged.`,
    /* OCR output and supplier docs routinely mix languages. Without this the
       model saw "mostly Chinese" and returned everything untouched, leaving
       the English lines untranslated. */
    `- If the text MIXES languages, translate every part that is not in ${targetName} and keep the parts already in ${targetName} as they are.`,
    /* Company vocabulary: pins KOLEEX model codes and garment-machinery terms
       that a general model otherwise mangles. Empty when the text contains
       neither, so ordinary sentences pay nothing for it. */
    buildGlossaryHint(text, target),
  ].join("\n");
  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: text },
  ];
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json()) as {
    text?: string;
    target_lang?: string;
    source_lang?: string;
  };

  const target = body.target_lang;
  if (!target || !isTranslatableLang(target)) {
    return NextResponse.json({ error: "unsupported target_lang" }, { status: 400 });
  }
  const source =
    body.source_lang && (body.source_lang === "auto" || isTranslatableLang(body.source_lang))
      ? body.source_lang
      : "auto";

  const text = String(body.text ?? "");
  const trimmed = text.trim();
  if (!trimmed) return NextResponse.json({ translated: "", cached: false });
  if (text.length > MAX_LEN) {
    return NextResponse.json({ error: "text too long", max: MAX_LEN }, { status: 413 });
  }

  const hash = crypto.createHash("sha256").update(text).digest("hex");
  const wantsStream = req.headers.get("accept") === "text/event-stream";

  /* ── Streaming path ── */
  if (wantsStream) {
    const encoder = new TextEncoder();
    const send = (obj: unknown) => encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          // Cache first — a hit paints instantly with zero provider latency.
          const cached = await readCache(hash, source, target, auth.tenant_id);
          if (cached) {
            controller.enqueue(send({ type: "delta", text: cached }));
            controller.enqueue(send({ type: "end", translated: cached, cached: true }));
            controller.close();
            return;
          }

          if (!aiProviderConfigured()) {
            controller.enqueue(send({ type: "error", error: "translation_unavailable" }));
            controller.close();
            return;
          }

          let acc = "";
          let failed: string | null = null;
          for await (const chunk of deepseekChatStream(buildMessages(text, source, target), {
            temperature: 0.2,
            maxTokens: 2048,
          })) {
            if (chunk.type === "delta" && chunk.text) {
              acc += chunk.text;
              controller.enqueue(send({ type: "delta", text: chunk.text }));
            } else if (chunk.type === "error") {
              failed = chunk.error ?? "stream_error";
              break;
            }
          }

          /* Streaming provider unavailable (flag off / key missing / network):
             fall back to the non-streaming provider so the user still gets a
             translation rather than an error. */
          if (!acc.trim()) {
            const fallback = await aiTranslate({
              text,
              targetLang: target,
              sourceLang: source === "auto" ? undefined : source,
            });
            if (!fallback) {
              controller.enqueue(send({ type: "error", error: failed ?? "translation_failed" }));
              controller.close();
              return;
            }
            acc = fallback.translated;
            controller.enqueue(send({ type: "delta", text: acc }));
            /* "end" goes out BEFORE the cache write — the user shouldn't wait
               on our bookkeeping. The write is still awaited (not fire-and-
               forget) so the serverless handler can't tear it down. */
            controller.enqueue(send({ type: "end", translated: acc, cached: false }));
            await writeCache(hash, source, target, auth.tenant_id, text, acc, fallback.provider);
            controller.close();
            return;
          }

          const finalText = acc.trim();
          controller.enqueue(send({ type: "end", translated: finalText, cached: false }));
          await writeCache(hash, source, target, auth.tenant_id, text, finalText, "deepseek:stream");
          controller.close();
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          controller.enqueue(send({ type: "error", error: msg }));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }

  /* ── JSON path ── */
  const cached = await readCache(hash, source, target, auth.tenant_id);
  if (cached) return NextResponse.json({ translated: cached, cached: true });

  if (!aiProviderConfigured()) {
    return NextResponse.json({ error: "translation_unavailable" }, { status: 503 });
  }

  const result = await aiTranslate({
    text,
    targetLang: target,
    sourceLang: source === "auto" ? undefined : source,
  });
  if (!result) return NextResponse.json({ error: "translation_failed" }, { status: 502 });

  await writeCache(hash, source, target, auth.tenant_id, text, result.translated, result.provider);
  return NextResponse.json({ translated: result.translated, cached: false });
}
