import "server-only";

/* /api/product-media/[id] — P0-B. PATCH/DELETE one media row. PD/SA only. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { requireProductDataAction } from "@/lib/server/product-access";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function gate(id: string, action: "edit" | "delete") {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const denied = await requireProductDataAction(auth, action);
  if (denied) return denied;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  return null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deny = await gate(id, "edit");
  if (deny) return deny;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  delete body.id;
  const { error } = await supabaseServer.from("product_media").update(body).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deny = await gate(id, "delete");
  if (deny) return deny;
  const { error } = await supabaseServer.from("product_media").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
