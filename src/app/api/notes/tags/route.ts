import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* GET /api/notes/tags — the caller's tags with live-note counts, for the
   sidebar tag filter. Own live notes only (the filter lists the caller's
   notes). Sorted by count, then name. Tags compare case-insensitively; the
   most recent spelling is shown. */

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Notes");
  if (deny) return deny;

  const { data, error } = await supabaseServer
    .from("notes")
    .select("tags")
    .eq("account_id", auth.account_id)
    .is("deleted_at", null)
    .not("tags", "eq", "{}")
    .order("updated_at", { ascending: false })
    .limit(5000);
  if (error) {
    console.error("[api/notes/tags]", error.message);
    return NextResponse.json({ error: "Failed to load tags" }, { status: 500 });
  }
  const byKey = new Map<string, { tag: string; count: number }>();
  for (const row of (data ?? []) as Array<{ tags: string[] | null }>) {
    for (const t of row.tags ?? []) {
      const tag = String(t).trim();
      if (!tag) continue;
      const k = tag.toLowerCase();
      const cur = byKey.get(k);
      if (cur) cur.count += 1;
      else byKey.set(k, { tag, count: 1 });
    }
  }
  const tags = Array.from(byKey.values()).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  return NextResponse.json({ tags });
}
