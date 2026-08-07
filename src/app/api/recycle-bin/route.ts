import "server-only";

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { restoreBinEntry } from "@/lib/server/recycle-bin";
import { logAudit } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

/* Recycle bin — recoverable offboarding.
   GET  → list entries (newest first).
   POST → { id } restore one entry.
   Gated by Accounts·delete: whoever may delete accounts may also see and
   undo those deletions. */

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Accounts", "delete");
  if (deny) return deny;

  let q = supabaseServer
    .from("koleex_recycle_bin")
    .select("id, kind, label, deleted_at, restored_at, deleted_by")
    .order("deleted_at", { ascending: false })
    .limit(200);
  if (auth.tenant_id) q = q.eq("tenant_id", auth.tenant_id);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Accounts", "delete");
  if (deny) return deny;

  const body = (await req.json().catch(() => ({}))) as { id?: string };
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const res = await restoreBinEntry(id, auth.tenant_id ?? null);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });

  await logAudit({
    auth,
    action_type: "update",
    module: "Accounts",
    entity_type: "recycle_bin",
    entity_id: id,
    entity_label: res.kind ?? null,
    old_values: null,
    new_values: { restored: true },
    route: "/api/recycle-bin",
    req,
  });
  return NextResponse.json({ ok: true, kind: res.kind });
}
