import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/qa/ai/tts — server-side neural Text-to-Speech (admin).

   Returns ONE consistent voice for every user (audio is generated on the
   server, not by each browser), so the whole team hears the same thing.

   Provider: ElevenLabs (free plan — no credit card, email signup only).
   Activates when ELEVENLABS_API_KEY is set; otherwise returns 503 and the
   client falls back to the per-browser voice. One fixed multilingual voice
   handles English, Arabic, and Chinese, so the voice is identical regardless
   of the chosen language.

   Body: { text: string, lang?: "en" | "ar" | "zh" }
   Returns: audio/mpeg (mp3) bytes.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";

export const maxDuration = 30;

// One fixed voice for all users + all languages (eleven_multilingual_v2 speaks
// en/ar/zh with the same voice). Default = "Sarah" (EXAVITQu4vr4xnSDxMaL), a
// current ElevenLabs DEFAULT voice the free API tier is allowed to use —
// verified working on the live key. NOTE: do NOT use legacy/library voices
// like Rachel (21m00Tcm4TlvDq8ikWAM) or Aria (9BWtsMINqrJLrRacOk9x): the free
// tier returns 402 "Free users cannot use library voices via the API".
// Male alternative that also works free: George = JBFqnCBsd6RMkjVDRZzb.
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";
const MODEL = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) return NextResponse.json({ error: "Not authorised." }, { status: 403 });

  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    // Not configured → client uses its local browser voice.
    return NextResponse.json({ error: "Server voice not configured.", fallback: true }, { status: 503 });
  }

  const body = (await req.json().catch(() => null)) as { text?: string } | null;
  const raw = typeof body?.text === "string" ? body.text : "";
  // Strip markdown noise + cap length (conserve the free monthly quota).
  const text = raw.replace(/[#*`>_~]/g, "").trim().slice(0, 3000);
  if (!text) return NextResponse.json({ error: "Nothing to speak." }, { status: 400 });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  let res: Response;
  try {
    res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
      method: "POST",
      headers: {
        "xi-api-key": key,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: MODEL,
        voice_settings: { stability: 0.45, similarity_boost: 0.75 },
      }),
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
    // 401 = bad key, 429 = monthly quota used up. Client falls back either way.
    return NextResponse.json({ error: `Voice service ${res.status}.`, fallback: true }, { status: 502 });
  }

  const audio = await res.arrayBuffer();
  return new NextResponse(audio, {
    status: 200,
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, no-store" },
  });
}
