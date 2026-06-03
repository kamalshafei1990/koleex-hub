import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/catalogs/[id]/track — increment a usage counter.
   Body: { metric: "view" | "download" }

   Any authenticated tenant user can record usage (it's a read-side signal),
   so this requires auth only — not the Suppliers write module. Always
   tenant-scoped so foreign rows can't be touched.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => ({}))) as { metric?: string };
  const field = body.metric === "download" ? "download_count" : body.metric === "view" ? "view_count" : null;
  if (!field) {
    return NextResponse.json({ error: "Invalid metric" }, { status: 400 });
  }

  // Read current value (tenant-scoped) then write +1. View/download counters
  // tolerate the tiny race of two concurrent reads — exactness isn't required.
  const { data: row } = await supabaseServer
    .from("catalogs")
    .select("view_count, download_count")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const current = (row as Record<string, number | null>)[field] ?? 0;
  const { error } = await supabaseServer
    .from("catalogs")
    .update({ [field]: current + 1 })
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id);

  if (error) {
    console.error("[api/catalogs track]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, [field]: current + 1 });
}
