import "server-only";

/* ---------------------------------------------------------------------------
   /api/work-reports/[id]/attachments/[attId] — one photo or file on a DRAFT
   (Phase 2C).
   PATCH   { caption }  — the line under a photo.
   DELETE  takes it off the draft; the stored object goes only if no other
           version still shows it (removeUnreferenced).
   The author of a draft only; anyone else gets the report's usual 404.
   --------------------------------------------------------------------------- */

import { NextResponse, after } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { isUuid, loadForViewer, requireReportsUser } from "@/lib/server/reports/core";
import { ATTACHMENT_COLS, removeUnreferenced, toClientAttachment, type AttachmentRow } from "@/lib/server/reports/attachments";
import { REPORT_ATTACHMENT_LIMITS } from "@/lib/reports/attachments";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; attId: string }> };
const notFound = () => NextResponse.json({ error: "not_found" }, { status: 404 });

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = requireReportsUser(auth);
  if (deny) return deny;
  const { id, attId } = await params;
  if (!isUuid(attId)) return notFound();
  const loaded = await loadForViewer(id, auth);
  if (!loaded || loaded.access !== "author") return notFound();
  if (loaded.row.status !== "draft") return NextResponse.json({ error: "not_draft" }, { status: 409 });
  const body = (await req.json().catch(() => null)) as { caption?: unknown } | null;
  if (typeof body?.caption !== "string") return NextResponse.json({ error: "bad_body" }, { status: 400 });
  const { data, error } = await supabaseServer.from("work_report_attachments")
    .update({ caption: body.caption.trim().slice(0, REPORT_ATTACHMENT_LIMITS.caption) })
    .eq("id", attId).eq("report_id", loaded.row.id).select(ATTACHMENT_COLS).maybeSingle();
  if (error) return NextResponse.json({ error: "Could not save the caption." }, { status: 500 });
  if (!data) return notFound();
  return NextResponse.json({ attachment: toClientAttachment(data as AttachmentRow) });
}

export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = requireReportsUser(auth);
  if (deny) return deny;
  const { id, attId } = await params;
  if (!isUuid(attId)) return notFound();
  const loaded = await loadForViewer(id, auth);
  if (!loaded || loaded.access !== "author") return notFound();
  if (loaded.row.status !== "draft") return NextResponse.json({ error: "not_draft" }, { status: 409 });
  const { data, error } = await supabaseServer.from("work_report_attachments")
    .delete().eq("id", attId).eq("report_id", loaded.row.id).select("storage_path, thumb_path").maybeSingle();
  if (error) return NextResponse.json({ error: "Could not remove the file." }, { status: 500 });
  if (!data) return notFound();
  const gone = data as { storage_path: string; thumb_path: string | null };
  /* The row is gone now; the object follows unless another version shows it. */
  after(() => removeUnreferenced([gone.storage_path, gone.thumb_path]));
  return NextResponse.json({ ok: true });
}
