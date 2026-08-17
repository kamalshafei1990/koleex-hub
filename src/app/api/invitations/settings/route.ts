import "server-only";

/* ---------------------------------------------------------------------------
   /api/invitations/settings — the Chinese company side of every letter.

   GET  — anyone with the Travel module. These are the facts printed on every
          letter (company name, licence address, inviter); the form needs them
          to preview, and they are already on the document the customer holds.

   PUT  — super-admin only. This is the company's legal identity as it appears
          to a consulate: the registered name, the licence address, the credit
          code, and who signs. A sales rep must not be able to change what a
          government office will compare against the business licence.

   The stamp and signature are NOT here — they live in
   /api/quotations/saved-assets and are shared with the Quotation editor, so
   the owner uploads them once for the whole Hub.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import type { InvitationSettings } from "@/lib/invitations/types";

/** DB row → API shape. One place, so GET and the letter builder agree. */
function toApi(row: Record<string, unknown> | null): InvitationSettings {
  const r = row ?? {};
  const s = (k: string) => (typeof r[k] === "string" && r[k] ? (r[k] as string) : null);
  return {
    companyNameEn:     s("company_name_en"),
    companyNameCn:     s("company_name_cn"),
    creditCode:        s("credit_code"),
    addressEn:         s("address_en"),
    addressCn:         s("address_cn"),
    inviterName:       s("inviter_name"),
    inviterPositionEn: s("inviter_position_en"),
    inviterPositionCn: s("inviter_position_cn"),
    inviterPhone:      s("inviter_phone"),
    licenceDocUrl:     s("licence_doc_url"),
  };
}

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Travel");
  if (deny) return deny;

  const { data, error } = await supabaseServer
    .from("invitation_settings")
    .select("*")
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();

  if (error) {
    console.error("[api/invitations/settings] fetch:", error.message);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }

  return NextResponse.json(toApi(data), {
    /* Settings change a handful of times a year. A 5-minute private cache
       keeps the invitation form from re-requesting them on every open
       without ever showing another tenant's data. */
    headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=900" },
  });
}

/** Editable fields, mapped API name → column. Anything not listed is ignored,
 *  so a crafted body can't reach tenant_id or updated_by. */
const WRITABLE: Record<string, string> = {
  companyNameEn:     "company_name_en",
  companyNameCn:     "company_name_cn",
  creditCode:        "credit_code",
  addressEn:         "address_en",
  addressCn:         "address_cn",
  inviterName:       "inviter_name",
  inviterPositionEn: "inviter_position_en",
  inviterPositionCn: "inviter_position_cn",
  inviterPhone:      "inviter_phone",
  licenceDocUrl:     "licence_doc_url",
};

export async function PUT(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) {
    return NextResponse.json(
      { error: "Only super-admins can change the company's invitation details." },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const patch: Record<string, unknown> = { tenant_id: auth.tenant_id, updated_by: auth.account_id };
  for (const [apiKey, column] of Object.entries(WRITABLE)) {
    if (!(apiKey in body)) continue;
    const v = body[apiKey];
    if (v === null || v === "") {
      patch[column] = null;
      continue;
    }
    if (typeof v !== "string") {
      return NextResponse.json({ error: `${apiKey} must be a string.` }, { status: 400 });
    }
    patch[column] = v.trim();
  }

  const { data, error } = await supabaseServer
    .from("invitation_settings")
    .upsert(patch, { onConflict: "tenant_id" })
    .select("*")
    .single();

  if (error) {
    console.error("[api/invitations/settings] save:", error.message);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }

  return NextResponse.json(toApi(data));
}
