import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* PATCH /api/contacts/[id] — update a contact. Tenant-enforced.
   DELETE /api/contacts/[id] — remove a contact. Tenant-enforced.

   Permission model: the module is chosen from the EXISTING row's
   contact_type (supplier → Suppliers, employee → Employees, everything
   else → Customers). That way a user with only Customers can't
   delete a supplier record by hitting this endpoint directly. */

function moduleForType(type: string | null | undefined): string {
  if (type === "supplier") return "Suppliers";
  if (type === "employee") return "Employees";
  return "Customers";
}

async function fetchExisting(
  id: string,
  tenantId: string | null,
): Promise<{ id: string; contact_type: string | null } | null> {
  let q = supabaseServer.from("contacts").select("id, contact_type").eq("id", id);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data } = await q.maybeSingle();
  return (data as { id: string; contact_type: string | null } | null) ?? null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const existing = await fetchExisting(id, auth.tenant_id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const deny = await requireModuleAccess(auth, moduleForType(existing.contact_type));
  if (deny) return deny;

  const patch = (await req.json()) as Record<string, unknown>;
  delete patch.id;
  delete patch.tenant_id;
  delete patch.created_at;

  /* If the caller is trying to convert a record from one type to
     another (supplier → customer, say), they also need view+edit on
     the destination module. Otherwise you could launder a supplier
     into a customer entry and read the cost-linked fields. */
  if (typeof patch.contact_type === "string" && patch.contact_type !== existing.contact_type) {
    const denyDest = await requireModuleAccess(auth, moduleForType(patch.contact_type));
    if (denyDest) return denyDest;
  }

  const { error } = await supabaseServer
    .from("contacts")
    .update(patch)
    .eq("id", id);
  if (error) {
    console.error("[api/contacts/[id] PATCH]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const existing = await fetchExisting(id, auth.tenant_id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const deny = await requireModuleAccess(auth, moduleForType(existing.contact_type));
  if (deny) return deny;

  const { error } = await supabaseServer
    .from("contacts")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("[api/contacts/[id] DELETE]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
