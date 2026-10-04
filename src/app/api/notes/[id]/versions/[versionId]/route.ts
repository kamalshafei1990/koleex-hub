import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { canRead, getNoteAccess, isUuid } from "@/lib/notes-server";

/* GET /api/notes/[id]/versions/[versionId] — one version with its body, for
   preview / restore. Access = read access to the note it belongs to. */

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  const { id, versionId } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Notes");
  if (deny) return deny;
  if (!isUuid(versionId)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const access = await getNoteAccess(id, auth.account_id);
  if (!access.note || !canRead(access.role)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { data, error } = await supabaseServer
    .from("note_versions")
    .select("id, note_id, title, body_json, account_id, created_at")
    .eq("id", versionId)
    .eq("note_id", id)
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ version: data }, { headers: { "Cache-Control": "private, no-store" } });
}
