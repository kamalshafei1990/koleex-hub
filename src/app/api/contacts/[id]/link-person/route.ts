import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";

/* POST /api/contacts/[id]/link-person  { person_id: string | null }
   Identity consolidation P4 — link (or unlink) a contact to a shared person
   record. This is the only supported way to set contacts.person_id: it
   validates the person is in the caller's tenant and the caller can edit the
   contact's module. Fully reversible (pass person_id: null to unlink) and
   non-destructive — no rows are merged or deleted. */

function moduleForType(type: string | null | undefined): string {
  if (type === "supplier") return "Suppliers";
  if (type === "employee") return "Employees";
  return "Customers";
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  // The contact must exist in this tenant.
  let cq = supabaseServer.from("contacts").select("id, contact_type").eq("id", id);
  if (auth.tenant_id) cq = cq.eq("tenant_id", auth.tenant_id);
  const { data: contact } = await cq.maybeSingle();
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const deny = await requireModuleAction(
    auth,
    moduleForType((contact as { contact_type?: string }).contact_type),
    "edit",
  );
  if (deny) return deny;

  const body = (await req.json().catch(() => ({}))) as { person_id?: unknown };
  const personId = body.person_id;

  if (personId !== null && typeof personId !== "string") {
    return NextResponse.json({ error: "person_id must be a string or null" }, { status: 400 });
  }

  // Linking: the target person must exist in the same tenant.
  if (typeof personId === "string") {
    let pq = supabaseServer.from("people").select("id").eq("id", personId);
    if (auth.tenant_id) pq = pq.eq("tenant_id", auth.tenant_id);
    const { data: person } = await pq.maybeSingle();
    if (!person) {
      return NextResponse.json({ error: "Person not found in this workspace" }, { status: 404 });
    }
  }

  const { error } = await supabaseServer
    .from("contacts")
    .update({ person_id: personId })
    .eq("id", id);
  if (error) {
    console.error("[api/contacts/[id]/link-person]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, linked: personId !== null });
}
