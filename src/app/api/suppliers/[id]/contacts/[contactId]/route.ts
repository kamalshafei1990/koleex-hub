import "server-only";

/* ---------------------------------------------------------------------------
   PATCH  /api/suppliers/[id]/contacts/[contactId] — edit a contact person.
   DELETE /api/suppliers/[id]/contacts/[contactId] — archive (soft delete).

   Whitelisted, tenant + supplier scoped, Suppliers-module gated. DELETE is a
   soft archive (is_active = false) — never a permanent delete — so history
   and any linked QR media are preserved.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import {
  buildContactPatch,
  validateContactPatch,
} from "@/lib/suppliers/contact-fields";

type Params = { params: Promise<{ id: string; contactId: string }> };

async function guard(req: Request, action: "edit" | "delete") {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return { auth: null as never, res: auth };
  const deny = await requireModuleAction(auth, "Suppliers", action);
  if (deny) return { auth: null as never, res: deny };
  return { auth, res: null };
}

export async function PATCH(req: Request, ctx: Params) {
  const { auth, res } = await guard(req, "edit");
  if (res) return res;

  const { id, contactId } = await ctx.params;
  const tid = auth.tenant_id;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const patch = buildContactPatch(body);
  const verr = validateContactPatch(patch);
  if (verr) return NextResponse.json({ error: verr }, { status: 400 });
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No editable fields supplied" }, { status: 400 });
  }
  patch.updated_at = new Date().toISOString();

  const { error } = await supabaseServer
    .from("supplier_contact_persons")
    .update(patch)
    .eq("id", contactId)
    .eq("tenant_id", tid)
    .eq("supplier_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, ctx: Params) {
  const { auth, res } = await guard(req, "delete");
  if (res) return res;

  const { id, contactId } = await ctx.params;
  const tid = auth.tenant_id;

  // Soft archive — never a permanent delete.
  const { error } = await supabaseServer
    .from("supplier_contact_persons")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", contactId)
    .eq("tenant_id", tid)
    .eq("supplier_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
