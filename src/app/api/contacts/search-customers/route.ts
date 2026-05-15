import "server-only";

/* ---------------------------------------------------------------------------
   /api/contacts/search-customers

   Lightweight picker endpoint that backs the Quotation editor's
   "Link customer" modal. Returns customer-type contacts only, with
   just the fields the QUOTATION TO card needs:

     [ id, display, company, email, phone, mobile, address, website ]

   Auth: any authenticated user with Quotations module access. Customers
   logging into the portal must never see another tenant's contact
   list, so the tenant scope is enforced server-side (no client-supplied
   tenant_id is honoured).
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

interface ContactDbRow {
  id: string;
  tenant_id: string | null;
  contact_type: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  website: string | null;
  phones: { label: string; number: string }[] | null;
  addresses:
    | { label?: string; street?: string; city?: string; state?: string; zip?: string; country?: string }[]
    | null;
}

interface PickerRow {
  id: string;
  displayName: string;
  companyName: string;
  email: string;
  phone: string;
  mobile: string;
  address: string;
  website: string;
}

function joinName(r: ContactDbRow): string {
  if (r.display_name && r.display_name.trim()) return r.display_name.trim();
  const parts = [r.first_name, r.last_name].filter(
    (s): s is string => !!s && s.trim() !== "",
  );
  return parts.join(" ").trim();
}

function buildAddress(r: ContactDbRow): string {
  /* Prefer the first structured address if any. Stringify in the
     style the FROM card uses (street → city → country) so the
     QUOTATION TO card lines up visually. */
  const first = (r.addresses ?? []).find(
    (a) => a && (a.street || a.city || a.country),
  );
  if (first) {
    return [first.street, first.city, first.state, first.country]
      .filter((s) => s && String(s).trim())
      .join(", ");
  }
  /* Fallback to the flat fields. */
  return [r.city, r.country].filter((s) => s && s.trim()).join(", ");
}

function pickMobile(r: ContactDbRow): string {
  /* Prefer the entry labelled "mobile" / "cell" / similar over the
     primary phone field, which is conventionally the office line. */
  const list = r.phones ?? [];
  const mobile = list.find((p) =>
    /mobile|cell|whatsapp/i.test(p.label ?? ""),
  );
  if (mobile?.number) return mobile.number;
  /* If there are two+ phones, take the second one as the "mobile". */
  if (list.length >= 2 && list[1].number) return list[1].number;
  return "";
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Quotations");
  if (deny) return deny;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.min(
    Math.max(1, Number(url.searchParams.get("limit") ?? 200)),
    500,
  );

  /* Tenant scope + customer-only filter. The contacts table is small
     enough per tenant that we pull the whole customer set and filter
     client-side; the picker UI debounces searches anyway. */
  const { data, error } = await supabaseServer
    .from("contacts")
    .select(
      "id, tenant_id, contact_type, display_name, first_name, last_name, company, email, phone, city, country, website, phones, addresses",
    )
    .eq("tenant_id", auth.tenant_id)
    .eq("contact_type", "customer")
    .order("display_name", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("[api/contacts/search-customers]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as ContactDbRow[];
  const needle = q.toLowerCase();
  const out: PickerRow[] = [];
  for (const r of rows) {
    const display = joinName(r);
    const company = r.company ?? "";
    if (needle) {
      const hay = `${display} ${company} ${r.email ?? ""}`.toLowerCase();
      if (!hay.includes(needle)) continue;
    }
    out.push({
      id: r.id,
      displayName: display,
      companyName: company,
      email: r.email ?? "",
      phone: r.phone ?? "",
      mobile: pickMobile(r),
      address: buildAddress(r),
      website: r.website ?? "",
    });
    if (out.length >= limit) break;
  }

  return NextResponse.json(
    { rows: out },
    {
      headers: {
        /* Read-heavy, low-mutation. 30 s private cache keeps the
           picker snappy on repeated opens without staleness pain. */
        "Cache-Control": "private, max-age=30, stale-while-revalidate=300",
      },
    },
  );
}
