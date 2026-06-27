import "server-only";
import { humanizeError } from "@/lib/ui/humanize-error";

/* /api/product-translations/[id] — P0-B. DELETE one row. PD/SA only. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { hasProductDataAccess, requireProductDataAction } from "@/lib/server/product-access";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const denied = await requireProductDataAction(auth, "delete");
  if (denied) return denied;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const { error } = await supabaseServer.from("product_translations").delete().eq("id", id);
  if (error) return NextResponse.json({ error: humanizeError(error) }, { status: 500 });
  return NextResponse.json({ ok: true });
}
