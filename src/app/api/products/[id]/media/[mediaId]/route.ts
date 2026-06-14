import "server-only";
import { humanizeError } from "@/lib/ui/humanize-error";

/* ---------------------------------------------------------------------------
   /api/products/[id]/media/[mediaId] — P0-A media-record writes.
   PATCH  — update one product_media row (alt text, order, role, type).
   DELETE — remove one product_media row (storage object removal stays on
            the /api/storage proxy; this only deletes the DB record).
   Product Data / SA only. Row must belong to the product in the path.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function gate(params: Promise<{ id: string; mediaId: string }>) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return { deny: auth };
  const deny = await requireModuleAccess(auth, "Product Data");
  if (deny) return { deny };
  const { id, mediaId } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(mediaId)) {
    return { deny: NextResponse.json({ error: "Invalid id" }, { status: 400 }) };
  }
  return { id, mediaId };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; mediaId: string }> },
) {
  const g = await gate(params);
  if ("deny" in g) return g.deny;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  delete body.id;
  delete body.product_id;
  const { error } = await supabaseServer
    .from("product_media")
    .update(body)
    .eq("id", g.mediaId)
    .eq("product_id", g.id);
  if (error) {
    console.error("[api/products media PATCH]", error.message);
    return NextResponse.json({ error: humanizeError(error) }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; mediaId: string }> },
) {
  const g = await gate(params);
  if ("deny" in g) return g.deny;
  const { error } = await supabaseServer
    .from("product_media")
    .delete()
    .eq("id", g.mediaId)
    .eq("product_id", g.id);
  if (error) {
    console.error("[api/products media DELETE]", error.message);
    return NextResponse.json({ error: humanizeError(error) }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
