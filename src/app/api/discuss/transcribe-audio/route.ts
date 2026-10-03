import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/discuss/transcribe-audio — a recording in, its words out.

   The push-to-talk "slide right → Convert to Text" flow (WeChat): the clip is
   NEVER stored and no message is created — the words come back and land in
   the composer's text field, where the sender can edit before sending.

   Body: the raw audio bytes with the recorder's Content-Type (audio/webm,
   audio/mp4…). 10MB cap, matching the speech provider's own limit. Every
   failure is a soft JSON error, never a throw — the bar just returns to idle.

   Auth: session + Discuss "create" (whoever may send a message may dictate
   one). Nothing here names the STT provider — that is ai/speech's contract.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { transcribe } from "@/lib/server/ai/speech";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const denied = await requireModuleAction(auth, "Discuss", "create");
  if (denied) return denied;

  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "Recording too large" }, { status: 413 });
  }
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await req.arrayBuffer());
  } catch {
    return NextResponse.json({ ok: false, error: "Could not read the recording" }, { status: 400 });
  }
  if (!bytes.length) {
    return NextResponse.json({ ok: false, error: "Empty recording" }, { status: 400 });
  }
  if (bytes.length > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "Recording too large" }, { status: 413 });
  }

  const mime = (req.headers.get("content-type") ?? "audio/webm").split(";")[0].trim();
  const out = await transcribe(bytes, mime);
  if (!out) {
    return NextResponse.json({ ok: false, error: "Couldn't convert this recording" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, data: { text: out.text, lang: out.lang } });
}
