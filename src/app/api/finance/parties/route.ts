import "server-only";

/* ---------------------------------------------------------------------------
   /api/finance/parties — unified party picker source for Finance forms.

   Returns customer-type OR supplier-type contacts for the current tenant
   with the extra fields the Finance pickers want:
     · contacts.country_code         → flag emoji lookup
     · contacts.customer_type        → tier badge (silver/gold/platinum/diamond)
     · contacts.photo_url            → avatar / logo

   Two side-channels:
     · /api/finance/parties?type=customer
     · /api/finance/parties?type=supplier

   Search is server-side ilike on display_name + company + email.

   Why we don't reuse /api/contacts/search-customers:
     - that endpoint is locked to the Quotations module permission and
       only returns customers,
     - this endpoint is locked to the Finance module permission and
       supports both party types,
     - the result shape carries the extras Finance needs (tier, flag)
       that the Quotations card doesn't surface.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

export type PartyType = "customer" | "supplier";

export interface FinancePartyRow {
  id: string;
  type: PartyType;
  display_name: string;
  company: string;
  email: string;
  phone: string;
  country: string;
  country_code: string;
  customer_tier: "end_user" | "silver" | "gold" | "platinum" | "diamond" | null;
  photo_url: string | null;
  /* Existing finance-account config for this party (if any) — lets the
     UI show the configured payment terms + credit status right next to
     the picker entry. */
  payment_terms: string | null;
  credit_status: "good" | "watch" | "hold" | "blocked" | null;
  default_currency: string | null;
}

interface ContactDbRow {
  id: string;
  contact_type: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  country_code: string | null;
  customer_type: FinancePartyRow["customer_tier"] | null;
  photo_url: string | null;
}

function joinName(r: ContactDbRow): string {
  if (r.display_name && r.display_name.trim()) return r.display_name.trim();
  return [r.first_name, r.last_name].filter(Boolean).join(" ").trim();
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const url = new URL(req.url);
  const type = (url.searchParams.get("type") ?? "customer") as PartyType;
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const limit = Math.min(Math.max(1, Number(url.searchParams.get("limit") ?? 250)), 500);

  if (type !== "customer" && type !== "supplier") {
    return NextResponse.json({ error: "type must be customer or supplier" }, { status: 400 });
  }

  const [contactsRes, accountsRes] = await Promise.all([
    supabaseServer
      .from("contacts")
      .select(
        "id, contact_type, display_name, first_name, last_name, company, email, phone, country, country_code, customer_type, photo_url",
      )
      .eq("tenant_id", auth.tenant_id)
      .eq("contact_type", type)
      .order("display_name", { ascending: true, nullsFirst: false }),
    type === "customer"
      ? supabaseServer
          .from("finance_customer_accounts")
          .select("customer_id, payment_terms, credit_status, default_currency")
          .eq("tenant_id", auth.tenant_id)
      : supabaseServer
          .from("finance_supplier_accounts")
          .select("supplier_id, payment_terms, default_currency")
          .eq("tenant_id", auth.tenant_id),
  ]);

  if (contactsRes.error) {
    console.error("[api/finance/parties]", contactsRes.error.message);
    return NextResponse.json({ error: contactsRes.error.message }, { status: 500 });
  }

  const accountByPartyId = new Map<string, { payment_terms: string | null; credit_status?: FinancePartyRow["credit_status"]; default_currency: string | null }>();
  for (const a of accountsRes.data ?? []) {
    const key = type === "customer"
      ? (a as { customer_id: string }).customer_id
      : (a as { supplier_id: string }).supplier_id;
    accountByPartyId.set(key, {
      payment_terms: (a as { payment_terms: string | null }).payment_terms ?? null,
      credit_status: type === "customer"
        ? ((a as { credit_status?: FinancePartyRow["credit_status"] }).credit_status ?? null)
        : null,
      default_currency: (a as { default_currency: string | null }).default_currency ?? null,
    });
  }

  const rows = (contactsRes.data ?? []) as ContactDbRow[];
  const out: FinancePartyRow[] = [];
  for (const r of rows) {
    const display = joinName(r);
    const company = r.company ?? "";
    if (q) {
      const hay = `${display} ${company} ${r.email ?? ""}`.toLowerCase();
      if (!hay.includes(q)) continue;
    }
    const acc = accountByPartyId.get(r.id);
    out.push({
      id: r.id,
      type,
      display_name: display,
      company,
      email: r.email ?? "",
      phone: r.phone ?? "",
      country: r.country ?? "",
      country_code: (r.country_code ?? "").toUpperCase(),
      customer_tier: type === "customer" ? r.customer_type : null,
      photo_url: r.photo_url,
      payment_terms: acc?.payment_terms ?? null,
      credit_status: acc?.credit_status ?? null,
      default_currency: acc?.default_currency ?? null,
    });
    if (out.length >= limit) break;
  }

  return NextResponse.json(
    { parties: out },
    { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=300" } },
  );
}
