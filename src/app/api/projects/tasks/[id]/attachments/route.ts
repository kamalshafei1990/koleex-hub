import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { assertTaskAccess } from "@/lib/server/project-access";
import { ATTACHMENT_BUCKET as BUCKET, removeTaskAttachmentFiles } from "@/lib/server/project-files";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";

type RouteCtx = { params: Promise<{ id: string }> };

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

export async function GET(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Projects");
  if (deny) return deny;
  const { id } = await params;
  const gate = await assertTaskAccess(auth, id);
  if (gate instanceof NextResponse) return gate;

  const { data, error } = await supabaseServer
    .from("project_task_attachments")
    .select("*")
    .eq("task_id", id)
    .eq("tenant_id", auth.tenant_id)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[api/projects/tasks/:id/attachments GET]", error.message);
    return NextResponse.json({ error: "Failed to load files" }, { status: 500 });
  }

  // Signed URLs for the private bucket (1 hour) — one batch call, not N.
  const rows = data ?? [];
  const urls = new Map<string, string | null>();
  if (rows.length > 0) {
    const { data: signed } = await supabaseServer.storage
      .from(BUCKET)
      .createSignedUrls(rows.map((r) => r.file_path as string), 3600);
    for (const s of signed ?? []) if (s.path) urls.set(s.path, s.signedUrl ?? null);
  }
  return NextResponse.json({
    attachments: rows.map((r) => ({ ...r, url: urls.get(r.file_path as string) ?? null })),
  });
}

export async function POST(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Projects", "edit");
  if (deny) return deny;
  const { id } = await params;
  const gate = await assertTaskAccess(auth, id);
  if (gate instanceof NextResponse) return gate;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large (max 25 MB)" }, { status: 413 });

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
  const path = `${auth.tenant_id}/${id}/${crypto.randomUUID()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabaseServer.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type || "application/octet-stream", upsert: false });
  if (upErr) {
    console.error("[api/projects/tasks/:id/attachments POST] upload:", upErr.message);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  const { data, error } = await supabaseServer
    .from("project_task_attachments")
    .insert({
      tenant_id: auth.tenant_id,
      task_id: id,
      file_name: file.name.slice(0, 200),
      file_path: path,
      file_size: file.size,
      mime_type: file.type || null,
      uploaded_by: auth.account_id,
    })
    .select("*")
    .single();
  if (error) {
    /* The object is already in the bucket; without its row nothing can
       ever reference (or delete) it — remove it now. */
    console.error("[api/projects/tasks/:id/attachments POST] insert:", error.message);
    await removeTaskAttachmentFiles([path]);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  const { data: signed } = await supabaseServer.storage.from(BUCKET).createSignedUrl(path, 3600);
  return NextResponse.json({ attachment: { ...data, url: signed?.signedUrl ?? null } });
}
