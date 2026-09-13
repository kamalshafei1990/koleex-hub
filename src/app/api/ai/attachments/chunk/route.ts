import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { requireInternalUser } from "@/lib/server/ai/require-internal";
import { consumeBudget, limitMode, BUDGETS, subjectFor } from "@/lib/server/ai/security/rate-limit";
import { supabaseServer } from "@/lib/server/supabase-server";
import { partsFolder, PART_BYTES_MAX, MAX_PARTS_SERVER, UPLOAD_ID_RE } from "@/lib/server/ai/attachment-parts";

/* ---------------------------------------------------------------------------
   POST /api/ai/attachments/chunk — one piece of a big attachment, relayed
   through our server into transport storage.

   Test round, 2026-09-04: a 62.5 MB catalogue could not reach Koleex AI from
   mainland China because the "direct" road — browser → storage host with a
   signed URL — never touches our server, and that host does not reliably
   answer from there. This route is the other road: pieces small enough for
   a serverless request body, each written by the SERVER into the caller's
   own transport folder. /api/ai/attachments then puts the pieces together,
   reads the file, and removes them.

   THE FOLDER IS THE CALLER'S. The path is composed here from the signed-in
   account id and a client-chosen upload id that must be a UUID; the client
   never names a path, so one account cannot write into, or later read from,
   another's folder. Nothing here is stored for keeps: parts are transport,
   removed on assembly, and stale folders are swept on the next assembly.
   --------------------------------------------------------------------------- */

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  {
    const notInternal = requireInternalUser(auth);
    if (notInternal) return notInternal;
  }

  if (limitMode() !== "off") {
    const v = await consumeBudget(subjectFor.account(auth.account_id), BUDGETS.attachmentChunkPerAccount());
    if (!v.allowed) {
      console.warn(`[ai.ratelimit] ep=attachments.chunk count=${v.count} max=${v.max} mode=${limitMode()}`);
      if (limitMode() === "enforce") {
        return NextResponse.json(
          { error: "Too many uploads in a short time. Give it a moment and try again." },
          { status: 429, headers: { "Retry-After": String(v.retryAfterSec) } },
        );
      }
    }
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "The piece was too large for this route." }, { status: 413 });
  }
  const upload = String(form.get("upload") ?? "");
  const index = Number(form.get("index"));
  const total = Number(form.get("total"));
  const chunk = form.get("chunk");
  if (!UPLOAD_ID_RE.test(upload)) {
    return NextResponse.json({ error: "bad upload id" }, { status: 400 });
  }
  if (!Number.isInteger(total) || total < 1 || total > MAX_PARTS_SERVER || !Number.isInteger(index) || index < 0 || index >= total) {
    return NextResponse.json({ error: "bad part index" }, { status: 400 });
  }
  if (!(chunk instanceof Blob) || chunk.size > PART_BYTES_MAX) {
    return NextResponse.json({ error: "bad part" }, { status: 400 });
  }

  const path = `${partsFolder(auth.account_id, upload)}/${index}`;
  const bytes = new Uint8Array(await chunk.arrayBuffer());
  const { error } = await supabaseServer.storage
    .from("media")
    .upload(path, bytes, { contentType: "application/octet-stream", upsert: true });
  if (error) {
    /* Counts and positions only — never the bytes, never the file name. */
    console.error(`[ai.attachments.chunk] write failed index=${index}/${total} bytes=${bytes.byteLength}`, error.message);
    return NextResponse.json({ error: "Couldn't store this piece. Try again." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, index });
}
