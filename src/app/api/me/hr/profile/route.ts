import "server-only";

/* ---------------------------------------------------------------------------
   PATCH /api/me/hr/profile — the few fields an employee keeps current
   themselves: how to reach them (phone, mobile, home address, WeChat) and
   who to call if something happens (two emergency contacts).

   Whitelist, not blacklist: MY_PROFILE_*_FIELDS in me-hr-types is the whole
   surface. Name, ID numbers, bank, salary, dates, status — anything with a
   legal or payroll consequence — stays with HR through /api/employees/[id],
   which carries the Employees·edit permission and the audit log. Unknown
   keys are dropped silently rather than 400'd so an older client can never
   be locked out by a new field.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { resolveMyEmployee } from "@/lib/server/me-hr";
import { MY_PROFILE_EMPLOYEE_FIELDS, MY_PROFILE_PERSON_FIELDS } from "@/lib/me-hr-types";

const clean = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, 300);
  return s || null;
};

export async function PATCH(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const me = await resolveMyEmployee(auth);
  if (!me) return NextResponse.json({ error: "not_employee" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const person: Record<string, string | null> = {};
  for (const k of MY_PROFILE_PERSON_FIELDS) if (k in body) person[k] = clean(body[k]);
  const employee: Record<string, string | null> = {};
  for (const k of MY_PROFILE_EMPLOYEE_FIELDS) if (k in body) employee[k] = clean(body[k]);

  if (Object.keys(person).length === 0 && Object.keys(employee).length === 0) {
    return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });
  }

  if (Object.keys(person).length) {
    if (!me.personId) return NextResponse.json({ error: "no_person" }, { status: 409 });
    const { error } = await supabaseServer.from("people").update(person).eq("id", me.personId);
    if (error) {
      console.error("[api/me/hr/profile people]", error.message);
      return NextResponse.json({ error: "Could not save." }, { status: 500 });
    }
  }
  if (Object.keys(employee).length) {
    const { error } = await supabaseServer.from("koleex_employees").update(employee).eq("id", me.id);
    if (error) {
      console.error("[api/me/hr/profile employee]", error.message);
      return NextResponse.json({ error: "Could not save." }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}
