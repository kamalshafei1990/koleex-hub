import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import { deptsFromFields, recordSectionEdits } from "@/lib/suppliers/section-audit";
import { persistContactImages } from "@/lib/server/persist-contact-images";

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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  let q = supabaseServer.from("contacts").select("*").eq("id", id);
  if (auth.tenant_id) q = q.eq("tenant_id", auth.tenant_id);
  const { data, error } = await q.maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const deny = await requireModuleAccess(auth, moduleForType((data as { contact_type?: string }).contact_type));
  if (deny) return deny;

  /* Identity consolidation P3 — read-through. When this contact is linked to a
     shared person record, the person is the source of truth for identity
     (name/contact/address); overlay those onto the returned contact and attach
     a `linked_person` marker so the UI can show "identity from person record".
     Business/CRM fields stay on the contact. Dormant when person_id is null. */
  const withPerson = await overlayLinkedPerson(data as Record<string, unknown>);
  return NextResponse.json({ contact: withPerson });
}

/** Overlay the linked person's identity fields onto a contact row (P3). */
async function overlayLinkedPerson(
  contact: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const personId = contact.person_id;
  if (typeof personId !== "string" || !personId) return contact;
  const { data: person } = await supabaseServer
    .from("people")
    .select("id, full_name, first_name, last_name, email, phone, mobile, address_line1, address_line2, city, state, country, postal_code")
    .eq("id", personId)
    .maybeSingle();
  if (!person) return contact;
  const p = person as Record<string, unknown>;
  const keep = (v: unknown, fallback: unknown) =>
    v === null || v === undefined || v === "" ? fallback : v;
  return {
    ...contact,
    full_name: keep(p.full_name, contact.full_name),
    first_name: keep(p.first_name, contact.first_name),
    last_name: keep(p.last_name, contact.last_name),
    email: keep(p.email, contact.email),
    phone: keep(p.phone, contact.phone),
    city: keep(p.city, contact.city),
    country: keep(p.country, contact.country),
    province: keep(p.state, contact.province),
    linked_person: {
      id: p.id, full_name: p.full_name, email: p.email, phone: p.phone,
    },
  };
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

  const deny = await requireModuleAction(auth, moduleForType(existing.contact_type), "edit");
  if (deny) return deny;

  const patch = (await req.json()) as Record<string, unknown>;
  delete patch.id;
  delete patch.tenant_id;
  delete patch.created_at;

  /* Root-cause guard: move any inline base64 avatar into Storage so an edit
     saves a short URL, never re-introducing multi-KB base64 into the row. */
  await persistContactImages(auth.tenant_id, patch);

  /* If the caller is trying to convert a record from one type to
     another (supplier → customer, say), they also need view+edit on
     the destination module. Otherwise you could launder a supplier
     into a customer entry and read the cost-linked fields. */
  if (typeof patch.contact_type === "string" && patch.contact_type !== existing.contact_type) {
    const denyDest = await requireModuleAction(auth, moduleForType(patch.contact_type), "edit");
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

  /* Identity consolidation P3 — write-through. If this contact is linked to a
     person, mirror any identity fields from the patch onto the shared people
     record so the edit shows up in Settings / Accounts / HR too. Dormant when
     the contact isn't linked. Business/CRM fields are never mirrored. */
  await mirrorIdentityToPerson(id, patch);

  /* Mirror catalogue changes into the Catalogs app so a catalogue uploaded
     from the supplier form shows up there too. Only when catalogues changed. */
  if (existing.contact_type === "supplier" && "catalogues" in patch) {
    try {
      const { data: full } = await supabaseServer
        .from("contacts")
        .select("id, contact_type, display_name, first_name, last_name, company_name, company_name_en, company_name_cn, division, category, catalogues")
        .eq("id", id)
        .maybeSingle();
      if (full) {
        const { syncContactCatalogues } = await import("@/lib/suppliers/catalogue-sync");
        await syncContactCatalogues(auth.tenant_id, full as never);
      }
    } catch (e) { console.error("[api/contacts/[id] PATCH] catalogue sync", e); }
  }

  /* Section-level attribution: stamp which department(s) this edit touched
     so the supplier form can show "Updated by <name> · <date>". */
  if (existing.contact_type === "supplier") {
    const depts = deptsFromFields(Object.keys(patch));
    if (depts.length) {
      await recordSectionEdits({
        tenantId: auth.tenant_id,
        supplierId: id,
        depts,
        accountId: auth.account_id ?? null,
        accountName: auth.username || auth.login_email || "System",
      });
    }
  }

  return NextResponse.json({ ok: true });
}

/** Mirror identity fields from a contact patch onto its linked person (P3). */
async function mirrorIdentityToPerson(
  contactId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { data: row } = await supabaseServer
    .from("contacts")
    .select("person_id")
    .eq("id", contactId)
    .maybeSingle();
  const personId = (row as { person_id?: string | null } | null)?.person_id;
  if (!personId) return;

  /* contact field → people column. Only identity; never business/CRM. */
  const map: Record<string, string> = {
    full_name: "full_name", first_name: "first_name", last_name: "last_name",
    email: "email", phone: "phone", city: "city", country: "country",
    province: "state",
  };
  const personPatch: Record<string, unknown> = {};
  for (const [contactKey, peopleCol] of Object.entries(map)) {
    if (contactKey in patch) personPatch[peopleCol] = patch[contactKey];
  }
  if (Object.keys(personPatch).length === 0) return;

  const { error } = await supabaseServer
    .from("people")
    .update(personPatch)
    .eq("id", personId);
  if (error) console.error("[api/contacts/[id] PATCH] person mirror", error.message);
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

  const deny = await requireModuleAction(auth, moduleForType(existing.contact_type), "delete");
  if (deny) return deny;

  /* A customer contact can have a linked portal/login account
     (accounts.contact_id → contacts, ON DELETE SET NULL). The
     accounts_identity_per_type CHECK requires a customer account to KEEP a
     contact_id, so the FK's SET NULL would fire and abort the whole delete
     with "violates check constraint". Remove the linked customer account(s)
     first — a customer login is meaningless once its contact is gone. Only
     customer accounts carry contact_id (internal accounts use person_id), so
     this never touches internal staff logins. Scoped by contact_id ONLY (not
     tenant): contact_id is a globally-unique FK pointing at exactly this
     contact, so it targets only accounts tied to the contact being deleted —
     and some legacy/seed accounts are linked cross-tenant, which a tenant
     filter would miss, leaving the delete blocked. */
  const { error: acctErr } = await supabaseServer
    .from("accounts")
    .delete()
    .eq("contact_id", id);
  if (acctErr) {
    console.error("[api/contacts/[id] DELETE] account cleanup", acctErr.message);
    return NextResponse.json({ error: acctErr.message }, { status: 500 });
  }

  const { error } = await supabaseServer
    .from("contacts")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("[api/contacts/[id] DELETE]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  /* Don't leave the Catalogs app showing catalogues attached to a supplier
     that no longer exists. Remove any catalogs rows that were synced from this
     supplier (best-effort — failure here doesn't undo the contact delete). */
  if (existing.contact_type === "supplier") {
    const { error: cErr } = await supabaseServer
      .from("catalogs")
      .delete()
      .eq("tenant_id", auth.tenant_id)
      .eq("contact_id", id);
    if (cErr) console.error("[api/contacts/[id] DELETE] catalogs cleanup", cErr.message);
  }

  return NextResponse.json({ ok: true });
}
