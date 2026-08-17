import "server-only";

/* ---------------------------------------------------------------------------
   /api/invitations/[id]

   GET    — one letter.
   PUT    — edit it. Every field stays editable after saving, including on a
            letter already exported; the client decides whether to overwrite
            this version or duplicate first (the owner's call, at the time).
   DELETE — permanent, immediately, by the owner's instruction. No soft-delete
            and no Recycle Bin: an invitation letter that was withdrawn should
            not be recoverable by someone browsing a bin later.

   The reference number is NEVER editable. It is what the customer quotes back
   and what a consulate would use to check with us.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { LETTER_COLUMNS, toLetter } from "@/lib/invitations/row";
import { validateLetter, type LetterPayload } from "@/lib/invitations/validate";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Travel");
  if (deny) return deny;

  const { id } = await ctx.params;
  const { data, error } = await supabaseServer
    .from("invitation_letters")
    .select(LETTER_COLUMNS as "*")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();

  if (error) {
    console.error("[api/invitations/:id] fetch:", error.message);
    return NextResponse.json({ error: "Failed to load the invitation" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(toLetter(data as Record<string, unknown>), {
    headers: { "Cache-Control": "private, max-age=15" },
  });
}

export async function PUT(req: Request, ctx: Ctx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Travel");
  if (deny) return deny;

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as LetterPayload | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const { errors, warnings } = validateLetter(body);
  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0], errors }, { status: 400 });
  }

  const v = body.visitor ?? {};
  const visit = body.visit ?? {};
  const s = (x: unknown) => (typeof x === "string" && x.trim() ? x.trim() : null);

  /* `reference`, `tenant_id` and `created_by` are absent by construction —
     the patch is built from an explicit list, not spread from the body. */
  const patch = {
    contact_id: s(body.contactId),

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

    purpose:         s(visit.purpose),
    exhibition_name: s(visit.exhibitionName),
    extra_note:      s(visit.extraNote),
    arrival_city:    s(visit.arrivalCity),
    arrival_date:    s(visit.arrivalDate),
    departure_date:  s(visit.departureDate),
    cities:          Array.isArray(visit.cities) ? visit.cities.filter((c) => typeof c === "string") : [],
    visa_type:       s(visit.visaType) ?? "multi",

    letter_date: s(body.letterDate),
    /* Editing invalidates the exported file: the stored PDF no longer matches
       the record. Clearing it forces a re-export rather than letting the
       customer's copy and ours drift apart silently. */
    pdf_url: null,
  };

  const { data, error } = await supabaseServer
    .from("invitation_letters")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .select(LETTER_COLUMNS as "*")
    .maybeSingle();

  if (error) {
    console.error("[api/invitations/:id] save:", error.message);
    return NextResponse.json({ error: "Failed to save the invitation" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ letter: toLetter(data as Record<string, unknown>), warnings });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Travel");
  if (deny) return deny;

  const { id } = await ctx.params;

  /* Tenant scope is on the DELETE itself, so a guessed id from another
     tenant deletes nothing rather than being caught by a prior read. */
  const { data, error } = await supabaseServer
    .from("invitation_letters")
    .delete()
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[api/invitations/:id] delete:", error.message);
    return NextResponse.json({ error: "Failed to delete the invitation" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
