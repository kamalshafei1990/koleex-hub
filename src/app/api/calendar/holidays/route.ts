import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";

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
   (holidays are tenant-wide reference data).
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
    .eq("tenant_id", auth.tenant_id)
    .eq("is_active", true);

  /* When a country is requested, also return that country's holidays plus any
     customer-scoped holidays the caller asked for. Filters are additive and
     optional — with no filter the full tenant set is returned. */
  if (country) q = q.eq("country", country);
  if (customerId) q = q.eq("customer_id", customerId);

  const { data, error } = await q.order("holiday_date", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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
  if (holidayType !== "weekly" && !holidayDate) {
    return NextResponse.json({ error: "national/official holidays need a date" }, { status: 400 });
  }

  const row = {
    tenant_id: auth.tenant_id,
    name,
    holiday_type: holidayType,
    scope_type: scopeType,
    country: scopeType === "country" ? (String(body.country ?? "").trim() || null) : null,
    customer_id: scopeType === "customer" ? (String(body.customer_id ?? "").trim() || null) : null,
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
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ holiday: data }, { status: 201 });
}
