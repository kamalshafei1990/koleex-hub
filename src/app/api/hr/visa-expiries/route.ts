import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* GET /api/hr/visa-expiries?days=60
 *
 * Visa expiries within N days, joined to the person's name. Lives on the
 * server because koleex_employees/people are service-role-only (P0 RLS
 * lockdown) — the old anon-client query in hr-admin silently returned
 * nothing, which is why the HR dashboard never showed expiring visas. */
export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "HR");
  if (deny) return deny;

  const days = Math.min(365, Math.max(1, Number(new URL(req.url).searchParams.get("days")) || 60));
  const today = new Date().toISOString().split("T")[0];
  const future = new Date();
  future.setDate(future.getDate() + days);
  const futureStr = future.toISOString().split("T")[0];

  const { data: visas, error } = await supabaseServer
    .from("koleex_employees")
    .select("id, person_id, visa_number, visa_expiry_date")
    .not("visa_expiry_date", "is", null)
    .gte("visa_expiry_date", today)
    .lte("visa_expiry_date", futureStr);
  if (error) {
    console.error("[api/hr/visa-expiries]", error.message);
    return NextResponse.json({ items: [] });
  }

  const personIds = (visas ?? []).map((v) => v.person_id).filter(Boolean) as string[];
  const { data: people } = personIds.length
    ? await supabaseServer.from("people").select("id, full_name").in("id", personIds)
    : { data: [] };
  const nameMap = new Map(((people ?? []) as Array<{ id: string; full_name: string }>).map((p) => [p.id, p.full_name]));

  const items = (visas ?? []).map((v) => ({
    employee_id: v.id as string,
    employee_name: (v.person_id && nameMap.get(v.person_id)) || "Unknown",
    visa_number: (v.visa_number as string | null) ?? null,
    visa_expiry_date: v.visa_expiry_date as string,
  }));

  return NextResponse.json(
    { items },
    { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=600" } },
  );
}
