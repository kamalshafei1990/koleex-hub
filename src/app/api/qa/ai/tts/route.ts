import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/qa/ai/tts — server-side neural Text-to-Speech (admin).

   Returns ONE consistent voice for every user (the audio is generated on the
   server, not by each person's browser), so everyone hears the same thing.

   Provider: Azure Cognitive Services Speech (neural voices). Activates only
   when AZURE_SPEECH_KEY + AZURE_SPEECH_REGION are set; otherwise returns 503
   and the client falls back to the browser voice. Free tier (500K chars/mo)
   covers this usage comfortably.

   Body: { text: string, lang: "en" | "ar" | "zh" }
   Returns: audio/mpeg (mp3) bytes.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";

export const maxDuration = 30;

type Lang = "en" | "ar" | "zh";

// One fixed neural voice per language → identical audio for all users.
// Overridable via env without a code change.
const VOICE: Record<Lang, string> = {
  en: process.env.AZURE_TTS_VOICE_EN || "en-US-AriaNeural",
  ar: process.env.AZURE_TTS_VOICE_AR || "ar-EG-SalmaNeural",
  zh: process.env.AZURE_TTS_VOICE_ZH || "zh-CN-XiaoxiaoNeural",
};
const LOCALE: Record<Lang, string> = { en: "en-US", ar: "ar-EG", zh: "zh-CN" };

function xmlEscape(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] as string));
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) return NextResponse.json({ error: "Not authorised." }, { status: 403 });

  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) {
    // Not configured → tell the client to use its local browser voice.
    return NextResponse.json({ error: "Server voice not configured.", fallback: true }, { status: 503 });
  }

  const body = (await req.json().catch(() => null)) as { text?: string; lang?: string } | null;
  const lang = (["en", "ar", "zh"].includes(body?.lang ?? "") ? body!.lang : "en") as Lang;
  const raw = typeof body?.text === "string" ? body.text : "";
  // Strip markdown noise + cap length (Azure single-request limit + cost guard).
  const text = raw.replace(/[#*`>_~]/g, "").trim().slice(0, 5000);
  if (!text) return NextResponse.json({ error: "Nothing to speak." }, { status: 400 });

  const ssml =
    `<speak version='1.0' xml:lang='${LOCALE[lang]}'>` +
    `<voice xml:lang='${LOCALE[lang]}' name='${VOICE[lang]}'>${xmlEscape(text)}</voice>` +
    `</speak>`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  let res: Response;
  try {
    res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "User-Agent": "koleex-hub-qa",
      },
      body: ssml,
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof Error && e.name === "AbortError") return NextResponse.json({ error: "Voice timed out.", fallback: true }, { status: 504 });
    return NextResponse.json({ error: "Voice service unreachable.", fallback: true }, { status: 502 });
  }
  clearTimeout(timer);

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[qa.ai.tts]", res.status, detail.slice(0, 200));
    return NextResponse.json({ error: `Voice service ${res.status}.`, fallback: true }, { status: 502 });
  }

  const audio = await res.arrayBuffer();
  return new NextResponse(audio, {
    status: 200,
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, no-store" },
  });
}
