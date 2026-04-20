import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/ai/transcribe
     multipart/form-data:
       file: the recorded audio blob (webm / ogg / mp4 / m4a / wav / mp3)
       lang: optional ISO code hint ("en" | "zh" | "ar" | …)
     response: { text: string } | { error: string }

   Phase 1 voice input for Chat mode. Uses Groq's Whisper endpoint —
   `whisper-large-v3-turbo` is fast (sub-1s on short clips), multilingual,
   and free on the current tier. Falls back to `whisper-large-v3` when
   the env override asks for it.

   The endpoint is auth-gated (same as /api/ai/chat) so anonymous
   traffic can't burn Whisper minutes on our account. Payload-size
   guard caps uploads at 4 MB — roughly 2 minutes of webm/opus at
   voice-quality bitrate, well beyond typical utterances.

   This route does NOT call the chat model. The caller (browser) takes
   the returned text, shows it in the input/bubble, and posts it to
   /api/ai/chat the same way typed text would flow.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";

const GROQ_WHISPER_URL =
  "https://api.groq.com/openai/v1/audio/transcriptions";
const GROQ_WHISPER_MODEL =
  process.env.GROQ_WHISPER_MODEL || "whisper-large-v3-turbo";

/* Hard ceiling on the upload. 4 MB is generous for a voice clip —
   60s of webm/opus ≈ 400 KB; 120s ≈ 800 KB. Anything past 4 MB is
   almost certainly someone pasting a music file or an attack. */
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const key = process.env.GROQ_API_KEY;
  if (!key) {
    return NextResponse.json(
      {
        error: "no_provider",
        message: "Voice transcription isn't configured (GROQ_API_KEY missing).",
      },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "bad_form_data" }, { status: 400 });
  }

  const file = form.get("file");
  const lang =
    typeof form.get("lang") === "string" ? String(form.get("lang")) : "";
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "file empty" }, { status: 400 });
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "file_too_large", message: "Clip is too long — keep it under 2 minutes." },
      { status: 413 },
    );
  }

  /* Rebuild the multipart body for Groq so we only forward the fields
     Whisper expects. Prevents callers from smuggling extra params. */
  const upstream = new FormData();
  upstream.set("model", GROQ_WHISPER_MODEL);
  upstream.set("response_format", "json");
  /* Whisper takes an ISO-639-1 language hint — improves accuracy on
     short clips. Only forwarded when the client sent one we trust. */
  if (lang && /^(en|zh|ar|fr|es|de|ja|ko|pt|tr)$/i.test(lang)) {
    upstream.set("language", lang.toLowerCase());
  }
  /* File name is a Whisper requirement; the blob itself doesn't carry
     one reliably across browsers. Use the blob's type to pick a safe
     extension — Groq rejects clips with missing/unknown extensions. */
  const ext = pickExtension(file.type);
  upstream.set("file", file, `clip.${ext}`);

  try {
    const t0 = Date.now();
    const res = await fetch(GROQ_WHISPER_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: upstream,
    });
    const tMs = Date.now() - t0;

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[ai.transcribe]", res.status, body.slice(0, 300));
      return NextResponse.json(
        {
          error: "transcribe_failed",
          message:
            res.status === 429
              ? "Voice service is busy — please try again in a moment."
              : "Couldn't transcribe that clip. Please try again.",
        },
        { status: 502 },
      );
    }

    const json = (await res.json().catch(() => null)) as
      | { text?: string }
      | null;
    const text = (json?.text ?? "").trim();
    if (!text) {
      return NextResponse.json(
        {
          error: "empty_transcript",
          message: "I couldn't hear anything. Please try again.",
        },
        { status: 200 },
      );
    }

    console.log(
      `[ai.transcribe] ok bytes=${file.size} chars=${text.length} ms=${tMs}`,
    );
    return NextResponse.json({ text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ai.transcribe] network", msg);
    return NextResponse.json(
      {
        error: "transcribe_network",
        message: "Voice service is unreachable — please try again.",
      },
      { status: 502 },
    );
  }
}

/** Pick a safe file extension for Groq based on the browser's MIME
 *  tag. Safari iOS often records as audio/mp4, Chrome/Firefox as
 *  audio/webm;codecs=opus. We map both plus a few common fallbacks. */
function pickExtension(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("webm")) return "webm";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("mp4") || m.includes("m4a")) return "m4a";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("wav")) return "wav";
  return "webm";
}
