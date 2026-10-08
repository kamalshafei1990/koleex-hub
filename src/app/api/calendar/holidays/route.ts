import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";

/* ---------------------------------------------------------------------------
   /api/calendar/holidays  (report GEN-10)

   Holidays defined per country or per customer, in three categories:
     · weekly   — recurring rest day (weekday 0=Sun..6=Sat)
     · national — public/national holiday (a date, optionally annually recurring)
     · official — company/official non-working day (a date)

   GET    ?country=&customer_id=  → list (tenant-scoped, optional filters)
   POST   { name, holiday_type, scope_type, country?, customer_id?,
            holiday_date?, weekday?, recurs_annually? } → create

   Calendar is a personal/Type-C module; any authenticated user with Calendar
   module access can read holidays. Writes are restricted to Super Admin
   (holidays are tenant-wide reference data); the Calendar's holidays panel
   (components/admin/calendar/HolidaysPanel) calls POST and DELETE. A
   customer holiday must name a customer of the caller's tenant.
   A session without a tenant reads and writes the tenant-less rows.
   --------------------------------------------------------------------------- */

const SELECT =
  "id, name, holiday_type, scope_type, country, customer_id, holiday_date, weekday, recurs_annually, is_active";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Calendar");
  if (deny) return deny;

  const url = new URL(req.url);
  const country = url.searchParams.get("country");
  const customerId = url.searchParams.get("customer_id");

  let q = supabaseServer
    .from("koleex_holidays")
    .select(SELECT)
    .eq("is_active", true);
  q = auth.tenant_id ? q.eq("tenant_id", auth.tenant_id) : q.is("tenant_id", null);

  /* When a country is requested, also return that country's holidays plus any
     customer-scoped holidays the caller asked for. Filters are additive and
     optional — with no filter the full tenant set is returned. */
  if (country) q = q.eq("country", country);
  if (customerId) q = q.eq("customer_id", customerId);

  const { data, error } = await q.order("holiday_date", { ascending: true });
  if (error) {
    console.error("[api/calendar/holidays GET]", error.message);
    return NextResponse.json({ error: "Failed to load holidays" }, { status: 500 });
  }
  return NextResponse.json(
    { holidays: data ?? [] },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Calendar", "create");
  if (deny) return deny;

  if (!auth.is_super_admin) {
    return NextResponse.json(
      { error: "Only a Super Admin can manage holidays." },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "JSON body required" }, { status: 400 });

  const name = String(body.name ?? "").trim();
  const holidayType = String(body.holiday_type ?? "national");
  const scopeType = String(body.scope_type ?? "country");
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!["weekly", "national", "official"].includes(holidayType)) {
    return NextResponse.json({ error: "invalid holiday_type" }, { status: 400 });
  }
  if (!["country", "customer"].includes(scopeType)) {
    return NextResponse.json({ error: "invalid scope_type" }, { status: 400 });
  }

  const weekdayRaw = body.weekday;
  const weekday =
    weekdayRaw == null || weekdayRaw === "" ? null : Number(weekdayRaw);
  if (holidayType === "weekly" && (weekday == null || weekday < 0 || weekday > 6)) {
    return NextResponse.json({ error: "weekly holidays need a weekday 0..6" }, { status: 400 });
  }
  const holidayDate =
    body.holiday_date && String(body.holiday_date).trim()
      ? String(body.holiday_date).trim()
      : null;
  if (holidayDate && !/^\d{4}-\d{2}-\d{2}$/.test(holidayDate)) {
    return NextResponse.json({ error: "holiday_date must be YYYY-MM-DD" }, { status: 400 });
  }
  if (holidayType !== "weekly" && !holidayDate) {
    return NextResponse.json({ error: "national/official holidays need a date" }, { status: 400 });
  }

  const customerId = scopeType === "customer" ? String(body.customer_id ?? "").trim() : "";
  if (scopeType === "customer") {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customerId)) {
      return NextResponse.json({ error: "customer holidays need a customer_id" }, { status: 400 });
    }
    let cq = supabaseServer.from("customers").select("id").eq("id", customerId);
    cq = auth.tenant_id ? cq.eq("tenant_id", auth.tenant_id) : cq.is("tenant_id", null);
    const { data: cust, error: custErr } = await cq.maybeSingle();
    if (custErr) {
      console.error("[api/calendar/holidays POST] customer:", custErr.message);
      return NextResponse.json({ error: "Failed to create holiday" }, { status: 500 });
    }
    if (!cust) return NextResponse.json({ error: "unknown customer" }, { status: 400 });
  }

  const row = {
    tenant_id: auth.tenant_id,
    name,
    holiday_type: holidayType,
    scope_type: scopeType,
    country: scopeType === "country" ? (String(body.country ?? "").trim() || null) : null,
    customer_id: scopeType === "customer" ? customerId : null,
    holiday_date: holidayType === "weekly" ? null : holidayDate,
    weekday: holidayType === "weekly" ? weekday : null,
    recurs_annually: Boolean(body.recurs_annually),
    is_active: true,
  };

  const { data, error } = await supabaseServer
    .from("koleex_holidays")
    .insert(row)
    .select(SELECT)
    .single();
  if (error) {
    console.error("[api/calendar/holidays POST]", error.message);
    return NextResponse.json({ error: "Failed to create holiday" }, { status: 500 });
  }
  return NextResponse.json({ holiday: data }, { status: 201 });
}
