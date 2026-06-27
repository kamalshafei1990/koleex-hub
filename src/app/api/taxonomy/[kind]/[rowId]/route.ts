import "server-only";

/* ---------------------------------------------------------------------------
   /api/taxonomy/[kind]/[rowId] — P0-A taxonomy writes.
   PATCH / DELETE one row. kind whitelist as on the collection route.
   Product Data / SA only.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { requireProductDataAction } from "@/lib/server/product-access";

const TAXONOMY_KINDS = ["divisions", "categories", "subcategories"] as const;
type Kind = (typeof TAXONOMY_KINDS)[number];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function gate(params: Promise<{ kind: string; rowId: string }>, action: "edit" | "delete") {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return { deny: auth };
  const denied = await requireProductDataAction(auth, action);
  if (denied) return { deny: denied };
  const { kind: rawKind, rowId } = await params;
  if (!(TAXONOMY_KINDS as readonly string[]).includes(rawKind)) {
    return { deny: NextResponse.json({ error: "Unknown taxonomy kind" }, { status: 404 }) };
  }
  if (!UUID_RE.test(rowId)) {
    return { deny: NextResponse.json({ error: "Invalid id" }, { status: 400 }) };
  }
  return { kind: rawKind as Kind, rowId };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ kind: string; rowId: string }> },
) {
  const g = await gate(params, "edit");
  if ("deny" in g) return g.deny;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  delete body.id;
  const { error } = await supabaseServer.from(g.kind).update(body).eq("id", g.rowId);
  if (error) {
    console.error(`[api/taxonomy ${g.kind} PATCH]`, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ kind: string; rowId: string }> },
) {
  const g = await gate(params, "delete");
  if ("deny" in g) return g.deny;
  const { error } = await supabaseServer.from(g.kind).delete().eq("id", g.rowId);
  if (error) {
    console.error(`[api/taxonomy ${g.kind} DELETE]`, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
