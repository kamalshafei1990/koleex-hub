import "server-only";

/* GET /api/tenants — the active tenants a Super Admin may switch between.

   SA-only, deliberately: the list of tenants is the shape of the business, and
   nobody else has a reason to see it. It backs the header's tenant picker.

   Replaces the last Supabase import in the shell. The picker already loaded
   this lazily, on first open, so the client only entered the bundle for the
   account that opens the Hub most — a Super Admin. Now nothing in the header
   imports it at all. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) {
    return NextResponse.json({ error: "Super admin required." }, { status: 403 });
  }

  const { data, error } = await supabaseServer
    .from("tenants")
    .select("id, slug, name, is_host")
    .eq("active", true)
    .order("is_host", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    console.error("[api/tenants]", error.message);
    return NextResponse.json({ error: "Failed to load tenants" }, { status: 500 });
  }
  return NextResponse.json({ tenants: data ?? [] });
}
