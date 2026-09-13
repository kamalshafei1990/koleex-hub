import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/ai/voice/preview?voice=<key>&lane=rtc|ws&lang=en|zh|ar

   A few spoken words in one of the offered voices, as audio bytes, so the
   caller can hear a voice before choosing it (ai/voice/preview.ts for why
   and how). Behind the same gate as every voice route, under a budget, and
   the client names a voice KEY and a lane — the vendor id comes from the
   lane's own catalogue here, so a browser cannot audition a voice this
   deployment never offered. The bytes are cached by the browser for a week:
   the same five voices are auditioned again on the next call for nothing.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { authorizeVoice } from "@/lib/server/ai/voice/gate";
import { BUDGETS, consumeBudget, limitMode, subjectFor } from "@/lib/server/ai/security/rate-limit";
import { parseVoiceConfig, readVoiceEnv, readAltVoiceEnv, resolveVoice } from "@/lib/server/ai/voice/config";
import { parseGrokVoiceConfig, readGrokVoiceEnv } from "@/lib/server/ai/voice/grok";
import { planGrokTts, planMainlandTts, fetchPreviewAudio, type PreviewLane } from "@/lib/server/ai/voice/preview";
import { assertSafeUrl } from "@/lib/server/safe-url";
import type { Lang } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

const LANGS: readonly Lang[] = ["en", "zh", "ar"];

const refuse = (status: number) => new NextResponse(null, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(req: Request) {
  const gate = await authorizeVoice(req);
  if (gate instanceof NextResponse) return gate;

  if (limitMode() !== "off") {
    const hit = await consumeBudget(subjectFor.account(gate.accountId), BUDGETS.voicePreviewPerAccount());
    if (!hit.allowed) {
      console.warn(`[ai.voice.preview] ratelimit account count=${hit.count} max=${hit.max} mode=${limitMode()}`);
      if (limitMode() === "enforce") {
        return new NextResponse(null, { status: 429, headers: { "Retry-After": String(hit.retryAfterSec), "Cache-Control": "no-store" } });
      }
    }
  }

  const params = new URL(req.url).searchParams;
  const lane: PreviewLane = params.get("lane") === "ws" ? "ws" : "rtc";
  const langRaw = params.get("lang");
  const lang: Lang = (LANGS as readonly string[]).includes(langRaw ?? "") ? (langRaw as Lang) : "en";
  const key = params.get("voice");

  let plan = null;
  if (lane === "ws") {
    const grok = parseGrokVoiceConfig(readGrokVoiceEnv());
    if (!grok) return refuse(503);
    const voice = resolveVoice(grok.voices, key);
    if (!voice) return refuse(404);
    plan = planGrokTts({ ...readGrokVoiceEnv(), AI_VOICE_GROK_TTS_URL: process.env.AI_VOICE_GROK_TTS_URL }, voice.vendorId, lang);
  } else {
    const env = parseVoiceConfig(readVoiceEnv()) ? readVoiceEnv() : parseVoiceConfig(readAltVoiceEnv()) ? readAltVoiceEnv() : null;
    const cfg = env ? parseVoiceConfig(env) : null;
    if (!env || !cfg) return refuse(503);
    const voice = resolveVoice(cfg.voices, key);
    if (!voice) return refuse(404);
    plan = planMainlandTts({ ...env, AI_VOICE_TTS_URL: process.env.AI_VOICE_TTS_URL, AI_VOICE_TTS_MODEL: process.env.AI_VOICE_TTS_MODEL }, voice.vendorId, lang);
  }
  if (!plan) return refuse(503);

  const t0 = Date.now();
  const audio = await fetchPreviewAudio(plan, { assertSafeUrl });
  if (!audio) return refuse(502);
  console.log(`[ai.voice.preview] ok lane=${lane} voice=${key} lang=${lang} bytes=${audio.bytes.byteLength} ms=${Date.now() - t0}`);
  return new NextResponse(new Uint8Array(audio.bytes), {
    status: 200,
    headers: {
      "Content-Type": audio.type,
      "Content-Length": String(audio.bytes.byteLength),
      "Cache-Control": "private, max-age=604800",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
