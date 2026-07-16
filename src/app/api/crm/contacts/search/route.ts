import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/crm/contacts/search   (Phase 4 Wave 2B.2)

   Bounded, tenant-scoped picker search that backs the CRM deal modal's
   Company / Contact autocomplete. Replaces the previous pattern where the
   modal downloaded the ENTIRE contact directory into the browser and
   filtered it client-side.

   Query params:
     q      free-text needle (name / company / email). Minimum 2 chars —
            shorter queries return [] so we never stream the whole book.
     kind   optional "company" | "person" hint (does not widen scope).
     limit  cap (default 20, max 50).

   Returns ONLY the six display fields the combobox renders — never notes,
   credit terms, addresses, tax ids, or any other contact column. Auth: any
   authenticated user with CRM module access; tenant scope is server-derived
   from the session (no client-supplied tenant_id is honoured) so a customer
   portal account can never read another tenant's contacts.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

interface ContactDbRow {
  id: string;
  entity_type: string | null;
  contact_type: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  email: string | null;
  photo_url: string | null;
}

/* The exact slim shape the client picker consumes. Nothing else leaves the
   server — no phones, addresses, tax ids, credit terms, or internal scores. */
export interface CrmContactPick {
  id: string;
  display_name: string;
  full_name: string;
  first_name: string;
  last_name: string;
  company: string;
  email: string;
  entity_type: string;
  contact_type: string;
  photo_url: string | null;
}

const MIN_QUERY = 2;

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "CRM");
  if (deny) return deny;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const kind = url.searchParams.get("kind"); // "company" | "person" | null
  const limit = Math.min(
    Math.max(1, Number(url.searchParams.get("limit") ?? 20)),
    50,
  );

  /* Guard: never stream the directory. Below the minimum, return nothing —
     the client shows the currently-selected value (which it already holds)
     instead of a broad list. */
  if (q.length < MIN_QUERY) {
    return NextResponse.json({ rows: [] as CrmContactPick[] });
  }

  const like = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
  let query = supabaseServer
    .from("contacts")
    .select(
      "id, entity_type, contact_type, display_name, first_name, last_name, company, email, photo_url",
    )
    .eq("tenant_id", auth.tenant_id)
    .or(
      `display_name.ilike.${like},company.ilike.${like},first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like}`,
    )
    .order("display_name", { ascending: true, nullsFirst: false })
    .limit(limit);

  /* Optional server-side kind narrowing. "person" excludes org-type rows;
     "company" is left broad because a person row can still carry a matching
     `company` value (preserves the legacy combobox semantics). */
  if (kind === "person") {
    query = query.not("contact_type", "eq", "company").not("contact_type", "eq", "supplier");
  }

  const { data, error } = await query;
  if (error) {
    console.error("[api/crm/contacts/search]", error.message);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }

  const rows: CrmContactPick[] = ((data ?? []) as ContactDbRow[]).map((r) => {
    const full = [r.first_name, r.last_name].filter(Boolean).join(" ").trim();
    return {
      id: r.id,
      display_name: r.display_name ?? full ?? "",
      full_name: full,
      first_name: r.first_name ?? "",
      last_name: r.last_name ?? "",
      company: r.company ?? "",
      email: r.email ?? "",
      entity_type: r.entity_type ?? "",
      contact_type: r.contact_type ?? "",
      photo_url: r.photo_url ?? null,
    };
  });

  return NextResponse.json(
    { rows },
    {
      headers: {
        "Cache-Control": "private, max-age=15, stale-while-revalidate=120",
      },
    },
  );
}
