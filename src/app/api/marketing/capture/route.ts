import "server-only";

/* POST /api/marketing/capture — CEO Brand's quick capture, as a form:
     audio   the recording (optional when something is typed)
     seconds how long it is
     typed   a few words instead of, or with, the recording (optional)
     media   the pictures or videos already uploaded from the capture
             screen (JSON) — checked like the composer's.
   "create" on CEO Brand (view-as refused: a write). Makes the draft in the
   CEO's voice (marketing/capture) and, after the response, tells whoever
   writes for CEO Brand that it is ready. */

import { after, NextResponse } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { cleanInput, isError } from "@/lib/server/marketing/posts";
import { makeCapture } from "@/lib/server/marketing/capture";
import { notifyCaptureReady } from "@/lib/server/marketing/notify";
import { reply } from "@/lib/server/marketing/post-gate";
import { CAPTURE_AUDIO_BYTES_MAX, CAPTURE_SECONDS_MAX } from "@/lib/marketing/capture";
import { SPACE_MODULE } from "@/lib/marketing/spaces";

export const dynamic = "force-dynamic";
/* Reading the recording and writing the draft take Koleex AI a while. */
export const maxDuration = 90;

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const denied = await requireModuleAction(auth, SPACE_MODULE.ceo, "create");
  if (denied) return denied;
  try {
    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "Send the recording from the capture screen." }, { status: 400 });
    const file = form.get("audio");
    let audio: { bytes: Uint8Array; mime: string; seconds: number | null } | null = null;
    if (file instanceof File && file.size > 0) {
      if (file.size > CAPTURE_AUDIO_BYTES_MAX) return NextResponse.json({ error: "The recording is too long.", code: "audio" }, { status: 413 });
      const seconds = Number(form.get("seconds"));
      audio = {
        bytes: new Uint8Array(await file.arrayBuffer()),
        mime: file.type || "audio/webm",
        seconds: Number.isFinite(seconds) && seconds >= 0 ? Math.min(seconds, CAPTURE_SECONDS_MAX + 5) : null,
      };
    }
    const typedRaw = form.get("typed");
    const typed = typeof typedRaw === "string" ? typedRaw : null;
    let rawMedia: unknown = [];
    try {
      rawMedia = JSON.parse(String(form.get("media") ?? "[]"));
    } catch {
      return NextResponse.json({ error: "The pictures could not be read." }, { status: 400 });
    }
    const clean = cleanInput(auth.tenant_id, { body: "", media: rawMedia, targets: [], scheduled_at: null });
    if (isError(clean)) return reply(clean);
    const made = await makeCapture({ tenantId: auth.tenant_id, accountId: auth.account_id, audio, typed, media: clean.input.media });
    if (!isError(made)) after(() => notifyCaptureReady({ account_id: auth.account_id, tenant_id: auth.tenant_id }, made.id));
    return reply(made);
  } catch (e) {
    console.error("[api/marketing/capture]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not make the draft." }, { status: 500 });
  }
}
