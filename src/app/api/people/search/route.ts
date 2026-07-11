import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

/* GET /api/people/search?q=<term>
   Identity consolidation P4 — read-only people lookup used to link a contact
   to a shared person record. Tenant-scoped, self-service safe (any signed-in
   user can search their tenant's people to pick one to link). Returns a small
   projection only — never sensitive HR data. */
export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const raw = (new URL(req.url).searchParams.get("q") ?? "").trim();
  /* Strip characters that have meaning in a PostgREST .or() filter (commas,
     parens, %, backslash, quotes) so the term can't break out of the pattern. */
  const q = raw.replace(/[%,()\\'"*]/g, " ").replace(/\s+/g, " ").trim();
  if (q.length < 2) return NextResponse.json({ people: [] });

  let query = supabaseServer
    .from("people")
    .select("id, full_name, email, phone, job_title")
    .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
    .order("full_name", { ascending: true })
    .limit(20);
  if (auth.tenant_id) query = query.eq("tenant_id", auth.tenant_id);

  const { data, error } = await query;
  if (error) {
    console.error("[api/people/search]", error.message);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
  return NextResponse.json({ people: data ?? [] });
}
