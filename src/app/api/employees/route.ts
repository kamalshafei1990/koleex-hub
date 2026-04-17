import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

/* POST /api/employees — create a koleex_employees row (tenant_id enforced). */
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json()) as Record<string, unknown>;
  const row = { ...body, tenant_id: auth.tenant_id };

  const { data, error } = await supabaseServer
    .from("koleex_employees")
    .insert(row)
    .select("*")
    .single();
  if (error) {
    console.error("[api/employees POST]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ employee: data });
}
