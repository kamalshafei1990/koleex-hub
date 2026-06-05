import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import type { QaAssignee } from "@/lib/qa/types";

/* GET /api/qa/assignees — pickable developers/testers for assignment.
   Active accounts in the caller's tenant. Admin-gated (matches the console). */
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) return NextResponse.json({ error: "Not authorised." }, { status: 403 });

  const { data, error } = await supabaseServer
    .from("accounts")
    .select("id, username, login_email, avatar_url, status")
    .eq("tenant_id", auth.tenant_id)
    .order("username", { ascending: true });
  if (error) {
    console.error("[api/qa/assignees]", error.message);
    return NextResponse.json({ error: "Couldn't load assignees." }, { status: 500 });
  }

  const assignees: QaAssignee[] = (data ?? [])
    .filter((a) => (a as { status: string | null }).status !== "disabled")
    .map((a) => {
      const r = a as { id: string; username: string | null; login_email: string | null; avatar_url: string | null };
      return {
        id: r.id,
        name: r.username || r.login_email || "—",
        email: r.login_email,
        avatar_url: r.avatar_url,
      };
    });

  return NextResponse.json({ assignees }, { headers: { "Cache-Control": "private, max-age=30" } });
}
