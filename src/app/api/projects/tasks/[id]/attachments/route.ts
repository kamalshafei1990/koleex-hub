import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";

type RouteCtx = { params: Promise<{ id: string }> };

const BUCKET = "project-attachments";
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

export async function GET(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Projects");
  if (deny) return deny;
  const { id } = await params;

  const { data, error } = await supabaseServer
    .from("project_task_attachments")
    .select("*")
    .eq("task_id", id)
    .eq("tenant_id", auth.tenant_id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Signed URLs for the private bucket (1 hour).
  const rows = data ?? [];
  const withUrls = await Promise.all(
    rows.map(async (r) => {
      const { data: signed } = await supabaseServer.storage
        .from(BUCKET)
        .createSignedUrl(r.file_path as string, 3600);
      return { ...r, url: signed?.signedUrl ?? null };
    }),
  );
  return NextResponse.json({ attachments: withUrls });
}

export async function POST(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Projects", "edit");
  if (deny) return deny;
  const { id } = await params;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large (max 25 MB)" }, { status: 413 });

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
  const path = `${auth.tenant_id}/${id}/${crypto.randomUUID()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabaseServer.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type || "application/octet-stream", upsert: false });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

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
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: signed } = await supabaseServer.storage.from(BUCKET).createSignedUrl(path, 3600);
  return NextResponse.json({ attachment: { ...data, url: signed?.signedUrl ?? null } });
}
