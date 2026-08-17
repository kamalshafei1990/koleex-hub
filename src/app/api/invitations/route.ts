import "server-only";

/* ---------------------------------------------------------------------------
   /api/invitations

   GET  — the letter list. Paged, newest first. `?contactId=` narrows it to
          one customer, which is what the customer's Documents tab reads.
   POST — create a letter. Allocates the next reference and snapshots the
          visitor as entered.

   Gated on the Travel module. Anyone who can prepare invitations can see
   them — the owner's rule. The stamp and signature stay super-admin-only
   where they already live, so preparing a letter never means being able to
   change what signs it.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { LETTER_COLUMNS, isReferenceConflict, nextReference, toLetter } from "@/lib/invitations/row";
import { validateLetter, type LetterPayload } from "@/lib/invitations/validate";

/** Bounded so the list can never be asked for everything at once. */
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Travel");
  if (deny) return deny;

  const url = new URL(req.url);
  const contactId = url.searchParams.get("contactId");
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const sizeRaw = Number.parseInt(url.searchParams.get("pageSize") ?? "", 10);
  const size = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.isFinite(sizeRaw) ? sizeRaw : DEFAULT_PAGE_SIZE),
  );
  const from = (page - 1) * size;

  let q = supabaseServer
    .from("invitation_letters")
    .select(LETTER_COLUMNS as "*", { count: "exact" })
    .eq("tenant_id", auth.tenant_id);

  if (contactId) q = q.eq("contact_id", contactId);

  /* id as a tie-breaker: two letters saved in the same millisecond would
     otherwise be able to swap places between pages and one could be missed. */
  const { data, error, count } = await q
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + size - 1);

  if (error) {
    console.error("[api/invitations] list:", error.message);
    return NextResponse.json({ error: "Failed to load invitations" }, { status: 500 });
  }

  return NextResponse.json(
    {
      rows: (data ?? []).map((r) => toLetter(r as Record<string, unknown>)),
      total: count ?? 0,
      page,
      pageSize: size,
    },
    { headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=60" } },
  );
}

/** Build the insert row from a validated payload. */
function toRow(p: LetterPayload, tenantId: string, accountId: string, reference: string) {
  const v = p.visitor ?? {};
  const visit = p.visit ?? {};
  const s = (x: unknown) => (typeof x === "string" && x.trim() ? x.trim() : null);
  return {
    tenant_id: tenantId,
    reference,
    contact_id: s(p.contactId),

    visitor_name:             s(v.name),
    visitor_gender:           s(v.gender),
    visitor_dob:              s(v.dob),
    visitor_nationality:      s(v.nationality),
    visitor_nationality_code: s(v.nationalityCode),
    visitor_passport_no:      s(v.passportNo),
    visitor_passport_issue:   s(v.passportIssue),
    visitor_passport_expiry:  s(v.passportExpiry),
    visitor_company:          s(v.company),
    visitor_position:         s(v.position),
    visitor_country:          s(v.country),
    visitor_country_code:     s(v.countryCode),

    purpose:        s(visit.purpose),
    exhibition_name: s(visit.exhibitionName),
    extra_note:     s(visit.extraNote),
    arrival_city:   s(visit.arrivalCity),
    arrival_date:   s(visit.arrivalDate),
    departure_date: s(visit.departureDate),
    cities:         Array.isArray(visit.cities) ? visit.cities.filter((c) => typeof c === "string") : [],
    visa_type:      s(visit.visaType) ?? "multi",

    letter_date: s(p.letterDate) ?? new Date().toISOString().slice(0, 10),
    status: "draft",
    created_by: accountId,
  };
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Travel");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as LetterPayload | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const { errors, warnings } = validateLetter(body);
  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0], errors }, { status: 400 });
  }

  const year = Number.parseInt(
    (typeof body.letterDate === "string" ? body.letterDate : "").slice(0, 4),
    10,
  ) || new Date().getFullYear();

  /* Retry the reference on a unique violation — two people saving at the
     same moment compute the same next number, and the index rejects one. */
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const reference = await nextReference(auth.tenant_id, year);
    const { data, error } = await supabaseServer
      .from("invitation_letters")
      .insert(toRow(body, auth.tenant_id, auth.account_id, reference))
      .select(LETTER_COLUMNS as "*")
      .single();

    if (!error) {
      return NextResponse.json(
        { letter: toLetter(data as Record<string, unknown>), warnings },
        { status: 201 },
      );
    }
    if (!isReferenceConflict(error)) {
      console.error("[api/invitations] create:", error.message);
      return NextResponse.json({ error: "Failed to create the invitation" }, { status: 500 });
    }
  }

  return NextResponse.json(
    { error: "Could not allocate a reference number. Please try again." },
    { status: 409 },
  );
}
